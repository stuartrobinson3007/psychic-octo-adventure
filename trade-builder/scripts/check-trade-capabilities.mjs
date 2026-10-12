// Opt-in checks of the configured model and live validator; uses isolated chats.
import { createServer } from "vite"
import { writeFile } from "node:fs/promises"
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const report = []
try {
  const { runChatTurn, chatAvailable } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const { loadCatalogue } = await server.ssrLoadModule(
    "/src/server/trade-api.ts"
  )
  const { tradePackageKey } = await server.ssrLoadModule(
    "/src/server/trade-discovery.ts"
  )
  if (!chatAvailable())
    throw new Error("Configure OPENAI_API_KEY before running live checks.")
  const catalogue = await loadCatalogue()
  async function turn(sessionId, message, check) {
    const trace = []
    const result = await runChatTurn(
      { sessionId, requestId: crypto.randomUUID(), message },
      catalogue,
      { onStep: (event) => trace.push(event) }
    )
    const passed = check(result)
    report.push({ message, passed, result, trace })
    console.log(
      `${passed ? "PASS" : "FAIL"} ${message}: ${result.status}; ${result.candidates?.length ?? 0} options; ${result.snapshot?.verdict?.status ?? "no focus"}`
    )
    return result
  }
  const incoming = (snapshot, id) =>
    snapshot.proposal.transfers
      .filter((t) => t.toTeamId === id)
      .map((t) => catalogue.players.find((p) => p.id === t.assetId))
  const names = (result) =>
    result.snapshot?.proposal.transfers
      .map((t) => catalogue.players.find((p) => p.id === t.assetId)?.name)
      .sort() ?? []
  const source = catalogue.teams.find((t) => t.name === "Bulls").id
  const session = crypto.randomUUID()
  const first = await turn(
    session,
    "Find Chicago Bulls options, one player for one player, with incoming centers under 25 and without increasing payroll.",
    (r) =>
      r.status === "complete" &&
      r.candidates?.length > 0 &&
      !r.snapshot &&
      r.candidates.every((c) =>
        incoming(c, source).every((p) => p.age < 25 && /\bC\b/.test(p.position))
      )
  )
  const keys = new Set(
    first.candidates?.map((c) => tradePackageKey(c.proposal))
  )
  await turn(
    session,
    "Show me more options with the same filters.",
    (r) =>
      r.status === "complete" &&
      !r.snapshot &&
      r.candidates !== undefined &&
      r.candidates.every(
        (c) =>
          !keys.has(tradePackageKey(c.proposal)) &&
          incoming(c, source).every(
            (p) => p.age < 25 && /\bC\b/.test(p.position)
          )
      )
  )
  await turn(
    session,
    "Show more, but require incoming players under 10.",
    (r) => r.status === "complete" && !r.candidates?.length && !r.snapshot
  )
  await turn(
    crypto.randomUUID(),
    "Find Boston Celtics options: three players for three players from Miami Heat.",
    (r) =>
      r.status === "complete" &&
      r.candidates !== undefined &&
      r.candidates.every((c) => c.proposal.transfers.length === 6)
  )
  const repairSession = crypto.randomUUID()
  const original = await turn(
    repairSession,
    "Swap Derrick White for Pelle Larsson.",
    (r) =>
      r.status === "complete" && r.snapshot?.verdict?.status === "invalid_trade"
  )
  const repairs = await turn(
    repairSession,
    "Suggest a legal version, keeping Derrick White. You may replace other players.",
    (r) =>
      r.status === "complete" &&
      r.candidates?.length > 0 &&
      JSON.stringify(names(r)) === JSON.stringify(names(original)) &&
      r.candidates.every(
        (c) =>
          c.verdict?.status === "valid" &&
          c.proposal.parent?.proposalId ===
            original.snapshot.proposal.proposalId &&
          c.proposal.transfers.some(
            (t) =>
              catalogue.players.find((p) => p.id === t.assetId)?.name ===
              "Derrick White"
          )
      )
  )
  await turn(
    repairSession,
    "Use the first repair option.",
    (r) =>
      r.status === "complete" &&
      r.snapshot?.proposal.proposalId ===
        repairs.candidates?.[0]?.proposal.proposalId
  )
  const ageSession = crypto.randomUUID()
  await turn(
    ageSession,
    "Find Bulls trades for young guards.",
    (r) => r.status === "needs_clarification" && !r.candidates?.length
  )
  await turn(
    ageSession,
    "Incoming players under 25.",
    (r) =>
      r.status === "complete" &&
      r.candidates?.length > 0 &&
      r.candidates.every((c) =>
        incoming(c, source).every(
          (p) => p.age > 0 && p.age < 25 && /PG|SG/.test(p.position)
        )
      )
  )
  await turn(
    crypto.randomUUID(),
    "Find Bulls trades for players averaging 25 points per game.",
    (r) =>
      r.status === "complete" &&
      !r.candidates?.length &&
      /not.*supported|aren[’']t supported/i.test(r.message)
  )
} finally {
  await writeFile(
    process.argv[2] ?? "/tmp/gambit-trade-capabilities.json",
    JSON.stringify(report, null, 2) + "\n"
  )
  await server.close()
}
if (report.some((r) => !r.passed)) process.exitCode = 1
