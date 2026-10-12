import type { TradeProposal, ScenarioSigning, TradeSnapshot } from "./types.ts"

export const linkedSigningScopeMessage =
  "Checked using the team’s payroll before the trade. We haven’t checked whether both moves work together."

/** A signing joins its signing team unless the same proposal transfers the player. */
export function signingTransfer(
  proposal: TradeProposal,
  signing: ScenarioSigning
) {
  return proposal.transfers.find(
    (transfer) =>
      transfer.assetType === "player" && transfer.assetId === signing.playerId
  )
}

export function directSignings(proposal: TradeProposal, teamId?: number) {
  return (proposal.signings ?? []).filter(
    (signing) =>
      !signingTransfer(proposal, signing) &&
      (teamId === undefined || signing.signingTeamId === teamId)
  )
}

/** Older passing signing records did not establish complete transaction eligibility. */
export function transactionStatus({ proposal, verdict }: TradeSnapshot) {
  return verdict?.status === "valid" &&
    proposal.transfers.length &&
    proposal.signings?.length
    ? ("validation_incomplete" as const)
    : verdict?.status
}
