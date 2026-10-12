import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatPanel } from "@/components/workspace/chat-panel"
import type { ConversationEntry } from "@/components/workspace/use-trade-workspace"
import type {
  ComposerDraft,
  ComposerHandle,
} from "@/components/workspace/composer/trade-composer"
import { ResearchContext } from "@/components/workspace/research-context"
import catalogueData from "@/lib/ux-review/catalogue.json"
import type { Catalogue, ClarificationOption } from "@/lib/trade/types"
import { playerClarificationOptions } from "@/lib/trade-clarification"
import { toolActivity } from "@/lib/tool-activity"

const catalogue = catalogueData as Catalogue
const player =
  catalogue.players.find((p) => p.name === "Yanic Konan Niederhauser") ??
  catalogue.players.find((p) => p.name === "Nick Richards")!
const white = catalogue.players.find((p) => p.name === "Derrick White")!
const wiggins = catalogue.players.find((p) => p.name === "Andrew Wiggins")!
const walsh = catalogue.players.find((p) => p.name === "Jordan Walsh")!
const tradeOptions: Array<ClarificationOption> = [
  "Dalen Terry",
  "Kasparas Jakucionis",
  "Jaylon Tyson",
].map((name) => {
  const incoming = catalogue.players.find((p) => p.name === name)!
  const label = `${walsh.name} for ${incoming.name}`
  return {
    id: `trade-${incoming.id}`,
    label,
    value: label,
    tradeIdea: {
      reference: `proposal:preview-${incoming.id}@1`,
      perspectiveTeamId: walsh.teamId,
      proposal: {
        proposalId: `preview-${incoming.id}`,
        revision: 1,
        createdAt: "2026-10-10T00:00:00.000Z",
        teamIds: [walsh.teamId, incoming.teamId],
        transfers: [
          {
            assetType: "player",
            assetId: walsh.id,
            fromTeamId: walsh.teamId,
            toTeamId: incoming.teamId,
          },
          {
            assetType: "player",
            assetId: incoming.id,
            fromTeamId: incoming.teamId,
            toTeamId: walsh.teamId,
          },
        ],
      },
    },
  }
})
const nextQuestion = {
  question: "Which Andrew do you want to trade for?",
  options: playerClarificationOptions(
    catalogue.players
      .filter((p) => ["Andrew Nembhard", "Andrew Wiggins"].includes(p.name))
      .map((p) => p.id),
    catalogue
  ),
}
const replySteps = [
  { name: "search_players", input: { query: "Andrew" } },
  { name: "ask_question", input: {} },
]
const fixtures: Array<{
  id: string
  label: string
  option: ClarificationOption
}> = [
  { id: "trade", label: "Trades", option: tradeOptions[0] },
  {
    id: "player",
    label: "Player",
    option: playerClarificationOptions([player.id], catalogue)[0],
  },
  {
    id: "team",
    label: "Team",
    option: {
      id: "team-16",
      label: "Miami Heat",
      detail: "Eastern Conference",
      value: "Miami Heat",
    },
  },
  {
    id: "package",
    label: "Package",
    option: {
      id: "package",
      label: "Keep both players",
      detail: `${white.name} and ${wiggins.name}`,
      value: "Keep both players",
    },
  },
  {
    id: "answer",
    label: "Answer",
    option: { id: "answer-0", label: "Yes", value: "Yes" },
  },
  {
    id: "long-answer",
    label: "Long answer",
    option: {
      id: "answer-long",
      label:
        "Keep the original players and find an option that lowers Boston's payroll without adding another team",
      value: "Keep the original players and lower Boston's payroll",
    },
  },
]

