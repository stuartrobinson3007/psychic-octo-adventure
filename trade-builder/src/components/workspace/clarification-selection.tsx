import { Tick02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import type { Catalogue, ClarificationOption, Player } from "@/lib/trade/types"
import { clarificationOptionPlayers } from "@/lib/trade-clarification"
import { PlayerAvatar } from "./player-avatar"
import { TeamMark } from "./team-mark"
import { Icon } from "./icons"

function SelectedPlayer({
  player,
  catalogue,
  onInspect,
}: {
  player: Player
  catalogue: Catalogue
  onInspect: (player: Player) => void
}) {
  const team =
    player.signingStatus === "free-agent"
      ? undefined
      : catalogue.teams.find((item) => item.id === player.teamId)
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-3">
      <PlayerAvatar player={player} team={team} showTeamBadge />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-base sm:text-sm">
        <Button
          type="button"
          variant="text-link"
          className="h-auto justify-start p-0 text-left text-[length:inherit] leading-[inherit] font-medium [overflow-wrap:anywhere] whitespace-normal"
          aria-label={`View ${player.name} details`}
          onClick={() => onInspect(player)}
        >
          {player.name}
        </Button>
        <div className="[overflow-wrap:anywhere] text-muted-foreground">
          {team ? `${team.city ?? ""} ${team.name}`.trim() : "Free agent"}
        </div>
      </div>
    </div>
  )
}

/** A choice is a transcript receipt; additional user text belongs in its own bubble. */
function SelectedChoice({
  option,
  catalogue,
  onInspectPlayer,
}: {
  option: ClarificationOption
  catalogue: Catalogue
  onInspectPlayer: (player: Player) => void
}) {
  const players = clarificationOptionPlayers(option, catalogue)
  if (option.tradeIdea)
    return (
      <div className="flex min-w-0 items-center gap-3 p-3">
        {players.length > 0 && (
          <div
            className="flex shrink-0 -space-x-3"
            aria-label="Players in this selection"
          >
            {players.slice(0, 3).map((selected) => (
              <Button
                key={selected.id}
                type="button"
                variant="ghost"
                className="relative size-12 rounded-full p-0 ring-2 ring-background hover:z-10 focus-visible:z-10"
                aria-label={`View ${selected.name} details`}
                title={selected.name}
                onClick={() => onInspectPlayer(selected)}
              >
                <PlayerAvatar player={selected} />
              </Button>
            ))}
            {players.length > 3 && (
              <div className="relative grid size-12 place-items-center rounded-full bg-muted text-sm text-muted-foreground tabular-nums ring-2 ring-background">
                +{players.length - 3}
              </div>
            )}
          </div>
        )}
        <div className="min-w-0 text-base [overflow-wrap:anywhere] sm:text-sm">
          {option.label}
        </div>
      </div>
    )
  const names = players.map((item) => item.name)
  const detail =
    players.length > 0 &&
    (option.detail === names.join(" and ") ||
      option.detail === names.join(", "))
      ? undefined
      : option.detail
  const player =
    players.length === 1 &&
    (option.playerId === players[0].id || option.label === players[0].name)
      ? players[0]
      : undefined
  const team = !players.length
    ? catalogue.teams.find(
        (item) =>
          option.id === `team-${item.id}` ||
          option.label === `${item.city ?? ""} ${item.name}`.trim()
      )
    : undefined
  return (
    <div className="min-w-0 text-left">
      {player ? (
        <SelectedPlayer
          player={player}
          catalogue={catalogue}
          onInspect={onInspectPlayer}
        />
      ) : (
        <>
          <div className="flex min-w-0 items-start gap-3 px-3 py-3">
            {team ? (
              <TeamMark team={team} className="size-6 shrink-0" />
            ) : (
              <div
                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Icon icon={Tick02Icon} className="size-4" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-base sm:text-sm">
              <div className="font-medium [overflow-wrap:anywhere] whitespace-pre-wrap">
                {option.label}
              </div>
              {detail && (
                <div className="[overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
                  {detail}
                </div>
              )}
            </div>
          </div>
          {players.length > 0 && (
            <ul
              role="list"
              aria-label="Players in this selection"
              className="divide-y divide-foreground/10 border-t border-foreground/10"
            >
              {players.map((selected) => (
                <li key={selected.id}>
                  <SelectedPlayer
                    player={selected}
                    catalogue={catalogue}
                    onInspect={onInspectPlayer}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/** Keep every selected canonical choice in one transcript receipt. */
export function ClarificationSelection({
  option,
  options,
  catalogue,
  onInspectPlayer,
}: {
  option?: ClarificationOption
  options?: Array<ClarificationOption>
  catalogue: Catalogue
  onInspectPlayer: (player: Player) => void
}) {
  const choices = options ?? (option ? [option] : [])
  if (!choices.length) return null
  return (
    <section
      data-slot="clarification-selection"
      aria-label="You selected"
      className="flex w-fit max-w-full min-w-0 flex-col gap-1.5 self-end sm:max-w-sm"
    >
      <p className="text-left text-base text-muted-foreground sm:text-sm">
        You selected
      </p>
      <div className="min-w-0 divide-y divide-foreground/10 overflow-hidden rounded-lg border border-foreground/10 bg-muted/40 text-left">
        {choices.map((choice) => (
          <SelectedChoice
            key={choice.id}
            option={choice}
            catalogue={catalogue}
            onInspectPlayer={onInspectPlayer}
          />
        ))}
      </div>
    </section>
  )
}
