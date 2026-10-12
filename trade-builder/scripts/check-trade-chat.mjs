// Opt-in integration exercise: uses the configured OpenAI key and live trade API.
// Run from trade-builder: node scripts/check-trade-chat.mjs [report-path] [scenario filter]
import { createServer } from "vite"
import { writeFile } from "node:fs/promises"

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
  if (!chatAvailable())
    throw new Error("Configure OPENAI_API_KEY before running live chat checks.")
  const catalogue = await loadCatalogue()
  const names = (snapshot) =>
    snapshot?.proposal.transfers
      .map(
        (transfer) =>
          catalogue.players.find((player) => player.id === transfer.assetId)
            ?.name
      )
      .sort() ?? []
  const hasPlayers = (result, expected) =>
    JSON.stringify(names(result.snapshot)) ===
    JSON.stringify([...expected].sort())
  const scenarios = [
    {
      name: "duplicate full name in mixed-team package",
      turns: [
        {
          message: "trade ryan conwell, kam jones and andrew wiggins",
          check: (r) =>
            r.status === "needs_clarification" &&
            !r.snapshot &&
            !r.snapshots.length &&
            [17164, 17555].every((id) =>
              r.clarification?.options.some((option) => option.playerId === id)
            ) &&
            !r.clarification?.purpose,
        },
        {
          answerPlayerId: 17164,
          message: "",
          check: (r) =>
            r.status === "needs_clarification" &&
            !r.snapshots.length &&
            !r.clarification?.purpose &&
            /Ryan Conwell/i.test(r.message) &&
            /Kam Jones/i.test(r.message) &&
            /Andrew Wiggins/i.test(r.message),
        },
        {
          message:
            "Send Ryan Conwell and Andrew Wiggins to Chicago, and Kam Jones to Miami.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Ryan Conwell", "Kam Jones", "Andrew Wiggins"]) &&
            r.snapshot?.proposal.transfers.some(
              (t) =>
                t.assetType === "player" &&
                t.assetId === 17164 &&
                t.toTeamId === 16
            ) &&
            !r.snapshot?.proposal.transfers.some(
              (t) => t.assetType === "player" && t.assetId === 17555
            ),
        },
      ],
    },
    {
      name: "ambiguous replacement after discovery",
      turns: [
        {
          message: "Trade Jrue Holiday for Anfernee Simons.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Jrue Holiday", "Anfernee Simons"]),
        },
        {
          message: "find a suitable trade for Jrue",
          check: (r, previous) =>
            r.status === "complete" &&
            !!r.candidates?.length &&
            r.snapshot?.proposal.proposalId === previous?.proposal.proposalId &&
            r.candidates.every((c) =>
              c.proposal.transfers.some(
                (t) => t.assetId === 17361 && t.fromTeamId === 25
              )
            ),
        },
        {
          message: "change jrue for white",
          check: (r, previous) =>
            r.status === "needs_clarification" &&
            r.snapshot?.proposal.proposalId === previous?.proposal.proposalId &&
            !r.snapshots.length &&
            ["Coby White", "Derrick White"].every((name) =>
              r.clarification?.options.some(
                (option) =>
                  option.playerId ===
                  catalogue.players.find((p) => p.name === name)?.id
              )
            ) &&
            !r.clarification?.options.some(
              (option) => option.teamId !== undefined
            ),
        },
        {
          answerPlayer: "Derrick White",
          message: "",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Anfernee Simons"]) &&
            r.snapshot?.proposal.transfers.some(
              (t) => t.assetId === 16992 && t.toTeamId === 23
            ),
        },
      ],
    },
    {
      name: "trade revisions",
      turns: [
        {
          message: "Swap Derrick White for Andrew Wiggins.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]) &&
            r.snapshot?.verdict?.status === "valid",
        },
        {
          message: "Why does it work? Explain Miami's salary matching.",
          check: (r, previous) =>
            r.status === "complete" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length &&
            /Miami Heat sends Andrew Wiggins .*receives Derrick White/.test(
              r.message
            ),
        },
        {
          message: "Replace Andrew Wiggins with Pelle Larsson.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Pelle Larsson"]) &&
            r.snapshot?.verdict?.status === "invalid_trade",
        },
        {
          message: "Why did that fail?",
          check: (r, previous) =>
            r.status === "complete" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length,
        },
        {
          message: "Put Andrew Wiggins back instead of Pelle Larsson.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]) &&
            r.snapshot?.verdict?.status === "valid",
        },
        {
          message: "Add Miami's 2027 first-round pick.",
          check: (r, previous) =>
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length &&
            r.status === "complete" &&
            /not (?:currently )?supported|aren[’']t supported/i.test(r.message),
        },
      ],
    },
    {
      name: "ambiguous name clarification",
      turns: [
        {
          message: "Swap Derrick White for Williams.",
          check: (r) => r.status === "needs_clarification" && !r.snapshot,
        },
        {
          message: "Grant Williams.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Grant Williams"]),
        },
        {
          message: "Actually, Patrick Williams instead of Grant.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Patrick Williams"]),
        },
      ],
    },
    {
      name: "outgoing-only identity clarification",
      turns: [
        {
          message: "i want to trade white",
          check: (r) =>
            r.status === "needs_clarification" &&
            !r.snapshot &&
            ["Coby White", "Derrick White"].every((name) =>
              r.clarification?.options.some(
                (option) =>
                  option.playerId ===
                  catalogue.players.find((player) => player.name === name)?.id
              )
            ),
        },
        {
          answerPlayer: "Derrick White",
          message: "",
          check: (r) =>
            r.status === "complete" &&
            !r.clarification &&
            !!r.candidates?.length &&
            !r.snapshot &&
            !r.snapshots.length &&
            r.candidates.every((candidate) =>
              candidate.proposal.transfers.some(
                (transfer) =>
                  transfer.assetType === "player" &&
                  transfer.assetId === 16992 &&
                  transfer.fromTeamId === 2
              )
            ),
        },
      ],
    },
    ...["", "Only Miami, with one player coming back."].map((preference) => ({
      name: preference
        ? "outgoing-only constrained discovery"
        : "outgoing-only named discovery",
      turns: [
        {
          message: `I'd like to trade Derrick White. ${preference}`.trim(),
          check: (r) =>
            r.status === "complete" &&
            !r.clarification &&
            !r.snapshot &&
            !r.snapshots.length &&
            !!r.candidates?.length &&
            r.candidates.every(
              (candidate) =>
                candidate.proposal.transfers.some(
                  (transfer) =>
                    transfer.assetType === "player" &&
                    transfer.assetId === 16992 &&
                    transfer.fromTeamId === 2 &&
                    (!preference || transfer.toTeamId === 16)
                ) &&
                (!preference || candidate.proposal.transfers.length === 2)
            ),
        },
      ],
    })),
    {
      name: "outgoing-only package discovery",
      turns: [
        {
          message: "I'd like to trade Andrew Wiggins and Pelle Larsson.",
          check: (r) =>
            r.status === "complete" &&
            !r.clarification &&
            !r.snapshots.length &&
            !!r.candidates?.length &&
            r.candidates.every((candidate) =>
              ["Andrew Wiggins", "Pelle Larsson"]
                .map(
                  (name) =>
                    catalogue.players.find((player) => player.name === name).id
                )
                .every((id) =>
                  candidate.proposal.transfers.some(
                    (transfer) =>
                      transfer.assetType === "player" &&
                      transfer.assetId === id &&
                      transfer.fromTeamId === 16
                  )
                )
            ),
        },
      ],
    },
    {
      name: "research and unsupported requests",
      turns: [
        {
          message:
            "Compare Derrick White and Andrew Wiggins. Don't create a trade.",
          selectedPlayerIds: [16992, 17222],
          check: (r) => r.status === "complete" && !r.snapshot,
        },
        {
          message: "What is Derrick White's salary and contract length?",
          check: (r) =>
            r.status === "complete" &&
            !r.snapshot &&
            /30[,.]?348|30\.3/.test(r.message),
        },
        {
          message: "Swap Terry Rozier for Derrick White.",
          check: (r) =>
            r.status === "complete" &&
            !r.snapshot &&
            !r.snapshots.length &&
            /not (?:currently )?supported|isn[’']t supported|free agent/i.test(
              r.message
            ),
        },
        {
          message:
            "Build a three-team trade between Boston, Miami and Chicago.",
          check: (r) =>
            r.status === "needs_clarification" &&
            !r.snapshot &&
            !r.snapshots.length &&
            !/not (?:currently )?supported|aren[’']t supported/i.test(
              r.message
            ),
        },
        {
          message: "Trade Michael Imaginary to Miami.",
          check: (r) =>
            r.status === "needs_clarification" &&
            !r.snapshot &&
            !r.snapshots.length,
        },
        {
          message: "Swap these selected players.",
          selectedPlayerIds: [999999999],
          check: (r) => r.status === "error" && !r.snapshot,
        },
      ],
    },
    {
      name: "badge and conversational references",
      turns: [
        {
          message: "Swap these two players.",
          selectedPlayerIds: [16992, 17222],
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]),
        },
        {
          message: "Remove Wiggins.",
          check: (r) =>
            r.status === "complete" && hasPlayers(r, ["Derrick White"]),
        },
        {
          message: "Undo that last change.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]),
        },
      ],
    },
  ]
  scenarios.push(
    {
      name: "cancellation reset and preservation",
      turns: [
        {
          message: "Swap Derrick White for Andrew Wiggins.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]),
        },
        {
          message: "Add Williams.",
          check: (r, previous) =>
            r.status === "needs_clarification" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length,
        },
        {
          message: "Never mind that edit.",
          check: (r, previous) =>
            r.status === "complete" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length,
        },
        {
          message:
            "Is this a good deal for Miami? Use only the available catalogue data.",
          check: (r, previous) =>
            r.status === "complete" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length &&
            /cannot determine.*good or fair deal/.test(r.message),
        },
        {
          message: "Start over and clear the current trade.",
          check: (r) => r.status === "complete" && r.snapshot === null,
        },
        {
          message: "Swap Derrick White for Grant Williams.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Grant Williams"]),
        },
      ],
    },
    {
      name: "ambiguous edit references",
      turns: [
        {
          message: "Swap Derrick White for Andrew Wiggins.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]),
        },
        {
          message: "Remove him.",
          check: (r, previous) =>
            r.status === "needs_clarification" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length,
        },
        {
          message: "Andrew Wiggins.",
          check: (r) =>
            r.status === "complete" && hasPlayers(r, ["Derrick White"]),
        },
        {
          message: "Undo that change.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]),
        },
        {
          message: "Also add Derrick White again.",
          check: (r, previous) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White", "Andrew Wiggins"]) &&
            r.snapshot?.proposal.revision === previous?.proposal.revision,
        },
      ],
    },
    {
      name: "one way and unsupported hypotheticals",
      turns: [
        {
          message: "Send Derrick White to Miami with no player coming back.",
          check: (r) =>
            r.status === "complete" &&
            hasPlayers(r, ["Derrick White"]) &&
            r.snapshot?.verdict?.status === "invalid_trade",
        },
        {
          message: "Change his salary to $1 million so it works.",
          check: (r, previous) =>
            r.status === "complete" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length &&
            /not (?:currently )?supported|aren[’']t supported/i.test(r.message),
        },
        {
          message: "Sign Terry Rozier and then trade him for Derrick White.",
          check: (r, previous) =>
            r.status === "complete" &&
            r.snapshot?.proposal.revision === previous?.proposal.revision &&
            !r.snapshots.length &&
            /not (?:currently )?supported|aren[’']t supported/i.test(r.message),
        },
      ],
    }
  )
  scenarios.push({
    name: "replacement with badges",
    turns: [
      {
        message: "Swap Derrick White for Grant Williams.",
        check: (r) =>
          r.status === "complete" &&
          hasPlayers(r, ["Derrick White", "Grant Williams"]),
      },
      {
        message: "Patrick Williams instead of Grant Williams.",
        selectedPlayerIds: catalogue.players
          .filter((p) =>
            ["Patrick Williams", "Grant Williams"].includes(p.name)
          )
          .map((p) => p.id),
        check: (r) =>
          r.status === "complete" &&
          hasPlayers(r, ["Derrick White", "Patrick Williams"]),
      },
      {
        message: "Andrew Wiggins instead of Patrick Williams.",
        selectedPlayerIds: catalogue.players
          .filter((p) =>
            ["Andrew Wiggins", "Patrick Williams"].includes(p.name)
          )
          .map((p) => p.id),
        check: (r) =>
          r.status === "complete" &&
          hasPlayers(r, ["Derrick White", "Andrew Wiggins"]) &&
          r.snapshot?.verdict?.status === "valid",
      },
    ],
  })
  scenarios.push({
    name: "trade discovery",
    turns: [
      {
        message: "Swap Derrick White for Andrew Wiggins.",
        check: (r) =>
          r.status === "complete" &&
          hasPlayers(r, ["Derrick White", "Andrew Wiggins"]),
      },
      {
        message:
          "Find Boston trade options with exactly one outgoing player and two incoming players. Exclude Derrick White.",
        check: (r, previous) =>
          r.status === "complete" &&
          r.snapshot?.proposal.proposalId === previous?.proposal.proposalId &&
          r.snapshot?.proposal.revision === previous?.proposal.revision &&
          (r.candidates?.length ?? 0) > 0 &&
          r.candidates.every(
            (c) =>
              c.verdict?.status === "valid" &&
              !names(c).includes("Derrick White") &&
              c.proposal.transfers.length === 3
          ),
      },
      {
        message: "Now require all incoming players to be under 25.",
        check: (r, previous) =>
          r.status === "complete" &&
          r.snapshot?.proposal.revision === previous?.proposal.revision &&
          !r.candidates?.length &&
          /filter|age|unsupported|not (?:implemented|support)|outside.*scope/i.test(
            r.message
          ),
      },
    ],
  })
  const runScenario = async (scenario) => {
    const sessionId = crypto.randomUUID()
    let previous = null
    let previousResult = null
    for (const turn of scenario.turns) {
      const start = Date.now()
      const trace = []
      const choice =
        turn.answerAction || turn.answerPlayer || turn.answerPlayerId
          ? previousResult?.clarification?.options.find((option) =>
              turn.answerAction
                ? option.action === turn.answerAction
                : option.playerId ===
                  (turn.answerPlayerId ??
                    catalogue.players.find(
                      (player) => player.name === turn.answerPlayer
                    )?.id)
            )
          : undefined
      if (
        (turn.answerAction || turn.answerPlayer || turn.answerPlayerId) &&
        !choice
      )
        throw new Error(
          `Missing offered answer: ${turn.answerAction ?? turn.answerPlayer}`
        )
      const message = choice
        ? choice.value + (turn.message ? `\n\n${turn.message}` : "")
        : turn.message
      const result = await runChatTurn(
        {
          sessionId,
          requestId: crypto.randomUUID(),
          message,
          ...(choice
            ? {
                clarificationAnswer: {
                  optionId: choice.id,
                  text: turn.message,
                },
              }
            : {}),
          selectedPlayerIds: turn.selectedPlayerIds,
          expectedRevision: previous?.proposal.revision,
        },
        catalogue,
        { onStep: (step) => trace.push(step) }
      )
      const passed = turn.check(result, previous)
      const entry = {
        scenario: scenario.name,
        input: message,
        ...(choice ? { selection: choice } : {}),
        passed,
        elapsedMs: Date.now() - start,
        result,
        trace,
      }
      results.push(entry)
      console.log(
        JSON.stringify({
          scenario: scenario.name,
          input: turn.message,
          passed,
          status: result.status,
          revision: result.snapshot?.proposal.revision,
          players: names(result.snapshot),
          verdict: result.snapshot?.verdict?.status,
          message: result.message,
        })
      )
      if (!passed)
        console.log(
          JSON.stringify({
            failedToolTrace: trace.map((step) => ({
              tools: step.tools,
              errors: step.results.filter((result) => result.output?.error),
            })),
          })
        )
      previous = result.snapshot
      previousResult = result
    }
  }
  // Three independent conversations at a time; turns within a conversation stay ordered.
  const selected = scenarios.filter(
    (scenario) => !process.argv[3] || scenario.name.includes(process.argv[3])
  )
  for (let offset = 0; offset < selected.length; offset += 3) {
    const batch = await Promise.allSettled(
      selected.slice(offset, offset + 3).map(runScenario)
    )
    for (const outcome of batch)
      if (outcome.status === "rejected") throw outcome.reason
  }
} finally {
  await server.close()
  const path = process.argv[2] ?? "/tmp/gambit-chat-flows.json"
  await writeFile(
    path,
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2)
  )
  console.log(
    `Report: ${path}; ${results.filter((result) => result.passed).length}/${results.length} checks passed`
  )
  if (results.some((result) => !result.passed)) process.exitCode = 1
}
