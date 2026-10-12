import { resolveIdeaReference } from "./trade-ideas.ts"
import { transactionStatus } from "../lib/trade/signings.ts"
import type {
  Catalogue,
  TradeClarification,
  TradeReference,
  TradeSnapshot,
  TradeProposal,
} from "../lib/trade/types.ts"
import type { TradeSearchRequest } from "./trade-discovery.ts"
import type { TradeRepairRequest } from "./trade-repair.ts"
import type { TradeSession } from "./trade-session.ts"
import { assetLabel } from "../lib/trade/picks.ts"
import { scenarioDescriptions } from "../lib/trade/scenario.ts"

export type SearchSpecification =
  | { kind: "discovery"; request: TradeSearchRequest }
  | {
      kind: "repair" | "replacement"
      proposal: TradeReference
      request: Omit<TradeRepairRequest, "snapshot">
    }

export interface SearchRecord {
  catalogueId?: string
  expiresAt?: string
  catalogue?: Catalogue
  base?: TradeSnapshot
  createdAt?: string
  browseOrder?: "canonical" | "varied"
  pageCursor?: number
  id: string
  revision: number
  goal: string
  specification: SearchSpecification
  messageId: string
}
export interface ResultBatch {
  id: string
  search: string | null
  proposals: TradeReference[]
  messageId: string
}
export interface QuestionRecord {
  choices?: { label: string; value?: string; reference: string | null }[]
  id: string
  clarification: TradeClarification
  originalMessage: string
  context: string
  references: string[]
  status: "open" | "answered" | "cancelled"
  messageId: string
}
export interface ExecutionRecord {
  turnStatus?: "in_progress" | "completed" | "failed"
  id: string
  messageId: string
  operation: string
  references: string[]
  arguments: unknown
  outcome: unknown
}
export interface ConversationRecords {
  schema: 1
  searches: SearchRecord[]
  batches: ResultBatch[]
  questions: QuestionRecord[]
  executions: ExecutionRecord[]
  discussion: { reference: string; messageId: string }[]
}
export const proposalKey = (reference: TradeReference) =>
  `proposal:${reference.proposalId}@${reference.revision}`
export const searchKey = (record: Pick<SearchRecord, "id" | "revision">) =>
  `search:${record.id}@${record.revision}`
export const batchKey = (record: Pick<ResultBatch, "id">) =>
  `batch:${record.id}`
export const questionKey = (record: Pick<QuestionRecord, "id">) =>
  `question:${record.id}`

/** Store evidence once; retrieval must not recursively duplicate earlier records. */
export function executionEvidence(operation: string, output: unknown): unknown {
  if (output === null || typeof output !== "object") return output
  if ("error" in output) return output
  if (operation === "read_records" && Array.isArray(output))
    return output.map((item) => ({
      reference: item.reference,
      type: item.type,
    }))
  if (operation === "recall_conversation") return { retrieved: true }
  const value = output as Record<string, unknown>
  if (operation === "find_options" || operation === "browse_options")
    return {
      status: value.status,
      message: value.message,
      details: value.details,
      searchReference: value.searchReference,
      batchReference: value.batchReference,
      candidates: Array.isArray(value.candidates)
        ? value.candidates.map((item) => item.reference)
        : [],
    }
  if (operation === "check_proposal")
    return {
      reference: value.reference,
      kind: value.kind,
      relatedTrade: value.relatedTrade,
      assets: value.assets,
      assumptions: value.assumptions,
      status: value.status,
    }
  if (operation === "read_team_assets" && Array.isArray(output))
    return output.map((item) => ({
      teamId: item.team.id,
      totalSalary: item.team.totalSalary,
      cap: item.cap,
      playerIds: item.players?.map((player: { id: number }) => player.id),
      pickIds: item.picks?.map((pick: { id: number }) => pick.id),
      rightIds: item.draftRights?.map((right: { id: number }) => right.id),
      exceptions: item.exceptions,
    }))
  return output
}

/** Backfill only observable links. Legacy search scope cannot be inferred from cards. */
export function records(session: TradeSession): ConversationRecords {
  session.records ??= {
    schema: 1,
    searches: [],
    batches: [],
    questions: [],
    executions: [],
    discussion: [],
  }
  const state = session.records
  const lastReplyIndex = session.messages.reduce(
    (last, message, index) => (message.role === "user" ? index : last),
    -1
  )
  for (const [messageIndex, message] of session.messages.entries()) {
    if (
      message.candidates?.length &&
      !state.batches.some((batch) => batch.messageId === message.id)
    )
      state.batches.push({
        id: message.id,
        search: null,
        messageId: message.id,
        proposals: message.candidates.map((item) => ({
          proposalId: item.proposal.proposalId,
          revision: item.proposal.revision,
        })),
      })
    if (
      message.clarification &&
      !state.questions.some((question) => question.messageId === message.id)
    ) {
      const id = message.clarification.id ?? message.id
      state.questions.push({
        id,
        clarification: { ...message.clarification, id },
        originalMessage: session.messages[messageIndex - 1]?.text ?? "",
        context:
          "Retained question; use its originating messages to reconstruct the request.",
        references: [],
        status: messageIndex < lastReplyIndex ? "answered" : "open",
        messageId: message.id,
      })
    }
  }
  return state
}

