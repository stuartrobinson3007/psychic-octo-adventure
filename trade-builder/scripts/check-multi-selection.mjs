// Real-model/backend journeys for saved multi-choice questions and canonical answers.
import assert from "node:assert/strict"
import { createServer } from "vite"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const directory = await mkdtemp(join(tmpdir(), "gambit-multi-choice-"))
process.env.GAMBIT_CONVERSATION_DB = join(directory, "conversations.sqlite")
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const reportPath = process.argv[2] ?? "/tmp/gambit-multi-selection.json"
const report = { checkedAt: new Date().toISOString(), results: [], checks: [] }
try {
  const { runChatTurn, chatAvailable } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const { loadCatalogue } = await server.ssrLoadModule(
    "/src/server/trade-api.ts"
  )
  const { getSession } = await server.ssrLoadModule(
    "/src/server/trade-session.ts"
  )
  const { clarificationReply } = await server.ssrLoadModule(
    "/src/lib/trade-clarification.ts"
  )
  if (!chatAvailable())
    throw new Error("Configure the model before running live journeys.")
  const catalogue = await loadCatalogue()
  let sessionId = crypto.randomUUID()
  let version = 0
  async function turn(
    message,
    extra = {},
    scenario = "multi choice: three teams and compound reply"
  ) {
    const trace = []
    const result = await runChatTurn(
      {
        sessionId,
        requestId: crypto.randomUUID(),
        expectedConversationVersion: version,
        message,
        ...extra,
      },
      catalogue,
      { onStep: (step) => trace.push(step) }
    )
    version = result.conversationVersion
    const row = {
      scenario,
      scenarioTitle: "Select three teams",
      scenarioDescription:
        "Choose teams across filtered lists, then submit all choices with player routes.",
      scenarioTags: ["Multiple selection", "Three teams", "Compound answer"],
      input: message,
      recordedAt: new Date().toISOString(),
      result,
      toolTrace: trace,
    }
    const receipt = getSession(sessionId).messages.at(-2)?.selections
    if (receipt) row.selections = receipt
    report.results.push(row)
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n")
    console.log(
      JSON.stringify({
        message,
        status: result.status,
        selectionLimits: result.clarification?.selectionLimits,
        receipt: receipt?.map((option) => option.label),
      })
    )
    return result
  }
  const initial = await turn(
    "Help me build a three-team trade. Where should we start?"
  )
  assert.equal(initial.status, "needs_clarification")
  assert.deepEqual(initial.clarification.selectionLimits, { min: 3, max: 3 })
  assert.equal(initial.clarification.options.length, 30)
  const choices = ["BOS", "DEN", "GSW"].map((abbreviation) => {
    const team = catalogue.teams.find(
      (team) => team.abbreviation === abbreviation
    )
    return initial.clarification.options.find(
      (option) => option.teamId === team.id
    )
  })
  const draft = {
    text: "Send Jayson Tatum to Denver, Nikola Jokic to Golden State, and Stephen Curry to Boston.",
    playerIds: [],
    unresolved: 0,
  }
  for (const [label, selections, questionId] of [
    ["too few", choices.slice(0, 2), initial.clarification.id],
    [
      "duplicate",
      [choices[0], choices[0], choices[1]],
      initial.clarification.id,
    ],
    [
      "too many",
      [
        ...choices,
        initial.clarification.options.find(
          (option) => !choices.includes(option)
        ),
      ],
      initial.clarification.id,
    ],
    ["wrong question", choices, crypto.randomUUID()],
  ]) {
    const reply = clarificationReply(draft, selections, questionId)
    const invalid = await turn(
      reply.text,
      { clarificationAnswer: reply.clarificationAnswer },
      "multi choice: stale and invalid answers"
    )
    assert.equal(invalid.status, "conflict", label)
    assert.equal(getSession(sessionId).revisions.length, 0)
    report.checks.push(`${label}: rejected without changing proposals`)
  }
  const reply = clarificationReply(draft, choices, initial.clarification.id)
  const checked = await turn(reply.text, {
    clarificationAnswer: reply.clarificationAnswer,
  })
  assert.equal(checked.status, "complete", checked.message)
  assert.equal(checked.snapshots.at(-1).proposal.teamIds.length, 3)
  assert.equal(checked.snapshots.at(-1).proposal.transfers.length, 3)
  assert.deepEqual(
    getSession(sessionId)
      .messages.at(-2)
      .selections.map((option) => option.teamId),
    choices.map((option) => option.teamId)
  )
  assert.equal(
    getSession(sessionId).records.questions.find(
      (question) => question.id === initial.clarification.id
    ).status,
    "answered"
  )
  report.checks.push(
    "All three canonical choices and supplemental routes survive submission and persistence"
  )
  const fourth = await turn(
    "Add a fourth team: send Derrick White to Miami in that proposal."
  )
  assert.equal(fourth.status, "complete", fourth.message)
  assert.equal(fourth.snapshots.at(-1).proposal.teamIds.length, 4)
  report.checks.push(
    "The selected three-team proposal remains editable as a four-team deal"
  )
  // Start a fresh conversation so prior identity resolution cannot answer this question.
  sessionId = crypto.randomUUID()
  version = 0
  const single = await turn(
    "Start a separate deal: trade White for Andrew Wiggins.",
    {},
    "multi choice: single identity remains single"
  )
  assert.equal(single.status, "needs_clarification")
  assert.equal(single.clarification.selectionLimits?.max ?? 1, 1)
  const derrick = single.clarification.options.find(
    (option) => option.label === "Derrick White"
  )
  const answer = clarificationReply(
    { text: "", playerIds: [], unresolved: 0 },
    [derrick],
    single.clarification.id
  )
  const answered = await turn(
    answer.text,
    { clarificationAnswer: answer.clarificationAnswer },
    "multi choice: single identity remains single"
  )
  assert.equal(answered.status, "complete", answered.message)
  report.checks.push(
    "Single identity choices still submit one canonical option"
  )
  report.passed = true
} catch (error) {
  report.failure = error.message
  process.exitCode = 1
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n")
  await server.close()
  await rm(directory, { recursive: true, force: true })
  console.log(
    JSON.stringify({
      passed: report.passed ?? false,
      turns: report.results.length,
      failure: report.failure,
    })
  )
}
