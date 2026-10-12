import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Basketball01Icon,
  Bookmark02Icon,
  Refresh01Icon,
  UserGroupIcon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons"
import { Icon } from "@/components/workspace/icons"
import { ChatPanel } from "@/components/workspace/chat-panel"
import {
  WorkspaceLoading,
  WorkspaceDataError,
  ConversationConnectionError,
} from "@/components/workspace/workspace-status"
import { PickBrowser } from "@/components/workspace/pick-browser"
import { SavedTrades } from "@/components/workspace/saved-trades"
import { workspaceStates } from "@/lib/ux-review/workspace-states"
import { PlayerBrowser } from "@/components/workspace/player-browser"
import {
  ResearchResizeProvider,
  ResizableResearch,
  useResearchResize,
} from "@/components/workspace/resizable-research"
import { ResearchContext } from "@/components/workspace/research-context"
import { tradeKey, tradeRecord } from "@/components/workspace/trade-card"
import type { TradeRecord } from "@/components/workspace/trade-card"
import type { ComposerHandle } from "@/components/workspace/composer/trade-composer"
import { messagePlayerReferences } from "@/lib/message-player-references"
import { teamSelectionClarification } from "@/lib/trade-clarification"
import catalogueData from "@/lib/ux-review/catalogue.json"
import type {
  Catalogue,
  TradeClarification,
  ClarificationOption,
} from "@/lib/trade/types"
import { waitForReviewAssets } from "@/lib/ux-review/capture-ready"
import {
  applyChoiceCheckpoint,
  applyRecordedChoices,
} from "@/lib/ux-review/choice-checkpoint"
import {
  reviewEntries,
  reviewExpandedSnapshot,
  reviewInput,
} from "@/lib/ux-review/model"
import { clarificationSelectionText } from "@/lib/clarification-selection"
import type { ReviewPhase, ReviewScenario } from "@/lib/ux-review/model"

const catalogue = catalogueData as Catalogue

