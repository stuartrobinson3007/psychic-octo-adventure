import { TradeDomainError } from "./trade-errors.ts"
import { evaluateProposal } from "./trade-api.ts"
import { findProposal } from "./trade-session.ts"
import type { TradeSession } from "./trade-session.ts"
import type {
  Catalogue,
  TradeReference,
  TradeSnapshot,
  TradeVerdict,
} from "../lib/trade/types.ts"

/** Recheck a recorded version; request payloads cannot construct or change a package. */
export async function recheckTradeVersion(
  session: TradeSession,
  reference: TradeReference,
  catalogue: Catalogue,
  evaluate: typeof evaluateProposal = evaluateProposal,
  signal?: AbortSignal
): Promise<TradeSnapshot & { verdict: TradeVerdict }> {
  const source = findProposal(session, reference)
  if (!source)
    throw new TradeDomainError(
      "That trade version is not in this conversation."
    )
  const proposal = {
    ...structuredClone(source.proposal),
    revision:
      Math.max(
        source.proposal.revision,
        ...session.revisions
          .filter((item) => item.proposal.proposalId === reference.proposalId)
          .map((item) => item.proposal.revision)
      ) + 1,
    parent: {
      proposalId: source.proposal.proposalId,
      revision: source.proposal.revision,
    },
    createdAt: new Date().toISOString(),
  }
  return { proposal, verdict: await evaluate(proposal, catalogue, signal) }
}
