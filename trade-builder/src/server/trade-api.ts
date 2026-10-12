import { TradeDomainError } from "./trade-errors.ts"
import { DateTime, Effect, Exit, Schema } from "effect"
import {
  TradeServiceRequestError,
  type TradeServiceResponse,
} from "./trade-service-http.ts"
import { InvalidContractOptionsError } from "./contract-options.ts"
import { TradeService } from "./trade-service.ts"
import { getTradeRuntime } from "./trade-runtime.ts"
import type { TradeRuntime } from "./trade-runtime.ts"
import type { ContractOptions } from "./contract-options.ts"

import {
  scenarioPlayerSalary,
  scenarioPayroll,
} from "../lib/trade/proposal-finances.ts"
import { linkedSigningScopeMessage } from "../lib/trade/signings.ts"
import { knownNBAExperience } from "../lib/trade/player-experience.ts"
import {
  signingTradeIssues,
  signingReviewReasons,
  signAndTradeApronIssues,
} from "./signing-validation.ts"
import { MAX_TRADE_TEAMS } from "../lib/trade/types.ts"
import teamLogoUrls from "../lib/trade/team-logo-urls.json" with { type: "json" }
import type {
  Catalogue,
  DraftPick,
  ContractYear,
  Player,
  Team,
  TradeProposal,
  TradeVerdict,
  TeamVerdict,
  DraftRight,
  TradeException,
  ScenarioSigning,
} from "../lib/trade/types"

export type { ContractOptions } from "./contract-options.ts"

export {
  scenarioPlayerSalary,
  scenarioPayroll,
} from "../lib/trade/proposal-finances.ts"

export class CatalogueError extends Schema.TaggedError<CatalogueError>()(
  "CatalogueError",
  { message: Schema.String, cause: Schema.Defect() }
) {}
const catalogueCaches = new WeakMap<
  TradeRuntime,
  {
    load: Effect.Effect<
      Catalogue,
      CatalogueError | TradeServiceRequestError,
      TradeService
    >
    invalidate: Effect.Effect<void>
  }
>()

const decodeObject = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.Unknown)
)
const decodeNumber = Schema.decodeUnknownSync(Schema.Finite)
const decodeString = Schema.decodeUnknownSync(Schema.String)
const decodeStrings = Schema.decodeUnknownSync(Schema.Array(Schema.String))
const decodeBoolean = Schema.decodeUnknownSync(Schema.Boolean)

export function object(value: unknown): Record<string, unknown> {
  try {
    return decodeObject(value)
  } catch {
    throw new TradeDomainError("Unexpected data received from trade service.")
  }
}

export function number(value: unknown): number {
  try {
    return decodeNumber(value)
  } catch {
    throw new TradeDomainError(
      "Unexpected numeric value received from trade service."
    )
  }
}

export function string(value: unknown): string {
  try {
    return decodeString(value)
  } catch {
    throw new TradeDomainError("Unexpected text received from trade service.")
  }
}

function strings(value: unknown): Array<string> {
  try {
    return [...decodeStrings(value)]
  } catch {
    throw new TradeDomainError(
      "Unexpected rule evidence received from trade service."
    )
  }
}

function boolean(value: unknown): boolean {
  try {
    return decodeBoolean(value)
  } catch {
    throw new TradeDomainError("Unexpected trade result.")
  }
}

export function get(
  path: string,
  signal?: AbortSignal,
  runtime: TradeRuntime = getTradeRuntime()
): Promise<unknown> {
  return runtime.runPromise(
    TradeService.use((service) => service.json(path)),
    { signal }
  )
}

function post(
  path: string,
  body: unknown,
  signal?: AbortSignal,
  timeoutMs = 15_000
): Promise<TradeServiceResponse> {
  return getTradeRuntime().runPromise(
    TradeService.use((service) => service.post(path, body, timeoutMs)),
    { signal }
  )
}

function normalizeTeam(raw: unknown): Team {
  const team = object(raw)
  return {
    id: number(team.id),
    name: string(team.name),
    abbreviation: string(team.abbreviation),
    logoUrl: (teamLogoUrls as Record<string, string>)[
      string(team.abbreviation)
    ],
    city: string(team.city),
    color: string(team.primaryColor),
    conference: string(team.conference),
    division: string(team.division),
    wins: number(team.wins),
    losses: number(team.losses),
    totalSalary: number(team.totalSalary),
    capSpace: number(team.capSpace),
    isOverCap: boolean(team.isOverCap),
    isOverLuxuryTax: boolean(team.isOverLuxuryTax),
    isOverFirstApron: boolean(team.isOverFirstApron),
    isOverSecondApron: boolean(team.isOverSecondApron),
  }
}

