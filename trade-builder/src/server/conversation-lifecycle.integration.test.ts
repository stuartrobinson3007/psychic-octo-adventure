import assert from "node:assert/strict"
import test from "node:test"
import { getConversationStore } from "./conversation-store.ts"
import {
  getSession,
  recordExchange,
  readTradeConversation,
  rememberReply,
  withSessionLock,
} from "./trade-session.ts"

test("a failed out-of-turn save releases its lease and discards the unsaved cache", () => {
  const id = crypto.randomUUID()
  const store = getConversationStore()
  const save = store.save.bind(store)
  const reply = {
    status: "complete" as const,
    message: "Saved reply",
    snapshot: null,
    changes: [],
    snapshots: [],
  }
  rememberReply(getSession(id), "first", reply)
  store.save = () => {
    throw new Error("Injected database save fault")
  }
  try {
    assert.throws(() => rememberReply(getSession(id), "failed", reply))
  } finally {
    store.save = save
  }
  const recovered = getSession(id)
  assert.equal(recovered.version, 1)
  assert.equal(recovered.replies.has("first"), true)
  assert.equal(recovered.replies.has("failed"), false)
  rememberReply(recovered, "next", reply)
  assert.equal(getSession(id).version, 2)
  const payload = JSON.parse(store.read(id)!.payload!)
  assert.deepEqual(
    payload.replies.map(([requestId]: [string, unknown]) => requestId),
    ["first", "next"]
  )
})

test(
  "a database release fault does not strand the next turn's local permit",
  { timeout: 2000 },
  async () => {
    const id = crypto.randomUUID()
    const store = getConversationStore()
    const release = store.release.bind(store)
    store.release = (sessionId, owner) => {
      release(sessionId, owner)
      throw new Error("Injected database release fault")
    }
    try {
      await assert.rejects(withSessionLock(id, async () => "first"))
    } finally {
      store.release = release
    }
    assert.equal(await withSessionLock(id, async () => "second"), "second")
  }
)

test(
  "cancelling a queued turn leaves the active turn and following turn usable",
  { timeout: 2000 },
  async () => {
    const id = crypto.randomUUID()
    let entered = () => {}
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    let finish = () => {}
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    const first = withSessionLock(id, async () => {
      entered()
      await gate
      return "first"
    })
    await started
    const cancellation = new AbortController()
    let secondEntered = false
    const second = assert.rejects(
      withSessionLock(
        id,
        async () => {
          secondEntered = true
        },
        60_000,
        cancellation.signal
      )
    )
    cancellation.abort()
    await second
    assert.equal(secondEntered, false)
    finish()
    assert.equal(await first, "first")
    assert.equal(await withSessionLock(id, async () => "third"), "third")
  }
)

test(
  "a cancelled turn drains late native work without saving its reply or exposing it to the next turn",
  { timeout: 2000 },
  async () => {
    const id = crypto.randomUUID()
    const cancellation = new AbortController()
    let aborted = () => {}
    const interruption = new Promise<void>((resolve) => {
      aborted = resolve
    })
    let finish = () => {}
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    const pending = assert.rejects(
      withSessionLock(
        id,
        async (signal) => {
          const session = getSession(id)
          signal.addEventListener("abort", aborted, { once: true })
          cancellation.abort()
          await gate
          recordExchange(
            session,
            { requestId: crypto.randomUUID(), message: "Discarded request" },
            {
              status: "complete",
              message: "Discarded reply",
              snapshot: null,
              changes: [],
              snapshots: [],
            }
          )
        },
        60_000,
        cancellation.signal
      )
    )
    await interruption
    let nextEntered = false
    const next = withSessionLock(id, async () => {
      nextEntered = true
      return getSession(id).messages
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.equal(nextEntered, false)
    finish()
    await pending
    assert.deepEqual(await next, [])
    assert.deepEqual(readTradeConversation(id).messages, [])
  }
)
