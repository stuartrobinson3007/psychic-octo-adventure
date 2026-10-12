import { BaseLlm } from "@google/adk"
import type { BaseLlmConnection, LlmRequest, LlmResponse } from "@google/adk"
import { Effect, Schedule, Schema } from "effect"
import OpenAI from "openai"
import type {
  ResponseInput,
  FunctionTool,
} from "openai/resources/responses/responses"
import { TradeFunctionTool } from "./trade-function-tool.ts"
import { chatFailure, chatServiceFetch } from "./chat-service-error.ts"

class ModelRequestError extends Schema.TaggedError<ModelRequestError>()(
  "ModelRequestError",
  { message: Schema.String, retryable: Schema.Boolean, cause: Schema.Defect() }
) {}

class ModelResponseError extends Schema.TaggedError<ModelResponseError>()(
  "ModelResponseError",
  {
    message: Schema.String,
    cause: Schema.Defect(),
  }
) {}

const ModelResponseSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  status: Schema.Literal("completed"),
  output: Schema.Array(
    Schema.Union([
      Schema.Struct({
        type: Schema.Literal("function_call"),
        call_id: Schema.NonEmptyString,
        name: Schema.NonEmptyString,
        arguments: Schema.fromJsonString(
          Schema.Record(Schema.String, Schema.Unknown)
        ),
      }),
      Schema.Struct({
        type: Schema.Literal("message"),
        content: Schema.Array(
          Schema.Union([
            Schema.Struct({
              type: Schema.Literal("output_text"),
              text: Schema.String,
            }),
            Schema.Struct({
              type: Schema.Literal("refusal"),
              refusal: Schema.String,
            }),
          ])
        ),
      }),
      Schema.Struct({ type: Schema.Literal("reasoning") }),
    ])
  ),
  usage: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        input_tokens: Schema.Finite,
        output_tokens: Schema.Finite,
        total_tokens: Schema.Finite,
      })
    )
  ),
})

const retrySchedule = Schedule.max([
  Schedule.exponential("250 millis"),
  Schedule.recurs(2),
]).pipe(
  Schedule.setInputType<ModelRequestError>(),
  Schedule.while(({ input }) => input.retryable)
)

function instructions(request: LlmRequest): string {
  const value = request.config?.systemInstruction
  if (!value) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value))
    return value
      .map((part) => (typeof part === "string" ? part : (part.text ?? "")))
      .join("\n")
  if ("parts" in value)
    return value.parts?.map((part) => part.text ?? "").join("\n") ?? ""
  return "text" in value ? (value.text ?? "") : ""
}

/** One instance belongs to one ADK invocation; continuation IDs never cross conversations. */
export class OpenAIAdkModel extends BaseLlm {
  private readonly client: OpenAI
  private previousResponseId?: string
  private consumedContents = 0

  constructor(options: {
    model: string
    apiKey: string
    fetchRequest?: typeof fetch
  }) {
    super({ model: options.model })
    this.client = new OpenAI({
      apiKey: options.apiKey,
      fetch: chatServiceFetch(options.fetchRequest),
      maxRetries: 0,
    })
  }

  async *generateContentAsync(
    request: LlmRequest,
    _stream = false,
    abortSignal?: AbortSignal
  ): AsyncGenerator<LlmResponse, void> {
    const input: ResponseInput = []
    for (const content of request.contents.slice(
      this.previousResponseId ? this.consumedContents : 0
    )) {
      for (const part of content.parts ?? []) {
        if (part.functionResponse) {
          if (!part.functionResponse.id)
            throw new Error("A tool response is missing its call identifier.")
          input.push({
            type: "function_call_output",
            call_id: part.functionResponse.id,
            output: JSON.stringify(part.functionResponse.response),
          })
        } else if (
          part.text &&
          (!this.previousResponseId || content.role !== "model")
        ) {
          input.push({
            role: content.role === "model" ? "assistant" : "user",
            content: part.text,
          })
        }
      }
    }
    const tools: FunctionTool[] = Object.values(request.toolsDict)
      .filter(
        (tool) =>
          !request.allowedTools || request.allowedTools.includes(tool.name)
      )
      .map((tool) => {
        if (!(tool instanceof TradeFunctionTool))
          throw new Error(
            "The OpenAI adapter supports the application's schema-defined function tools."
          )
        return {
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.jsonSchema,
          strict: false,
        }
      })
    const response = await Effect.runPromise(
      Effect.tryPromise({
        try: (signal) =>
          this.client.responses.create(
            {
              model: this.model,
              instructions: instructions(request),
              input,
              tools,
              previous_response_id: this.previousResponseId,
              parallel_tool_calls: false,
              reasoning: { effort: "low" },
              max_output_tokens: 3500,
              stream: false,
            },
            { signal }
          ),
        catch: (cause) => {
          const failure = chatFailure(cause)
          return new ModelRequestError({
            message: failure.message,
            retryable:
              failure.kind === "rate_limit" ||
              (failure.kind === "unknown" &&
                (cause instanceof OpenAI.APIConnectionError ||
                  (cause instanceof OpenAI.APIError &&
                    (cause.status ?? 0) >= 500))),
            cause,
          })
        },
      }).pipe(
        Effect.retry(retrySchedule),
        Effect.flatMap((rawResponse) =>
          Schema.decodeUnknownEffect(ModelResponseSchema)(rawResponse)
        ),
        Effect.mapError((cause) =>
          cause instanceof ModelRequestError
            ? cause
            : new ModelResponseError({
                message:
                  "The model returned an incomplete or malformed response.",
                cause,
              })
        )
      ),
      { signal: abortSignal }
    )
    this.previousResponseId = response.id
    this.consumedContents = request.contents.length
    const parts: NonNullable<NonNullable<LlmResponse["content"]>["parts"]> = []
    const availableTools = new Set(tools.map((tool) => tool.name))
    for (const item of response.output) {
      if (item.type === "function_call") {
        if (!availableTools.has(item.name))
          throw new ModelResponseError({
            message: "The model requested an unavailable tool.",
            cause: item.name,
          })
        parts.push({
          functionCall: {
            id: item.call_id,
            name: item.name,
            args: item.arguments,
          },
        })
      } else if (item.type === "message")
        for (const part of item.content)
          if (part.type === "output_text") parts.push({ text: part.text })
    }
    yield {
      content: { role: "model", parts },
      turnComplete: true,
      usageMetadata: response.usage
        ? {
            promptTokenCount: response.usage.input_tokens,
            candidatesTokenCount: response.usage.output_tokens,
            totalTokenCount: response.usage.total_tokens,
          }
        : undefined,
    }
  }

  connect(_request: LlmRequest): Promise<BaseLlmConnection> {
    return Promise.reject(
      new Error(
        "Live audio/video connections are not supported by the trade model adapter."
      )
    )
  }
}
