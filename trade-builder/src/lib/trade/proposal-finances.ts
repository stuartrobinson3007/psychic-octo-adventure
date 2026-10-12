import type { Catalogue, TradeProposal } from "./types.ts"

export function scenarioPlayerSalary(
  proposal: TradeProposal,
  catalogue: Catalogue,
  playerId: number
) {
  return (
    proposal.salaryOverrides?.find((item) => item.playerId === playerId)
      ?.salary ??
    proposal.signings?.find((item) => item.playerId === playerId)?.salary ??
    catalogue.players.find((item) => item.id === playerId)?.salary ??
    0
  )
}
export function scenarioPayroll(
  proposal: TradeProposal,
  catalogue: Catalogue,
  teamId: number
): number | undefined {
  const payroll = catalogue.teams.find(
    (team) => team.id === teamId
  )?.totalSalary
  if (payroll === undefined) return undefined
  const delta = (proposal.salaryOverrides ?? [])
    .filter(
      (item) =>
        catalogue.players.find((player) => player.id === item.playerId)
          ?.teamId === teamId &&
        !proposal.signings?.some(
          (signing) => signing.playerId === item.playerId
        )
    )
    .reduce(
      (sum, item) =>
        sum +
        item.salary -
        catalogue.players.find((player) => player.id === item.playerId)!.salary,
      0
    )
  const signed = (proposal.signings ?? [])
    .filter((item) => item.signingTeamId === teamId)
    .reduce(
      (sum, item) =>
        sum + scenarioPlayerSalary(proposal, catalogue, item.playerId),
      0
    )
  return payroll + delta + signed
}
