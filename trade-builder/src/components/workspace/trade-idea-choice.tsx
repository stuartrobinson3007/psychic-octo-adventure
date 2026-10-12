import type {
  AssetTransfer,
  Catalogue,
  Player,
  TradeIdea,
  TradeProposal,
} from "@/lib/trade/types"
import {
  scenarioPlayerSalary,
  scenarioPayroll,
} from "@/lib/trade/proposal-finances"
import { assetLabel } from "@/lib/trade/picks"
import { money as formatMoney } from "@/lib/player-research"
import { TeamMark } from "./team-mark"
import { PlayerAvatar } from "./player-avatar"
import { Button } from "@/components/ui/button"

function IdeaAsset({
  asset,
  proposal,
  catalogue,
  onInspectPlayer,
}: {
  asset: AssetTransfer
  proposal: TradeProposal
  catalogue: Catalogue
  onInspectPlayer: (player: Player) => void
}) {
  const player =
    asset.assetType === "player"
      ? catalogue.players.find((item) => item.id === asset.assetId)
      : undefined
  const owner = catalogue.teams.find((item) => item.id === asset.fromTeamId)
  const details = player
    ? [
        proposal.teamIds.length > 2 ? owner?.abbreviation : undefined,
        player.position === "?" ? undefined : player.position,
        player.age ? `Age ${player.age}` : undefined,
        player.yearsRemaining ? `${player.yearsRemaining} yr left` : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined
  return (
    <div className="flex min-w-0 items-start gap-1 max-sm:flex-col sm:gap-2">
      {player && (
        <div className="shrink-0 max-sm:hidden">
          <PlayerAvatar player={player} team={owner} showTeamBadge />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 max-sm:w-full">
        {player ? (
          <Button
            type="button"
            variant="text-link"
            className="pointer-events-auto relative h-auto justify-start p-0 text-left text-base font-medium [overflow-wrap:anywhere] whitespace-normal"
            onClick={() => onInspectPlayer(player)}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
            />
            {player.name}
          </Button>
        ) : (
          <div className="text-base font-medium">
            {assetLabel(asset, catalogue)}
          </div>
        )}
        {details && (
          <div className="text-sm text-muted-foreground">{details}</div>
        )}
      </div>
      {player && (
        <div className="shrink-0 text-sm tabular-nums">
          {formatMoney(scenarioPlayerSalary(proposal, catalogue, player.id))}
        </div>
      )}
    </div>
  )
}

export function TradeIdeaChoice({
  idea,
  catalogue,
  onInspectPlayer,
}: {
  idea: TradeIdea
  catalogue: Catalogue
  onInspectPlayer: (player: Player) => void
}) {
  const { proposal, perspectiveTeamId } = idea
  const team = catalogue.teams.find((t) => t.id === perspectiveTeamId)
  const incoming = proposal.transfers.filter(
    (t) => t.toTeamId === perspectiveTeamId
  )
  const outgoing = proposal.transfers.filter(
    (t) => t.fromTeamId === perspectiveTeamId
  )
  const total = (items: typeof incoming) =>
    items.reduce(
      (sum, t) =>
        sum +
        (t.assetType === "player"
          ? scenarioPlayerSalary(proposal, catalogue, t.assetId)
          : 0),
      0
    )
  const change = total(incoming) - total(outgoing)
  const payroll = scenarioPayroll(proposal, catalogue, perspectiveTeamId)
  const payrollAfter = payroll === undefined ? undefined : payroll + change
  const teamName = team?.name ?? "Team"
  const location = team?.city || teamName
  const otherTeams = proposal.teamIds
    .filter((id) => id !== perspectiveTeamId)
    .map((id) => catalogue.teams.find((item) => item.id === id))
    .filter((item) => item !== undefined)
  const title = (
    <div
      data-slot="trade-idea-header"
      className="flex min-h-5 min-w-0 items-start gap-2 text-base/5 font-medium sm:text-sm/5"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        {(team ? [team, ...otherTeams] : otherTeams).map((item) => (
          <TeamMark key={item.id} team={item} className="size-5 shrink-0" />
        ))}
      </div>
      <div className="min-w-0">
        {teamName} with {otherTeams.map((item) => item.name).join(", ")}
      </div>
    </div>
  )
  const impact = (
    <p
      data-slot="trade-idea-impact"
      className="text-sm text-pretty text-muted-foreground"
    >
      {change === 0
        ? payrollAfter === undefined
          ? `${location}’s payroll stays the same.`
          : `${location}’s payroll stays at ${formatMoney(payrollAfter)}.`
        : `${location}’s payroll ${change > 0 ? "rises" : "falls"} by ${formatMoney(Math.abs(change))}${payrollAfter === undefined ? "" : ` to ${formatMoney(payrollAfter)}`}.`}
    </p>
  )
  const assets = (items: AssetTransfer[]) => (
    <div className="flex min-w-0 flex-col gap-3 p-3">
      {items.length ? (
        items.map((asset) => (
          <IdeaAsset
            key={`${asset.assetType}-${asset.assetId}`}
            asset={asset}
            proposal={proposal}
            catalogue={catalogue}
            onInspectPlayer={onInspectPlayer}
          />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No assets</p>
      )}
    </div>
  )
  return (
    <div className="pointer-events-none relative flex min-w-0 flex-col gap-3 pt-6 pr-4 pb-4 pl-12">
      {title}
      <div className="grid grid-cols-2 gap-1">
        <section className="flex min-w-0 flex-col rounded-l-lg bg-foreground/3">
          <h3 className="border-b border-foreground/10 px-3 py-2 text-sm font-normal text-muted-foreground">
            {teamName} send
          </h3>
          {assets(outgoing)}
        </section>
        <section className="flex min-w-0 flex-col rounded-r-lg bg-foreground/3">
          <h3 className="border-b border-foreground/10 px-3 py-2 text-sm font-normal text-muted-foreground">
            {teamName} receive
          </h3>
          {assets(incoming)}
        </section>
      </div>
      {impact}
    </div>
  )
}
