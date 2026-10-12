import { Schema } from "effect"
import {
  ChatTurnResultSchema,
  ToolActivitySchema,
} from "./trade/chat-schemas.ts"

export const tradeStreamInterrupted =
  "The connection was interrupted. Please try again."
/** Maximum decoded string code units buffered for one SSE event. */
export const maxTradeEventSize = 2 * 1024 * 1024
const envelope = { version: Schema.Literal(1), requestId: Schema.String }

export const TradeChatEventSchema = Schema.Union([
  Schema.Struct({ ...envelope, type: Schema.Literal("start") }),
  Schema.Struct({
    ...envelope,
    type: Schema.Literal("activity"),
    activity: ToolActivitySchema,
  }),
  Schema.Struct({
    ...envelope,
    type: Schema.Literal("result"),
    result: ChatTurnResultSchema,
  }),
  Schema.Struct({
    ...envelope,
    type: Schema.Literal("error"),
    message: Schema.Literal(tradeStreamInterrupted),
  }),
])

export type TradeChatEvent = typeof TradeChatEventSchema.Type
export const encodeTradeChatEvent = Schema.encodeEffect(
  Schema.fromJsonString(TradeChatEventSchema)
)
