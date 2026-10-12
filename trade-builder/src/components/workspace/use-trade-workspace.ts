import type { MessagePickReference } from "@/lib/message-pick-references"
import {
  archiveMessages,
  conversationEntries,
} from "@/lib/conversation-entries"
import {
  cardResponseSummary,
  tradeResponseCopy,
} from "@/lib/trade-response-copy"
import { sendStreamingTradeMessage } from "@/lib/trade-chat-stream"
import { Effect, Fiber, Schema } from "effect"
import { readWorkspace, writeWorkspace } from "@/lib/workspace-storage"
import type { StoredWorkspace } from "@/lib/workspace-storage"
import {
  ConversationViewSchema,
  TradeIdeaPageSchema,
} from "@/lib/trade/chat-schemas"
import { TradeSnapshotSchema } from "@/lib/trade/proposal-schemas"
import {
  useWorkspaceRequests,
  workspaceRequest,
} from "./use-workspace-requests"
import { useEffect, useRef, useState } from "react"
import type {
  Catalogue,
  TradeSnapshot,
  TradeClarification,
  ConversationView,
  ClarificationOption,
  ToolActivity,
} from "@/lib/trade/types"
import {
  checkTradeVersion,
  getTradeConversation,
  getTradeIdeas,
  importTradeConversation,
  refreshTradeSearch,
} from "@/server/trade-functions"
import { tradeKey, tradeRecord } from "./trade-card"
import type { TradeRecord } from "./trade-card"
import type { ComposerDraft } from "./composer/trade-composer"
import { messagePickReferences } from "@/lib/message-pick-references"
import { messagePlayerReferences } from "@/lib/message-player-references"
import type { MessagePlayerReference } from "@/lib/message-player-references"
import {
  clarificationSelectionText,
  clarificationSelections,
} from "@/lib/clarification-selection"

export interface ConversationEntry {
  sourceMessageId?: string
  cancelQuestionId?: string
  createdAt?: string
  workDurationMs?: number
  toolCalls?: Array<ToolActivity>
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
  id: string
  role: "user" | "assistant"
  text: string
  tone?: "warning" | "destructive"
  playerReferences?: Array<MessagePlayerReference>
  selectedPlayerIds?: Array<number>
  selectedPickIds?: Array<number>
  pickReferences?: Array<MessagePickReference>
  trade?: TradeRecord
  isCandidate?: boolean
  clarification?: TradeClarification
}
export interface WorkspacePreview {
  sessionKey?: string
  entries: Array<ConversationEntry>
  snapshot: TradeSnapshot | null
}

