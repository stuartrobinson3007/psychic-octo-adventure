import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "./search-input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  FilterHorizontalIcon,
  HashtagIcon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { Icon } from "./icons"
import { ResearchAction } from "./research-action"
import { ResearchFilterSelect } from "./research-filter-select"
import { TeamFilter } from "./team-filter"
import { ResizableResearch } from "./resizable-research"
import { pickDetails, pickLabel } from "@/lib/trade/picks"
import { pickUnavailableReason, searchDraftPicks } from "@/lib/pick-research"
import type { Catalogue, DraftPick, TradeSnapshot } from "@/lib/trade/types"

const initialFilters = {
  query: "",
  owner: "",
  origin: "",
  year: "",
  round: "",
  availability: "",
  sort: "year",
}

function PickFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <Select
        name={`pick-${label.toLowerCase().replaceAll(" ", "-")}`}
        items={options}
        value={value}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger
          size="sm"
          className="w-full min-w-0"
          aria-label={`Filter picks by ${label.toLowerCase()}`}
        >
          <SelectValue className="min-w-0">
            <span className="truncate">
              {options.find((option) => option.value === value)?.label}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function PickIdentity({
  pick,
  catalogue,
}: {
  pick: DraftPick
  catalogue: Catalogue
}) {
  const owner = catalogue.teams.find((team) => team.id === pick.currentTeamId)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="pick-avatar inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground tabular-nums"
      >
        {pick.round === 1 ? "1st" : "2nd"}
      </span>
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="text-sm font-medium max-md:text-base">
          {pickLabel(pick, catalogue)}
        </div>
        <div className="text-xs text-muted-foreground">
          Owned by {owner?.abbreviation ?? pick.currentTeamId}
        </div>
        <div className="text-xs text-muted-foreground">{pickDetails(pick)}</div>
      </div>
    </div>
  )
}

