import { createFileRoute } from "@tanstack/react-router"
import { parseChatTurn } from "@/server/trade-functions"
import { loadCatalogue } from "@/server/trade-api"
import { tradeChatStreamResponse } from "@/server/trade-chat-stream"
import { Clock, Effect, Schema } from "effect"

class InvalidChatRequest extends Schema.TaggedError<InvalidChatRequest>()(
  "InvalidChatRequest",
  { cause: Schema.Defect() }
) {}
class CatalogueUnavailable extends Schema.TaggedError<CatalogueUnavailable>()(
  "CatalogueUnavailable",
  { cause: Schema.Defect() }
) {}

export const Route = createFileRoute("/api/trade-chat")({
  server: {
    handlers: {
      POST: ({ request }) =>
        Effect.runPromise(
          Effect.gen(function* () {
            const started = yield* Clock.currentTimeMillis
            const raw = yield* Effect.tryPromise({
              try: () => request.json(),
              catch: (cause) => new InvalidChatRequest({ cause }),
            })
            const input = yield* Effect.try({
              try: () => parseChatTurn(raw),
              catch: (cause) => new InvalidChatRequest({ cause }),
            })
            const catalogue = yield* Effect.tryPromise({
              try: (signal) => loadCatalogue(false, signal),
              catch: (cause) => new CatalogueUnavailable({ cause }),
            })
            const elapsed = (yield* Clock.currentTimeMillis) - started
            return tradeChatStreamResponse(input, catalogue, {
              signal: request.signal,
              timeoutMs: Math.max(1, 90_000 - elapsed),
            })
          }).pipe(
            Effect.timeout("90 seconds"),
            Effect.catchTag("InvalidChatRequest", () =>
              Effect.succeed(
                new Response("Please send a valid trade request.", {
                  status: 400,
                })
              )
            ),
            Effect.catch(() =>
              Effect.succeed(
                new Response(
                  "Trade data is temporarily unavailable. Try again shortly.",
                  { status: 503 }
                )
              )
            )
          ),
          { signal: request.signal }
        ),
    },
  },
})
