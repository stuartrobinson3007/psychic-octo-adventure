import { conversationEntries } from "../conversation-entries.ts"
import { clarificationSelections } from "../clarification-selection.ts"
import { workspaceStates } from "./workspace-states.ts"
import {
  cardResponseSummary,
  tradeResponseCopy,
} from "../trade-response-copy.ts"
import { legacyClarification } from "../trade-clarification.ts"
import type { MessagePlayerReference } from "../message-player-references"
import type {
  Catalogue,
  ConversationView,
  ChatTurnResult,
  TradeSnapshot,
  TradeClarification,
  ClarificationOption,
  ToolActivity,
} from "../trade/types"

export interface ReviewTurn {
  backendRevision?: string
  ideaOptions?: ClarificationOption[]
  conversation?: ConversationView
  scenario: string
  scenarioTitle?: string
  scenarioDescription?: string
  scenarioTags?: string[]
  input: string
  recordedAt: string
  selectedPlayerIds?: number[]
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
  result: ChatTurnResult
}
export interface ReviewEntry {
  playerReferences?: Array<MessagePlayerReference>
  sourceMessageId?: string
  cancelQuestionId?: string
  createdAt?: string
  toolCalls?: Array<ToolActivity>
  workDurationMs?: number
  id: string
  role: "user" | "assistant"
  text: string
  tone?: "warning" | "destructive"
  snapshot?: TradeSnapshot
  isCandidate?: boolean
  clarification?: TradeClarification
  selectedPlayerIds?: number[]
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
}
export interface ReviewScenario {
  id: string
  title: string
  description: string
  tags: string[]
  source: "recorded" | "fixture"
  turns: ReviewTurn[]
  choiceState?: {
    query?: string
    select?: number
    cancel?: boolean
  }
  fixture?:
    | "workspace"
    | "welcome"
    | "draft"
    | "loading"
    | "edit-loading"
    | "network"
    | "provider"
    | "storage"
    | "selected-player"
    | "selected-team"
    | "selected-package"
    | "selected-answer"
    | "selected-long-answer"
    | "tool-history"
    | "ideas-loading"
    | "ideas-error"
    | "ideas-expired"
    | "ideas-empty"
    | "ideas-filtered"
    | "ideas-selection-filtered"
    | "ideas-selection-full"
    | "ideas-cancelled"
}
export interface ReviewBrief {
  name: string
  title?: string
  description?: string
  tags?: string[]
}
const descriptions: Record<string, [string, string, string[]]> = {
  "trade revisions": [
    "Swap, explain, revise",
    "A valid swap becomes invalid, is explained, restored, then receives an unsupported draft-pick request.",
    ["Trade", "Revisions", "Unsupported"],
  ],
  "ambiguous name clarification": [
    "Which Williams?",
    "Resolve an ambiguous surname, then replace the chosen player with a different Williams.",
    ["Clarification", "Invalid trade"],
  ],
  "incomplete request clarification": [
    "Find options for an outgoing player",
    "Name an outgoing player and browse trade ideas immediately, then choose which ideas to check.",
    ["Discovery", "Fixed players"],
  ],
  "research and unsupported requests": [
    "Research and scope limits",
    "Compare players, ask about contracts, try an unsigned player, clarify three-team routing, correct an unknown name and submit a stale selected ID.",
    ["Research", "Clarification", "Error"],
  ],
  "badge and conversational references": [
    "Selected players, remove, undo",
    "The first request supplies White and Wiggins as selected player IDs; remove by surname and undo. This trace records backend text, without composer badge offsets.",
    ["Selected players", "Undo"],
  ],
  "cancellation reset and preservation": [
    "Cancel an edit, then explore another trade",
    "Cancel a pending edit without losing the checked trade, then start a different trade directly. Earlier cards remain available and follow-up questions refer to the new trade.",
    ["Clarification", "History", "Research"],
  ],
  "ambiguous edit references": [
    "Remove him — who?",
    "An ambiguous pronoun is clarified; undo restores the swap, and adding the same player again leaves it unchanged.",
    ["Clarification", "Undo", "No-op"],
  ],
  "one way and unsupported hypotheticals": [
    "One-way trade, contract change and signing",
    "No player comes back. Follow with a salary override and a sign-and-trade request.",
    ["One-way trade", "Contracts", "Sign and trade"],
  ],
  "replacement with badges": [
    "Replace across three teams",
    "Replace Grant with Patrick, then Andrew, progressing from invalid to valid. Recorded backend requests include selected IDs; visible text references use the production renderer.",
    ["Selected players", "Revisions"],
  ],
  "trade discovery": [
    "Find alternatives",
    "Start with a checked swap, browse alternatives and tighten the incoming age limit. Choose which ideas to check.",
    ["Discovery", "Multiple cards", "Age filters"],
  ],
}

