// Live application checks: real HTTP/SSE transport, configured model and validator.
// Start Vite with an isolated GAMBIT_CONVERSATION_DB, then run this script.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { loadCatalogue } from "../src/server/trade-api.ts"
import { sendStreamingTradeMessage } from "../src/lib/trade-chat-stream.ts"

const endpoint = process.env.GAMBIT_E2E_URL ?? "http://127.0.0.1:3021"
const reportPath = process.argv[2] ?? "/tmp/gambit-intentions-e2e.json"
const catalogue = await loadCatalogue()
const results = []
let serviceUnavailable = false
const player = (name) => {
  const p = catalogue.players.find((candidate) => candidate.name === name)
  assert.ok(p, `Catalogue player missing: ${name}`)
  return p
}
const team = (name) => {
  const t = catalogue.teams.find(
    (candidate) => `${candidate.city} ${candidate.name}` === name
  )
  assert.ok(t, `Catalogue team missing: ${name}`)
  return t.id
}
const names = (snapshot) =>
  snapshot?.proposal.transfers
    .filter((t) => t.assetType === "player")
    .map((t) => catalogue.players.find((p) => p.id === t.assetId)?.name)
    .sort() ?? []
const has = (r, expected) =>
  assert.deepEqual(names(r.snapshot), [...expected].sort())
const complete = (r) => assert.equal(r.status, "complete", r.message)
const clarify = (r) => assert.equal(r.status, "needs_clarification", r.message)
const unchanged = (r, previous) =>
  assert.deepEqual(
    r.snapshot?.proposal ?? null,
    previous?.snapshot?.proposal ?? null
  )
const leg = (r, name, to) =>
  assert.ok(
    r.snapshot?.proposal.transfers.some(
      (t) =>
        t.assetType === "player" &&
        t.assetId === player(name).id &&
        t.fromTeamId === player(name).teamId &&
        t.toTeamId === team(to)
    ),
    `${name} must go to ${to}`
  )
const discovered = (r, outgoing) => {
  complete(r)
  assert.equal(r.clarification, undefined)
  assert.ok(r.candidates?.length, r.message)
  for (const candidate of r.candidates) {
    assert.equal(candidate.verdict?.status, "valid")
    for (const name of outgoing)
      assert.ok(
        candidate.proposal.transfers.some(
          (t) => t.assetType === "player" && t.assetId === player(name).id
        )
      )
  }
}
const swap = "Trade Derrick White for Andrew Wiggins."
const cycle =
  "Send Jayson Tatum to Denver, Nikola Jokic to Golden State, and Stephen Curry to Boston in a three-team trade."
