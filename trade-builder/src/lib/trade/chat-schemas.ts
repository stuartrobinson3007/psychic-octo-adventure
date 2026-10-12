import { Schema } from "effect"
import type { SearchPosition } from "../../server/trade-search-constraints.ts"
import type { SelectionLimits } from "../selection-limits.ts"
import type {
  TradeIdea,
  ClarificationOption,
  TradeClarification,
  ToolActivity,
  ConversationMessage,
  ChatTurnResult,
  ClarificationAnswer,
  ChatTurnInput,
  ConversationView,
  TradeIdeaPage,
} from "./types.ts"
import type { MessagePickReference } from "../message-pick-references.ts"
import type { MessagePlayerReference } from "../message-player-references.ts"
import {
  TradeProposalSchema,
  TradeSnapshotSchema,
  TradeReferenceSchema,
} from "./proposal-schemas.ts"

export const SearchPositionSchema = Schema.Union([
  Schema.Literal("PG"),
  Schema.Literal("SG"),
  Schema.Literal("SF"),
  Schema.Literal("PF"),
  Schema.Literal("C"),
]) satisfies Schema.Schema<SearchPosition>

export const SelectionLimitsSchema = Schema.Struct({
  min: Schema.Finite,
  max: Schema.Finite,
}) satisfies Schema.Schema<SelectionLimits>

export const TradeIdeaSchema = Schema.Struct({
  reference: Schema.String,
  proposal: TradeProposalSchema,
  perspectiveTeamId: Schema.Finite,
}) satisfies Schema.Schema<TradeIdea>

export const ClarificationOptionSchema = Schema.Struct({
  tradeIdea: Schema.optional(TradeIdeaSchema),
  teamId: Schema.optional(Schema.Finite),
  searchText: Schema.optional(Schema.String),
  destination: Schema.optional(
    Schema.Struct({ playerId: Schema.Finite, toTeamId: Schema.Finite })
  ),
  action: Schema.optional(Schema.Literal("find_trade_options")),
  id: Schema.String,
  label: Schema.String,
  detail: Schema.optional(Schema.String),
  value: Schema.String,
  playerId: Schema.optional(Schema.Finite),
}) satisfies Schema.Schema<ClarificationOption>

export const TradeIdeaPageSchema = Schema.Struct({
  status: Schema.optional(Schema.Literal("expired")),
  expiresAt: Schema.optional(Schema.String),
  total: Schema.optional(Schema.NullOr(Schema.Finite)),
  options: Schema.mutable(Schema.Array(ClarificationOptionSchema)),
  nextCursor: Schema.NullOr(Schema.Finite),
}) satisfies Schema.Schema<TradeIdeaPage>

export const TradeClarificationSchema = Schema.Struct({
  tradeSearch: Schema.optional(
    Schema.Struct({
      query: Schema.optional(Schema.String),
      expiresAt: Schema.optional(Schema.String),
      reference: Schema.String,
      nextCursor: Schema.Union([Schema.Finite, Schema.Null]),
      total: Schema.optional(Schema.Union([Schema.Finite, Schema.Null])),
    })
  ),
  selectionLimits: Schema.optional(SelectionLimitsSchema),
  optionSearch: Schema.optional(
    Schema.Struct({ label: Schema.String, placeholder: Schema.String })
  ),
  identityQuery: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  slot: Schema.optional(
    Schema.Union([
      Schema.Struct({
        operationIndex: Schema.Finite,
        field: Schema.Union([
          Schema.Literal("targetQuery"),
          Schema.Literal("replacementQuery"),
          Schema.Literal("destinationQuery"),
        ]),
      }),
      Schema.Struct({
        transferIndex: Schema.Finite,
        field: Schema.Union([
          Schema.Literal("query"),
          Schema.Literal("toTeamQuery"),
        ]),
      }),
      Schema.Struct({
        discoveryField: Schema.Union([
          Schema.Literal("outgoingQueries"),
          Schema.Literal("excludedQueries"),
        ]),
        index: Schema.Finite,
      }),
      Schema.Struct({
        rightIndex: Schema.Finite,
        field: Schema.Union([
          Schema.Literal("query"),
          Schema.Literal("toTeamQuery"),
        ]),
      }),
    ])
  ),
  purpose: Schema.optional(
    Schema.Union([
      Schema.Literal("trade_selection"),
      Schema.Literal("trade_preferences"),
      Schema.Literal("player_identity"),
      Schema.Literal("player_destination"),
      Schema.Literal("search_filters"),
      Schema.Literal("contract_terms"),
      Schema.Literal("team_selection"),
      Schema.Literal("trade_reference"),
      Schema.Literal("other"),
    ])
  ),
  question: Schema.String,
  options: Schema.mutable(Schema.Array(ClarificationOptionSchema)),
}) satisfies Schema.Schema<TradeClarification>

export const ToolActivitySchema = Schema.Struct({
  retryKey: Schema.optional(Schema.String),
  details: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
  visible: Schema.optional(Schema.Boolean),
  id: Schema.String,
  label: Schema.String,
  activeLabel: Schema.optional(Schema.String),
  state: Schema.Union([
    Schema.Literal("running"),
    Schema.Literal("complete"),
    Schema.Literal("error"),
  ]),
}) satisfies Schema.Schema<ToolActivity>

