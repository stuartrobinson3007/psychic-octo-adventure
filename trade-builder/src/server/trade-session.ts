import { Effect, Exit, Semaphore } from "effect"
import { conversationContext } from "./conversation-context.ts"
import { decodeSavedConversation } from "./conversation-persistence.ts"
import {
  ConversationStorage,
  ConversationOperationError,
  conversationFailure,
} from "./conversation-storage.ts"
import type { MessagePickReference } from "../lib/message-pick-references.ts"
import {
  recordedClarificationSelections,
  resolveClarificationAnswer,
} from "../lib/clarification-selection.ts"
import type { MessagePlayerReference } from "../lib/message-player-references.ts"
import type { ConversationRecords } from "./conversation-records.ts"
import { migrateConversationRecords, records } from "./conversation-records.ts"
import { migrateSearchCatalogues } from "./search-catalogue.ts"
import {
  getConversationStore as store,
  scopeSessionId,
} from "./conversation-store.ts"
import type {
  ChatTurnResult,
  ConversationMessage,
  ConversationView,
  TradeClarification,
  TradeSnapshot,
  TradeReference,
  ClarificationAnswer,
} from "../lib/trade/types.ts"

export interface TradeSession {
  records?: ConversationRecords
  id: string
  version: number
  snapshot: TradeSnapshot | null
  history: Array<{ role: "user" | "assistant"; content: string }>
  messages: Array<ConversationMessage>
  revisions: Array<TradeSnapshot>
  candidates: Array<TradeSnapshot>
  replies: Map<string, ChatTurnResult>
  expires: number
}
const sessions = new Map<string, TradeSession>()
const locks = new Map<
  string,
  { semaphore: Semaphore.Semaphore; users: number }
>()
const active = new Set<string>()
function load(id: string): TradeSession {
  const row = store().read(id)
  const stored = row?.payload ? decodeSavedConversation(row.payload) : {}
  const { pending, discovery, ...persistent } = stored
  const session: TradeSession = {
    snapshot: null,
    history: [],
    messages: [],
    revisions: [],
    candidates: [],
    ...persistent,
    id,
    version: row?.version ?? 0,
    replies: new Map(stored.replies ?? []),
    expires: Date.now() + 120_000,
  }
  migrateConversationRecords(session, pending, discovery)
  migrateSearchCatalogues(records(session).searches)
  for (const question of records(session).questions) {
    const search = session.records?.searches.find(
      (item) =>
        `search:${item.id}@${item.revision}` ===
        question.clarification.tradeSearch?.reference
    )
    if (search && question.clarification.tradeSearch)
      question.clarification.tradeSearch.expiresAt = search.expiresAt
  }
  return session
}
const encode = (session: TradeSession) =>
  JSON.stringify({
    ...session,
    replies: [...session.replies],
  })

/** Cache expiry never deletes the durable conversation. */
export function getSession(id: string): TradeSession {
  const key = scopeSessionId(id)
  let session = sessions.get(key)
  if (!session || (!active.has(key) && session.expires <= Date.now())) {
    session = load(id)
    sessions.set(key, session)
  }
  return session
}
function persistOutsideTurn(session: TradeSession) {
  const key = scopeSessionId(session.id)
  if (active.has(key)) return
  Effect.runSync(
    Effect.scoped(
      Effect.gen(function* () {
        const storage = yield* ConversationStorage
        const owner = crypto.randomUUID()
        yield* Effect.acquireRelease(
          storage.claim(session.id, owner, 60_000),
          () => storage.release(session.id, owner).pipe(Effect.orDie)
        )
        const payload = yield* Effect.try({
          try: () => encode(session),
          catch: (cause) => conversationFailure("encode", cause),
        })
        yield* storage.save(session.id, session.version, payload, owner)
        session.version++
      })
    ).pipe(
      Effect.provide(ConversationStorage.layer),
      Effect.onExit((exit) =>
        Effect.sync(() => {
          if (Exit.isFailure(exit)) sessions.delete(key)
        })
      )
    )
  )
}

