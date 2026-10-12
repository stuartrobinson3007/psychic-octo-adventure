import assert from "node:assert/strict"
import test from "node:test"
import { DatabaseSync } from "node:sqlite"
import {
  conversationContext,
  authorizeChatTurn,
} from "./conversation-context.ts"
import {
  getConversationStore,
  scopeSessionId,
} from "./cloud-conversation-store.ts"
import { SqlConversationStore } from "./conversation-sql.ts"

test("two visitors using the same conversation ID cannot read or overwrite each other's records", async () => {
  const first = {
    namespace: "visitor-a",
    store: new SqlConversationStore(new DatabaseSync(":memory:")),
    authorizeChat: async () => null,
  }
  const second = {
    namespace: "visitor-b",
    store: new SqlConversationStore(new DatabaseSync(":memory:")),
    authorizeChat: async () => "Limit reached",
  }
  try {
    const keys = await Promise.all(
      [first, second].map((scope) =>
        conversationContext.run(scope, async () => {
          await Promise.resolve()
          const store = getConversationStore()
          const id = "same-conversation"
          store.claim(id, scope.namespace)
          store.save(id, 0, scope.namespace, scope.namespace)
          store.release(id, scope.namespace)
          assert.equal(store.read(id)?.payload, scope.namespace)
          assert.equal(
            await authorizeChatTurn(),
            scope.namespace === "visitor-a" ? null : "Limit reached"
          )
          return scopeSessionId(id)
        })
      )
    )
    assert.notEqual(keys[0], keys[1])
    assert.equal(first.store.read("same-conversation")?.payload, "visitor-a")
    assert.equal(second.store.read("same-conversation")?.payload, "visitor-b")
    assert.throws(() => getConversationStore(), /verified browser session/)
  } finally {
    first.store.close()
    second.store.close()
  }
})
