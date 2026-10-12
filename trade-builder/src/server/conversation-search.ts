import { TradeDomainError } from "./trade-errors.ts"
import { browseIdeas, ideaSpace } from "./trade-ideas.ts"
import { retainSearchCatalogue } from "./search-catalogue.ts"
import { z } from "zod"
import {
  lookupRecord,
  proposalKey,
  records,
  searchKey,
  questionKey,
} from "./conversation-records.ts"
import type {
  SearchRecord,
  SearchSpecification,
} from "./conversation-records.ts"
import type { Catalogue } from "../lib/trade/types.ts"
import type { TradeSession } from "./trade-session.ts"

const id = z.number().int().positive()
export const constraintsSchema = z
  .object({
    minAge: z.number().int().min(0).max(100).nullable(),
    maxAge: z.number().int().min(0).max(100).nullable(),
    minExperience: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .describe(
        "Inclusive minimum years of NBA experience for each incoming player. Zero includes rookies."
      ),
    maxExperience: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .describe(
        "Inclusive maximum years of NBA experience for each incoming player."
      ),
    minYearsRemaining: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .describe(
        "Inclusive minimum reported contract years remaining, including the current season. Does not establish guaranteed years."
      ),
    maxYearsRemaining: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .describe(
        "Inclusive maximum reported contract years remaining, including the current season."
      ),
    excludeContractOptions: z
      .boolean()
      .nullable()
      .describe(
        "True excludes contracts with player/team options or unknown option status. For expiring contracts, also set minYearsRemaining=maxYearsRemaining=1."
      ),
    positions: z
      .array(z.enum(["PG", "SG", "SF", "PF", "C"]))
      .min(1)
      .nullable(),
    maxIncomingSalary: z.number().nonnegative().nullable(),
    minSalarySavings: z.number().nonnegative().nullable(),
    maxTeamPayroll: z.number().nonnegative().nullable(),
  })
  .strict()
export const searchSpecificationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("discovery"),
      sourceTeamId: id,
      partnerTeamId: id.nullable(),
      outgoingPlayerIds: z.array(id).max(3),
      outgoingCount: z.number().int().min(1).max(3),
      incomingCount: z.number().int().min(1).max(3),
      excludedPlayerIds: z.array(id),
      constraints: constraintsSchema,
    })
    .strict(),
  z
    .object({
      kind: z.enum(["repair", "replacement"]),
      proposalReference: z.string(),
      targetPlayerId: id.nullable(),
      keepPlayerIds: z.array(id),
      allowReplacements: z.boolean(),
      perspectiveTeamId: id.nullable(),
      constraints: constraintsSchema,
    })
    .strict(),
])
export type SearchInput = z.infer<typeof searchSpecificationSchema>
export const suppliedConstraints = (input: z.infer<typeof constraintsSchema>) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null)
  )

export function specification(
  input: SearchInput,
  session: TradeSession
): SearchSpecification {
  const constraints = suppliedConstraints(input.constraints)
  if (input.kind === "discovery")
    return {
      kind: input.kind,
      request: {
        sourceTeamId: input.sourceTeamId,
        partnerTeamId: input.partnerTeamId ?? undefined,
        outgoingPlayerIds: input.outgoingPlayerIds.length
          ? input.outgoingPlayerIds
          : undefined,
        outgoingCount: input.outgoingCount,
        incomingCount: input.incomingCount,
        excludedPlayerIds: input.excludedPlayerIds,
        constraints,
      },
    }
  const found = lookupRecord(session, input.proposalReference)
  if (found?.type !== "proposal")
    throw new TradeDomainError(
      "Read the specific proposal to search within first."
    )
  const target = found.value.proposal.transfers.find(
    (item) =>
      item.assetType === "player" && item.assetId === input.targetPlayerId
  )
  if (input.kind === "replacement" && !target)
    throw new TradeDomainError(
      "Identify one player in this proposal to find alternatives for."
    )
  if (input.kind === "repair" && input.targetPlayerId !== null)
    throw new TradeDomainError(
      "Use a replacement search to replace a particular player."
    )
  return {
    kind: input.kind,
    proposal: {
      proposalId: found.value.proposal.proposalId,
      revision: found.value.proposal.revision,
    },
    request: {
      replacementPlayerIds:
        input.kind === "replacement" ? [input.targetPlayerId!] : undefined,
      keepPlayerIds: input.keepPlayerIds,
      allowReplacements: input.kind === "repair" && input.allowReplacements,
      sourceTeamId: input.perspectiveTeamId ?? target?.toTeamId,
      constraints: Object.keys(constraints).length ? constraints : undefined,
    },
  }
}

export function executeSearch(options: {
  session: TradeSession
  search: SearchRecord
  catalogue: Catalogue
  signal: AbortSignal
  messageId?: string
  introduction: string
  query?: string
}) {
  const { session, search, catalogue, signal } = options
  // Pin ordering when the search starts. Existing cursors keep their original
  // order so a deployment cannot skip or repeat an already loaded page.
  search.browseOrder ??=
    search.pageCursor === undefined ? "varied" : "canonical"
  search.createdAt ??= new Date().toISOString()
  if (!search.catalogueId)
    retainSearchCatalogue(search, search.catalogue ?? catalogue)
  if (search.specification.kind !== "discovery" && !search.base) {
    const found = lookupRecord(
      session,
      proposalKey(search.specification.proposal)
    )
    if (found?.type !== "proposal")
      throw new TradeDomainError("The proposal for this search is unavailable.")
    search.base = structuredClone(found.value)
  }
  const space = ideaSpace(search)
  if (space.invalid)
    return { status: "invalid_request", message: space.invalid, candidates: [] }
  signal.throwIfAborted()
  const page = browseIdeas(search, search.pageCursor ?? 0, options.query)
  search.pageCursor = page.nextCursor ?? space.total
  const clarification = {
    id: crypto.randomUUID(),
    purpose: "trade_selection" as const,
    question: "Choose up to five trades to check.",
    selectionLimits: { min: 1, max: 5 },
    optionSearch: {
      label: "Search trade ideas",
      placeholder: "Search players or teams…",
    },
    tradeSearch: {
      reference: searchKey(search),
      nextCursor: page.nextCursor,
      total: page.total,
      expiresAt: search.expiresAt,
      query: options.query,
    },
    options: page.options,
  }
  if (page.options.length)
    records(session).batches.push({
      id: crypto.randomUUID(),
      search: searchKey(search),
      messageId: options.messageId ?? search.messageId,
      proposals: page.options.map((option) => ({
        proposalId: option.tradeIdea!.proposal.proposalId,
        revision: option.tradeIdea!.proposal.revision,
      })),
    })
  const question = {
    id: clarification.id,
    clarification,
    originalMessage: search.goal,
    context: `Select trade ideas from ${searchKey(search)}. Validate only selected references.`,
    references: [searchKey(search)],
    status: "open" as const,
    messageId: options.messageId ?? search.messageId,
  }
  if (page.options.length || page.nextCursor !== null)
    records(session).questions.push(question)
  return {
    status: page.options.length
      ? "found"
      : page.nextCursor !== null
        ? "browsing"
        : "no_matches",
    message:
      page.options.length || page.nextCursor !== null
        ? options.introduction
        : "No trade ideas match these filters. Try broader filters or a different package size.",
    searchReference: searchKey(search),
    scope: space.scope,
    ...(page.options.length || page.nextCursor !== null
      ? { clarification, questionReference: questionKey(question) }
      : {}),
    candidates: page.options.map((o) => ({ reference: o.id, label: o.label })),
  }
}
