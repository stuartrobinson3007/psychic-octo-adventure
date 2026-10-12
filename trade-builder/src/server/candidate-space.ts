import type { TradeProposal } from "../lib/trade/types.ts"

export interface CandidateSpace {
  total: number
  scope: string
  invalid?: string
  /** Browse in a varied order while retaining each proposal's canonical ordinal. */
  browseOrdinal?: (position: number) => number
  at: (ordinal: number) => TradeProposal | null
}
