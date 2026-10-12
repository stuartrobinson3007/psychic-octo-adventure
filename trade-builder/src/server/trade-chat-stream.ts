import { Effect, Queue, Schema, Stream } from "effect"
import {
  encodeTradeChatEvent,
  tradeStreamInterrupted,
} from "../lib/trade-chat-protocol.ts"
import type { TradeChatEvent } from "../lib/trade-chat-protocol.ts"
import type {
  Catalogue,
  ChatTurnInput,
  ChatTurnResult,
} from "../lib/trade/types.ts"
import { runChatTurn } from "./trade-harness.ts"

class TradeStreamFailure extends Schema.TaggedError<TradeStreamFailure>()(
  "TradeStreamFailure",
  { cause: Schema.Defect() }
) {}

export function tradeChatStreamResponse(
  input: ChatTurnInput,
  catalogue: Catalogue,
  dependencies: Parameters<typeof runChatTurn>[2] = {}
) {
  const envelope: { version: 1; requestId: string } = {
    version: 1,
    requestId: input.requestId,
  }
  const events = Stream.callback<TradeChatEvent>((queue) =>
    Effect.scoped(
      Effect.gen(function* () {
        let running: Promise<ChatTurnResult> | undefined
        yield* Effect.addFinalizer(() =>
          Effect.promise(() =>
            running
              ? running.then(
                  () => undefined,
                  () => undefined
                )
              : Promise.resolve()
          )
        )
        yield* Queue.offer(queue, { ...envelope, type: "start" })
        yield* Effect.tryPromise({
          try: (signal) => {
            const turnSignal = dependencies.signal
              ? AbortSignal.any([dependencies.signal, signal])
              : signal
            running = runChatTurn(input, catalogue, {
              ...dependencies,
              signal: turnSignal,
              onActivity: (activity) => {
                if (turnSignal.aborted) return
                dependencies.onActivity?.(activity)
                Queue.offerUnsafe(queue, {
                  ...envelope,
                  type: "activity",
                  activity,
                })
              },
            })
            return running
          },
          catch: (cause) => new TradeStreamFailure({ cause }),
        }).pipe(
          Effect.flatMap((result) =>
            Queue.offer(queue, { ...envelope, type: "result", result })
          ),
          Effect.catchTag("TradeStreamFailure", () =>
            Effect.gen(function* () {
              yield* Effect.logWarning("Trade stream failed", {
                requestId: input.requestId,
              })
              yield* Queue.offer(queue, {
                ...envelope,
                type: "error",
                message: tradeStreamInterrupted,
              })
            })
          )
        )
      })
    ).pipe(Effect.ensuring(Queue.end(queue)))
  )
  const body = events.pipe(
    Stream.mapEffect((event) => encodeTradeChatEvent(event)),
    Stream.map((json) => `data: ${json}\n\n`),
    Stream.encodeText,
    Stream.toReadableStream
  )
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
