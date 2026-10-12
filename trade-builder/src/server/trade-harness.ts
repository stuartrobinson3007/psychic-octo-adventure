import { expandIdeaAnswer } from "./trade-ideas.ts"
import { resolveClarificationAnswer } from "../lib/clarification-selection.ts"
import { toolActivity } from "../lib/tool-activity.ts"
import {
  assistantUnavailableMessage,
  chatFailure,
} from "./chat-service-error.ts"
import type { BaseLlm } from "@google/adk"
import { Config, DateTime, Effect, Option, Redacted, Schema } from "effect"
import { ChatTurnResultSchema } from "../lib/trade/chat-schemas.ts"
import { OpenAIAdkModel } from "./openai-adk-model.ts"
import { runAdkTradeAgent } from "./adk-trade-agent.ts"
import type {
  Catalogue,
  ChatTurnInput,
  ChatTurnResult,
  ToolActivity,
} from "../lib/trade/types.ts"
import type { evaluateProposal } from "./trade-api.ts"
import { createConversationTurn } from "./conversation-turn.ts"
import { conversationInstructions } from "./conversation-instructions.ts"
import {
  activePendingClarification,
  getSession,
  rememberReply,
  withSessionLock,
  recordExchange,
} from "./trade-session.ts"

export function chatAvailable(): boolean {
  const key = Effect.runSync(Config.option(Config.Redacted("OPENAI_API_KEY")))
  return Option.isSome(key) && Boolean(Redacted.value(key.value))
}

function chatModel() {
  const config = Effect.runSync(
    Effect.gen(function* () {
      return {
        apiKey: yield* Config.Redacted("OPENAI_API_KEY"),
        model: yield* Config.String("GAMBIT_EXECUTION_MODEL").pipe(
          Config.withDefault("gpt-6.1-sol")
        ),
      }
    })
  )
  return new OpenAIAdkModel({
    apiKey: Redacted.value(config.apiKey),
    model: config.model,
  })
}

interface ChatDependencies {
  model?: BaseLlm
  evaluate?: typeof evaluateProposal
  signal?: AbortSignal
  timeoutMs?: number
  onError?: (error: unknown) => void
  onActivity?: (activity: ToolActivity) => void
  onStep?: (event: {
    tools: Array<{ name: string; input: unknown }>
    results: Array<{ name: string; output: unknown }>
  }) => void
}

