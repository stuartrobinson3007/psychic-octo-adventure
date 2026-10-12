import { Schema } from "effect"
import {
  ConversationRecordsSchema,
  ConversationMessageSchema,
  TradeSnapshotSchema,
  ChatTurnResultSchema,
} from "../lib/trade/schemas.ts"

const SavedConversationSchema = Schema.Struct({
  records: Schema.optional(ConversationRecordsSchema),
  snapshot: Schema.optional(Schema.NullOr(TradeSnapshotSchema)),
  history: Schema.optional(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          role: Schema.Literals(["user", "assistant"]),
          content: Schema.String,
        })
      )
    )
  ),
  messages: Schema.optional(
    Schema.mutable(Schema.Array(ConversationMessageSchema))
  ),
  revisions: Schema.optional(Schema.mutable(Schema.Array(TradeSnapshotSchema))),
  candidates: Schema.optional(
    Schema.mutable(Schema.Array(TradeSnapshotSchema))
  ),
  replies: Schema.optional(
    Schema.mutable(
      Schema.Array(
        Schema.mutable(Schema.Tuple([Schema.String, ChatTurnResultSchema]))
      )
    )
  ),
  pending: Schema.optional(Schema.Unknown),
  discovery: Schema.optional(Schema.Unknown),
})

export const decodeSavedConversation = Schema.decodeUnknownSync(
  Schema.fromJsonString(SavedConversationSchema)
)