export function reviewScenarios(
  turns: ReviewTurn[],
  briefs: ReviewBrief[] = []
): ReviewScenario[] {
  const briefByName = new Map(briefs.map((brief) => [brief.name, brief]))
  const groups = new Map<string, ReviewTurn[]>()
  for (const turn of turns)
    groups.set(turn.scenario, [...(groups.get(turn.scenario) ?? []), turn])
  const recorded = [...groups.keys()].map((name) => {
    const items = groups.get(name)!
    const [title, description, tags] = descriptions[name] ?? [
      name,
      "A recorded conversation. Each checkpoint shows its actual request and response.",
      ["Conversation"],
    ]
    const brief = briefByName.get(name)
    return {
      id: name.replaceAll(" ", "-"),
      title: brief?.title ?? items[0].scenarioTitle ?? title,
      description:
        brief?.description ?? items[0].scenarioDescription ?? description,
      tags: brief?.tags ?? items[0].scenarioTags ?? tags,
      source: "recorded" as const,
      turns: items,
    }
  })
  // Fixture provenance must not depend on import order or which scenario was
  // refreshed most recently. These conversations provide stable real examples.
  const valid = groups
    .get("conversation history and focus")
    ?.find((turn) =>
      turn.result.snapshots.some(
        (snapshot) => snapshot.verdict?.status === "valid"
      )
    )
  const ideas = groups
    .get("Incoming guard selection and five checks")
    ?.find(
      (turn) => turn.result.pendingClarification?.purpose === "trade_selection"
    )
  const fixtures: ReviewScenario[] = [
    ...workspaceStates.map((state) => ({
      id: state.id,
      title: state.title,
      description: state.description,
      fixture: "workspace",
      choiceState: state.choiceState,
      tags: [
        "Workspace",
        "Interactive",
        "panel" in state ? state.panel : "Composer",
      ],
    })),
    {
      id: "welcome",
      title: "A fresh chat",
      description: "The actual empty conversation and starter prompt.",
      fixture: "welcome",
      tags: ["Empty state"],
    },
    {
      id: "long-draft",
      title: "A long composed request",
      description:
        "An authored draft stresses wrapping and composer height. It has not been submitted to the backend.",
      fixture: "draft",
      tags: ["Composer", "Long text"],
    },
    {
      id: "ideas-loading",
      title: "Loading trade ideas",
      description:
        "Hold a browse request pending. The options keep their opening height, fade beneath a centered spinner, and remain cancellable.",
      fixture: "ideas-loading",
      tags: ["Loading", "Selection", "Search"],
    },
    {
      id: "ideas-error",
      title: "Trade ideas cannot load",
      description:
        "Reject a browse request. Keep the list's height and existing choices, with a visible retry action and an available Cancel button.",
      fixture: "ideas-error",
      tags: ["Error", "Selection", "Recovery"],
    },
    {
      id: "ideas-expired",
      title: "Trade search has expired",
      description:
        "Retain the displayed options and recover an expired search from its footer. Refresh clears stale selections and starts paging again.",
      fixture: "ideas-expired",
      tags: ["Expiry", "Selection", "Recovery"],
    },
    {
      id: "ideas-empty",
      title: "No trade ideas match the search",
      description:
        "Filter the actual opening list to no results. Keep its height, hide the scrollbar and count, and offer Clear search.",
      fixture: "ideas-empty",
      choiceState: { query: "No such player or team" },
      tags: ["Empty state", "Selection", "Search"],
    },
    {
      id: "ideas-filtered",
      title: "One matching trade idea",
      description:
        "Filter the opening list to its first package. The list keeps its height and shows no scrollbar when the result fits.",
      fixture: "ideas-filtered",
      choiceState: {
        query: ideas?.result.pendingClarification?.options[0]?.label,
      },
      tags: ["Selection", "Search"],
    },
    {
      id: "ideas-selection-filtered",
      title: "A selected trade hidden by filtering",
      description:
        "Select the first idea, then search for a different package. The selection and header count survive filtering; Clear search reveals the selected idea again.",
      fixture: "ideas-selection-filtered",
      choiceState: {
        select: 1,
        query: ideas?.result.pendingClarification?.options[1]?.label,
      },
      tags: ["Selection", "Search", "Persistence"],
    },
    {
      id: "ideas-selection-full",
      title: "Five trade ideas selected",
      description:
        "Choose the first five actual ideas. The counter reaches 5/5; remaining choices are disabled and selected choices can be removed.",
      fixture: "ideas-selection-full",
      choiceState: { select: 5 },
      tags: ["Selection", "Limits"],
    },
    {
      id: "ideas-cancelled",
      title: "Trade idea selection cancelled",
      description:
        "Use the actual Cancel control. The options disappear, a ‘No options selected’ receipt records the cancellation, and the search introduction remains in the conversation.",
      fixture: "ideas-cancelled",
      choiceState: { cancel: true },
      tags: ["Selection", "Cancellation", "Conversation"],
    },
    {
      id: "first-loading",
      title: "Waiting for the first result",
      description:
        "Hold the actual busy state after the first user message. Timing is a fixture.",
      fixture: "loading",
      tags: ["Loading"],
    },
    {
      id: "edit-loading",
      title: "Waiting on an edit",
      description:
        "A previously checked card remains visible while a follow-up is being processed. Timing is a fixture.",
      fixture: "edit-loading",
      tags: ["Loading", "Revisions"],
    },
    {
      id: "network-failure",
      title: "A request fails",
      description:
        "Inject the current UI's network-error copy after a checked trade. No live outage was induced.",
      fixture: "network",
      tags: ["Error", "Recovery"],
    },
    {
      id: "provider-unavailable",
      title: "The assistant is unavailable",
      description:
        "An authored agent_unavailable response preserves the last result and uses the production warning treatment.",
      fixture: "provider",
      tags: ["Error", "Recovery"],
    },
    {
      id: "history-failure",
      title: "History cannot be saved",
      description:
        "Hold the actual storage warning below the composer without changing browser storage permissions.",
      fixture: "storage",
      tags: ["Error", "Storage"],
    },
    {
      id: "tool-history",
      title: "Inspect the steps behind a reply",
      description:
        "An authored completed-step history expanded using the actual product control. These steps are a UI fixture, not a recorded backend trace.",
      fixture: "tool-history",
      tags: ["Tool activity", "History"],
    },
    ...[
      ["selected-player", "A player choice with extra text"],
      ["selected-team", "A team choice with extra text"],
      ["selected-package", "A package choice with extra text"],
      ["selected-answer", "A short answer choice"],
      ["selected-long-answer", "A long answer choice"],
    ].map(([fixture, title]) => ({
      id: fixture,
      fixture,
      title,
      description:
        "An authored selected-reply checkpoint using the actual choice chip and transcript renderer. No backend response is invented.",
      tags: ["Selected reply", "Composer"],
    })),
  ].map((item) => ({
    ...item,
    source: "fixture",
    turns: item.fixture.startsWith("ideas-")
      ? ideas
        ? [ideas]
        : []
      : item.fixture === "welcome" || item.fixture === "draft" || !valid
        ? []
        : item.id === "workspace-saved"
          ? (groups.get("trade revisions") ?? [valid]).slice(0, 3)
          : [valid],
  })) as ReviewScenario[]
  return [...recorded, ...fixtures]
}

