import type { SelectionLimits } from "../selection-limits.ts"
import type { MessagePickReference } from "../message-pick-references.ts"
import type { MessagePlayerReference } from "../message-player-references.ts"

export interface Team {
  id: number
  name: string
  abbreviation: string
  city?: string
  color?: string
  logoUrl?: string
  conference?: string
  division?: string
  wins?: number
  losses?: number
  totalSalary?: number
  capSpace?: number
  isOverCap?: boolean
  isOverLuxuryTax?: boolean
  isOverFirstApron?: boolean
  isOverSecondApron?: boolean
}

export interface ContractYear {
  season: string
  amount: number
  isEstimate: boolean
}

export interface Player {
  id: number
  name: string
  teamId: number
  position?: string
  age?: number
  yearsExperience?: number
  salary: number
  yearsRemaining?: number
  contractYears?: number
  contractType?: string
  birdRightsType?: string
  noTradeClause?: boolean
  playerOption?: boolean
  teamOption?: boolean
  signingStatus?: string
  contract?: Array<ContractYear>
  height?: string
}

export interface SalaryCap {
  season: string
  salaryCap: number
  luxuryTaxLine: number
  firstApron: number
  secondApron: number
}

export interface DraftPick {
  id: number
  originalTeamId: number
  currentTeamId: number
  year: number
  round: 1 | 2
  isProtected: boolean
  protectionDetails: string | null
  isSwap: boolean
  isTradable: boolean
}

export interface Catalogue {
  teams: Array<Team>
  players: Array<Player>
  draftPicks?: Array<DraftPick>
  draftRights?: Array<DraftRight>
  tradeExceptions?: Array<TradeException>
  cap: SalaryCap
  fetchedAt: string
  source: "bball-gm"
  synthetic: true
}

export const MAX_TRADE_TEAMS = 4

export interface PlayerTransfer {
  assetType: "player"
  assetId: number
  fromTeamId: number
  toTeamId: number
}

export interface PickTransfer {
  assetType: "pick"
  assetId: number
  fromTeamId: number
  toTeamId: number
}
export interface DraftRight {
  id: number
  playerName: string
  currentTeamId: number
  draftYear: number
  overseasTeam?: string
}

export interface TradeException {
  id: number
  teamId: number
  playerName?: string
  amount: number
  expiresAt: string
}

export interface SalaryOverride {
  playerId: number
  salary: number
  yearsRemaining: number
  isStretchAndWaive?: boolean
}

export interface ScenarioSigning {
  /** Proposed contract terms, retained independently of the service’s type label. */
  tierId?: string
  fundingLabel?: string
  firstYearGuaranteed?: boolean
  playerId: number
  signingTeamId: number
  salary: number
  contractYears: number
  contractType: string
}

export interface DraftRightTransfer {
  assetType: "draft_right"
  assetId: number
  fromTeamId: number
  toTeamId: number
}
export type AssetTransfer = PlayerTransfer | PickTransfer | DraftRightTransfer

export interface TradeProposal {
  kind?: "trade" | "scenario"
  parent?: TradeReference
  /** Association only: the signing is checked separately from this trade. */
  relatedTrade?: TradeReference
  proposalId: string
  revision: number
  teamIds: Array<number>
  transfers: Array<AssetTransfer>
  salaryOverrides?: Array<SalaryOverride>
  signings?: Array<ScenarioSigning>
  exceptions?: Array<{
    teamId: number
    exceptionId: number
    sourcePlayerName?: string
  }>
  createdAt: string
}

export type VerdictStatus =
  | "valid"
  | "invalid_trade"
  | "invalid_proposal"
  | "validation_unavailable"
  | "validation_incomplete"

export interface TeamVerdict {
  teamId: number
  teamName: string
  salaryOut: number
  salaryIn: number
  netSalaryChange: number
  newTotalSalary: number
  newCapStatus: string
  isValid: boolean
  violations: Array<string>
  allowances: Array<string>
}

export interface TradeVerdict {
  rejectionEvidence?: "pick_rules" | "signing_rules"
  limitations?: Array<string>
  status: VerdictStatus
  proposalId: string
  revision: number
  summary: string
  teams: Array<TeamVerdict>
  appliedRules: Array<string>
  issues: Array<string>
  evaluatedAt: string
  dataFetchedAt: string
  season: string
  source: "bball-gm"
}