function normalizePlayer(raw: unknown): Player {
  const player = object(raw)
  const age = number(player.age)
  if (!Array.isArray(player.salaryByYear))
    throw new TradeDomainError("Unexpected contract data.")
  const contract: Array<ContractYear> = player.salaryByYear.map((rawYear) => {
    const year = object(rawYear)
    return {
      season: string(year.season),
      amount: number(year.amount),
      isEstimate: boolean(year.isEstimate),
    }
  })
  return {
    id: number(player.id),
    name: string(player.name),
    teamId: number(player.teamId),
    salary: number(player.salary),
    position: string(player.position),
    age,
    yearsExperience: knownNBAExperience({
      age,
      yearsExperience: number(player.yearsExperience),
    }),
    yearsRemaining: number(player.yearsRemaining),
    contractYears: number(player.contractYears),
    contractType: string(player.contractType),
    birdRightsType:
      player.birdRightsType == null ? undefined : string(player.birdRightsType),
    noTradeClause: boolean(player.noTradeClause),
    playerOption: boolean(player.playerOption),
    teamOption: boolean(player.teamOption),
    signingStatus: string(player.signingStatus),
    contract,
  }
}

export function normalizeDraftPick(raw: unknown): DraftPick {
  const pick = object(raw)
  const round = number(pick.round)
  if (round !== 1 && round !== 2)
    throw new TradeDomainError("Unexpected draft round.")
  const id = number(pick.id),
    originalTeamId = number(pick.originalTeamId),
    currentTeamId = number(pick.currentTeamId),
    year = number(pick.year)
  if (
    ![id, originalTeamId, currentTeamId, year].every(
      (value) => Number.isSafeInteger(value) && value > 0
    )
  )
    throw new TradeDomainError("Unexpected pick identity.")
  return {
    id,
    originalTeamId,
    currentTeamId,
    year,
    round,
    isProtected: boolean(pick.isProtected),
    protectionDetails:
      pick.protectionDetails == null ? null : string(pick.protectionDetails),
    isSwap: boolean(pick.isSwap),
    isTradable: boolean(pick.isTradable),
  }
}

const readCatalogue = Effect.fn("readCatalogue")(function* () {
  const service = yield* TradeService
  const normalize = <T>(operation: () => T) =>
    Effect.try({
      try: operation,
      catch: (cause) =>
        new CatalogueError({ message: "Unexpected roster data.", cause }),
    })
  const optional = <T>(
    program: Effect.Effect<T, CatalogueError | TradeServiceRequestError>
  ) =>
    program.pipe(
      Effect.catch((error) =>
        Effect.logWarning("Optional roster data unavailable", {
          failure: error._tag,
        }).pipe(Effect.as(undefined))
      )
    )
  const [teams, players, rawCap, picks, rights, exceptions] = yield* Effect.all(
    [
      service.json("teams"),
      service.json("players"),
      service.json("salary-cap"),
      service.json("draft-picks"),
      optional(
        service
          .json("draft-rights")
          .pipe(
            Effect.flatMap((raw) => normalize(() => normalizeDraftRights(raw)))
          )
      ),
      optional(
        service
          .json("salary-cap/teams")
          .pipe(
            Effect.flatMap((raw) =>
              normalize(() => normalizeTradeExceptions(raw))
            )
          )
      ),
    ],
    { concurrency: 6 }
  )
  const fetchedAt = DateTime.formatIso(yield* DateTime.now)
  return yield* normalize((): Catalogue => {
    const cap = object(rawCap)
    const decodeList = Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))
    return {
      teams: decodeList(teams).map(normalizeTeam),
      players: decodeList(players).map(normalizePlayer),
      draftPicks: decodeList(picks).map(normalizeDraftPick),
      draftRights: rights,
      tradeExceptions: exceptions,
      cap: {
        season: string(cap.season),
        salaryCap: number(cap.salaryCap),
        luxuryTaxLine: number(cap.luxuryTaxLine),
        firstApron: number(cap.firstApron),
        secondApron: number(cap.secondApron),
      },
      fetchedAt,
      source: "bball-gm",
      synthetic: true,
    }
  })
})