/** Mirror the workspace's result presentation; a preserved snapshot is not a new card. */
export function reviewEntries(
  turns: ReviewTurn[],
  catalogue?: Catalogue
): ReviewEntry[] {
  const view = turns.at(-1)?.conversation
  if (view) return conversationEntries(view.messages)
  const entries: ReviewEntry[] = []
  turns.forEach((turn, index) => {
    const id = `turn-${index}`
    const sourceMessageId = `${id}-assistant`
    entries.push({
      id: `${id}-user`,
      role: "user",
      createdAt: turn.recordedAt,
      text: turn.input,
      selectedPlayerIds: turn.selectedPlayerIds,
      selection: turn.selection,
      selections: turn.selections,
    })
    const result = {
      ...turn.result,
      message:
        tradeResponseCopy(turn.result.message).trim() ||
        cardResponseSummary([
          ...turn.result.snapshots,
          ...(turn.result.candidates ?? []),
        ]),
    }
    if (result.candidates !== undefined) {
      entries.push({
        id: `${id}-text`,
        sourceMessageId,
        role: "assistant",
        createdAt: turn.recordedAt,
        text: result.message,
        toolCalls: result.toolCalls,
        workDurationMs: result.workDurationMs,
        clarification: result.clarification,
      })
      result.snapshots.forEach((snapshot, revision) =>
        entries.push({
          id: `${id}-trade-${revision}`,
          sourceMessageId,
          role: "assistant",
          createdAt: turn.recordedAt,
          text: "",
          snapshot,
        })
      )
      result.candidates.forEach((snapshot, candidate) =>
        entries.push({
          id: `${id}-candidate-${candidate}`,
          sourceMessageId,
          role: "assistant",
          createdAt: turn.recordedAt,
          text: "",
          snapshot,
          isCandidate: true,
        })
      )
    } else if (result.snapshots.length) {
      result.snapshots.forEach((snapshot, revision) =>
        entries.push({
          id: `${id}-trade-${revision}`,
          sourceMessageId,
          role: "assistant",
          createdAt: turn.recordedAt,
          text: revision === 0 ? result.message : "",
          toolCalls: revision === 0 ? result.toolCalls : undefined,
          workDurationMs: revision === 0 ? result.workDurationMs : undefined,
          snapshot,
        })
      )
    } else {
      entries.push({
        id: `${id}-text`,
        sourceMessageId,
        role: "assistant",
        createdAt: turn.recordedAt,
        text: result.message,
        toolCalls: result.toolCalls,
        workDurationMs: result.workDurationMs,
        tone:
          result.status === "error"
            ? "destructive"
            : result.status === "agent_unavailable" ||
                result.status === "conflict"
              ? "warning"
              : undefined,
        ...(result.status === "needs_clarification"
          ? {
              clarification:
                result.clarification ??
                (catalogue
                  ? legacyClarification(
                      result.message,
                      turn.input,
                      catalogue,
                      result.snapshot
                    )
                  : { question: result.message, options: [] }),
            }
          : {}),
      })
    }
  })
  return entries
}

