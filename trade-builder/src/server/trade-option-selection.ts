import type { TradeReference } from "../lib/trade/types.ts"
import type { TradeSession } from "./trade-session.ts"

/** Resolve an explicit choice against the most recently displayed batch, in display order. */
export function selectedTradeOption(
  session: TradeSession,
  message: string
): TradeReference | null {
  const match = message
    .toLowerCase()
    .match(
      /^\s*(?:please\s+)?(?:(?:use|choose|select|apply|go\s+with|let'?s\s+(?:use|choose|go\s+with))\s+)?(?:the\s+)?(?:(first|second|third|1st|2nd|3rd)\s+(?:checked\s+|repair\s+|trade\s+)?(?:option|candidate|one|trade)|(?:option|candidate)\s*([123]))[.!\s]*$/
    )
  if (!match) return null
  const ordinals: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    "1st": 0,
    "2nd": 1,
    "3rd": 2,
  }
  const index = match[1] ? ordinals[match[1]] : Number(match[2]) - 1
  const offered = session.messages
    .slice()
    .reverse()
    .find(
      (item) => item.role === "assistant" && !!item.candidates?.length
    )?.candidates
  const option = offered?.[index]
  return option
    ? {
        proposalId: option.proposal.proposalId,
        revision: option.proposal.revision,
      }
    : null
}
