import type { CandidateSpace } from "./candidate-space.ts"
import type {
  Catalogue,
  PlayerTransfer,
  AssetTransfer,
  TradeProposal,
  TradeSnapshot,
} from "../lib/trade/types.ts"
import {
  scenarioPlayerSalary,
  scenarioPayroll,
  playerTradeIssues,
  proposalIssues,
} from "./trade-api.ts"
import {
  matchesIncomingPlayer,
  matchesSalaryConstraints,
  validateSearchConstraints,
} from "./trade-search-constraints.ts"
import type { TradeSearchConstraints } from "./trade-search-constraints.ts"
import { tradePackageKey } from "./trade-discovery.ts"

export interface TradeRepairRequest {
  excludedPackageKeys?: Array<string>
  snapshot: TradeSnapshot
  keepPlayerIds?: Array<number>
  allowReplacements?: boolean
  /** Search only these replacement slots, preserving every other asset. */
  replacementPlayerIds?: Array<number>
  sourceTeamId?: number
  constraints?: TradeSearchConstraints
}

function salary(
  proposal: TradeProposal,
  catalogue: Catalogue,
  teamId: number,
  direction: "fromTeamId" | "toTeamId"
) {
  return proposal.transfers
    .filter(
      (transfer) =>
        transfer.assetType === "player" && transfer[direction] === teamId
    )
    .reduce(
      (total, transfer) =>
        total + scenarioPlayerSalary(proposal, catalogue, transfer.assetId),
      0
    )
}