export function checkpointCount(scenario: ReviewScenario) {
  return Math.max(1, scenario.turns.length)
}

export type ReviewPhase = "input" | "response"

/** Keep turn numbers stable while showing the action before each response. */
export function reviewCheckpoints(scenario: ReviewScenario) {
  const phases: ReviewPhase[] =
    scenario.source === "recorded" ? ["input", "response"] : ["response"]
  return Array.from({ length: checkpointCount(scenario) }, (_, step) =>
    phases.map((phase) => ({ step, phase }))
  ).flat()
}

/** Use recorded selection metadata, never infer a click from the reply's text. */
export function reviewInput(turn: ReviewTurn) {
  const message = [...(turn.conversation?.messages ?? [])]
    .reverse()
    .find((entry) => entry.role === "user")
  const recorded = message?.text === turn.input ? message : undefined
  return {
    text: turn.input,
    selections: clarificationSelections(recorded ?? turn),
    cancelQuestionId: recorded?.cancelQuestionId,
    playerReferences: recorded?.playerReferences,
    pickReferences: recorded?.pickReferences,
  }
}

/** Match applyConversation: focus selects expansion; a null focus leaves it as it was. */
export function reviewExpandedSnapshot(turns: ReviewTurn[]) {
  return (
    [...turns].reverse().find((turn) => turn.result.snapshot)?.result
      .snapshot ?? null
  )
}

// Pigeonfiles ties Seen to frame identity and content, never to approval.
export function reviewKey(
  scenario: ReviewScenario,
  step: number,
  width: string
) {
  const content = JSON.stringify([
    scenario.fixture,
    scenario.turns.slice(0, step + 1),
  ])
  let hash = 2166136261
  for (let i = 0; i < content.length; i++)
    hash = Math.imul(hash ^ content.charCodeAt(i), 16777619)
  return `${scenario.id}:${step}:${width}:${hash >>> 0}`
}