/** Retain legacy facts as records, never as executable routing instructions. */
export function migrateConversationRecords(
  session: TradeSession,
  pending: unknown,
  discovery: unknown
) {
  const state = records(session)
  if (pending && typeof pending === "object") {
    const old = pending as {
      messages?: string[]
      proposal?: TradeProposal
      baseReference?: TradeReference
      resolvedPlayerIds?: number[]
      resolvedPickIds?: number[]
      resolvedRightIds?: number[]
      clarification?: TradeClarification
    }
    const question = [...state.questions]
      .reverse()
      .find((item) =>
        old.clarification?.id
          ? item.id === old.clarification.id
          : item.clarification.question === old.clarification?.question
      )
    if (question) {
      question.status = "open"
      question.context = JSON.stringify({
        originalMessages: old.messages,
        draft: old.proposal,
        baseReference: old.baseReference,
        resolvedPlayerIds: old.resolvedPlayerIds,
        resolvedPickIds: old.resolvedPickIds,
        resolvedRightIds: old.resolvedRightIds,
      })
      if (old.baseReference)
        question.references = [proposalKey(old.baseReference)]
    }
  }
  if (discovery && typeof discovery === "object") {
    const old = discovery as {
      message?: string
      request?: TradeSearchRequest
    }
    if (old.request && !state.searches.length)
      state.searches.push({
        id: crypto.randomUUID(),
        revision: 1,
        goal: old.message ?? "Earlier saved search",
        specification: { kind: "discovery", request: old.request },
        messageId: "legacy-saved-search",
      })
  }
}
export function proposalRecords(session: TradeSession): TradeSnapshot[] {
  const unique = new Map<string, TradeSnapshot>()
  for (const item of [
    ...session.candidates,
    ...(session.snapshot ? [session.snapshot] : []),
    ...session.revisions,
  ])
    unique.set(proposalKey(item.proposal), item)
  return [...unique.values()]
}
export function lookupRecord(session: TradeSession, key: string) {
  const state = records(session)
  const proposal = proposalRecords(session).find(
    (item) => proposalKey(item.proposal) === key
  )
  if (proposal) return { type: "proposal" as const, value: proposal }
  const idea = resolveIdeaReference(session, key)
  if (idea) return { type: "proposal" as const, value: idea }
  const search = state.searches.find((item) => searchKey(item) === key)
  if (search) return { type: "search" as const, value: search }
  const batch = state.batches.find((item) => batchKey(item) === key)
  if (batch) return { type: "batch" as const, value: batch }
  const question = state.questions.find((item) => questionKey(item) === key)
  if (question) return { type: "question" as const, value: question }
  const execution = state.executions.find((item) => item.id === key)
  if (execution) return { type: "execution" as const, value: execution }
  return null
}
export function proposalDescription(
  snapshot: TradeSnapshot,
  catalogue: Catalogue
) {
  return {
    reference: proposalKey(snapshot.proposal),
    kind: snapshot.proposal.kind ?? "trade",
    parent: snapshot.proposal.parent
      ? proposalKey(snapshot.proposal.parent)
      : null,
    relatedTrade: snapshot.proposal.relatedTrade
      ? proposalKey(snapshot.proposal.relatedTrade)
      : null,
    teams: snapshot.proposal.teamIds.map(
      (id) => catalogue.teams.find((team) => team.id === id)?.abbreviation ?? id
    ),
    assets: snapshot.proposal.transfers.map((item) => ({
      asset: assetLabel(item, catalogue),
      ...item,
    })),
    assumptions: scenarioDescriptions(snapshot.proposal, catalogue),
    status: transactionStatus(snapshot) ?? "unchecked",
    limitations:
      snapshot.verdict?.limitations ??
      (transactionStatus(snapshot) === "validation_incomplete"
        ? [
            "Complete signing eligibility is not established by this saved result.",
          ]
        : []),
  }
}
export function contextIndex(
  session: TradeSession,
  catalogue: Catalogue,
  limit = 40
) {
  const state = records(session)
  const messageOffsets = new Map<string, number>()
  const batches = state.batches.map((item) => {
    const offset =
      messageOffsets.get(item.messageId) ??
      session.messages.find((message) => message.id === item.messageId)
        ?.snapshots?.length ??
      0
    messageOffsets.set(item.messageId, offset + item.proposals.length)
    return {
      reference: batchKey(item),
      search: item.search,
      messageId: item.messageId,
      options: item.proposals.map((reference, index) => ({
        number: index + 1,
        numberInMessage: offset + index + 1,
        reference: proposalKey(reference),
      })),
    }
  })
  return {
    discussion: state.discussion.slice(-12),
    proposals: proposalRecords(session)
      .slice(-limit)
      .map((item) => proposalDescription(item, catalogue)),
    searches: state.searches.slice(-limit).map((item) => ({
      reference: searchKey(item),
      goal: item.goal,
      specification: item.specification,
      messageId: item.messageId,

      shown: item.pageCursor ?? 0,
    })),
    batches: batches.slice(-limit),
    questions: state.questions
      .filter((item) => item.status === "open")
      .slice(-8),
    outcomes: state.executions.slice(-8),
    recentConversation: session.messages.slice(-12).map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      selections:
        message.selections ?? (message.selection ? [message.selection] : []),
      resolvedPlayerMentions: message.resolvedPlayerMentions,
      clarification: message.clarification,
      cards: [...(message.snapshots ?? []), ...(message.candidates ?? [])].map(
        (item) => proposalKey(item.proposal)
      ),
    })),
  }
}
export function discuss(
  session: TradeSession,
  references: string[],
  messageId: string
) {
  const state = records(session)
  const verified = [...new Set([...references].reverse())]
    .reverse()
    .filter((reference) => lookupRecord(session, reference))
  state.discussion = [
    ...state.discussion.filter((item) => !verified.includes(item.reference)),
    ...verified.map((reference) => ({ reference, messageId })),
  ].slice(-20)
}
