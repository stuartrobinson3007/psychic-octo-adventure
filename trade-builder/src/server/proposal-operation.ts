import { TradeDomainError } from "./trade-errors.ts"
import { z } from "zod"
import {
  checkSigning,
  scenarioPlayerSalary,
  proposalIssues,
} from "./trade-api.ts"
import type { ContractOptions } from "./trade-api.ts"
import type {
  AssetTransfer,
  Catalogue,
  TradeProposal,
  TradeException,
} from "../lib/trade/types.ts"

const id = z.number().int().positive()
const dollars = z.number().int().nonnegative()
export const proposalChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("asset"),
      action: z.enum(["add", "remove", "replace", "reroute"]),
      assetType: z.enum(["player", "pick", "draft_right"]),
      assetId: id,
      replacementId: id.nullable(),
      toTeamId: id.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("contract"),
      action: z.enum(["override", "reset", "stretch"]),
      playerId: id,
      salary: dollars.nullable(),
      yearsRemaining: z.number().int().min(0).max(15).nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("signing"),
      action: z.enum(["sign", "unsign"]),
      playerId: id,
      teamId: id,
      salary: dollars.nullable(),
      years: z.number().int().min(1).max(5).nullable(),
      tierId: z.string().nullable(),
      firstYearGuaranteed: z.boolean().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("exception"),
      teamId: id,
      exceptionId: id.nullable(),
    })
    .strict(),
])
export type ProposalChange = z.infer<typeof proposalChangeSchema>

export function assetOwner(
  proposal: TradeProposal,
  catalogue: Catalogue,
  assetType: AssetTransfer["assetType"],
  assetId: number
): number {
  const owner =
    assetType === "player"
      ? (proposal.signings?.find((item) => item.playerId === assetId)
          ?.signingTeamId ??
        catalogue.players.find((item) => item.id === assetId)?.teamId)
      : assetType === "pick"
        ? catalogue.draftPicks?.find((item) => item.id === assetId)
            ?.currentTeamId
        : catalogue.draftRights?.find((item) => item.id === assetId)
            ?.currentTeamId
  if (owner === undefined || !catalogue.teams.some((team) => team.id === owner))
    throw new TradeDomainError(
      "This asset has no team to trade from. Check its identity and signing status."
    )
  return owner
}

