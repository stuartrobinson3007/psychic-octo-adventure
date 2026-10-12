// Live conversation exercise. Uses the configured model and actual trade validator.
import { createServer } from "vite"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
const directory = await mkdtemp(join(tmpdir(), "gambit-picker-"))
process.env.GAMBIT_CONVERSATION_DB = join(directory, "conversations.sqlite")
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const results = [],
  measurements = []
let closeStore
function ensure(condition, message) {
  if (!condition) throw new Error(message)
}
try {
  const { runChatTurn } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const { loadCatalogue, evaluateProposal } = await server.ssrLoadModule(
    "/src/server/trade-api.ts"
  )
  const { getSession, readTradeConversation } = await server.ssrLoadModule(
    "/src/server/trade-session.ts"
  )
  const { getConversationStore } = await server.ssrLoadModule(
    "/src/server/conversation-store.ts"
  )
  const { browseIdeas } = await server.ssrLoadModule(
    "/src/server/trade-ideas.ts"
  )
  const { clarificationReply } = await server.ssrLoadModule(
    "/src/lib/trade-clarification.ts"
  )
  const catalogue = await loadCatalogue()
  closeStore = () => getConversationStore().close()
  const workflows = [
    {
      name: "Trade idea selection with financial filters",
      tags: ["search", "selection", "financial"],
      message:
        "Find Bulls options: one player for one player, incoming salary at most $12 million, saving at least $5 million, payroll after the trade at most $142 million.",
      count: 1,
    },
    {
      name: "Incoming guard selection and five checks",
      tags: ["search", "selection", "five-checks"],
      message:
        "Find Boston trade options for an incoming guard, one player for one player.",
      count: 5,
    },
    {
      name: "Package browsing with player inspection",
      tags: ["search", "selection", "packages"],
      message: "Find trades for Steph Curry.",
      count: 2,
    },
  ]
  for (const workflow of workflows) {
    let version = 0,
      checks = 0,
      previous
    const sessionId = randomUUID()
    const evaluate = async (...args) => {
      checks++
      return evaluateProposal(...args)
    }
    const send = async (message, clarificationAnswer) => {
      const trace = []
      const start = performance.now()
      const result = await runChatTurn(
        {
          sessionId,
          requestId: randomUUID(),
          message,
          clarificationAnswer,
          expectedConversationVersion: version,
        },
        catalogue,
        { evaluate, onStep: (e) => trace.push(e) }
      )
      version = result.conversationVersion
      ensure(
        !["error", "conflict", "agent_unavailable"].includes(result.status),
        `${workflow.name}: ${result.message}`
      )
      results.push({
        scenario: workflow.name,
        scenarioTitle: workflow.name,
        scenarioDescription:
          "Live model discovery, user selection and backend validation. Ideas are browsed before checking only chosen trades.",
        scenarioTags: workflow.tags,
        input: message,
        recordedAt: new Date().toISOString(),
        captured: true,
        conversation: readTradeConversation(sessionId),
        toolTrace: trace,
        result,
      })
      measurements.push({
        scenario: workflow.name,
        message,
        ms: Math.round(performance.now() - start),
        checks,
      })
      console.log(
        `${workflow.name}: ${result.status}; checks=${checks}; ${Math.round(performance.now() - start)}ms`
      )
      previous = result
      return result
    }
    const initial = await send(workflow.message)
    ensure(checks === 0, "Browsing must not call the validator")
    ensure(
      initial.clarification?.purpose === "trade_selection",
      "Expected trade picker"
    )
    const question = initial.clarification
    const search = getSession(sessionId).records.searches.at(-1)
    const ideas = []
    let cursor = 0
    do {
      const page = browseIdeas(search, cursor)
      ideas.push(...page.options)
      cursor = page.nextCursor
    } while (cursor !== null && ideas.length < 300)
    results.at(-1).ideaOptions = ideas
    ensure(
      new Set(ideas.map((o) => o.id)).size === ideas.length,
      "Candidate pages repeated an idea"
    )
    if (workflow.count === 1)
      ensure(
        ideas.length === 160,
        `Expected the 160 financial ideas, found ${ideas.length}`
      )
    ensure(
      question.tradeSearch.total === ideas.length || ideas.length === 300,
      "Picker total did not match the locally generated ideas"
    )
    if (workflow.count === 1) {
      const query = "Chicago"
      const matches = ideas.filter((option) =>
        option.searchText.toLowerCase().includes(query.toLowerCase())
      )
      const filtered = browseIdeas(search, 0, query)
      ensure(
        filtered.total === matches.length,
        "Search filter total is incorrect"
      )
      const secondPage = browseIdeas(search, browseIdeas(search).nextCursor)
      ensure(
        secondPage.total === 160 && secondPage.options.length === 30,
        "Paging changed the total"
      )
    }
    const selected = ideas.slice(
      workflow.count === 1 ? 35 : 0,
      workflow.count === 1 ? 36 : workflow.count
    )
    ensure(selected.length === workflow.count, "Not enough ideas to check")
    const draft = clarificationReply(
      { text: "", playerIds: [], unresolved: 0 },
      selected,
      question.id
    )
    const checked = await send(draft.text, draft.clarificationAnswer)
    ensure(
      checks === workflow.count,
      `Expected ${workflow.count} backend calls, got ${checks}`
    )
    ensure(
      checked.snapshots.length === workflow.count,
      "Expected one checked card per selection"
    )
    ensure(
      checked.snapshots.every(
        (snapshot, i) =>
          selected[i].tradeIdea.reference ===
          `proposal:${snapshot.proposal.proposalId}@${snapshot.proposal.revision}`
      ),
      "Selected proposal identity/order changed"
    )
    ensure(!checked.pendingClarification, "Answered picker is still active")
    const receipt = readTradeConversation(sessionId).messages.at(-2).selections
    ensure(
      receipt?.length === selected.length &&
        receipt.every((option, i) => option.id === selected[i].id),
      "Selected ideas were not recorded in the conversation"
    )
    if (workflow.count === 1) {
      await send("Why did that trade fail?")
      const resumed = await send("Show the Bulls options again.")
      ensure(
        resumed.clarification?.purpose === "trade_selection",
        "Saved search did not reopen"
      )
      ensure(checks === 1, "Explanation or reopening checked extra ideas")
    }
  }
  await writeFile(
    process.argv[2] ?? "/tmp/gambit-picker-e2e.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), measurements, results },
      null,
      2
    )
  )
} finally {
  closeStore?.()
  await server.close()
  await rm(directory, { recursive: true, force: true })
}
