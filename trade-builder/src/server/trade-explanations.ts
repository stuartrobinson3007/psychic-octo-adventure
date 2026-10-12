import { TradeDomainError } from "./trade-errors.ts"
import { transactionStatus } from "../lib/trade/signings.ts"
import { scenarioDescriptions } from "../lib/trade/scenario.ts"
import { assetLabel } from "../lib/trade/picks.ts"
import type { Catalogue, TradeSnapshot } from "../lib/trade/types.ts"

const dollars = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)

export function verdictMessage(snapshot: TradeSnapshot): string {
  const verdict = snapshot.verdict
  if (!verdict) return "This proposal has not been checked yet."
  if (!snapshot.proposal.transfers.length) return verdict.summary
  if (transactionStatus(snapshot) === "validation_incomplete")
    return "The available salary checks passed. Some signing requirements could not be checked."
  if (verdict.status === "valid")
    return `This trade passes the ${verdict.season} salary and roster checks.${snapshot.proposal.transfers.some((item) => item.assetType === "pick") ? " Pick ownership and availability were checked; existing protections are retained." : ""}`
  if (verdict.status === "invalid_trade") return verdict.summary
  return verdict.summary
}

// The model chooses the explanation operation and team. Names, directions and
// salary evidence are rendered from the checked proposal, never regenerated.
export function explainVerdict(
  snapshot: TradeSnapshot,
  catalogue: Catalogue,
  teamId?: number
): string {
  const verdict = snapshot.verdict
  if (
    !verdict ||
    verdict.status === "validation_unavailable" ||
    verdict.status === "invalid_proposal"
  )
    return verdictMessage(snapshot)
  const teams = verdict.teams.filter(
    (team) => teamId === undefined || team.teamId === teamId
  )
  if (!teams.length)
    throw new TradeDomainError("Choose a team from the checked trade.")
  const assetNames = (team: number, direction: "fromTeamId" | "toTeamId") =>
    snapshot.proposal.transfers
      .filter((transfer) => transfer[direction] === team)
      .map((transfer) => assetLabel(transfer, catalogue))
      .join(", ") || "no assets"
  return [
    verdictMessage(snapshot),
    ...scenarioDescriptions(snapshot.proposal, catalogue),
    ...(verdict.limitations ?? []),
    ...teams.map((team) =>
      [
        snapshot.proposal.transfers.length
          ? `${team.teamName} sends ${assetNames(team.teamId, "fromTeamId")} (${dollars(team.salaryOut)}) and receives ${assetNames(team.teamId, "toTeamId")} (${dollars(team.salaryIn)}). Payroll becomes ${dollars(team.newTotalSalary)} (${team.newCapStatus}).`
          : `${team.teamName} hypothetical payroll becomes ${dollars(team.newTotalSalary)} (${team.newCapStatus}), using current roster data.`,
        ...team.violations,
        ...team.allowances,
      ].join("\n")
    ),
  ].join("\n\n")
}
