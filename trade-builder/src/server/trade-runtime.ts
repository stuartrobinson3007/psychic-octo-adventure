import { Layer, ManagedRuntime } from "effect"
import { FetchHttpClient } from "effect/http"
import { TradeService } from "./trade-service.ts"

export function createTradeRuntime(fetchRequest: typeof fetch) {
  const httpLayer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchRequest))
  )
  return ManagedRuntime.make(TradeService.layer.pipe(Layer.provide(httpLayer)))
}

export type TradeRuntime = ReturnType<typeof createTradeRuntime>

let sharedRuntime: TradeRuntime | undefined

export function getTradeRuntime(): TradeRuntime {
  return (sharedRuntime ??= createTradeRuntime(fetch))
}

export async function disposeTradeRuntime(): Promise<void> {
  const runtime = sharedRuntime
  sharedRuntime = undefined
  await runtime?.dispose()
}

if (import.meta.hot) import.meta.hot.dispose(() => disposeTradeRuntime())
