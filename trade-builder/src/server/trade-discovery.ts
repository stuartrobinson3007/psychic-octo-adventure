import type { CandidateSpace } from "./candidate-space.ts"
import type { Catalogue, Player, TradeProposal } from "../lib/trade/types.ts"
import type { TradeSearchConstraints } from "./trade-search-constraints.ts"
import {
  describeSearchConstraints,
  matchesIncomingPlayer,
  matchesSalaryConstraints,
  validateSearchConstraints,
} from "./trade-search-constraints.ts"
import { playerTradeIssues, proposalIssues } from "./trade-api.ts"

export interface TradeSearchRequest {
  sourceTeamId: number
  partnerTeamId?: number
  outgoingCount?: number
  incomingCount?: number
  outgoingPlayerIds?: Array<number>
  excludedPlayerIds?: Array<number>
  excludedPackageKeys?: Array<string>
  constraints?: TradeSearchConstraints
}
/** Explain known catalogue restrictions before attempting a package search. */
export function playerDiscoveryIssues(player: Player): Array<string> {
  if (player.signingStatus === "free-agent")
    return [
      `${player.name} is unsigned, so he can’t be traded. We can explore signing him instead.`,
    ]
  if (player.contractType === "two-way" || player.signingStatus === "two-way")
    return [
      `${player.name} has a two-way contract. Trade searches currently support players on active standard contracts.`,
    ]
  const issues = playerTradeIssues(player)
  if (issues.length) return issues
  if (!Number.isFinite(player.salary) || player.salary <= 0)
    return [
      `${player.name} has no salary available for matching, so a trade search can’t be checked.`,
    ]
  return []
}
// Identity deliberately excludes generated IDs, revision numbers and timestamps.
export function tradePackageKey(proposal: TradeProposal): string {
  return JSON.stringify({
    teams: [...proposal.teamIds].sort((a, b) => a - b),
    transfers: proposal.transfers
      .map(({ assetType, assetId, fromTeamId, toTeamId }) => [
        assetType,
        assetId,
        fromTeamId,
        toTeamId,
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  })
}
function salary(players: Array<Player>) {
  return players.reduce((total, player) => total + player.salary, 0)
}

export function discoverySpace(
  request: TradeSearchRequest,
  catalogue: Catalogue
): CandidateSpace {
  const invalid = (message: string): CandidateSpace => ({
    total: 0,
    scope: message,
    invalid: message,
    at: () => null,
  })
  const source = catalogue.teams.find(
    (team) => team.id === request.sourceTeamId
  )
  const outgoingCount =
    request.outgoingCount ?? request.outgoingPlayerIds?.length ?? 1
  const incomingCount = request.incomingCount ?? 2
  if (!source) return invalid("Choose a team to trade from.")
  if (![1, 2, 3].includes(outgoingCount) || ![1, 2, 3].includes(incomingCount))
    return invalid(
      "Discovery supports one to three players on each side of a two-team trade."
    )
  if (
    request.partnerTeamId !== undefined &&
    (request.partnerTeamId === source.id ||
      !catalogue.teams.some((team) => team.id === request.partnerTeamId))
  )
    return invalid("Choose a different team as the trade partner.")
  if (
    request.outgoingPlayerIds &&
    (request.outgoingPlayerIds.length !== outgoingCount ||
      new Set(request.outgoingPlayerIds).size !== outgoingCount)
  )
    return invalid(
      "The named outgoing players must match the requested outgoing count without duplicates."
    )
  if (
    request.excludedPlayerIds?.some(
      (id) => !catalogue.players.some((player) => player.id === id)
    )
  )
    return invalid("A player excluded from this search is no longer available.")
  const constraints =
    request.constraints === undefined ? {} : request.constraints
  const constraintIssue = validateSearchConstraints(constraints, source)
  if (constraintIssue) return invalid(constraintIssue)
  if (
    request.excludedPackageKeys !== undefined &&
    (!Array.isArray(request.excludedPackageKeys) ||
      request.excludedPackageKeys.length > 1_000 ||
      request.excludedPackageKeys.some(
        (key) => typeof key !== "string" || key.length > 2_048
      ))
  )
    return invalid(
      "The previously shown trade packages could not be read. Start a new search."
    )
  const excludedPackages = new Set(request.excludedPackageKeys)
  const excluded = new Set(request.excludedPlayerIds)
  const eligible = catalogue.players.filter(
    (player) =>
      !excluded.has(player.id) && !playerDiscoveryIssues(player).length
  )
  const sourcePlayers = eligible.filter((player) => player.teamId === source.id)
  let namedOutgoing: Array<Player> | undefined
  if (request.outgoingPlayerIds) {
    for (const id of request.outgoingPlayerIds) {
      const player = catalogue.players.find((candidate) => candidate.id === id)
      if (!player) return invalid("An outgoing player is no longer available.")
      const issues = playerDiscoveryIssues(player)
      if (issues.length) return invalid(issues.join(" "))
      if (player.teamId !== source.id)
        return invalid(
          `${player.name} is not on ${source.city} ${source.name}. Choose players from the same team for this search.`
        )
      if (excluded.has(player.id))
        return invalid(
          `${player.name} is both outgoing and excluded from this search. Choose whether to trade or keep him.`
        )
    }
    const named = request.outgoingPlayerIds.map((id) =>
      sourcePlayers.find((player) => player.id === id)
    )
    if (named.some((player) => !player))
      return invalid(
        "The outgoing players must be eligible players belonging to the source team and not excluded from the search."
      )
    namedOutgoing = named as Array<Player>
  }
  const sent = namedOutgoing
    ? [namedOutgoing]
    : combinations(sourcePlayers, outgoingCount)
  const groups = catalogue.teams
    .filter(
      (team) =>
        team.id !== source.id &&
        (request.partnerTeamId === undefined ||
          team.id === request.partnerTeamId)
    )
    .map((partner) => {
      const received = combinations(
        eligible.filter(
          (player) =>
            player.teamId === partner.id &&
            matchesIncomingPlayer(player, constraints)
        ),
        incomingCount
      )
      const target = sent.length ? salary(sent[Math.floor(sent.length / 2)]) : 0
      received.sort(
        (a, b) => Math.abs(salary(a) - target) - Math.abs(salary(b) - target)
      )
      return {
        partnerId: partner.id,
        received,
        total: sent.length * received.length,
      }
    })
    .filter((group) => group.total > 0)
  // Interleave partners, without discarding any package. The cursor is an ordinal
  // in this immutable space, so resuming never has to generate earlier pairs.
  const lengths = [...new Set(groups.map((group) => group.total))].sort(
    (a, b) => a - b
  )
  const tiers: Array<{
    start: number
    row: number
    count: number
    groups: typeof groups
  }> = []
  let total = 0,
    row = 0
  for (const length of lengths) {
    const active = groups.filter((group) => group.total >= length)
    const count = (length - row) * active.length
    tiers.push({ start: total, row, count, groups: active })
    total += count
    row = length
  }
  const pairAt = (index: number) => {
    const tier = tiers.find(
      (item) => index >= item.start && index < item.start + item.count
    )
    if (!tier) return undefined
    const offset = index - tier.start
    return {
      group: tier.groups[offset % tier.groups.length],
      pair: tier.row + Math.floor(offset / tier.groups.length),
    }
  }
  return {
    total,
    scope: `Two-team trades: ${outgoingCount} eligible ${source.city} ${source.name} player${outgoingCount === 1 ? "" : "s"} for ${incomingCount} eligible player${incomingCount === 1 ? "" : "s"} from ${request.partnerTeamId === undefined ? "each other team" : "the chosen partner"}.${describeSearchConstraints(constraints) ? ` Filters: ${describeSearchConstraints(constraints)}.` : ""} Picks, signings and other package sizes are outside this search.`,
    browseOrdinal(position) {
      const located = pairAt(position)
      if (!located) return position
      const { group, pair } = located
      // Cycle outgoing packages too, offsetting each partner so the first row
      // of partners does not repeat the same outgoing player or package.
      const outgoingIndex = (pair + groups.indexOf(group)) % sent.length
      const incomingIndex = Math.floor(pair / sent.length)
      const canonicalPair =
        outgoingIndex * group.received.length + incomingIndex
      const tier = tiers.find(
        (item) =>
          item.groups.includes(group) &&
          canonicalPair >= item.row &&
          canonicalPair < item.row + item.count / item.groups.length
      )!
      return (
        tier.start +
        (canonicalPair - tier.row) * tier.groups.length +
        tier.groups.indexOf(group)
      )
    },
    at(index) {
      const located = pairAt(index)
      if (!located) return null
      const { group, pair } = located
      const outgoing = sent[Math.floor(pair / group.received.length)]
      const incoming = group.received[pair % group.received.length]
      if (
        !matchesSalaryConstraints(
          salary(outgoing),
          salary(incoming),
          source,
          constraints
        )
      )
        return null
      const proposal: TradeProposal = {
        proposalId: crypto.randomUUID(),
        revision: 1,
        createdAt: new Date().toISOString(),
        teamIds: [source.id, group.partnerId],
        transfers: [
          ...outgoing.map((player) => ({
            assetType: "player" as const,
            assetId: player.id,
            fromTeamId: source.id,
            toTeamId: group.partnerId,
          })),
          ...incoming.map((player) => ({
            assetType: "player" as const,
            assetId: player.id,
            fromTeamId: group.partnerId,
            toTeamId: source.id,
          })),
        ],
      }
      if (
        excludedPackages.has(tradePackageKey(proposal)) ||
        proposalIssues(proposal, catalogue).length
      )
        return null
      return proposal
    },
  }
}

function combinations(
  players: Array<Player>,
  count: number,
  start = 0,
  chosen: Array<Player> = []
): Array<Array<Player>> {
  if (chosen.length === count) return [chosen]
  const result: Array<Array<Player>> = []
  for (
    let index = start;
    index <= players.length - (count - chosen.length);
    index++
  )
    result.push(
      ...combinations(players, count, index + 1, [...chosen, players[index]])
    )
  return result
}
