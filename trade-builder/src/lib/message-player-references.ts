import type { Player } from "./trade/types"

/** Offsets refer to the stored message text, never a reconstructed player name. */
export interface MessagePlayerReference {
  start: number
  end: number
  playerId: number
}

/** Validate persisted badge ranges against the exact text and selected identities. */
export function parseMessagePlayerReferences(
  value: unknown,
  text: string,
  selectedPlayerIds: Array<number> = []
): Array<MessagePlayerReference> | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 300)
    throw new Error("Invalid player references.")
  const references: Array<MessagePlayerReference> = []
  for (const reference of value) {
    if (
      !reference ||
      !Number.isSafeInteger(reference.start) ||
      !Number.isSafeInteger(reference.end) ||
      !Number.isSafeInteger(reference.playerId) ||
      reference.start < 0 ||
      reference.end <= reference.start ||
      reference.end > text.length ||
      !selectedPlayerIds.includes(reference.playerId)
    )
      throw new Error("Invalid player references.")
    references.push({
      start: reference.start,
      end: reference.end,
      playerId: reference.playerId,
    })
  }
  references.sort((a, b) => a.start - b.start)
  if (
    references.some(
      (reference, i) => i > 0 && reference.start < references[i - 1].end
    )
  )
    throw new Error("Overlapping player references.")
  return references
}

export function messagePlayerReferences(
  text: string,
  players: Array<Player>,
  explicit: Array<MessagePlayerReference> = []
): Array<MessagePlayerReference> {
  const knownIds = new Set(players.map((player) => player.id))
  return explicit
    .filter(
      (reference) =>
        knownIds.has(reference.playerId) &&
        Number.isInteger(reference.start) &&
        Number.isInteger(reference.end) &&
        reference.start >= 0 &&
        reference.end > reference.start &&
        reference.end <= text.length
    )
    .sort((a, b) => a.start - b.start)
    .filter(
      (reference, index, items) =>
        index === 0 || reference.start >= items[index - 1].end
    )
}
