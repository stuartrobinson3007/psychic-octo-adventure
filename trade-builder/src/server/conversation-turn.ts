import { TradeDomainError } from "./trade-errors.ts"
import { Effect, Semaphore } from "effect"
import { InvalidContractOptionsError } from "./contract-options.ts"
import { TradeServiceRequestError } from "./trade-service-http.ts"
import { directSignings } from "../lib/trade/signings.ts"
import { cardResponseSummary } from "../lib/trade-response-copy.ts"
import { TradeFunctionTool } from "./trade-function-tool.ts"
import { z } from "zod"
import type {
  Catalogue,
  ChatTurnInput,
  ChatTurnResult,
  TradeSnapshot,
  TradeException,
} from "../lib/trade/types.ts"
import type { TradeSession } from "./trade-session.ts"
import { evaluateProposal } from "./trade-api.ts"
import { createConversationReadTools } from "./conversation-read-tools.ts"
import type { ContractOptions } from "./trade-api.ts"
import {
  teamSelectionClarification,
  playerClarificationOptions,
  clarificationQuestion,
} from "../lib/trade-clarification.ts"
import {
  applyProposalChanges,
  proposalChangeSchema,
} from "./proposal-operation.ts"
import {
  searchSpecificationSchema,
  specification,
  executeSearch,
} from "./conversation-search.ts"
import {
  discuss,
  executionEvidence,
  lookupRecord,
  proposalDescription,
  proposalKey,
  proposalRecords,
  questionKey,
  records,
  searchKey,
} from "./conversation-records.ts"

const id = z.number().int().positive()
const references = z.array(z.string()).max(12)

