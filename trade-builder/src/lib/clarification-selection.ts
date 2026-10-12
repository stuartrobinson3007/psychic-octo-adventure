import { selectionCountValid } from "./selection-limits.ts"
import type {
  ClarificationOption,
  ClarificationAnswer,
  ConversationMessage,
  TradeClarification,
  ToolActivity,
} from "./trade/types.ts"
import { visibleToolActivities } from "./tool-activity.ts"

/** The combined backend reply stays intact; only its transcript presentation splits. */
export function clarificationSelectionText(
  text: string,
  option: ClarificationOption | Array<ClarificationOption>
): string | undefined {
  const value = (Array.isArray(option) ? option : [option])
    .map((item) => item.value)
    .join(", ")
  if (text === value) return ""
  const prefix = `${value}\n\n`
  return text.startsWith(prefix) ? text.slice(prefix.length) : undefined
}

/** Resolve and validate only canonical choices from the saved question. */
export function resolveClarificationAnswer(
  question: TradeClarification | null | undefined,
  answer: ClarificationAnswer,
  message: string
): Array<ClarificationOption> | undefined {
  if (!question || (answer.questionId && answer.questionId !== question.id))
    return undefined
  const ids = answer.optionIds ?? [answer.optionId]
  const limits = question.selectionLimits ?? { min: 1, max: 1 }
  if (
    !selectionCountValid(ids.length, limits) ||
    new Set(ids).size !== ids.length
  )
    return undefined
  const options = ids.map((id) =>
    question.options.find((option) => option.id === id)
  )
  if (options.some((option) => !option)) return undefined
  const choices = options as Array<ClarificationOption>
  const text = clarificationSelectionText(message, choices)
  return text === (answer.text.trim() ? answer.text : "") ? choices : undefined
}

export function recordedClarificationSelections(
  messages: Array<ConversationMessage>,
  input: { message: string; clarificationAnswer?: ClarificationAnswer }
): Array<ClarificationOption> | undefined {
  if (!input.clarificationAnswer) return undefined
  const question = [...messages]
    .reverse()
    .find(
      (message) => message.role === "assistant" && !message.tone
    )?.clarification
  const choices = resolveClarificationAnswer(
    question,
    input.clarificationAnswer,
    input.message
  )
  return choices ? structuredClone(choices) : undefined
}

/** Legacy callers can read a single-choice receipt. */
export function recordedClarificationSelection(
  messages: Array<ConversationMessage>,
  input: { message: string; clarificationAnswer?: ClarificationAnswer }
): ClarificationOption | undefined {
  const choices = recordedClarificationSelections(messages, input)
  return choices?.length === 1 ? choices[0] : undefined
}

export function clarificationSelections(entry: {
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
}) {
  return entry.selections ?? (entry.selection ? [entry.selection] : [])
}

interface TranscriptEntry {
  id?: string
  cancelQuestionId?: string
  role: "user" | "assistant"
  text: string
  tone?: "warning" | "destructive"
  clarification?: TradeClarification
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
  selectedPlayerIds?: Array<number>
  playerReferences?: Array<{ playerId: number; start: number; end: number }>
}

/** Only recorded choices become selection receipts; typed replies stay text. */
export function clarificationTranscriptEntries<T extends TranscriptEntry>(
  entries: Array<T>
): Array<T> {
  return entries.map((entry) => {
    if (entry.role === "assistant") return entry
    const options = clarificationSelections(entry)
    const text = options.length
      ? clarificationSelectionText(entry.text, options)
      : undefined
    if (text === undefined || !options.length) return entry
    const offset = entry.text.length - text.length
    return {
      ...entry,
      text,
      selections: options,
      playerReferences: entry.playerReferences
        ?.filter((ref) => ref.start >= offset)
        .map((ref) => ({
          ...ref,
          start: ref.start - offset,
          end: ref.end - offset,
        })),
    }
  })
}

/** Only the picker's own question moves out of the transcript while open.
 * Keep any accompanying explanation visible, including during the next turn. */
export function clarificationChatEntries<
  T extends TranscriptEntry & {
    toolCalls?: Array<ToolActivity>
    trade?: unknown
  },
>(entries: Array<T>): Array<T & { noOptionsSelected: boolean }> {
  const lastReplyIndex = entries.reduce(
    (last, entry, index) => (entry.role === "user" ? index : last),
    -1
  )
  let question: TradeClarification | undefined
  return clarificationTranscriptEntries(entries)
    .map((entry, index) => {
      if (entry.role === "assistant") {
        if (entry.clarification) question = entry.clarification
        else if (!entry.tone) question = undefined
      }
      const noOptionsSelected =
        entry.role === "user" &&
        (!!entry.cancelQuestionId ||
          (!!(question?.options.length || question?.tradeSearch) &&
            !clarificationSelections(entry).length))
      if (entry.role === "user") question = undefined
      const previous = index > 0 ? entries[index - 1] : undefined
      const cancellationConfirmation =
        entry.role === "assistant" &&
        !entry.tone &&
        entry.text === "Cancelled." &&
        previous?.role === "user" &&
        previous.cancelQuestionId &&
        previous.id &&
        entry.id === previous.id.replace(/-user$/, "-assistant")
      return {
        ...entry,
        noOptionsSelected,
        text: entry.cancelQuestionId
          ? ""
          : entry.role === "assistant" && entry.clarification
            ? (entry.clarification.options.length ||
                entry.clarification.tradeSearch) &&
              index > lastReplyIndex &&
              entry.text === entry.clarification.question
              ? ""
              : entry.text || entry.clarification.question
            : cancellationConfirmation
              ? ""
              : entry.text,
        toolCalls: visibleToolActivities(entry.toolCalls),
      }
    })
    .filter(
      (entry) =>
        entry.text ||
        entry.noOptionsSelected ||
        clarificationSelections(entry).length ||
        entry.trade ||
        entry.toolCalls.length
    )
}
