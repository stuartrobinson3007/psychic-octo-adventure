import { reviewInput } from "./model.ts"
import type { ReviewPhase, ReviewScenario } from "./model.ts"

/** The brief describes intent; these labels describe the recorded UI state.
 * Never infer an outcome or a clicked choice from conversational wording. */
export function checkpointContext(
  scenario: ReviewScenario,
  step: number,
  phase: ReviewPhase
) {
  const turn = scenario.turns.at(step)
  const input = phase === "input" && turn ? reviewInput(turn) : undefined
  const action = input?.cancelQuestionId
    ? "Cancel options"
    : input?.selections.length
      ? `Select ${input.selections.length === 1 ? "an option" : `${input.selections.length} options`}${input.text !== input.selections.map((option) => option.value).join(", ") ? " and add a message" : ""}`
      : "Type a message"
  const result = turn?.result
  const question =
    result?.pendingClarification ??
    (result?.status === "needs_clarification"
      ? result.clarification
      : undefined)
  const cards = [...(result?.snapshots ?? []), ...(result?.candidates ?? [])]
  const stateLabel =
    scenario.source === "fixture"
      ? scenario.title
      : input
        ? action
        : question?.purpose === "trade_selection"
          ? "Choose trade ideas"
          : question && (question.options.length || question.tradeSearch)
            ? "Choose an answer"
            : question
              ? "Answer a question"
              : result?.status === "error" ||
                  result?.status === "agent_unavailable"
                ? "Request failed"
                : result?.status === "conflict"
                  ? "Conversation changed"
                  : cards.length
                    ? `${cards.length} result card${cards.length === 1 ? "" : "s"}`
                    : "AI response"
  return {
    stateLabel,
    action: input ? action : undefined,
    requestText: scenario.source === "recorded" ? turn?.input : undefined,
    fixtureBasis: scenario.fixture?.startsWith("ideas-")
      ? turn?.input
      : undefined,
  }
}
