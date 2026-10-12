import { createServer } from "vite"
import { writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
process.env.GAMBIT_CONVERSATION_DB = `/tmp/gambit-trade-machine-${Date.now()}.sqlite`
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const results = []
let failures = 0
try {
  const { runChatTurn, chatAvailable } = await server.ssrLoadModule(
    "/src/server/trade-harness.ts"
  )
  const { loadCatalogue } = await server.ssrLoadModule(
    "/src/server/trade-api.ts"
  )
  assert.ok(chatAvailable(), "The configured chat model is unavailable")
  const catalogue = await loadCatalogue()
  const session = () => ({ id: crypto.randomUUID(), version: 0 })
  const main = session()
  async function turn(s, message, check) {
    const steps = []
    const result = await runChatTurn(
      {
        sessionId: s.id,
        requestId: crypto.randomUUID(),
        message,
        expectedConversationVersion: s.version,
      },
      catalogue,
      {
        onStep: (step) => {
          steps.push(step)
          console.log(
            JSON.stringify({
              trace: step.tools.map((t) => ({ name: t.name, input: t.input })),
              outputs: step.results.map((r) => ({
                name: r.name,
                error: r.output?.error,
              })),
            })
          )
        },
      }
    )
    s.version = result.conversationVersion ?? s.version
    let error
    try {
      check(result)
    } catch (e) {
      error = String(e)
      failures++
    }
    results.push({ message, result, steps, error })
    await writeFile(
      process.argv[2] ?? "/tmp/gambit-trade-machine-live.json",
      JSON.stringify(results, null, 2)
    )
    console.log(
      JSON.stringify({
        message,
        status: result.status,
        reply: result.message,
        verdict: result.snapshot?.verdict?.status,
        tools: steps.flatMap((s) => s.tools.map((t) => t.name)),
        error,
      })
    )
    return result
  }
  const complete = (r) => assert.equal(r.status, "complete")
  await turn(main, "Trade Derrick White for Andrew Wiggins.", (r) => {
    complete(r)
    assert.equal(r.snapshot?.proposal.transfers.length, 2)
  })
  await turn(
    main,
    "What if Derrick White's salary were $18 million instead?",
    (r) => {
      complete(r)
      assert.equal(r.snapshot?.proposal.salaryOverrides?.[0].salary, 18_000_000)
      assert.notEqual(r.snapshot?.verdict?.status, "validation_unavailable")
    }
  )
  await turn(
    main,
    "Give Derrick White two remaining years instead, keeping the hypothetical salary.",
    (r) => {
      complete(r)
      assert.equal(r.snapshot?.proposal.salaryOverrides?.[0].yearsRemaining, 2)
      assert.equal(r.snapshot?.proposal.salaryOverrides?.[0].salary, 18_000_000)
    }
  )
  await turn(main, "Add Juhann Begarin's draft rights to Miami.", (r) => {
    complete(r)
    assert.equal(
      r.snapshot?.proposal.transfers.filter(
        (t) => t.assetType === "draft_right"
      ).length,
      1
    )
    assert.equal(r.snapshot?.proposal.transfers.length, 3)
  })
  await turn(main, "Send Juhann Begarin's rights to Chicago instead.", (r) => {
    complete(r)
    assert.equal(
      r.snapshot?.proposal.transfers.find((t) => t.assetType === "draft_right")
        ?.toTeamId,
      5
    )
  })
  await turn(main, "Undo that last change.", (r) => {
    complete(r)
    assert.equal(
      r.snapshot?.proposal.transfers.find((t) => t.assetType === "draft_right")
        ?.toTeamId,
      16
    )
  })
  await turn(main, "Use Boston's Anfernee Simons trade exception.", (r) => {
    complete(r)
    assert.equal(r.snapshot?.proposal.exceptions?.[0].exceptionId, 1249)
    assert.notEqual(r.snapshot?.verdict?.status, "validation_unavailable")
  })
  await turn(
    main,
    "Explain Boston's salary matching and the hypothetical contracts.",
    (r) => {
      complete(r)
      assert.match(r.message, /18,000,000/)
    }
  )
  await turn(main, "Remove Boston's selected trade exception.", (r) => {
    complete(r)
    assert.equal(r.snapshot?.proposal.exceptions?.length, 0)
  })
  await turn(
    main,
    "Reset Derrick White's contract to its original values.",
    (r) => {
      complete(r)
      assert.equal(r.snapshot?.proposal.salaryOverrides?.length, 0)
      assert.equal(r.snapshot?.proposal.transfers.length, 3)
      assert.deepEqual(r.snapshot?.proposal.teamIds, [2, 16])
      assert.equal(
        r.snapshot?.proposal.transfers.find(
          (t) => t.assetType === "draft_right"
        )?.toTeamId,
        16
      )
    }
  )
  const signing = session()
  await turn(
    signing,
    "What contract options does Boston have for Tre Scott?",
    (r) => {
      complete(r)
      assert.ok(!r.snapshot)
      assert.match(r.message, /minimum/i)
    }
  )
  await turn(
    signing,
    "Sign Tre Scott to Boston on a one-year minimum contract.",
    (r) => {
      complete(r)
      assert.equal(r.snapshot?.proposal.teamIds.length, 1)
      assert.equal(r.snapshot?.proposal.signings?.[0].signingTeamId, 2)
      assert.equal(r.snapshot?.proposal.signings?.[0].contractYears, 1)
    }
  )
  await turn(signing, "Now sign-and-trade Tre Scott to Miami.", (r) => {
    assert.ok(["complete", "needs_clarification"].includes(r.status))
    assert.equal(r.snapshots.length, 0)
    assert.match(r.message, /three|four|3|4|previous|prior|one.year/i)
  })
  await turn(
    signing,
    "Cancel that request. Explain the Boston signing.",
    (r) => {
      complete(r)
      assert.equal(r.snapshots.length, 0)
      assert.match(r.message, /Tre Scott|one.year|minimum/i)
    }
  )
  const stretch = session()
  await turn(
    stretch,
    "Stretch and waive Derrick White's contract in Boston as a hypothetical.",
    (r) => {
      complete(r)
      const p = catalogue.players.find((p) => p.name === "Derrick White")
      assert.equal(
        r.snapshot?.proposal.salaryOverrides?.[0].yearsRemaining,
        2 * p.yearsRemaining + 1
      )
      assert.equal(
        r.snapshot?.proposal.salaryOverrides?.[0].salary,
        Math.round((p.salary * p.yearsRemaining) / (2 * p.yearsRemaining + 1))
      )
      assert.ok(r.snapshot?.proposal.salaryOverrides?.[0].isStretchAndWaive)
    }
  )
  await turn(stretch, "Explain Boston's payroll after the stretch.", (r) => {
    complete(r)
    assert.match(r.message, /stretch-and-waive/i)
  })
  const rights = session()
  await turn(
    rights,
    "Trade Juhann Begarin's draft rights from Boston to Miami.",
    (r) => {
      complete(r)
      assert.equal(r.snapshot?.proposal.transfers.length, 1)
      assert.equal(r.snapshot?.proposal.transfers[0].assetType, "draft_right")
      assert.equal(r.snapshot?.verdict?.teams[0].salaryOut, 0)
    }
  )
  const partial = session()
  await turn(partial, "Sign Tre Scott to Boston.", (r) => {
    assert.equal(r.status, "needs_clarification")
    assert.ok(!r.snapshot)
  })
  await turn(partial, "One year at the minimum.", (r) => {
    complete(r)
    assert.equal(r.snapshot?.proposal.signings?.[0].contractYears, 1)
  })
  await turn(
    session(),
    "Trade Derrick White to Miami for Andrew Wiggins to Boston. Set White's hypothetical annual salary to $18 million, add Juhann Begarin's draft rights to Miami, and use Boston's Anfernee Simons trade exception.",
    (r) => {
      complete(r)
      assert.equal(r.snapshot?.proposal.transfers.length, 3)
      assert.equal(r.snapshot?.proposal.salaryOverrides?.[0].salary, 18_000_000)
      assert.equal(r.snapshot?.proposal.exceptions?.[0].teamId, 2)
      assert.equal(r.snapshot?.verdict?.status, "valid")
    }
  )
} finally {
  await writeFile(
    process.argv[2] ?? "/tmp/gambit-trade-machine-live.json",
    JSON.stringify(results, null, 2)
  )
  await server.close()
}
if (failures) process.exitCode = 1
