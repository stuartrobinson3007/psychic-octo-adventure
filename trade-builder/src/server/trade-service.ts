import { Context, Effect, Layer } from "effect"
import { HttpClient } from "effect/http"
import { readContractOptions } from "./contract-options.ts"
import type {
  ContractOptions,
  InvalidContractOptionsError,
} from "./contract-options.ts"
import {
  readTradeServiceJson,
  postTradeServiceJson,
} from "./trade-service-http.ts"
import type {
  TradeServiceRequestError,
  TradeServiceResponse,
} from "./trade-service-http.ts"

export class TradeService extends Context.Service<
  TradeService,
  {
    readonly json: (
      path: string
    ) => Effect.Effect<unknown, TradeServiceRequestError>
    readonly post: (
      path: string,
      body: unknown,
      timeoutMs?: number
    ) => Effect.Effect<TradeServiceResponse, TradeServiceRequestError>
    readonly contractOptions: (
      playerId: number,
      teamId: number
    ) => Effect.Effect<
      ContractOptions,
      TradeServiceRequestError | InvalidContractOptionsError
    >
  }
>()("trade-builder/server/TradeService") {
  static readonly layer = Layer.effect(
    TradeService,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const json = Effect.fn("TradeService.json")(
        (path: string) => readTradeServiceJson(path),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const contractOptions = Effect.fn("TradeService.contractOptions")(
        (playerId: number, teamId: number) =>
          readContractOptions(playerId, teamId),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      const post = Effect.fn("TradeService.post")(
        (path: string, body: unknown, timeoutMs?: number) =>
          postTradeServiceJson(path, body, timeoutMs),
        Effect.provideService(HttpClient.HttpClient, client)
      )
      return TradeService.of({ json, post, contractOptions })
    })
  )
}
