import { Schema } from "effect"
import type {
  Team,
  ContractYear,
  Player,
  DraftPick,
  DraftRight,
  TradeException,
  SalaryCap,
  Catalogue,
  CatalogueResult,
} from "./types.ts"

export const TeamSchema = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  abbreviation: Schema.String,
  city: Schema.optional(Schema.String),
  color: Schema.optional(Schema.String),
  logoUrl: Schema.optional(Schema.String),
  conference: Schema.optional(Schema.String),
  division: Schema.optional(Schema.String),
  wins: Schema.optional(Schema.Finite),
  losses: Schema.optional(Schema.Finite),
  totalSalary: Schema.optional(Schema.Finite),
  capSpace: Schema.optional(Schema.Finite),
  isOverCap: Schema.optional(Schema.Boolean),
  isOverLuxuryTax: Schema.optional(Schema.Boolean),
  isOverFirstApron: Schema.optional(Schema.Boolean),
  isOverSecondApron: Schema.optional(Schema.Boolean),
}) satisfies Schema.Schema<Team>

export const ContractYearSchema = Schema.Struct({
  season: Schema.String,
  amount: Schema.Finite,
  isEstimate: Schema.Boolean,
}) satisfies Schema.Schema<ContractYear>

export const PlayerSchema = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  teamId: Schema.Finite,
  position: Schema.optional(Schema.String),
  age: Schema.optional(Schema.Finite),
  yearsExperience: Schema.optional(Schema.Finite),
  salary: Schema.Finite,
  yearsRemaining: Schema.optional(Schema.Finite),
  contractYears: Schema.optional(Schema.Finite),
  contractType: Schema.optional(Schema.String),
  birdRightsType: Schema.optional(Schema.String),
  noTradeClause: Schema.optional(Schema.Boolean),
  playerOption: Schema.optional(Schema.Boolean),
  teamOption: Schema.optional(Schema.Boolean),
  signingStatus: Schema.optional(Schema.String),
  contract: Schema.optional(Schema.mutable(Schema.Array(ContractYearSchema))),
  height: Schema.optional(Schema.String),
}) satisfies Schema.Schema<Player>

export const DraftPickSchema = Schema.Struct({
  id: Schema.Finite,
  originalTeamId: Schema.Finite,
  currentTeamId: Schema.Finite,
  year: Schema.Finite,
  round: Schema.Union([Schema.Literal(1), Schema.Literal(2)]),
  isProtected: Schema.Boolean,
  protectionDetails: Schema.Union([Schema.String, Schema.Null]),
  isSwap: Schema.Boolean,
  isTradable: Schema.Boolean,
}) satisfies Schema.Schema<DraftPick>

export const DraftRightSchema = Schema.Struct({
  id: Schema.Finite,
  playerName: Schema.String,
  currentTeamId: Schema.Finite,
  draftYear: Schema.Finite,
  overseasTeam: Schema.optional(Schema.String),
}) satisfies Schema.Schema<DraftRight>

export const TradeExceptionSchema = Schema.Struct({
  id: Schema.Finite,
  teamId: Schema.Finite,
  playerName: Schema.optional(Schema.String),
  amount: Schema.Finite,
  expiresAt: Schema.String,
}) satisfies Schema.Schema<TradeException>

export const SalaryCapSchema = Schema.Struct({
  season: Schema.String,
  salaryCap: Schema.Finite,
  luxuryTaxLine: Schema.Finite,
  firstApron: Schema.Finite,
  secondApron: Schema.Finite,
}) satisfies Schema.Schema<SalaryCap>

export const CatalogueSchema = Schema.Struct({
  teams: Schema.mutable(Schema.Array(TeamSchema)),
  players: Schema.mutable(Schema.Array(PlayerSchema)),
  draftPicks: Schema.optional(Schema.mutable(Schema.Array(DraftPickSchema))),
  draftRights: Schema.optional(Schema.mutable(Schema.Array(DraftRightSchema))),
  tradeExceptions: Schema.optional(
    Schema.mutable(Schema.Array(TradeExceptionSchema))
  ),
  cap: SalaryCapSchema,
  fetchedAt: Schema.String,
  source: Schema.Literal("bball-gm"),
  synthetic: Schema.Literal(true),
}) satisfies Schema.Schema<Catalogue>

export const CatalogueResultSchema = Schema.Struct({
  status: Schema.Literals(["available", "unavailable"]),
  catalogue: Schema.NullOr(CatalogueSchema),
  message: Schema.optional(Schema.String),
}) satisfies Schema.Schema<CatalogueResult>
