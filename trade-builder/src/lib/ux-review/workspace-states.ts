export interface WorkspaceState {
  id: string
  title: string
  description: string
  phase?: "loading" | "data-error" | "connection-error"
  panel?: "players" | "picks" | "saved"
  player?: string
  compare?: string[]
  playerState?: {
    query?: string
    position?: string
    salary?: string
    sort?: string
    filters?: boolean
  }
  pickState?: {
    query?: string
    round?: string
    availability?: string
    sort?: string
    moreFilters?: boolean
  }
  pick?: "available" | "protected" | "protection-unknown" | "unavailable"
  selectedPick?: boolean
  refreshing?: boolean
  refreshError?: boolean
  saved?: boolean
  draftPlayers?: string[]
  clarification?: "signing-team" | "unknown-player" | "three-teams"
  choiceState?: { query?: string; select?: number }
}

/** Authored checkpoints of real, interactive workspace components. */
export const workspaceStates: WorkspaceState[] = [
  {
    id: "workspace-team-choice-empty",
    title: "No teams match the search",
    clarification: "signing-team",
    choiceState: { query: "No such team" },
    description:
      "The real team picker filtered to no matches. Keep the opening height, remove the scrollbar and clear the search to recover.",
  },
  {
    id: "workspace-team-choice-filtered",
    title: "One matching team",
    clarification: "signing-team",
    choiceState: { query: "Boston" },
    description:
      "Search the full team catalogue for Boston. The one result uses the opening list's height with no scrollbar.",
  },
  {
    id: "workspace-exact-team-selection-full",
    title: "Three teams selected",
    clarification: "three-teams",
    choiceState: { select: 3 },
    description:
      "Select three teams using the real square checkboxes. The exact-three counter is full; other choices are disabled until a team is removed.",
  },
  {
    id: "workspace-exact-team-selection",
    title: "Choose exactly three teams",
    clarification: "three-teams",
    description:
      "Square checkboxes, filtered selections and an exact-three submission rule. Contrast with the trade picker's up-to-five rule.",
  },
  {
    id: "workspace-team-choice-search",
    title: "Choose a signing team",
    clarification: "signing-team",
    description:
      "All teams in a searchable choice list. Filter by city, name or abbreviation, clear the search and choose a team, or write a different reply.",
  },
  {
    id: "workspace-free-text-question",
    title: "Answer a question without options",
    clarification: "unknown-player",
    description:
      "A question with no choices appears as an assistant message. Its answer is an ordinary text message, with no question attached to the composer.",
  },
  {
    id: "workspace-loading",
    title: "Loading the workspace",
    phase: "loading",
    description:
      "Authored initial loading state using the production loading component.",
  },
  {
    id: "workspace-data-error",
    title: "Trade data cannot load",
    phase: "data-error",
    description:
      "Authored catalogue loading failure with the production retry control.",
  },
  {
    id: "workspace-connection-error",
    title: "Conversation cannot load",
    phase: "connection-error",
    description:
      "Authored conversation connection failure with the production retry notice and existing data retained.",
  },
  {
    id: "workspace-players",
    title: "Browse players",
    panel: "players",
    description:
      "Search, team and salary filters, sorting, pagination and adding a player to the composer.",
  },
  {
    id: "workspace-player-filters",
    title: "Filter and sort players",
    panel: "players",
    playerState: {
      position: "G",
      salary: "20000000",
      sort: "age",
      filters: true,
    },
    description:
      "Combined position and salary filters with age sorting; clear or change the filters.",
  },
  {
    id: "workspace-player-empty",
    title: "No players match",
    panel: "players",
    playerState: { query: "Nobody Imaginary" },
    description: "An empty player search and clearing the query.",
  },
  {
    id: "workspace-player-details",
    title: "Inspect a player",
    panel: "players",
    player: "Derrick White",
    description:
      "Catalogue identity, contract estimates, missing performance data, comparison and adding to the message.",
  },
  {
    id: "workspace-free-agent",
    title: "Inspect a free agent",
    player: "Terry Rozier",
    description:
      "Open an unsigned player's details from a chat reference without assigning a team.",
  },
  {
    id: "workspace-comparison",
    title: "Compare two players",
    panel: "players",
    compare: ["Derrick White", "Andrew Wiggins"],
    description:
      "Compare available catalogue facts; inspect actions, add or remove players, and return to browsing.",
  },
  {
    id: "workspace-comparison-full",
    title: "A four-player comparison",
    panel: "players",
    compare: [
      "Derrick White",
      "Andrew Wiggins",
      "Stephen Curry",
      "Nikola Jokic",
    ],
    description:
      "Maximum comparison size, horizontal overflow, removal and adding another player.",
  },
  {
    id: "workspace-picks",
    title: "Browse draft picks",
    panel: "picks",
    description:
      "Search, current owner, original team, year, round, availability, sorting, pagination and refresh.",
  },
  {
    id: "workspace-pick-filters",
    title: "Combined draft-pick filters",
    panel: "picks",
    pickState: {
      round: "1",
      availability: "available",
      sort: "owner",
      moreFilters: true,
    },
    description:
      "Combined filters and clearing filters without clearing the unsent message.",
  },
  {
    id: "workspace-pick-empty",
    title: "No draft picks match",
    panel: "picks",
    pickState: { query: "2099" },
    description: "No matching picks and clearing the search.",
  },
  {
    id: "workspace-pick-protected",
    title: "A protected pick",
    panel: "picks",
    pick: "protected",
    description:
      "Existing protections and the distinction between current owner and original team.",
  },
  {
    id: "workspace-pick-protection-unknown",
    title: "Protected pick with missing terms",
    panel: "picks",
    pick: "protection-unknown",
    description:
      "Protection terms are unavailable in the catalogue; inspection must state that limitation without inventing terms.",
  },
  {
    id: "workspace-pick-unavailable",
    title: "An unavailable pick",
    panel: "picks",
    pick: "unavailable",
    description:
      "Unavailable ordinary picks remain inspectable; adding them is disabled. Swap rights are excluded.",
  },
  {
    id: "workspace-pick-selected",
    title: "A pick already in the message",
    panel: "picks",
    pick: "available",
    selectedPick: true,
    description:
      "The exact pick badge is in the draft; adding it again is disabled. Remove or undo the badge.",
  },
  {
    id: "workspace-pick-refreshing",
    title: "Refreshing draft picks",
    panel: "picks",
    refreshing: true,
    description:
      "Authored pending refresh state retaining the existing list and draft.",
  },
  {
    id: "workspace-pick-refresh-error",
    title: "Draft-pick refresh fails",
    panel: "picks",
    refreshError: true,
    description:
      "Authored refresh failure with existing data retained and a retry action.",
  },
  {
    id: "workspace-saved-empty",
    title: "No saved trades",
    panel: "saved",
    description:
      "The empty saved-trades panel and returning to the conversation to bookmark a result.",
  },
  {
    id: "workspace-saved",
    title: "Saved trade versions",
    panel: "saved",
    saved: true,
    description:
      "Real recorded trade versions, viewing their cards and removing bookmarks without deleting chat history.",
  },
  {
    id: "workspace-composer-players",
    title: "An unsent player package",
    draftPlayers: ["Derrick White", "Andrew Wiggins"],
    description:
      "Selected player identities in the composer, editing, removal, keyboard undo/redo and the # picker.",
  },
]
