import { messagePickReferences } from "@/lib/message-pick-references"
import type { MessagePickReference } from "@/lib/message-pick-references"
import { Fragment, useMemo } from "react"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TeamMark } from "./team-mark"
import { messagePlayerReferences } from "@/lib/message-player-references"
import type { MessagePlayerReference } from "@/lib/message-player-references"
import type { Catalogue, DraftPick, Player } from "@/lib/trade/types"

// These catalogue logos fill a circular silhouette; the other marks need an inset.
const circularTeamLogos = new Set([
  "ATL",
  "BOS",
  "DEN",
  "DET",
  "GSW",
  "MIN",
  "PHI",
  "TOR",
  "WAS",
])

export function MessageText({
  text,
  references,
  pickReferences,
  onInspectPick,
  catalogue,
  onInspect,
  badgeVariant = "player",
}: {
  text: string
  pickReferences?: Array<MessagePickReference>
  onInspectPick?: (pick: DraftPick) => void
  references?: Array<MessagePlayerReference>
  catalogue: Catalogue
  onInspect: (player: Player) => void
  badgeVariant?: "player" | "outline"
}) {
  const resolved = useMemo(
    () =>
      [
        ...messagePlayerReferences(text, catalogue.players, references),
        ...messagePickReferences(
          text,
          catalogue.draftPicks ?? [],
          pickReferences
        ),
      ].sort((a, b) => a.start - b.start),
    [text, catalogue, references, pickReferences]
  )
  const parts = []
  let offset = 0
  for (const reference of resolved) {
    if (reference.start < offset) continue
    if ("pickId" in reference) {
      const pick = catalogue.draftPicks?.find(
        (item) => item.id === reference.pickId
      )
      parts.push(
        <Fragment key={`pick:${reference.start}:${reference.pickId}`}>
          {text.slice(offset, reference.start)}
          <span className="pick-token-host">
            <Badge
              variant={badgeVariant}
              className={cn(
                "h-auto min-h-6 max-w-full rounded-md px-1.5 [overflow-wrap:anywhere] whitespace-normal",
                badgeVariant === "outline" && "bg-background"
              )}
              render={
                pick && onInspectPick ? (
                  <Button variant="ghost" size="xs" />
                ) : undefined
              }
              aria-label={`View ${text.slice(reference.start, reference.end)} details`}
              onClick={
                pick && onInspectPick ? () => onInspectPick(pick) : undefined
              }
            >
              {text.slice(reference.start, reference.end)}
            </Badge>
          </span>
        </Fragment>
      )
      offset = reference.end
      continue
    }
    const player = catalogue.players.find(
      (item) => item.id === reference.playerId
    )!
    const team = catalogue.teams.find((item) => item.id === player.teamId)
    parts.push(
      <Fragment key={`${reference.start}:${reference.playerId}`}>
        {text.slice(offset, reference.start)}
        <span className="player-badge-host">
          <Badge
            variant={badgeVariant}
            className={cn(
              "h-6 rounded-md px-1.5",
              badgeVariant === "outline" && "bg-background"
            )}
            render={<Button variant="ghost" size="xs" />}
            aria-label={`View ${player.name} details`}
            data-player-id={player.id}
            data-logo-shape={
              team && circularTeamLogos.has(team.abbreviation)
                ? "circle"
                : "freeform"
            }
            onClick={() => onInspect(player)}
          >
            {team && <TeamMark team={team} size="compact" />}
            <span>{text.slice(reference.start, reference.end)}</span>
          </Badge>
        </span>
      </Fragment>
    )
    offset = reference.end
  }
  return (
    <>
      {parts}
      {text.slice(offset)}
    </>
  )
}