export function loadCatalogue(
  refresh = false,
  signal?: AbortSignal,
  runtime: TradeRuntime = getTradeRuntime()
): Promise<Catalogue> {
  let cache = catalogueCaches.get(runtime)
  if (!cache) {
    const [load, invalidate] = Effect.runSync(
      Effect.cachedInvalidateWithTTL(readCatalogue(), (exit) =>
        Exit.isSuccess(exit) ? "5 minutes" : 0
      )
    )
    cache = { load, invalidate }
    catalogueCaches.set(runtime, cache)
  }
  return runtime.runPromise(
    refresh ? Effect.andThen(cache.invalidate, cache.load) : cache.load,
    { signal }
  )
}

export function playerTradeIssues(player: Player): Array<string> {
  const issues: Array<string> = []
  if (
    player.signingStatus !== "active" ||
    player.contractType === "two-way" ||
    player.contractType === "stretch-and-waive"
  )
    issues.push(
      `${player.name}'s contract status isn’t supported for trades yet.`
    )
  if (player.noTradeClause)
    issues.push(
      `${player.name} has a no-trade clause; consent must be resolved before this trade can be checked.`
    )
  return issues
}

export function proposalIssues(
  proposal: TradeProposal,
  catalogue: Catalogue,
  options: { allowEmptyTeams?: boolean } = {}
): Array<string> {
  const issues: Array<string> = []
  const teamIds = new Set(proposal.teamIds)
  if (
    proposal.teamIds.length < (proposal.transfers.length ? 2 : 1) ||
    proposal.teamIds.length > MAX_TRADE_TEAMS ||
    teamIds.size !== proposal.teamIds.length
  )
    issues.push("Choose two to four different teams.")
  if (
    !proposal.transfers.length &&
    !proposal.salaryOverrides?.length &&
    !proposal.signings?.length &&
    proposal.kind !== "scenario"
  )
    issues.push("Add at least one player or pick to the trade.")
  for (const id of teamIds) {
    if (
      !options.allowEmptyTeams &&
      proposal.transfers.length > 0 &&
      !proposal.transfers.some(
        (transfer) => transfer.fromTeamId === id || transfer.toTeamId === id
      )
    )
      issues.push(
        `Add a transfer involving ${catalogue.teams.find((team) => team.id === id)?.name ?? `team ${id}`}, or remove that team.`
      )
    if (!catalogue.teams.some((team) => team.id === id))
      issues.push(`Unknown team ${id}.`)
  }
  const seen = new Set<string>()
  for (const transfer of proposal.transfers) {
    const key = `${transfer.assetType}:${transfer.assetId}`
    if (seen.has(key)) issues.push("An asset can only appear once in a trade.")
    seen.add(key)
    let name: string, owner: number
    if (transfer.assetType === "pick") {
      const pick = catalogue.draftPicks?.find(
        (item) => item.id === transfer.assetId
      )
      if (!pick) {
        issues.push(`Unknown pick ${transfer.assetId}.`)
        continue
      }
      name = `${pick.year} round ${pick.round} pick`
      owner = pick.currentTeamId
      if (pick.isSwap)
        issues.push(`${name} has swap rights, which aren’t supported yet.`)
      if (!pick.isTradable)
        issues.push(
          `${name} cannot be traded${pick.protectionDetails ? `: ${pick.protectionDetails}` : "."}`
        )
    } else if (transfer.assetType === "draft_right") {
      const right = catalogue.draftRights?.find(
        (item) => item.id === transfer.assetId
      )
      if (!right) {
        issues.push("Unknown draft rights.")
        continue
      }
      name = `${right.playerName} draft rights`
      owner = right.currentTeamId
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Reject unknown runtime asset types.
    } else if (transfer.assetType === "player") {
      const player = catalogue.players.find(
        (item) => item.id === transfer.assetId
      )
      if (!player) {
        issues.push(`Unknown player ${transfer.assetId}.`)
        continue
      }
      name = player.name
      const signing = proposal.signings?.find(
        (item) => item.playerId === player.id
      )
      owner = signing?.signingTeamId ?? player.teamId
      issues.push(
        ...playerTradeIssues(
          signing
            ? {
                ...player,
                signingStatus: "active",
                contractType: signing.contractType,
              }
            : player
        )
      )
      if (
        proposal.salaryOverrides?.some(
          (item) => item.playerId === player.id && item.isStretchAndWaive
        )
      )
        issues.push(
          `${player.name} is waived in this scenario and cannot be traded.`
        )
    } else {
      issues.push("Unknown trade asset type.")
      continue
    }
    if (transfer.fromTeamId !== owner)
      issues.push(`${name} does not belong to the sending team.`)
    if (!teamIds.has(transfer.fromTeamId) || !teamIds.has(transfer.toTeamId))
      issues.push(`${name} must move between the selected teams.`)
    if (transfer.fromTeamId === transfer.toTeamId)
      issues.push(`${name} needs a different receiving team.`)
  }
  issues.push(...scenarioIssues(proposal, catalogue))
  return [...new Set(issues)]
}

