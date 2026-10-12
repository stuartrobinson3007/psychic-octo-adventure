import { TradeDomainError } from "./trade-errors.ts"
import { Schema } from "effect"
import { ChatTurnInputSchema } from "../lib/trade/schemas.ts"
import { browseIdeas } from "./trade-ideas.ts"
import { lookupRecord, records, searchKey } from "./conversation-records.ts"
import { executeSearch } from "./conversation-search.ts"
import { checkUncheckedProposals } from "./conversation-checks.ts"
import { parseMessagePickReferences } from "../lib/message-pick-references.ts"
import { parseArchivedProposal, parseArchivedWork } from "./proposal-archive.ts"
import { parseMessagePlayerReferences } from "../lib/message-player-references.ts"
import { recheckTradeVersion } from "./trade-recheck"
import { createServerFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { TradeServiceRequestError } from "./trade-service-http"
import type {
  ChatTurnInput,
  ChatTurnResult,
  CheckTradeInput,
  TradeSnapshot,
  CatalogueResult,
  ConversationView,
  ConversationMessage,
  TradeReference,
} from "../lib/trade/types"
import {
  CatalogueError,
  loadCatalogue,
  number,
  object,
  string,
} from "./trade-api"
import {
  getSession,
  rememberReply,
  rememberSnapshot,
  withSessionLock,
  conversationView,
  findProposal,
  activePendingClarification,
  recordExchange,
} from "./trade-session"

function withRequestSessionLock<TValue>(
  id: string,
  operation: Parameters<typeof withSessionLock<TValue>>[1]
) {
  return withSessionLock(id, operation, 60_000, getRequest().signal)
}

function identifier(value: unknown): string {
  const id = string(value)
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id))
    throw new TradeDomainError("Invalid session or request identifier.")
  return id
}

function integer(value: unknown): number {
  const id = number(value)
  if (!Number.isSafeInteger(id) || id < 0)
    throw new TradeDomainError("Invalid trade identifier.")
  return id
}

function ids(value: unknown, limit: number): Array<number> {
  if (!Array.isArray(value) || value.length > limit)
    throw new TradeDomainError("Invalid trade selection.")
  return value.map(integer)
}

function parseTradeCheck(value: unknown): CheckTradeInput {
  const raw = object(value)
  return {
    sessionId: identifier(raw.sessionId),
    requestId: identifier(raw.requestId),
    expectedConversationVersion: integer(raw.expectedConversationVersion),
    reference: parseReference(raw.reference),
  }
}

function parseClarificationAnswer(value: unknown): {
  optionIds: string[]
  questionId?: string
  text: string
} {
  const raw = object(value)
  const optionIds =
    raw.optionIds === undefined
      ? [string(raw.optionId)]
      : Array.isArray(raw.optionIds)
        ? raw.optionIds.map(string)
        : []
  const text = string(raw.text)
  const questionId =
    raw.questionId === undefined ? undefined : identifier(raw.questionId)
  if (
    !optionIds.length ||
    optionIds.length > 30 ||
    new Set(optionIds).size !== optionIds.length ||
    optionIds.some((id) => !id || id.length > 200) ||
    text.length > 8_000 ||
    (raw.optionIds !== undefined && raw.optionId !== undefined)
  )
    throw new TradeDomainError("Invalid clarification answer.")
  return { optionIds, questionId, text }
}

export function parseChatTurn(value: unknown): ChatTurnInput {
  const raw = Schema.decodeUnknownSync(ChatTurnInputSchema)(value)
  const message = string(raw.message)
  if (!message.trim() || message.length > 8_000)
    throw new TradeDomainError("Enter a message of up to 8,000 characters.")
  if (
    raw.cancelQuestionId !== undefined &&
    raw.clarificationAnswer !== undefined
  )
    throw new TradeDomainError(
      "A question cannot be answered and cancelled together."
    )
  const selectedPlayerIds =
    raw.selectedPlayerIds === undefined
      ? undefined
      : ids(raw.selectedPlayerIds, 30)
  const selectedPickIds =
    raw.selectedPickIds === undefined ? undefined : ids(raw.selectedPickIds, 30)
  const playerReferences = parseMessagePlayerReferences(
    raw.playerReferences,
    message,
    selectedPlayerIds
  )
  return {
    selectedPickIds,
    pickReferences: parseMessagePickReferences(
      raw.pickReferences,
      message,
      selectedPickIds,
      playerReferences
    ),
    sessionId: identifier(raw.sessionId),
    requestId: identifier(raw.requestId),
    message,
    cancelQuestionId:
      raw.cancelQuestionId === undefined
        ? undefined
        : identifier(raw.cancelQuestionId),
    selectedPlayerIds,
    playerReferences,
    clarificationAnswer:
      raw.clarificationAnswer === undefined
        ? undefined
        : parseClarificationAnswer(raw.clarificationAnswer),
    expectedRevision:
      raw.expectedRevision === undefined
        ? undefined
        : integer(raw.expectedRevision),
    expectedConversationVersion:
      raw.expectedConversationVersion === undefined
        ? undefined
        : integer(raw.expectedConversationVersion),
    reference:
      raw.reference === undefined ? undefined : parseReference(raw.reference),
  }
}

