import { selectionCountValid } from "@/lib/selection-limits"
import {
  clarificationChatEntries,
  clarificationSelections,
} from "@/lib/clarification-selection"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { ClarificationSelection } from "./clarification-selection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller"
import { Message, MessageContent } from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyContent,
} from "@/components/ui/empty"
import { CurrentToolActivity, ToolCallHistory } from "./tool-activity"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "cn"
import {
  AlertCircleIcon,
  ArrowLeftRightIcon,
  DollarCircleIcon,
  Search01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "./icons"
import { TradeCard, tradeKey } from "./trade-card"
import type { TradeRecord } from "./trade-card"
import { TradeComposer } from "./composer/trade-composer"
import type { ComposerDraft, ComposerHandle } from "./composer/trade-composer"
import type { ConversationEntry } from "./use-trade-workspace"
import type {
  Catalogue,
  Player,
  DraftPick,
  TradeClarification as ClarificationState,
  ToolActivity,
  TradeIdeaPage,
  ClarificationOption,
} from "@/lib/trade/types"
import { MessageText } from "./message-text"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { TradeClarification } from "./trade-clarification"
import { activeClarificationEntry } from "@/lib/trade-clarification"
import type { MessagePlayerReference } from "@/lib/message-player-references"
import { messageTimestamp } from "@/lib/message-timestamp"

interface WelcomeSuggestion {
  label: string
  draft: string
  icon: typeof ArrowLeftRightIcon
  playerReferences?: Array<MessagePlayerReference>
}

export function ChatPanel({
  catalogue,
  entries,
  saved,
  expanded,
  busy,
  storageError,
  pendingClarification,
  toolProgress = [],
  composerRef,
  onSubmit,
  onRetry,
  retryEntryId,
  retryDisabled = false,
  onInspectPlayer,
  onInspectPick,
  onDraftChange,
  onSave,
  onExpand,
  onCheck,
  onBrowseIdeas,
  onRefreshSearch,
  refreshingSearch = false,
}: {
  refreshingSearch?: boolean
  onRefreshSearch?: (reference: string, query: string) => Promise<void>
  onBrowseIdeas?: (
    reference: string,
    cursor: number,
    query: string
  ) => Promise<TradeIdeaPage>
  catalogue: Catalogue
  entries: Array<ConversationEntry>
  saved: Array<TradeRecord>
  expanded: Set<string>
  busy: boolean
  storageError: boolean
  pendingClarification?: ClarificationState | null
  toolProgress?: Array<ToolActivity>
  composerRef: React.RefObject<ComposerHandle | null>
  onSubmit: (draft: ComposerDraft) => void
  onRetry?: (entryId: string) => void
  retryEntryId?: string
  retryDisabled?: boolean
  onInspectPick?: (pick: DraftPick) => void
  onDraftChange?: (draft: ComposerDraft) => void
  onInspectPlayer: (player: Player) => void
  onSave: (record: TradeRecord) => void
  onExpand: (record: TradeRecord) => void
  onCheck: (record: TradeRecord) => void
}) {
  const latestQuestion = activeClarificationEntry(entries)
  const active =
    busy && !refreshingSearch
      ? undefined
      : pendingClarification === undefined
        ? latestQuestion
        : pendingClarification &&
            (latestQuestion?.clarification?.id && pendingClarification.id
              ? latestQuestion.clarification.id === pendingClarification.id
              : latestQuestion?.clarification?.question ===
                pendingClarification.question)
          ? {
              id:
                pendingClarification.id ??
                latestQuestion?.id ??
                pendingClarification.question,
              clarification: pendingClarification,
            }
          : undefined
  const clarification = active?.clarification
  const hasOptions = !!(
    clarification?.options.length || clarification?.tradeSearch
  )
  const [browsed, setBrowsed] = useState<{
    entry: string
    options: ClarificationOption[]
  }>()
  const [selection, setSelection] = useState<{
    entry: string
    options: Array<string>
  }>()
  const selected =
    selection && selection.entry === active?.id ? selection.options : []
  const answers = selected.flatMap(
    (id) =>
      [
        ...(clarification?.options ?? []),
        ...(browsed && browsed.entry === active?.id ? browsed.options : []),
      ].find((option) => option.id === id) ?? []
  )
  const limits = clarification?.selectionLimits ?? { min: 1, max: 1 }
  const selectionValid =
    answers.length === 0 || selectionCountValid(answers.length, limits)
  const transcript = useMemo(() => clarificationChatEntries(entries), [entries])
  const waitingForAnswer = hasOptions && !busy
  const questionEntry = clarification
    ? [...entries]
        .reverse()
        .find((entry) =>
          entry.clarification?.id && clarification.id
            ? entry.clarification.id === clarification.id
            : entry.clarification?.question === clarification.question
        )
    : undefined
  const hasQuestionActivity = transcript.some(
    (entry) => entry.id === questionEntry?.id
  )
  const empty = entries.length === 0
  const panelRef = useRef<HTMLElement>(null)
  const composerMotionRef = useRef<HTMLDivElement>(null)
  const composerAreaRef = useRef<HTMLDivElement>(null)
  const welcomeComposerTop = useRef<number | null>(null)
  const suggestions = [
    {
      label: "Check a player swap",
      draft: "Trade Derrick White for Andrew Wiggins",
      icon: ArrowLeftRightIcon,
      playerNames: ["Derrick White", "Andrew Wiggins"],
    },
    {
      label: "Find a guard for Boston",
      draft: "Find Boston trade options for an incoming guard.",
      icon: Search01Icon,
      playerNames: [],
    },
    {
      label: "Build a three-team trade",
      draft:
        "Could we send Stephen Curry to Boston, Derrick White to Miami, and Andrew Wiggins to Golden State?",
      icon: UserGroupIcon,
      playerNames: ["Stephen Curry", "Derrick White", "Andrew Wiggins"],
    },
    {
      label: "Explore a hypothetical contract",
      draft:
        "Could Boston trade Derrick White for Andrew Wiggins if White earned $18 million a year for two more years?",
      icon: DollarCircleIcon,
      playerNames: ["Derrick White", "Andrew Wiggins"],
    },
  ]
    .filter(({ playerNames }) =>
      playerNames.every((name) =>
        catalogue.players.some((player) => player.name === name)
      )
    )
    .map<WelcomeSuggestion>(({ playerNames, ...suggestion }) => ({
      ...suggestion,
      playerReferences: playerNames.map((name) => ({
        start: suggestion.draft.indexOf(name),
        end: suggestion.draft.indexOf(name) + name.length,
        playerId: catalogue.players.find((player) => player.name === name)!.id,
      })),
    }))

  useLayoutEffect(() => {
    const composer = composerMotionRef.current
    const area = composerAreaRef.current
    const panel = panelRef.current
    if (!composer || !area || !panel) return

    if (empty) {
      const measure = () => {
        const entranceTransform = getComputedStyle(
          composer.parentElement!
        ).transform
        welcomeComposerTop.current =
          composer.getBoundingClientRect().top -
          new DOMMatrixReadOnly(entranceTransform).m42
      }
      measure()
      const observer = new ResizeObserver(measure)
      observer.observe(panel)
      observer.observe(composer)
      if (composer.parentElement) observer.observe(composer.parentElement)
      const frame = requestAnimationFrame(() => {
        area.classList.add("is-shown")
      })
      return () => {
        observer.disconnect()
        cancelAnimationFrame(frame)
      }
    }

    const previousTop = welcomeComposerTop.current
    welcomeComposerTop.current = null
    if (
      previousTop === null ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const offset = previousTop - composer.getBoundingClientRect().top
    const tokens = getComputedStyle(panel)
    // Production CSS can serialize the same duration in seconds (400ms → .4s).
    const duration = tokens.getPropertyValue("--resize-dur").trim()
    // Move the scroll container with its composer so it cannot clip the travel.
    const animation = area.animate(
      [
        { transform: `translateY(${offset}px)` },
        { transform: "translateY(0)" },
      ],
      {
        duration: parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000),
        easing: tokens.getPropertyValue("--resize-ease").trim(),
      }
    )
    return () => animation.cancel()
  }, [empty])
  return (
    <MessageScrollerProvider autoScroll>
      <section
        ref={panelRef}
        className="chat-panel relative flex min-h-0 w-full min-w-0 flex-1 flex-col"
        data-empty={empty}
        aria-label="Trade conversation"
      >
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="conversation-scroll min-h-0">
            <MessageScrollerContent
              className="conversation-content mx-auto w-full max-w-[760px] gap-0 px-10 pt-9 pb-7 max-[1200px]:px-6 max-[1200px]:py-7 max-md:px-5 max-md:pt-7 max-md:pb-6"
              aria-live="polite"
            >
              {!empty && (
                <>
                  {transcript.map((entry, index) => (
                    <MessageScrollerItem
                      key={entry.id}
                      messageId={entry.id}
                      data-entry-id={entry.id}
                      className={cn(
                        entry.trade && "[content-visibility:visible]",
                        index === 0
                          ? undefined
                          : entry.trade && !entry.text
                            ? transcript[index - 1].trade
                              ? "mt-3"
                              : "mt-4"
                            : "mt-8"
                      )}
                      scrollAnchor={entry.role === "user"}
                    >
                      <Message
                        align={entry.role === "user" ? "end" : "start"}
                        title={messageTimestamp(
                          entry.createdAt ??
                            entry.trade?.snapshot.verdict?.evaluatedAt
                        )}
                      >
                        <MessageContent>
                          {entry.role === "assistant" && (
                            <ToolCallHistory
                              calls={entry.toolCalls}
                              workDurationMs={entry.workDurationMs}
                              payrollScenario={
                                entry.trade &&
                                !entry.trade.snapshot.proposal.transfers.length
                              }
                            />
                          )}
                          {entry.role === "user" &&
                            clarificationSelections(entry).length > 0 && (
                              <ClarificationSelection
                                options={clarificationSelections(entry)}
                                catalogue={catalogue}
                                onInspectPlayer={onInspectPlayer}
                              />
                            )}
                          {entry.noOptionsSelected && (
                            <p
                              data-slot="clarification-cancellation"
                              className="self-end rounded-full bg-muted px-3 py-1 text-base text-muted-foreground italic sm:text-sm"
                            >
                              No options selected
                            </p>
                          )}
                          {entry.text && entry.tone ? (
                            <Alert variant={entry.tone}>
                              <Icon
                                icon={AlertCircleIcon}
                                data-icon="inline-start"
                              />
                              <AlertDescription className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 [overflow-wrap:anywhere]">
                                <span className="min-w-0 flex-1">
                                  {entry.text}
                                </span>
                                {onRetry && entry.id === retryEntryId && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="relative text-current transition-none hover:bg-current/5 hover:text-current"
                                    disabled={busy || retryDisabled}
                                    onClick={() => onRetry(entry.id)}
                                  >
                                    Retry
                                    <span
                                      className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
                                      aria-hidden="true"
                                    />
                                  </Button>
                                )}
                              </AlertDescription>
                            </Alert>
                          ) : (
                            entry.text && (
                              <Bubble
                                variant={
                                  entry.role === "user" ? "muted" : "ghost"
                                }
                                align={entry.role === "user" ? "end" : "start"}
                              >
                                <BubbleContent className="whitespace-pre-wrap">
                                  <MessageText
                                    text={entry.text}
                                    references={entry.playerReferences}
                                    pickReferences={entry.pickReferences}
                                    onInspectPick={onInspectPick}
                                    catalogue={catalogue}
                                    onInspect={onInspectPlayer}
                                    badgeVariant={
                                      entry.role === "user"
                                        ? "outline"
                                        : "player"
                                    }
                                  />
                                </BubbleContent>
                              </Bubble>
                            )
                          )}
                          {entry.trade && (
                            <TradeCard
                              onInspectPlayer={onInspectPlayer}
                              record={entry.trade}
                              expanded={expanded.has(tradeKey(entry.trade))}
                              onExpand={() => onExpand(entry.trade!)}
                              saved={saved.some(
                                (record) =>
                                  tradeKey(record) === tradeKey(entry.trade!)
                              )}
                              onSave={() => onSave(entry.trade!)}
                              busy={busy}
                              onCheck={
                                entry.trade.snapshot.verdict?.status ===
                                "validation_unavailable"
                                  ? () => onCheck(entry.trade!)
                                  : undefined
                              }
                            />
                          )}
                          {waitingForAnswer &&
                            entry.id === questionEntry?.id && (
                              <Marker role="status">
                                <MarkerContent>
                                  Waiting for your answer…
                                </MarkerContent>
                              </Marker>
                            )}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ))}
                  {busy && !refreshingSearch && (
                    <MessageScrollerItem messageId="thinking" className="mt-8">
                      <CurrentToolActivity calls={toolProgress} />
                    </MessageScrollerItem>
                  )}
                  {waitingForAnswer && !hasQuestionActivity && (
                    <MessageScrollerItem
                      messageId="awaiting-answer"
                      className="mt-8"
                    >
                      <Marker role="status">
                        <MarkerContent>Waiting for your answer…</MarkerContent>
                      </Marker>
                    </MessageScrollerItem>
                  )}
                </>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
        <ScrollArea
          ref={composerAreaRef}
          style={{ position: empty ? "absolute" : "relative" }}
          className={cn(
            "composer-area relative z-10 mx-auto grid max-h-full w-full max-w-[760px] shrink-0 grid-rows-[minmax(0,1fr)]",
            empty && "t-stagger"
          )}
          viewportClassName="min-h-0 overscroll-contain"
        >
          <div
            className={cn(
              "composer-area-content flex flex-col gap-2.5 px-9 pt-1 pb-[22px] max-[1200px]:px-6 max-[1200px]:pt-0 max-[1200px]:pb-20 max-md:px-3.5 max-md:pt-1 [&>*]:shrink-0",
              hasOptions && "max-[1200px]:pb-4"
            )}
          >
            {empty && (
              <Empty className="chat-welcome items-center gap-6 p-0 text-center [&_h1]:text-[clamp(32px,4vw,48px)] [&_h1]:leading-[1.15]! [&_h1]:tracking-[-0.035em]">
                <EmptyHeader className="max-w-none">
                  <EmptyTitle className="t-stagger-line">
                    <h1>
                      What trade do you
                      <br />
                      have in mind?
                    </h1>
                  </EmptyTitle>
                </EmptyHeader>
                <EmptyContent className="welcome-suggestions t-stagger-line t-stagger-line--2 grid! max-w-none grid-cols-2 items-stretch gap-2.5 max-[480px]:grid-cols-1 [&>button]:justify-start">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.label}
                      type="button"
                      variant="outline"
                      className="h-full min-h-10 py-2 text-left whitespace-normal"
                      onClick={() =>
                        composerRef.current?.setDraft(
                          suggestion.draft,
                          suggestion.playerReferences
                        )
                      }
                    >
                      <Icon icon={suggestion.icon} data-icon="inline-start" />
                      {suggestion.label}
                    </Button>
                  ))}
                </EmptyContent>
              </Empty>
            )}
            <div
              data-slot={hasOptions ? "clarification-composer" : undefined}
              className={cn(
                empty && "t-stagger-line t-stagger-line--3",
                hasOptions &&
                  "overflow-hidden rounded-md bg-background shadow-xs ring-1 ring-foreground/10 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50"
              )}
            >
              {active && clarification && hasOptions && (
                <TradeClarification
                  key={clarification.id ?? active.id}
                  clarification={clarification}
                  catalogue={catalogue}
                  onInspectPlayer={onInspectPlayer}
                  selected={selected}
                  onSelect={(options) =>
                    setSelection({ entry: active.id, options })
                  }
                  busy={busy && !refreshingSearch}
                  onCancel={() => {
                    setSelection(undefined)
                    onSubmit({
                      text: "Cancel",
                      playerIds: [],
                      unresolved: 0,
                      cancelQuestionId: clarification.id ?? active.id,
                    })
                    composerRef.current?.focus()
                  }}
                  onBrowse={onBrowseIdeas}
                  onRefresh={onRefreshSearch}
                  onOptionsChange={(options) =>
                    setBrowsed((previous) => ({
                      entry: active.id,
                      options: [
                        ...new Map(
                          [
                            ...(previous?.entry === active.id
                              ? previous.options
                              : []),
                            ...options,
                          ].map((option) => [option.id, option])
                        ).values(),
                      ],
                    }))
                  }
                />
              )}
              <div
                ref={composerMotionRef}
                className={cn(
                  "composer-motion",
                  clarification &&
                    clarification.options.length > 0 &&
                    "border-t border-border/70"
                )}
              >
                <TradeComposer
                  ref={composerRef}
                  busy={busy}
                  attached={hasOptions}
                  onSubmit={(draft) => {
                    setSelection(undefined)
                    onSubmit(draft)
                  }}
                  onInspectPlayer={onInspectPlayer}
                  onDraftChange={onDraftChange}
                  answers={answers}
                  questionId={clarification?.id}
                  selectionValid={selectionValid}
                  placeholder={
                    hasOptions
                      ? answers.length ||
                        clarification.purpose === "trade_selection"
                        ? "Add a message…"
                        : "Your answer…"
                      : undefined
                  }
                />
              </div>
            </div>
            {storageError && (
              <Alert variant="warning">
                <Icon icon={AlertCircleIcon} data-icon="inline-start" />
                <AlertDescription>
                  History couldn’t be saved on this browser.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </section>
    </MessageScrollerProvider>
  )
}
