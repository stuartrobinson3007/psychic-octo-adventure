import type { DraftPick } from "./trade/types.ts"
import type { MessagePlayerReference } from "./message-player-references.ts"

export interface MessagePickReference {
  start: number
  end: number
  pickId: number
  ownerTeamId?: number
}

/** Explicit selections only. Text matching never substitutes a different pick. */
export function parseMessagePickReferences(
  value: unknown,
  text: string,
  selectedPickIds: Array<number> = [],
  playerReferences: Array<MessagePlayerReference> = []
): Array<MessagePickReference> | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 300)
    throw new Error("Invalid pick references.")
  const references: Array<MessagePickReference> = value
    .map((reference) => {
      if (
        !reference ||
        !Number.isSafeInteger(reference.start) ||
        !Number.isSafeInteger(reference.end) ||
        !Number.isSafeInteger(reference.pickId) ||
        reference.start < 0 ||
        reference.end <= reference.start ||
        reference.end > text.length ||
        !selectedPickIds.includes(reference.pickId) ||
        (reference.ownerTeamId !== undefined &&
          !Number.isSafeInteger(reference.ownerTeamId))
      )
        throw new Error("Invalid pick references.")
      return {
        start: reference.start,
        end: reference.end,
        pickId: reference.pickId,
        ...(reference.ownerTeamId !== undefined
          ? { ownerTeamId: reference.ownerTeamId }
          : {}),
      }
    })
    .sort((a, b) => a.start - b.start)
  const ranges = [...references, ...playerReferences].sort(
    (a, b) => a.start - b.start
  )
  if (
    ranges.some((reference, i) => i > 0 && reference.start < ranges[i - 1].end)
  )
    throw new Error("Overlapping asset references.")
  return references
}

export function messagePickReferences(
  text: string,
  picks: Array<DraftPick>,
  references: Array<MessagePickReference> = []
) {
  const known = new Set(picks.map((pick) => pick.id))
  return references
    .filter(
      (reference) =>
        known.has(reference.pickId) &&
        Number.isSafeInteger(reference.start) &&
        Number.isSafeInteger(reference.end) &&
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
