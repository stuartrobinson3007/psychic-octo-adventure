import assert from "node:assert/strict"
import test from "node:test"
import {
  conversationView,
  getSession,
  recordExchange,
  withSessionLock,
} from "./trade-session.ts"
import { clarificationTranscriptEntries } from "../lib/clarification-selection.ts"
import type { ClarificationOption } from "../lib/trade/types.ts"

test("a selection and its separate message survive a durable conversation reload", async () => {
  const id = crypto.randomUUID()
  const option: ClarificationOption = {
    id: "player-10",
    label: "Derrick White",
    detail: "Boston Celtics",
    value: "Derrick White",
    playerId: 10,
  }
  const custom = "Also keep Boston below the apron."
  await withSessionLock(id, async () => {
    const session = getSession(id)
    recordExchange(
      session,
      { requestId: "question", message: "Trade White for Wiggins." },
      {
        status: "needs_clarification",
        message: "Which White do you mean?",
        clarification: {
          question: "Which White do you mean?",
          options: [option],
        },
        snapshot: null,
        snapshots: [],
        changes: [],
      },
      "2026-10-08T09:01:00Z"
    )
    recordExchange(
      session,
      {
        requestId: "answer",
        message: `${option.value}\n\n${custom}`,
        clarificationAnswer: { optionId: option.id, text: custom },
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
  const restored = conversationView(getSession(id))
  assert.equal(restored.messages[0].createdAt, "2026-10-08T09:01:00Z")
  assert.ok(
    restored.messages.every(
      (message) =>
        message.createdAt && Number.isFinite(Date.parse(message.createdAt))
    )
  )
  const reply = restored.messages.find(
    (message) => message.id === "answer-user"
  )!
  assert.deepEqual(reply.selections, [option])
  assert.equal(reply.text, `${option.value}\n\n${custom}`)
  const shown = clarificationTranscriptEntries(restored.messages)
  assert.equal(shown.find((message) => message.id === reply.id)?.text, custom)
  assert.equal(getSession(id).history[2].content, reply.text)
})