/** Turn-local transaction: tool evidence can change the next decision; writes commit only on completion. */
export function createConversationTurn(
  input: ChatTurnInput,
  catalogue: Catalogue,
  session: TradeSession,
  signal: AbortSignal,
  evaluate = evaluateProposal
) {
  records(session)
  const working = structuredClone(session)
  const state = records(working)
  const messageId = `${input.requestId}-assistant`
  const touched = new Set<string>()
  const offers = new Map<string, ContractOptions>()
  const exceptions = new Map<number, TradeException>()
  const snapshots: TradeSnapshot[] = []
  const mentions: { query: string; playerIds: number[] }[] = []
  let final: ChatTurnResult | null = null
  let discussedReferences: string[] = []
  let queue = Promise.resolve<unknown>(undefined)
  const toolSemaphore = Semaphore.makeUnsafe(1)

  const requireRecord = (reference: string) => {
    const found = lookupRecord(working, reference)
    if (!found)
      throw new TradeDomainError(
        "That reference is unavailable in this conversation. Retrieve the relevant record or ask which one was intended."
      )
    touched.add(reference)
    return found
  }
  const proposal = (reference: string) => {
    const found = requireRecord(reference)
    if (found.type !== "proposal")
      throw new TradeDomainError("This operation needs a proposal reference.")
    return found.value
  }
  const questions = (keys: string[]) =>
    keys.map((reference) => {
      const found = requireRecord(reference)
      if (found.type !== "question")
        throw new TradeDomainError("Identify a saved question.")
      return found.value
    })
  const verifyVerdict = (snapshot: TradeSnapshot) => {
    const { proposal: checkedProposal, verdict } = snapshot
    if (
      !verdict ||
      verdict.proposalId !== checkedProposal.proposalId ||
      verdict.revision !== checkedProposal.revision ||
      verdict.season !== catalogue.cap.season ||
      verdict.dataFetchedAt !== catalogue.fetchedAt
    )
      throw new TradeDomainError(
        "The validation evidence did not match the requested proposal."
      )
  }
  const run = <T>(
    name: string,
    args: unknown,
    operation: () => T | Promise<T>
  ) => {
    const program = Effect.scoped(
      Effect.gen(function* () {
        if (final) return { error: "This turn has already finished." }
        let running: Promise<T> | undefined
        yield* Effect.addFinalizer(() =>
          Effect.promise(() =>
            running
              ? running.then(
                  () => undefined,
                  () => undefined
                )
              : Promise.resolve()
          )
        )
        const outcome = yield* Effect.tryPromise({
          try: () => {
            running = Promise.resolve(operation())
            return running
          },
          catch: (error) => error,
        }).pipe(
          Effect.catch((error) =>
            error instanceof TradeDomainError ||
            error instanceof TradeServiceRequestError ||
            error instanceof InvalidContractOptionsError
              ? Effect.succeed({ error: error.message })
              : Effect.die(error)
          )
        )
        state.executions.push({
          id: `execution:${crypto.randomUUID()}`,
          messageId,
          operation: name,
          references: [...touched],
          arguments: structuredClone(args),
          outcome: structuredClone(executionEvidence(name, outcome)),
        })
        return outcome
      })
    ).pipe(Semaphore.withPermit(toolSemaphore))
    const result = Effect.runPromise(program, { signal })
    const settled = result.then(
      () => undefined,
      () => undefined
    )
    queue = queue.then(() => settled)
    return result
  }
  const checkedIdeaKeys = new Set<string>()
  const checkIdeas = async (keys: string[]) => {
    if (!keys.length || keys.length > 5 || new Set(keys).size !== keys.length)
      throw new TradeDomainError(
        "Choose one to five different trades to check."
      )
    if (new Set([...checkedIdeaKeys, ...keys]).size > 5)
      throw new TradeDomainError(
        "Choose up to five trades to check in one message."
      )
    keys.forEach((key) => checkedIdeaKeys.add(key))
    const drafts = keys.map(proposal)
    const checked = await Effect.runPromise(
      Effect.forEach(
        drafts,
        (item) =>
          Effect.tryPromise({
            try: async (checkSignal) => {
              const draft = item.proposal
              const previous = snapshots.find(
                (snapshot) =>
                  proposalKey(snapshot.proposal) === proposalKey(draft)
              )
              if (previous) return previous
              const snapshot = {
                proposal: draft,
                verdict: await evaluate(draft, catalogue, checkSignal),
              }
              verifyVerdict(snapshot)
              return snapshot
            },
            catch: (error) => error,
          }),
        { concurrency: 3 }
      ),
      { signal }
    )
    signal.throwIfAborted()
    for (const snapshot of checked) {
      working.revisions = working.revisions.filter(
        (item) => proposalKey(item.proposal) !== proposalKey(snapshot.proposal)
      )
      working.revisions.push(snapshot)
      if (
        !snapshots.some(
          (item) =>
            proposalKey(item.proposal) === proposalKey(snapshot.proposal)
        )
      )
        snapshots.push(snapshot)
    }
    return checked.map((snapshot) => proposalDescription(snapshot, catalogue))
  }
  const tools = {
    ...createConversationReadTools({
      working,
      catalogue,
      offers,
      exceptions,
      mentions,
      signal,
      run,
      requireRecord,
      proposal,
    }),
    check_options: new TradeFunctionTool({
      name: "check_options",
      description:
        "Validate one to five exact trade idea references chosen by the user. Do not automatically check every idea or replace any assets. Each selected proposal becomes a checked card.",
      parameters: z
        .object({ references: z.array(z.string()).min(1).max(5) })
        .strict(),
      execute: (args) =>
        run("check_options", args, () => checkIdeas(args.references)),
    }),
    check_proposal: new TradeFunctionTool({
      name: "check_proposal",
      description:
        "Atomically create or edit and validate a complete trade or hypothetical scenario. baseReference null creates a fresh independent proposal; edits REQUIRE the exact base proposal reference. Include ALL requested changes together. Other assets, routes, signings, overrides and exceptions are preserved. Up to four teams. Replacing a sole outgoing side with another team's player substitutes that team's role; explicit destinations override implicit routing. Ordinary signings are separate standalone proposals, even when discussed alongside a trade. Link them with relatedTradeReference; this does not validate their eligibility after that trade. Only a genuine sign-and-trade combines signing AND asset-transfer changes in this call. Standalone signings/contracts can involve one team. Changes must reflect the user's request; never invent contract terms to make a trade pass.",
      parameters: z
        .object({
          baseReference: z.string().nullable(),
          relatedTradeReference: z.string().nullable(),
          teamIds: z.array(id).max(4),
          changes: z.array(proposalChangeSchema).max(30),
        })
        .strict(),
      execute: (args) =>
        run("check_proposal", args, async () => {
          const base =
            args.baseReference === null ? null : proposal(args.baseReference)
          if (
            base &&
            !args.changes.length &&
            (args.relatedTradeReference === null ||
              (base.proposal.relatedTrade &&
                proposalKey(base.proposal.relatedTrade) ===
                  args.relatedTradeReference))
          ) {
            const verdict = await evaluate(base.proposal, catalogue, signal)
            const checked = { proposal: base.proposal, verdict }
            verifyVerdict(checked)
            working.revisions = working.revisions.filter(
              (item) => proposalKey(item.proposal) !== args.baseReference
            )
            working.revisions.push(checked)
            snapshots.push(checked)
            return { ...proposalDescription(checked, catalogue), verdict }
          }
          if (!base && !args.changes.length && !args.teamIds.length)
            throw new TradeDomainError(
              "Identify the assets or hypothetical changes to check."
            )
          const draft = base
            ? structuredClone(base.proposal)
            : {
                proposalId: crypto.randomUUID(),
                revision: 0,
                teamIds: [],
                transfers: [],
                createdAt: new Date().toISOString(),
              }
          const next = await applyProposalChanges({
            proposal: draft,
            changes: args.changes,
            teamIds: args.teamIds,
            catalogue,
            offers,
            exceptions,
            signal,
          })
          if (next.transfers.length && directSignings(next).length)
            throw new TradeDomainError(
              "Check ordinary signings in separate standalone proposals. Retain the trade and link each signing with relatedTradeReference. Only sign-and-trades include the signed player in the trade."
            )
          if (next.transfers.length) delete next.relatedTrade
          if (args.relatedTradeReference !== null) {
            const related = proposal(args.relatedTradeReference)
            if (next.transfers.length || !related.proposal.transfers.length)
              throw new TradeDomainError(
                "Link a standalone signing scenario to a trade proposal."
              )
            next.relatedTrade = {
              proposalId: related.proposal.proposalId,
              revision: related.proposal.revision,
            }
          }
          next.revision = base
            ? Math.max(
                base.proposal.revision,
                ...proposalRecords(working)
                  .filter(
                    (item) => item.proposal.proposalId === next.proposalId
                  )
                  .map((item) => item.proposal.revision)
              ) + 1
            : 1
          next.createdAt = new Date().toISOString()
          if (base)
            next.parent = {
              proposalId: base.proposal.proposalId,
              revision: base.proposal.revision,
            }
          const verdict = await evaluate(next, catalogue, signal)
          signal.throwIfAborted()
          const snapshot = { proposal: next, verdict }
          verifyVerdict(snapshot)
          working.revisions.push(snapshot)
          snapshots.push(snapshot)
          touched.add(proposalKey(next))
          return { ...proposalDescription(snapshot, catalogue), verdict }
        }),
    }),
    find_options: new TradeFunctionTool({
      name: "find_options",
      description:
        "Start a saved search, or create a new search version from an explicit prior search reference. Discovery supports two teams and 1–3 players per side. Replacement searches require one exact proposal/player, preserving every other asset, route and hypothetical assumption; candidates come from the same sending team. Repairs preserve the specified players. Retain all existing constraints on refinements unless the user changes/removes them. Never substitute a general Curry search for a Mitchell replacement search. Every returned batch has its own identity and option order.",
      parameters: z
        .object({
          goal: z.string().max(500),
          introduction: z
            .string()
            .trim()
            .min(1)
            .max(400)
            .describe(
              "One short sentence introducing the ideas and the user's key filters or requested change. Describe what the user can explore. Do not repeat the selection controls, add validation disclaimers or claim the ideas pass trade rules."
            ),
          previousSearchReference: z.string().nullable(),
          specification: searchSpecificationSchema,
        })
        .strict(),
      execute: (args) =>
        run("find_options", args, async () => {
          const spec = specification(args.specification, working)
          const prior =
            args.previousSearchReference === null
              ? null
              : requireRecord(args.previousSearchReference)
          if (prior && prior.type !== "search")
            throw new TradeDomainError("Choose a saved search to refine.")
          const search = {
            id: prior?.value.id ?? crypto.randomUUID(),
            revision: prior
              ? Math.max(
                  ...state.searches
                    .filter((item) => item.id === prior.value.id)
                    .map((item) => item.revision)
                ) + 1
              : 1,
            goal: args.goal,
            specification: spec,
            messageId,
          }
          state.searches.push(search)
          touched.add(searchKey(search))
          const result = await executeSearch({
            session: working,
            search,
            catalogue,
            signal,
            introduction: args.introduction,
          })
          if ("clarification" in result && result.clarification)
            final = {
              status: "needs_clarification",
              message: result.message,
              snapshot: session.snapshot,
              changes: [],
              snapshots: [...snapshots],
              clarification: result.clarification,
            }
          return result
        }),
    }),
    browse_options: new TradeFunctionTool({
      name: "browse_options",
      description:
        "Browse trade ideas for an exact saved search version. This opens a picker and does not validate trades. Retain the saved scope and assumptions.",
      parameters: z
        .object({
          searchReference: z.string(),
          introduction: z
            .string()
            .trim()
            .min(1)
            .max(400)
            .describe(
              "One short sentence introducing more ideas for this saved search, retaining its key filters. Do not repeat the selection instructions, add validation disclaimers or claim the ideas pass trade checks."
            ),
        })
        .strict(),
      execute: (args) =>
        run("browse_options", args, async () => {
          const found = requireRecord(args.searchReference)
          if (found.type !== "search")
            throw new TradeDomainError(
              "Resolve the specific search to continue."
            )
          const result = await executeSearch({
            session: working,
            search: found.value,
            catalogue,
            signal,
            messageId,
            introduction: args.introduction,
          })
          if ("clarification" in result && result.clarification)
            final = {
              status: "needs_clarification",
              message: result.message,
              snapshot: session.snapshot,
              changes: [],
              snapshots: [...snapshots],
              clarification: result.clarification,
            }
          return result
        }),
    }),
    ask_question: new TradeFunctionTool({
      name: "ask_question",
      description:
        "Ask one genuinely missing question and save the unresolved request. Use player IDs for identity options; team IDs for team/destination options; allTeams lists every team with search. For several selections set selectionLimits={min,max}, with min=max for an exact number; otherwise use null. With no options, the question is an ordinary assistant message and the composer stays normal. Do not ask for a return player when the user wants trade options. Identity comes before missing routing. Preserve every named player and hypothetical requirement in context. The next answer resumes this request, including additional corrections.",
      parameters: z
        .object({
          question: z.string().max(400),
          purpose: z.enum([
            "player_identity",
            "player_destination",
            "search_filters",
            "contract_terms",
            "team_selection",
            "trade_reference",
            "other",
          ]),
          playerIds: z.array(id).max(12),
          teamIds: z.array(id).max(4),
          allTeams: z.boolean(),
          selectionLimits: z
            .object({
              min: z.number().int().min(1).max(30),
              max: z.number().int().min(1).max(30),
            })
            .strict()
            .nullable(),
          choices: z
            .array(
              z
                .object({ label: z.string(), reference: z.string().nullable() })
                .strict()
            )
            .max(12),
          references,
          context: z.string().max(2000),
          supersedesQuestionReferences: references,
          answeredQuestionReferences: references,
        })
        .strict(),
      execute: (args) =>
        run("ask_question", args, () => {
          args.references.forEach(requireRecord)
          if (
            args.playerIds.some(
              (playerId) =>
                !catalogue.players.some((player) => player.id === playerId)
            ) ||
            args.teamIds.some(
              (teamId) => !catalogue.teams.some((team) => team.id === teamId)
            )
          )
            throw new TradeDomainError(
              "Question choices must identify available players or teams."
            )
          const answered = questions(args.answeredQuestionReferences)
          const superseded = questions(args.supersedesQuestionReferences)
          let clarification =
            args.allTeams || args.teamIds.length
              ? teamSelectionClarification(
                  args.question,
                  catalogue,
                  args.allTeams ? undefined : args.teamIds
                )
              : {
                  purpose: args.purpose,
                  question: args.question,
                  options: args.playerIds.length
                    ? playerClarificationOptions(args.playerIds, catalogue)
                    : args.choices.map((item, index) => {
                        if (item.reference) requireRecord(item.reference)
                        return {
                          id: `choice-${index + 1}`,
                          label: item.label,
                          value: item.label,
                        }
                      }),
                }
          clarification = {
            ...clarification,
            id: crypto.randomUUID(),
            purpose: args.purpose,
            ...(args.selectionLimits
              ? { selectionLimits: args.selectionLimits }
              : {}),
            question: clarificationQuestion(
              args.question,
              clarification.options.length > 0
            ),
          }
          if (
            args.selectionLimits &&
            (args.selectionLimits.min > args.selectionLimits.max ||
              args.selectionLimits.min > clarification.options.length ||
              (args.purpose === "player_identity" &&
                args.selectionLimits.max !== 1))
          )
            throw new TradeDomainError(
              "Selection limits must fit the available choices; an ambiguous identity requires one person."
            )
          const question = {
            id: clarification.id!,
            clarification,
            choices: args.choices,
            originalMessage: input.message,
            context: args.context,
            references: args.references,
            status: "open" as const,
            messageId,
          }
          answered.forEach((item) => {
            item.status = "answered"
          })
          superseded.forEach((item) => {
            item.status = "cancelled"
          })
          state.questions.push(question)
          touched.add(questionKey(question))
          final = {
            status: "needs_clarification",
            message: clarification.question,
            snapshot: session.snapshot,
            changes: [],
            snapshots: [...snapshots],
            clarification,
          }
          return { questionReference: questionKey(question), clarification }
        }),
    }),
    finish_response: new TradeFunctionTool({
      name: "finish_response",
      description:
        "Finish with a concise answer grounded in executed results. Introduce checked cards with one short sentence explaining the outcome or requested change. Summarize several cards together; leave package lists, salaries and detailed rule explanations in the cards. For searches explain scope and limits from the actual result. Mark answered/cancelled questions explicitly; discussing a different topic hides their option widget while retaining unresolved history. displayProposalReferences can show a selected or restored proposal without editing it. discussionReferences are the records the answer concerns; there is no mandatory current proposal.",
      parameters: z
        .object({
          message: z.string().trim().min(1).max(10000),
          discussionReferences: references,
          displayProposalReferences: references,
          answeredQuestionReferences: references,
          cancelledQuestionReferences: references,
          resetDiscussion: z.boolean(),
        })
        .strict(),
      execute: (args) =>
        run("finish_response", args, () => {
          args.discussionReferences.forEach(requireRecord)
          const answered = questions(args.answeredQuestionReferences)
          const cancelled = questions(args.cancelledQuestionReferences)
          const display = args.displayProposalReferences.map(proposal)
          if (display.some((snapshot) => !snapshot.verdict))
            throw new TradeDomainError(
              "Use browse_options to show trade ideas, or check_options for trades the user chose to check."
            )
          discussedReferences = args.discussionReferences
          answered.forEach((item) => {
            item.status = "answered"
          })
          cancelled.forEach((item) => {
            item.status = "cancelled"
          })
          if (args.resetDiscussion) {
            state.discussion = []
            touched.clear()
            working.snapshot = null
          }
          final = {
            status: "complete",
            message: args.message,
            snapshot: session.snapshot,
            changes: [],
            snapshots: [
              ...snapshots,
              ...display.filter(
                (item) =>
                  !snapshots.some(
                    (snapshot) =>
                      proposalKey(snapshot.proposal) ===
                      proposalKey(item.proposal)
                  )
              ),
            ],
          }
          return { completed: true }
        }),
    }),
  }
  return {
    tools,
    async checkSelection(keys: string[], questionId: string) {
      await run("check_options", { references: keys }, () => checkIdeas(keys))
      if (!snapshots.length)
        throw new TradeDomainError(
          "The selected trades could not be checked. Try again."
        )
      const question = state.questions.find((q) => q.id === questionId)
      if (question) question.status = "answered"
      final = {
        status: "complete",
        message: "",
        snapshot: session.snapshot,
        changes: [],
        snapshots: [...snapshots],
      }
    },
    finished: () => final !== null,
    resolvedPlayerMentions: () => mentions,
    settle: () => queue,
    complete(fallbackText = ""): ChatTurnResult {
      if (!final) {
        if (snapshots.length || !fallbackText.trim())
          throw new TradeDomainError(
            "The assistant did not complete the requested operation."
          )
        final = {
          status: "complete",
          message: fallbackText,
          snapshot: session.snapshot,
          changes: [],
          snapshots: [],
        }
      }
      if (final.status === "complete" && !final.message.trim())
        final.message = cardResponseSummary(final.snapshots)
      const evidence = state.executions
        .filter(
          (item) =>
            item.messageId === messageId &&
            ![
              "finish_response",
              "read_records",
              "recall_conversation",
            ].includes(item.operation)
        )
        .slice(-2)
        .map((item) => item.id)
      discuss(
        working,
        [...touched, ...evidence, ...discussedReferences],
        messageId
      )
      const latest = final.snapshots.at(-1)
      if (latest) working.snapshot = latest
      state.executions
        .filter((item) => item.messageId === messageId)
        .forEach((item) => {
          item.turnStatus = "completed"
        })
      session.messages = working.messages
      session.records = working.records
      session.revisions = working.revisions
      session.candidates = working.candidates
      session.snapshot = working.snapshot
      final.snapshot = session.snapshot
      return final
    },
    failure(error: string) {
      const executions = state.executions.filter(
        (item) => item.messageId === messageId
      )
      // Retain diagnostic evidence without committing staged proposal/search writes.
      const retained = records(session)
      retained.executions.push(
        ...executions.map((item) => ({
          ...item,
          turnStatus: "failed" as const,
        })),
        {
          turnStatus: "failed",
          id: `execution:${crypto.randomUUID()}`,
          messageId,
          operation: "turn_failure",
          references: [...touched].filter((reference) =>
            lookupRecord(session, reference)
          ),
          arguments: { message: input.message },
          outcome: { error },
        }
      )
      discuss(
        session,
        retained.executions.slice(-1).map((item) => item.id),
        messageId
      )
    },
  }
}
