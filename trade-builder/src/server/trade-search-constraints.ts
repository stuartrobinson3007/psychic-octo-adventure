import type { Player, Team } from "../lib/trade/types.ts"
import { knownNBAExperience } from "../lib/trade/player-experience.ts"

export type SearchPosition = "PG" | "SG" | "SF" | "PF" | "C"

export interface TradeSearchConstraints {
  minAge?: number
  maxAge?: number
  minExperience?: number
  maxExperience?: number
  minYearsRemaining?: number
  maxYearsRemaining?: number
  excludeContractOptions?: boolean
  positions?: Array<SearchPosition>
  maxIncomingSalary?: number
  minSalarySavings?: number
  maxTeamPayroll?: number
}

const positions: Array<SearchPosition> = ["PG", "SG", "SF", "PF", "C"]
const keys = new Set([
  "minAge",
  "maxAge",
  "minExperience",
  "maxExperience",
  "minYearsRemaining",
  "maxYearsRemaining",
  "excludeContractOptions",
  "positions",
  "maxIncomingSalary",
  "minSalarySavings",
  "maxTeamPayroll",
])

export function validateSearchConstraints(
  constraints: unknown,
  source: Team
): string | null {
  if (
    !constraints ||
    typeof constraints !== "object" ||
    Array.isArray(constraints)
  )
    return "Choose player or salary limits for this search."
  const filters = constraints as TradeSearchConstraints
  if (Object.keys(filters).some((key) => !keys.has(key)))
    return "This search contains an unsupported filter."
  for (const [min, max, label] of [
    ["minAge", "maxAge", "Age"],
    ["minExperience", "maxExperience", "NBA experience"],
    ["minYearsRemaining", "maxYearsRemaining", "Remaining contract years"],
  ] as const) {
    for (const key of [min, max]) {
      const value = filters[key]
      if (
        value !== undefined &&
        (!Number.isInteger(value) || value < 0 || value > 100)
      )
        return `${label} limits must be whole numbers between 0 and 100.`
    }
    if (
      filters[min] !== undefined &&
      filters[max] !== undefined &&
      filters[min] > filters[max]
    )
      return `The minimum ${label.toLowerCase()} cannot be greater than the maximum.`
  }
  if (
    filters.excludeContractOptions !== undefined &&
    typeof filters.excludeContractOptions !== "boolean"
  )
    return "Choose whether to exclude contracts with player or team options."
  if (
    filters.positions !== undefined &&
    (!Array.isArray(filters.positions) ||
      !filters.positions.length ||
      filters.positions.some((position) => !positions.includes(position)) ||
      new Set(filters.positions).size !== filters.positions.length)
  )
    return "Choose distinct positions from PG, SG, SF, PF, and C."
  for (const key of [
    "maxIncomingSalary",
    "minSalarySavings",
    "maxTeamPayroll",
  ] as const) {
    const value = filters[key]
    if (value !== undefined && (!Number.isFinite(value) || value < 0))
      return "Salary limits must be finite, non-negative dollar amounts."
  }
  if (
    filters.maxTeamPayroll !== undefined &&
    (source.totalSalary === undefined ||
      !Number.isFinite(source.totalSalary) ||
      source.totalSalary < 0)
  )
    return "The team's current payroll is unavailable, so a post-trade payroll limit cannot be checked."
  return null
}

