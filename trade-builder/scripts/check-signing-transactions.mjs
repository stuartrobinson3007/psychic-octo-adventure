// Live integration journeys: real catalogue, contract service, trade service and model.
import assert from "node:assert/strict"
import { createServer } from "vite"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const directory = await mkdtemp(join(tmpdir(), "gambit-signings-"))
process.env.GAMBIT_CONVERSATION_DB = join(directory, "conversations.sqlite")
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const report = {
  checkedAt: new Date().toISOString(),
  checks: [],
  results: [],
  failures: [],
}
const path = process.argv[2] ?? "/tmp/gambit-signing-transactions.json"
try {
  const {
    loadCatalogue,
    evaluateProposal,
    validationPayload,
    checkSigning,
    scenarioPayroll,
  } = await server.ssrLoadModule("/src/server/trade-api.ts")
  const { runChatTurn } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const catalogue = await loadCatalogue()
  const player = (name) => catalogue.players.find((item) => item.name === name)
  const team = (abbr) =>
    catalogue.teams.find((item) => item.abbreviation === abbr)
  const p = (teamIds, transfers, signings = []) => ({
    proposalId: crypto.randomUUID(),
    revision: 1,
    teamIds,
    transfers,
    signings,
    createdAt: new Date().toISOString(),
  })
  const move = (name, to) => ({
    assetType: "player",
    assetId: player(name).id,
    fromTeamId: player(name).teamId,
    toTeamId: team(to).id,
  })
  const contract = await checkSigning(
    player("Aaron Holiday").id,
    team("HOU").id,
    3290014,
    3
  )
  assert(!contract.error)
  const signAndTrade = p(
    [team("HOU").id, team("MEM").id],
    [move("Aaron Holiday", "MEM")],
    [{ ...contract, firstYearGuaranteed: true }]
  )
  const payload = validationPayload(signAndTrade)
  assert.equal(
    payload.teams.find((t) => t.teamId === team("MEM").id).isSignAndTrade,
    undefined
  )
  assert.equal(
    payload.teams.find((t) => t.teamId === team("HOU").id).isSignAndTrade,
    undefined
  )
  const checked = await evaluateProposal(signAndTrade, catalogue)
  report.checks.push({
    name: "Previous-team three-year sign-and-trade; service salary evidence and local recipient checks",
    proposal: signAndTrade,
    verdict: checked,
  })
  assert.equal(checked.status, "validation_incomplete", checked.summary)
  for (const [label, changes] of [
    ["one year", { contractYears: 1 }],
    ["five years", { contractYears: 5 }],
    ["new signing team", { signingTeamId: team("NYK").id }],
    ["unguaranteed first year", { firstYearGuaranteed: false }],
    ["prohibited exception", { tierId: "mle" }],
    ["minimum exception cannot fund three years", { tierId: "minimum" }],
  ]) {
    const proposal = structuredClone(signAndTrade)
    Object.assign(proposal.signings[0], changes)
    if (changes.signingTeamId) {
      proposal.teamIds.push(changes.signingTeamId)
      proposal.transfers[0].fromTeamId = changes.signingTeamId
    }
    const verdict = await evaluateProposal(proposal, catalogue)
    report.checks.push({ name: label, verdict })
    assert.equal(verdict.status, "invalid_proposal", label)
  }
  const minimumScenario = p(
    [team("HOU").id],
    [],
    [{ ...contract, tierId: "minimum" }]
  )
  const minimumScenarioVerdict = await evaluateProposal(
    minimumScenario,
    catalogue
  )
  report.checks.push({
    name: "Standalone minimum exception cannot fund three years",
    verdict: minimumScenarioVerdict,
  })
  assert.equal(minimumScenarioVerdict.status, "invalid_proposal")
  const above = p(
    [team("HOU").id, team("NYK").id],
    [move("Aaron Holiday", "NYK")],
    [{ ...contract, firstYearGuaranteed: true }]
  )
  const invalid = await evaluateProposal(above, catalogue)
  report.checks.push({
    name: "Receiving team above first apron",
    verdict: invalid,
  })
  assert.equal(invalid.status, "invalid_trade", invalid.summary)
  const directContract = await checkSigning(
    player("Aaron Holiday").id,
    team("NYK").id,
    3290014,
    1
  )
  assert(!directContract.error)
  const combined = p(
    [team("NYK").id, team("IND").id, team("HOU").id],
    [
      move("Larry Nance Jr.", "NYK"),
      move("Oscar Tshiebwe", "IND"),
      move("Julian Phillips", "IND"),
      move("Landry Shamet", "HOU"),
    ],
    [directContract]
  )
  const combinedVerdict = await evaluateProposal(combined, catalogue)
  report.checks.push({
    name: "Legacy combined trade/signing remains incomplete instead of falsely passing",
    proposal: combined,
    verdict: combinedVerdict,
  })
  assert.equal(
    combinedVerdict.status,
    "validation_incomplete",
    combinedVerdict.summary
  )
  for (const evidence of combinedVerdict.teams) {
    const base = scenarioPayroll(combined, catalogue, evidence.teamId)
    assert.equal(
      evidence.newTotalSalary,
      base + evidence.salaryIn - evidence.salaryOut
    )
  }
  const exchanged = structuredClone(signAndTrade)
  exchanged.proposalId = crypto.randomUUID()
  exchanged.transfers.push(move("Mamadi Diakite", "HOU"))
  const exchangedVerdict = await evaluateProposal(exchanged, catalogue)
  report.checks.push({
    name: "Sign-and-trade sender can receive a returning player",
    proposal: exchanged,
    verdict: exchangedVerdict,
  })
  assert.equal(
    exchangedVerdict.status,
    "validation_incomplete",
    exchangedVerdict.summary
  )
  async function journey(name, messages) {
    const sessionId = crypto.randomUUID()
    let version = 0
    for (const [message, check] of messages) {
      const trace = []
      const result = await runChatTurn(
        {
          sessionId,
          requestId: crypto.randomUUID(),
          expectedConversationVersion: version,
          message,
        },
        catalogue,
        { onStep: (s) => trace.push(s) }
      )
      version = result.conversationVersion
      const row = {
        scenario: name,
        scenarioTitle: name,
        scenarioDescription: "Live signing and trade journey",
        scenarioTags: ["Signing", "Trade", "Eligibility"],
        recordedAt: new Date().toISOString(),
        input: message,
        result,
        toolTrace: trace,
      }
      report.results.push(row)
      try {
        assert(
          ["complete", "needs_clarification"].includes(result.status),
          result.message
        )
        await check?.(result)
      } catch (e) {
        row.failure = e.message
        report.failures.push({ name, message, error: e.message })
      }
      await writeFile(path, JSON.stringify(report, null, 2))
      console.log(
        JSON.stringify({
          name,
          message,
          status: result.status,
          verdict: result.snapshots?.at(-1)?.verdict?.status,
          failure: row.failure,
        })
      )
    }
  }
  if (!process.argv.includes("--mechanics-only")) {
    await journey("signing transactions: trade plus a New York signing", [
      [
        "Build a three-team trade: Larry Nance Jr. to New York, Oscar Tshiebwe and Julian Phillips to Indiana, and Landry Shamet to Houston.",
        (r) => assert.equal(r.snapshots.at(-1).proposal.transfers.length, 4),
      ],
      [
        "Include Aaron Holiday signing for New York at the minimum for one year in that deal.",
        (r) => {
          const s = r.snapshots.find(
            (snapshot) => snapshot.proposal.relatedTrade
          )
          assert(s)
          assert.equal(
            s.proposal.signings[0].playerId,
            player("Aaron Holiday").id
          )
          assert.equal(s.proposal.signings[0].signingTeamId, team("NYK").id)
          assert.equal(s.proposal.transfers.length, 0)
          assert(s.proposal.relatedTrade)
          assert.equal(s.verdict.status, "valid")
          assert(
            r.snapshots.some(
              (trade) =>
                trade.proposal.proposalId ===
                  s.proposal.relatedTrade.proposalId &&
                trade.proposal.revision === s.proposal.relatedTrade.revision &&
                trade.proposal.transfers.length === 4 &&
                !trade.proposal.signings?.length
            )
          )
        },
      ],
      ["Is that a sign-and-trade?", (r) => assert.equal(r.snapshots.length, 0)],
      [
        "Undo the signing.",
        (r) =>
          assert.equal(r.snapshots.at(-1).proposal.signings?.length ?? 0, 0),
      ],
    ])
    await journey(
      "signing transactions: short contract cannot be traded immediately",
      [
        [
          "Sign Aaron Holiday to New York for one year at the minimum.",
          (r) =>
            assert.equal(
              r.snapshots.at(-1).proposal.signings[0].contractYears,
              1
            ),
        ],
        [
          "Now sign-and-trade him to Brooklyn.",
          (r) => {
            assert(
              !r.snapshots.some((s) =>
                s.proposal.transfers.some(
                  (t) => t.assetId === player("Aaron Holiday").id
                )
              )
            )
            assert.match(r.message, /three|3|previous|prior|one.year/i)
          },
        ],
      ]
    )
    await journey(
      "signing transactions: eligible structure still needs evidence",
      [
        [
          "Have Houston sign and trade its free agent Aaron Holiday to Memphis on a three-year deal, $3,290,014 in the first year, with the first year fully guaranteed. Use his Bird rights, not the minimum exception.",
          (r) => {
            const s = r.snapshots.at(-1)
            assert.equal(s.proposal.signings[0].signingTeamId, team("HOU").id)
            assert.equal(s.proposal.signings[0].firstYearGuaranteed, true)
            assert.equal(s.verdict.status, "validation_incomplete")
          },
        ],
      ]
    )
  }
  report.passed = report.failures.length === 0
} catch (e) {
  report.failures.push({ error: e.message })
  report.passed = false
  console.log(e.stack)
} finally {
  await writeFile(path, JSON.stringify(report, null, 2))
  await server.close()
  await rm(directory, { recursive: true, force: true })
  console.log(
    JSON.stringify({
      passed: report.passed,
      mechanics: report.checks.length,
      turns: report.results.length,
      failures: report.failures,
    })
  )
  if (!report.passed) process.exitCode = 1
}
