import type { Catalogue, ToolActivity } from "./trade/types.ts"

const actions: Record<string, [string, string]> = {
  read_records: ["Reviewing earlier work", "Reviewed earlier work"],
  read_team_assets: ["Checking team assets", "Checked team assets"],
  check_options: ["Checking selected trades", "Checked selected trades"],
  check_proposal: ["Checking the proposal", "Checked the proposal"],
  find_options: ["Finding trade options", "Found trade options"],
  browse_options: ["Finding more options", "Found more options"],
  explain_proposals: ["Reviewing the trade rules", "Reviewed the trade rules"],
  reconcile_clarification: ["Reviewing your answer", "Reviewed your answer"],
  recall_conversation: [
    "Reviewing the conversation",
    "Reviewed the conversation",
  ],
  interpret_request: ["Understanding your request", "Understood your request"],
  search_draft_rights: ["Searching draft rights", "Searched draft rights"],
  list_trade_exceptions: [
    "Checking available trade exceptions",
    "Checked available trade exceptions",
  ],
  get_contract_options: [
    "Checking contract options",
    "Checked contract options",
  ],
  sign_free_agent: [
    "Checking a hypothetical signing",
    "Checked a hypothetical signing",
  ],
  edit_contract: [
    "Updating the scenario contract",
    "Updated the scenario contract",
  ],
  set_trade_exception: [
    "Selecting a trade exception",
    "Selected a trade exception",
  ],
  edit_draft_right: ["Updating draft rights", "Updated draft rights"],
  search_picks: ["Searching draft picks", "Searched draft picks"],
  add_pick: ["Adding a pick", "Added a pick"],
  remove_pick: ["Removing a pick", "Removed a pick"],
  reroute_pick: ["Changing a pick destination", "Changed a pick destination"],
  search_players: ["Searching players", "Searched players"],
  search_teams: ["Searching teams", "Searched teams"],
  set_teams: ["Setting up the trade", "Set up the trade"],
  add_player: ["Adding a player", "Added a player"],
  reroute_player: ["Changing a destination", "Changed a destination"],
  remove_player: ["Removing a player", "Removed a player"],
  replace_player: ["Replacing a player", "Replaced a player"],
  undo_trade_change: [
    "Restoring the previous trade",
    "Restored the previous trade",
  ],
  clear_trade: ["Clearing the trade", "Cleared the trade"],
  cancel_pending_edit: ["Cancelling the change", "Cancelled the change"],
  request_verdict: ["Checking the trade", "Checked the trade"],
  explain_verdict: ["Reviewing the trade rules", "Reviewed the trade rules"],
  discover_trades: ["Finding trade options", "Found trade options"],
  find_player_alternatives: [
    "Finding player alternatives",
    "Found player alternatives",
  ],
  repair_trade: ["Finding trade adjustments", "Found trade adjustments"],
  ask_clarification: ["Preparing a question", "Prepared a question"],
  finish_response: ["Preparing your reply", "Prepared your reply"],
}

// Show work that supplies evidence or alternatives; omit routine conversation
// handling and draft assembly already evident in the reply or trade card.
const visibleActions = new Set([
  "read_team_assets",
  "check_proposal",
  "check_options",
  "find_options",
  "browse_options",
  "search_draft_rights",
  "list_trade_exceptions",
  "get_contract_options",
  "sign_free_agent",
  "search_picks",
  "search_players",
  "search_teams",
  "request_verdict",
  "discover_trades",
  "repair_trade",
  "find_player_alternatives",
])
const visibleLabels = [
  ...Object.entries(actions)
    .filter(([name]) => visibleActions.has(name))
    .flatMap(([, labels]) => labels),
  "Searching for ",
  "Searched for ",
]

/** Older recordings have no visibility metadata; their known labels still filter. */
export function visibleToolActivities(
  calls: Array<ToolActivity> = []
): Array<ToolActivity> {
  return calls.filter(
    (call) =>
      call.visible ??
      visibleLabels.some((label) => call.label.startsWith(label))
  )
}