export function matchesIncomingPlayer(
  player: Player,
  constraints: TradeSearchConstraints
): boolean {
  for (const [value, min, max, lowest] of [
    [player.age, constraints.minAge, constraints.maxAge, 1],
    [
      knownNBAExperience(player),
      constraints.minExperience,
      constraints.maxExperience,
      0,
    ],
    [
      player.yearsRemaining,
      constraints.minYearsRemaining,
      constraints.maxYearsRemaining,
      0,
    ],
  ] as const) {
    if (min === undefined && max === undefined) continue
    if (value === undefined || !Number.isInteger(value) || value < lowest)
      return false
    if (min !== undefined && value < min) return false
    if (max !== undefined && value > max) return false
  }
  if (
    constraints.excludeContractOptions &&
    (player.playerOption !== false || player.teamOption !== false)
  )
    return false
  if (constraints.positions !== undefined) {
    const tokens = player.position
      ?.toUpperCase()
      .split(/[\s/,-]+/)
      .filter(Boolean)
    if (
      !tokens?.length ||
      tokens.some((token) => !positions.includes(token as SearchPosition)) ||
      !tokens.some((token) =>
        constraints.positions!.includes(token as SearchPosition)
      )
    )
      return false
  }
  return true
}

export function matchesSalaryConstraints(
  outgoingSalary: number,
  incomingSalary: number,
  source: Team,
  constraints: TradeSearchConstraints
): boolean {
  if (
    !Number.isFinite(outgoingSalary) ||
    !Number.isFinite(incomingSalary) ||
    outgoingSalary < 0 ||
    incomingSalary < 0
  )
    return false
  if (
    constraints.maxIncomingSalary !== undefined &&
    incomingSalary > constraints.maxIncomingSalary
  )
    return false
  if (
    constraints.minSalarySavings !== undefined &&
    outgoingSalary - incomingSalary < constraints.minSalarySavings
  )
    return false
  if (constraints.maxTeamPayroll !== undefined) {
    if (
      source.totalSalary === undefined ||
      !Number.isFinite(source.totalSalary) ||
      source.totalSalary < outgoingSalary
    )
      return false
    const payroll = source.totalSalary + incomingSalary - outgoingSalary
    if (!Number.isFinite(payroll) || payroll > constraints.maxTeamPayroll)
      return false
  }
  return true
}

const dollars = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`

export function describeSearchConstraints(
  constraints: TradeSearchConstraints
): string {
  const descriptions: Array<string> = []
  if (constraints.minAge !== undefined && constraints.maxAge !== undefined)
    descriptions.push(
      `incoming players aged ${constraints.minAge}–${constraints.maxAge}`
    )
  else if (constraints.minAge !== undefined)
    descriptions.push(`incoming players aged ${constraints.minAge} or older`)
  else if (constraints.maxAge !== undefined)
    descriptions.push(`incoming players aged ${constraints.maxAge} or younger`)
  for (const [min, max, unit] of [
    [constraints.minExperience, constraints.maxExperience, "of NBA experience"],
    [
      constraints.minYearsRemaining,
      constraints.maxYearsRemaining,
      "remaining on their contracts",
    ],
  ] as const) {
    if (min !== undefined && max !== undefined)
      descriptions.push(
        `incoming players with ${min === max ? min : `${min}–${max}`} year${min === 1 && max === 1 ? "" : "s"} ${unit}`
      )
    else if (min !== undefined)
      descriptions.push(
        `incoming players with at least ${min} year${min === 1 ? "" : "s"} ${unit}`
      )
    else if (max !== undefined)
      descriptions.push(
        `incoming players with at most ${max} year${max === 1 ? "" : "s"} ${unit}`
      )
  }
  if (constraints.excludeContractOptions)
    descriptions.push("no player or team contract options")
  if (constraints.positions?.length)
    descriptions.push(
      `incoming positions ${constraints.positions.join(" or ")}`
    )
  if (constraints.maxIncomingSalary !== undefined)
    descriptions.push(
      `combined incoming salary at most ${dollars(constraints.maxIncomingSalary)}`
    )
  if (constraints.minSalarySavings !== undefined)
    descriptions.push(
      constraints.minSalarySavings === 0
        ? "no increase in team payroll"
        : `team salary savings of at least ${dollars(constraints.minSalarySavings)}`
    )
  if (constraints.maxTeamPayroll !== undefined)
    descriptions.push(
      `post-trade team payroll at most ${dollars(constraints.maxTeamPayroll)}`
    )
  return descriptions.join("; ")
}
