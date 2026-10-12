import { Effect, Schema } from "effect"
import type { ConversationEntry } from "../components/workspace/use-trade-workspace.ts"
import type { TradeRecord } from "../components/workspace/trade-card.tsx"
import type { TradeSnapshot } from "./trade/types.ts"
import {
  DraftPickSchema,
  DraftRightSchema,
  PlayerSchema,
  TeamSchema,
  TradeExceptionSchema,
} from "./trade/roster-schemas.ts"
import { TradeSnapshotSchema } from "./trade/proposal-schemas.ts"
import { ConversationMessageSchema } from "./trade/chat-schemas.ts"

export interface StoredWorkspace {
  version: 1 | 2
  conversationId?: string
  conversationVersion?: number
  snapshot?: TradeSnapshot | null
  entries: ConversationEntry[]
  saved: TradeRecord[]
}

const TradeRecordSchema = Schema.Struct({
  snapshot: TradeSnapshotSchema,
  rights: Schema.optional(Schema.mutable(Schema.Array(DraftRightSchema))),
  exceptions: Schema.optional(
    Schema.mutable(Schema.Array(TradeExceptionSchema))
  ),
  picks: Schema.optional(Schema.mutable(Schema.Array(DraftPickSchema))),
  pickTeams: Schema.optional(Schema.mutable(Schema.Array(TeamSchema))),
  players: Schema.mutable(Schema.Array(PlayerSchema)),
  teams: Schema.mutable(Schema.Array(TeamSchema)),
}) satisfies Schema.Schema<TradeRecord>

const ConversationEntrySchema = Schema.Struct({
  ...ConversationMessageSchema.fields,
  sourceMessageId: Schema.optional(Schema.String),
  trade: Schema.optional(TradeRecordSchema),
  isCandidate: Schema.optional(Schema.Boolean),
}) satisfies Schema.Schema<ConversationEntry>

const WorkspaceJson = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.Literals([1, 2]),
    conversationId: Schema.optional(Schema.String),
    conversationVersion: Schema.optional(Schema.Finite),
    snapshot: Schema.optional(Schema.NullOr(TradeSnapshotSchema)),
    entries: Schema.mutable(Schema.Array(ConversationEntrySchema)),
    saved: Schema.mutable(Schema.Array(TradeRecordSchema)),
  }) satisfies Schema.Schema<StoredWorkspace>
)

class WorkspaceStorageError extends Schema.TaggedError<WorkspaceStorageError>()(
  "WorkspaceStorageError",
  {
    operation: Schema.Literals(["read", "write"]),
    cause: Schema.Defect(),
  }
) {}

const storageKey = "gambit-exploration-v1"
export const readWorkspace = Effect.fn("readWorkspace")(function* (
  storage: Storage
) {
  const raw = yield* Effect.try({
    try: () => storage.getItem(storageKey),
    catch: (cause) => new WorkspaceStorageError({ operation: "read", cause }),
  })
  if (raw === null) return undefined
  return yield* Schema.decodeUnknownEffect(WorkspaceJson)(raw).pipe(
    Effect.mapError(
      (cause) => new WorkspaceStorageError({ operation: "read", cause })
    )
  )
})

export const writeWorkspace = Effect.fn("writeWorkspace")(function* (
  storage: Storage,
  value: StoredWorkspace
) {
  const raw = yield* Schema.encodeEffect(WorkspaceJson)(value).pipe(
    Effect.mapError(
      (cause) => new WorkspaceStorageError({ operation: "write", cause })
    )
  )
  yield* Effect.try({
    try: () => storage.setItem(storageKey, raw),
    catch: (cause) => new WorkspaceStorageError({ operation: "write", cause }),
  })
})
