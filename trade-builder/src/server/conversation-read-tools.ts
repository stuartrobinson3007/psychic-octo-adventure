import { TradeDomainError } from "./trade-errors.ts"
import { Effect } from "effect"
import { TradeFunctionTool } from "./trade-function-tool.ts"
import { z } from "zod"
import type {
  Catalogue,
  TradeSnapshot,
  TradeException,
} from "../lib/trade/types.ts"
import type { TradeSession } from "./trade-session.ts"
import type { ContractOptions } from "./trade-api.ts"
import { contractOptions, readTradeExceptions } from "./trade-api.ts"
import { explainVerdict } from "./trade-explanations.ts"
import {
  contextIndex,
  proposalDescription,
  records,
  questionKey,
} from "./conversation-records.ts"
import type { lookupRecord } from "./conversation-records.ts"

const id = z.number().int().positive()
const references = z.array(z.string()).max(12)
interface ReadContext {
  working: TradeSession
  catalogue: Catalogue
  offers: Map<string, ContractOptions>
  exceptions: Map<number, TradeException>
  mentions: { query: string; playerIds: number[] }[]
  signal: AbortSignal
  run: <T>(
    name: string,
    args: unknown,
    operation: () => T | Promise<T>
  ) => Promise<T | { error: string }>
  requireRecord: (
    reference: string
  ) => NonNullable<ReturnType<typeof lookupRecord>>
  proposal: (reference: string) => TradeSnapshot
}

