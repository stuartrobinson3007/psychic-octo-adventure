import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { Config, Context, Effect, Layer, ManagedRuntime } from "effect"
import { SqlConversationStore } from "./conversation-sql.ts"

export { ConversationBusy, ConversationConflict } from "./conversation-sql.ts"

export class ConversationStore extends SqlConversationStore {
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true })
    const database = new DatabaseSync(filename, { timeout: 5_000 })
    try {
      database.exec("PRAGMA journal_mode = WAL")
      super({
        exec: (sql) => database.exec(sql),
        prepare: (sql) => database.prepare(sql),
        close: () => database.close(),
        transaction: (operation) => {
          database.exec("BEGIN IMMEDIATE")
          try {
            const result = operation()
            database.exec("COMMIT")
            return result
          } catch (error) {
            database.exec("ROLLBACK")
            throw error
          }
        },
      })
    } catch (error) {
      database.close()
      throw error
    }
  }
}
class LocalConversationDatabase extends Context.Service<
  LocalConversationDatabase,
  ConversationStore
>()("trade-builder/server/LocalConversationDatabase") {
  static readonly layer = Layer.effect(
    LocalConversationDatabase,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const filename = yield* Config.String("GAMBIT_CONVERSATION_DB").pipe(
          Config.withDefault(
            process.env.NODE_TEST_CONTEXT
              ? ":memory:"
              : resolve(".gambit/conversations.sqlite")
          )
        )
        return yield* Effect.sync(() => new ConversationStore(filename))
      }),
      (database) => Effect.sync(() => database.close())
    )
  )
}

let runtime:
  | ManagedRuntime.ManagedRuntime<LocalConversationDatabase, Config.ConfigError>
  | undefined
export const getConversationStore = () => {
  runtime ??= ManagedRuntime.make(LocalConversationDatabase.layer)
  return runtime.runSync(LocalConversationDatabase)
}

export async function disposeConversationStore() {
  const current = runtime
  runtime = undefined
  await current?.dispose()
}

if (import.meta.hot) import.meta.hot.dispose(() => disposeConversationStore())
export const scopeSessionId = (id: string) => id