export interface TradeSnapshot {
  proposal: TradeProposal
  verdict: TradeVerdict | null
}

export interface TradeReference {
  proposalId: string
  revision: number
}

export interface ConversationMessage {
  /** A picker action, distinct from a typed cancellation message. */
  cancelQuestionId?: string
  resolvedPlayerMentions?: Array<{ query: string; playerIds: Array<number> }>
  createdAt?: string
  workDurationMs?: number
  toolCalls?: Array<ToolActivity>
  /** Legacy single-choice receipt; new replies use selections. */
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
  id: string
  role: "user" | "assistant"
  text: string
  selectedPlayerIds?: Array<number>
  selectedPickIds?: Array<number>
  pickReferences?: Array<MessagePickReference>
  playerReferences?: Array<MessagePlayerReference>
  snapshots?: Array<TradeSnapshot>
  candidates?: Array<TradeSnapshot>
  clarification?: TradeClarification
  tone?: "warning" | "destructive"
}

export interface ToolActivity {
  retryKey?: string
  details?: Array<string>
  visible?: boolean
  id: string
  label: string
  activeLabel?: string
  state: "running" | "complete" | "error"
}

export interface ConversationView {
  version: number
  snapshot: TradeSnapshot | null
  messages: Array<ConversationMessage>
  pendingClarification: TradeClarification | null
}

export interface ChatTurnInput {
  sessionId: string
  requestId: string
  message: string
  selectedPlayerIds?: Array<number>
  selectedPickIds?: Array<number>
  pickReferences?: Array<MessagePickReference>
  playerReferences?: Array<MessagePlayerReference>
  clarificationAnswer?: ClarificationAnswer
  cancelQuestionId?: string
  expectedRevision?: number
  expectedConversationVersion?: number
  reference?: TradeReference
}

export interface ChatTurnResult {
  workDurationMs?: number
  toolCalls?: Array<ToolActivity>
  status:
    | "complete"
    | "needs_clarification"
    | "agent_unavailable"
    | "error"
    | "conflict"
  message: string
  snapshot: TradeSnapshot | null
  changes: Array<string>
  snapshots: Array<TradeSnapshot>
  candidates?: Array<TradeSnapshot>
  clarification?: TradeClarification
  conversationVersion?: number
  pendingClarification?: TradeClarification | null
}

export interface TradeIdea {
  reference: string
  proposal: TradeProposal
  perspectiveTeamId: number
}

export interface TradeIdeaPage {
  status?: "expired"
  expiresAt?: string
  total?: number | null
  options: ClarificationOption[]
  nextCursor: number | null
}

export interface ClarificationOption {
  tradeIdea?: TradeIdea
  teamId?: number
  searchText?: string
  destination?: { playerId: number; toTeamId: number }
  action?: "find_trade_options"
  id: string
  label: string
  detail?: string
  value: string
  playerId?: number
}

export type ClarificationAnswer = { questionId?: string; text: string } & (
  | { optionIds: Array<string>; optionId?: never }
  | { optionId: string; optionIds?: never }
)

export interface TradeClarification {
  tradeSearch?: {
    query?: string
    expiresAt?: string
    reference: string
    nextCursor: number | null
    total?: number | null
  }
  selectionLimits?: SelectionLimits
  optionSearch?: { label: string; placeholder: string }
  identityQuery?: string
  id?: string
  slot?:
    | {
        operationIndex: number
        field: "targetQuery" | "replacementQuery" | "destinationQuery"
      }
    | { transferIndex: number; field: "query" | "toTeamQuery" }
    | { discoveryField: "outgoingQueries" | "excludedQueries"; index: number }
    | { rightIndex: number; field: "query" | "toTeamQuery" }
  purpose?:
    | "trade_selection"
    | "trade_preferences"
    | "player_identity"
    | "player_destination"
    | "search_filters"
    | "contract_terms"
    | "team_selection"
    | "trade_reference"
    | "other"
  question: string
  options: Array<ClarificationOption>
}

export interface CheckTradeInput {
  sessionId: string
  requestId: string
  expectedConversationVersion: number
  reference: TradeReference
}

export interface CatalogueResult {
  status: "available" | "unavailable"
  catalogue: Catalogue | null
  message?: string
}
