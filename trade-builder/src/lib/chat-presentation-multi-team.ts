import { clarificationSelectionText } from "./clarification-selection.ts"
import type { ConversationMessage, TradeClarification } from "./trade/types"
import type { ReviewScenario, ReviewTurn } from "./ux-review/model"

/** Split the recorded combined answer into teams, then the existing badge composer.
 * Only the intermediate question is authored; checked trade results stay intact.
 */
export function presentTeamThenPlayers(
  scenario: ReviewScenario
): ReviewScenario {
  if (
    scenario.id !== "multi-choice:-three-teams-and-compound-reply" ||
    scenario.turns.length !== 3
  )
    return scenario
  const [opening, combined, following] = scenario.turns
  const initial = opening.conversation
  const user = [...(combined.conversation?.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user")
  if (!initial || !user?.selections?.length) return scenario
  const text = clarificationSelectionText(combined.input, user.selections)
  if (!text) return scenario
  const playerReferences = (user.resolvedPlayerMentions ?? []).flatMap(
    (mention) => {
      const start = text.indexOf(mention.query)
      return mention.playerIds.length === 1 && start >= 0
        ? [
            {
              start,
              end: start + mention.query.length,
              playerId: mention.playerIds[0],
            },
          ]
        : []
    }
  )
  const teams: ConversationMessage = {
    ...user,
    id: `${user.id}-teams`,
    text: user.selections.map((option) => option.value).join(", "),
    selectedPlayerIds: [],
    playerReferences: undefined,
    resolvedPlayerMentions: undefined,
  }
  const clarification: TradeClarification = {
    id: `${user.id}-players-question`,
    purpose: "other",
    question: "Which players should be in the trade?",
    options: [],
  }
  const question: ConversationMessage = {
    id: clarification.id!,
    role: "assistant",
    text: clarification.question,
    createdAt: user.createdAt,
    clarification,
  }
  const players: ConversationMessage = {
    ...user,
    text,
    selections: undefined,
    selection: undefined,
    selectedPlayerIds: playerReferences.map((reference) => reference.playerId),
    playerReferences,
  }
  const teamTurn: ReviewTurn = {
    ...combined,
    input: teams.text,
    selections: teams.selections,
    conversation: {
      ...initial,
      messages: [...initial.messages, teams, question],
      pendingClarification: clarification,
    },
    result: {
      status: "needs_clarification",
      message: question.text,
      snapshot: initial.snapshot,
      snapshots: [],
      changes: [],
      clarification,
      pendingClarification: clarification,
    },
  }
  const withPlayerAnswer = (turn: ReviewTurn): ReviewTurn => ({
    ...turn,
    conversation: turn.conversation && {
      ...turn.conversation,
      messages: turn.conversation.messages.flatMap((message) =>
        message.id === user.id ? [teams, question, players] : [message]
      ),
    },
  })
  return {
    ...scenario,
    turns: [
      opening,
      teamTurn,
      {
        ...withPlayerAnswer(combined),
        input: text,
        selections: undefined,
        selection: undefined,
        selectedPlayerIds: players.selectedPlayerIds,
      },
      withPlayerAnswer(following),
    ],
  }
}