/** Evidence tools retrieve domain facts without altering proposals or search scope. */
export function createConversationReadTools(context: ReadContext) {
  const {
    working,
    catalogue,
    offers,
    exceptions,
    mentions,
    signal,
    run,
    requireRecord,
    proposal,
  } = context
  const state = records(working)
  return {
    read_records: new TradeFunctionTool({
      name: "read_records",
      description:
        "Read exact proposals, searches, option batches, pending questions or recorded outcomes by reference. Older references remain available. Use this before historical edits, comparisons and search continuations.",
      parameters: z.object({ references }).strict(),
      execute: (args) =>
        run("read_records", args, () =>
          args.references.map((reference) => {
            const record = requireRecord(reference)
            if (record.type === "search") {
              const {
                catalogue: _catalogue,
                base: _base,
                ...value
              } = record.value
              return { reference, type: record.type, value }
            }
            return { reference, ...record }
          })
        ),
    }),
    recall_conversation: new TradeFunctionTool({
      name: "recall_conversation",
      description:
        "Retrieve a paginated conversation index, including older proposals, search scope, option order and actual outcomes. Query terms filter stored descriptions; leave query null to browse. Returns records to read by exact reference.",
      parameters: z
        .object({
          query: z.string().nullable(),
          offset: z.number().int().nonnegative(),
          limit: z.number().int().min(1).max(30),
        })
        .strict(),
      execute: (args) =>
        run("recall_conversation", args, () => {
          const index = contextIndex(
            working,
            catalogue,
            Number.MAX_SAFE_INTEGER
          )
          const entries = [
            ...index.proposals,
            ...index.searches,
            ...index.batches,
            ...state.questions.map((item) => ({
              reference: questionKey(item),
              ...item,
            })),
            ...state.executions.map((item) => ({
              reference: item.id,
              ...item,
            })),
          ]
          const terms =
            args.query?.toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? []
          const matches = entries.filter((item) =>
            terms.every((term) =>
              JSON.stringify(item).toLocaleLowerCase().includes(term)
            )
          )
          return {
            total: matches.length,
            records: matches.slice(args.offset, args.offset + args.limit),
            nextOffset:
              args.offset + args.limit < matches.length
                ? args.offset + args.limit
                : null,
          }
        }),
    }),
    search_players: new TradeFunctionTool({
      name: "search_players",
      description:
        "Read authoritative identities and facts. Each identities entry represents ONE mentioned person or phrase, with all plausible catalogue IDs for THAT identity. Put different named people in separate entries: two resolved people are not an ambiguity. Supply no candidates for an unknown/non-player name. For a roster collection, use identities=[] and teamId. Catalogue facts determine ownership and eligibility.",
      parameters: z
        .object({
          identities: z
            .array(
              z
                .object({
                  query: z.string(),
                  candidatePlayerIds: z.array(id).max(20),
                })
                .strict()
            )
            .max(12),
          teamId: id.nullable(),
        })
        .strict(),
      execute: (args) =>
        run("search_players", args, () => {
          if (!args.identities.length && args.teamId === null)
            throw new TradeDomainError(
              "Supply player identities or a team roster to read."
            )
          if (args.identities.length && args.teamId !== null)
            throw new TradeDomainError(
              "Read identities and roster collections separately."
            )
          const candidateIds = [
            ...new Set(
              args.identities.flatMap((item) => item.candidatePlayerIds)
            ),
          ]
          if (
            candidateIds.length > 40 ||
            candidateIds.some(
              (playerId) =>
                !catalogue.players.some((player) => player.id === playerId)
            )
          )
            throw new TradeDomainError(
              "Resolve identities against the supplied catalogue directory; at most forty candidates can be read together."
            )
          if (
            args.teamId !== null &&
            !catalogue.teams.some((team) => team.id === args.teamId)
          )
            throw new TradeDomainError("This team is not in the catalogue.")
          const identities = args.identities.map((item) => {
            const playerIds = [...new Set(item.candidatePlayerIds)]
            mentions.push({ query: item.query, playerIds })
            return {
              query: item.query,
              status:
                playerIds.length === 1
                  ? "resolved"
                  : playerIds.length
                    ? "ambiguous"
                    : "unknown",
              playerIds,
            }
          })
          const players = catalogue.players.filter((player) =>
            args.teamId === null
              ? candidateIds.includes(player.id)
              : player.teamId === args.teamId
          )
          return {
            identities,
            collection: args.teamId !== null,
            players: players.map((player) => ({
              ...player,
              team:
                catalogue.teams.find((team) => team.id === player.teamId) ??
                null,
            })),
            instruction:
              "Each identity has its own resolution. Proceed with resolved identities. Ask only about a particular genuinely ambiguous or unknown identity, preserving the other people and request. A roster collection is never identity ambiguity.",
          }
        }),
    }),
    read_team_assets: new TradeFunctionTool({
      name: "read_team_assets",
      description:
        "Read current team payroll, cap thresholds, roster, picks, unsigned draft rights and available trade exceptions. Player, pick and draft-right IDs are separate namespaces.",
      parameters: z
        .object({
          teamIds: z.array(id).min(1).max(30),
          sections: z
            .array(
              z.enum([
                "payroll",
                "players",
                "picks",
                "draft_rights",
                "exceptions",
              ])
            )
            .min(1),
        })
        .strict(),
      execute: (args) =>
        run("read_team_assets", args, async () =>
          Effect.runPromise(
            Effect.forEach(
              args.teamIds,
              (teamId) =>
                Effect.tryPromise({
                  try: async (teamSignal) => {
                    const team = catalogue.teams.find(
                      (item) => item.id === teamId
                    )
                    if (!team)
                      throw new TradeDomainError("Identify a catalogue team.")
                    const listed = args.sections.includes("exceptions")
                      ? await readTradeExceptions(teamId, catalogue, teamSignal)
                      : []
                    listed.forEach((item) => exceptions.set(item.id, item))
                    return {
                      team,
                      cap: catalogue.cap,
                      ...(args.sections.includes("players")
                        ? {
                            players: catalogue.players.filter(
                              (item) => item.teamId === teamId
                            ),
                          }
                        : {}),
                      ...(args.sections.includes("picks")
                        ? {
                            picks:
                              catalogue.draftPicks?.filter(
                                (item) => item.currentTeamId === teamId
                              ) ?? null,
                          }
                        : {}),
                      ...(args.sections.includes("draft_rights")
                        ? {
                            draftRights:
                              catalogue.draftRights?.filter(
                                (item) => item.currentTeamId === teamId
                              ) ?? null,
                          }
                        : {}),
                      ...(args.sections.includes("exceptions")
                        ? {
                            exceptions: listed,
                            exceptionSelection:
                              listed.length > 1
                                ? "Several exceptions are available. Ask which one unless the user identified a particular source, amount or ranking."
                                : listed.length
                                  ? "One exception is available."
                                  : "No exceptions are available.",
                          }
                        : {}),
                    }
                  },
                  catch: (error) => error,
                }),
              { concurrency: 4 }
            ),
            { signal }
          )
        ),
    }),
    get_contract_options: new TradeFunctionTool({
      name: "get_contract_options",
      description:
        "Read available first-year signing salaries, eligible contract tiers and maximum durations for a particular free agent and team. Read this in the current turn before proposing a signing; an offer does not sign anyone.",
      parameters: z.object({ playerId: id, teamId: id }).strict(),
      execute: (args) =>
        run("get_contract_options", args, async () => {
          if (
            !catalogue.players.some(
              (player) =>
                player.id === args.playerId &&
                player.signingStatus === "free-agent"
            ) ||
            !catalogue.teams.some((team) => team.id === args.teamId)
          )
            throw new TradeDomainError(
              "Choose a catalogue free agent and signing team."
            )
          const offer = await contractOptions(
            args.playerId,
            args.teamId,
            signal
          )
          offers.set(`${args.playerId}:${args.teamId}`, offer)
          const player = catalogue.players.find(
            (item) => item.id === args.playerId
          )!
          return {
            ...offer,
            signAndTrade: {
              previousTeamId: player.teamId,
              signingTeamMatchesPreviousTeam: args.teamId === player.teamId,
              minYears: 3,
              maxYears: 4,
              firstYearMustBeGuaranteed: true,
              prohibitedTiers: ["mle", "room-mle"],
              receivingTeamPayrollLimit: catalogue.cap.firstApron,
              unavailableEvidence: [
                "Previous-season ending roster",
                "Transaction timing",
                "Previous salary and bonuses",
              ],
            },
          }
        }),
    }),
    explain_proposals: new TradeFunctionTool({
      name: "explain_proposals",
      description:
        "Read checked salary/roster evidence and hypothetical assumptions for one or more exact proposal versions. Supports comparing different trades and historical versions. No assets are edited. This establishes mechanics, not market value, willingness or fit.",
      parameters: z
        .object({
          proposalReferences: z.array(z.string()).min(1).max(4),
          teamId: id.nullable(),
        })
        .strict(),
      execute: (args) =>
        run("explain_proposals", args, () =>
          args.proposalReferences.map((reference) => {
            const snapshot = proposal(reference)
            if (
              args.teamId !== null &&
              !snapshot.proposal.teamIds.includes(args.teamId)
            )
              throw new TradeDomainError("That team is not in this proposal.")
            return {
              ...proposalDescription(snapshot, catalogue),
              explanation: explainVerdict(
                snapshot,
                catalogue,
                args.teamId ?? undefined
              ),
              verdict: snapshot.verdict,
            }
          })
        ),
    }),
  }
}