export function ChatPreview({
  scenario,
  step,
  phase = "response",
  onRecordedSubmit,
  clarificationOverride,
}: {
  scenario: ReviewScenario
  step: number
  phase?: ReviewPhase
  onRecordedSubmit?: () => void
  clarificationOverride?: TradeClarification
}) {
  const scene = workspaceStates.find((state) => state.id === scenario.id)
  const scenePlayer = catalogue.players.find(
    (player) => player.name === scene?.player
  )
  const scenePick = catalogue.draftPicks?.find(
    (pick) =>
      !pick.isSwap &&
      (scene?.pick === "protected"
        ? pick.isProtected && pick.isTradable && Boolean(pick.protectionDetails)
        : scene?.pick === "protection-unknown"
          ? pick.isProtected && !pick.protectionDetails
          : scene?.pick === "unavailable"
            ? !pick.isTradable
            : pick.isTradable)
  )
  const [mode, setMode] = useState<"players" | "picks" | "saved" | null>(
    scene?.panel ?? null
  )
  const toggleMode = (view: "players" | "picks" | "saved") => {
    const next = mode === view ? null : view
    setMode(next)
    if (next !== "players" || matchMedia("(max-width: 1199px)").matches)
      setInspectorOpen(false)
  }
  const [inspectorOpen, setInspectorOpen] = useState(
    Boolean(scenePlayer || scene?.compare)
  )
  const [draftPickIds, setDraftPickIds] = useState<number[]>([])
  const [pickInspection, setPickInspection] = useState(
    scene?.pick && scenePick ? { pickId: scenePick.id, sequence: 1 } : undefined
  )
  const composerRef = useRef<ComposerHandle | null>(null)
  const [cancellation, setCancellation] = useState<{
    checkpoint: string
    createdAt: string
    questionId: string
  }>()
  const checkpoint = `${scenario.id}:${step}:${phase}`
  const cancelled = cancellation?.checkpoint === checkpoint
  const seededScene = useRef(false)
  const seededChoices = useRef(false)
  const [searchRefreshed, setSearchRefreshed] = useState(false)
  const visibleTurns = scenario.turns.slice(
    0,
    phase === "input" ? step : step + 1
  )
  const input =
    phase === "input" ? reviewInput(scenario.turns[step]) : undefined
  const raw = reviewEntries(visibleTurns, catalogue)
  const sceneClarification: TradeClarification | undefined =
    scene?.clarification
      ? scene.clarification === "three-teams"
        ? {
            ...teamSelectionClarification(
              "Which three teams do you want to involve?",
              catalogue
            ),
            selectionLimits: { min: 3, max: 3 },
          }
        : scene.clarification === "signing-team"
          ? teamSelectionClarification(
              "Which team should sign Seth Curry?",
              catalogue
            )
          : {
              purpose: "player_identity",
              question: "Who did you mean by “Michael Imaginary”?",
              options: [],
            }
      : undefined
  if (sceneClarification)
    raw.splice(
      0,
      raw.length,
      {
        id: "fixture-request",
        role: "user",
        text:
          scene?.clarification === "signing-team"
            ? "Sign Seth Curry."
            : scene?.clarification === "three-teams"
              ? "Help me build a three-team trade."
              : "Trade Michael Imaginary for Derrick White.",
      },
      {
        id: "fixture-question",
        role: "assistant",
        text: sceneClarification.question,
        clarification: sceneClarification,
      }
    )
  const question = [...raw].reverse().find((entry) => entry.clarification)
  const recordedClarification =
    sceneClarification ??
    clarificationOverride ??
    visibleTurns.at(-1)?.result.pendingClarification
  const ideaPool =
    visibleTurns.at(-1)?.ideaOptions ?? recordedClarification?.options ?? []
  // The user may have browsed beyond the opening page before choosing. Include
  // those recorded pages so the exact choice is available through the real UI.
  const selectedIndex = Math.max(
    -1,
    ...(input?.selections ?? []).map((option) =>
      ideaPool.findIndex((candidate) => candidate.id === option.id)
    )
  )
  const offeredClarification =
    recordedClarification?.tradeSearch &&
    selectedIndex >= recordedClarification.options.length
      ? {
          ...recordedClarification,
          options: ideaPool.slice(0, Math.ceil((selectedIndex + 1) / 30) * 30),
        }
      : recordedClarification
  const lastOption = offeredClarification?.options.at(-1)
  const lastOptionIndex = ideaPool.findIndex(
    (option) => option.id === lastOption?.id
  )
  // Recorded pools use array offsets; backend cursors refer to search positions.
  const previewClarification = offeredClarification?.tradeSearch
    ? {
        ...offeredClarification,
        id: searchRefreshed
          ? `${offeredClarification.id}-refreshed`
          : offeredClarification.id,
        tradeSearch: {
          ...offeredClarification.tradeSearch,
          expiresAt:
            scenario.fixture === "ideas-expired" && !searchRefreshed
              ? "2000-01-01T00:00:00.000Z"
              : undefined,
          nextCursor:
            offeredClarification.tradeSearch.nextCursor === null
              ? null
              : lastOptionIndex >= 0
                ? lastOptionIndex + 1
                : offeredClarification.options.length,
          total:
            scenario.fixture === "ideas-loading" ||
            scenario.fixture === "ideas-error"
              ? undefined
              : offeredClarification.tradeSearch.total,
        },
      }
    : offeredClarification
  if (question && previewClarification)
    question.clarification = previewClarification
  if (question && clarificationOverride) {
    question.clarification = clarificationOverride
    question.text = clarificationOverride.question
  }
  if (scenario.fixture === "loading") raw.splice(1)
  if (scenario.fixture === "tool-history") {
    const reply = raw.find((entry) => entry.role === "assistant")
    if (reply) {
      reply.workDurationMs = 12000
      reply.toolCalls = [
        {
          id: "review-intent",
          label: "Understood your request",
          state: "complete",
        },
        {
          id: "review-white",
          label: "Searched for Derrick White",
          state: "complete",
        },
        {
          id: "review-wiggins",
          label: "Searched for Andrew Wiggins",
          state: "complete",
        },
        { id: "review-check", label: "Checked the trade", state: "complete" },
      ]
    }
  }
  if (scenario.fixture?.startsWith("selected-")) {
    const white = catalogue.players.find(
      (player) => player.name === "Derrick White"
    )!
    const choices: Record<string, ClarificationOption> = {
      "selected-player": {
        id: `player-${white.id}`,
        label: white.name,
        value: white.name,
        playerId: white.id,
      },
      "selected-team": {
        id: "team-16",
        label: "Miami Heat",
        value: "Miami Heat",
        detail: "Eastern Conference",
      },
      "selected-package": {
        id: "keep-both",
        label: "Keep both players",
        value: "Keep both players",
        detail: "Derrick White and Andrew Wiggins",
      },
      "selected-answer": { id: "yes", label: "Yes", value: "Yes" },
      "selected-long-answer": {
        id: "keep-original",
        label:
          "Keep the original players and find an option that lowers Boston's payroll without adding another team",
        value: "Keep the original players and lower Boston's payroll",
      },
    }
    const selection = choices[scenario.fixture]
    raw.push({
      id: "fixture-question",
      role: "assistant",
      text: "Which option do you mean?",
      clarification: {
        question: "Which option do you mean?",
        options: [selection],
      },
    })
    raw.push({
      id: "fixture-selection",
      role: "user",
      text:
        selection.value +
        (scenario.fixture === "selected-answer"
          ? ""
          : "\n\nKeep Andrew Wiggins in the trade, too."),
      selection,
    })
  }
  if (
    ["edit-loading", "network", "provider"].includes(scenario.fixture ?? "")
  ) {
    raw.push({
      id: "fixture-user",
      role: "user",
      text: "Replace Andrew Wiggins with Pelle Larsson.",
    })
    if (scenario.fixture === "network" || scenario.fixture === "provider") {
      raw.push({
        id: "fixture-error",
        role: "assistant",
        text:
          scenario.fixture === "network"
            ? "The request couldn’t be completed. Please try again."
            : "The trade assistant is unavailable right now. Try again later.",
        tone: scenario.fixture === "network" ? "destructive" : "warning",
      })
    }
  }
  if (cancelled)
    raw.push(
      {
        id: "preview-cancel-user",
        role: "user",
        text: "Cancel",
        cancelQuestionId: cancellation.questionId,
        createdAt: cancellation.createdAt,
      },
      {
        id: "preview-cancel-assistant",
        role: "assistant",
        text: "Cancelled.",
        createdAt: cancellation.createdAt,
      }
    )
  const entries = raw.map(({ snapshot, ...entry }) => ({
    ...entry,
    playerReferences: messagePlayerReferences(
      entry.text,
      catalogue.players,
      entry.playerReferences
    ),
    ...(snapshot ? { trade: tradeRecord(snapshot, catalogue) } : {}),
  }))
  const expandedSnapshot = reviewExpandedSnapshot(visibleTurns)
  const expandedTrade = expandedSnapshot
    ? tradeRecord(expandedSnapshot, catalogue)
    : undefined
  const [expanded, setExpanded] = useState(
    new Set(expandedTrade ? [tradeKey(expandedTrade)] : [])
  )
  const [saved, setSaved] = useState<TradeRecord[]>(() =>
    scene?.saved
      ? entries.flatMap((entry) => (entry.trade ? [entry.trade] : [])).slice(-4)
      : []
  )
  const [inspection, setInspection] = useState<
    | {
        playerId: number
        sequence: number
      }
    | undefined
  >(scenePlayer ? { playerId: scenePlayer.id, sequence: 1 } : undefined)
  const researchOpen = Boolean(mode || inspectorOpen)
  const researchResize = useResearchResize(
    mode === "players",
    mode !== "saved" && mode !== "picks" && inspectorOpen
  )
  const closeInspector = () => {
    setInspectorOpen(false)
    composerRef.current?.focus()
  }
  const closeResearch = () => {
    setMode(null)
    setInspectorOpen(false)
    composerRef.current?.focus()
  }
  const insertPlayer = (player: Catalogue["players"][number]) => {
    if (matchMedia("(max-width: 767px)").matches) closeResearch()
    composerRef.current?.insertPlayer(player)
  }
  const inspectPlayer = (player: Catalogue["players"][number]) => {
    if (mode === "saved" || mode === "picks") setMode(null)
    setInspectorOpen(true)
    setInspection((previous) => ({
      playerId: player.id,
      sequence: (previous?.sequence ?? 0) + 1,
    }))
  }
  const busy =
    scenario.fixture === "loading" || scenario.fixture === "edit-loading"
  const notice = () =>
    window.parent.postMessage(
      {
        type: "gambit-review-action",
        message:
          "This is a recorded preview. Choose another checkpoint to see the next response.",
      },
      window.location.origin
    )
  const latestUserIndex = raw.map((entry) => entry.role).lastIndexOf("user")
  useEffect(() => {
    // Lexical's discrete updates must run outside React's effect flush.
    queueMicrotask(() => {
      if (seededScene.current) return
      seededScene.current = true
      if (input && !input.cancelQuestionId) {
        const text = input.selections.length
          ? (clarificationSelectionText(input.text, input.selections) ??
            input.text)
          : input.text
        const offset = input.text.length - text.length
        composerRef.current?.setDraft(
          text,
          input.playerReferences
            ?.filter((ref) => ref.start >= offset)
            .map((ref) => ({
              ...ref,
              start: ref.start - offset,
              end: ref.end - offset,
            })),
          input.pickReferences
            ?.filter((ref) => ref.start >= offset)
            .map((ref) => ({
              ...ref,
              start: ref.start - offset,
              end: ref.end - offset,
            }))
        )
      }
      if (scene?.draftPlayers) {
        for (const name of scene.draftPlayers) {
          const player = catalogue.players.find((item) => item.name === name)
          if (player) composerRef.current?.insertPlayer(player)
        }
      }
      if (scene?.selectedPick && scenePick)
        composerRef.current?.insertPick(scenePick)
      if (scenario.fixture === "draft")
        composerRef.current?.setDraft(
          "Can you find a Boston trade where we send exactly one player and get two players back from the same team? Keep Derrick White out of the package. Explain the salary matching for both sides and show me the checked alternatives. I also want to know which restrictions apply, and whether adding a draft pick or changing a player's salary would be supported."
        )
    })
    const controller = new AbortController()
    delete document.documentElement.dataset.reviewReady
    delete document.documentElement.dataset.reviewError
    const root =
      document.querySelector<HTMLElement>(".gambit-app") ?? document.body
    if (scenario.fixture === "tool-history") {
      const trigger = root.querySelector<HTMLButtonElement>(
        '[data-tool-history] [data-slot="accordion-trigger"]'
      )
      if (trigger?.getAttribute("aria-expanded") === "false") trigger.click()
    }
    void document.fonts.ready
      .then(async () => {
        controller.signal.throwIfAborted()
        if (input && !seededChoices.current) {
          seededChoices.current = true
          await applyRecordedChoices(
            root,
            input.selections.map((option) => option.id),
            controller.signal
          )
          if (input.cancelQuestionId) {
            const cancel = Array.from(
              root.querySelectorAll<HTMLButtonElement>(
                '[data-slot="conversation-response"] button'
              )
            ).find((button) => button.textContent.trim() === "Cancel")
            if (!cancel)
              throw new Error("Recorded Cancel control is unavailable")
            cancel.focus()
          }
        }
        if (scenario.choiceState && !seededChoices.current) {
          seededChoices.current = true
          await applyChoiceCheckpoint(
            root,
            scenario.choiceState,
            controller.signal
          )
        }
        controller.signal.throwIfAborted()
        // Orient authored checkpoints around their latest request. Long mobile
        // cards can otherwise start with only the bottom of the result visible.
        const viewport = document.querySelector<HTMLElement>(
          ".conversation-scroll"
        )
        const item = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-slot="message-scroller-item"]'
          )
        ).find(
          (element) => element.dataset.entryId === raw[latestUserIndex]?.id
        )
        if (latestUserIndex >= 0 && viewport && item)
          viewport.scrollTo({
            top:
              viewport.scrollTop +
              item.getBoundingClientRect().top -
              viewport.getBoundingClientRect().top -
              20,
            behavior: "instant",
          })
        return waitForReviewAssets(root, controller.signal)
      })
      .then(() => {
        // Capture-local IDs support the original reviewer's element inspector.
        ;[root, ...root.querySelectorAll<HTMLElement>("*")].forEach(
          (element) => {
            if (!element.dataset.reviewId)
              element.dataset.reviewId = crypto.randomUUID()
          }
        )
        document.documentElement.dataset.reviewReady = checkpoint
        window.parent.postMessage(
          { type: "gambit-review-ready", scenario: scenario.id, step },
          window.location.origin
        )
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          document.documentElement.dataset.reviewError =
            error instanceof Error ? error.message : "Review assets unavailable"
      })
    return () => controller.abort()
  }, [scenario, step, phase, latestUserIndex])
  if (scene?.phase === "loading") return <WorkspaceLoading />
  if (scene?.phase === "data-error")
    return <WorkspaceDataError onRetry={notice} />
  return (
    <ResearchContext value={catalogue}>
      <div className="gambit-app isolate flex h-dvh flex-col text-sm leading-data text-foreground antialiased selection:bg-primary/18 max-md:text-base">
        <header className="app-header flex h-16 shrink-0 items-center justify-between border-b border-border px-7 max-md:h-auto max-md:min-h-15 max-md:flex-wrap max-md:gap-y-1 max-md:px-3.5 max-md:py-2">
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="app-brand flex items-center gap-2.5 text-base font-semibold"
              aria-label="Chat options"
              onClick={notice}
            >
              <Icon icon={Basketball01Icon} data-icon="inline-start" />
              Gambit
            </Button>
            <Badge variant="secondary" className="h-7 px-3 text-sm">
              Trade Machine
            </Badge>
          </div>
          <nav
            className="flex items-center gap-1.5 max-md:w-full max-md:justify-center"
            aria-label="Workspace views"
          >
            <Button
              variant="ghost"
              aria-expanded={mode === "players"}
              onClick={() => toggleMode("players")}
            >
              <Icon icon={UserGroupIcon} data-icon="inline-start" />
              Players
            </Button>
            <Button
              variant="ghost"
              aria-expanded={mode === "picks"}
              onClick={() => toggleMode("picks")}
            >
              <Icon icon={Ticket01Icon} data-icon="inline-start" />
              Draft picks
            </Button>
            <Button
              variant="ghost"
              aria-expanded={mode === "saved"}
              onClick={() => toggleMode("saved")}
            >
              <Icon icon={Bookmark02Icon} data-icon="inline-start" />
              Saved trades
              {saved.length > 0 && (
                <Badge variant="secondary">{saved.length}</Badge>
              )}
            </Button>
          </nav>
        </header>
        <ResearchResizeProvider value={researchResize.value}>
          <main
            ref={researchResize.ref}
            style={researchResize.style}
            data-resizing={researchResize.resizing}
            className="workspace-content relative flex min-h-0 w-full flex-1 justify-start overflow-clip"
            data-research={researchOpen}
            data-list-open={mode === "players"}
            data-inspector-open={
              mode !== "saved" && mode !== "picks" && inspectorOpen
            }
            data-saved-open={mode === "saved"}
            data-picks-open={mode === "picks"}
          >
            <div className="chat-frame t-resize relative flex min-h-0 min-w-0 shrink-0 flex-col [&>[data-slot=alert]]:shrink-0">
              {scene?.phase === "connection-error" && (
                <ConversationConnectionError onRetry={notice} />
              )}
              <ChatPanel
                onRetry={notice}
                retryEntryId={
                  entries.at(-1)?.tone ? entries.at(-1)?.id : undefined
                }
                catalogue={catalogue}
                entries={entries}
                saved={saved}
                expanded={expanded}
                busy={busy}
                toolProgress={
                  scenario.fixture === "loading"
                    ? [
                        {
                          id: "review-search",
                          label: "Searching for Andrew Wiggins…",
                          state: "running",
                        },
                      ]
                    : scenario.fixture === "edit-loading"
                      ? [
                          {
                            id: "review-replace",
                            label: "Replacing a player…",
                            state: "running",
                          },
                        ]
                      : []
                }
                storageError={scenario.fixture === "storage"}
                pendingClarification={
                  cancelled || scenario.fixture?.startsWith("selected-")
                    ? null
                    : previewClarification
                }
                composerRef={composerRef}
                onRefreshSearch={async () => {
                  setSearchRefreshed(true)
                }}
                onBrowseIdeas={async (_reference, cursor, query) => {
                  if (scenario.fixture === "ideas-loading")
                    await new Promise(() => {})
                  if (scenario.fixture === "ideas-error")
                    throw new Error("Authored browse failure")
                  const terms = query
                    .toLowerCase()
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                  const matches = ideaPool.filter((option) =>
                    terms.every((term) =>
                      `${option.label} ${option.searchText ?? ""}`
                        .toLowerCase()
                        .includes(term)
                    )
                  )
                  const pageSize =
                    cursor === 0 && !terms.length
                      ? Math.max(30, offeredClarification?.options.length ?? 30)
                      : 30
                  return {
                    options: matches.slice(cursor, cursor + pageSize),
                    total: !terms.length
                      ? (recordedClarification?.tradeSearch?.total ??
                        matches.length)
                      : matches.length,
                    nextCursor:
                      cursor + pageSize < matches.length
                        ? cursor + pageSize
                        : null,
                  }
                }}
                onSubmit={(draft) => {
                  if (input) {
                    const choices =
                      draft.selections ??
                      (draft.selection ? [draft.selection] : [])
                    if (
                      draft.text === input.text &&
                      draft.cancelQuestionId === input.cancelQuestionId &&
                      JSON.stringify(choices.map((option) => option.id)) ===
                        JSON.stringify(
                          input.selections.map((option) => option.id)
                        )
                    )
                      onRecordedSubmit?.()
                    else notice()
                    return
                  }
                  if (draft.cancelQuestionId)
                    setCancellation({
                      checkpoint,
                      createdAt: new Date().toISOString(),
                      questionId: draft.cancelQuestionId,
                    })
                  else notice()
                }}
                onDraftChange={(draft) => setDraftPickIds(draft.pickIds ?? [])}
                onInspectPick={(pick) => {
                  setMode("picks")
                  setPickInspection((previous) => ({
                    pickId: pick.id,
                    sequence: (previous?.sequence ?? 0) + 1,
                  }))
                }}
                onInspectPlayer={inspectPlayer}
                onCheck={notice}
                onExpand={(record) =>
                  setExpanded((previous) => {
                    const next = new Set(previous)
                    const key = tradeKey(record)
                    if (next.has(key)) next.delete(key)
                    else next.add(key)
                    return next
                  })
                }
                onSave={(record) =>
                  setSaved((previous) =>
                    previous.some((item) => tradeKey(item) === tradeKey(record))
                      ? previous.filter(
                          (item) => tradeKey(item) !== tradeKey(record)
                        )
                      : [...previous, record]
                  )
                }
              />
            </div>
            <aside
              className="research-frame pointer-events-none absolute inset-y-0 right-0 w-full min-w-0"
              data-open={researchOpen}
              inert={!researchOpen}
              aria-hidden={!researchOpen}
              aria-label="Research workspace"
            >
              <div className="research-surface pointer-events-none absolute inset-0">
                <div className="research-mode h-full">
                  <PlayerBrowser
                    catalogue={catalogue}
                    listOpen={mode === "players"}
                    inspectorOpen={
                      mode !== "saved" && mode !== "picks" && inspectorOpen
                    }
                    inspection={inspection}
                    initialState={{
                      ...scene?.playerState,
                      compareIds: scene?.compare?.flatMap((name) => {
                        const player = catalogue.players.find(
                          (item) => item.name === name
                        )
                        return player ? [player.id] : []
                      }),
                      comparisonOpen: Boolean(scene?.compare),
                    }}
                    onInsert={insertPlayer}
                    onListOpenChange={(open) =>
                      setMode(open ? "players" : null)
                    }
                    onInspectorOpenChange={setInspectorOpen}
                    onCloseInspector={closeInspector}
                  />
                </div>
                <PickBrowser
                  catalogue={catalogue}
                  open={mode === "picks"}
                  onClose={closeResearch}
                  onInsert={(pick) => {
                    if (draftPickIds.includes(pick.id)) return
                    if (matchMedia("(max-width: 767px)").matches)
                      closeResearch()
                    composerRef.current?.insertPick(pick)
                  }}
                  initialState={scene?.pickState}
                  inspection={pickInspection}
                  inMessage={draftPickIds}
                  currentTrade={expandedSnapshot ?? null}
                  refreshing={scene?.refreshing ?? false}
                  refreshError={scene?.refreshError ?? false}
                  onRefresh={notice}
                />
                <div
                  className="research-pane saved-pane t-panel-slide absolute inset-y-0 right-0 h-full min-w-0 border-l border-border bg-background max-md:border-l-0"
                  data-open={mode === "saved"}
                  inert={mode !== "saved"}
                  aria-hidden={mode !== "saved"}
                >
                  <ResizableResearch pane="saved" open={mode === "saved"}>
                    <SavedTrades
                      records={saved}
                      onInspectPlayer={inspectPlayer}
                      onClose={closeResearch}
                      onView={(record) => {
                        setExpanded(new Set([tradeKey(record)]))
                        closeResearch()
                        requestAnimationFrame(() =>
                          document
                            .getElementById(
                              `trade-${record.snapshot.proposal.proposalId}-${record.snapshot.proposal.revision}`
                            )
                            ?.scrollIntoView({
                              behavior: matchMedia(
                                "(prefers-reduced-motion: reduce)"
                              ).matches
                                ? "instant"
                                : "smooth",
                              block: "center",
                            })
                        )
                      }}
                      onRemove={(record) =>
                        setSaved((records) =>
                          records.filter(
                            (item) => tradeKey(item) !== tradeKey(record)
                          )
                        )
                      }
                    />
                  </ResizableResearch>
                </div>
              </div>
            </aside>
          </main>
        </ResearchResizeProvider>
        <Button
          variant="outline"
          size="icon-lg"
          className="chat-reset-fab"
          aria-label="Reset chat"
          disabled={busy}
          onClick={notice}
        >
          <Icon icon={Refresh01Icon} />
        </Button>
      </div>
    </ResearchContext>
  )
}
