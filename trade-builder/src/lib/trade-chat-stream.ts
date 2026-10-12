import { Context, Effect, Layer, Option, Schema, Stream } from "effect"
import { Sse } from "effect/encoding"
import {
  FetchHttpClient,
  Headers as HttpHeaders,
  HttpClient,
  HttpClientRequest,
} from "effect/http"
import {
  maxTradeEventSize,
  TradeChatEventSchema,
  tradeStreamInterrupted,
} from "./trade-chat-protocol.ts"
import type {
  ChatTurnInput,
  ChatTurnResult,
  ToolActivity,
} from "./trade/types.ts"

export interface TradeChatTransportOptions {
  api?: string
  fetch?: typeof fetch
}

export class TradeStreamError extends Schema.TaggedError<TradeStreamError>()(
  "TradeStreamError",
  {
    message: Schema.String,
    cause: Schema.Defect(),
  }
) {}

const streamFailure = (cause: unknown) =>
  cause instanceof TradeStreamError
    ? cause
    : new TradeStreamError({ message: tradeStreamInterrupted, cause })

class TradeChatClient extends Context.Service<
  TradeChatClient,
  {
    readonly send: (
      input: ChatTurnInput,
      onProgress: (calls: ToolActivity[]) => void
    ) => Effect.Effect<ChatTurnResult, TradeStreamError>
  }
>()("trade-builder/lib/TradeChatClient") {
  static layer(api: string) {
    return Layer.effect(
      TradeChatClient,
      Effect.gen(function* () {
        const client = HttpClient.filterStatusOk(
          HttpClient.withScope(yield* HttpClient.HttpClient)
        )
        return TradeChatClient.of({
          send: Effect.fn("TradeChatClient.send")(
            function* (input, onProgress) {
              const response = yield* HttpClientRequest.post(api).pipe(
                HttpClientRequest.setHeader("accept", "text/event-stream"),
                HttpClientRequest.bodyJson(input),
                Effect.flatMap(client.execute)
              )
              const contentType = Option.getOrElse(
                HttpHeaders.get(response.headers, "content-type"),
                () => ""
              )
              if (
                contentType.split(";")[0].trim().toLowerCase() !==
                "text/event-stream"
              )
                return yield* streamFailure("Unexpected response format")
              let started = false
              let result: ChatTurnResult | undefined
              const activities = new Map<string, ToolActivity>()
              yield* response.stream.pipe(
                Stream.decodeText(),
                Stream.pipeThroughChannel(
                  Sse.decodeDataSchema(TradeChatEventSchema, {
                    maxEventSize: maxTradeEventSize,
                  })
                ),
                Stream.runForEach(({ event: name, data: event }) =>
                  Effect.gen(function* () {
                    if (
                      name !== "message" ||
                      event.requestId !== input.requestId ||
                      result
                    )
                      return yield* streamFailure(
                        "Unexpected event identity or order"
                      )
                    if (event.type === "start") {
                      if (started)
                        return yield* streamFailure("Repeated start event")
                      started = true
                      return
                    }
                    if (!started)
                      return yield* streamFailure("Missing start event")
                    if (event.type === "error")
                      return yield* streamFailure(undefined)
                    if (event.type === "result") {
                      result = event.result
                      return
                    }
                    activities.set(event.activity.id, event.activity)
                    yield* Effect.sync(() =>
                      onProgress([...activities.values()])
                    )
                  })
                )
              )
              if (!result)
                return yield* streamFailure("Missing completed reply")
              return result
            },
            Effect.mapError(streamFailure),
            Effect.scoped
          ),
        })
      })
    )
  }
}

/** Submit a turn and consume the application's versioned SSE events. */
export function sendStreamingTradeMessage(
  input: ChatTurnInput,
  onProgress: (calls: ToolActivity[]) => void,
  options: TradeChatTransportOptions = {},
  signal?: AbortSignal
): Promise<ChatTurnResult> {
  const httpLayer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, options.fetch ?? fetch))
  )
  return Effect.runPromise(
    TradeChatClient.use((client) => client.send(input, onProgress)).pipe(
      Effect.provide(
        TradeChatClient.layer(options.api ?? "/api/trade-chat").pipe(
          Layer.provide(httpLayer)
        )
      ),
      Effect.timeout("95 seconds"),
      Effect.mapError(streamFailure),
      Effect.withSpan("sendStreamingTradeMessage")
    ),
    { signal }
  )
}