class WorkspaceLoadError extends Schema.TaggedError<WorkspaceLoadError>()(
  "WorkspaceLoadError",
  { cause: Schema.Defect() }
) {}
export function useTradeWorkspace(
  catalogue: Catalogue,
  preview?: WorkspacePreview
) {
  const [entries, setEntries] = useState<Array<ConversationEntry>>([])
  const [saved, setSaved] = useState<Array<TradeRecord>>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refreshingSearch, setRefreshingSearch] = useState(false)
  const [toolProgress, setToolProgress] = useState<Array<ToolActivity>>([])
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [storageError, setStorageError] = useState(false)
  const previewSeed = useRef(preview)
  const sessionId = useRef("")
  const runRequest = useWorkspaceRequests(loadVersion)
  const conversationVersion = useRef(0)
  const [pendingClarification, setPendingClarification] =
    useState<TradeClarification | null>(null)
  const current = useRef<TradeSnapshot | null>(null)
  const lock = useRef(false)
  const lastSubmission = useRef<{
    userId: string
    draft: ComposerDraft
  } | null>(null)
  const applyConversation = (
    rawView: ConversationView,
    preserveExpansion = false
  ) => {
    const view = Schema.decodeUnknownSync(ConversationViewSchema)(rawView)
    conversationVersion.current = view.version
    current.current = view.snapshot
    const checkedRecords = new Map(
      view.messages
        .flatMap((message) => [
          ...(message.snapshots ?? []),
          ...(message.candidates ?? []),
        ])
        .map((snapshot) => {
          const record = tradeRecord(snapshot, catalogue)
          return [tradeKey(record), record] as const
        })
    )
    setSaved((items) =>
      items.map((record) => checkedRecords.get(tradeKey(record)) ?? record)
    )
    setPendingClarification(view.pendingClarification)
    setEntries((previous) =>
      conversationEntries(view.messages).map(({ snapshot, ...entry }) => ({
        ...entry,
        pickReferences: messagePickReferences(
          entry.text,
          catalogue.draftPicks ?? [],
          entry.pickReferences
        ),
        playerReferences: messagePlayerReferences(
          entry.text,
          catalogue.players,
          entry.playerReferences ??
            previous.find(
              (message) =>
                message.id === entry.id && message.text === entry.text
            )?.playerReferences
        ),
        ...(snapshot ? { trade: tradeRecord(snapshot, catalogue) } : {}),
      }))
    )
    if (view.snapshot && !preserveExpansion)
      setExpanded(new Set([tradeKey(tradeRecord(view.snapshot, catalogue))]))
  }
  useEffect(() => {
    const lifecycle = { active: true }
    setLoading(true)
    setConnectionError(false)
    let stored: StoredWorkspace | undefined
    try {
      if (!previewSeed.current) {
        stored = Effect.runSync(readWorkspace(localStorage))
      }
    } catch {
      setStorageError(true)
    }
    sessionId.current =
      stored?.version === 2 && stored.conversationId
        ? stored.conversationId
        : crypto.randomUUID()
    if (previewSeed.current?.sessionKey) {
      const key = `gambit-review-conversation:${previewSeed.current.sessionKey}`
      try {
        const retained = sessionStorage.getItem(key)
        if (retained && /^[a-zA-Z0-9_-]{8,100}$/.test(retained))
          sessionId.current = retained
        else sessionStorage.setItem(key, sessionId.current)
      } catch {
        /* The live preview remains usable without browser persistence. */
      }
    }
    const seedEntries = previewSeed.current?.entries ?? stored?.entries ?? []
    // Version 1 never recorded focus. Do not infer it from the last card.
    const seedSnapshot =
      previewSeed.current?.snapshot ??
      (stored?.version === 2 ? (stored.snapshot ?? null) : null)
    setEntries(
      seedEntries.map((entry) => {
        const text =
          entry.role === "assistant"
            ? tradeResponseCopy(entry.text)
            : entry.text
        return {
          ...entry,
          text,
          pickReferences: messagePickReferences(
            text,
            catalogue.draftPicks ?? [],
            text === entry.text ? entry.pickReferences : []
          ),
          playerReferences: messagePlayerReferences(
            text,
            catalogue.players,
            text === entry.text
              ? entry.playerReferences?.filter((reference) =>
                  entry.selectedPlayerIds?.includes(reference.playerId)
                )
              : []
          ),
        }
      })
    )
    setSaved(stored?.saved ?? [])
    if (!previewSeed.current) {
      try {
        Effect.runSync(
          writeWorkspace(localStorage, {
            ...stored,
            version: 2,
            conversationId: sessionId.current,
            snapshot: seedSnapshot,
            entries: seedEntries,
            saved: stored?.saved ?? [],
          })
        )
      } catch {
        setStorageError(true)
      }
    }
    const activeSessionId = sessionId.current
    const loadingFiber = Effect.runFork(
      Effect.gen(function* () {
        let view = yield* Effect.tryPromise({
          try: (signal) =>
            getTradeConversation({
              data: { sessionId: activeSessionId },
              signal,
            }),
          catch: (cause) => new WorkspaceLoadError({ cause }),
        }).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(ConversationViewSchema))
        )
        if (!view.messages.length && seedEntries.length)
          view = yield* Effect.tryPromise({
            try: (signal) =>
              importTradeConversation({
                data: {
                  sessionId: activeSessionId,
                  messages: archiveMessages(seedEntries.slice(-300)),
                  focus: seedSnapshot
                    ? {
                        proposalId: seedSnapshot.proposal.proposalId,
                        revision: seedSnapshot.proposal.revision,
                      }
                    : null,
                },
                signal,
              }),
            catch: (cause) => new WorkspaceLoadError({ cause }),
          }).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(ConversationViewSchema))
          )
        if (!lifecycle.active) return
        yield* Effect.sync(() => {
          applyConversation(view)
          setReady(true)
        })
      }).pipe(
        Effect.timeout("60 seconds"),
        Effect.catch(() =>
          Effect.sync(() => {
            if (!lifecycle.active) return
            setConnectionError(true)
            // Keep the visible archive, but don't send against unknown server state.
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            if (lifecycle.active) setLoading(false)
          })
        ),
        Effect.withSpan("loadTradeWorkspace")
      )
    )
    return () => {
      lifecycle.active = false
      Effect.runFork(Fiber.interrupt(loadingFiber))
    }
  }, [loadVersion])
  useEffect(() => {
    if (!ready || previewSeed.current) return
    try {
      Effect.runSync(
        writeWorkspace(localStorage, {
          version: 2,
          conversationId: sessionId.current,
          conversationVersion: conversationVersion.current,
          snapshot: current.current,
          entries: entries.slice(-100),
          saved: saved.slice(-50),
        })
      )
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [entries, saved, ready])
  const addText = (
    text: string,
    tone?: ConversationEntry["tone"],
    clarification?: TradeClarification
  ) =>
    setEntries((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        createdAt: new Date().toISOString(),
        text,
        tone,
        ...(clarification ? { clarification } : {}),
        playerReferences: messagePlayerReferences(text, catalogue.players),
      },
    ])
  const addTrade = (
    snapshot: TradeSnapshot,
    text: string,
    isCandidate = false
  ) => {
    const record = tradeRecord(snapshot, catalogue)
    const message = text.trim() ? text : cardResponseSummary([snapshot])
    setEntries((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        createdAt: new Date().toISOString(),
        text: message,
        trade: record,
        ...(isCandidate ? { isCandidate: true } : {}),
        playerReferences: messagePlayerReferences(message, catalogue.players),
      },
    ])
    setExpanded(new Set([tradeKey(record)]))
  }
  const readConversation = (id: string) =>
    workspaceRequest((signal) =>
      getTradeConversation({ data: { sessionId: id }, signal })
    ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(ConversationViewSchema)))
  const recoverConnection = Effect.fn("recoverTradeConnection")(
    function* (id: string) {
      const view = yield* readConversation(id)
      yield* Effect.sync(() => {
        applyConversation(view)
        addText(
          "The connection was interrupted. Your conversation has been refreshed. If your request is missing, send it again.",
          "warning"
        )
      })
    },
    Effect.timeout("15 seconds"),
    Effect.catch(() =>
      Effect.sync(() => {
        setReady(false)
        setConnectionError(true)
      })
    )
  )
  const submit = async (draft: ComposerDraft) => {
    if (lock.current || !ready) return
    const requestId = crypto.randomUUID()
    lastSubmission.current = {
      userId: `${requestId}-user`,
      draft: structuredClone(draft),
    }
    setEntries((items) => [
      ...items,
      {
        id: `${requestId}-user`,
        role: "user",
        createdAt: new Date().toISOString(),
        text: draft.text,
        cancelQuestionId: draft.cancelQuestionId,
        selections: draft.selections,
        selection: draft.selection,
        selectedPickIds: draft.pickIds,
        pickReferences: draft.pickReferences,
        selectedPlayerIds: draft.playerIds,
        playerReferences:
          draft.playerReferences ??
          messagePlayerReferences(draft.text, catalogue.players),
      },
    ])
    lock.current = true
    setBusy(true)
    setToolProgress([])
    const activeSessionId = sessionId.current
    await runRequest(
      (active) =>
        Effect.gen(function* () {
          const result = yield* workspaceRequest((signal) =>
            sendStreamingTradeMessage(
              {
                sessionId: activeSessionId,
                requestId,
                message: draft.text,
                selectedPickIds: draft.pickIds,
                pickReferences: draft.pickReferences,
                selectedPlayerIds: draft.playerIds,
                playerReferences: draft.playerReferences,
                clarificationAnswer: draft.clarificationAnswer,
                cancelQuestionId: draft.cancelQuestionId,
                expectedConversationVersion: conversationVersion.current,
              },
              (progress) => {
                if (active()) setToolProgress(progress)
              },
              undefined,
              signal
            )
          )
          const view = yield* readConversation(activeSessionId)
          yield* Effect.sync(() => {
            applyConversation(view)
            if (
              !view.messages.some(
                (message) => message.id === `${requestId}-assistant`
              )
            )
              addText(
                result.message,
                result.status === "error" ? "destructive" : "warning"
              )
          })
        }).pipe(
          Effect.timeout("100 seconds"),
          Effect.catch(() => recoverConnection(activeSessionId)),
          Effect.ensuring(
            Effect.sync(() => {
              lock.current = false
              if (!active()) return
              setBusy(false)
              setToolProgress([])
            })
          )
        ),
      120_000
    ).catch(() => undefined)
  }

  const lastEntry = entries.at(-1)
  const retryUser =
    lastEntry?.role === "assistant" && lastEntry.tone
      ? entries.find(
          (entry) =>
            entry.role === "user" &&
            entry.id === lastEntry.id.replace(/-assistant$/, "-user")
        )
      : undefined
  const retry = (entryId: string) => {
    if (!retryUser || entryId !== lastEntry?.id || lock.current || !ready)
      return
    const draft =
      lastSubmission.current?.userId === retryUser.id
        ? lastSubmission.current.draft
        : {
            text: retryUser.text,
            cancelQuestionId: retryUser.cancelQuestionId,
            playerIds: retryUser.selectedPlayerIds ?? [],
            playerReferences: retryUser.playerReferences,
            pickIds: retryUser.selectedPickIds,
            pickReferences: retryUser.pickReferences,
            selection: retryUser.selection,
            selections: retryUser.selections,
            unresolved: 0,
            ...(clarificationSelections(retryUser).length
              ? {
                  clarificationAnswer: {
                    optionIds: clarificationSelections(retryUser).map(
                      (option) => option.id
                    ),
                    text:
                      clarificationSelectionText(
                        retryUser.text,
                        clarificationSelections(retryUser)
                      ) ?? "",
                  },
                }
              : {}),
          }
    // Failed turns are cached by request ID; a retry needs a fresh attempt.
    void submit(draft)
  }
  const check = async (record: TradeRecord) => {
    if (lock.current || !ready) return
    lock.current = true
    setBusy(true)
    const activeSessionId = sessionId.current
    await runRequest((active) =>
      Effect.gen(function* () {
        const snapshot = yield* workspaceRequest((signal) =>
          checkTradeVersion({
            data: {
              sessionId: activeSessionId,
              requestId: crypto.randomUUID(),
              expectedConversationVersion: conversationVersion.current,
              reference: {
                proposalId: record.snapshot.proposal.proposalId,
                revision: record.snapshot.proposal.revision,
              },
            },
            signal,
          })
        ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(TradeSnapshotSchema)))
        if (snapshot.verdict?.status === "invalid_proposal")
          yield* Effect.sync(() => addTrade(snapshot, ""))
        else {
          const view = yield* readConversation(activeSessionId)
          yield* Effect.sync(() => applyConversation(view))
        }
      }).pipe(
        Effect.timeout("50 seconds"),
        Effect.catch(() => recoverConnection(activeSessionId)),
        Effect.ensuring(
          Effect.sync(() => {
            lock.current = false
            if (active()) setBusy(false)
          })
        )
      )
    ).catch(() => undefined)
  }
  const toggleSave = (record: TradeRecord) =>
    setSaved((items) =>
      items.some((item) => tradeKey(item) === tradeKey(record))
        ? items.filter((item) => tradeKey(item) !== tradeKey(record))
        : [...items, record]
    )
  const toggleExpanded = (record: TradeRecord) =>
    setExpanded((values) => {
      const next = new Set(values)
      const key = tradeKey(record)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const view = (record: TradeRecord) => {
    if (
      !entries.some(
        (entry) => entry.trade && tradeKey(entry.trade) === tradeKey(record)
      )
    )
      setEntries((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "",
          createdAt: record.snapshot.verdict?.evaluatedAt,
          trade: record,
        },
      ])
    setExpanded((values) => new Set([...values, tradeKey(record)]))
    requestAnimationFrame(() =>
      document
        .getElementById(
          `trade-${record.snapshot.proposal.proposalId}-${record.snapshot.proposal.revision}`
        )
        ?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "center",
        })
    )
  }
  const resetChat = () => {
    if (lock.current) return false
    sessionId.current = crypto.randomUUID()
    current.current = null
    conversationVersion.current = 0
    setPendingClarification(null)
    setEntries([])
    setSaved([])
    setExpanded(new Set())
    lastSubmission.current = null
    return true
  }
  return {
    refreshSearch: async (searchReference: string, query: string) => {
      if (lock.current || !ready)
        throw new Error("Wait for the current request to finish.")
      lock.current = true
      setRefreshingSearch(true)
      setBusy(true)
      const activeSessionId = sessionId.current
      return runRequest((active) =>
        workspaceRequest((signal) =>
          refreshTradeSearch({
            data: {
              sessionId: activeSessionId,
              requestId: crypto.randomUUID(),
              expectedConversationVersion: conversationVersion.current,
              searchReference,
              query,
            },
            signal,
          })
        ).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(ConversationViewSchema)),
          Effect.timeout("50 seconds"),
          Effect.catch((error) =>
            Effect.gen(function* () {
              // A refresh can commit even if its response is interrupted.
              const refreshed = yield* readConversation(activeSessionId).pipe(
                Effect.timeout("15 seconds")
              )
              yield* Effect.sync(() => applyConversation(refreshed, true))
              if (
                refreshed.pendingClarification?.tradeSearch?.reference ===
                searchReference
              )
                return yield* Effect.fail(error)
              return refreshed
            })
          ),
          Effect.tap((refreshed) =>
            Effect.sync(() => applyConversation(refreshed, true))
          ),
          Effect.ensuring(
            Effect.sync(() => {
              lock.current = false
              if (!active()) return
              setRefreshingSearch(false)
              setBusy(false)
            })
          )
        )
      ).then(() => undefined)
    },
    browseIdeas: (searchReference: string, cursor: number, query: string) => {
      const activeSessionId = sessionId.current
      return runRequest(() =>
        workspaceRequest((signal) =>
          getTradeIdeas({
            data: {
              sessionId: activeSessionId,
              searchReference,
              cursor,
              query,
            },
            signal,
          })
        ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(TradeIdeaPageSchema)))
      )
    },
    entries,
    refreshingSearch,
    saved,
    snapshot: current.current,
    loading,
    busy: busy || loading,
    connectionError,
    retryConnection: () => setLoadVersion((value) => value + 1),
    ready,
    pendingClarification,
    toolProgress,
    expanded,
    storageError,
    submit,
    retry,
    retryEntryId: retryUser ? lastEntry?.id : undefined,
    check,
    toggleSave,
    toggleExpanded,
    view,
    resetChat,
  }
}