function parseReference(value: unknown): TradeReference {
  const raw = object(value)
  return {
    proposalId: identifier(raw.proposalId),
    revision: integer(raw.revision),
  }
}

export const getTradeIdeas = createServerFn({ method: "GET" })
  .validator((value: unknown) => {
    const raw = object(value)
    const query = string(raw.query)
    if (query.length > 200)
      throw new TradeDomainError("Search using up to 200 characters.")
    return {
      sessionId: identifier(raw.sessionId),
      searchReference: string(raw.searchReference),
      cursor: integer(raw.cursor),
      query,
    }
  })
  .handler(({ data }) => {
    const session = getSession(data.sessionId)
    const record = lookupRecord(session, data.searchReference)
    if (record?.type !== "search")
      throw new TradeDomainError("This search is unavailable. Run it again.")
    return browseIdeas(record.value, data.cursor, data.query)
  })

/** Restart the saved scope against current data, without a model call. */
export const refreshTradeSearch = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const raw = object(value)
    const query = string(raw.query)
    if (query.length > 200)
      throw new TradeDomainError("Search using up to 200 characters.")
    return {
      sessionId: identifier(raw.sessionId),
      requestId: identifier(raw.requestId),
      expectedConversationVersion: integer(raw.expectedConversationVersion),
      searchReference: string(raw.searchReference),
      query,
    }
  })
  .handler(({ data }): Promise<ConversationView> =>
    withRequestSessionLock(data.sessionId, async (signal) => {
      const session = getSession(data.sessionId)
      if (session.replies.has(data.requestId)) return conversationView(session)
      if (session.version !== data.expectedConversationVersion)
        throw new TradeDomainError(
          "The conversation changed. Reload it before refreshing this search."
        )
      const pending = activePendingClarification(session)
      if (pending?.tradeSearch?.reference !== data.searchReference)
        throw new TradeDomainError(
          "This search is no longer waiting for a selection."
        )
      const found = lookupRecord(session, data.searchReference)
      if (found?.type !== "search")
        throw new TradeDomainError("This search is unavailable.")
      const catalogue = await loadCatalogue(true, signal)
      const working = structuredClone(session)
      const state = records(working)
      const search = {
        ...structuredClone(found.value),
        revision:
          Math.max(
            ...state.searches
              .filter((item) => item.id === found.value.id)
              .map((item) => item.revision)
          ) + 1,
        createdAt: new Date().toISOString(),
        catalogue: undefined,
        catalogueId: undefined,
        expiresAt: undefined,
        pageCursor: undefined,
        messageId: `${data.requestId}-assistant`,
      }
      state.searches.push(search)
      const result = executeSearch({
        session: working,
        search,
        catalogue,
        signal,
        introduction: "Search refreshed with current player data.",
        query: data.query,
      })
      const previous = state.questions.find((item) => item.id === pending.id)
      if (previous) previous.status = "cancelled"
      state.discussion.push({
        reference: searchKey(search),
        messageId: search.messageId,
      })
      session.records = working.records
      const clarification =
        "clarification" in result ? result.clarification : undefined
      const reply: ChatTurnResult = {
        status: clarification ? "needs_clarification" : "complete",
        message: result.message,
        snapshot: session.snapshot,
        snapshots: [],
        changes: [],
        clarification,
        conversationVersion: session.version + 1,
      }
      recordExchange(
        session,
        { requestId: data.requestId, message: "Refresh this search." },
        reply
      )
      rememberReply(session, data.requestId, reply)
      return { ...conversationView(session), version: session.version + 1 }
    })
  )

export const getTradeConversation = createServerFn({ method: "GET" })
  .validator((value: unknown) => ({
    sessionId: identifier(object(value).sessionId),
  }))
  .handler(async ({ data }): Promise<ConversationView> =>
    withRequestSessionLock(data.sessionId, async (signal) => {
      const session = getSession(data.sessionId)
      const changed = await checkUncheckedProposals(session, signal)
      return {
        ...conversationView(session),
        version: session.version + (changed ? 1 : 0),
      }
    })
  )