/** Suggest independent checked alternatives without mutating the referenced proposal. */
export function repairSpace(
  request: TradeRepairRequest,
  catalogue: Catalogue
): CandidateSpace {
  const invalid = (message: string): CandidateSpace => ({
    total: 0,
    scope: message,
    invalid: message,
    at: () => null,
  })
  const original = request.snapshot.proposal
  if (
    original.transfers.some((transfer) => {
      if (transfer.assetType !== "player") return false
      const player = catalogue.players.find(
        (item) => item.id === transfer.assetId
      )
      return (
        // Reject malformed runtime assets even though the proposal type is player-only.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        transfer.assetType !== "player" ||
        !player ||
        !Number.isFinite(
          scenarioPlayerSalary(original, catalogue, player.id)
        ) ||
        scenarioPlayerSalary(original, catalogue, player.id) <= 0
      )
    })
  )
    return invalid(
      "Repairs currently require players with supported contracts and known salaries."
    )
  const issues = proposalIssues(original, catalogue)
  if (issues.length)
    return invalid(
      `This trade needs a correction before I can suggest repairs. ${issues[0]}`
    )
  const originalIds = new Set(
    original.transfers
      .filter((transfer) => transfer.assetType === "player")
      .map((transfer) => transfer.assetId)
  )
  if (request.keepPlayerIds?.some((id) => !originalIds.has(id)))
    return invalid(
      "Players to keep must already belong to the trade being repaired."
    )
  if (
    request.sourceTeamId !== undefined &&
    !original.teamIds.includes(request.sourceTeamId)
  )
    return invalid(
      "Choose one of the participating teams for the repair constraints."
    )
  const source = catalogue.teams.find(
    (team) => team.id === request.sourceTeamId
  )
  if (request.constraints && !source)
    return invalid(
      "Choose which participating team the repair constraints apply to."
    )
  if (request.constraints && source) {
    const constraintIssue = validateSearchConstraints(
      request.constraints,
      source
    )
    if (constraintIssue) return invalid(constraintIssue)
  }
  if (
    request.replacementPlayerIds &&
    (request.replacementPlayerIds.length !== 1 ||
      request.replacementPlayerIds.some(
        (id) => !originalIds.has(id) || request.keepPlayerIds?.includes(id)
      ))
  )
    return invalid("Choose one player in this trade to find replacements for.")
  const replacementIds = new Set(request.replacementPlayerIds)
  const pinned = new Set(request.keepPlayerIds)
  const eligible = catalogue.players.filter(
    (player) =>
      original.teamIds.includes(player.teamId) &&
      !originalIds.has(player.id) &&
      Number.isFinite(player.salary) &&
      player.salary > 0 &&
      !playerTradeIssues(player).length
  )
  type Candidate = { proposal: TradeProposal; score: number; key: string }
  const candidates: Array<Candidate> = []
  const seen = new Set<string>()
  const propose = (transfers: Array<AssetTransfer>) => {
    const key = transfers
      .map(
        (transfer) =>
          `${transfer.assetType}:${transfer.assetId}:${transfer.fromTeamId}:${transfer.toTeamId}`
      )
      .sort()
      .join(":")
    if (seen.has(key)) return
    seen.add(key)
    const proposal: TradeProposal = {
      ...structuredClone(original),
      proposalId: crypto.randomUUID(),
      revision: 1,
      parent: { proposalId: original.proposalId, revision: original.revision },
      teamIds: [...original.teamIds],
      transfers,
      createdAt: new Date().toISOString(),
    }
    if (request.excludedPackageKeys?.includes(tradePackageKey(proposal))) return
    if (proposalIssues(proposal, catalogue).length) return
    if (request.constraints && source) {
      const incomingPlayers = proposal.transfers
        .filter(
          (transfer) =>
            transfer.assetType === "player" &&
            transfer.toTeamId === source.id &&
            (!replacementIds.size || !originalIds.has(transfer.assetId))
        )
        .map((transfer) => {
          const player = catalogue.players.find(
            (item) => item.id === transfer.assetId
          )!
          const override = proposal.salaryOverrides?.find(
            (item) => item.playerId === player.id
          )
          const signing = proposal.signings?.find(
            (item) => item.playerId === player.id
          )
          const yearsRemaining =
            override?.yearsRemaining ?? signing?.contractYears
          return yearsRemaining !== undefined
            ? { ...player, yearsRemaining }
            : player
        })
      if (
        incomingPlayers.some(
          (player) => !matchesIncomingPlayer(player, request.constraints!)
        ) ||
        !matchesSalaryConstraints(
          salary(proposal, catalogue, source.id, "fromTeamId"),
          salary(proposal, catalogue, source.id, "toTeamId"),
          {
            ...source,
            totalSalary: scenarioPayroll(proposal, catalogue, source.id),
          },
          request.constraints
        )
      )
        return
    }
    const score = proposal.teamIds.reduce((total, teamId) => {
      const out = salary(proposal, catalogue, teamId, "fromTeamId")
      const incoming = salary(proposal, catalogue, teamId, "toTeamId")
      return total + Math.abs(incoming - out) / Math.max(incoming, out, 1)
    }, 0)
    candidates.push({
      proposal,
      key,
      score,
    })
  }
  for (const player of eligible) {
    for (const toTeamId of original.teamIds.filter(
      (id) => id !== player.teamId
    )) {
      const transfer: PlayerTransfer = {
        assetType: "player",
        assetId: player.id,
        fromTeamId: player.teamId,
        toTeamId,
      }
      if (!replacementIds.size)
        propose([...original.transfers.map((item) => ({ ...item })), transfer])
      if (request.allowReplacements === true || replacementIds.size) {
        for (let index = 0; index < original.transfers.length; index++) {
          const replaced = original.transfers[index]
          if (
            replaced.assetType !== "player" ||
            pinned.has(replaced.assetId) ||
            (replacementIds.size > 0 &&
              !replacementIds.has(replaced.assetId)) ||
            replaced.fromTeamId !== player.teamId ||
            replaced.toTeamId !== toTeamId
          )
            continue
          propose(
            original.transfers.map((item, itemIndex) =>
              itemIndex === index ? transfer : { ...item }
            )
          )
        }
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score || a.key.localeCompare(b.key))
  const target = catalogue.players.find((player) =>
    replacementIds.has(player.id)
  )
  return {
    total: candidates.length,
    scope: target
      ? `Replace ${target.name} with each eligible player from the same sending team. All other assets, destinations and scenario settings stay in place.`
      : `Add one eligible player from a participating team${request.allowReplacements ? ", or replace one unpinned player from the same sending team" : ""}. All other assets, destinations and scenario settings stay in place.`,
    at: (index) => candidates[index]?.proposal ?? null,
  }
}
