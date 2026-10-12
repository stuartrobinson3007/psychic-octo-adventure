import type {
  Catalogue,
  ClarificationAnswer,
  ClarificationOption,
  TradeClarification,
  TradeSnapshot,
  Player,
} from "./trade/types"
import type { MessagePickReference } from "./message-pick-references.ts"
import type { MessagePlayerReference } from "./message-player-references.ts"

export function teamClarificationOptions(
  catalogue: Catalogue,
  teamIds = catalogue.teams.map((team) => team.id)
): Array<ClarificationOption> {
  return catalogue.teams
    .filter((team) => teamIds.includes(team.id))
    .map((team) => {
      const label = `${team.city ?? ""} ${team.name}`.trim()
      return {
        id: `team-${team.id}`,
        teamId: team.id,
        label,
        value: label,
        searchText: `${label} ${team.abbreviation}`,
      }
    })
    .sort((first, second) => first.label.localeCompare(second.label))
}

export function teamSelectionClarification(
  question: string,
  catalogue: Catalogue,
  teamIds?: Array<number>
): TradeClarification {
  const options = teamClarificationOptions(catalogue, teamIds)
  return {
    purpose: "team_selection",
    question: clarificationQuestion(question, options.length > 0),
    options,
    ...(options.length > 7
      ? {
          optionSearch: { label: "Search teams", placeholder: "Search teams…" },
        }
      : {}),
  }
}

/** Filtering is presentation only; option IDs and submitted values stay intact. */
export function filterClarificationOptions(
  options: Array<ClarificationOption>,
  query: string
) {
  const normalize = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase()
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean)
  return options.filter((option) => {
    const text = normalize(
      `${option.label} ${option.detail ?? ""} ${option.searchText ?? ""}`
    )
    return terms.every((term) => text.includes(term))
  })
}

export const clarificationQuestionInstructions =
  "Ask one missing question at a time, such as ‘Which Nick do you mean?’ or ‘Which team should receive him?’. When teams are known but players are not, ask which players to include first; destinations come after identities are known. The UI supplies concrete selectable answers when available, an editable answer and a send button. Never supply instructions or placeholders as answer choices. Do not tell users to choose, select, click, tap, list players, specify destinations, type a full name, reply below or send their answer. Never append ‘Please choose one or type the full name.’ or list the choices in the question."

/** Keep selection instructions out of questions, including older saved replies. */
export function clarificationQuestion(
  question: string,
  hasOptions: boolean
): string {
  const withoutInlineChoices = hasOptions
    ? question.replace(
        /\s*(?:please\s+)?(?:choose|select|pick)\s+one\s*:[\s\S]*$/i,
        ""
      )
    : question
  const sentences = withoutInlineChoices.split(/(?<=[.!?])\s+|\n+/)
  const kept = sentences.filter((sentence) => {
    const text = sentence.trim().replace(/^[—–-]\s*/, "")
    return !(
      /^(?:please\s+)?(?:list|specify|provide)\s+(?:(?:the|your|which)\s+)?(?:players?|teams?|destinations?|names?|answers?)\b/i.test(
        text
      ) ||
      /^(?:please\s+)?(?:choose|select|pick)\s+(?:one|either|an?\s+(?:option|answer)|from\s+(?:(?:the|these)\s+)?(?:options|choices|list))\b/i.test(
        text
      ) ||
      /^(?:please\s+)?(?:click|tap)\s+(?:on\s+)?(?:(?:an?|the)\s+)?(?:option|choice|name|player|team|answer|card)\b/i.test(
        text
      ) ||
      /^you\s+(?:can|may)\s+(?:also\s+|either\s+)?(?:choose|select|pick|click|tap|type|enter|write|reply)\b/i.test(
        text
      ) ||
      /^(?:please\s+)?(?:or\s+)?(?:type|enter|write|reply\s+with|provide)\s+(?:(?:the|a|your)\s+)?(?:full\s+name|own\s+answer|answer|reply)\b/i.test(
        text
      ) ||
      /^(?:please\s+)?reply\s+below\b/i.test(text) ||
      (/^(?:please\s+)?(?:choose|select|pick)\b/i.test(text) &&
        /\b(?:from\s+the\s+(?:list|options|choices)|or\s+(?:type|enter|write))\b/i.test(
          text
        ))
    )
  })
  if (kept.length === sentences.length && withoutInlineChoices === question)
    return question
  return kept.join(" ").trim() || "Which option do you mean?"
}

