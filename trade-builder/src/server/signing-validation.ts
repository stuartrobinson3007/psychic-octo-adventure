import { signingTransfer } from "../lib/trade/signings.ts"
import type {
  Catalogue,
  TradeProposal,
  TeamVerdict,
} from "../lib/trade/types.ts"

/** Rules supported by actual proposal/catalogue evidence; never infer roster history. */
export function signingTradeIssues(
  proposal: TradeProposal,
  catalogue: Catalogue
) {
  const issues: string[] = []
  for (const signing of proposal.signings ?? []) {
    const player = catalogue.players.find(
      (item) => item.id === signing.playerId
    )
    const name = player?.name ?? "This player"
    if (signing.tierId === "minimum" && signing.contractYears > 2)
      issues.push(
        `${name} cannot use the minimum exception for a contract longer than two years. Choose an eligible funding route for the longer contract.`
      )
    const transfer = signingTransfer(proposal, signing)
    if (!transfer) continue
    if (signing.contractYears < 3 || signing.contractYears > 4)
      issues.push(
        `${name} needs a three- or four-year contract for a sign-and-trade. A one- or two-year signing can stay with its signing team.`
      )
    if (player && signing.signingTeamId !== player.teamId)
      issues.push(
        `${name} cannot be signed and immediately traded by a new team. A sign-and-trade must be arranged through his previous team.`
      )
    if (["mle", "room-mle"].includes(signing.tierId ?? ""))
      issues.push(
        `${name} cannot be signed and traded using the non-taxpayer mid-level or room exception.`
      )
    if (signing.firstYearGuaranteed === false)
      issues.push(
        `${name} needs a fully guaranteed first year for a sign-and-trade.`
      )
    if (
      proposal.salaryOverrides?.some(
        (item) => item.playerId === signing.playerId
      )
    )
      issues.push(
        `${name} has both a signing and a contract override. Update the proposed signing terms instead so its contract and trade salary agree.`
      )
  }
  return issues
}

/** The receiving team's hard cap applies after every move in the proposal. */
export function signAndTradeApronIssues(
  proposal: TradeProposal,
  catalogue: Catalogue,
  teams: TeamVerdict[]
) {
  return (proposal.signings ?? []).flatMap((signing) => {
    const transfer = signingTransfer(proposal, signing)
    const team = teams.find((item) => item.teamId === transfer?.toTeamId)
    if (!transfer || !team || team.newTotalSalary <= catalogue.cap.firstApron)
      return []
    return [
      {
        teamId: team.teamId,
        message: `${team.teamName} cannot receive a sign-and-trade player with payroll above the first apron. The deal must bring payroll to the first apron or below.`,
      },
    ]
  })
}

/** Missing service evidence is an incomplete check, rather than a passing transaction. */
export function signingReviewReasons(
  proposal: TradeProposal,
  catalogue: Catalogue
) {
  const reasons: string[] = []
  for (const signing of proposal.signings ?? []) {
    if (!signingTransfer(proposal, signing)) continue
    const name =
      catalogue.players.find((item) => item.id === signing.playerId)?.name ??
      "This player"
    if (
      signing.contractYears > 2 &&
      signing.contractType === "minimum" &&
      !signing.fundingLabel
    )
      reasons.push(
        `${name}’s funding route for this longer contract has not been specified.`
      )
    reasons.push(
      `${name}’s previous-season roster eligibility and sign-and-trade timing have not been verified.`
    )
    if (signing.firstYearGuaranteed !== true)
      reasons.push(`${name}’s first-year guarantee has not been specified.`)
    reasons.push(
      `${name}’s previous salary and bonuses are unavailable, so any special sign-and-trade salary-matching adjustment has not been checked.`
    )
  }
  if (
    (proposal.signings?.length ?? 0) > 0 &&
    (proposal.transfers.length || proposal.signings!.length > 1)
  )
    reasons.push(
      "Contracts were checked individually. Shared signing funds and roster space after all moves have not been checked."
    )
  return reasons
}