/** Serialize local turns and use a lease + version check across server processes. */
export async function withSessionLock<T>(
  id: string,
  operation: (
    signal: AbortSignal,
    storage: ConversationStorage["Service"]
  ) => Promise<T>,
  leaseMs = 60_000,
  signal?: AbortSignal,
  timeoutMs = Math.max(1000, leaseMs - 15_000)
): Promise<T> {
  const requestContext = conversationContext.getStore()
  const inRequest = <TValue>(action: () => TValue): TValue =>
    requestContext ? conversationContext.run(requestContext, action) : action()
  const program = Effect.scoped(
    Effect.gen(function* () {
      const storage = yield* ConversationStorage
      const key = storage.key(id)
      const entry = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const found = locks.get(key) ?? {
            semaphore: Semaphore.makeUnsafe(1),
            users: 0,
          }
          found.users++
          locks.set(key, found)
          return found
        }),
        (found) =>
          Effect.sync(() => {
            found.users--
            if (found.users === 0 && locks.get(key) === found) locks.delete(key)
          })
      )
      return yield* Effect.scoped(
        Effect.gen(function* () {
          return yield* Effect.acquireRelease(
            Effect.gen(function* () {
              const owner = crypto.randomUUID()
              yield* storage.claim(id, owner, leaseMs)
              return owner
            }),
            (owner) => storage.release(id, owner).pipe(Effect.orDie)
          ).pipe(
            Effect.flatMap((owner) =>
              Effect.gen(function* () {
                const session = yield* Effect.try({
                  try: () => inRequest(() => load(id)),
                  catch: (cause) => conversationFailure("load", cause),
                })
                sessions.set(key, session)
                active.add(key)
                yield* Effect.addFinalizer(() =>
                  Effect.sync(() => active.delete(key))
                )
                const before = encode(session)
                let running: Promise<T> | undefined
                yield* Effect.addFinalizer(() =>
                  Effect.promise(() =>
                    running
                      ? running.then(
                          () => undefined,
                          () => undefined
                        )
                      : Promise.resolve()
                  )
                )
                const result = yield* Effect.tryPromise({
                  try: (turnSignal) => {
                    running = inRequest(() => operation(turnSignal, storage))
                    return running
                  },
                  catch: (cause) =>
                    new ConversationOperationError({
                      message:
                        cause instanceof Error
                          ? cause.message
                          : "The conversation operation could not finish.",
                      cause,
                    }),
                })
                if (encode(session) !== before) {
                  yield* storage.save(
                    id,
                    session.version,
                    encode(session),
                    owner
                  )
                  session.version++
                }
                return result
              })
            )
          )
        })
      ).pipe(
        Semaphore.withPermit(entry.semaphore),
        Effect.onExit((exit) =>
          Effect.sync(() => {
            if (Exit.isFailure(exit)) sessions.delete(key)
          })
        )
      )
    })
  ).pipe(Effect.provide(ConversationStorage.layer), Effect.timeout(timeoutMs))
  return Effect.runPromise(program, { signal })
}
export function rememberSnapshot(
  session: TradeSession,
  snapshot: TradeSnapshot
) {
  session.snapshot = structuredClone(snapshot)
  const archived = session.revisions.findIndex(
    (item) => sameReference(item.proposal, snapshot.proposal) && !item.verdict
  )
  if (archived >= 0) session.revisions[archived] = structuredClone(snapshot)
  if (
    !session.revisions.some((item) =>
      sameReference(item.proposal, snapshot.proposal)
    )
  )
    session.revisions.push(structuredClone(snapshot))
  persistOutsideTurn(session)
}
export function rememberReply(
  session: TradeSession,
  requestId: string,
  reply: ChatTurnResult
) {
  session.replies.set(requestId, structuredClone(reply))
  persistOutsideTurn(session)
}
export const sameReference = (a: TradeReference, b: TradeReference) =>
  a.proposalId === b.proposalId && a.revision === b.revision
export function knownProposals(session: TradeSession) {
  return [...session.revisions, ...session.candidates]
}
export function findProposal(session: TradeSession, reference: TradeReference) {
  return knownProposals(session).find((item) =>
    sameReference(item.proposal, reference)
  )
}
/** A retained draft is not necessarily the current conversational question. */
export function activePendingClarification(
  session: TradeSession
): TradeClarification | null {
  const latestReply = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant" && !message.tone)
  return (
    records(session).questions.find(
      (item) => item.status === "open" && item.messageId === latestReply?.id
    )?.clarification ?? null
  )
}
export function conversationView(session: TradeSession): ConversationView {
  return structuredClone({
    version: session.version,
    snapshot: session.snapshot,
    messages: session.messages,
    pendingClarification: activePendingClarification(session),
  })
}
export function recordExchange(
  session: TradeSession,
  input: {
    requestId: string
    message: string
    selectedPlayerIds?: Array<number>
    selectedPickIds?: Array<number>
    pickReferences?: Array<MessagePickReference>
    playerReferences?: Array<MessagePlayerReference>
    resolvedPlayerMentions?: Array<{ query: string; playerIds: Array<number> }>
    clarificationAnswer?: ClarificationAnswer
    cancelQuestionId?: string
  },
  reply: ChatTurnResult,
  userCreatedAt = new Date().toISOString()
) {
  const savedQuestion = input.clarificationAnswer?.questionId
    ? session.records?.questions.find(
        (question) => question.id === input.clarificationAnswer!.questionId
      )?.clarification
    : undefined
  const selections =
    savedQuestion && input.clarificationAnswer
      ? resolveClarificationAnswer(
          savedQuestion,
          input.clarificationAnswer,
          input.message
        )
      : recordedClarificationSelections(session.messages, input)
  session.messages.push(
    {
      id: `${input.requestId}-user`,
      role: "user",
      createdAt: userCreatedAt,
      text: input.message,
      cancelQuestionId: input.cancelQuestionId,
      selectedPickIds: input.selectedPickIds,
      pickReferences: input.pickReferences,
      selectedPlayerIds: input.selectedPlayerIds,
      playerReferences: input.playerReferences,
      resolvedPlayerMentions: input.resolvedPlayerMentions,
      selections: selections ? structuredClone(selections) : undefined,
    },
    {
      id: `${input.requestId}-assistant`,
      role: "assistant",
      createdAt: new Date().toISOString(),
      text: reply.message,
      toolCalls: reply.toolCalls,
      workDurationMs: reply.workDurationMs,
      snapshots: reply.snapshots,
      candidates: reply.candidates,
      clarification: reply.clarification,
      tone:
        reply.status === "error"
          ? "destructive"
          : reply.status === "agent_unavailable" || reply.status === "conflict"
            ? "warning"
            : undefined,
    }
  )
  // Send the actual user-visible reply, never the model's unused prose/tool logs.
  session.history.push(
    { role: "user", content: input.message },
    { role: "assistant", content: reply.message }
  )
  session.history = session.history.slice(-16)
}

/** Read the persisted conversation without changing its version. */
export const readTradeConversation = (id: string) => conversationView(load(id))