/** Count grounded identities across the whole option, including supporting copy. */
export function clarificationOptionPlayers(
  option: ClarificationOption,
  catalogue: Catalogue
): Array<Player> {
  if (option.tradeIdea) {
    const ids = new Set(
      option.tradeIdea.proposal.transfers
        .filter((t) => t.assetType === "player")
        .map((t) => t.assetId)
    )
    return [...ids].flatMap(
      (id) => catalogue.players.find((player) => player.id === id) ?? []
    )
  }
  if (option.playerId !== undefined) {
    const player = catalogue.players.find((item) => item.id === option.playerId)
    return player ? [player] : []
  }
  const ids = new Set([
    // Choice cards can identify their participants without converting their copy to badges.
    ...catalogue.players
      .flatMap((player) => {
        const escaped = player.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const name = new RegExp(
          `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
          "iu"
        )
        const match = name.exec(`${option.label}\n${option.detail ?? ""}`)
        return match ? [{ id: player.id, offset: match.index }] : []
      })
      .sort((a, b) => a.offset - b.offset)
      .map((player) => player.id),
  ])
  return [...ids].flatMap((id) => {
    const player = catalogue.players.find((item) => item.id === id)
    return player ? [player] : []
  })
}

export function playerClarificationOptions(
  playerIds: Array<number>,
  catalogue: Catalogue
): Array<ClarificationOption> {
  return [...new Set(playerIds)].flatMap((id) => {
    const player = catalogue.players.find((item) => item.id === id)
    if (!player) return []
    const team = catalogue.teams.find((item) => item.id === player.teamId)
    return [
      {
        id: `player-${id}`,
        label: player.name,
        detail: team ? `${team.city ?? ""} ${team.name}`.trim() : "Free agent",
        value: player.name,
        playerId: id,
      },
    ]
  })
}

/** Old recordings predate structured questions. Their choices stay local to review. */
export function legacyClarification(
  question: string,
  request: string,
  catalogue: Catalogue,
  snapshot?: TradeSnapshot | null
): TradeClarification {
  const named = catalogue.players.filter(
    (player) => question.includes(player.name) && !request.includes(player.name)
  )
  const removed = /which player.*remove/i.test(question)
    ? (snapshot?.proposal.transfers
        .filter((item) => item.assetType === "player")
        .map((item) => item.assetId) ?? [])
    : []
  const surname = /which\s+([\p{L}’-]+)\s+(?:do|did)/iu.exec(question)?.[1]
  const ambiguous = surname
    ? catalogue.players
        .filter(
          (player) =>
            player.name.split(" ").at(-1)?.toLowerCase() ===
            surname.toLowerCase()
        )
        .slice(0, 4)
        .map((player) => player.id)
    : []
  const options: Array<ClarificationOption> = playerClarificationOptions(
    named.length
      ? named.map((player) => player.id)
      : removed.length
        ? removed
        : ambiguous,
    catalogue
  )
  if (!options.length && /explore (?:possible )?trade partners/i.test(question))
    options.push({
      id: "explore-partners",
      label: "Explore trade partners",
      value: "Explore possible trade partners.",
    })
  return {
    question: clarificationQuestion(question, options.length > 0),
    options,
  }
}

/** Canonical selected values form the answer prefix; supplemental references retain offsets. */
export function clarificationReply<
  T extends {
    text: string
    playerIds: Array<number>
    playerReferences?: Array<MessagePlayerReference>
    pickReferences?: Array<MessagePickReference>
  },
>(
  draft: T,
  answer?: ClarificationOption | Array<ClarificationOption>,
  questionId?: string
): T & { clarificationAnswer?: ClarificationAnswer } {
  const options = !answer ? [] : Array.isArray(answer) ? answer : [answer]
  if (!options.length) return draft
  const value = options.map((option) => option.value).join(", ")
  const suffix = draft.text.trim() ? `\n\n${draft.text}` : ""
  const offset = suffix ? value.length + 2 : 0
  let cursor = 0
  const selectedReferences = options.flatMap((option) => {
    const start = cursor
    cursor += option.value.length + 2
    return option.playerId === undefined
      ? []
      : [{ start, end: start + option.value.length, playerId: option.playerId }]
  })
  return {
    ...draft,
    text: value + suffix,
    clarificationAnswer: {
      ...(questionId ? { questionId } : {}),
      optionIds: options.map((option) => option.id),
      text: draft.text,
    },
    playerIds: [
      ...new Set([
        ...selectedReferences.map((ref) => ref.playerId),
        ...draft.playerIds,
      ]),
    ],
    pickReferences: suffix
      ? draft.pickReferences?.map((reference) => ({
          ...reference,
          start: reference.start + offset,
          end: reference.end + offset,
        }))
      : [],
    playerReferences: [
      ...selectedReferences,
      ...(suffix
        ? (draft.playerReferences ?? []).map((reference) => ({
            ...reference,
            start: reference.start + offset,
            end: reference.end + offset,
          }))
        : []),
    ],
  }
}

export function activeClarificationEntry<
  T extends {
    role: "user" | "assistant"
    tone?: "warning" | "destructive"
    clarification?: TradeClarification
  },
>(entries: Array<T>): T | undefined {
  for (const entry of [...entries].reverse()) {
    if (entry.role === "user" || entry.tone) continue
    return entry.clarification ? entry : undefined
  }
  return undefined
}
