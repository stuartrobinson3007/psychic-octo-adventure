import assert from "node:assert/strict"
import test from "node:test"
import { conversationEntries } from "../lib/conversation-entries.ts"
import { messagePlayerReferences } from "../lib/message-player-references.ts"
import {
  conversationView,
  getSession,
  recordExchange,
  withSessionLock,
} from "./trade-session.ts"

test("sent badges survive an AI response and a durable conversation reload", async () => {
  const id = crypto.randomUUID()
  const text = "  trade Stephen Curry Nikola Jokic  \n"
  const playerReferences = [
    { start: 8, end: 21, playerId: 10 },
    { start: 22, end: 34, playerId: 20 },
  ]
  await withSessionLock(id, async () => {
    recordExchange(
      getSession(id),
      {
        requestId: "badge-request",
        message: text,
        selectedPlayerIds: [10, 20],
        playerReferences,
      },
      {
        status: "complete",
        message: "Trade checked.",
        snapshot: null,
        snapshots: [],
        changes: [],
      }
    )
  })
  getSession(id).expires = 0
  const [restored] = conversationEntries(
    conversationView(getSession(id)).messages
  )
  assert.equal(restored.text, text)
  assert.deepEqual(restored.selectedPlayerIds, [10, 20])
  assert.deepEqual(restored.playerReferences, playerReferences)
  assert.deepEqual(
    messagePlayerReferences(
      restored.text,
      [
        { id: 10, name: "Stephen Curry", teamId: 1, salary: 1 },
        { id: 20, name: "Nikola Jokic", teamId: 2, salary: 1 },
      ],
      restored.playerReferences
    ),
    playerReferences
  )
})
