import { SearchInput } from "./search-input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Empty,
  EmptyHeader,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ResizableResearch } from "./resizable-research"
import { ResearchAction } from "./research-action"
import { ResearchFilterSelect as FilterSelect } from "./research-filter-select"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeftRightIcon,
  Tick02Icon,
  Cancel01Icon,
  FilterHorizontalIcon,
  HashtagIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "./icons"
import { TeamFilter } from "./team-filter"
import { PlayerAvatar } from "./player-avatar"
import { PlayerComparison, PlayerDetails } from "./player-details"
import { money, searchPlayers } from "@/lib/player-research"
import type { Catalogue, Player } from "@/lib/trade/types"

export function PlayerBrowser({
  catalogue,
  onInsert,
  listOpen,
  inspectorOpen,
  onListOpenChange,
  onInspectorOpenChange,
  onCloseInspector,
  inspection,
  initialState,
}: {
  catalogue: Catalogue
  onInsert: (player: Player) => void
  listOpen: boolean
  inspectorOpen: boolean
  onListOpenChange: (open: boolean) => void
  onInspectorOpenChange: (open: boolean) => void
  onCloseInspector: () => void
  inspection?: { playerId: number; sequence: number } | null
  initialState?: {
    query?: string
    teamId?: string
    position?: string
    salary?: string
    sort?: string
    filters?: boolean
    compareIds?: number[]
    comparisonOpen?: boolean
  }
}) {
  const [query, setQuery] = useState(initialState?.query ?? "")
  const [teamId, setTeamId] = useState(initialState?.teamId ?? "")
  const [position, setPosition] = useState(initialState?.position ?? "")
  const [salary, setSalary] = useState(initialState?.salary ?? "")
  const [sort, setSort] = useState(initialState?.sort ?? "salary")
  const [filters, setFilters] = useState(initialState?.filters ?? false)
  const [count, setCount] = useState(40)
  const [selectedId, setSelectedId] = useState<number | null>(
    initialState?.compareIds?.[0] ?? null
  )
  const [compareIds, setCompareIds] = useState<Array<number>>(
    initialState?.compareIds ?? []
  )
  const [comparisonOpen, setComparisonOpen] = useState(
    initialState?.comparisonOpen ?? false
  )
  useEffect(() => {
    if (!inspection) return
    setSelectedId(inspection.playerId)
    setComparisonOpen(false)
    onInspectorOpenChange(true)
  }, [inspection, onInspectorOpenChange])
  const players = useMemo(
    () =>
      searchPlayers(
        catalogue.players.filter(
          (player) =>
            player.teamId > 0 &&
            (!teamId ||
              (player.signingStatus !== "free-agent" &&
                player.teamId === Number(teamId))) &&
            (!position || player.position?.includes(position)) &&
            (!salary || player.salary <= Number(salary))
        ),
        query
      ).sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "age"
            ? (a.age && a.age > 0 ? a.age : 999) -
              (b.age && b.age > 0 ? b.age : 999)
            : b.salary - a.salary
      ),
    [catalogue, query, teamId, position, salary, sort]
  )
  const selected = catalogue.players.find((player) => player.id === selectedId)
  const compared = compareIds
    .map((id) => catalogue.players.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
  const inspect = (player: Player) => {
    setSelectedId(player.id)
    setComparisonOpen(false)
    onInspectorOpenChange(true)
  }
  const showComparison = () => {
    setComparisonOpen(true)
    onListOpenChange(true)
    onInspectorOpenChange(
      listOpen || !matchMedia("(max-width: 1199px)").matches
    )
  }
  const compare = (player: Player) => {
    if (!compareIds.includes(player.id) && compareIds.length >= 4) return
    setCompareIds((ids) =>
      ids.includes(player.id) || ids.length >= 4 ? ids : [...ids, player.id]
    )
    if (!selectedId) setSelectedId(player.id)
    showComparison()
  }
  const browse = () => {
    onListOpenChange(true)
    if (matchMedia("(max-width: 1199px)").matches) onInspectorOpenChange(false)
  }
  return (
    <div
      className="browser-layout h-full min-w-0"
      data-detail={inspectorOpen}
      data-list={listOpen}
    >
      <section
        className="research-pane player-list t-panel-slide absolute inset-y-0 right-0 flex h-full min-w-0 flex-col border-l border-border bg-background max-md:border-l-0"
        aria-label="Player browser"
        data-open={listOpen}
        inert={!listOpen}
        aria-hidden={!listOpen}
      >
        <ResizableResearch pane="players" open={listOpen}>
          <div className="research-pane-header flex h-14 min-h-14 items-center justify-between gap-2 border-b border-border pr-3.5 pl-5 [&_h2]:text-sm [&_h2]:font-medium">
            <h2>Players</h2>
            <ResearchAction
              label="Close player list"
              icon={Cancel01Icon}
              onClick={() => onListOpenChange(false)}
            />
          </div>
          <div className="browser-controls flex flex-col gap-3.5 px-5 pt-4">
            <FieldGroup>
              <Field>
                <FieldLabel className="sr-only" htmlFor="player-browser-search">
                  Search players
                </FieldLabel>
                <SearchInput
                  id="player-browser-search"
                  name="player-browser-search"
                  aria-label="Search players"
                  clearLabel="Clear player search"
                  value={query}
                  onValueChange={(next) => {
                    setQuery(next)
                    setCount(40)
                  }}
                  placeholder="Search players…"
                />
              </Field>
            </FieldGroup>
            <Collapsible open={filters} onOpenChange={setFilters}>
              <div className="filter-line flex items-center gap-1.5">
                <TeamFilter
                  teams={catalogue.teams}
                  value={teamId}
                  onChange={(value) => {
                    setTeamId(value)
                    setCount(40)
                  }}
                />
                <CollapsibleTrigger
                  render={<Button variant="ghost" size="icon-sm" />}
                  aria-label="More player filters"
                >
                  <Icon icon={FilterHorizontalIcon} data-icon="inline-start" />
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="filter-panel">
                <FieldGroup className="flex-row gap-2 pt-3">
                  <FilterSelect
                    label="Filter by position"
                    name="position-filter"
                    value={position}
                    onChange={setPosition}
                    items={[
                      { value: "", label: "All positions" },
                      { value: "G", label: "Guards" },
                      { value: "F", label: "Forwards" },
                      { value: "C", label: "Centres" },
                    ]}
                  />
                  <FilterSelect
                    label="Maximum salary"
                    name="salary-filter"
                    value={salary}
                    onChange={setSalary}
                    items={[
                      { value: "", label: "Any salary" },
                      { value: "10000000", label: "Under $10M" },
                      { value: "20000000", label: "Under $20M" },
                      { value: "30000000", label: "Under $30M" },
                    ]}
                  />
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
            <div className="list-heading flex flex-wrap items-center justify-between gap-2 pb-1 text-xs leading-label">
              <div className="muted text-muted-foreground tabular-nums">
                {players.length} {players.length === 1 ? "player" : "players"}
              </div>
              <FilterSelect
                className="w-48 max-w-full flex-none"
                label="Sort players"
                name="player-sort"
                value={sort}
                onChange={setSort}
                items={[
                  {
                    value: "salary",
                    label: "Salary",
                    description: "High to low",
                  },
                  { value: "name", label: "Name", description: "A–Z" },
                  { value: "age", label: "Age", description: "Low to high" },
                ]}
              />
            </div>
          </div>
          <ScrollArea className="player-list-scroll min-h-0 flex-1">
            <ul role="list" className="roster-list m-0 list-none px-2.5 py-0">
              {players.slice(0, count).map((player) => {
                const team = catalogue.teams.find(
                  (item) => item.id === player.teamId
                )
                return (
                  <li
                    key={player.id}
                    className="player-row group/player-row relative rounded-[8px] focus-within:bg-foreground/5 hover:bg-foreground/5 max-md:flex max-md:items-center"
                    data-selected={player.id === selectedId}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="player-row-main h-auto w-full min-w-0 justify-start gap-[11px] bg-transparent px-2.5 py-[13px] text-left max-md:w-auto max-md:flex-1"
                      onClick={() => inspect(player)}
                      aria-label={`View ${player.name}`}
                    >
                      <PlayerAvatar player={player} />
                      <div className="player-row-name min-w-0 flex-1 text-sm leading-data font-medium max-md:text-base">
                        <div className="truncate">{player.name}</div>
                        <div className="row-meta pt-[3px] text-xs leading-label font-normal text-muted-foreground">
                          {player.signingStatus === "free-agent"
                            ? "FA"
                            : team?.abbreviation}{" "}
                          · {player.position ?? "—"}
                          {player.age && player.age > 0
                            ? ` · ${player.age}`
                            : ""}
                        </div>
                      </div>
                      <div className="player-row-contract shrink-0 text-right text-[13px] leading-data tabular-nums max-md:text-sm md:group-focus-within/player-row:invisible md:group-hover/player-row:invisible md:pointer-coarse:invisible md:[@media(hover:none)]:invisible">
                        <div>{money(player.salary)}</div>
                        <div className="row-meta pt-[3px] text-xs leading-label font-normal text-muted-foreground">
                          {player.signingStatus === "free-agent"
                            ? "Unsigned"
                            : player.yearsRemaining === undefined
                              ? "—"
                              : `${player.yearsRemaining} yr`}
                        </div>
                      </div>
                    </Button>
                    <div className="player-row-actions pointer-events-none absolute top-1/2 right-1.5 flex -translate-y-1/2 rounded-[8px] p-1 opacity-0 group-focus-within/player-row:pointer-events-auto group-focus-within/player-row:opacity-100 group-hover/player-row:pointer-events-auto group-hover/player-row:opacity-100 max-md:pointer-events-auto max-md:static max-md:shrink-0 max-md:translate-none max-md:bg-transparent max-md:p-0 max-md:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
                      <ResearchAction
                        label={
                          compareIds.includes(player.id)
                            ? `${player.name} is in comparison`
                            : compareIds.length >= 4
                              ? "Comparison is full (4 players)"
                              : `Compare ${player.name}`
                        }
                        icon={
                          compareIds.includes(player.id)
                            ? Tick02Icon
                            : ArrowLeftRightIcon
                        }
                        aria-pressed={compareIds.includes(player.id)}
                        disabled={
                          !compareIds.includes(player.id) &&
                          compareIds.length >= 4
                        }
                        onClick={() => compare(player)}
                      />
                      <ResearchAction
                        label={`Add ${player.name} to message`}
                        icon={HashtagIcon}
                        onClick={() => onInsert(player)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {!players.length && (
              <Empty>
                <EmptyHeader>
                  <EmptyDescription>
                    No players match these filters.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery("")
                      setTeamId("")
                      setPosition("")
                      setSalary("")
                    }}
                  >
                    Reset filters
                  </Button>
                </EmptyContent>
              </Empty>
            )}
            {count < players.length && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setCount((value) => value + 40)}
              >
                Show more players
              </Button>
            )}
          </ScrollArea>
        </ResizableResearch>
      </section>
      <Tabs
        className="research-pane player-inspector t-panel-slide absolute inset-y-0 right-0 z-1 h-full min-w-0 gap-0 border-l border-border bg-background max-md:border-l-0"
        value={comparisonOpen ? "compare" : "details"}
        onValueChange={(value) => {
          if (value === "compare") showComparison()
          else setComparisonOpen(false)
        }}
        data-open={inspectorOpen}
        inert={!inspectorOpen}
        aria-hidden={!inspectorOpen}
      >
        <ResizableResearch pane="inspector" open={inspectorOpen}>
          <div className="research-pane-header inspector-header flex h-14 min-h-14 items-center justify-between gap-2 border-b border-border pr-3.5 pl-4 pl-5 [&_[data-slot=tabs-list]]:h-full [&_[data-slot=tabs-list]]:p-0 [&_[data-slot=tabs-trigger]]:h-full [&_[data-slot=tabs-trigger]]:rounded-none [&_[data-slot=tabs-trigger]]:border-0 [&_[data-slot=tabs-trigger]]:after:-bottom-px [&_h2]:text-sm [&_h2]:font-medium">
            <TabsList variant="line" aria-label="Player inspection">
              <TabsTrigger value="details" disabled={!selected}>
                Details
              </TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
            </TabsList>
            <ResearchAction
              label={
                comparisonOpen
                  ? "Close player comparison"
                  : "Close player details"
              }
              icon={Cancel01Icon}
              onClick={onCloseInspector}
            />
          </div>
          <TabsContent value="details" className="min-h-0" keepMounted>
            {selected && (
              <PlayerDetails
                player={selected}
                catalogue={catalogue}
                onInsert={onInsert}
                onCompare={compare}
                comparing={compareIds.includes(selected.id)}
                comparisonFull={compareIds.length >= 4}
              />
            )}
          </TabsContent>
          <TabsContent value="compare" className="min-h-0" keepMounted>
            <PlayerComparison
              players={compared}
              catalogue={catalogue}
              listOpen={listOpen}
              onRemove={(id) =>
                setCompareIds((ids) => ids.filter((item) => item !== id))
              }
              onInsert={onInsert}
              onInspect={inspect}
              onBrowse={browse}
            />
          </TabsContent>
        </ResizableResearch>
      </Tabs>
    </div>
  )
}