/** A complete request is applied to a private copy. No partially applied edits escape. */
export async function applyProposalChanges(options: {
  proposal: TradeProposal
  changes: ProposalChange[]
  teamIds: number[]
  catalogue: Catalogue
  offers: Map<string, ContractOptions>
  exceptions: Map<number, TradeException>
  signal: AbortSignal
}): Promise<TradeProposal> {
  const { changes, catalogue, offers, signal } = options
  const draft = structuredClone(options.proposal)
  const original = structuredClone(draft)
  const sameAsset = (
    item: AssetTransfer,
    change: Extract<ProposalChange, { kind: "asset" }>
  ) => item.assetType === change.assetType && item.assetId === change.assetId
  const mutationKeys = changes.map((change) =>
    change.kind === "asset"
      ? `asset:${change.assetType}:${change.assetId}`
      : change.kind === "exception"
        ? `exception:${change.teamId}`
        : `${change.kind}:${change.playerId}`
  )
  if (new Set(mutationKeys).size !== mutationKeys.length)
    throw new TradeDomainError(
      "Combine changes to the same asset or contract into one operation."
    )

  // Signing ownership must be available before processing transfers in the same request.
  for (const change of changes) {
    signal.throwIfAborted()
    if (change.kind === "signing") {
      const player = catalogue.players.find(
        (item) => item.id === change.playerId
      )
      if (!player || !catalogue.teams.some((team) => team.id === change.teamId))
        throw new TradeDomainError("Identify the player and signing team.")
      if (change.action === "unsign") {
        if (
          !draft.signings?.some(
            (item) =>
              item.playerId === player.id &&
              item.signingTeamId === change.teamId
          )
        )
          throw new TradeDomainError(
            "This proposal has no matching hypothetical signing to remove."
          )
        draft.signings = draft.signings.filter(
          (item) => item.playerId !== player.id
        )
        draft.salaryOverrides = draft.salaryOverrides?.filter(
          (item) => item.playerId !== player.id
        )
        draft.transfers = draft.transfers.filter(
          (item) => item.assetType !== "player" || item.assetId !== player.id
        )
        continue
      }
      if (player.signingStatus !== "free-agent")
        throw new TradeDomainError(
          `${player.name} is already signed. Use a contract hypothetical for salary changes.`
        )
      const offer = offers.get(`${player.id}:${change.teamId}`)
      if (!offer)
        throw new TradeDomainError(
          "Read this player's contract options for the signing team before proposing the signing."
        )
      const tier =
        change.tierId === null
          ? null
          : offer.tiers.find((item) => item.id === change.tierId)
      if (change.tierId !== null && (!tier || !tier.eligible))
        throw new TradeDomainError(
          tier?.reason ??
            "Choose an eligible contract tier from the returned options."
        )
      const salary = change.salary ?? tier?.firstYearSalary
      const years = change.years ?? (tier?.id === "minimum" ? 1 : undefined)
      if (salary === undefined || years === undefined)
        throw new TradeDomainError(
          "Ask for the first-year salary and contract length. A minimum contract may default to one year."
        )
      if (
        salary > offer.maxOfferable ||
        years > (tier?.maxYears ?? offer.maxYears)
      )
        throw new TradeDomainError(
          "That offer exceeds the available salary or contract-length limits."
        )
      if (
        tier &&
        (tier.salaryIsMaximum
          ? salary > tier.firstYearSalary
          : salary !== tier.firstYearSalary)
      )
        throw new TradeDomainError(
          "Use the listed offer amount. A funding route permits a checked salary up to its stated ceiling."
        )
      const signing = await checkSigning(
        player.id,
        change.teamId,
        salary,
        years,
        signal
      )
      if ("error" in signing) throw new TradeDomainError(signing.error)
      draft.signings = [
        ...(draft.signings ?? []).filter((item) => item.playerId !== player.id),
        {
          ...signing,
          tierId: change.tierId ?? undefined,
          fundingLabel: tier?.label,
          firstYearGuaranteed: change.firstYearGuaranteed ?? undefined,
        },
      ]
    }
  }

  const replacements: { oldOwner: number; newOwner: number }[] = []
  const assetChanges = changes.filter(
    (item): item is Extract<ProposalChange, { kind: "asset" }> =>
      item.kind === "asset"
  )
  const explicitRecipients = new Set(
    assetChanges
      .filter(
        (change) => change.toTeamId !== null && change.action !== "remove"
      )
      .map(
        (change) =>
          `${change.assetType}:${change.action === "replace" ? change.replacementId : change.assetId}`
      )
  )
  const beforeAssets = structuredClone(draft.transfers)
  const updates = new Map<string, AssetTransfer | null>()
  const additions: AssetTransfer[] = []
  for (const change of assetChanges) {
    const key = `${change.assetType}:${change.assetId}`
    const current = beforeAssets.find((item) => sameAsset(item, change))
    if (change.action !== "add" && !current)
      throw new TradeDomainError(
        "The asset to change is not in the referenced proposal. Read its assets first."
      )
    if (change.action === "add" && current)
      throw new TradeDomainError(
        "That asset is already in this proposal. Use reroute or replace to change it."
      )
    if (change.action === "remove") {
      updates.set(key, null)
      continue
    }
    const assetId =
      change.action === "replace" ? change.replacementId : change.assetId
    if (assetId === null)
      throw new TradeDomainError("Identify the replacement asset.")
    if (change.action === "replace" && assetId === change.assetId)
      throw new TradeDomainError(
        "The replacement is the same asset. No replacement is needed."
      )
    const fromTeamId = assetOwner(draft, catalogue, change.assetType, assetId)
    const destination = change.toTeamId ?? current?.toTeamId
    const participating = [
      ...new Set([
        ...original.teamIds,
        ...options.teamIds,
        ...beforeAssets.map((item) => item.fromTeamId),
        fromTeamId,
      ]),
    ]
    const otherTeam = participating.filter((teamId) => teamId !== fromTeamId)
    const toTeamId =
      destination ?? (otherTeam.length === 1 ? otherTeam[0] : undefined)
    if (toTeamId === undefined)
      throw new TradeDomainError(
        "The receiving team is unresolved. Ask only for the missing asset destination."
      )
    const transfer: AssetTransfer = {
      assetType: change.assetType,
      assetId,
      fromTeamId,
      toTeamId,
    }
    if (current) updates.set(key, transfer)
    else additions.push(transfer)
    if (
      change.action === "replace" &&
      current &&
      current.fromTeamId !== fromTeamId &&
      (change.toTeamId === null || change.toTeamId === current.toTeamId)
    )
      replacements.push({ oldOwner: current.fromTeamId, newOwner: fromTeamId })
  }
  draft.transfers = [
    ...beforeAssets.flatMap((item) => {
      const key = `${item.assetType}:${item.assetId}`
      return updates.has(key)
        ? updates.get(key)
          ? [updates.get(key)!]
          : []
        : [item]
    }),
    ...additions,
  ]
  for (const change of changes) {
    if (change.kind === "contract") {
      const player = catalogue.players.find(
        (item) => item.id === change.playerId
      )
      if (!player)
        throw new TradeDomainError(
          "Identify the player whose contract should change."
        )
      const prior = draft.salaryOverrides?.find(
        (item) => item.playerId === player.id
      )
      const signing = draft.signings?.find(
        (item) => item.playerId === player.id
      )
      const overrides = (draft.salaryOverrides ?? []).filter(
        (item) => item.playerId !== player.id
      )
      if (change.action === "reset") {
        draft.salaryOverrides = overrides
        continue
      }
      if (
        change.action === "override" &&
        change.salary === null &&
        change.yearsRemaining === null
      )
        throw new TradeDomainError(
          "Specify a salary or remaining contract duration to change."
        )
      if (change.action === "stretch") {
        if (
          prior?.isStretchAndWaive ||
          player.contractType === "stretch-and-waive"
        )
          throw new TradeDomainError(
            "This contract has already been stretched."
          )
        const years =
          prior?.yearsRemaining ??
          signing?.contractYears ??
          player.yearsRemaining ??
          player.contractYears
        if (!years || years < 1)
          throw new TradeDomainError(
            "This player's remaining guaranteed contract duration is unavailable."
          )
        const duration = 2 * years + 1
        overrides.push({
          playerId: player.id,
          salary: Math.round(
            (scenarioPlayerSalary(draft, catalogue, player.id) * years) /
              duration
          ),
          yearsRemaining: duration,
          isStretchAndWaive: true,
        })
        draft.transfers = draft.transfers.filter(
          (item) => item.assetType !== "player" || item.assetId !== player.id
        )
      } else {
        const yearsRemaining =
          change.yearsRemaining ??
          prior?.yearsRemaining ??
          signing?.contractYears ??
          player.yearsRemaining ??
          player.contractYears
        if (yearsRemaining === undefined)
          throw new TradeDomainError(
            "Ask for the remaining contract duration; it is unavailable in the catalogue."
          )
        overrides.push({
          playerId: player.id,
          salary:
            change.salary ?? scenarioPlayerSalary(draft, catalogue, player.id),
          yearsRemaining,
        })
      }
      draft.salaryOverrides = overrides
    } else if (change.kind === "exception") {
      const exceptions = (draft.exceptions ?? []).filter(
        (item) => item.teamId !== change.teamId
      )
      if (change.exceptionId !== null) {
        const available = options.exceptions.get(change.exceptionId)
        if (!available || available.teamId !== change.teamId)
          throw new TradeDomainError(
            "Read the team's available trade exceptions and use a listed exception."
          )
        exceptions.push({
          teamId: change.teamId,
          exceptionId: available.id,
          sourcePlayerName: available.playerName,
        })
      }
      draft.exceptions = exceptions
    }
  }
  // Decide ownership substitutions after every asset and scenario change is staged.
  const substitutions = new Map<number, Set<number>>()
  for (const { oldOwner, newOwner } of replacements) {
    const owners = substitutions.get(oldOwner) ?? new Set<number>()
    owners.add(newOwner)
    substitutions.set(oldOwner, owners)
  }
  for (const [oldOwner, newOwners] of substitutions) {
    const stillSends = draft.transfers.some(
      (item) => item.fromTeamId === oldOwner
    )
    const hasAssumptions =
      draft.signings?.some((item) => item.signingTeamId === oldOwner) ||
      draft.exceptions?.some((item) => item.teamId === oldOwner) ||
      draft.salaryOverrides?.some(
        (item) =>
          catalogue.players.find((player) => player.id === item.playerId)
            ?.teamId === oldOwner
      )
    const implicitRecipients = draft.transfers.filter(
      (item) =>
        item.toTeamId === oldOwner &&
        !explicitRecipients.has(`${item.assetType}:${item.assetId}`)
    )
    if (!stillSends && !hasAssumptions && implicitRecipients.length) {
      if (newOwners.size !== 1)
        throw new TradeDomainError(
          "The replaced sending side now comes from several teams. Ask which team should receive its returning assets."
        )
      const newOwner = [...newOwners][0]
      draft.transfers = draft.transfers.map((item) =>
        implicitRecipients.includes(item)
          ? { ...item, toTeamId: newOwner }
          : item
      )
    }
  }
  const assumptions = [
    ...(draft.signings ?? []).map((item) => item.signingTeamId),
    ...(draft.salaryOverrides ?? []).map((item) =>
      assetOwner(draft, catalogue, "player", item.playerId)
    ),
    ...(draft.exceptions ?? []).map((item) => item.teamId),
  ]
  draft.teamIds = [
    ...new Set([
      ...draft.transfers.flatMap((item) => [item.fromTeamId, item.toTeamId]),
      ...assumptions,
      ...(draft.transfers.length || assumptions.length
        ? []
        : [...original.teamIds, ...options.teamIds]),
    ]),
  ]
  draft.kind = draft.transfers.length ? "trade" : "scenario"
  const issues = proposalIssues(draft, catalogue)
  if (issues.length) throw new TradeDomainError(issues.join(" "))
  return draft
}