export function validationPayload(proposal: TradeProposal) {
  return {
    teams: proposal.teamIds.map((teamId) => ({
      teamId,
      sendingPlayerIds: proposal.transfers
        .filter(
          (item) => item.assetType === "player" && item.fromTeamId === teamId
        )
        .map((item) => item.assetId),
      receivingPlayerIds: proposal.transfers
        .filter(
          (item) => item.assetType === "player" && item.toTeamId === teamId
        )
        .map((item) => item.assetId),
      sendingPickIds: proposal.transfers
        .filter(
          (item) => item.assetType === "pick" && item.fromTeamId === teamId
        )
        .map((item) => item.assetId),
      ...(proposal.exceptions?.find((item) => item.teamId === teamId)
        ? {
            usingExceptionId: proposal.exceptions.find(
              (item) => item.teamId === teamId
            )!.exceptionId,
          }
        : {}),
      // The service's isSignAndTrade flag wrongly rejects salary received by the
      // signing team, even below the first apron. SignedFreeAgents still supplies
      // ownership and salary; local checks enforce actual recipient restrictions.
      ...(proposal.transfers.some((item) => item.assetType === "draft_right")
        ? {
            sendingDraftRightIds: proposal.transfers
              .filter(
                (item) =>
                  item.assetType === "draft_right" && item.fromTeamId === teamId
              )
              .map((item) => item.assetId),
            receivingDraftRightIds: proposal.transfers
              .filter(
                (item) =>
                  item.assetType === "draft_right" && item.toTeamId === teamId
              )
              .map((item) => item.assetId),
          }
        : {}),
      receivingPickIds: proposal.transfers
        .filter((item) => item.assetType === "pick" && item.toTeamId === teamId)
        .map((item) => item.assetId),
    })),
    ...(proposal.salaryOverrides?.length
      ? {
          salaryOverrides: proposal.salaryOverrides.map(
            ({ playerId, salary }) => ({ playerId, salary })
          ),
        }
      : {}),
    ...(proposal.signings?.length
      ? {
          signedFreeAgents: proposal.signings.map(
            ({
              playerId,
              signingTeamId,
              salary,
              contractYears,
              contractType,
            }) => ({
              playerId,
              signingTeamId,
              salary,
              contractYears,
              contractType,
            })
          ),
        }
      : {}),
  }
}

function normalizeTeamVerdict(raw: unknown): TeamVerdict {
  const team = object(raw)
  return {
    teamId: number(team.teamId),
    teamName: string(team.teamName),
    salaryOut: number(team.salaryOut),
    salaryIn: number(team.salaryIn),
    netSalaryChange: number(team.netSalaryChange),
    newTotalSalary: number(team.newTotalSalary),
    newCapStatus: string(team.newCapStatus),
    isValid: boolean(team.isValid),
    violations: strings(team.violations),
    allowances: strings(team.allowances),
  }
}

