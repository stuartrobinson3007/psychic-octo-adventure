import OpenAI from "openai"
import { Result, Schema } from "effect"

const decodeProviderFailure = Schema.decodeUnknownResult(
  Schema.Struct({
    error: Schema.optional(
      Schema.Struct({
        code: Schema.optional(Schema.NullOr(Schema.String)),
        type: Schema.optional(Schema.NullOr(Schema.String)),
        message: Schema.optional(Schema.NullOr(Schema.String)),
      })
    ),
  })
)

export const assistantUnavailableMessage =
  "The trade assistant is unavailable right now. Try again later."

type FailureKind =
  "credits" | "authentication" | "rate_limit" | "timeout" | "unknown"
class ChatServiceError extends Error {
  readonly kind: FailureKind
  constructor(kind: FailureKind) {
    super(kind)
    this.kind = kind
  }
}

function providerFailure(
  status: number | undefined,
  body: unknown
): FailureKind {
  const decoded = decodeProviderFailure(body)
  const error = Result.isSuccess(decoded) ? decoded.success.error : undefined
  if (
    error?.code === "insufficient_quota" ||
    error?.type === "insufficient_quota" ||
    /(?:no credits remaining|exceeded your current quota)/i.test(
      error?.message ?? ""
    )
  )
    return "credits"
  if (status === 401 || status === 403) return "authentication"
  if (status === 429) return "rate_limit"
  return "unknown"
}

/** Fatal account errors must not be retried as temporary HTTP 429 failures. */
export function chatServiceFetch(
  fetchRequest: typeof fetch = fetch
): typeof fetch {
  return async (input, init) => {
    const response = await fetchRequest(input, init)
    if (!response.ok) {
      let body: unknown
      try {
        body = await response.clone().json()
      } catch {
        /* Let the SDK handle non-JSON errors. */
      }
      const kind = providerFailure(response.status, body)
      if (kind === "credits" || kind === "authentication")
        throw new ChatServiceError(kind)
    }
    return response
  }
}

export function chatFailure(error: unknown): {
  kind: FailureKind
  status: "error" | "agent_unavailable"
  message: string
} {
  let kind: FailureKind = "unknown"
  const seen = new Set<unknown>()
  for (let current = error; current && !seen.has(current);) {
    seen.add(current)
    if (current instanceof ChatServiceError) {
      kind = current.kind
      break
    }
    if (current instanceof OpenAI.APIError) {
      kind = providerFailure(current.status, { error: current.error })
      if (kind !== "unknown") break
    }
    if (
      current instanceof Error &&
      (["TimeoutError", "AbortError"].includes(current.name) ||
        current instanceof OpenAI.APIUserAbortError ||
        current instanceof OpenAI.APIConnectionTimeoutError)
    ) {
      kind = "timeout"
      break
    }
    current = current instanceof Error ? current.cause : undefined
  }
  const messages: Record<FailureKind, string> = {
    credits: assistantUnavailableMessage,
    authentication: assistantUnavailableMessage,
    rate_limit: "The trade assistant is busy. Try again shortly.",
    timeout: "This request took too long to finish. Please try again.",
    unknown: "This request couldn’t be completed. Try again.",
  }
  return {
    kind,
    status:
      kind === "credits" || kind === "authentication"
        ? "agent_unavailable"
        : "error",
    message: messages[kind],
  }
}
