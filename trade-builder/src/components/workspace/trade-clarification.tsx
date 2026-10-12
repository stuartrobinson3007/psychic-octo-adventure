import {
  SelectionGroup,
  SelectionGroupItem,
  SelectionGroupCounter,
} from "@/components/ui/selection-group"
import { TradeIdeaChoice } from "./trade-idea-choice"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useEffect, useLayoutEffect, useRef, useId, useState } from "react"
import type { CSSProperties } from "react"
import { ToggleGroup } from "@/components/ui/toggle-group"
import { Toggle } from "@/components/ui/toggle"
import { ScrollArea, ScrollAreaContent } from "@/components/ui/scroll-area"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { SearchInput } from "./search-input"
import { Field, FieldLabel } from "@/components/ui/field"
import { InformationCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import {
  clarificationOptionPlayers,
  clarificationQuestion,
  filterClarificationOptions,
} from "@/lib/trade-clarification"
import { Icon } from "./icons"
import { MessageText } from "./message-text"
import { PlayerAvatar } from "./player-avatar"
import { TeamMark } from "./team-mark"
import { ResearchAction } from "./research-action"
import type {
  Catalogue,
  ClarificationOption,
  Player,
  TradeClarification as Clarification,
  TradeIdeaPage,
} from "@/lib/trade/types"

function ClarificationChoice({
  option,
  catalogue,
  onInspectPlayer,
  contentOnly = false,
}: {
  option: ClarificationOption
  catalogue: Catalogue
  onInspectPlayer: (player: Player) => void
  contentOnly?: boolean
}) {
  const players = clarificationOptionPlayers(option, catalogue)
  const player = players.length === 1 ? players[0] : undefined
  const team = catalogue.teams.find((item) => item.id === player?.teamId)
  const optionTeam = !players.length
    ? catalogue.teams.find(
        (item) =>
          option.id === `team-${item.id}` ||
          option.teamId === item.id ||
          option.label === `${item.city ?? ""} ${item.name}`.trim()
      )
    : undefined
  // Named monetary assets can survive after their source player leaves the roster.
  const portraitName =
    !players.length && !optionTeam
      ? /^(.+?)\s+[—–]\s+\$(?=\d)/u.exec(option.label)?.[1]
      : undefined
  const copy = (text: string) =>
    players.length > 1 ? (
      <MessageText
        text={text}
        catalogue={catalogue}
        onInspect={onInspectPlayer}
      />
    ) : (
      text
    )

  const body = (
    <div className="pointer-events-none relative flex min-h-16 items-center gap-3 py-2 pr-3 pl-12">
      {player && <PlayerAvatar player={player} team={team} showTeamBadge />}
      {portraitName && <PlayerAvatar player={{ name: portraitName }} />}
      {optionTeam && <TeamMark team={optionTeam} className="size-6 shrink-0" />}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere] [&_.player-badge-host]:pointer-events-auto">
        <div className="text-base leading-5 font-medium sm:text-sm">
          {copy(option.label)}
        </div>
        {option.detail && (
          <div className="mt-0.5 text-base leading-5 text-muted-foreground sm:text-sm">
            {copy(option.detail)}
          </div>
        )}
      </div>
      {player && (
        <ResearchAction
          label={`View ${player.name} details`}
          icon={InformationCircleIcon}
          className="pointer-events-auto size-11 shrink-0 sm:size-9 sm:opacity-0 sm:group-focus-within/choice:opacity-100 sm:group-hover/choice:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={(event) => {
            event.stopPropagation()
            onInspectPlayer(player)
          }}
        />
      )}
    </div>
  )
  if (contentOnly) return body
  return (
    <div className="group/choice relative w-full border-b border-border/70 last:border-b-0">
      {/* Inspection controls are siblings of the choice, never nested buttons. */}
      <Toggle
        value={option.id}
        data-option-id={option.id}
        type="button"
        aria-label={option.label}
        className="group/option absolute inset-0 h-full w-full justify-start rounded-none px-4 transition-none hover:bg-muted/50 focus-visible:ring-inset aria-pressed:bg-primary/5"
      >
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-full border border-input group-aria-pressed/option:border-primary group-aria-pressed/option:bg-primary group-aria-pressed/option:text-primary-foreground"
        >
          <Icon
            icon={Tick02Icon}
            className="size-3 opacity-0 group-aria-pressed/option:opacity-100"
          />
        </span>
      </Toggle>
      {body}
    </div>
  )
}

