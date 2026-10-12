import type { MessagePickReference } from "./message-pick-references.ts"
import type {
  ConversationMessage,
  TradeSnapshot,
  ToolActivity,
} from "./trade/types.ts"
import {
  cardResponseSummary,
  tradeResponseCopy,
} from "./trade-response-copy.ts"
import type { MessagePlayerReference } from "./message-player-references.ts"

export function conversationEntries(messages: Array<ConversationMessage>) {
  return messages.flatMap((message) => {
    const { snapshots, candidates, ...entry } = message
    const base = {
      ...entry,
      sourceMessageId: message.id,
      text:
        entry.role === "assistant"
          ? tradeResponseCopy(entry.text).trim() ||
            cardResponseSummary([...(snapshots ?? []), ...(candidates ?? [])])
          : entry.text,
    }
    if (candidates !== undefined)
      return [
        base,
        ...(snapshots ?? []).map((snapshot, index) => ({
          id: `${entry.id}-trade-${index}`,
          sourceMessageId: message.id,
          role: "assistant" as const,
          createdAt: entry.createdAt,
          text: "",
          snapshot,
        })),
        ...candidates.map((snapshot, index) => ({
          id: `${entry.id}-candidate-${index}`,
          sourceMessageId: message.id,
          role: "assistant" as const,
          createdAt: entry.createdAt,
          text: "",
          snapshot,
          isCandidate: true,
        })),
      ]
    if (snapshots?.length)
      return snapshots.map((snapshot, index) => ({
        ...base,
        id: `${entry.id}-trade-${index}`,
        text: index === 0 ? base.text : "",
        toolCalls: index === 0 ? base.toolCalls : undefined,
        workDurationMs: index === 0 ? base.workDurationMs : undefined,
        snapshot,
      }))
    return [base]
  }) as Array<
    Omit<ConversationMessage, "snapshots" | "candidates"> & {
      sourceMessageId: string
      snapshot?: TradeSnapshot
      isCandidate?: boolean
    }
  >
}

export function archiveMessages(
  entries: Array<{
    sourceMessageId?: string
    id: string
    role: "user" | "assistant"
    text: string
    createdAt?: string
    cancelQuestionId?: string
    toolCalls?: Array<ToolActivity>
    workDurationMs?: number
    selectedPlayerIds?: Array<number>
    selectedPickIds?: Array<number>
    pickReferences?: Array<MessagePickReference>
    playerReferences?: Array<MessagePlayerReference>
    trade?: { snapshot: TradeSnapshot }
    isCandidate?: boolean
  }>
): Array<ConversationMessage> {
  // Keep a multi-card reply together when restoring browser-stored history.
  const messages = new Map<string, ConversationMessage>()
  for (const entry of entries) {
    const id = entry.sourceMessageId ?? entry.id
    let message = messages.get(id)
    if (!message) {
      message = {
        id,
        role: entry.role,
        text: entry.text,
        createdAt: entry.createdAt,
        cancelQuestionId: entry.cancelQuestionId,
        toolCalls: entry.toolCalls,
        workDurationMs: entry.workDurationMs,
        selectedPickIds: entry.selectedPickIds,
        pickReferences: entry.pickReferences,
        selectedPlayerIds: entry.selectedPlayerIds,
        playerReferences: entry.playerReferences,
      }
      messages.set(id, message)
    }
    if (entry.trade) {
      const field = entry.isCandidate ? "candidates" : "snapshots"
      const cards = message[field] ?? []
      cards.push(entry.trade.snapshot)
      message[field] = cards
    }
  }
  return [...messages.values()]
}
