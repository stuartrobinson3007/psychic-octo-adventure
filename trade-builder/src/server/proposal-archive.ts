import { z } from "zod"
import { MAX_TRADE_TEAMS } from "../lib/trade/types.ts"
import type { TradeProposal } from "../lib/trade/types.ts"

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/)
const id = z.number().int().positive()
const amount = z.number().int().nonnegative()
const reference = z.object({ proposalId: identifier, revision: id })
const proposal = z.object({
  proposalId: identifier,
  revision: id,
  kind: z.enum(["trade", "scenario"]).optional(),
  parent: reference.optional(),
  relatedTrade: reference.optional(),
  createdAt: z.iso.datetime().optional(),
  teamIds: z.array(id).min(1).max(MAX_TRADE_TEAMS),
  transfers: z
    .array(
      z.object({
        assetType: z.enum(["player", "pick", "draft_right"]),
        assetId: id,
        fromTeamId: id,
        toTeamId: id,
      })
    )
    .max(30),
  salaryOverrides: z
    .array(
      z.object({
        playerId: id,
        salary: amount,
        yearsRemaining: z.number().int().min(0).max(15),
        isStretchAndWaive: z.boolean().optional(),
      })
    )
    .max(30)
    .optional(),
  signings: z
    .array(
      z.object({
        playerId: id,
        signingTeamId: id,
        salary: amount.positive(),
        contractYears: z.number().int().min(1).max(5),
        contractType: z.string().min(1).max(100),
        tierId: z.string().min(1).max(100).optional(),
        fundingLabel: z.string().min(1).max(100).optional(),
        firstYearGuaranteed: z.boolean().optional(),
      })
    )
    .max(30)
    .optional(),
  exceptions: z
    .array(
      z.object({
        teamId: id,
        exceptionId: id,
        sourcePlayerName: z.string().max(200).optional(),
      })
    )
    .max(MAX_TRADE_TEAMS)
    .optional(),
})

/** Preserve every proposed setting; caller-supplied verdicts are never imported. */
export function parseArchivedProposal(value: unknown): TradeProposal {
  const parsed = proposal.parse(value)
  return { ...parsed, createdAt: parsed.createdAt ?? new Date().toISOString() }
}

const work = z.object({
  workDurationMs: z.number().int().min(0).max(86_400_000).optional(),
  toolCalls: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        label: z.string().max(500),
        activeLabel: z.string().max(500).optional(),
        state: z.enum(["running", "complete", "error"]),
        visible: z.boolean().optional(),
        details: z.array(z.string().max(1000)).max(30).optional(),
      })
    )
    .max(100)
    .optional(),
})

export function parseArchivedWork(value: unknown) {
  return work.parse(value)
}
