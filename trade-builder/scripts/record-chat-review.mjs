// Explicit live refresh: configured model + validator; isolated temporary database.
import { createServer } from "vite"
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { reviewBackendRevision } from "./chat-review-sources.mjs"

const backendRevision = await reviewBackendRevision()

const directory = await mkdtemp(join(tmpdir(), "gambit-review-"))
process.env.GAMBIT_CONVERSATION_DB = join(directory, "conversations.sqlite")
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
let closeStore
let results = []
const incomplete = []
let definitions = []
const reportPath = process.argv[2] ?? "/tmp/gambit-review-current.json"
const argumentsAfterPath = process.argv.slice(3)
const filter = argumentsAfterPath.find((argument) => !argument.startsWith("--"))
const resume = argumentsAfterPath.includes("--resume")
const concurrency = Math.max(
  1,
  Math.min(
    6,
    Number(
      argumentsAfterPath
        .find((argument) => argument.startsWith("--concurrency="))
        ?.split("=")[1] ?? 3
    )
  )
)
let reportWrite = Promise.resolve()
function saveReport() {
  const contents =
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        backendRevision,
        definitions,
        results,
        incomplete,
      },
      null,
      2
    ) + "\n"
  reportWrite = reportWrite.then(async () => {
    await writeFile(`${reportPath}.next`, contents)
    await rename(`${reportPath}.next`, reportPath)
  })
  return reportWrite
}
try {
  const { runChatTurn, chatAvailable } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const { loadCatalogue } = await server.ssrLoadModule(
    "/src/server/trade-api.ts"
  )
  if (!chatAvailable())
    throw new Error(
      "Configure the model credential before refreshing live recordings."
    )
  const { clarificationReply } = await server.ssrLoadModule(
    "/src/lib/trade-clarification.ts"
  )
  const { readTradeConversation, getSession } = await server.ssrLoadModule(
    "/src/server/trade-session.ts"
  )
  const { browseIdeas } = await server.ssrLoadModule(
    "/src/server/trade-ideas.ts"
  )
  const { searchKey } = await server.ssrLoadModule(
    "/src/server/conversation-records.ts"
  )
  const { getConversationStore } = await server.ssrLoadModule(
    "/src/server/conversation-store.ts"
  )
  closeStore = () => getConversationStore().close()
  const catalogue = await loadCatalogue()
  await writeFile(
    new URL("../src/lib/ux-review/catalogue.json", import.meta.url),
    JSON.stringify(catalogue, null, 2) + "\n"
  )
  const saved = JSON.parse(
    await readFile(
      new URL("../src/lib/ux-review/conversations.json", import.meta.url),
      "utf8"
    )
  )
  const originalNames = [
    "trade revisions",
    "ambiguous name clarification",
    "incomplete request clarification",
    "research and unsupported requests",
    "badge and conversational references",
    "cancellation reset and preservation",
    "ambiguous edit references",
    "one way and unsupported hypotheticals",
    "replacement with badges",
    "trade discovery",
  ]
  const baseline = originalNames.map((name) => ({
    name,
    turns: saved
      .filter((t) => t.scenario === name)
      .map((t) => ({
        message: t.input,
        selectedPlayerIds: t.selectedPlayerIds,
      })),
  }))
  const cases = JSON.parse(
    await readFile(new URL("./ux-review-cases.json", import.meta.url), "utf8")
  )
  const id = (name) => catalogue.players.find((p) => p.name === name)?.id
  const defaultSelection = (name, message) => {
    if (
      name === "badge and conversational references" &&
      message === "Swap these two players."
    )
      return [id("Derrick White"), id("Andrew Wiggins")]
    if (name === "replacement with badges" && message.startsWith("Patrick"))
      return [id("Patrick Williams"), id("Grant Williams")]
    if (name === "replacement with badges" && message.startsWith("Andrew"))
      return [id("Andrew Wiggins"), id("Patrick Williams")]
    if (
      name === "research and unsupported requests" &&
      message === "Swap these selected players."
    )
      return [999999999]
    return undefined
  }
  async function record(scenario) {
    const sessionId = randomUUID()
    let previous
    let previousIdeas = []
    let original
    let version = 0
    for (const spec of scenario.turns) {
      let message = spec.message
      let selectedPlayerIds =
        spec.players?.map(id) ??
        spec.selectedPlayerIds ??
        defaultSelection(scenario.name, message)
      let clarificationAnswer
      let selections
      if (
        spec.chooseIdeaIndices ||
        spec.choose ||
        spec.chooseTeamId ||
        spec.chooseTeamIds ||
        spec.chooseOptionIds ||
        (spec.chooseOptionId ?? spec.chooseId)
      ) {
        const question =
          previous?.pendingClarification ?? previous?.clarification
        const requested = spec.chooseTeamIds ??
          spec.chooseOptionIds ?? [
            spec.chooseTeamId ??
              spec.chooseOptionId ??
              spec.chooseId ??
              spec.choose,
          ]
        selections = spec.chooseIdeaIndices
          ? spec.chooseIdeaIndices.map((index) => previousIdeas[index])
          : requested.map((choice) =>
              question?.options.find((option) =>
                spec.chooseTeamIds || spec.chooseTeamId
                  ? option.teamId === choice
                  : spec.chooseOptionIds || spec.chooseOptionId || spec.chooseId
                    ? option.id === choice
                    : option.playerId === id(choice)
              )
            )
        if (selections.some((option) => !option)) {
          if (!spec.chooseTeamIds)
            throw new Error(`${scenario.name}: offered selection missing`)
          // A vague setup can ask about players before teams. Answer naturally
          // rather than fabricating an option selection that wasn't offered.
          const teams = spec.chooseTeamIds.map((teamId) =>
            catalogue.teams.find((team) => team.id === teamId)
          )
          if (teams.some((team) => !team))
            throw new Error(`${scenario.name}: team missing from catalogue`)
          message =
            `${teams.map((team) => team.name).join(", ")}. ${spec.extra ?? ""}`.trim()
          selections = undefined
        } else {
          const reply = clarificationReply(
            { text: spec.extra ?? "", playerIds: [], unresolved: 0 },
            selections,
            question.id
          )
          message = reply.text
          selectedPlayerIds = reply.playerIds
          clarificationAnswer = reply.clarificationAnswer
        }
      }
      const toolTrace = []
      let failure
      const result = await runChatTurn(
        {
          sessionId,
          requestId: randomUUID(),
          message,
          selectedPlayerIds,
          clarificationAnswer,
          expectedConversationVersion: spec.stale ? 0 : version,
          ...(spec.original && original ? { reference: original } : {}),
        },
        catalogue,
        {
          onStep: (event) => toolTrace.push(event),
          onError: (error) => {
            const causes = []
            const seen = new Set()
            for (
              let cause = error;
              cause instanceof Error && !seen.has(cause);
              cause = cause.cause
            ) {
              seen.add(cause)
              causes.push({
                name: cause.name,
                message: cause.message.slice(0, 1000),
              })
            }
            failure = causes
          },
        }
      )
      if (
        result.status === "agent_unavailable" ||
        !Array.isArray(result.snapshots) ||
        typeof result.message !== "string"
      )
        throw new Error(
          `${scenario.name}: recording unavailable: ${result.message}`
        )
      if (!original && result.snapshot)
        original = {
          proposalId: result.snapshot.proposal.proposalId,
          revision: result.snapshot.proposal.revision,
        }
      const question = result.pendingClarification ?? result.clarification
      let ideaOptions
      if (question?.tradeSearch) {
        const search = getSession(sessionId).records.searches.find(
          (candidate) => searchKey(candidate) === question.tradeSearch.reference
        )
        if (!search)
          throw new Error(`${scenario.name}: picker search is unavailable`)
        ideaOptions = []
        let cursor = 0
        do {
          const page = browseIdeas(search, cursor)
          ideaOptions.push(...page.options)
          cursor = page.nextCursor
        } while (cursor !== null && ideaOptions.length < 300)
      }
      previousIdeas = ideaOptions ?? []
      results.push({
        backendRevision,
        recordedAt: new Date().toISOString(),
        scenario: scenario.name,
        scenarioTitle: scenario.title,
        scenarioDescription: scenario.description,
        scenarioTags: scenario.tags,
        input: message,
        selectedPlayerIds,
        selections,
        ideaOptions,
        captured: true,
        toolTrace,
        ...(failure ? { failure } : {}),
        conversation: readTradeConversation(sessionId),
        result,
      })
      previous = result
      version = result.conversationVersion ?? version
      await saveReport()
      console.log(
        `${scenario.name}: ${result.status}; ${result.candidates?.length ?? 0} candidates; ${result.snapshot?.verdict?.status ?? "no displayed proposal"} — ${message.replaceAll("\n", " ").slice(0, 100)}`
      )
    }
  }
  const selected = [
    ...baseline.filter(
      (scenario) =>
        !cases.some((definition) => definition.name === scenario.name)
    ),
    ...cases,
  ].filter((s) => !filter || new RegExp(filter).test(s.name))
  definitions = selected.map((scenario) => ({
    name: scenario.name,
    turnCount: scenario.turns.length,
  }))
  if (resume) {
    const previousReport = JSON.parse(await readFile(reportPath, "utf8"))
    results = previousReport.results.filter((row) => {
      const definition = selected.find(
        (scenario) => scenario.name === row.scenario
      )
      return (
        definition &&
        row.backendRevision === backendRevision &&
        previousReport.results
          .filter((record) => record.scenario === row.scenario)
          .every(
            (record) =>
              !(
                record.result.pendingClarification ??
                record.result.clarification
              )?.tradeSearch || Array.isArray(record.ideaOptions)
          ) &&
        previousReport.results.filter(
          (record) => record.scenario === row.scenario
        ).length === definition.turns.length
      )
    })
  }
  const completed = new Set(results.map((row) => row.scenario))
  const queue = selected.filter((scenario) => !completed.has(scenario.name))
  console.log(
    `Refreshing ${queue.length} conversations; ${completed.size} already complete; concurrency ${concurrency}.`
  )
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (next < queue.length) {
        const scenario = queue[next++]
        try {
          await record(scenario)
        } catch (error) {
          const issue = { scenario: scenario.name, message: error.message }
          incomplete.push(issue)
          await saveReport()
          console.error(`Incomplete recording: ${issue.message}`)
        }
      }
    })
  )
  console.log(
    `Recorded ${results.length} turns in ${new Set(results.map((row) => row.scenario)).size} conversations (${incomplete.length} unfinished recordings). These are observations, not semantic test-pass claims.`
  )
} finally {
  await saveReport()
  closeStore?.()
  await server.close()
  await rm(directory, { recursive: true, force: true })
}
