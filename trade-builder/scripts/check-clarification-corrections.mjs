// Opt-in model/validator regression for selected answers followed by corrections.
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
  const { getSession, withSessionLock, recordExchange } =
    await server.ssrLoadModule("/src/server/trade-session.ts")
  const { playerClarificationOptions } = await server.ssrLoadModule(
    "/src/lib/trade-clarification.ts"
  )
  if (!chatAvailable())
    throw new Error("Configure OPENAI_API_KEY before running live checks.")
  const catalogue = await loadCatalogue()
  const named = (name) => catalogue.players.find((p) => p.name === name)
  const yanic = named("Yanic Konan Niederhauser")
  const white = named("Derrick White")
  const wiggins = named("Andrew Wiggins")
  async function seed() {
    const id = crypto.randomUUID()
    await withSessionLock(id, async () => {
      const session = getSession(id)
      const options = playerClarificationOptions(
        [yanic.id, named("Nick Richards").id, named("Nick Smith Jr.").id],
        catalogue
      )
      const clarification = { question: "Which Nick do you mean?", options }
      session.pending = {
        proposal: {
          proposalId: crypto.randomUUID(),
          revision: 0,
          teamIds: [],
          transfers: [],
          createdAt: new Date().toISOString(),
        },
        messages: ["trade nick for andrew"],
        resolvedPlayerIds: [],
        ambiguousPlayerIds: options.map((o) => o.playerId),
        changed: false,
        mode: "create",
        intent: "new_trade",
        clarification,
      }
      recordExchange(
        session,
        { requestId: crypto.randomUUID(), message: "trade nick for andrew" },
        {
          status: "needs_clarification",
          message: clarification.question,
          clarification,
          snapshot: null,
          snapshots: [],
          changes: [],
        }
      )
    })
    return id
  }
  async function turn(sessionId, message, extras, check) {
    const trace = []
    const errors = []
    const result = await runChatTurn(
      { sessionId, requestId: crypto.randomUUID(), message, ...extras },
      catalogue,
      {
        onStep: (step) => trace.push(step),
        onError: (error) =>
          errors.push({
            name: error?.name,
            message: error?.message,
            statusCode: error?.statusCode,
          }),
      }
    )
    const passed = check(result, getSession(sessionId))
    report.push({ message, passed, result, trace, errors })
    console.log(
      `${passed ? "PASS" : "FAIL"} ${message.replaceAll("\n", " / ")}: ${result.message}`
    )
    await writeFile(
      process.argv[2] ?? "/tmp/gambit-clarification-corrections.json",
      JSON.stringify(report, null, 2)
    )
    return result
  }
  for (const structured of [false, true]) {
    const id = await seed()
    const text = "actually i mean dave"
    await turn(
      id,
      `${yanic.name}\n\n${text}`,
      {
        selectedPlayerIds: [yanic.id],
        ...(structured
          ? { clarificationAnswer: { optionId: `player-${yanic.id}`, text } }
          : {}),
      },
      (r, s) =>
        r.status === "needs_clarification" &&
        /dave/i.test(r.message) &&
        !r.snapshot &&
        !/andrew|yanic/i.test(r.message) &&
        !s.pending.resolvedPlayerIds.includes(yanic.id) &&
        s.pending.messages[0] === "trade dave for andrew"
    )
  }
  const id = await seed()
  const text = "Actually I mean Derrick White."
  const corrected = await turn(
    id,
    `${yanic.name}\n\n${text}`,
    {
      selectedPlayerIds: [yanic.id],
      clarificationAnswer: { optionId: `player-${yanic.id}`, text },
    },
    (r, s) =>
      r.status === "needs_clarification" &&
      /andrew/i.test(r.message) &&
      !r.snapshot &&
      s.pending.resolvedPlayerIds.includes(white.id) &&
      !s.pending.resolvedPlayerIds.includes(yanic.id)
  )
  const choice = corrected.clarification?.options.find(
    (o) => o.playerId === wiggins.id
  )
  await turn(
    id,
    wiggins.name,
    {
      selectedPlayerIds: [wiggins.id],
      ...(choice
        ? { clarificationAnswer: { optionId: choice.id, text: "" } }
        : {}),
    },
    (r) =>
      r.status === "complete" &&
      r.snapshot?.verdict?.status === "valid" &&
      JSON.stringify(
        r.snapshot.proposal.transfers
          .map((t) => t.assetId)
          .sort((a, b) => a - b)
      ) === JSON.stringify([white.id, wiggins.id].sort((a, b) => a - b))
  )
} finally {
  await server.close()
}
if (report.some((r) => !r.passed)) process.exitCode = 1
