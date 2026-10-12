// Live conversational journeys: real model, real catalogue and real trade checks.
import assert from "node:assert/strict"
import { createServer } from "vite"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
const dir = await mkdtemp(join(tmpdir(), "gambit-context-"))
process.env.GAMBIT_CONVERSATION_DB = join(dir, "conversations.sqlite")
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
})
const report = {
  checkedAt: new Date().toISOString(),
  results: [],
  failures: [],
}
const path = process.argv[2] ?? "/tmp/gambit-context-journeys.json"
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
  if (!chatAvailable())
    throw new Error("Configure the model before running live journeys.")
  const catalogue = await loadCatalogue()
  const pid = (name) => {
    const p = catalogue.players.find((p) => p.name === name)
    assert(p, `Missing ${name}`)
    return p.id
  }
  const names = (snapshot) =>
    snapshot?.proposal.transfers
      .filter((t) => t.assetType === "player")
      .map((t) => catalogue.players.find((p) => p.id === t.assetId)?.name)
      .sort() ?? []
  const complete = (r) => assert.equal(r.status, "complete", r.message)
  const assets = (r, expected) => {
    complete(r)
    assert.deepEqual(names(r.snapshots.at(-1)), [...expected].sort())
  }
  async function journey(name, body) {
    const sessionId = crypto.randomUUID()
    let version = 0
    let last
    const turn = async (
      message,
      check = complete,
      extra = {},
      dependencies = {}
    ) => {
      const trace = []
      const result = await runChatTurn(
        {
          sessionId,
          requestId: crypto.randomUUID(),
          message,
          expectedConversationVersion: version,
          ...extra,
        },
        catalogue,
        {
          ...dependencies,
          onStep: (s) => {
            trace.push(s)
            dependencies.onStep?.(s)
          },
        }
      )
      version = result.conversationVersion
      const row = {
        scenario: name,
        input: message,
        scenarioTitle: name,
        scenarioDescription: "Live conversation context journey",
        scenarioTags: ["Conversation context", "Live backend"],
        captured: true,
        recordedAt: new Date().toISOString(),
        toolTrace: trace,
        result,
      }
      report.results.push(row)
      try {
        await check(result, last, getSession(sessionId))
      } catch (e) {
        row.failure = e.message
        report.failures.push({ scenario: name, message, failure: e.message })
      }
      last = result
      await writeFile(path, JSON.stringify(report, null, 2) + "\n")
      console.log(
        JSON.stringify({
          scenario: name,
          message,
          status: result.status,
          players: names(result.snapshots.at(-1)),
          candidates: result.candidates?.length,
          failure: row.failure,
        })
      )
      return result
    }
    try {
      await body(turn, () => getSession(sessionId))
    } catch (e) {
      report.failures.push({ scenario: name, failure: e.message })
      console.log(`${name}: ${e.message}`)
    }
  }
  const cases = [
    [
      "historical batches and replacement search",
      async (turn, state) => {
        const found = await turn("Find trades for Steph Curry.", (r) => {
          complete(r)
          assert(r.candidates?.length === 3, r.message)
        })
        if (found.candidates?.length !== 3) return
        const [first, middle, last] = found.candidates
        const middleOthers = names(middle).filter((n) => n !== "Stephen Curry")
        const lastOthers = names(last).filter((n) => n !== "Stephen Curry")
        const orderedOthers = [...middleOthers].sort(
          (a, b) =>
            catalogue.players.find((p) => p.name === a).salary -
            catalogue.players.find((p) => p.name === b).salary
        )
        const target = orderedOthers[0],
          fixed = orderedOthers[1]
        await turn(
          `In the last of those three options, replace ${lastOthers[0]} with Coby White.`,
          (r) => assets(r, ["Stephen Curry", lastOthers[1], "Coby White"])
        )
        await turn(
          `What player could replace ${target} in the original middle option? Keep Stephen Curry and ${fixed} in place.`,
          (r, _last, s) => {
            complete(r)
            const searches = s.records.searches
            const spec = searches.at(-1).specification
            assert.equal(spec.kind, "replacement")
            assert.equal(spec.proposal.proposalId, middle.proposal.proposalId)
            assert.equal(spec.request.replacementPlayerIds[0], pid(target))
            for (const candidate of r.candidates ?? [])
              for (const t of middle.proposal.transfers.filter(
                (t) => t.assetId !== pid(target)
              ))
                assert(
                  candidate.proposal.transfers.some(
                    (x) => JSON.stringify(x) === JSON.stringify(t)
                  )
                )
          }
        )
        const search = state().records.searches.at(-1)
        await turn("What is Boston's current payroll?", (r) => {
          complete(r)
          assert.equal(r.pendingClarification, null)
        })
        await turn(
          "Show me more of those player replacements.",
          (r, _last, s) => {
            complete(r)
            assert.equal(s.records.searches.at(-1).id, search.id)
            assert.equal(
              s.records.batches.at(-1).search,
              `search:${search.id}@${search.revision}`
            )
          }
        )
        await turn(
          "Compare the original middle trade with the Coby White version.",
          (r) => {
            complete(r)
            assert.equal(r.snapshots.length, 0)
            assert(r.message.includes("Coby"))
          }
        )
        await turn("Undo that Coby White swap.", (r) => assets(r, names(last)))
        await turn(
          "In the original first option, assume Stephen Curry earns $20 million per year.",
          (r) => {
            assets(r, names(first))
            assert.equal(
              r.snapshots
                .at(-1)
                .proposal.salaryOverrides.find(
                  (x) => x.playerId === pid("Stephen Curry")
                ).salary,
              20000000
            )
          }
        )
      },
    ],
    [
      "multi-team and hypothetical branches",
      async (turn) => {
        await turn(
          "Build a three-team trade: Jayson Tatum to Denver, Nikola Jokic to Golden State, and Stephen Curry to Boston.",
          (r) => {
            assets(r, ["Jayson Tatum", "Nikola Jokic", "Stephen Curry"])
            assert.equal(r.snapshots.at(-1).proposal.teamIds.length, 3)
          }
        )
        await turn("Replace Curry with Giannis in that deal.", (r) => {
          assets(r, ["Jayson Tatum", "Nikola Jokic", "Giannis Antetokounmpo"])
          assert.equal(r.snapshots.at(-1).proposal.teamIds.length, 3)
          const s = r.snapshots.at(-1).proposal
          assert(
            s.transfers.some(
              (x) =>
                x.assetId === pid("Nikola Jokic") &&
                x.toTeamId ===
                  catalogue.players.find(
                    (p) => p.id === pid("Giannis Antetokounmpo")
                  ).teamId
            )
          )
        })
        await turn(
          "New four-team trade: Tatum to Denver, Jokic to Golden State, Curry to Miami, and Bam Adebayo to Boston.",
          (r) => {
            assets(r, [
              "Jayson Tatum",
              "Nikola Jokic",
              "Stephen Curry",
              "Bam Adebayo",
            ])
            assert.equal(r.snapshots.at(-1).proposal.teamIds.length, 4)
          }
        )
        await turn(
          "On that four-team trade, assume Tatum makes $10 million a year.",
          (r) => {
            assets(r, [
              "Jayson Tatum",
              "Nikola Jokic",
              "Stephen Curry",
              "Bam Adebayo",
            ])
            assert.equal(
              r.snapshots.at(-1).proposal.salaryOverrides[0].salary,
              10000000
            )
          }
        )
        await turn(
          "Now a separate deal: Derrick White for Andrew Wiggins.",
          (r) => {
            assets(r, ["Derrick White", "Andrew Wiggins"])
            assert(!r.snapshots.at(-1).proposal.salaryOverrides?.length)
          }
        )
        await turn(
          "Return to the four-team hypothetical and remove the salary assumption.",
          (r) => {
            assets(r, [
              "Jayson Tatum",
              "Nikola Jokic",
              "Stephen Curry",
              "Bam Adebayo",
            ])
            assert(!r.snapshots.at(-1).proposal.salaryOverrides?.length)
          }
        )
      },
    ],
    [
      "signing identity and ownership",
      async (turn) => {
        await turn("Find trades for Steph Curry.", (r) => {
          complete(r)
          assert(r.candidates?.length)
        })
        await turn("Do his brother instead.", (r) => {
          complete(r)
          assert(r.message.includes("Seth"))
          assert(!r.candidates?.length)
        })
        await turn("Okay, sign him.", (r) => {
          assert.equal(r.status, "needs_clarification")
          assert.equal(r.clarification.purpose, "team_selection")
          assert.equal(r.clarification.options.length, catalogue.teams.length)
          assert(r.clarification.optionSearch)
        })
        await turn("Boston, one year at the minimum.", (r) => {
          complete(r)
          const p = r.snapshots.at(-1).proposal
          assert.equal(p.signings[0].playerId, pid("Seth Curry"))
          assert.equal(p.teamIds.length, 1)
          assert.equal(p.transfers.length, 0)
        })
        await turn(
          "Trade him to Miami for Andrew Wiggins in that signing scenario.",
          (r) => {
            assets(r, ["Seth Curry", "Andrew Wiggins"])
            assert.equal(
              r.snapshots.at(-1).proposal.signings[0].playerId,
              pid("Seth Curry")
            )
          }
        )
        await turn(
          "What is Seth's actual team, outside this hypothetical?",
          (r) => {
            complete(r)
            assert(!r.snapshots.length)
            assert(/unsigned|free.agent/i.test(r.message))
          }
        )
      },
    ],
    [
      "clarification interruptions and corrections",
      async (turn) => {
        await turn("Trade White for Andrew Wiggins.", (r) => {
          assert.equal(r.status, "needs_clarification")
          assert(
            ["Derrick White", "Coby White"].every((name) =>
              r.clarification.options.some((o) => o.playerId === pid(name))
            )
          )
        })
        await turn("Before choosing, what is Boston's payroll?", (r) => {
          complete(r)
          assert.equal(r.pendingClarification, null)
        })
        await turn("I meant Derrick White. Add Payton Pritchard too.", (r) =>
          assets(r, ["Derrick White", "Andrew Wiggins", "Payton Pritchard"])
        )
        await turn(
          "Actually swap Derrick for Steph in the original White-Wiggins trade.",
          (r) =>
            assets(r, ["Stephen Curry", "Andrew Wiggins", "Payton Pritchard"])
        )
        await turn("New trade: Frodo Baggins for Andrew Wiggins.", (r) => {
          assert(["complete", "needs_clarification"].includes(r.status))
          assert(/Frodo/.test(r.message))
          assert(!r.snapshots.length)
        })
        await turn("Cancel that request. What is Wiggins' salary?", (r) => {
          complete(r)
          assert.equal(r.pendingClarification, null)
          assert(!r.snapshots.length)
        })
      },
    ],
    [
      "filters and search refinement",
      async (turn) => {
        await turn(
          "Find one-for-one Bulls trades for incoming centers under 25 without increasing payroll.",
          (r, _last, s) => {
            complete(r)
            const spec = s.records.searches.at(-1).specification
            assert.equal(spec.kind, "discovery")
            assert.equal(spec.request.constraints.maxAge, 24)
            assert.deepEqual(spec.request.constraints.positions, ["C"])
            assert.equal(spec.request.constraints.minSalarySavings, 0)
          }
        )
        await turn(
          "Drop the age limit but keep the other filters.",
          (r, _last, s) => {
            complete(r)
            const constraints =
              s.records.searches.at(-1).specification.request.constraints
            assert.equal(constraints.maxAge, undefined)
            assert.deepEqual(constraints.positions, ["C"])
            assert.equal(constraints.minSalarySavings, 0)
          }
        )
        await turn("Show more.", (r, _last, s) => {
          complete(r)
          const constraints =
            s.records.searches.at(-1).specification.request.constraints
          assert.deepEqual(constraints.positions, ["C"])
          assert.equal(constraints.minSalarySavings, 0)
        })
        await turn("Only players scoring 20 points a game.", (r) => {
          assert(!r.candidates?.length)
          assert(/performance|scoring|points|statistics/i.test(r.message))
        })
      },
    ],
  ]
  cases.push(
    [
      "exception identity and atomic assumptions",
      async (turn) => {
        await turn("Trade Derrick White for Andrew Wiggins.", (r) =>
          assets(r, ["Derrick White", "Andrew Wiggins"])
        )
        await turn("Use Boston's trade exception.", (r) => {
          assert.equal(r.status, "needs_clarification")
          assert(r.clarification.options.length > 1)
          assert(
            r.clarification.options.some((o) => /Anfernee Simons/.test(o.label))
          )
          assert(!r.snapshots.length)
        })
        await turn(
          "The Anfernee Simons one. Also set White's hypothetical annual salary to $18 million and add Juhann Begarin's draft rights to Miami.",
          (r) => {
            assets(r, ["Derrick White", "Andrew Wiggins"])
            const p = r.snapshots.at(-1).proposal
            assert.equal(p.exceptions[0].sourcePlayerName, "Anfernee Simons")
            assert.equal(
              p.salaryOverrides.find((x) => x.playerId === pid("Derrick White"))
                .salary,
              18000000
            )
            assert(p.transfers.some((x) => x.assetType === "draft_right"))
          }
        )
        await turn("Remove just the exception.", (r) => {
          assets(r, ["Derrick White", "Andrew Wiggins"])
          const p = r.snapshots.at(-1).proposal
          assert(!p.exceptions?.length)
          assert(p.transfers.some((x) => x.assetType === "draft_right"))
          assert.equal(p.salaryOverrides[0].salary, 18000000)
        })
      },
    ],
    [
      "retry cancellation and conflicting clients",
      async (turn, state) => {
        const requestId = crypto.randomUUID()
        const original = await turn(
          "Trade Derrick White for Andrew Wiggins.",
          (r) => assets(r, ["Derrick White", "Andrew Wiggins"]),
          { requestId }
        )
        const version = state().version
        await turn(
          "Trade Derrick White for Andrew Wiggins.",
          (r, _last, s) => {
            assert.deepEqual(r, original)
            assert.equal(s.version, version)
          },
          { requestId, expectedConversationVersion: 0 }
        )
        const revisions = structuredClone(state().revisions)
        await turn(
          "Add Payton Pritchard to that deal.",
          (r, _last, s) => {
            assert.equal(r.status, "error")
            assert.deepEqual(s.revisions, revisions)
            assert(
              s.records.executions.some((x) => x.operation === "turn_failure")
            )
          },
          {},
          { signal: AbortSignal.abort(new Error("Cancelled live journey")) }
        )
        const controller = new AbortController()
        let checkedBeforeAbort = false
        await turn(
          "Add Payton Pritchard to the White-Wiggins package.",
          (r, _last, s) => {
            assert.equal(r.status, "error")
            assert(checkedBeforeAbort)
            assert.deepEqual(s.revisions, revisions)
            assert(
              s.records.executions.some(
                (x) =>
                  x.operation === "check_proposal" && x.turnStatus === "failed"
              )
            )
          },
          {},
          {
            signal: controller.signal,
            onStep: (step) => {
              if (
                step.results.some(
                  (x) => x.name === "check_proposal" && !x.output.error
                )
              ) {
                checkedBeforeAbort = true
                controller.abort(new Error("Cancelled after real validation"))
              }
            },
          }
        )
        await turn("Please explain why the last request failed.", (r) => {
          complete(r)
          assert(!r.snapshots.length)
          assert(/cancel|interrupt|fail/i.test(r.message))
        })
        await turn("Add Pritchard to the White-Wiggins deal.", (r) =>
          assets(r, ["Derrick White", "Andrew Wiggins", "Payton Pritchard"])
        )
        const results = await Promise.all([
          turn("What is Boston's payroll?", (r) =>
            assert(["complete", "conflict"].includes(r.status))
          ),
          turn("What is Miami's payroll?", (r) =>
            assert(["complete", "conflict"].includes(r.status))
          ),
        ])
        assert.equal(results.filter((r) => r.status === "complete").length, 1)
        assert.equal(results.filter((r) => r.status === "conflict").length, 1)
        assert.deepEqual(
          names(state().revisions.at(-1)),
          ["Derrick White", "Andrew Wiggins", "Payton Pritchard"].sort()
        )
      },
    ]
  )
  cases.push([
    "compound explicit destinations",
    async (turn) => {
      await turn("Trade Derrick White for Andrew Wiggins.", (r) =>
        assets(r, ["Derrick White", "Andrew Wiggins"])
      )
      await turn(
        "Replace White with Stephen Curry, and add Jrue Holiday going to Boston. Wiggins should go back to Stephen's team.",
        (r) => {
          assets(r, ["Stephen Curry", "Andrew Wiggins", "Jrue Holiday"])
          const p = r.snapshots.at(-1).proposal
          assert.equal(p.teamIds.length, 4)
          assert.equal(
            p.transfers.find((x) => x.assetId === pid("Jrue Holiday")).toTeamId,
            catalogue.players.find((x) => x.id === pid("Derrick White")).teamId
          )
          assert.equal(
            p.transfers.find((x) => x.assetId === pid("Andrew Wiggins"))
              .toTeamId,
            catalogue.players.find((x) => x.id === pid("Stephen Curry")).teamId
          )
        }
      )
    },
  ])
  const selected = cases.filter(
    ([name]) => !process.argv[3] || new RegExp(process.argv[3]).test(name)
  )
  for (let i = 0; i < selected.length; i += 2)
    await Promise.allSettled(
      selected.slice(i, i + 2).map(([name, body]) => journey(name, body))
    )
  console.log(
    JSON.stringify({ turns: report.results.length, failures: report.failures })
  )
} finally {
  await writeFile(path, JSON.stringify(report, null, 2) + "\n")
  await server.close()
  await rm(dir, { recursive: true, force: true })
}
if (report.failures.length) process.exitCode = 1
