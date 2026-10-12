import type { Player } from "./types.ts"

/** An incomplete zero-age/zero-experience profile does not establish rookie status. */
export function knownNBAExperience(
  player: Pick<Player, "age" | "yearsExperience">
): number | undefined {
  const { age, yearsExperience } = player
  if (
    yearsExperience === undefined ||
    !Number.isInteger(yearsExperience) ||
    yearsExperience < 0
  )
    return undefined
  if (
    yearsExperience === 0 &&
    (age === undefined || !Number.isInteger(age) || age <= 0)
  )
    return undefined
  return yearsExperience
}