/** Summarize recovered retries in completed history; retain the original calls. */
export function completedToolActivities(
  calls: Array<ToolActivity> = []
): Array<ToolActivity> {
  const visible = visibleToolActivities(calls)
  const succeeded = new Set<string>()
  const legacySuccesses = new Set<string>()
  return [...visible]
    .reverse()
    .filter((call) => {
      if (call.state === "complete") {
        if (call.retryKey) succeeded.add(call.retryKey)
        else legacySuccesses.add(call.label)
        return true
      }
      if (call.state !== "error") return true
      if (call.retryKey) return !succeeded.has(call.retryKey)
      // Older recordings only identify the work stage through its label.
      const [active, complete] = actions.sign_free_agent
      return (
        call.label !== `${active} — couldn’t finish` ||
        !legacySuccesses.has(complete)
      )
    })
    .reverse()
}

export function workDurationLabel(durationMs?: number): string {
  if (
    durationMs === undefined ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  )
    return "Work details"
  const seconds = Math.round(durationMs / 1000)
  if (!seconds) return "Worked for <1s"
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `Worked for ${minutes ? `${minutes}m${remainder ? ` ${remainder}s` : ""}` : `${seconds}s`}`
}

/** Presentation only: never expose tool identifiers, argument JSON or outputs. */
export function toolActivity(
  id: string,
  name: string,
  input: unknown,
  state: ToolActivity["state"],
  catalogue: Catalogue,
  output?: unknown
): ToolActivity {
  const words = actions[name] ?? [
    "Working on your request",
    "Worked on your request",
  ]
  let activeLabel = words[0]
  let label = words[state === "complete" ? 1 : 0]
  const args =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  if (name === "search_players" || name === "search_teams") {
    const query =
      typeof args.query === "string"
        ? args.query
        : Array.isArray(args.identities) && args.identities.length === 1
          ? args.identities[0]?.query
          : undefined
    if (typeof query === "string" && query.trim()) {
      activeLabel = `Searching for ${query.trim().slice(0, 80)}`
      label = `${state === "complete" ? "Searched" : "Searching"} for ${query.trim().slice(0, 80)}`
    }
  }
  if (["add_player", "remove_player"].includes(name)) {
    const player = catalogue.players.find((p) => p.id === args.playerId)
    if (player) {
      activeLabel = `${words[0].replace(" a player", "")} ${player.name}`
      label = `${words[state === "complete" ? 1 : 0].replace(" a player", "")} ${player.name}`
    }
  }
  return {
    id,
    ...(name === "sign_free_agent" &&
    typeof args.playerId === "number" &&
    typeof args.teamId === "number" &&
    typeof args.action === "string"
      ? { retryKey: `signing:${args.action}:${args.playerId}:${args.teamId}` }
      : {}),
    ...([
      "find_options",
      "browse_options",
      "discover_trades",
      "repair_trade",
      "find_player_alternatives",
    ].includes(name) &&
    state === "complete" &&
    output &&
    typeof output === "object" &&
    "details" in output &&
    Array.isArray(output.details) &&
    output.details.every((detail) => typeof detail === "string")
      ? { details: output.details }
      : {}),
    visible: visibleActions.has(name),
    activeLabel: `${activeLabel}…`,
    label:
      state === "running"
        ? `${label}…`
        : state === "error"
          ? `${label} — couldn’t finish`
          : label,
    state,
  }
}

/** Keep the latest work stage visible between quick SDK tool executions. */
export function currentToolActivity(
  calls: Array<ToolActivity>
): ToolActivity | undefined {
  const visible = visibleToolActivities(calls)
  const running = visible.find((call) => call.state === "running")
  if (running) return running
  const latest = visible.at(-1)
  return latest?.state === "complete" && latest.activeLabel ? latest : undefined
}