/** Limesite MVP's conversation-response surface, kept above the composer. */
export function TradeClarification({
  clarification,
  catalogue,
  onInspectPlayer,
  selected,
  onSelect,
  onCancel,
  busy,
  onBrowse,
  onRefresh,
  onOptionsChange,
}: {
  clarification: Clarification
  catalogue: Catalogue
  onInspectPlayer: (player: Player) => void
  selected: Array<string>
  onSelect: (ids: Array<string>) => void
  onCancel: () => void
  busy: boolean
  onBrowse?: (
    reference: string,
    cursor: number,
    query: string
  ) => Promise<TradeIdeaPage>
  onOptionsChange?: (options: ClarificationOption[]) => void
  onRefresh?: (reference: string, query: string) => Promise<void>
}) {
  const [query, setQuery] = useState(clarification.tradeSearch?.query ?? "")
  const searchRef = useRef<HTMLInputElement>(null)
  const searchId = useId()
  const questionId = useId()
  const [page, setPage] = useState<TradeIdeaPage>({
    options: clarification.options,
    nextCursor: clarification.tradeSearch?.nextCursor ?? null,
    total: clarification.tradeSearch?.total,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expired, setExpired] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const request = useRef(0)
  const initialQuery = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const lastBrowse = useRef({ cursor: 0, filter: "", append: false })
  const [openingHeight, setOpeningHeight] = useState<number>()
  const tradeSearch = clarification.tradeSearch
  useEffect(() => {
    if (!tradeSearch?.expiresAt) return
    const remaining = Date.parse(tradeSearch.expiresAt) - Date.now()
    if (!Number.isFinite(remaining)) return
    const expire = () => {
      request.current++
      setLoading(false)
      setExpired(true)
      onSelect([])
    }
    if (remaining <= 0) {
      expire()
      return
    }
    const timer = setTimeout(expire, remaining)
    return () => clearTimeout(timer)
  }, [tradeSearch?.expiresAt])
  // Reserve space for the request and its reply as well as the composer.
  // A tall list should never leave the conversation showing only its marker.
  const optionsHeight = tradeSearch
    ? "h-[min(var(--options-height,36rem),60dvh,36rem,max(4rem,calc(100dvh-34rem)))] max-md:h-[min(var(--options-height,28rem),50dvh,28rem,max(4rem,calc(100dvh-32rem)))]"
    : "h-[min(var(--options-height,18rem),30dvh,18rem)]"
  // Measure the original list once. Filtering cannot resize the question's slot;
  // the CSS cap still adapts when the viewport changes.
  useLayoutEffect(() => {
    if (!clarification.options.length && tradeSearch) return
    const height = contentRef.current?.scrollHeight
    if (height) setOpeningHeight(height)
  }, [])
  const browse = async (cursor: number, filter: string, append: boolean) => {
    if (!tradeSearch || !onBrowse || expired || refreshing) return
    lastBrowse.current = { cursor, filter, append }
    const version = ++request.current
    setLoading(true)
    setError("")
    try {
      const result = await onBrowse(tradeSearch.reference, cursor, filter)
      if (version !== request.current) return
      if (result.status === "expired") {
        setExpired(true)
        onSelect([])
        return
      }
      if (!append)
        scrollRef.current
          ?.querySelector('[data-slot="scroll-area-viewport"]')
          ?.scrollTo({ top: 0, behavior: "instant" })
      setPage((previous) => ({
        ...result,
        options: append
          ? [...previous.options, ...result.options]
          : result.options,
      }))
      onOptionsChange?.(result.options)
    } catch {
      if (version === request.current) setError("Trade ideas couldn’t load.")
    } finally {
      if (version === request.current) setLoading(false)
    }
  }
  useEffect(() => {
    if (!tradeSearch || !onBrowse || expired || refreshing) return
    if (initialQuery.current) {
      initialQuery.current = false
      if (tradeSearch.total !== undefined)
        return () => {
          request.current++
        }
    }
    setLoading(true)
    const timer = setTimeout(() => {
      void browse(0, query, false)
    }, 200)
    return () => {
      clearTimeout(timer)
      request.current++
    }
  }, [query, expired, refreshing])
  useEffect(() => {
    if (
      !tradeSearch ||
      !onBrowse ||
      loading ||
      busy ||
      error ||
      expired ||
      refreshing ||
      page.nextCursor === null
    )
      return
    const end = endRef.current
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!end || !viewport) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        void browse(page.nextCursor!, query, true)
      },
      { root: viewport, rootMargin: "0px 0px 120px 0px" }
    )
    observer.observe(end)
    return () => observer.disconnect()
  }, [page.nextCursor, loading, busy, error, query, expired, refreshing])
  const limits = clarification.selectionLimits ?? { min: 1, max: 1 }
  const multiple = limits.max > 1
  const options = tradeSearch
    ? page.options
    : filterClarificationOptions(clarification.options, query)
  const empty =
    !options.length &&
    !loading &&
    !error &&
    (!tradeSearch || page.nextCursor === null)
  const changeQuery = (next: string) => {
    if (tradeSearch && onBrowse && !expired && !refreshing) {
      request.current++
      setLoading(true)
      setError("")
    }
    setQuery(next)
    if (
      !multiple &&
      selected.length > 0 &&
      !filterClarificationOptions(clarification.options, next).some(
        (option) => option.id === selected[0]
      )
    )
      onSelect([])
  }
  // Free-text questions are rendered as assistant messages, never empty pickers.
  if (!clarification.options.length && !tradeSearch) return null
  return (
    <SelectionGroup
      min={limits.min}
      max={limits.max}
      value={selected}
      onValueChange={onSelect}
      disabled={busy || refreshing}
      aria-labelledby={questionId}
    >
      <section
        data-slot="conversation-response"
        aria-label={clarification.question}
        className="bg-background"
      >
        <div className="flex items-center gap-3 border-b border-border/70 bg-muted/50 px-4 py-2">
          <h2
            id={questionId}
            className="min-w-0 flex-1 text-base leading-5 font-medium sm:text-sm"
          >
            {clarificationQuestion(
              clarification.question,
              clarification.options.length > 0
            )}
          </h2>
          {multiple && <SelectionGroupCounter />}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={busy || refreshing}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
        {clarification.optionSearch && (
          <Field
            className="border-b border-border/70 px-4 py-3"
            data-disabled={busy}
          >
            <FieldLabel htmlFor={searchId} className="sr-only">
              {clarification.optionSearch.label}
            </FieldLabel>
            <SearchInput
              ref={searchRef}
              id={searchId}
              clearLabel="Clear search"
              placeholder={clarification.optionSearch.placeholder}
              value={query}
              disabled={busy}
              onValueChange={changeQuery}
            />
          </Field>
        )}
        {(clarification.options.length > 0 || tradeSearch) && (
          <div
            data-slot="clarification-options"
            className={`relative ${optionsHeight}`}
            style={
              openingHeight
                ? ({
                    "--options-height": `${openingHeight}px`,
                  } as CSSProperties)
                : undefined
            }
            aria-busy={loading}
          >
            {empty ? (
              <Empty className="h-full gap-3 rounded-none p-4 sm:p-6">
                <EmptyHeader className="gap-1" role="status">
                  <EmptyTitle className="text-base tracking-normal sm:text-sm">
                    {query.trim() ? "No matches" : "No options available"}
                  </EmptyTitle>
                  {query.trim() && (
                    <EmptyDescription className="text-base sm:text-sm">
                      Try a different search.
                    </EmptyDescription>
                  )}
                </EmptyHeader>
                {query && (
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        changeQuery("")
                        searchRef.current?.focus()
                      }}
                    >
                      Clear search
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <ScrollArea
                ref={scrollRef}
                className="h-full"
                viewportClassName="h-full"
              >
                <ScrollAreaContent
                  ref={contentRef}
                  inert={
                    (loading && !lastBrowse.current.append) ||
                    expired ||
                    refreshing
                  }
                  data-loading={
                    (loading && !lastBrowse.current.append) ||
                    expired ||
                    refreshing ||
                    undefined
                  }
                  className="data-loading:opacity-35"
                >
                  {multiple ? (
                    <div>
                      {options.map((option) => (
                        <SelectionGroupItem
                          key={option.id}
                          value={option.id}
                          data-option-id={option.id}
                          label={option.label}
                        >
                          {option.tradeIdea ? (
                            <TradeIdeaChoice
                              idea={option.tradeIdea}
                              catalogue={catalogue}
                              onInspectPlayer={onInspectPlayer}
                            />
                          ) : (
                            <ClarificationChoice
                              option={option}
                              catalogue={catalogue}
                              onInspectPlayer={onInspectPlayer}
                              contentOnly
                            />
                          )}
                        </SelectionGroupItem>
                      ))}
                    </div>
                  ) : (
                    <ToggleGroup
                      value={selected}
                      onValueChange={onSelect}
                      orientation="vertical"
                      spacing={0}
                      disabled={busy}
                      className="w-full"
                      aria-labelledby={questionId}
                    >
                      {options.map((option) => (
                        <ClarificationChoice
                          key={option.id}
                          option={option}
                          catalogue={catalogue}
                          onInspectPlayer={onInspectPlayer}
                        />
                      ))}
                    </ToggleGroup>
                  )}
                  <div ref={endRef} aria-hidden="true" className="h-px" />
                </ScrollAreaContent>
              </ScrollArea>
            )}
            {loading && !options.length && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <Spinner aria-label="Loading trade ideas" />
              </div>
            )}
          </div>
        )}
        {tradeSearch && (
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 px-4 py-3">
            <p
              role={error ? "alert" : "status"}
              className="min-w-0 flex-1 text-base text-muted-foreground tabular-nums sm:text-sm"
            >
              {refreshing
                ? "Refreshing search…"
                : expired
                  ? error || "This search has expired."
                  : error ||
                    (loading
                      ? "Loading trade ideas…"
                      : page.total !== undefined && page.total !== null
                        ? `Showing ${options.length.toLocaleString()} of ${page.total.toLocaleString()}`
                        : `Showing ${options.length.toLocaleString()}`)}
            </p>
            {expired && onRefresh ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || refreshing}
                onClick={async () => {
                  if (refreshing) return
                  request.current++
                  setRefreshing(true)
                  setError("")
                  onSelect([])
                  try {
                    await onRefresh(tradeSearch.reference, query)
                  } catch {
                    setError("Search couldn’t refresh. Try again.")
                  } finally {
                    setRefreshing(false)
                  }
                }}
              >
                {refreshing && <Spinner aria-hidden="true" />}
                Refresh search
              </Button>
            ) : error && !expired ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || loading}
                onClick={() => {
                  const { cursor, filter, append } = lastBrowse.current
                  void browse(cursor, filter, append)
                }}
              >
                Retry
              </Button>
            ) : loading ? (
              <Spinner aria-label="Loading trade ideas" />
            ) : null}
          </div>
        )}
      </section>
    </SelectionGroup>
  )
}
