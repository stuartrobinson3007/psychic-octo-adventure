import { Effect, Schema } from "effect"
import { useEffect, useRef } from "react"

export class WorkspaceRequestError extends Schema.TaggedError<WorkspaceRequestError>()(
  "WorkspaceRequestError",
  { cause: Schema.Defect() }
) {}

export const workspaceRequest = Effect.fn("workspaceRequest")(
  <TValue>(operation: (signal: AbortSignal) => Promise<TValue>) =>
    Effect.tryPromise({
      try: operation,
      catch: (cause) => new WorkspaceRequestError({ cause }),
    })
)

/** React owns these requests; each invocation owns its deadline and cancellation. */
export function useWorkspaceRequests(generation = 0) {
  const requests = useRef(new Set<AbortController>())
  useEffect(() => {
    const pending = requests.current
    return () => {
      for (const request of pending) request.abort()
      pending.clear()
    }
  }, [generation])
  return <TValue, TError>(
    program: (active: () => boolean) => Effect.Effect<TValue, TError>,
    timeoutMs = 75_000
  ): Promise<TValue> => {
    const cancellation = new AbortController()
    const pending = requests.current
    pending.add(cancellation)
    return Effect.runPromise(
      Effect.scoped(program(() => !cancellation.signal.aborted)).pipe(
        Effect.timeout(timeoutMs),
        Effect.withSpan("workspaceRequest.lifecycle")
      ),
      { signal: cancellation.signal }
    ).finally(() => pending.delete(cancellation))
  }
}
