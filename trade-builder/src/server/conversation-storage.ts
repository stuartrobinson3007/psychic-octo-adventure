import { Clock, Context, Effect, Layer, Schema } from "effect"
import { conversationContext } from "./conversation-context.ts"
import {
  ConversationBusy,
  ConversationConflict,
  getConversationStore,
  scopeSessionId,
} from "./conversation-store.ts"

export class ConversationStorageError extends Schema.TaggedError<ConversationStorageError>()(
  "ConversationStorageError",
  { operation: Schema.String, message: Schema.String, cause: Schema.Defect() }
) {}

export class ConversationOperationError extends Schema.TaggedError<ConversationOperationError>()(
  "ConversationOperationError",
  { message: Schema.String, cause: Schema.Defect() }
) {}

export function conversationFailure(operation: string, cause: unknown) {
  return cause instanceof ConversationBusy ||
    cause instanceof ConversationConflict
    ? cause
    : new ConversationStorageError({
        operation,
        message: "Conversation storage is temporarily unavailable.",
        cause,
      })
}

type StorageFailure =
  ConversationBusy | ConversationConflict | ConversationStorageError

export class ConversationStorage extends Context.Service<
  ConversationStorage,
  {
    readonly key: (id: string) => string
    readonly authorize: Effect.Effect<string | null, ConversationStorageError>
    readonly claim: (
      id: string,
      owner: string,
      leaseMs: number
    ) => Effect.Effect<void, StorageFailure>
    readonly save: (
      id: string,
      version: number,
      payload: string,
      owner: string
    ) => Effect.Effect<void, StorageFailure>
    readonly release: (
      id: string,
      owner: string
    ) => Effect.Effect<void, StorageFailure>
  }
>()("trade-builder/server/ConversationStorage") {
  static readonly layer = Layer.effect(
    ConversationStorage,
    Effect.gen(function* () {
      const database = yield* Effect.try({
        try: () => getConversationStore(),
        catch: (cause) => conversationFailure("open", cause),
      })
      const prefix = scopeSessionId("")
      const authorize = conversationContext.getStore()?.authorizeChat
      return ConversationStorage.of({
        key: (id) => `${prefix}${id}`,
        authorize: Effect.tryPromise({
          try: () => (authorize ? authorize() : Promise.resolve(null)),
          catch: (cause) =>
            new ConversationStorageError({
              operation: "authorize",
              message: "Chat access could not be checked.",
              cause,
            }),
        }),
        claim: Effect.fn("ConversationStorage.claim")(
          function* (id, owner, leaseMs) {
            const now = yield* Clock.currentTimeMillis
            yield* Effect.try({
              try: () => database.claim(id, owner, now, leaseMs),
              catch: (cause) => conversationFailure("claim", cause),
            })
          }
        ),
        save: Effect.fn("ConversationStorage.save")(
          function* (id, version, payload, owner) {
            const now = yield* Clock.currentTimeMillis
            yield* Effect.try({
              try: () => database.save(id, version, payload, owner, now),
              catch: (cause) => conversationFailure("save", cause),
            })
          }
        ),
        release: Effect.fn("ConversationStorage.release")((id, owner) =>
          Effect.try({
            try: () => database.release(id, owner),
            catch: (cause) => conversationFailure("release", cause),
          })
        ),
      })
    })
  )
}
