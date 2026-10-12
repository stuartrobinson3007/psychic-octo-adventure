// Real HTTP/SSE checks for replay, stale clients, invalid input and concurrent turns.
import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { sendStreamingTradeMessage } from "../src/lib/trade-chat-stream.ts"
const endpoint = process.env.GAMBIT_E2E_URL ?? "http://127.0.0.1:3021"
const recorded = JSON.parse(
  await readFile(process.argv[2] ?? "/tmp/gambit-intentions-final.json", "utf8")
)
const row = recorded.results.find(
  (x) => x.scenario === "cycle replacement" && x.passed
)
assert.ok(row)
const send = (body) =>
  sendStreamingTradeMessage(body, () => {}, {
    api: `${endpoint}/api/trade-chat`,
  })
const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: String(e.message ?? e) })
  }
  console.log(JSON.stringify(results.at(-1)))
}
await check("repeated request returns exactly its original reply", async () => {
  const r = await send({
    sessionId: row.sessionId,
    requestId: row.requestId,
    message: row.input,
    expectedConversationVersion: 0,
  })
  assert.deepEqual(r, row.result)
})
let latest
await check("a stale client preserves the checked trade", async () => {
  latest = await send({
    sessionId: row.sessionId,
    requestId: randomUUID(),
    message: "remove Tatum",
    expectedConversationVersion: 0,
  })
  assert.equal(latest.status, "conflict")
  assert.ok(latest.snapshot)
})
await check("unknown selected player preserves focus", async () => {
  const r = await send({
    sessionId: row.sessionId,
    requestId: randomUUID(),
    message: "trade this",
    selectedPlayerIds: [999999999],
    expectedConversationVersion: latest.conversationVersion,
  })
  assert.equal(r.status, "error")
  assert.deepEqual(r.snapshot, latest.snapshot)
  latest = r
})
await check(
  "expired or forged clarification option preserves focus",
  async () => {
    const r = await send({
      sessionId: row.sessionId,
      requestId: randomUUID(),
      message: "Derrick White",
      clarificationAnswer: { optionId: "player-16992", text: "" },
      expectedConversationVersion: latest.conversationVersion,
    })
    assert.equal(r.status, "conflict")
    assert.deepEqual(r.snapshot, latest.snapshot)
    latest = r
  }
)
await check(
  "two simultaneous clients cannot both commit the same version",
  async () => {
    const replies = await Promise.all(
      [
        "what is Jayson Tatum's salary?",
        "what is Giannis Antetokounmpo's salary?",
      ].map((message) =>
        send({
          sessionId: row.sessionId,
          requestId: randomUUID(),
          message,
          expectedConversationVersion: latest.conversationVersion,
        })
      )
    )
    assert.deepEqual(replies.map((r) => r.status).sort(), [
      "complete",
      "conflict",
    ])
    for (const r of replies) assert.deepEqual(r.snapshot, latest.snapshot)
  }
)
await check("malformed requests receive HTTP 400", async () => {
  for (const body of [
    {},
    { sessionId: row.sessionId, requestId: randomUUID(), message: "" },
    {
      sessionId: row.sessionId,
      requestId: randomUUID(),
      message: "trade",
      selectedPlayerIds: [-1],
    },
    {
      sessionId: row.sessionId,
      requestId: randomUUID(),
      message: "x".repeat(8001),
    },
  ]) {
    const r = await fetch(`${endpoint}/api/trade-chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    assert.equal(r.status, 400)
    await r.text()
  }
})
await writeFile(
  process.argv[3] ?? "/tmp/gambit-transport-e2e.json",
  JSON.stringify(
    { checkedAt: new Date().toISOString(), endpoint, results },
    null,
    2
  ) + "\n"
)
if (results.some((r) => !r.passed)) process.exitCode = 1