export async function runChatTurn(
  input: ChatTurnInput,
  catalogue: Catalogue,
  dependencies: ChatDependencies = {}
): Promise<ChatTurnResult> {
  const receivedAt = DateTime.formatIso(Effect.runSync(DateTime.now))
  const timeoutMs = dependencies.timeoutMs ?? 90_000
  return withSessionLock(
    input.sessionId,
    async (turnSignal, storage) => {
      const session = getSession(input.sessionId)
      const previousReply = session.replies.get(input.requestId)
      if (previousReply) return structuredClone(previousReply)
      const workStartedAt = performance.now()
      const activities = new Map<string, ToolActivity>()
      let resolvedPlayerMentions: Array<{
        query: string
        playerIds: Array<number>
      }> = []
      const publishActivity = (activity: ToolActivity) => {
        activities.set(activity.id, activity)
        dependencies.onActivity?.(activity)
      }
      const respond = (reply: ChatTurnResult) => {
        for (const activity of activities.values())
          if (activity.state === "running")
            publishActivity({
              ...activity,
              state: "error",
              label: activity.label.replace(/…$/, " — couldn’t finish"),
            })
        const result: ChatTurnResult = Schema.decodeUnknownSync(
          Schema.fromJsonString(ChatTurnResultSchema)
        )(
          JSON.stringify({
            ...reply,
            ...(activities.size
              ? {
                  toolCalls: [...activities.values()],
                  workDurationMs: Math.round(performance.now() - workStartedAt),
                }
              : {}),
            conversationVersion: session.version + 1,
          })
        )
        recordExchange(
          session,
          { ...input, resolvedPlayerMentions },
          result,
          receivedAt
        )
        result.pendingClarification = activePendingClarification(session)
        rememberReply(session, input.requestId, result)
        return result
      }
      const unchanged = {
        snapshot: session.snapshot,
        changes: [],
        snapshots: [],
      }
      if (
        (input.expectedConversationVersion !== undefined &&
          input.expectedConversationVersion !== session.version) ||
        (input.expectedRevision !== undefined &&
          input.expectedRevision !== (session.snapshot?.proposal.revision ?? 0))
      )
        return respond({
          ...unchanged,
          status: "conflict",
          message:
            "The conversation changed while this message was being sent. Please try again.",
        })
      if (input.cancelQuestionId) {
        const question = session.records?.questions.find(
          (item) => item.id === input.cancelQuestionId && item.status === "open"
        )
        if (
          input.clarificationAnswer ||
          !question ||
          activePendingClarification(session)?.id !== question.id
        )
          return respond({
            ...unchanged,
            status: "conflict",
            message: "That question is no longer waiting for an answer.",
          })
        question.status = "cancelled"
        return respond({
          ...unchanged,
          status: "complete",
          message: "Cancelled.",
        })
      }
      if (input.clarificationAnswer) {
        expandIdeaAnswer(
          session,
          input.clarificationAnswer.optionIds ?? [
            input.clarificationAnswer.optionId,
          ]
        )
        const choices = resolveClarificationAnswer(
          activePendingClarification(session),
          input.clarificationAnswer,
          input.message
        )
        if (!choices)
          return respond({
            ...unchanged,
            status: "conflict",
            message:
              "That clarification answer no longer matches the question. Please answer the current question again.",
          })
      }
      const unknownSelection = input.selectedPlayerIds?.find(
        (id) => !catalogue.players.some((player) => player.id === id)
      )
      if (unknownSelection !== undefined)
        return respond({
          ...unchanged,
          status: "error",
          message: "A selected player is no longer available.",
        })
      const selectedPicks = (input.selectedPickIds ?? []).map((id) =>
        catalogue.draftPicks?.find((pick) => pick.id === id)
      )
      if (
        selectedPicks.some(
          (pick) => !pick || pick.isSwap || !pick.isTradable
        ) ||
        input.pickReferences?.some(
          (ref) =>
            ref.ownerTeamId !== undefined &&
            catalogue.draftPicks?.find((pick) => pick.id === ref.pickId)
              ?.currentTeamId !== ref.ownerTeamId
        )
      )
        return respond({
          ...unchanged,
          status: "error",
          message:
            "A selected pick’s ownership or availability changed. Refresh draft picks and select it again.",
        })
      if (!dependencies.model && !chatAvailable())
        return respond({
          status: "agent_unavailable",
          message: assistantUnavailableMessage,
          snapshot: session.snapshot,
          changes: [],
          snapshots: [],
        })

      const accessError = await Effect.runPromise(storage.authorize, {
        signal: turnSignal,
      })
      if (accessError)
        return respond({ ...unchanged, status: "error", message: accessError })

      const signal = turnSignal
      const turn = createConversationTurn(
        input,
        catalogue,
        session,
        signal,
        dependencies.evaluate
      )
      try {
        const picker = activePendingClarification(session)
        if (
          input.clarificationAnswer &&
          picker?.purpose === "trade_selection" &&
          !input.clarificationAnswer.text.trim()
        ) {
          const keys = input.clarificationAnswer.optionIds ?? [
            input.clarificationAnswer.optionId,
          ]
          const activityId = crypto.randomUUID()
          publishActivity(
            toolActivity(
              activityId,
              "check_options",
              { references: keys },
              "running",
              catalogue
            )
          )
          await turn.checkSelection(keys, picker.id!)
          publishActivity(
            toolActivity(
              activityId,
              "check_options",
              { references: keys },
              "complete",
              catalogue
            )
          )
          return respond(turn.complete())
        }
        const text = await runAdkTradeAgent({
          model: dependencies.model ?? chatModel(),
          instructions: conversationInstructions(input, session, catalogue),
          tools: Object.values(turn.tools),
          history: session.history,
          message: input.message,
          requestId: input.requestId,
          catalogue,
          finished: turn.finished,
          signal,
          onActivity: publishActivity,
          onStep: dependencies.onStep,
        })
        await turn.settle()
        signal.throwIfAborted()
        resolvedPlayerMentions = turn.resolvedPlayerMentions()
        const reply = turn.complete(text)
        return respond(reply)
      } catch (error) {
        dependencies.onError?.(error)
        const failure = chatFailure(error)
        turn.failure(failure.message)
        if (!dependencies.onError)
          Effect.runSync(
            Effect.logWarning("Trade chat failed", {
              kind: failure.kind,
              requestId: input.requestId,
            })
          )
        await turn.settle()
        return respond({
          status: failure.status,
          message: failure.message,
          snapshot: session.snapshot,
          changes: [],
          snapshots: [],
        })
      }
    },
    timeoutMs + 15_000,
    dependencies.signal,
    timeoutMs
  )
}
