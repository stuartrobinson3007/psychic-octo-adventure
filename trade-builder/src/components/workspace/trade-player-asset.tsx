import { Button } from "@/components/ui/button"
import { money } from "@/lib/player-research"
import { signingContractLabel } from "@/lib/trade/contract-type-label"
import type { Player, ScenarioSigning } from "@/lib/trade/types"
import { cn } from "@/lib/utils"
import { PlayerAvatar } from "./player-avatar"

/** Incoming traded players and direct signings share one visible asset row. */
export function TradePlayerAsset({
  player,
  signing,
  direct = false,
  from,
  hypothetical = false,
  onInspect,
}: {
  player?: Player
  signing?: ScenarioSigning
  direct?: boolean
  from?: string
  hypothetical?: boolean
  onInspect: (player: Player) => void
}) {
  const terms = signing
    ? `${signing.contractYears} ${signing.contractYears === 1 ? "year" : "years"} · ${signingContractLabel(signing)}`
    : undefined
  return (
    <li>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {player && <PlayerAvatar player={player} />}
        <span className="min-w-0">
          {player ? (
            <Button
              type="button"
              variant="text-link"
              className="h-auto justify-start p-0 text-left text-[length:inherit] leading-[inherit] font-normal whitespace-normal"
              aria-label={`View ${player.name} details`}
              onClick={() => onInspect(player)}
            >
              {player.name}
            </Button>
          ) : (
            "Unavailable player"
          )}
          {(direct || from) && (
            <span className="block text-xs text-muted-foreground">
              {direct
                ? "New signing"
                : `${signing ? "Sign-and-trade from" : "From"} ${from}`}
            </span>
          )}
          {terms && (
            <span className="block text-xs text-muted-foreground">{terms}</span>
          )}
          {signing && !direct && signing.firstYearGuaranteed === true && (
            <span className="block text-xs text-muted-foreground">
              First year guaranteed
            </span>
          )}
        </span>
      </div>
      <div
        className={cn(
          "shrink-0 text-right tabular-nums",
          hypothetical ? "text-warning-foreground" : "text-muted-foreground"
        )}
      >
        {money(player?.salary ?? signing?.salary ?? 0)}
        {signing ? (
          <span className="block text-xs leading-4">
            {signing.contractYears > 1 ? "First year" : "Contract"}
          </span>
        ) : hypothetical ? (
          <span className="block text-xs leading-4">Hypothetical</span>
        ) : null}
      </div>
    </li>
  )
}
