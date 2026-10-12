import { Schema } from "effect"
import type {
  TradeReference,
  PlayerTransfer,
  PickTransfer,
  DraftRightTransfer,
  AssetTransfer,
  SalaryOverride,
  ScenarioSigning,
  TradeProposal,
  VerdictStatus,
  TeamVerdict,
  TradeVerdict,
  TradeSnapshot,
} from "./types.ts"

export const TradeReferenceSchema = Schema.Struct({
  proposalId: Schema.String,
  revision: Schema.Finite,
}) satisfies Schema.Schema<TradeReference>

export const PlayerTransferSchema = Schema.Struct({
  assetType: Schema.Literal("player"),
  assetId: Schema.Finite,
  fromTeamId: Schema.Finite,
  toTeamId: Schema.Finite,
}) satisfies Schema.Schema<PlayerTransfer>

export const PickTransferSchema = Schema.Struct({
  assetType: Schema.Literal("pick"),
  assetId: Schema.Finite,
  fromTeamId: Schema.Finite,
  toTeamId: Schema.Finite,
}) satisfies Schema.Schema<PickTransfer>

export const DraftRightTransferSchema = Schema.Struct({
  assetType: Schema.Literal("draft_right"),
  assetId: Schema.Finite,
  fromTeamId: Schema.Finite,
  toTeamId: Schema.Finite,
}) satisfies Schema.Schema<DraftRightTransfer>

export const AssetTransferSchema = Schema.Union([
  PlayerTransferSchema,
  PickTransferSchema,
  DraftRightTransferSchema,
]) satisfies Schema.Schema<AssetTransfer>

export const SalaryOverrideSchema = Schema.Struct({
  playerId: Schema.Finite,
  salary: Schema.Finite,
  yearsRemaining: Schema.Finite,
  isStretchAndWaive: Schema.optional(Schema.Boolean),
}) satisfies Schema.Schema<SalaryOverride>

export const ScenarioSigningSchema = Schema.Struct({
  tierId: Schema.optional(Schema.String),
  fundingLabel: Schema.optional(Schema.String),
  firstYearGuaranteed: Schema.optional(Schema.Boolean),
  playerId: Schema.Finite,
  signingTeamId: Schema.Finite,
  salary: Schema.Finite,
  contractYears: Schema.Finite,
  contractType: Schema.String,
}) satisfies Schema.Schema<ScenarioSigning>

export const TradeProposalSchema = Schema.Struct({
  kind: Schema.optional(
    Schema.Union([Schema.Literal("trade"), Schema.Literal("scenario")])
  ),
  parent: Schema.optional(TradeReferenceSchema),
  relatedTrade: Schema.optional(TradeReferenceSchema),
  proposalId: Schema.String,
  revision: Schema.Finite,
  teamIds: Schema.mutable(Schema.Array(Schema.Finite)),
  transfers: Schema.mutable(Schema.Array(AssetTransferSchema)),
  salaryOverrides: Schema.optional(
    Schema.mutable(Schema.Array(SalaryOverrideSchema))
  ),
  signings: Schema.optional(
    Schema.mutable(Schema.Array(ScenarioSigningSchema))
  ),
  exceptions: Schema.optional(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          teamId: Schema.Finite,
          exceptionId: Schema.Finite,
          sourcePlayerName: Schema.optional(Schema.String),
        })
      )
    )
  ),
  createdAt: Schema.String,
}) satisfies Schema.Schema<TradeProposal>

export const VerdictStatusSchema = Schema.Union([
  Schema.Literal("valid"),
  Schema.Literal("invalid_trade"),
  Schema.Literal("invalid_proposal"),
  Schema.Literal("validation_unavailable"),
  Schema.Literal("validation_incomplete"),
]) satisfies Schema.Schema<VerdictStatus>

export const TeamVerdictSchema = Schema.Struct({
  teamId: Schema.Finite,
  teamName: Schema.String,
  salaryOut: Schema.Finite,
  salaryIn: Schema.Finite,
  netSalaryChange: Schema.Finite,
  newTotalSalary: Schema.Finite,
  newCapStatus: Schema.String,
  isValid: Schema.Boolean,
  violations: Schema.mutable(Schema.Array(Schema.String)),
  allowances: Schema.mutable(Schema.Array(Schema.String)),
}) satisfies Schema.Schema<TeamVerdict>

export const TradeVerdictSchema = Schema.Struct({
  rejectionEvidence: Schema.optional(
    Schema.Union([
      Schema.Literal("pick_rules"),
      Schema.Literal("signing_rules"),
    ])
  ),
  limitations: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  status: VerdictStatusSchema,
  proposalId: Schema.String,
  revision: Schema.Finite,
  summary: Schema.String,
  teams: Schema.mutable(Schema.Array(TeamVerdictSchema)),
  appliedRules: Schema.mutable(Schema.Array(Schema.String)),
  issues: Schema.mutable(Schema.Array(Schema.String)),
  evaluatedAt: Schema.String,
  dataFetchedAt: Schema.String,
  season: Schema.String,
  source: Schema.Literal("bball-gm"),
}) satisfies Schema.Schema<TradeVerdict>

export const TradeSnapshotSchema = Schema.Struct({
  proposal: TradeProposalSchema,
  verdict: Schema.Union([TradeVerdictSchema, Schema.Null]),
}) satisfies Schema.Schema<TradeSnapshot>
