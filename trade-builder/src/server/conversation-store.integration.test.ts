import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { DatabaseSync } from "node:sqlite"
import {
  ConversationStore,
  ConversationBusy,
  ConversationConflict,
} from "./conversation-store.ts"

test("conversations survive reopening with exact messages, null focus and pending work", () => {
  const directory = mkdtempSync(join(tmpdir(), "gambit-memory-"))
  const filename = join(directory, "conversations.sqlite")
  try {
    const first = new ConversationStore(filename)
    const payload = JSON.stringify({
      snapshot: null,
      messages: [{ role: "user", text: "Earlier trade" }],
      pending: { question: "Which player?" },
      replies: [["request-1", { status: "complete" }]],
    })
    first.claim("conversation", "worker", 100)
    first.save("conversation", 0, payload, "worker", 101)
    first.release("conversation", "worker")
    first.close()
    const second = new ConversationStore(filename)
    assert.deepEqual(second.read("conversation"), { version: 1, payload })
    second.close()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("catalogue retention is shared, survives reopening and cleans up expired snapshots", () => {
  const directory = mkdtempSync(join(tmpdir(), "gambit-catalogues-"))
  const filename = join(directory, "conversations.sqlite")
  const now = Date.now()
  const payload = JSON.stringify({ players: [{ id: 1, teamId: 2 }] })
  const first = new ConversationStore(filename)
  try {
    first.retainSearchCatalogue("roster-v1", payload, now + 1000)
    first.retainSearchCatalogue("roster-v1", payload, now + 2000)
    first.close()
    const second = new ConversationStore(filename)
    const inspector = new DatabaseSync(filename)
    try {
      assert.equal(
        inspector
          .prepare("SELECT COUNT(*) AS count FROM search_catalogues")
          .get()!.count,
        1
      )
      assert.equal(second.readSearchCatalogue("roster-v1", now + 1500), payload)
      assert.equal(
        second.readSearchCatalogue("roster-v1", now + 2000),
        undefined
      )
      assert.equal(
        inspector
          .prepare("SELECT COUNT(*) AS count FROM search_catalogues")
          .get()!.count,
        0
      )
    } finally {
      second.close()
      inspector.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("a longer turn keeps its conversation locked through its deadline and can commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "gambit-memory-"))
  const filename = join(directory, "conversations.sqlite")
  const first = new ConversationStore(filename)
  const second = new ConversationStore(filename)
  try {
    first.claim("conversation", "first", 100, 105_000)
    assert.throws(
      () => second.claim("conversation", "second", 60_101),
      ConversationBusy
    )
    first.save("conversation", 0, "completed", "first", 90_101)
    assert.equal(second.read("conversation")?.payload, "completed")
    first.release("conversation", "first")
    second.claim("conversation", "second", 90_102)
  } finally {
    first.close()
    second.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test("competing workers cannot claim or overwrite a conversation; expired owners cannot commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "gambit-memory-"))
  const filename = join(directory, "conversations.sqlite")
  const first = new ConversationStore(filename)
  const second = new ConversationStore(filename)
  try {
    first.claim("conversation", "first", 100)
    assert.throws(
      () => second.claim("conversation", "second", 101),
      ConversationBusy
    )
    assert.throws(
      () => second.save("conversation", 0, "wrong", "second", 102),
      ConversationConflict
    )
    second.claim("conversation", "second", 60_101)
    assert.throws(
      () => first.save("conversation", 0, "late", "first", 60_102),
      ConversationConflict
    )
    first.release("conversation", "first")
    second.save("conversation", 0, "correct", "second", 60_103)
    assert.throws(
      () => second.save("conversation", 0, "stale", "second", 60_104),
      ConversationConflict
    )
    assert.equal(second.read("conversation")?.payload, "correct")
  } finally {
    first.close()
    second.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