export const MessagePickReferenceSchema = Schema.Struct({
  start: Schema.Finite,
  end: Schema.Finite,
  pickId: Schema.Finite,
  ownerTeamId: Schema.optional(Schema.Finite),
}) satisfies Schema.Schema<MessagePickReference>

export const MessagePlayerReferenceSchema = Schema.Struct({
  start: Schema.Finite,
  end: Schema.Finite,
  playerId: Schema.Finite,
}) satisfies Schema.Schema<MessagePlayerReference>

export const ConversationMessageSchema = Schema.Struct({
  cancelQuestionId: Schema.optional(Schema.String),
  resolvedPlayerMentions: Schema.optional(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          query: Schema.String,
          playerIds: Schema.mutable(Schema.Array(Schema.Finite)),
        })
      )
    )
  ),
  createdAt: Schema.optional(Schema.String),
  workDurationMs: Schema.optional(Schema.Finite),
  toolCalls: Schema.optional(Schema.mutable(Schema.Array(ToolActivitySchema))),
  selection: Schema.optional(ClarificationOptionSchema),
  selections: Schema.optional(
    Schema.mutable(Schema.Array(ClarificationOptionSchema))
  ),
  id: Schema.String,
  role: Schema.Union([Schema.Literal("user"), Schema.Literal("assistant")]),
  text: Schema.String,
  selectedPlayerIds: Schema.optional(
    Schema.mutable(Schema.Array(Schema.Finite))
  ),
  selectedPickIds: Schema.optional(Schema.mutable(Schema.Array(Schema.Finite))),
  pickReferences: Schema.optional(
    Schema.mutable(Schema.Array(MessagePickReferenceSchema))
  ),
  playerReferences: Schema.optional(
    Schema.mutable(Schema.Array(MessagePlayerReferenceSchema))
  ),
  snapshots: Schema.optional(Schema.mutable(Schema.Array(TradeSnapshotSchema))),
  candidates: Schema.optional(
    Schema.mutable(Schema.Array(TradeSnapshotSchema))
  ),
  clarification: Schema.optional(TradeClarificationSchema),
  tone: Schema.optional(
    Schema.Union([Schema.Literal("warning"), Schema.Literal("destructive")])
  ),
}) satisfies Schema.Schema<ConversationMessage>

export const ChatTurnResultSchema = Schema.Struct({
  workDurationMs: Schema.optional(Schema.Finite),
  toolCalls: Schema.optional(Schema.mutable(Schema.Array(ToolActivitySchema))),
  status: Schema.Union([
    Schema.Literal("complete"),
    Schema.Literal("needs_clarification"),
    Schema.Literal("agent_unavailable"),
    Schema.Literal("error"),
    Schema.Literal("conflict"),
  ]),
  message: Schema.String,
  snapshot: Schema.Union([TradeSnapshotSchema, Schema.Null]),
  changes: Schema.mutable(Schema.Array(Schema.String)),
  snapshots: Schema.mutable(Schema.Array(TradeSnapshotSchema)),
  candidates: Schema.optional(
    Schema.mutable(Schema.Array(TradeSnapshotSchema))
  ),
  clarification: Schema.optional(TradeClarificationSchema),
  conversationVersion: Schema.optional(Schema.Finite),
  pendingClarification: Schema.optional(
    Schema.Union([TradeClarificationSchema, Schema.Null])
  ),
}) satisfies Schema.Schema<ChatTurnResult>

export const ConversationViewSchema = Schema.Struct({
  version: Schema.Finite,
  snapshot: Schema.NullOr(TradeSnapshotSchema),
  messages: Schema.mutable(Schema.Array(ConversationMessageSchema)),
  pendingClarification: Schema.NullOr(TradeClarificationSchema),
}) satisfies Schema.Schema<ConversationView>

export const ClarificationAnswerSchema = Schema.Union([
  Schema.Struct({
    questionId: Schema.optional(Schema.String),
    text: Schema.String,
    optionIds: Schema.mutable(Schema.Array(Schema.String)),
    optionId: Schema.optional(Schema.Never),
  }),
  Schema.Struct({
    questionId: Schema.optional(Schema.String),
    text: Schema.String,
    optionId: Schema.String,
    optionIds: Schema.optional(Schema.Never),
  }),
]) satisfies Schema.Schema<ClarificationAnswer>

export const ChatTurnInputSchema = Schema.Struct({
  sessionId: Schema.String,
  requestId: Schema.String,
  message: Schema.String,
  selectedPlayerIds: Schema.optional(
    Schema.mutable(Schema.Array(Schema.Finite))
  ),
  selectedPickIds: Schema.optional(Schema.mutable(Schema.Array(Schema.Finite))),
  pickReferences: Schema.optional(
    Schema.mutable(Schema.Array(MessagePickReferenceSchema))
  ),
  playerReferences: Schema.optional(
    Schema.mutable(Schema.Array(MessagePlayerReferenceSchema))
  ),
  clarificationAnswer: Schema.optional(ClarificationAnswerSchema),
  cancelQuestionId: Schema.optional(Schema.String),
  expectedRevision: Schema.optional(Schema.Finite),
  expectedConversationVersion: Schema.optional(Schema.Finite),
  reference: Schema.optional(TradeReferenceSchema),
}) satisfies Schema.Schema<ChatTurnInput>
