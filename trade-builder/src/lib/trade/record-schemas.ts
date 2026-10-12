import { Schema } from "effect"
import type { TradeSearchConstraints } from "../../server/trade-search-constraints.ts"
import type { TradeSearchRequest } from "../../server/trade-discovery.ts"
import type {
  SearchSpecification,
  SearchRecord,
  ResultBatch,
  QuestionRecord,
  ExecutionRecord,
  ConversationRecords,
} from "../../server/conversation-records.ts"
import {
  SearchPositionSchema,
  TradeClarificationSchema,
} from "./chat-schemas.ts"
import {
  TradeReferenceSchema,
  TradeSnapshotSchema,
} from "./proposal-schemas.ts"
import { CatalogueSchema } from "./roster-schemas.ts"

export const TradeSearchConstraintsSchema = Schema.Struct({
  minAge: Schema.optional(Schema.Finite),
  maxAge: Schema.optional(Schema.Finite),
  minExperience: Schema.optional(Schema.Finite),
  maxExperience: Schema.optional(Schema.Finite),
  minYearsRemaining: Schema.optional(Schema.Finite),
  maxYearsRemaining: Schema.optional(Schema.Finite),
  excludeContractOptions: Schema.optional(Schema.Boolean),
  positions: Schema.optional(
    Schema.mutable(Schema.Array(SearchPositionSchema))
  ),
  maxIncomingSalary: Schema.optional(Schema.Finite),
  minSalarySavings: Schema.optional(Schema.Finite),
  maxTeamPayroll: Schema.optional(Schema.Finite),
}) satisfies Schema.Schema<TradeSearchConstraints>

export const TradeSearchRequestSchema = Schema.Struct({
  sourceTeamId: Schema.Finite,
  partnerTeamId: Schema.optional(Schema.Finite),
  outgoingCount: Schema.optional(Schema.Finite),
  incomingCount: Schema.optional(Schema.Finite),
  outgoingPlayerIds: Schema.optional(
    Schema.mutable(Schema.Array(Schema.Finite))
  ),
  excludedPlayerIds: Schema.optional(
    Schema.mutable(Schema.Array(Schema.Finite))
  ),
  excludedPackageKeys: Schema.optional(
    Schema.mutable(Schema.Array(Schema.String))
  ),
  constraints: Schema.optional(TradeSearchConstraintsSchema),
}) satisfies Schema.Schema<TradeSearchRequest>

export const SearchSpecificationSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("discovery"),
    request: TradeSearchRequestSchema,
  }),
  Schema.Struct({
    kind: Schema.Union([
      Schema.Literal("repair"),
      Schema.Literal("replacement"),
    ]),
    proposal: TradeReferenceSchema,
    request: Schema.Struct({
      excludedPackageKeys: Schema.optional(
        Schema.mutable(Schema.Array(Schema.String))
      ),
      keepPlayerIds: Schema.optional(
        Schema.mutable(Schema.Array(Schema.Finite))
      ),
      allowReplacements: Schema.optional(Schema.Boolean),
      replacementPlayerIds: Schema.optional(
        Schema.mutable(Schema.Array(Schema.Finite))
      ),
      sourceTeamId: Schema.optional(Schema.Finite),
      constraints: Schema.optional(TradeSearchConstraintsSchema),
    }),
  }),
]) satisfies Schema.Schema<SearchSpecification>

export const SearchRecordSchema = Schema.Struct({
  catalogueId: Schema.optional(Schema.String),
  expiresAt: Schema.optional(Schema.String),
  catalogue: Schema.optional(CatalogueSchema),
  base: Schema.optional(TradeSnapshotSchema),
  createdAt: Schema.optional(Schema.String),
  browseOrder: Schema.optional(
    Schema.Union([Schema.Literal("canonical"), Schema.Literal("varied")])
  ),
  pageCursor: Schema.optional(Schema.Finite),
  id: Schema.String,
  revision: Schema.Finite,
  goal: Schema.String,
  specification: SearchSpecificationSchema,
  messageId: Schema.String,
}) satisfies Schema.Schema<SearchRecord>

export const ResultBatchSchema = Schema.Struct({
  id: Schema.String,
  search: Schema.Union([Schema.String, Schema.Null]),
  proposals: Schema.mutable(Schema.Array(TradeReferenceSchema)),
  messageId: Schema.String,
}) satisfies Schema.Schema<ResultBatch>

export const QuestionRecordSchema = Schema.Struct({
  choices: Schema.optional(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          label: Schema.String,
          value: Schema.optional(Schema.String),
          reference: Schema.Union([Schema.String, Schema.Null]),
        })
      )
    )
  ),
  id: Schema.String,
  clarification: TradeClarificationSchema,
  originalMessage: Schema.String,
  context: Schema.String,
  references: Schema.mutable(Schema.Array(Schema.String)),
  status: Schema.Union([
    Schema.Literal("open"),
    Schema.Literal("answered"),
    Schema.Literal("cancelled"),
  ]),
  messageId: Schema.String,
}) satisfies Schema.Schema<QuestionRecord>

export const ExecutionRecordSchema = Schema.Struct({
  turnStatus: Schema.optional(
    Schema.Union([
      Schema.Literal("in_progress"),
      Schema.Literal("completed"),
      Schema.Literal("failed"),
    ])
  ),
  id: Schema.String,
  messageId: Schema.String,
  operation: Schema.String,
  references: Schema.mutable(Schema.Array(Schema.String)),
  arguments: Schema.Unknown,
  outcome: Schema.Unknown,
}) satisfies Schema.Schema<ExecutionRecord>

export const ConversationRecordsSchema = Schema.Struct({
  schema: Schema.Literal(1),
  searches: Schema.mutable(Schema.Array(SearchRecordSchema)),
  batches: Schema.mutable(Schema.Array(ResultBatchSchema)),
  questions: Schema.mutable(Schema.Array(QuestionRecordSchema)),
  executions: Schema.mutable(Schema.Array(ExecutionRecordSchema)),
  discussion: Schema.mutable(
    Schema.Array(
      Schema.Struct({ reference: Schema.String, messageId: Schema.String })
    )
  ),
}) satisfies Schema.Schema<ConversationRecords>
