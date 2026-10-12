import type { ClarificationOption } from "./trade/types"
import { reviewInput } from "./ux-review/model.ts"
import type { ReviewScenario } from "./ux-review/model"
import { presentTeamThenPlayers } from "./chat-presentation-multi-team.ts"

const answerKey = (text: string) =>
  text
    .trim()
    .replace(/[.!?]+$/u, "")
    .trim()
    .toLowerCase()

// These recordings name an offered choice in prose. Present the same choice
// using its control, retaining the recorded result and original source data.
const authoredChoices: Partial<
  Record<string, Readonly<Partial<Record<number, string>>>>
> = {
  "repair-additions": {
    2: "Pelle Larsson + Andrew Wiggins for Derrick White",
  },
  "trade-exception-clarification": {
    2: "Anfernee Simons — $27.68 million",
  },
}

/** Author the requested option-click path for presentations only.
 * Original review recordings remain unchanged; only a complete answer matching
 * one canonical offered option, or an explicitly authored choice above, becomes
 * a selection. Extra instructions stay text.
 */
export function presentOptionSelections(
  scenario: ReviewScenario
): ReviewScenario {
  if (scenario.source !== "recorded") return scenario
  scenario = presentTeamThenPlayers(scenario)
  const answers = new Map<
    string,
    { text: string; selections: ClarificationOption[] }
  >()
  const turns = scenario.turns.map((turn, index) => {
    const previous = index > 0 ? scenario.turns[index - 1].result : undefined
    const question =
      previous?.pendingClarification ??
      (previous?.status === "needs_clarification"
        ? previous.clarification
        : undefined)
    const user = [...(turn.conversation?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "user")
    const alreadySelected =
      turn.selection ||
      turn.selections?.length ||
      user?.selection ||
      user?.selections?.length
    const choiceText = authoredChoices[scenario.id]?.[index] ?? turn.input
    const matches =
      !alreadySelected && !user?.cancelQuestionId
        ? (question?.options.filter(
            (option) => answerKey(option.value) === answerKey(choiceText)
          ) ?? [])
        : []
    const choice = matches.length === 1 ? matches[0] : undefined
    const answer = choice
      ? { text: choice.value, selections: [choice] }
      : undefined
    if (answer && user) answers.set(user.id, answer)
    const conversation =
      turn.conversation && answers.size
        ? {
            ...turn.conversation,
            messages: turn.conversation.messages.map((message) => {
              const selected = answers.get(message.id)
              return selected ? { ...message, ...selected } : message
            }),
          }
        : turn.conversation
    if (!answer && conversation === turn.conversation) return turn
    return {
      ...turn,
      ...(answer ? { input: answer.text, selections: answer.selections } : {}),
      conversation,
    }
  })
  return turns.every((turn, index) => turn === scenario.turns[index])
    ? scenario
    : { ...scenario, turns }
}

/** Show replies, option selections, and the requested multi-team badge draft. */
export function presentationCheckpoints(recorded: ReviewScenario) {
  const scenario = presentOptionSelections(recorded)
  return scenario.turns.flatMap((turn, step) => [
    ...(step > 0 &&
    (reviewInput(turn).selections.length ||
      (scenario.id === "multi-choice:-three-teams-and-compound-reply" &&
        reviewInput(turn).playerReferences?.length))
      ? [{ step, phase: "input" as const }]
      : []),
    { step, phase: "response" as const },
  ])
}