export async function evaluateProposal(
  proposal: TradeProposal,
  catalogue: Catalogue,
  signal?: AbortSignal
): Promise<TradeVerdict> {
  const base = {
    proposalId: proposal.proposalId,
    revision: proposal.revision,
    evaluatedAt: new Date().toISOString(),
    dataFetchedAt: catalogue.fetchedAt,
    season: catalogue.cap.season,
    source: "bball-gm" as const,
  }
  const issues = proposalIssues(proposal, catalogue)
  if (issues.length) {
    return {
      ...base,
      status: "invalid_proposal",
      summary: issues[0],
      issues,
      teams: [],
      appliedRules: [],
    }
  }
  try {
    for (const signing of proposal.signings ?? []) {
      const result = await checkSigning(
        signing.playerId,
        signing.signingTeamId,
        signing.salary,
        signing.contractYears,
        signal
      )
      if ("error" in result)
        return {
          ...base,
          status: "invalid_trade",
          rejectionEvidence: "signing_rules",
          summary: result.error,
          issues: [result.error],
          teams: [],
          appliedRules: [],
        }
      if (result.contractType !== signing.contractType)
        throw new TradeDomainError("Signing contract changed.")
    }
    if (!proposal.transfers.length)
      return evaluateStandaloneScenario(proposal, catalogue, base)
    const response = await post(
      "trades/validate",
      validationPayload(proposal),
      signal
    )
    const body = object(response.body)
    // These observed pick-rule rejections are distinct from schema/service errors.
    if (
      response.status === 400 &&
      proposal.transfers.some((item) => item.assetType === "pick") &&
      typeof body.error === "string" &&
      /^(?:Stepien Rule violation:|\d{4} Rd[12] pick cannot be traded)/.test(
        body.error
      )
    ) {
      return {
        ...base,
        status: "invalid_trade",
        rejectionEvidence: "pick_rules",
        summary: body.error,
        teams: [],
        appliedRules: [],
        issues: [body.error],
      }
    }
    // Only the recognized structured verdict establishes a rules result.
    // Schema errors and unfamiliar HTTP 400 bodies remain unavailable.
    if (!Array.isArray(body.teams))
      throw new TradeDomainError(
        "Trade service returned an unrecognized verdict."
      )
    const isValid = boolean(body.isValid)
    const teams = body.teams.map(normalizeTeamVerdict)
    const returnedIds = new Set(teams.map((team) => team.teamId))
    if (
      teams.length !== proposal.teamIds.length ||
      proposal.teamIds.some((id) => !returnedIds.has(id))
    )
      throw new TradeDomainError("Trade service returned mismatched teams.")
    for (const team of teams) {
      const outgoing = proposal.transfers
        .filter(
          (item) =>
            item.assetType === "player" && item.fromTeamId === team.teamId
        )
        .reduce(
          (sum, item) =>
            sum + scenarioPlayerSalary(proposal, catalogue, item.assetId),
          0
        )
      const incoming = proposal.transfers
        .filter(
          (item) => item.assetType === "player" && item.toTeamId === team.teamId
        )
        .reduce(
          (sum, item) =>
            sum + scenarioPlayerSalary(proposal, catalogue, item.assetId),
          0
        )
      const payrollBeforeTrade = scenarioPayroll(
        proposal,
        catalogue,
        team.teamId
      )
      if (
        payrollBeforeTrade === undefined ||
        team.newTotalSalary !== payrollBeforeTrade + incoming - outgoing
      )
        throw new TradeDomainError(
          "Trade service payroll evidence does not match the combined proposal."
        )
      if (
        team.salaryOut !== outgoing ||
        team.salaryIn !== incoming ||
        team.netSalaryChange !== incoming - outgoing
      )
        throw new TradeDomainError(
          "Trade service salary evidence does not match the proposal."
        )
    }
    if (!response.ok && response.status !== 400)
      throw new TradeDomainError("Trade service unavailable.")
    if (isValid && (!response.ok || teams.some((team) => !team.isValid)))
      throw new TradeDomainError(
        "Trade service returned inconsistent evidence."
      )
    const apronIssues = signAndTradeApronIssues(proposal, catalogue, teams)
    for (const issue of apronIssues) {
      const team = teams.find((item) => item.teamId === issue.teamId)!
      team.isValid = false
      team.violations = [...new Set([...team.violations, issue.message])]
    }
    const passing = isValid && !apronIssues.length
    const limitations = signingReviewReasons(proposal, catalogue)
    return {
      ...base,
      status: passing
        ? limitations.length
          ? "validation_incomplete"
          : "valid"
        : "invalid_trade",
      summary:
        passing && limitations.length
          ? "The available salary checks passed. Some signing requirements could not be checked."
          : (apronIssues[0]?.message ??
            (isValid &&
            proposal.transfers.some((item) => item.assetType === "pick")
              ? `This trade passes the ${catalogue.cap.season} salary and roster checks. Pick ownership and availability were checked; existing protections are retained.`
              : string(body.summary))),
      teams,
      appliedRules: strings(body.appliedRules),
      issues: [],
      ...(limitations.length ? { limitations } : {}),
    }
  } catch (cause) {
    signal?.throwIfAborted()
    if (!(
      cause instanceof TradeDomainError ||
      cause instanceof TradeServiceRequestError ||
      cause instanceof InvalidContractOptionsError
    ))
      throw cause
    return {
      ...base,
      status: "validation_unavailable",
      summary: "The trade service could not check this proposal. Try again.",
      teams: [],
      appliedRules: [],
      issues: [],
    }
  }
}

