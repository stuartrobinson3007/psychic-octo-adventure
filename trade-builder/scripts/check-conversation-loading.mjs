// Live archive/loading check: isolated durable store and real validation services.
import assert from "node:assert/strict"
import { createServer } from "vite"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const directory = await mkdtemp(join(tmpdir(), "gambit-loading-"))
process.env.GAMBIT_CONVERSATION_DB = join(directory, "conversations.sqlite")
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const report = { checkedAt: new Date().toISOString(), checks: [], failures: [] }
try {
  const { checkUncheckedProposals } = await server.ssrLoadModule(
    "/src/server/conversation-checks.ts"
  )
  const { getSession, withSessionLock } = await server.ssrLoadModule(
    "/src/server/trade-session.ts"
  )
  const { parseArchivedProposal } = await server.ssrLoadModule(
    "/src/server/proposal-archive.ts"
  )
  const recordings = JSON.parse(
    await readFile(
      new URL("../src/lib/ux-review/conversations.json", import.meta.url),
      "utf8"
    )
  )
  const snapshots = recordings.flatMap((row) => [
    ...(row.result.snapshots ?? []),
    ...(row.result.candidates ?? []),
  ])
  const trade = snapshots.find(
    (s) =>
      s.verdict?.status === "valid" &&
      s.proposal.transfers.length &&
      !s.proposal.signings?.length
  )
  const signing = snapshots.find((s) => s.proposal.relatedTrade)
  const signAndTrade = snapshots.find(
    (s) =>
      s.verdict?.status === "validation_incomplete" &&
      s.proposal.signings?.length
  )
  assert(trade && signing && signAndTrade)
  const unchecked = [trade, signing, signAndTrade].map((s) => ({
    proposal: parseArchivedProposal(s.proposal),
    verdict: null,
  }))
  const invalid = structuredClone(unchecked[0])
  invalid.proposal.proposalId = crypto.randomUUID()
  invalid.proposal.transfers[0].fromTeamId = 999999
  unchecked.push(invalid)
  const sessionId = crypto.randomUUID()
  await withSessionLock(sessionId, async () => {
    const session = getSession(sessionId)
    session.revisions = unchecked
    session.candidates = [structuredClone(unchecked[0])]
    session.snapshot = structuredClone(unchecked[0])
    session.messages = [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Archived proposals",
        snapshots: structuredClone(unchecked),
        candidates: [structuredClone(unchecked[0])],
      },
    ]
    assert.equal(await checkUncheckedProposals(session), true)
    assert(session.revisions.every((s) => s.verdict))
    assert.equal(session.revisions[0].verdict.status, "valid")
    assert.equal(session.revisions[1].verdict.status, "valid")
    assert.equal(session.revisions[2].verdict.status, "validation_incomplete")
    assert.equal(session.revisions[3].verdict.status, "invalid_proposal")
    assert.deepEqual(
      session.revisions[1].proposal.relatedTrade,
      signing.proposal.relatedTrade
    )
    assert.deepEqual(session.messages[0].snapshots, session.revisions)
    assert.deepEqual(session.candidates[0], session.snapshot)
    report.checks.push({
      name: "All historical proposals checked, invalid archives preserved, duplicate references share evidence, signing link retained",
      snapshots: session.revisions,
    })
  })
  await withSessionLock(sessionId, async () => {
    const session = getSession(sessionId)
    const before = JSON.stringify(session.revisions)
    assert.equal(await checkUncheckedProposals(session), false)
    assert.equal(JSON.stringify(session.revisions), before)
    report.checks.push({
      name: "Reload preserves checked historical versions without another service check",
    })
    session.messages[0].snapshots[0].verdict = null
    assert.equal(await checkUncheckedProposals(session), true)
    assert.equal(JSON.stringify(session.revisions), before)
    assert.deepEqual(session.messages[0].snapshots[0], session.revisions[0])
    report.checks.push({
      name: "Existing server evidence reaches older visible cards without rechecking",
    })
    // Simulate a prior server archive whose candidate never received a verdict.
    const candidate = structuredClone(session.candidates[0])
    candidate.proposal.proposalId = crypto.randomUUID()
    candidate.verdict = null
    session.candidates.push(candidate)
    session.messages[0].candidates.push(structuredClone(candidate))
    assert.equal(await checkUncheckedProposals(session), true)
    assert.equal(session.candidates.at(-1).verdict.status, "valid")
    assert.deepEqual(
      session.candidates.at(-1),
      session.messages[0].candidates.at(-1)
    )
    report.checks.push({
      name: "Missing evidence in an older server conversation is repaired automatically",
    })
  })
} catch (error) {
  report.failures.push({ error: error.message })
} finally {
  report.passed = report.failures.length === 0
  await writeFile(
    process.argv[2] ?? "/tmp/gambit-conversation-loading.json",
    JSON.stringify(report, null, 2) + "\n"
  )
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.checks.length,
      failures: report.failures,
    })
  )
  await server.close()
  await rm(directory, { recursive: true, force: true })
}
if (!report.passed) process.exitCode = 1
