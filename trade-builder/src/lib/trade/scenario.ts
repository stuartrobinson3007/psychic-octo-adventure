import type { Catalogue, TradeProposal } from "./types.ts"
import { signingContractLabel } from "./contract-type-label.ts"

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
export function scenarioDescriptions(
  proposal: TradeProposal,
  catalogue: Pick<Catalogue, "players" | "teams" | "tradeExceptions">
): Array<string> {
  const name = (id: number) =>
    catalogue.players.find((player) => player.id === id)?.name ??
    "Unavailable player"
  const team = (id: number) =>
    catalogue.teams.find((candidate) => candidate.id === id)?.abbreviation ??
    "Unavailable team"
  return [
    ...(proposal.salaryOverrides ?? []).map(
      (item) =>
        `${name(item.playerId)}: ${money(item.salary)}/year for ${item.yearsRemaining} year${item.yearsRemaining === 1 ? "" : "s"}${item.isStretchAndWaive ? " (stretch-and-waive obligation; player cannot be traded)" : " (hypothetical contract)"}`
    ),
    ...(proposal.signings ?? []).map(
      (item) =>
        `${team(item.signingTeamId)} signs ${name(item.playerId)}: ${money(item.salary)} first year, ${item.contractYears} year${item.contractYears === 1 ? "" : "s"} (${signingContractLabel(item)})${proposal.transfers.some((t) => t.assetType === "player" && t.assetId === item.playerId) ? "; sign-and-trade" : "; hypothetical signing"}`
    ),
    ...(proposal.exceptions ?? []).map((item) => {
      const exception = catalogue.tradeExceptions?.find(
        (candidate) =>
          candidate.id === item.exceptionId && candidate.teamId === item.teamId
      )
      const source = item.sourcePlayerName ?? exception?.playerName
      return `${team(item.teamId)} uses ${exception ? `${source ? `${source} ` : ""}${money(exception.amount)} trade exception (expires ${exception.expiresAt.slice(0, 10)})` : "a trade exception"}`
    }),
  ]
}