export function normalizeDraftRights(raw: unknown): Array<DraftRight> {
  if (!Array.isArray(raw))
    throw new TradeDomainError("Draft rights unavailable.")
  return raw.map((value) => {
    const right = object(value)
    return {
      id: number(right.id),
      playerName: string(right.playerName),
      currentTeamId: number(right.currentTeamId),
      draftYear: number(right.draftYear),
      overseasTeam:
        right.overseasTeam == null ? undefined : string(right.overseasTeam),
    }
  })
}
export function normalizeTradeExceptions(raw: unknown): Array<TradeException> {
  if (!Array.isArray(raw))
    throw new TradeDomainError("Trade exceptions unavailable.")
  return raw.flatMap((value) => {
    const team = object(value)
    if (!Array.isArray(team.tradeExceptions))
      throw new TradeDomainError("Trade exceptions unavailable.")
    return team.tradeExceptions.map((entry) => {
      const exception = object(entry)
      return {
        id: number(exception.id),
        teamId: number(team.teamId),
        amount: number(exception.amount),
        expiresAt: string(exception.expiresDate),
      }
    })
  })
}

/** The team endpoint supplies the originating player omitted by the league index. */
export async function readTradeExceptions(
  teamId: number,
  catalogue: Catalogue,
  signal?: AbortSignal
): Promise<TradeException[]> {
  const data = object(await get(`teams/${teamId}`, signal))
  if (number(data.id) !== teamId || !Array.isArray(data.tradeExceptions))
    throw new TradeDomainError(
      "Trade-exception data is temporarily unavailable."
    )
  return data.tradeExceptions.map((entry) => {
    const raw = object(entry)
    const saved = catalogue.tradeExceptions?.find(
      (item) => item.id === number(raw.id) && item.teamId === teamId
    )
    if (
      !saved ||
      saved.amount !== number(raw.amount) ||
      Date.parse(saved.expiresAt) !== Date.parse(string(raw.expiresAt))
    )
      throw new TradeDomainError(
        "Trade-exception data changed. Refresh the catalogue before applying one."
      )
    return { ...saved, playerName: string(raw.playerName) }
  })
}
export function scenarioIssues(
  proposal: TradeProposal,
  catalogue: Catalogue
): Array<string> {
  const issues: Array<string> = []
  const overrides = proposal.salaryOverrides ?? [],
    signings = proposal.signings ?? [],
    exceptions = proposal.exceptions ?? []
  const duplicate = (ids: Array<number>) => new Set(ids).size !== ids.length
  if (
    duplicate(overrides.map((item) => item.playerId)) ||
    duplicate(signings.map((item) => item.playerId)) ||
    duplicate(exceptions.map((item) => item.teamId))
  )
    issues.push("Scenario entries must be unique.")
  for (const item of overrides) {
    const player = catalogue.players.find(
      (candidate) => candidate.id === item.playerId
    )
    if (
      !player ||
      !proposal.teamIds.includes(
        signings.find((signing) => signing.playerId === item.playerId)
          ?.signingTeamId ?? player.teamId
      )
    )
      issues.push("Salary edits must belong to a participating team.")
    if (
      !Number.isSafeInteger(item.salary) ||
      item.salary < 0 ||
      !Number.isSafeInteger(item.yearsRemaining) ||
      item.yearsRemaining < 0 ||
      item.yearsRemaining > 15
    )
      issues.push(
        "Use a non-negative whole-dollar salary and zero to fifteen remaining years."
      )
    if (
      player &&
      (player.contractType === "two-way" ||
        (player.signingStatus === "free-agent" &&
          !signings.some((signing) => signing.playerId === player.id)))
    )
      issues.push(
        "Sign this free agent before editing the contract; two-way contracts are not supported for this scenario."
      )
    if (
      item.isStretchAndWaive &&
      (item.yearsRemaining < 1 || player?.contractType === "stretch-and-waive")
    )
      issues.push("This contract cannot be stretched again.")
  }
  for (const item of signings) {
    const player = catalogue.players.find(
      (candidate) => candidate.id === item.playerId
    )
    if (!player || player.signingStatus !== "free-agent")
      issues.push("Only catalogue free agents can be signed.")
    if (!proposal.teamIds.includes(item.signingTeamId))
      issues.push("Include the signing team in this scenario.")
    if (
      !Number.isSafeInteger(item.salary) ||
      item.salary <= 0 ||
      !Number.isSafeInteger(item.contractYears) ||
      item.contractYears < 1 ||
      item.contractYears > 5 ||
      !item.contractType ||
      item.contractType === "two-way"
    )
      issues.push(
        "Use a positive whole-dollar signing salary and one to five years."
      )
  }
  for (const item of exceptions) {
    const exception = catalogue.tradeExceptions?.find(
      (candidate) =>
        candidate.id === item.exceptionId && candidate.teamId === item.teamId
    )
    if (!exception || !proposal.teamIds.includes(item.teamId))
      issues.push(
        "Choose an available exception belonging to a participating team."
      )
    else if (
      !Number.isFinite(Date.parse(exception.expiresAt)) ||
      Date.parse(exception.expiresAt) <= Date.now()
    )
      issues.push("This trade exception has expired.")
  }
  issues.push(...signingTradeIssues(proposal, catalogue))
  return issues
}

