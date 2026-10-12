import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  createEvent,
  getFunctionCalls,
  getFunctionResponses,
} from "@google/adk"
import type { BaseLlm, BaseTool } from "@google/adk"
import { Effect, Stream } from "effect"
import { toolActivity } from "../lib/tool-activity.ts"
import type { Catalogue, ToolActivity } from "../lib/trade/types.ts"

export interface AgentStep {
  tools: Array<{ name: string; input: unknown }>
  results: Array<{ name: string; output: unknown }>
}

export async function runAdkTradeAgent(options: {
  model: BaseLlm
  instructions: string
  tools: BaseTool[]
  history: Array<{ role: "user" | "assistant"; content: string }>
  message: string
  requestId: string
  catalogue: Catalogue
  finished: () => boolean
  signal: AbortSignal
  onActivity: (activity: ToolActivity) => void
  onStep?: (step: AgentStep) => void
}): Promise<string> {
  const agent = new LlmAgent({
    name: "trade_assistant",
    model: options.model,
    instruction: options.instructions,
    tools: options.tools,
    generateContentConfig: { maxOutputTokens: 3500 },
    beforeToolCallback: ({ tool, args, context }) => {
      options.onActivity(
        toolActivity(
          context.functionCallId ?? crypto.randomUUID(),
          tool.name,
          args,
          "running",
          options.catalogue
        )
      )
      return undefined
    },
    afterToolCallback: ({ tool, args, context, response }) => {
      const failed =
        "error" in response ||
        ["invalid_request", "validation_unavailable"].includes(
          String(response.status)
        )
      options.onActivity(
        toolActivity(
          context.functionCallId ?? crypto.randomUUID(),
          tool.name,
          args,
          failed ? "error" : "complete",
          options.catalogue,
          response
        )
      )
      if (options.finished()) context.actions.skipSummarization = true
      return undefined
    },
  })
  const sessions = new InMemorySessionService()
  const appName = "gambit_trade"
  const userId = "invocation"
  const sessionId = options.requestId
  const session = await sessions.createSession({ appName, userId, sessionId })
  for (const [index, message] of options.history.entries())
    await sessions.appendEvent({
      session,
      event: createEvent({
        invocationId: `history-${index}`,
        author: message.role === "assistant" ? agent.name : "user",
        content: {
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        },
      }),
    })
  const runner = new Runner({ appName, agent, sessionService: sessions })
  let text = ""
  let step: AgentStep = { tools: [], results: [] }
  const events = runner.runAsync({
    userId,
    sessionId,
    newMessage: { role: "user", parts: [{ text: options.message }] },
    runConfig: { maxLlmCalls: 18 },
    abortSignal: options.signal,
  })
  await Effect.runPromise(
    Stream.fromAsyncIterable(events, (cause) => cause).pipe(
      Stream.runForEach((event) =>
        Effect.sync(() => {
          if (event.errorCode)
            throw new Error(
              event.errorMessage ?? "The agent could not complete this request."
            )
          const calls = getFunctionCalls(event)
          if (calls.length)
            step.tools.push(
              ...calls.map((call) => ({
                name: call.name ?? "",
                input: call.args,
              }))
            )
          const responses = getFunctionResponses(event)
          if (responses.length) {
            step.results.push(
              ...responses.map((result) => ({
                name: result.name ?? "",
                output: result.response,
              }))
            )
            options.onStep?.(step)
            step = { tools: [], results: [] }
          }
          if (
            event.content?.role === "model" &&
            !calls.length &&
            !event.partial
          )
            text +=
              event.content.parts?.map((part) => part.text ?? "").join("") ?? ""
        })
      )
    ),
    { signal: options.signal }
  )
  return text
}