/** One-time browser/review import. Client-supplied verdicts never become trusted state. */
export const importTradeConversation = createServerFn({ method: "POST" })
  .validator((value: unknown) => {
    const raw = object(value)
    if (!Array.isArray(raw.messages) || raw.messages.length > 300)
      throw new TradeDomainError("Invalid conversation archive.")
    const messages: Array<ConversationMessage> = raw.messages.map(
      (rawMessage) => {
        const entry = object(rawMessage)
        if (entry.role !== "user" && entry.role !== "assistant")
          throw new TradeDomainError("Invalid message role.")
        const text = string(entry.text)
        if (text.length > 8_000)
          throw new TradeDomainError("Message is too long.")
        const selectedPlayerIds =
          entry.selectedPlayerIds === undefined
            ? undefined
            : ids(entry.selectedPlayerIds, 30)
        const selectedPickIds =
          entry.selectedPickIds === undefined
            ? undefined
            : ids(entry.selectedPickIds, 30)
        const playerReferences = parseMessagePlayerReferences(
          entry.playerReferences,
          text,
          selectedPlayerIds
        )
        const snapshots = (
          values: unknown
        ): Array<TradeSnapshot> | undefined => {
          if (values === undefined) return undefined
          if (!Array.isArray(values) || values.length > 20)
            throw new TradeDomainError("Invalid archived proposals.")
          return values.map((rawSnapshot) => ({
            proposal: parseArchivedProposal(object(rawSnapshot).proposal),
            verdict: null,
          }))
        }
        return {
          id: crypto.randomUUID(),
          role: entry.role,
          createdAt:
            typeof entry.createdAt === "string" &&
            Number.isFinite(Date.parse(entry.createdAt))
              ? new Date(entry.createdAt).toISOString()
              : undefined,
          text,
          cancelQuestionId:
            entry.cancelQuestionId === undefined
              ? undefined
              : identifier(entry.cancelQuestionId),
          ...parseArchivedWork(entry),
          selectedPlayerIds,
          selectedPickIds,
          pickReferences: parseMessagePickReferences(
            entry.pickReferences,
            text,
            selectedPickIds,
            playerReferences
          ),
          playerReferences,
          snapshots: snapshots(entry.snapshots),
          candidates: snapshots(entry.candidates),
        }
      }
    )
    return {
      sessionId: identifier(raw.sessionId),
      messages,
      focus: raw.focus == null ? null : parseReference(raw.focus),
    }
  })
  .handler(async ({ data }): Promise<ConversationView> =>
    withRequestSessionLock(data.sessionId, async (signal) => {
      const session = getSession(data.sessionId)
      if (
        session.messages.length ||
        session.revisions.length ||
        session.replies.size
      )
        return conversationView(session)
      session.messages = data.messages
      for (const message of data.messages) {
        session.revisions.push(...(message.snapshots ?? []))
        session.candidates.push(...(message.candidates ?? []))
      }
      session.history = session.messages
        .slice(-16)
        .map((message) => ({ role: message.role, content: message.text }))
      if (data.focus) {
        const source = findProposal(session, data.focus)
        if (!source)
          throw new TradeDomainError(
            "Choose a proposal from this conversation."
          )
        session.snapshot = structuredClone(source)
      }
      await checkUncheckedProposals(session, signal)
      return { ...conversationView(session), version: session.version + 1 }
    })
  )

export const getTradeCatalogue = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogueResult> => {
    const signal = getRequest().signal
    try {
      return {
        status: "available",
        catalogue: await loadCatalogue(false, signal),
      }
    } catch (cause) {
      signal.throwIfAborted()
      if (!(
        cause instanceof CatalogueError ||
        cause instanceof TradeServiceRequestError
      ))
        throw cause
      return {
        status: "unavailable",
        catalogue: null,
        message: "Player data could not be refreshed. Try again shortly.",
      }
    }
  }
)

export const checkTradeVersion = createServerFn({ method: "POST" })
  .validator(parseTradeCheck)
  .handler(async ({ data }): Promise<TradeSnapshot> => {
    return withRequestSessionLock(data.sessionId, async (signal) => {
      const session = getSession(data.sessionId)
      const previous = session.replies.get(data.requestId)?.snapshot
      if (previous) return previous
      if (data.expectedConversationVersion !== session.version)
        throw new TradeDomainError(
          "The conversation changed. Retry with the current version."
        )
      const catalogue = await loadCatalogue(false, signal)
      const receivedAt = new Date().toISOString()
      const snapshot = await recheckTradeVersion(
        session,
        data.reference,
        catalogue,
        undefined,
        signal
      )
      if (snapshot.verdict.status !== "invalid_proposal") {
        rememberSnapshot(session, snapshot)
        const reply: ChatTurnResult = {
          status: "complete",
          message: snapshot.verdict.summary,
          snapshot,
          changes: [],
          snapshots: [snapshot],
          conversationVersion: session.version + 1,
        }
        recordExchange(
          session,
          { requestId: data.requestId, message: "Check this trade." },
          reply,
          receivedAt
        )
        rememberReply(session, data.requestId, reply)
      }
      return snapshot
    })
  })

export const refreshTradeCatalogue = createServerFn({ method: "POST" }).handler(
  async (): Promise<CatalogueResult> => {
    const signal = getRequest().signal
    try {
      return {
        status: "available",
        catalogue: await loadCatalogue(true, signal),
      }
    } catch (cause) {
      signal.throwIfAborted()
      if (!(
        cause instanceof CatalogueError ||
        cause instanceof TradeServiceRequestError
      ))
        throw cause
      return {
        status: "unavailable",
        catalogue: null,
        message: "Trade data could not be refreshed.",
      }
    }
  }
)