export function contractOptions(
  playerId: number,
  teamId: number,
  signal?: AbortSignal,
  runtime: TradeRuntime = getTradeRuntime()
): Promise<ContractOptions> {
  return runtime.runPromise(
    TradeService.use((service) => service.contractOptions(playerId, teamId)),
    { signal }
  )
}
/** The upstream endpoint checks a hypothetical contract; it does not change its roster. */
export async function checkSigning(
  playerId: number,
  teamId: number,
  salary: number,
  years: number,
  signal?: AbortSignal
): Promise<ScenarioSigning | { error: string }> {
  const response = await post(
    `players/${playerId}/sign`,
    { teamId, firstYearSalary: salary, years },
    signal,
    12_000
  )
  const body = object(response.body)
  if (!response.ok) {
    if (response.status === 400 && typeof body.error === "string")
      return { error: body.error }
    throw new TradeDomainError("Signing checks are temporarily unavailable.")
  }
  if (
    number(body.id) !== playerId ||
    number(body.teamId) !== teamId ||
    number(body.salary) !== salary ||
    number(body.contractYears) !== years ||
    string(body.signingStatus) !== "active"
  )
    throw new TradeDomainError("Signing evidence does not match this contract.")
  return {
    playerId,
    signingTeamId: teamId,
    salary,
    contractYears: years,
    contractType: string(body.contractType),
  }
}

function evaluateStandaloneScenario(
  proposal: TradeProposal,
  catalogue: Catalogue,
  base: Pick<
    TradeVerdict,
    | "proposalId"
    | "revision"
    | "evaluatedAt"
    | "dataFetchedAt"
    | "season"
    | "source"
  >
): TradeVerdict {
  // This reports payroll arithmetic and individual checked contracts, never a trade verdict.
  const teams = proposal.teamIds.map((teamId) => {
    const team = catalogue.teams.find((candidate) => candidate.id === teamId)!
    if (team.totalSalary === undefined)
      throw new TradeDomainError("Payroll data unavailable.")
    const newTotalSalary = scenarioPayroll(proposal, catalogue, teamId)!
    return {
      teamId,
      teamName: team.name,
      salaryOut: 0,
      salaryIn: 0,
      netSalaryChange: newTotalSalary - team.totalSalary,
      newTotalSalary,
      newCapStatus:
        newTotalSalary > catalogue.cap.secondApron
          ? "Over Second Apron"
          : newTotalSalary > catalogue.cap.firstApron
            ? "Over First Apron"
            : newTotalSalary > catalogue.cap.luxuryTaxLine
              ? "Over Luxury Tax"
              : newTotalSalary > catalogue.cap.salaryCap
                ? "Over Cap"
                : "Under Cap",
      isValid: true,
      violations: [],
      allowances: [],
    }
  })
  return {
    ...base,
    status: "valid",
    summary: proposal.signings?.length
      ? proposal.relatedTrade
        ? linkedSigningScopeMessage
        : "Signing contracts checked using the team’s current payroll."
      : "Hypothetical payroll updated. Waiver timing and other contract restrictions have not been checked.",
    teams,
    appliedRules: [],
    issues: [],
  }
}