const askForPlayers = (r) => {
  clarify(r)
  assert.equal(
    r.clarification.question,
    "Which players would you like to include?"
  )
  assert.deepEqual(r.clarification.options, [])
  assert.equal(r.snapshot, null)
}
let middleAlternativeSeed
const fixedSlotAlternatives = (r, previous, seed, target) => {
  complete(r)
  unchanged(r, previous)
  const id = player(target).id
  const fixed = seed.proposal.transfers.filter(
    (t) => t.assetType !== "player" || t.assetId !== id
  )
  const slot = seed.proposal.transfers.find(
    (t) => t.assetType === "player" && t.assetId === id
  )
  assert.ok(
    r.toolCalls?.some((call) => call.label === "Found player alternatives"),
    r.message
  )
  assert.match(r.message, /alternative|replacement/i)
  for (const c of r.candidates ?? []) {
    assert.equal(c.verdict.status, "valid")
    assert.deepEqual(c.proposal.parent, {
      proposalId: seed.proposal.proposalId,
      revision: seed.proposal.revision,
    })
    assert.equal(c.proposal.transfers.length, seed.proposal.transfers.length)
    assert.deepEqual(c.proposal.teamIds, seed.proposal.teamIds)
    for (const transfer of fixed)
      assert.ok(
        c.proposal.transfers.some(
          (t) => JSON.stringify(t) === JSON.stringify(transfer)
        )
      )
    const replacement = c.proposal.transfers.find(
      (t) => !fixed.some((f) => JSON.stringify(f) === JSON.stringify(t))
    )
    assert.notEqual(replacement.assetId, id)
    assert.equal(replacement.fromTeamId, slot.fromTeamId)
    assert.equal(replacement.toTeamId, slot.toTeamId)
  }
}
const scenarios = [
  {
    name: "player alternatives: historical middle proposal",
    turns: [
      {
        message: "find trades for steph curry",
        check: (r) => {
          discovered(r, ["Stephen Curry"])
          middleAlternativeSeed = r.candidates[1]
          assert.deepEqual(names(middleAlternativeSeed), [
            "Bam Adebayo",
            "Davion Mitchell",
            "Stephen Curry",
          ])
        },
      },
      { message: "swap davis for white on that last trade", check: clarify },
      {
        choose: "Coby White",
        check: (r) => {
          complete(r)
          has(r, ["Stephen Curry", "Will Riley", "Coby White"])
        },
      },
      {
        message: "what player could we swap mitchell for on that middle trade?",
        check: (r, p) => {
          fixedSlotAlternatives(r, p, middleAlternativeSeed, "Davion Mitchell")
          assert.match(r.message, /Curry/)
          assert.match(r.message, /Adebayo/)
          assert.equal(r.candidates.length, 0)
        },
      },
      {
        message: "can you tell me how you interpreted my last message?",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.match(r.message, /Mitchell/)
          assert.match(r.message, /Adebayo/)
          assert.doesNotMatch(
            r.message,
            /can[’\x27]t verify|cannot verify|couldn[’\x27]t verify|record.*unavailable/i
          )
        },
      },
      {
        message: "why is my current trade invalid?",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          has(r, ["Stephen Curry", "Will Riley", "Coby White"])
        },
      },
    ],
  },
  {
    name: "player alternatives: invalid package and selection",
    turns: [
      {
        message: "Trade Stephen Curry for Andrew Wiggins and Bam Adebayo.",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.verdict.status, "invalid_trade")
        },
      },
      {
        message: "who else could take Wiggins' place here?",
        check: (r, p) => {
          fixedSlotAlternatives(r, p, p.snapshot, "Andrew Wiggins")
          assert.ok(r.candidates.length, r.message)
        },
      },
      {
        message: "go with the first one",
        check: (r, p) => {
          complete(r)
          assert.deepEqual(r.snapshot.proposal, p.candidates[0].proposal)
        },
      },
      {
        message:
          "instead of that last search, show me more general Curry trade options",
        check: (r, p) => {
          discovered(r, ["Stephen Curry"])
          unchanged(r, p)
        },
      },
    ],
  },
  {
    name: "player alternatives: filters and missing target",
    turns: [
      {
        message: "Trade Stephen Curry for Andrew Wiggins and Bam Adebayo.",
        check: complete,
      },
      {
        message: "find a replacement for Wiggins, but only centers under 25",
        check: (r, p) => {
          fixedSlotAlternatives(r, p, p.snapshot, "Andrew Wiggins")
          for (const c of r.candidates ?? []) {
            const replacement = c.proposal.transfers.find(
              (t) =>
                t.assetType === "player" &&
                !p.snapshot.proposal.transfers.some(
                  (f) => f.assetType === "player" && f.assetId === t.assetId
                )
            )
            const incoming = catalogue.players.find(
              (p) => p.id === replacement.assetId
            )
            assert.ok(incoming.age <= 24)
            assert.ok(incoming.position.includes("C"))
          }
        },
      },
      {
        message: "find alternatives to Mitchell in this trade",
        check: (r) => {
          clarify(r)
          assert.ok(
            r.clarification.options.some(
              (o) => o.playerId === player("Andrew Wiggins").id
            )
          )
        },
      },
      {
        choose: "Andrew Wiggins",
        check: (r, p) => {
          complete(r)
          has(r, ["Stephen Curry", "Andrew Wiggins", "Bam Adebayo"])
        },
      },
    ],
  },

  {
    name: "clarification choices: signing team catalogue",
    turns: [
      {
        message: "find trades for steph curry",
        check: (r) => discovered(r, ["Stephen Curry"]),
      },
      {
        message: "do his brother instead",
        check: (r) => {
          complete(r)
          assert.match(r.message, /Seth Curry.*unsigned/i)
        },
      },
      {
        message: "ok, sign him",
        check: (r) => {
          clarify(r)
          assert.equal(r.clarification.purpose, "team_selection")
          assert.deepEqual(
            new Set(r.clarification.options.map((o) => o.teamId)),
            new Set(catalogue.teams.map((t) => t.id))
          )
          assert.equal(r.clarification.optionSearch.label, "Search teams")
          assert.equal(r.snapshot, null)
        },
      },
      {
        chooseId: `team-${team("Boston Celtics")}`,
        text: "on a one-year minimum contract",
        check: (r) => {
          complete(r)
          assert.ok(
            r.snapshot?.proposal.signings?.some(
              (s) =>
                s.playerId === player("Seth Curry").id &&
                s.signingTeamId === team("Boston Celtics")
            ),
            r.message
          )
        },
      },
    ],
  },
  {
    name: "clarification choices: free-text identity answer",
    turns: [
      {
        message: "Trade Michael Imaginary for Derrick White.",
        check: (r) => {
          clarify(r)
          assert.deepEqual(r.clarification.options, [])
        },
      },
      {
        message: "I meant KD.",
        check: (r) => {
          complete(r)
          has(r, ["Kevin Durant", "Derrick White"])
        },
      },
    ],
  },
  {
    name: "discovery eligibility: sibling replacement and signing",
    turns: [
      {
        message: "find trades for steph curry",
        check: (r) => discovered(r, ["Stephen Curry"]),
      },
      {
        message: "do his brother instead",
        check: (r, previous) => {
          complete(r)
          assert.match(r.message, /Seth Curry.*unsigned/i)
          assert.match(r.message, /signing/i)
          assert.equal(r.clarification, undefined)
          assert.equal(r.candidates?.length ?? 0, 0)
          assert.ok(!r.toolCalls?.some((call) => call.state === "error"))
          unchanged(r, previous)
        },
      },
      {
        message: "Sign him to Boston on a one-year minimum contract instead.",
        check: (r) => {
          complete(r)
          assert.ok(
            r.snapshot?.proposal.signings?.some(
              (s) =>
                s.playerId === player("Seth Curry").id &&
                s.signingTeamId === team("Boston Celtics")
            ),
            r.message
          )
        },
      },
    ],
  },
  ...[
    ["Seth Curry", /Seth Curry.*unsigned/i],
    ["Amari Williams", /Amari Williams.*two-way/i],
  ].map(([name, reason]) => ({
    name: `discovery eligibility: ${name}`,
    turns: [
      {
        message: `Find trades for ${name}.`,
        check: (r) => {
          complete(r)
          assert.match(r.message, reason)
          assert.equal(r.clarification, undefined)
          assert.equal(r.candidates?.length ?? 0, 0)
          assert.ok(!r.toolCalls?.some((call) => call.state === "error"))
        },
      },
    ],
  })),
  {
    name: "discovery eligibility: package cannot silently omit unsigned player",
    turns: [
      {
        message: "Find trades for Stephen Curry and Seth Curry.",
        check: (r) => {
          complete(r)
          assert.match(r.message, /Seth Curry.*unsigned/i)
          assert.equal(r.candidates?.length ?? 0, 0)
          assert.equal(r.snapshot, null)
        },
      },
    ],
  },
  {
    name: "discovery eligibility: change active player and source",
    turns: [
      {
        message: "find trades for steph curry",
        check: (r) => discovered(r, ["Stephen Curry"]),
      },
      {
        message: "do KD instead",
        check: (r) => {
          discovered(r, ["Kevin Durant"])
          for (const c of r.candidates)
            assert.ok(!names(c).includes("Stephen Curry"))
        },
      },
    ],
  },
  ...[
    ["KD", "Kevin Durant"],
    ["the Greek Freak", "Giannis Antetokounmpo"],
    ["SGA", "Shai Gilgeous-Alexander"],
    ["the Joker", "Nikola Jokic"],
    ["King James", "LeBron James"],
    ["AD", "Anthony Davis"],
    ["Derrik Wite", "Derrick White"],
    ["Nikola Jokić", "Nikola Jokic"],
  ].map(([query, canonical]) => {
    const counterpart =
      player(canonical).teamId === player("Andrew Wiggins").teamId
        ? "Derrick White"
        : "Andrew Wiggins"
    return {
      name: `semantic identity: ${query}`,
      turns: [
        {
          message: `Trade ${query} for ${counterpart}.`,
          check: (r) => {
            complete(r)
            has(r, [canonical, counterpart])
            assert.equal(r.clarification, undefined)
          },
        },
      ],
    }
  }),
  ...[
    "Pat Riley",
    "Michael Jordan",
    "Michael Imaginary",
    "Taylor Swift",
    "Stephen Imaginary",
  ].map((query) => ({
    name: `semantic identity: unavailable ${query}`,
    turns: [
      {
        message: swap,
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
      {
        message: `Replace Derrick with ${query}.`,
        check: (r, previous) => {
          clarify(r)
          unchanged(r, previous)
          assert.deepEqual(r.clarification.options, [])
          assert.ok(r.clarification.question.includes(query))
        },
      },
      {
        message: "I meant KD.",
        check: (r) => {
          complete(r)
          has(r, ["Kevin Durant", "Andrew Wiggins"])
        },
      },
    ],
  })),
  {
    name: "semantic identity: ambiguous nickname",
    turns: [
      {
        message: "Trade Ant for Andrew Wiggins.",
        check: (r) => {
          clarify(r)
          for (const name of ["Anthony Edwards", "Anfernee Simons"])
            assert.ok(
              r.clarification.options.some(
                (item) => item.playerId === player(name).id
              )
            )
        },
      },
      {
        choose: "Anthony Edwards",
        check: (r) => {
          complete(r)
          has(r, ["Anthony Edwards", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "semantic identity: ambiguous name and nickname answer",
    turns: [
      {
        message: "Trade Curry for Andrew Wiggins.",
        check: (r) => {
          clarify(r)
          assert.deepEqual(
            new Set(r.clarification.options.map((item) => item.playerId)),
            new Set([player("Stephen Curry").id, player("Seth Curry").id])
          )
        },
      },
      {
        message: "Steph.",
        check: (r) => {
          complete(r)
          has(r, ["Stephen Curry", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "semantic identity: scoped nickname and historical typo",
    turns: [
      {
        message: "Trade the Greek Freak for Derrick White.",
        check: (r) => {
          complete(r)
          has(r, ["Giannis Antetokounmpo", "Derrick White"])
        },
      },
      {
        message: "Replace the Greek Freak with KD.",
        check: (r) => {
          complete(r)
          has(r, ["Kevin Durant", "Derrick White"])
        },
      },
      {
        message: "No, replace gianis with Steph in the first trade.",
        check: (r) => {
          complete(r)
          has(r, ["Stephen Curry", "Derrick White"])
        },
      },
    ],
  },
  {
    name: "semantic identity: pronoun after nickname research",
    turns: [
      { message: swap, check: complete },
      {
        message: "What is Derrick's salary?",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
        },
      },
      {
        message: "Replace him with KD.",
        check: (r) => {
          complete(r)
          has(r, ["Kevin Durant", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "semantic identity: nickname discovery and more",
    turns: [
      {
        message: "Find a trade for KD, one player for one player.",
        check: (r) => discovered(r, ["Kevin Durant"]),
      },
      {
        message: "Show more with the same player.",
        check: (r) => discovered(r, ["Kevin Durant"]),
      },
    ],
  },
  {
    name: "semantic identity: nickname contract",
    turns: [
      {
        message: "What if KD made $20 million per year for two years?",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.ok(
            r.snapshot?.proposal.salaryOverrides?.some(
              (item) =>
                item.playerId === player("Kevin Durant").id &&
                item.salary === 20_000_000 &&
                item.yearsRemaining === 2
            )
          )
        },
      },
    ],
  },
  {
    name: "semantic identity: relationship signing",
    turns: [
      {
        message: "Sign Steph's brother to Boston for the minimum for one year.",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.ok(
            r.snapshot?.proposal.signings?.some(
              (item) =>
                item.playerId === player("Seth Curry").id &&
                item.signingTeamId === team("Boston Celtics") &&
                item.contractYears === 1
            )
          )
        },
      },
    ],
  },
  {
    name: "semantic identity: nickname repair pin",
    turns: [
      { message: "Trade KD for Derrick White.", check: complete },
      {
        message: "Find a way to fix it. Keep KD but you can replace White.",
        check: (r, previous) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          unchanged(r, previous)
          for (const candidate of r.candidates ?? [])
            assert.ok(
              candidate.proposal.transfers.some(
                (item) =>
                  item.assetType === "player" &&
                  item.assetId === player("Kevin Durant").id
              )
            )
        },
      },
    ],
  },
  {
    name: "semantic identity: research nickname and collection",
    turns: [
      {
        message: "What's KD's salary and team?",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.equal(r.snapshot, null)
          assert.ok(r.toolCalls.some((call) => call.state === "complete"))
        },
      },
      {
        message: "Show me all the players called White.",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.match(r.message, /Derrick White/)
          assert.match(r.message, /Coby White/)
        },
      },
      {
        message: "Can Pat Riley be traded as a player?",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.equal(r.snapshot, null)
        },
      },
    ],
  },

  {
    name: "replace a scoped abbreviation and correct the first displayed trade",
    turns: [
      {
        message: swap,
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
      {
        message: "swap derrick for steph curry",
        check: (r) => {
          complete(r)
          has(r, ["Stephen Curry", "Andrew Wiggins"])
          leg(r, "Stephen Curry", "Miami Heat")
          leg(r, "Andrew Wiggins", "Golden State Warriors")
        },
      },
      {
        message: "no i mean swap driick for steph in that first trade",
        check: (r) => {
          complete(r)
          has(r, ["Stephen Curry", "Andrew Wiggins"])
          assert.equal(r.snapshot.proposal.parent.revision, 1)
        },
      },
    ],
  },
  ...[
    "must not be over 25",
    "must be no older than 25",
    "must be 25 or younger",
    "must be twenty five or younger",
  ].map((limit) => ({
    name: `equivalent age limit: ${limit}`,
    turns: [
      {
        message: `Find Chicago trades, one player for one player. Incoming players ${limit}.`,
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.ok(r.candidates?.length, r.message)
          for (const c of r.candidates)
            for (const t of c.proposal.transfers.filter(
              (t) => t.toTeamId === team("Chicago Bulls")
            ))
              assert.ok(
                catalogue.players.find((p) => p.id === t.assetId).age <= 25
              )
        },
      },
    ],
  })),

  {
    name: "shortened given name discovery",
    turns: [
      {
        message: "find a trade for steph curry",
        check: (r) => discovered(r, ["Stephen Curry"]),
      },
    ],
  },
  {
    name: "shortened names in a specified swap",
    turns: [
      {
        message: "Trade Steph Curry for Ant Edwards.",
        check: (r) => {
          complete(r)
          has(r, ["Stephen Curry", "Anthony Edwards"])
          assert.equal(r.clarification, undefined)
        },
      },
    ],
  },
  {
    name: "surname without a given name remains ambiguous",
    turns: [
      {
        message: "Find a trade for Curry.",
        check: (r) => {
          clarify(r)
          for (const name of ["Stephen Curry", "Seth Curry"])
            assert.ok(
              r.clarification.options.some(
                (option) => option.playerId === player(name).id
              )
            )
          assert.equal(r.candidates?.length ?? 0, 0)
        },
      },
    ],
  },
  {
    name: "distinct shortened and full names in the same package",
    turns: [
      {
        message: "Trade Steph Curry for Seth Curry.",
        check: (r) => {
          complete(r)
          // Seth is currently unsigned: this is a resolved identity with a
          // signing restriction, not an ambiguous Curry reference or a trade.
          assert.match(r.message, /Seth Curry.*(?:unsigned|contract status)/i)
          assert.equal(r.clarification, undefined)
          assert.equal(r.snapshot, null)
        },
      },
    ],
  },
  {
    name: "research and unsupported requests",
    turns: [
      {
        message:
          "Compare Derrick White and Andrew Wiggins. Don't create a trade.",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot, null)
        },
      },
      {
        message: "What is Derrick White's salary and contract length?",
        check: complete,
      },
      {
        message: "Swap Terry Rozier for Derrick White.",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot, null)
        },
      },
      {
        message: "Build a three-team trade between Boston, Miami and Chicago.",
        check: askForPlayers,
      },
      {
        message: "Trade Michael Imaginary to Miami.",
        check: (r) => {
          clarify(r)
          assert.ok(/Michael Imaginary/i.test(r.clarification.question))
          assert.ok(
            !/three.team|provide players/i.test(r.clarification.question)
          )
        },
      },
      {
        message: "Swap these selected players.",
        selected: [],
        invalidSelectedPlayerIds: [999999999],
        check: (r) => assert.equal(r.status, "error"),
      },
    ],
  },
  {
    name: "named teams ask for players before destinations",
    turns: [
      {
        message: "Build a three-team trade between Boston, Miami and Chicago.",
        check: askForPlayers,
      },
      {
        message: "Derrick White, Andrew Wiggins and Tre Jones",
        check: (r) => {
          clarify(r)
          assert.ok(r.clarification.options.length)
          assert.ok(r.clarification.options.every((o) => o.destination))
          assert.ok(/Which team should receive/.test(r.clarification.question))
        },
      },
      {
        message:
          "Send Derrick White to Miami, Andrew Wiggins to Chicago and Tre Jones to Boston",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins", "Tre Jones"])
          assert.equal(r.snapshot.proposal.teamIds.length, 3)
          leg(r, "Derrick White", "Miami Heat")
          leg(r, "Andrew Wiggins", "Chicago Bulls")
          leg(r, "Tre Jones", "Boston Celtics")
        },
      },
    ],
  },
  {
    name: "player question accepts a complete routed answer",
    turns: [
      {
        message: "Build a three-team trade between Boston, Miami and Chicago.",
        check: askForPlayers,
      },
      {
        message:
          "Send Derrick White to Miami, Andrew Wiggins to Chicago and Tre Jones to Boston",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins", "Tre Jones"])
          assert.equal(r.clarification, undefined)
        },
      },
    ],
  },
  {
    name: "cycle replacement",
    turns: [
      {
        message: cycle,
        check: (r) => {
          complete(r)
          has(r, ["Jayson Tatum", "Nikola Jokic", "Stephen Curry"])
        },
      },
      {
        message: "change curry for Giannis Antetokounmpo",
        selected: ["Giannis Antetokounmpo"],
        check: (r) => {
          complete(r)
          has(r, ["Jayson Tatum", "Nikola Jokic", "Giannis Antetokounmpo"])
          assert.equal(r.snapshot.proposal.teamIds.length, 3)
          leg(r, "Giannis Antetokounmpo", "Boston Celtics")
          leg(r, "Nikola Jokic", "Miami Heat")
          leg(r, "Jayson Tatum", "Denver Nuggets")
        },
      },
      {
        message: "undo that",
        check: (r) => {
          complete(r)
          has(r, ["Jayson Tatum", "Nikola Jokic", "Stephen Curry"])
          assert.equal(r.snapshot.proposal.teamIds.length, 3)
          leg(r, "Nikola Jokic", "Golden State Warriors")
        },
      },
      {
        message: "Buddy Hield instead of Curry",
        check: (r) => {
          complete(r)
          has(r, ["Jayson Tatum", "Nikola Jokic", "Buddy Hield"])
          assert.equal(r.snapshot.proposal.teamIds.length, 3)
          leg(r, "Buddy Hield", "Boston Celtics")
        },
      },
    ],
  },
  {
    name: "owner retained when another player still trades",
    turns: [
      {
        message:
          "Send Jayson Tatum to Denver, Nikola Jokic to Golden State, and Stephen Curry and Draymond Green to Boston.",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.proposal.transfers.length, 4)
        },
      },
      {
        message: "change curry for Giannis Antetokounmpo",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.proposal.teamIds.length, 4)
          leg(r, "Nikola Jokic", "Golden State Warriors")
          leg(r, "Draymond Green", "Boston Celtics")
        },
      },
    ],
  },
  {
    name: "ordinary revisions and pronouns",
    turns: [
      {
        message: swap,
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
      {
        message: "Pelle Larsson instead of Wiggins",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Pelle Larsson"])
        },
      },
      {
        message: "why doesn't that work?",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.ok(/salary|matching|apron/i.test(r.message))
        },
      },
      {
        message: "put Wiggins back",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
      {
        message: "remove him",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White"])
          leg(r, "Derrick White", "Miami Heat")
        },
      },
      {
        message: "undo",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "outgoing goal and natural option selection",
    turns: [
      {
        message: "i want to trade white",
        check: (r) => {
          clarify(r)
          assert.ok(
            r.clarification.options.some(
              (o) => o.playerId === player("Coby White").id
            )
          )
        },
      },
      {
        choose: "Derrick White",
        check: (r) => discovered(r, ["Derrick White"]),
      },
      {
        message: "the second one",
        check: (r, p) => {
          complete(r)
          assert.equal(
            r.snapshot?.proposal.proposalId,
            p.candidates[1].proposal.proposalId
          )
        },
      },
      {
        message: "is it a good deal?",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.ok(/value|performance|fair|fit|assess/i.test(r.message))
        },
      },
    ],
  },
  {
    name: "duplicate full name and implicit two-team exchange",
    turns: [
      {
        message: "trade ryan conwell, kam jones and andrew wiggins",
        check: (r) => {
          clarify(r)
          assert.equal(
            r.clarification.options.filter((o) => o.label === "Kam Jones")
              .length,
            2
          )
        },
      },
      {
        chooseId: "player-17164",
        check: (r) => {
          complete(r)
          has(r, ["Ryan Conwell", "Kam Jones", "Andrew Wiggins"])
          leg(r, "Ryan Conwell", "Chicago Bulls")
          leg(r, "Andrew Wiggins", "Chicago Bulls")
          assert.ok(
            r.snapshot.proposal.transfers.some(
              (t) =>
                t.assetType === "player" &&
                t.assetId === 17164 &&
                t.toTeamId === team("Miami Heat")
            )
          )
        },
      },
    ],
  },
  {
    name: "correction overrides a selected identity",
    turns: [
      {
        message: "trade nick for andrew",
        check: (r) => {
          clarify(r)
          assert.ok(r.clarification.options.some((o) => o.playerId))
        },
      },
      {
        chooseAny: true,
        text: "actually i mean dave",
        check: (r) => {
          clarify(r)
          assert.ok(/dave/i.test(r.message))
          assert.deepEqual(r.clarification.options, [])
        },
      },
      {
        message: "Dalen Terry.",
        check: (r) => {
          clarify(r)
          assert.ok(/andrew/i.test(r.message))
        },
      },
      {
        choose: "Andrew Wiggins",
        check: (r) => {
          complete(r)
          has(r, ["Dalen Terry", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "typo in a specified swap",
    turns: [
      {
        message: "trade derrik white for andrew wiggins",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "full name transposition",
    turns: [
      {
        message: "trade derrick whtie for andrew wiggins",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "replacement with an obvious full name typo",
    turns: [
      {
        message: swap,
        check: complete,
      },
      {
        message: "replace White with Jrue Holidy",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          has(r, ["Jrue Holiday", "Andrew Wiggins"])
          leg(r, "Jrue Holiday", "Miami Heat")
        },
      },
    ],
  },
  {
    name: "equally close full name typos remain ambiguous",
    turns: [
      {
        message: "trade jalin williams for andrew wiggins",
        check: (r) => {
          clarify(r)
          for (const name of ["Jalen Williams", "Jaylin Williams"])
            assert.ok(
              r.clarification.options.some(
                (o) => o.playerId === player(name).id
              )
            )
        },
      },
      {
        choose: "Jaylin Williams",
        check: (r) => {
          complete(r)
          has(r, ["Jaylin Williams", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "typo preserves a different first name",
    turns: [
      {
        message: "trade coby whte for andrew wiggins",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          has(r, ["Coby White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "surname alone remains ambiguous in a swap",
    turns: [
      {
        message: "trade white for andrew wiggins",
        check: (r) => {
          clarify(r)
          for (const name of ["Derrick White", "Coby White"])
            assert.ok(
              r.clarification.options.some(
                (o) => o.playerId === player(name).id
              )
            )
        },
      },
      {
        choose: "Coby White",
        check: (r) => {
          complete(r)
          has(r, ["Coby White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "unknown name and typed recovery",
    turns: [
      {
        message: "Swap Michael Imaginary for Andrew Wiggins.",
        check: (r) => {
          clarify(r)
          assert.equal(r.snapshot, null)
        },
      },
      {
        message: "Derrick White",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "fresh package and unrelated research",
    turns: [
      { message: swap, check: complete },
      {
        message: "swap Giannis Antetokounmpo for Stephen Curry",
        check: (r) => {
          complete(r)
          has(r, ["Giannis Antetokounmpo", "Stephen Curry"])
        },
      },
      {
        message:
          "compare Derrick White and Andrew Wiggins, don't change the trade",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.equal(r.snapshots.length, 0)
        },
      },
      {
        message: "what's Curry's salary?",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.ok(/62[.,]6|62,587,158/.test(r.message))
        },
      },
    ],
  },
  {
    name: "historical reference targets the original trade",
    turns: [
      { message: swap, check: complete },
      { message: "Trade Jrue Holiday for Anfernee Simons.", check: complete },
      {
        message: "Replace Wiggins with Pelle Larsson in the first trade.",
        original: true,
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Pelle Larsson"])
        },
      },
    ],
  },
  {
    name: "cancellation preserves focus and clear removes focus",
    turns: [
      { message: swap, check: complete },
      {
        message: "replace Wiggins with Williams",
        check: (r, p) => {
          clarify(r)
          unchanged(r, p)
        },
      },
      {
        message: "never mind that edit",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.equal(r.pendingClarification, null)
        },
      },
      {
        message: "start over and clear the trade",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot, null)
        },
      },
      {
        message: "Trade Jrue Holiday for Anfernee Simons.",
        check: (r) => {
          complete(r)
          has(r, ["Jrue Holiday", "Anfernee Simons"])
        },
      },
    ],
  },
  {
    name: "vague and impossible discovery filters",
    turns: [
      {
        message: "find Chicago trades for young guards",
        check: (r) => {
          clarify(r)
          assert.ok(/age|young|limit/i.test(r.message))
        },
      },
      {
        message: "under 25",
        check: (r) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.ok(Array.isArray(r.candidates))
          for (const c of r.candidates)
            for (const t of c.proposal.transfers.filter(
              (t) => t.toTeamId === team("Chicago Bulls")
            ))
              assert.ok(
                catalogue.players.find((p) => p.id === t.assetId).age < 25
              )
        },
      },
      {
        message: "more, but under 10",
        check: (r) => {
          complete(r)
          assert.equal(r.candidates?.length, 0)
        },
      },
    ],
  },
  {
    name: "named outgoing filters pagination and changed source",
    turns: [
      {
        message:
          "trade Derrick White, only with Miami and just one player back",
        check: (r) => {
          discovered(r, ["Derrick White"])
          assert.ok(
            r.candidates.every(
              (c) =>
                c.proposal.transfers.length === 2 &&
                c.proposal.teamIds.includes(team("Miami Heat"))
            )
          )
        },
      },
      {
        message: "show more",
        check: (r, p) => {
          complete(r)
          assert.equal(r.clarification, undefined)
          assert.ok(
            (r.candidates ?? []).every(
              (c) =>
                !p.candidates.some(
                  (old) =>
                    JSON.stringify(old.proposal.transfers) ===
                    JSON.stringify(c.proposal.transfers)
                )
            )
          )
        },
      },
      {
        message: "now find Chicago trades, one player for one center under 25",
        check: (r) => {
          complete(r)
          assert.ok(
            r.candidates?.every(
              (c) =>
                c.proposal.teamIds.includes(team("Chicago Bulls")) &&
                !c.proposal.transfers.some(
                  (t) =>
                    t.assetType === "player" &&
                    t.assetId === player("Derrick White").id
                )
            )
          )
        },
      },
    ],
  },
  {
    name: "repair and choose a suggestion",
    turns: [
      {
        message: "Trade Derrick White for Pelle Larsson.",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.verdict.status, "invalid_trade")
        },
      },
      {
        message: "fix it, keep White but you can replace the other player",
        check: (r, p) => {
          discovered(r, ["Derrick White"])
          unchanged(r, p)
        },
      },
      {
        message: "go with the first one",
        check: (r, p) => {
          complete(r)
          assert.equal(
            r.snapshot?.proposal.proposalId,
            p.candidates[0].proposal.proposalId
          )
        },
      },
    ],
  },
  {
    name: "unsupported requests preserve the checked trade",
    turns: [
      { message: swap, check: complete },
      {
        message: "find a five-team trade",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.equal(r.candidates?.length ?? 0, 0)
          assert.ok(/four|five|support/i.test(r.message))
        },
      },
      {
        message: "find someone averaging 30 points to replace White",
        check: (r, p) => {
          complete(r)
          unchanged(r, p)
          assert.ok(/performance|statistic|support|points/i.test(r.message))
        },
      },
    ],
  },
  {
    name: "badge-only pair",
    turns: [
      {
        message: "trade these",
        selected: ["Derrick White", "Andrew Wiggins"],
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
        },
      },
    ],
  },
  {
    name: "compound package edits",
    turns: [
      {
        message: "Trade Derrick White for Andrew Wiggins and Pelle Larsson.",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins", "Pelle Larsson"])
        },
      },
      {
        message: "remove Pelle and change Wiggins for Jrue Holiday",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Jrue Holiday"])
          assert.equal(r.snapshot.proposal.teamIds.length, 2)
          leg(r, "Derrick White", "Portland Trail Blazers")
        },
      },
    ],
  },
  {
    name: "add fourth team reroute and undo",
    turns: [
      { message: cycle, check: complete },
      {
        message: "add Andrew Wiggins going to Boston",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.proposal.teamIds.length, 4)
          has(r, [
            "Jayson Tatum",
            "Nikola Jokic",
            "Stephen Curry",
            "Andrew Wiggins",
          ])
        },
      },
      {
        message: "send Wiggins to Denver instead",
        check: (r) => {
          complete(r)
          leg(r, "Andrew Wiggins", "Denver Nuggets")
          leg(r, "Stephen Curry", "Boston Celtics")
        },
      },
      {
        message: "undo that last change",
        check: (r) => {
          complete(r)
          leg(r, "Andrew Wiggins", "Boston Celtics")
        },
      },
    ],
  },
  {
    name: "shorthand request and ambiguous replacement",
    turns: [
      {
        message: "Jrue for Simons",
        check: (r) => {
          complete(r)
          has(r, ["Jrue Holiday", "Anfernee Simons"])
        },
      },
      {
        message: "white instead of jrue",
        check: (r) => {
          clarify(r)
          assert.ok(
            r.clarification.options.some(
              (o) => o.playerId === player("Coby White").id
            )
          )
        },
      },
      {
        choose: "Derrick White",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Anfernee Simons"])
          leg(r, "Derrick White", "Philadelphia 76ers")
        },
      },
    ],
  },
  {
    name: "sparse three-team routing choices",
    turns: [
      {
        message: "trade Jayson Tatum, Stephen Curry and Nikola Jokic",
        check: (r) => {
          clarify(r)
          assert.ok(r.clarification.options.some((o) => o.destination))
        },
      },
      { destination: "Denver Nuggets", check: clarify },
      { destination: "Boston Celtics", check: clarify },
      {
        destination: "Golden State Warriors",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.proposal.teamIds.length, 3)
          assert.equal(r.snapshot.proposal.transfers.length, 3)
        },
      },
    ],
  },
]

scenarios.push(
  {
    name: "research while an identity question is pending",
    turns: [
      { message: "i want to trade white", check: clarify },
      {
        message: "what is Stephen Curry's salary?",
        check: (r) => {
          complete(r)
          assert.equal(r.pendingClarification, null)
          assert.ok(/62/.test(r.message))
        },
      },
      {
        message: "Back to the trade, I meant Derrick White",
        check: (r) => discovered(r, ["Derrick White"]),
      },
    ],
  },
  {
    name: "research dismisses pending edit choices",
    turns: [
      { message: swap, check: complete },
      { message: "replace Derrick White with Williams", check: clarify },
      {
        message: "what is Stephen Curry's salary?",
        check: (r, previous) => {
          complete(r)
          unchanged(r, previous)
          assert.equal(r.pendingClarification, null)
        },
      },
      {
        message: "Back to that replacement, I meant Jaylin Williams",
        check: (r) => {
          complete(r)
          has(r, ["Jaylin Williams", "Andrew Wiggins"])
          assert.equal(r.pendingClarification, null)
        },
      },
    ],
  },
  {
    name: "a different research question replaces the picker",
    turns: [
      { message: "i want to trade white", check: clarify },
      {
        message: "what is Williams' salary?",
        check: (r) => {
          clarify(r)
          assert.ok(r.pendingClarification)
          assert.ok(/Williams/i.test(r.pendingClarification.question))
          assert.ok(!/White/i.test(r.pendingClarification.question))
        },
      },
      {
        choose: "Amari Williams",
        check: (r) => {
          complete(r)
          assert.equal(r.pendingClarification, null)
          assert.equal(r.snapshot, null)
          assert.ok(!r.candidates?.length)
        },
      },
    ],
  },
  {
    name: "same-team outgoing package searches immediately",
    turns: [
      {
        message: "I'd like to trade Derrick White and Jayson Tatum",
        check: (r) => discovered(r, ["Derrick White", "Jayson Tatum"]),
      },
    ],
  },
  {
    name: "explicitly retaining the original team",
    turns: [
      { message: cycle, check: complete },
      {
        message:
          "replace Stephen Curry with Giannis Antetokounmpo, but keep Golden State receiving Jokic",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.proposal.teamIds.length, 4)
          has(r, ["Jayson Tatum", "Nikola Jokic", "Giannis Antetokounmpo"])
          leg(r, "Nikola Jokic", "Golden State Warriors")
        },
      },
    ],
  },
  {
    name: "fresh salary-invalid trade then a legal swap",
    turns: [
      {
        message: "Trade Jrue Holiday for Anfernee Simons",
        check: (r) => {
          complete(r)
          assert.equal(r.snapshot.verdict.status, "invalid_trade")
        },
      },
      {
        message: "instead let's trade Derrick White for Andrew Wiggins",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Andrew Wiggins"])
          assert.equal(r.snapshot.verdict.status, "valid")
        },
      },
    ],
  }
)

// Pick selection is grounded in live ownership, rather than an assumed year.
const pick = catalogue.draftPicks?.find(
  (p) =>
    p.currentTeamId === team("Miami Heat") &&
    p.originalTeamId === team("Miami Heat") &&
    p.round === 1 &&
    p.isTradable &&
    !p.isSwap
)
if (pick)
  scenarios.push({
    name: "mixed picks retained through replacement and removal",
    turns: [
      {
        message: `Trade Derrick White for Andrew Wiggins and Miami's ${pick.year} first-round pick to Boston.`,
        check: (r) => {
          complete(r)
          assert.ok(
            r.snapshot.proposal.transfers.some(
              (t) => t.assetType === "pick" && t.assetId === pick.id
            )
          )
        },
      },
      {
        message: "Pelle instead of Wiggins",
        check: (r) => {
          complete(r)
          has(r, ["Derrick White", "Pelle Larsson"])
          assert.ok(
            r.snapshot.proposal.transfers.some(
              (t) =>
                t.assetType === "pick" &&
                t.assetId === pick.id &&
                t.toTeamId === team("Boston Celtics")
            )
          )
        },
      },
      {
        message: "remove the pick",
        check: (r) => {
          complete(r)
          assert.equal(
            r.snapshot.proposal.transfers.some((t) => t.assetType === "pick"),
            false
          )
          has(r, ["Derrick White", "Pelle Larsson"])
        },
      },
      {
        message: "undo",
        check: (r) => {
          complete(r)
          assert.ok(
            r.snapshot.proposal.transfers.some(
              (t) => t.assetType === "pick" && t.assetId === pick.id
            )
          )
        },
      },
    ],
  })

async function run(scenario) {
  const sessionId = randomUUID()
  let previous
  let original
  for (const spec of scenario.turns) {
    if (serviceUnavailable) break
    const started = Date.now()
    let message = spec.message ?? ""
    let selection
    let result
    let error
    const progress = []
    const requestId = randomUUID()
    try {
      if (spec.choose || spec.chooseId || spec.destination || spec.chooseAny) {
        const choices =
          previous?.pendingClarification?.options ??
          previous?.clarification?.options ??
          []
        selection = choices.find((o) =>
          spec.chooseAny
            ? !!o.playerId
            : spec.chooseId
              ? o.id === spec.chooseId
              : spec.destination
                ? o.destination?.toTeamId === team(spec.destination)
                : o.playerId === player(spec.choose).id
        )
        assert.ok(
          selection,
          `Missing offered answer ${spec.chooseId ?? spec.choose ?? spec.destination}`
        )
        message = selection.value + (spec.text ? `\n\n${spec.text}` : "")
      }
      result = await sendStreamingTradeMessage(
        {
          sessionId,
          requestId,
          message,
          expectedConversationVersion: previous?.conversationVersion,
          selectedPlayerIds:
            spec.invalidSelectedPlayerIds ??
            spec.selected?.map((name) => player(name).id),
          ...(selection
            ? {
                clarificationAnswer: {
                  optionId: selection.id,
                  text: spec.text ?? "",
                },
              }
            : {}),
          ...(spec.original ? { reference: original } : {}),
        },
        (calls) => progress.push(calls),
        { api: `${endpoint}/api/trade-chat` }
      )
      if (result.status === "agent_unavailable") serviceUnavailable = true
      spec.check(result, previous)
      if (!original && result.snapshot)
        original = {
          proposalId: result.snapshot.proposal.proposalId,
          revision: result.snapshot.proposal.revision,
        }
    } catch (e) {
      error = String(e.message ?? e)
    }
    results.push({
      scenario: scenario.name,
      sessionId,
      requestId,
      input: message,
      selection,
      selectedPlayerIds:
        spec.invalidSelectedPlayerIds ??
        spec.selected?.map((name) => player(name).id),
      passed: !error,
      error,
      elapsedMs: Date.now() - started,
      result,
      streamedUpdates: progress.length,
    })
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          endpoint,
          serviceUnavailable,
          scenarios: selected.map((item) => ({
            name: item.name,
            expectedTurns: item.turns.length,
          })),
          results,
        },
        null,
        2
      ) + "\n"
    )
    console.log(
      JSON.stringify({
        scenario: scenario.name,
        input: message,
        passed: !error,
        error,
        status: result?.status,
        message: result?.message,
        teams: result?.snapshot?.proposal.teamIds,
        players: names(result?.snapshot),
      })
    )
    if (result) previous = result
    if (error) break // Do not let a failed prerequisite create misleading follow-ups.
  }
}
const selected = scenarios.filter(
  (s) => !process.argv[3] || new RegExp(process.argv[3]).test(s.name)
)
for (let start = 0; start < selected.length; start += 3) {
  if (serviceUnavailable) break
  const batch = await Promise.allSettled(
    selected.slice(start, start + 3).map(run)
  )
  for (const outcome of batch)
    if (outcome.status === "rejected") console.error(String(outcome.reason))
}
console.log(
  `Report: ${reportPath}; ${results.filter((r) => r.passed).length}/${results.length} turns passed in ${selected.length} conversations`
)
if (results.some((r) => !r.passed)) process.exitCode = 1
