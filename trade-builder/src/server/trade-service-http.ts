import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/http"

export const TRADE_API_BASE = "https://bball-gm.com/api"

export interface TradeServiceResponse {
  status: number
  ok: boolean
  body: unknown
}

export class TradeServiceRequestError extends Schema.TaggedError<TradeServiceRequestError>()(
  "TradeServiceRequestError",
  {
    path: Schema.String,
    message: Schema.String,
    cause: Schema.Defect(),
  }
) {}

export const postTradeServiceJson = Effect.fn("postTradeServiceJson")(
  function* (
    path: string,
    body: unknown,
    timeoutMs = 15_000
  ): Effect.fn.Return<
    TradeServiceResponse,
    TradeServiceRequestError,
    HttpClient.HttpClient
  > {
    const client = HttpClient.withScope(yield* HttpClient.HttpClient)
    return yield* Effect.scoped(
      HttpClientRequest.post(`${TRADE_API_BASE}/${path}`).pipe(
        HttpClientRequest.acceptJson,
        HttpClientRequest.bodyJson(body),
        Effect.flatMap(client.execute),
        Effect.flatMap((response) =>
          Effect.map(response.json, (json) => ({
            status: response.status,
            ok: response.status >= 200 && response.status < 300,
            body: json,
          }))
        ),
        Effect.timeout(timeoutMs),
        Effect.mapError(
          (cause) =>
            new TradeServiceRequestError({
              path,
              message: "Trade checks are temporarily unavailable.",
              cause,
            })
        )
      )
    )
  }
)

export const readTradeServiceJson = Effect.fn("readTradeServiceJson")(
  function* (
    path: string
  ): Effect.fn.Return<
    unknown,
    TradeServiceRequestError,
    HttpClient.HttpClient
  > {
    const client = HttpClient.filterStatusOk(
      HttpClient.withScope(yield* HttpClient.HttpClient)
    )
    return yield* Effect.scoped(
      client
        .get(`${TRADE_API_BASE}/${path}`, {
          headers: { Accept: "application/json" },
        })
        .pipe(
          Effect.flatMap((response) => response.json),
          Effect.timeout("12 seconds"),
          Effect.mapError(
            (cause) =>
              new TradeServiceRequestError({
                path,
                message: "Player data is temporarily unavailable.",
                cause,
              })
          )
        )
    )
  }
)
