// Live end-to-end checks through the same HTTP/SSE route used by the composer.
// Start the app, then: node scripts/check-multi-team.mjs [base URL] [report path]
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
const base = process.argv[2] ?? "http://localhost:3000"
const reportPath = process.argv[3] ?? "/tmp/gambit-multi-team-live.json"
const report = []
let last = null
const sessionId = crypto.randomUUID()
const three =
  "Build a three-team trade: send Jordan Walsh from Boston to Miami, Ryan Conwell from Miami to Chicago, and Kam Jones from Chicago to Boston."
const routes = (snapshot) =>
  snapshot.proposal.transfers
    .map((t) => [t.assetId, t.fromTeamId, t.toTeamId])
    .sort((a, b) => a[0] - b[0])
const cycle = [
  [16999, 2, 16],
  [17164, 5, 2],
  [17507, 16, 5],
]
async function turn(message, verify) {
  const started = Date.now()
  const response = await fetch(`${base}/api/trade-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      requestId: crypto.randomUUID(),
      message,
      ...(last
        ? { expectedConversationVersion: last.conversationVersion }
        : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  })
  assert.equal(response.status, 200)
  const events = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)))
  const result = events.find((event) => event.type === "data-result")?.data
  assert.ok(
    result,
    `Stream must return a structured result: ${JSON.stringify(events)}`
  )
  let failure = null
  try {
    verify(result, last)
  } catch (error) {
    failure = error.message
  }
  report.push({
    message,
    passed: !failure,
    failure,
    elapsedMs: Date.now() - started,
    result,
  })
  console.log(
    JSON.stringify({
      message,
      passed: !failure,
      failure,
      status: result.status,
      verdict: result.snapshot?.verdict?.status,
      reply: result.message,
    })
  )
  last = result
  await writeFile(
    reportPath,
    JSON.stringify({ results: report }, null, 2) + "\n"
  )
  return result
}
try {
  await turn(
    "Help me build a three-team trade. Where should we start?",
    (r) => {
      assert.equal(r.status, "needs_clarification")
      assert.equal(r.snapshot, null)
      assert.doesNotMatch(r.message, /not supported|aren[’']t supported/i)
    }
  )
  await turn("Boston, Miami and Chicago.", (r) => {
    assert.equal(r.status, "needs_clarification")
    assert.equal(r.snapshot, null)
  })
  await turn(three, (r) => {
    assert.equal(r.status, "complete")
    assert.equal(r.snapshot.verdict.status, "valid")
    assert.equal(r.snapshot.verdict.teams.length, 3)
    assert.deepEqual(routes(r.snapshot), cycle)
  })
  await turn("Explain Chicago's salary matching.", (r, previous) => {
    assert.equal(r.status, "complete")
    assert.deepEqual(r.snapshot, previous.snapshot)
    assert.match(r.message, /Chicago|Bulls/)
    assert.equal(r.snapshots.length, 0)
  })
  await turn("Replace Ryan Conwell with Pelle Larsson.", (r) => {
    assert.equal(r.status, "complete")
    assert.equal(r.snapshot.proposal.teamIds.length, 3)
    assert.deepEqual(
      routes(r.snapshot).filter(
        ([id]) => cycle.some(([existing]) => existing === id) && id !== 17507
      ),
      cycle.filter(([id]) => id !== 17507)
    )
    assert.ok(
      r.snapshot.proposal.transfers.some(
        (t) => t.fromTeamId === 16 && t.toTeamId === 5
      )
    )
  })
  await turn("Undo that last change.", (r) => {
    assert.equal(r.status, "complete")
    assert.deepEqual(routes(r.snapshot), cycle)
  })
  await turn(
    "Also add Grant Williams from Charlotte to Boston, retaining all current player destinations.",
    (r) => {
      assert.equal(r.status, "complete")
      assert.equal(r.snapshot.verdict.teams.length, 4)
      assert.deepEqual(
        routes(r.snapshot).filter(([id]) =>
          cycle.some(([existing]) => existing === id)
        ),
        cycle
      )
      assert.ok(
        r.snapshot.proposal.transfers.some(
          (t) => t.fromTeamId === 4 && t.toTeamId === 2
        )
      )
    }
  )
  await turn("Undo that last change.", (r) => {
    assert.equal(r.status, "complete")
    assert.deepEqual(routes(r.snapshot), cycle)
    assert.equal(r.snapshot.proposal.teamIds.length, 3)
  })
  await turn(
    "Send Ryan Conwell to Boston instead of Chicago, keeping everyone else in place.",
    (r) => {
      assert.equal(r.status, "complete")
      assert.deepEqual(routes(r.snapshot), [
        [16999, 2, 16],
        [17164, 5, 2],
        [17507, 16, 2],
      ])
    }
  )
  await turn(
    "Build a new four-team trade: Jordan Walsh from Boston to Miami, Ryan Conwell from Miami to Chicago, Kam Jones from Chicago to Charlotte, and Grant Williams from Charlotte to Boston.",
    (r) => {
      assert.equal(r.status, "complete")
      assert.equal(r.snapshot.proposal.teamIds.length, 4)
      assert.equal(r.snapshot.verdict.teams.length, 4)
      assert.ok(
        r.snapshot.proposal.transfers.some(
          (t) => t.assetId === 17164 && t.toTeamId === 4
        )
      )
    }
  )
  await turn(
    "Build a five-team trade with Boston, Miami, Chicago, Charlotte and Denver.",
    (r, previous) => {
      assert.equal(r.status, "complete")
      assert.deepEqual(r.snapshot, previous.snapshot)
      assert.match(r.message, /four|4|not supported|aren[’']t supported/i)
    }
  )
  await turn(
    "Start a new three-team trade with Boston's Jordan Walsh, Miami's Ryan Conwell and Chicago's Kam Jones. I will specify the destinations next.",
    (r, previous) => {
      assert.equal(r.status, "needs_clarification")
      assert.deepEqual(r.snapshot, previous.snapshot)
    }
  )
  await turn(
    "Jordan Walsh to Miami, Ryan Conwell to Chicago, Kam Jones to Boston.",
    (r) => {
      assert.equal(r.status, "complete")
      assert.deepEqual(routes(r.snapshot), cycle)
    }
  )
} finally {
  await writeFile(
    reportPath,
    JSON.stringify(
      { checkedAt: new Date().toISOString(), results: report },
      null,
      2
    ) + "\n"
  )
  console.log(
    `Report: ${reportPath}; ${report.filter((r) => r.passed).length}/${report.length} passed`
  )
}
if (report.some((r) => !r.passed)) process.exitCode = 1