/** Local UI fixture; uses the real chat, choice widgets and composer without model calls. */
export function SelectionRepliesPreview() {
  const composerRef = useRef<ComposerHandle | null>(null)
  const [fixtureId, setFixtureId] = useState("player")
  const [extra, setExtra] = useState(true)
  const [typed, setTyped] = useState<ConversationEntry[]>([])
  const [replayStep, setReplayStep] = useState(replySteps.length)
  const replaying = replayStep < replySteps.length
  useEffect(() => {
    if (!replaying) return
    const timer = window.setTimeout(
      () => setReplayStep((step) => step + 1),
      900
    )
    return () => window.clearTimeout(timer)
  }, [replayStep, replaying])
  const calls = replySteps
    .slice(0, Math.min(replayStep + 1, replySteps.length))
    .map((step, index) =>
      toolActivity(
        `preview-${index}`,
        step.name,
        step.input,
        index < replayStep ? "complete" : "running",
        catalogue
      )
    )
  const fixture = fixtures.find((f) => f.id === fixtureId)!
  const custom = extra ? "Also, I'm sending this message as a test." : ""
  const choices = fixtureId === "trade" ? tradeOptions : [fixture.option]
  const entries: Array<ConversationEntry> = [
    { id: "original", role: "user", text: "Trade Nick for Andrew." },
    {
      id: "question",
      role: "assistant",
      text: "Which option do you mean?",
      clarification: {
        question: "Which option do you mean?",
        options: choices,
      },
    },
    {
      id: "selection",
      role: "user",
      text:
        choices.map((choice) => choice.value).join(", ") +
        (custom ? `\n\n${custom}` : ""),
      selections: choices,
    },
    ...(!replaying
      ? [
          {
            id: "andrew-question",
            role: "assistant" as const,
            text: nextQuestion.question,
            clarification: nextQuestion,
            toolCalls: calls,
            workDurationMs: replySteps.length * 900,
          },
        ]
      : []),
    ...typed,
  ]
  const submit = (draft: ComposerDraft) => {
    composerRef.current?.clear()
    const requestId = crypto.randomUUID()
    setTyped((previous) => [
      ...previous,
      {
        id: `${requestId}-user`,
        role: "user",
        text: draft.text,
        cancelQuestionId: draft.cancelQuestionId,
        selection: draft.selection,
        selections: draft.selections,
        playerReferences: draft.playerReferences,
      },
      ...(draft.cancelQuestionId
        ? [
            {
              id: `${requestId}-assistant`,
              role: "assistant" as const,
              text: "Cancelled.",
            },
          ]
        : []),
    ])
  }
  return (
    <ResearchContext value={catalogue}>
      <TooltipProvider>
        <div className="gambit-app isolate flex h-dvh flex-col text-sm leading-data text-foreground antialiased selection:bg-primary/18 max-md:text-base">
          <header className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
            {fixtures.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={fixtureId === f.id ? "secondary" : "ghost"}
                aria-pressed={fixtureId === f.id}
                onClick={() => {
                  setFixtureId(f.id)
                  setTyped([])
                }}
              >
                {f.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              aria-pressed={extra}
              onClick={() => setExtra(!extra)}
            >
              Additional message
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={replaying}
              onClick={() => {
                setTyped([])
                setReplayStep(0)
              }}
            >
              Replay reply
            </Button>
          </header>
          <main className="workspace-content relative flex min-h-0 w-full flex-1 justify-start overflow-clip">
            <div className="chat-frame relative flex min-h-0 min-w-0 shrink-0 flex-col [&>[data-slot=alert]]:shrink-0">
              <ChatPanel
                catalogue={catalogue}
                entries={entries}
                saved={[]}
                expanded={new Set()}
                busy={replaying}
                toolProgress={replaying ? calls : []}
                storageError={false}
                pendingClarification={
                  typed.length || replaying ? null : nextQuestion
                }
                composerRef={composerRef}
                onSubmit={submit}
                onInspectPlayer={() => {}}
                onSave={() => {}}
                onExpand={() => {}}
                onCheck={() => {}}
              />
            </div>
          </main>
        </div>
      </TooltipProvider>
    </ResearchContext>
  )
}