export function PickBrowser({
  catalogue,
  open,
  onClose,
  onInsert,
  inMessage,
  currentTrade,
  refreshing,
  refreshError,
  onRefresh,
  inspection,
  initialState,
}: {
  catalogue: Catalogue
  open: boolean
  onClose: () => void
  onInsert: (pick: DraftPick) => void
  inMessage: Array<number>
  currentTrade: TradeSnapshot | null
  refreshing: boolean
  refreshError: boolean
  onRefresh: () => void
  inspection?: { pickId: number; sequence: number } | null
  initialState?: Partial<typeof initialFilters> & { moreFilters?: boolean }
}) {
  const { moreFilters: initialMoreFilters, ...filterState } = initialState ?? {}
  const [filters, setFilters] = useState({ ...initialFilters, ...filterState })
  const [moreFilters, setMoreFilters] = useState(initialMoreFilters ?? false)
  const [count, setCount] = useState(40)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const results = useMemo(
    () => searchDraftPicks(catalogue, filters),
    [catalogue, filters]
  )
  const selected = catalogue.draftPicks?.find((pick) => pick.id === selectedId)
  useEffect(() => {
    if (inspection) setSelectedId(inspection.pickId)
  }, [inspection])
  useEffect(() => {
    if (selectedId !== null && open) detailsRef.current?.focus()
    if (selectedId === null && open) searchRef.current?.focus()
  }, [selectedId, open])
  const change = (key: keyof typeof initialFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setCount(40)
  }
  const years = [
    ...new Set(
      catalogue.draftPicks
        ?.filter((pick) => !pick.isSwap)
        .map((pick) => pick.year) ?? []
    ),
  ].sort((a, b) => a - b)
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => key !== "sort" && !!value
  ).length
  const transfer = (id: number) =>
    currentTrade?.proposal.transfers.find(
      (item) => item.assetType === "pick" && item.assetId === id
    )
  const state = (id: number) => {
    const route = transfer(id)
    const destination = catalogue.teams.find(
      (team) => team.id === route?.toTeamId
    )
    return (
      <>
        {inMessage.includes(id) && (
          <Badge variant="secondary">In message</Badge>
        )}
        {route && (
          <Badge variant="outline">
            In trade · To {destination?.abbreviation ?? route.toTeamId}
          </Badge>
        )}
      </>
    )
  }
  const add = (pick: DraftPick) => {
    if (!pickUnavailableReason(pick) && !inMessage.includes(pick.id))
      onInsert(pick)
  }
  const back = () => {
    setSelectedId(null)
    requestAnimationFrame(() =>
      document.getElementById(`pick-row-${selectedId}`)?.focus()
    )
  }
  return (
    <section
      className="research-pane pick-pane t-panel-slide absolute inset-y-0 right-0 flex h-full min-w-0 flex-col border-l border-border bg-background max-md:border-l-0"
      aria-label="Draft pick browser"
      data-open={open}
      inert={!open}
      aria-hidden={!open}
    >
      <ResizableResearch pane="picks" open={open}>
        <div className="research-pane-header flex h-14 min-h-14 items-center justify-between gap-2 border-b border-border pr-3.5 pl-5">
          <h2 className="text-sm font-medium">Draft picks</h2>
          <div className="flex items-center gap-1">
            <ResearchAction
              label="Refresh draft picks"
              icon={Refresh01Icon}
              loading={refreshing}
              disabled={refreshing}
              onClick={onRefresh}
            />
            <ResearchAction
              label="Close draft picks"
              icon={Cancel01Icon}
              onClick={onClose}
            />
          </div>
        </div>
        {refreshError && (
          <Alert variant="warning" className="mx-4 mt-3 w-auto">
            <AlertDescription>
              Picks couldn’t be refreshed.{" "}
              <Button variant="link" size="sm" onClick={onRefresh}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div
          hidden={selectedId !== null}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-col gap-3.5 px-5 pt-4">
            <Collapsible
              open={moreFilters}
              onOpenChange={setMoreFilters}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <SearchInput
                  className="min-w-0 flex-1"
                  ref={searchRef}
                  name="pick-search"
                  value={filters.query}
                  onValueChange={(next) => change("query", next)}
                  aria-label="Search draft picks"
                  clearLabel="Clear pick search"
                  placeholder="Search teams, years or rounds…"
                />
                <CollapsibleTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                    />
                  }
                  aria-label="More draft pick filters"
                >
                  <Icon icon={FilterHorizontalIcon} data-icon="inline-start" />
                </CollapsibleTrigger>
              </div>
              {filters.query && (
                <p className="text-xs text-muted-foreground">
                  Team searches match owners and original teams.
                </p>
              )}
              <div className="filter-line grid grid-cols-2 items-end gap-3">
                <TeamFilter
                  name="pick-owner-filter"
                  label="Filter picks by owner"
                  caption="Owner"
                  value={filters.owner}
                  onChange={(value) => change("owner", value)}
                  teams={catalogue.teams}
                />
                <PickFilter
                  label="Year"
                  value={filters.year}
                  onChange={(value) => change("year", value)}
                  options={[
                    { value: "", label: "All years" },
                    ...years.map((year) => ({
                      value: String(year),
                      label: String(year),
                    })),
                  ]}
                />
              </div>
              <CollapsibleContent>
                <div className="grid grid-cols-2 items-end gap-3">
                  <TeamFilter
                    name="pick-origin-filter"
                    label="Filter picks by original team"
                    caption="Original team"
                    value={filters.origin}
                    onChange={(value) => change("origin", value)}
                    teams={catalogue.teams}
                  />
                  <PickFilter
                    label="Round"
                    value={filters.round}
                    onChange={(value) => change("round", value)}
                    options={[
                      { value: "", label: "Both rounds" },
                      { value: "1", label: "First round" },
                      { value: "2", label: "Second round" },
                    ]}
                  />
                  <div className="col-span-full">
                    <PickFilter
                      label="Availability"
                      value={filters.availability}
                      onChange={(value) => change("availability", value)}
                      options={[
                        { value: "", label: "All picks" },
                        { value: "available", label: "Available" },
                        { value: "unavailable", label: "Unavailable" },
                      ]}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <div className="list-heading flex flex-wrap items-center justify-between gap-2 pb-1 text-xs leading-label">
              <div className="flex items-center gap-2">
                <p role="status" className="text-muted-foreground tabular-nums">
                  {results.length} {results.length === 1 ? "pick" : "picks"}
                </p>
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters(initialFilters)
                      setCount(40)
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <ResearchFilterSelect
                className="w-48 max-w-full flex-none"
                label="Sort draft picks"
                name="pick-sort"
                value={filters.sort}
                onChange={(value) => change("sort", value)}
                items={[
                  { value: "year", label: "Year", description: "Then round" },
                  { value: "owner", label: "Owner", description: "A–Z" },
                  {
                    value: "origin",
                    label: "Original team",
                    description: "A–Z",
                  },
                ]}
              />
            </div>
          </div>
          <ScrollArea
            className="mt-2 min-h-0 flex-1"
            viewportClassName="h-full overscroll-contain"
          >
            <ul className="px-2 pb-5" aria-label="Draft pick results">
              {results.slice(0, count).map((pick) => {
                const reason = pickUnavailableReason(pick)
                return (
                  <li
                    key={pick.id}
                    className="flex items-center gap-1 rounded-md focus-within:bg-muted/50 hover:bg-muted/50"
                  >
                    <Button
                      id={`pick-row-${pick.id}`}
                      variant="ghost"
                      className="h-auto min-w-0 flex-1 justify-start px-3 py-3 text-left whitespace-normal hover:bg-transparent"
                      onClick={() => setSelectedId(pick.id)}
                      aria-label={`View ${pickLabel(pick, catalogue)} owned by ${catalogue.teams.find((team) => team.id === pick.currentTeamId)?.abbreviation ?? pick.currentTeamId}`}
                    >
                      <div className="min-w-0 flex-1">
                        <PickIdentity pick={pick} catalogue={catalogue} />
                        <div className="mt-1 flex flex-wrap gap-1 pl-15">
                          {reason && (
                            <span className="text-xs text-muted-foreground">
                              Unavailable
                            </span>
                          )}
                          {state(pick.id)}
                        </div>
                      </div>
                    </Button>
                    <div className="shrink-0 pr-2">
                      <ResearchAction
                        label={
                          reason
                            ? `${pickLabel(pick, catalogue)}: ${reason}`
                            : inMessage.includes(pick.id)
                              ? `${pickLabel(pick, catalogue)} is in message`
                              : `Add ${pickLabel(pick, catalogue)} to message`
                        }
                        icon={HashtagIcon}
                        disabled={
                          !!reason || inMessage.includes(pick.id) || refreshing
                        }
                        onClick={() => add(pick)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {!results.length && (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center text-sm">
                <p>
                  {catalogue.draftPicks?.length
                    ? "No picks match these filters."
                    : "No draft picks are listed."}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    catalogue.draftPicks?.length
                      ? setFilters(initialFilters)
                      : onRefresh()
                  }
                >
                  {catalogue.draftPicks?.length
                    ? "Reset filters"
                    : "Refresh picks"}
                </Button>
              </div>
            )}
            {count < results.length && (
              <Button
                variant="ghost"
                className="mb-4 w-full"
                onClick={() => setCount((value) => value + 40)}
              >
                Show more picks
              </Button>
            )}
          </ScrollArea>
        </div>
        {selectedId !== null && (
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="h-full overscroll-contain"
          >
            <div ref={detailsRef} tabIndex={-1} className="p-5 outline-none">
              <Button
                variant="ghost"
                size="sm"
                onClick={back}
                className="mb-5 -ml-2"
              >
                <Icon icon={ArrowLeft01Icon} />
                Back to picks
              </Button>
              {selected ? (
                <>
                  <PickIdentity pick={selected} catalogue={catalogue} />
                  <div className="mt-3 flex flex-wrap gap-1">
                    {state(selected.id)}
                  </div>
                  <dl className="my-6 flex flex-col gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Owned by
                      </dt>
                      <dd>
                        {
                          catalogue.teams.find(
                            (team) => team.id === selected.currentTeamId
                          )?.city
                        }{" "}
                        {
                          catalogue.teams.find(
                            (team) => team.id === selected.currentTeamId
                          )?.name
                        }
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Original team
                      </dt>
                      <dd>
                        {
                          catalogue.teams.find(
                            (team) => team.id === selected.originalTeamId
                          )?.city
                        }{" "}
                        {
                          catalogue.teams.find(
                            (team) => team.id === selected.originalTeamId
                          )?.name
                        }
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Protection
                      </dt>
                      <dd className="[overflow-wrap:anywhere]">
                        {selected.isProtected
                          ? selected.protectionDetails &&
                            selected.protectionDetails.toLowerCase() !==
                              "protected"
                            ? selected.protectionDetails
                            : "Protected · Terms unavailable"
                          : selected.protectionDetails || "Unprotected"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Availability
                      </dt>
                      <dd className="[overflow-wrap:anywhere]">
                        {pickUnavailableReason(selected) ||
                          "Available to include · Trade checks still apply."}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled={
                      !!pickUnavailableReason(selected) ||
                      inMessage.includes(selected.id) ||
                      refreshing
                    }
                    onClick={() => add(selected)}
                  >
                    <Icon icon={HashtagIcon} />
                    {inMessage.includes(selected.id)
                      ? "In message"
                      : "Add to message"}
                  </Button>
                </>
              ) : (
                <p role="status" className="text-sm">
                  This pick is no longer in the catalogue.
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </ResizableResearch>
    </section>
  )
}
