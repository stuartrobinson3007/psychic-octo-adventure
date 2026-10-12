import { pickDetails, pickLabel } from "@/lib/trade/picks"
import type { DraftPick, Team } from "@/lib/trade/types"

/** A pick has an origin and protections, but no player salary. */
export function PickAsset({
  pick,
  teams,
  fromTeamId,
}: {
  pick: DraftPick
  teams: Array<Team>
  fromTeamId?: number
}) {
  const sender = teams.find(
    (team) => team.id === (fromTeamId ?? pick.currentTeamId)
  )
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        aria-hidden="true"
        className="pick-avatar relative inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary align-middle text-xs font-medium text-secondary-foreground tabular-nums"
      >
        {pick.round === 1 ? "1st" : "2nd"}
      </span>
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div>{pickLabel(pick, { teams })}</div>
        <div className="text-xs text-muted-foreground">
          {pickDetails(pick)}
          {sender && ` · From ${sender.abbreviation}`}
        </div>
      </div>
    </div>
  )
}
