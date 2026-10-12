import { linkedSigningScopeMessage } from "@/lib/trade/signings"
import { signingContractLabel } from "@/lib/trade/contract-type-label"
import { scenarioDescriptions } from "@/lib/trade/scenario"
import { money } from "@/lib/player-research"
import type { TradeRecord } from "./trade-card"
import { TeamMark } from "./team-mark"

const dollars = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)

export function payrollScenarioTitle(record: TradeRecord): string {
  const { proposal } = record.snapshot
  const signings = proposal.signings ?? []
  const overrides = proposal.salaryOverrides ?? []
  if (signings.length === 1 && !overrides.length) {
    const signing = signings[0]
    const team = record.teams.find((item) => item.id === signing.signingTeamId)
    const player = record.players.find((item) => item.id === signing.playerId)
    return `${team?.city ?? team?.name ?? "Team"} signs ${player?.name ?? "player"}`
  }
  if (overrides.length === 1 && !signings.length) {
    const override = overrides[0]
    const player = record.players.find((item) => item.id === override.playerId)
    return override.isStretchAndWaive
      ? `Stretch and waive ${player?.name ?? "player"}`
      : `${player?.name ?? "Player"} contract change`
  }
  return record.teams.length === 1
    ? `${record.teams[0].city ?? record.teams[0].name} payroll changes`
    : "Payroll changes"
}

/** Terms distinguish proposals even when their player or team title is unchanged. */
export function payrollScenarioSummary(
  record: TradeRecord
): string | undefined {
  const { proposal } = record.snapshot
  const signings = proposal.signings ?? []
  const overrides = proposal.salaryOverrides ?? []
  if (overrides.length === 1 && !signings.length) {
    const override = overrides[0]
    const player = record.players.find((item) => item.id === override.playerId)
    const identity = proposal.transfers.length
      ? `${player?.name ?? "Player"}: `
      : ""
    return `${identity}${money(override.salary)}/year · ${override.yearsRemaining} ${override.yearsRemaining === 1 ? "year" : "years"}`
  }
  if (signings.length === 1 && !overrides.length) {
    const signing = signings[0]
    const signAndTrade = proposal.transfers.some(
      (transfer) =>
        transfer.assetType === "player" && transfer.assetId === signing.playerId
    )
    return `${signAndTrade ? "Sign-and-trade · " : ""}${money(signing.salary)}${signing.contractYears > 1 ? " first year" : ""} · ${signing.contractYears} ${signing.contractYears === 1 ? "year" : "years"}`
  }
  return undefined
}

export function PayrollScenario({ record }: { record: TradeRecord }) {
  const { proposal, verdict } = record.snapshot
  const singleSigning =
    proposal.signings?.length === 1 &&
    !proposal.salaryOverrides?.length &&
    !proposal.exceptions?.length
      ? proposal.signings[0]
      : undefined
  const notes = scenarioDescriptions(proposal, {
    players: record.players,
    teams: record.teams,
    tradeExceptions: record.exceptions,
  })
  return (
    <div className="flex min-w-0 flex-col gap-5 pb-3 text-sm leading-5">
      {proposal.relatedTrade && (
        <p className="text-muted-foreground">{linkedSigningScopeMessage}</p>
      )}
      {singleSigning ? (
        <dl className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Contract</dt>
          <dd className="min-w-0 tabular-nums">
            {singleSigning.contractYears}{" "}
            {singleSigning.contractYears === 1 ? "year" : "years"}
            {" · "}
            {signingContractLabel(singleSigning)}
            {" · "}
            {dollars(singleSigning.salary)}
            {singleSigning.contractYears > 1 && " first year"}
          </dd>
        </dl>
      ) : notes.length ? (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {verdict?.teams.map((evidence) => {
        const team = record.teams.find((item) => item.id === evidence.teamId)
        return (
          <section
            key={evidence.teamId}
            aria-label={`${evidence.teamName} payroll`}
            className="not-first:border-t not-first:pt-4"
          >
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              {team && <TeamMark team={team} size="compact" />}
              {team?.name ?? evidence.teamName} payroll
            </h3>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 tabular-nums [&>dd]:text-right [&>dt]:text-muted-foreground">
              <dt>Before</dt>
              <dd>
                {dollars(evidence.newTotalSalary - evidence.netSalaryChange)}
              </dd>
              <dt>Change</dt>
              <dd>
                {evidence.netSalaryChange > 0 ? "+" : ""}
                {dollars(evidence.netSalaryChange)}
              </dd>
              <dt>After</dt>
              <dd className="font-medium">
                {dollars(evidence.newTotalSalary)}
              </dd>
            </dl>
            <p className="mt-2 text-right text-xs text-muted-foreground">
              {evidence.newCapStatus}
            </p>
          </section>
        )
      })}
      {verdict?.status === "valid" &&
      proposal.signings?.length &&
      (proposal.signings.length > 1 ||
        Boolean(proposal.salaryOverrides?.length)) ? (
        <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
          Contracts checked individually. Combined signing eligibility not
          checked.
        </p>
      ) : null}
    </div>
  )
}
