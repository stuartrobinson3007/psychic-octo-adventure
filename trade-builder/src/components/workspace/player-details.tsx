import { useEffect, useRef, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { ResearchAction } from "./research-action"
import {
  Cancel01Icon,
  ArrowLeftRightIcon,
  HashtagIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "./icons"
import { PlayerAvatar } from "./player-avatar"
import { money } from "@/lib/player-research"
import { contractTypeLabel } from "@/lib/trade/contract-type-label"
import { birdRightsLabel } from "@/lib/trade/bird-rights-label"
import type { Catalogue, Player } from "@/lib/trade/types"

export function PlayerDetails({
  player,
  catalogue,
  onInsert,
  onCompare,
  comparing,
  comparisonFull,
}: {
  player: Player
  catalogue: Catalogue
  onInsert: (player: Player) => void
  onCompare: (player: Player) => void
  comparing: boolean
  comparisonFull: boolean
}) {
  const team =
    player.signingStatus === "free-agent"
      ? undefined
      : catalogue.teams.find((item) => item.id === player.teamId)
  return (
    <ScrollArea
      className="player-detail h-full min-w-0 flex-1"
      aria-label={`${player.name} details`}
    >
      <div className="detail-content flex flex-col gap-5 px-[26px] pt-6 pb-8">
        <div className="player-identity flex items-center gap-3 [&_h2]:text-[22px] [&_h2]:font-medium [&_h2]:tracking-[-0.025em] [&_p]:pt-1 [&_p]:text-[13px] [&_p]:leading-label [&_p]:text-muted-foreground">
          <PlayerAvatar player={player} team={team} size="xl" />
          <div>
            <h2>{player.name}</h2>
            <p>{team?.name ?? "Free agent"}</p>
          </div>
        </div>
        <div className="player-bio flex flex-wrap gap-4 text-[13px] leading-label text-muted-foreground">
          <span>{player.position ?? "Position unavailable"}</span>
          <span>
            {player.age ? `${player.age} years old` : "Age unavailable"}
          </span>
          {player.yearsExperience !== undefined && (
            <span>{player.yearsExperience} seasons</span>
          )}
        </div>
        <div className="detail-actions flex flex-wrap gap-2 pt-0.5 pb-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onInsert(player)}
          >
            <Icon icon={HashtagIcon} data-icon="inline-start" />
            Add to message
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCompare(player)}
            aria-pressed={comparing}
            disabled={comparisonFull && !comparing}
            title={
              comparisonFull && !comparing
                ? "Comparison is full (4 players)"
                : undefined
            }
          >
            <Icon icon={ArrowLeftRightIcon} data-icon="inline-start" />
            {comparing ? "View comparison" : "Compare"}
          </Button>
        </div>
        <Separator />
        <section className="detail-section pt-3">
          <div className="section-heading flex flex-wrap items-center justify-between gap-2 pb-2.5 text-xs leading-control [&_h3]:text-sm [&_h3]:font-medium [&>.muted]:leading-label">
            <h3>Contract</h3>
            <div className="muted text-muted-foreground">
              {player.signingStatus === "free-agent"
                ? "Unsigned"
                : player.yearsRemaining === undefined
                  ? ""
                  : `${player.yearsRemaining} years remaining`}
            </div>
          </div>
          <dl className="data-list flex flex-col [&_dd]:text-right [&_dd]:tabular-nums [&_dt]:text-muted-foreground [&>div]:flex [&>div]:justify-between [&>div]:gap-[18px] [&>div]:border-b [&>div]:border-border [&>div]:py-2.5 [&>div]:text-[13px] [&>div]:leading-data [&>div:last-child]:border-b-0">
            <div>
              <dt>Current salary</dt>
              <dd>
                {player.signingStatus === "free-agent"
                  ? "Unsigned"
                  : money(player.salary, true)}
              </dd>
            </div>
            {player.contract?.map((year) => (
              <div key={year.season}>
                <dt>
                  {year.season}
                  {year.isEstimate ? " · estimate" : ""}
                </dt>
                <dd>{money(year.amount, true)}</dd>
              </div>
            ))}
            {player.playerOption && (
              <div>
                <dt>Player option</dt>
                <dd>Yes</dd>
              </div>
            )}
            {player.teamOption && (
              <div>
                <dt>Team option</dt>
                <dd>Yes</dd>
              </div>
            )}
            {player.noTradeClause && (
              <div>
                <dt>No-trade clause</dt>
                <dd>Yes</dd>
              </div>
            )}
            {player.signingStatus !== "free-agent" && player.contractType && (
              <div>
                <dt>Contract type</dt>
                <dd>{contractTypeLabel(player.contractType)}</dd>
              </div>
            )}
            {player.signingStatus !== "free-agent" && player.birdRightsType && (
              <div>
                <dt>Bird rights</dt>
                <dd>{birdRightsLabel(player.birdRightsType)}</dd>
              </div>
            )}
          </dl>
        </section>
        {team && (
          <>
            <Separator />
            <section className="detail-section pt-3">
              <div className="section-heading flex flex-wrap items-center justify-between gap-2 pb-2.5 text-xs leading-control [&_h3]:text-sm [&_h3]:font-medium [&>.muted]:leading-label">
                <h3>{team.abbreviation} context</h3>
              </div>
              <dl className="data-list flex flex-col [&_dd]:text-right [&_dd]:tabular-nums [&_dt]:text-muted-foreground [&>div]:flex [&>div]:justify-between [&>div]:gap-[18px] [&>div]:border-b [&>div]:border-border [&>div]:py-2.5 [&>div]:text-[13px] [&>div]:leading-data [&>div:last-child]:border-b-0">
                {team.totalSalary !== undefined && (
                  <div>
                    <dt>Team payroll</dt>
                    <dd>{money(team.totalSalary)}</dd>
                  </div>
                )}
                <div>
                  <dt>Cap position</dt>
                  <dd>
                    {team.isOverSecondApron
                      ? "Above second apron"
                      : team.isOverFirstApron
                        ? "Above first apron"
                        : team.isOverCap
                          ? "Over salary cap"
                          : "Under salary cap"}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
      </div>
    </ScrollArea>
  )
}

export function PlayerComparison({
  players,
  catalogue,
  listOpen,
  onRemove,
  onInsert,
  onInspect,
  onBrowse,
}: {
  players: Array<Player>
  catalogue: Catalogue
  listOpen: boolean
  onRemove: (id: number) => void
  onInsert: (player: Player) => void
  onInspect: (player: Player) => void
  onBrowse: () => void
}) {
  const [actionPlayerId, setActionPlayerId] = useState<number | null>(null)
  const comparisonRef = useRef<HTMLDivElement>(null)
  const previousPlayerIds = useRef<Array<number>>([])
  const playerIds = players.map((player) => player.id).join(",")
  useEffect(() => {
    const ids = playerIds ? playerIds.split(",").map(Number) : []
    const addedId = [...ids]
      .reverse()
      .find((id) => !previousPlayerIds.current.includes(id))
    previousPlayerIds.current = ids
    if (addedId === undefined) return

    const scroller = comparisonRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!scroller) return
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
    const animations: Array<Animation> = []
    let highlighted = false
    let fallback: ReturnType<typeof setTimeout> | undefined
    const highlight = () => {
      if (highlighted || reducedMotion) return
      highlighted = true
      scroller
        .querySelectorAll<HTMLElement>(`[data-player-id="${addedId}"]`)
        .forEach((cell) => {
          animations.push(
            cell.animate(
              [
                { backgroundColor: "var(--muted)", offset: 0 },
                { backgroundColor: "var(--muted)", offset: 0.25 },
                { backgroundColor: getComputedStyle(cell).backgroundColor },
              ],
              { duration: 1200, easing: "ease-out" }
            )
          )
        })
    }
    const frame = requestAnimationFrame(() => {
      const targetLeft =
        ids.length === 1
          ? 0
          : Math.max(0, scroller.scrollWidth - scroller.clientWidth)
      const needsScroll = Math.abs(targetLeft - scroller.scrollLeft) > 1
      if (needsScroll && !reducedMotion) {
        scroller.addEventListener("scrollend", highlight, { once: true })
        fallback = setTimeout(highlight, 700)
      }
      scroller.scrollTo({
        left: targetLeft,
        behavior: reducedMotion ? "instant" : "smooth",
      })
      if (!needsScroll) highlight()
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(fallback)
      scroller.removeEventListener("scrollend", highlight)
      animations.forEach((animation) => animation.cancel())
    }
  }, [playerIds])
  const hoveredPlayerId = useRef<number | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepActionsOpen = () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const openActions = (id: number) => {
    keepActionsOpen()
    hoveredPlayerId.current = id
    setActionPlayerId(id)
  }
  const closeActions = () => {
    keepActionsOpen()
    hoveredPlayerId.current = null
    closeTimer.current = setTimeout(() => setActionPlayerId(null), 200)
  }
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    },
    []
  )
  const data: Array<{ label: string; values: Array<string | number> }> = [
    {
      label: "Team",
      values: players.map((player) =>
        player.signingStatus === "free-agent"
          ? "FA"
          : (catalogue.teams.find((team) => team.id === player.teamId)
              ?.abbreviation ?? "FA")
      ),
    },
    {
      label: "Position",
      values: players.map((player) => player.position ?? "—"),
    },
    {
      label: "Age",
      values: players.map((player) =>
        player.age && player.age > 0 ? player.age : "—"
      ),
    },
    { label: "Salary", values: players.map((player) => money(player.salary)) },
    {
      label: "Years remaining",
      values: players.map((player) => player.yearsRemaining ?? "—"),
    },
  ]
  if (!players.length) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>No players in comparison</EmptyTitle>
          <EmptyDescription>
            Add up to four players from the player list.
          </EmptyDescription>
        </EmptyHeader>
        {!listOpen && (
          <EmptyContent>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onBrowse}
            >
              Browse players
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }
  return (
    <div
      className="player-comparison h-full min-w-0 flex-1"
      aria-label="Player comparison"
    >
      <ScrollArea
        scrollbarOrientation="both"
        viewportClassName="overscroll-contain"
        className="comparison-scroll h-full [&_[data-column-active=true]]:bg-comparison-highlight [&_[data-slot=table-container]]:overflow-visible [&_[data-slot=table-head]:not([data-column-active=true])]:bg-background [&_tbody_[data-slot=table-row]:hover>*]:bg-comparison-highlight [&_tbody_[data-slot=table-row]:hover>[data-column-active=true]]:bg-muted"
        ref={comparisonRef}
      >
        <div className="px-4 pb-4">
          <Table>
            <TableHeader className="[&_.comparison-metric]:z-3 [&_th]:sticky [&_th]:top-0 [&_th]:z-1">
              <TableRow>
                <TableHead
                  scope="col"
                  className="comparison-metric sticky left-0 z-2 min-w-[148px]"
                >
                  <span className="sr-only">Statistic</span>
                </TableHead>
                {players.map((player) => (
                  <TableHead
                    key={player.id}
                    scope="col"
                    className="comparison-column min-w-[190px]"
                    data-player-id={player.id}
                    data-column-active={actionPlayerId === player.id}
                    onMouseEnter={() => openActions(player.id)}
                    onMouseLeave={closeActions}
                  >
                    <div className="comparison-player relative flex flex-col items-start gap-3 pt-4 pb-3 text-foreground">
                      <Popover
                        open={actionPlayerId === player.id}
                        triggerId={`comparison-player-avatar-${player.id}`}
                        onOpenChange={(open, details) => {
                          if (
                            !open &&
                            hoveredPlayerId.current === player.id &&
                            (details.reason === "outside-press" ||
                              details.reason === "focus-out")
                          )
                            return
                          setActionPlayerId((id) =>
                            open ? player.id : id === player.id ? null : id
                          )
                        }}
                      >
                        <PopoverTrigger
                          id={`comparison-player-avatar-${player.id}`}
                          render={
                            <Button
                              type="button"
                              variant="text-link"
                              className="h-auto p-0"
                              aria-label={`${player.name} actions`}
                            />
                          }
                        >
                          <PlayerAvatar
                            player={player}
                            team={catalogue.teams.find(
                              (team) => team.id === player.teamId
                            )}
                            size="lg"
                          />
                        </PopoverTrigger>
                        <PopoverTrigger
                          id={`comparison-player-actions-${player.id}`}
                          onClick={(event) => {
                            event.preventBaseUIHandler()
                            keepActionsOpen()
                            setActionPlayerId(null)
                            onInspect(player)
                          }}
                          render={
                            <Button
                              type="button"
                              variant="text-link"
                              size="sm"
                              className="comparison-name max-w-full min-w-0 justify-start px-0"
                            />
                          }
                        >
                          <span className="truncate">{player.name}</span>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          sideOffset={8}
                          className="w-fit flex-row gap-1 p-1"
                          initialFocus={false}
                          onMouseEnter={() => openActions(player.id)}
                          onMouseLeave={closeActions}
                          onFocus={keepActionsOpen}
                        >
                          <PopoverTitle className="sr-only">
                            {player.name} actions
                          </PopoverTitle>
                          <ResearchAction
                            label={`Add ${player.name} to message`}
                            icon={HashtagIcon}
                            onClick={() => {
                              keepActionsOpen()
                              setActionPlayerId(null)
                              onInsert(player)
                            }}
                          />
                          <ResearchAction
                            label={`Remove ${player.name} from comparison`}
                            icon={Cancel01Icon}
                            onClick={() => {
                              keepActionsOpen()
                              setActionPlayerId(null)
                              onRemove(player.id)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>
                ))}
                {players.length === 1 && (
                  <TableHead
                    scope="col"
                    className="comparison-column min-w-[190px]"
                  />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow
                  key={row.label}
                  className={cn(index === 5 && "border-t-2")}
                >
                  <TableHead
                    scope="row"
                    className="comparison-metric sticky left-0 z-2 min-w-[148px]"
                  >
                    {row.label}
                  </TableHead>
                  {row.values.map((value, i) => (
                    <TableCell
                      key={players[i].id}
                      className="tabular-nums"
                      data-player-id={players[i].id}
                      data-column-active={actionPlayerId === players[i].id}
                      onMouseEnter={() => openActions(players[i].id)}
                      onMouseLeave={closeActions}
                    >
                      {value}
                    </TableCell>
                  ))}
                  {players.length === 1 && <TableCell>—</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  )
}
