// Uses the configured model and validation API; isolated conversations stay in /tmp.
import { createServer } from "vite"
import { writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
process.env.GAMBIT_CONVERSATION_DB = `/tmp/gambit-draft-picks-${Date.now()}.sqlite`
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const results = []
try {
  const { runChatTurn, chatAvailable } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const { loadCatalogue } = await server.ssrLoadModule(
    "/src/server/trade-api.ts"
  )
  if (!chatAvailable()) throw new Error("The configured model is unavailable.")
  const catalogue = await loadCatalogue()
  const owned = catalogue.draftPicks.filter(
    (p) =>
      p.currentTeamId === 16 &&
      p.originalTeamId === 16 &&
      p.round === 1 &&
      p.isTradable &&
      !p.isSwap &&
      !p.isProtected
  )
  const chosen = owned[0]
  assert.ok(chosen)
  const sessionId = crypto.randomUUID()
  let version = 0
  async function turn(message, check) {
    const steps = []
    const result = await runChatTurn(
      {
        sessionId,
        requestId: crypto.randomUUID(),
        message,
        expectedConversationVersion: version,
      },
      catalogue,
      { onStep: (step) => steps.push(step) }
    )
    version = result.conversationVersion ?? version
    results.push({ message, result, steps })
    console.log(
      JSON.stringify({
        message,
        status: result.status,
        reply: result.message,
        assets: result.snapshot?.proposal.transfers,
        tools: steps.flatMap((s) => s.tools.map((t) => t.name)),
      })
    )
    check(result)
    return result
  }
  if (process.argv[2] === "mixed") {
    await turn(
      "Trade Derrick White for Andrew Wiggins, with Miami's 2029 first-round pick to Boston and the Charlotte 2030 second-round pick owned by Boston to Miami.",
      (result) => {
        assert.equal(result.status, "complete")
        assert.equal(result.snapshot?.proposal.transfers.length, 4)
        assert.equal(
          result.snapshot?.proposal.transfers.filter(
            (transfer) => transfer.assetType === "pick"
          ).length,
          2
        )
      }
    )
  } else {
    await turn("Trade Derrick White for Andrew Wiggins.", (r) =>
      assert.equal(r.snapshot?.proposal.transfers.length, 2)
    )
    await turn(`Add Miami's ${chosen.year} first-round pick.`, (r) => {
      assert.equal(r.status, "complete")
      assert.ok(
        r.snapshot?.proposal.transfers.some(
          (t) => t.assetType === "pick" && t.assetId === chosen.id
        )
      )
      assert.equal(r.snapshot?.proposal.transfers.length, 3)
    })
    await turn("Explain what Miami is sending, including the pick.", (r) => {
      assert.equal(r.status, "complete")
      assert.match(r.message, new RegExp(String(chosen.year)))
    })
    await turn("Remove the pick.", (r) => {
      assert.equal(r.status, "complete")
      assert.equal(r.snapshot?.proposal.transfers.length, 2)
    })
    await turn("Undo that last change.", (r) => {
      assert.equal(r.status, "complete")
      assert.equal(r.snapshot?.proposal.transfers.length, 3)
    })
    await turn("Replace Andrew Wiggins with Pelle Larsson.", (r) => {
      assert.equal(r.status, "complete")
      assert.ok(
        r.snapshot?.proposal.transfers.some(
          (t) => t.assetType === "pick" && t.assetId === chosen.id
        )
      )
    })
    const beforeReroute = results.at(-1).result.snapshot
    await turn("Send the pick to Chicago instead.", (r) => {
      assert.deepEqual(
        r.snapshot?.proposal.transfers.filter((t) => t.assetType === "player"),
        beforeReroute.proposal.transfers.filter((t) => t.assetType === "player")
      )
      assert.equal(r.status, "complete")
      assert.equal(
        r.snapshot?.proposal.transfers.find((t) => t.assetType === "pick")
          ?.toTeamId,
        5
      )
    })
    await turn("Add Miami's first-round pick to Boston.", (r) =>
      assert.equal(r.status, "needs_clarification")
    )
    await turn(
      String(owned.find((p) => p.id !== chosen.id)?.year ?? chosen.year),
      (r) => {
        assert.equal(r.status, "complete")
        assert.equal(
          r.snapshot?.proposal.transfers.filter((t) => t.assetType === "pick")
            .length,
          2
        )
      }
    )
    const before = results.at(-1).result.snapshot
    await turn("Make the pick top-five protected.", (r) => {
      assert.equal(r.status, "complete")
      assert.deepEqual(r.snapshot?.proposal, before.proposal)
    })
    const blocked = catalogue.draftPicks.find(
      (p) => p.currentTeamId === 16 && p.originalTeamId === 16 && !p.isTradable
    )
    if (blocked)
      await turn(
        `Add Miami's ${blocked.year} ${blocked.round === 1 ? "first" : "second"}-round pick.`,
        (r) => assert.deepEqual(r.snapshot?.proposal, before.proposal)
      )
  }
  console.log(`Passed ${results.length} live draft-pick turns.`)
} finally {
  await writeFile(
    process.argv[2] === "mixed"
      ? "docs/evidence/draft-pick-live-mixed.json"
      : "docs/evidence/draft-pick-live-chat.json",
    JSON.stringify(results, null, 2) + "\n"
  )
  await server.close()
}
