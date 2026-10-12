import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { BaseLlm } from "@google/adk"
import { Schema } from "effect"
import { OpenAIAdkModel } from "./openai-adk-model.ts"
import type { BaseLlmConnection, LlmRequest, LlmResponse } from "@google/adk"
import { tradeChatStreamResponse } from "./trade-chat-stream.ts"
import {
  sendStreamingTradeMessage,
  TradeStreamError,
} from "../lib/trade-chat-stream.ts"
import {
  maxTradeEventSize,
  tradeStreamInterrupted,
} from "../lib/trade-chat-protocol.ts"
import type { Catalogue, ToolActivity } from "../lib/trade/types.ts"
import { getSession, withSessionLock } from "./trade-session.ts"

const catalogue: Catalogue = JSON.parse(
  readFileSync(
    new URL("../lib/trade/catalogue-snapshot.json", import.meta.url),
    "utf8"
  )
)
type Call = [string, Record<string, unknown>]
function mockModel(
  steps: Array<Array<Call> | ((signal?: AbortSignal) => Promise<Array<Call>>)>
) {
  let index = 0
  return new (class extends BaseLlm {
    constructor() {
      super({ model: "local-integration-model" })
    }
    async *generateContentAsync(
      _request: LlmRequest,
      _stream = false,
      signal?: AbortSignal
    ): AsyncGenerator<LlmResponse, void> {
      const next = steps[index++]
      const calls = typeof next === "function" ? await next(signal) : next
      yield {
        content: {
          role: "model",
          parts: calls.map(([name, args], call) => ({
            functionCall: { id: `call-${index}-${call}`, name, args },
          })),
        },
        turnComplete: true,
      }
    }
    connect(_request: LlmRequest): Promise<BaseLlmConnection> {
      return Promise.reject(
        new Error("Live connections are not used by these checks.")
      )
    }
  })()
}
const questionInput = (question: string, playerIds: number[] = []) => ({
  question,
  purpose: "player_identity",
  playerIds,
  teamIds: [],
  allTeams: false,
  selectionLimits: null,
  choices: [],
  references: [],
  context: "Trade Nick for Andrew; resolve the requested player identity.",
  supersedesQuestionReferences: [],
  answeredQuestionReferences: [],
})

test("a fragmented UTF-8 response retains progress and the exact ADK clarification", async () => {
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade Andrew.",
  }
  const question = "Which Andrew—Wiggins or Nembhard? 🏀"
  const response = tradeChatStreamResponse(input, catalogue, {
    model: mockModel([[["ask_question", questionInput(question)]]]),
  })
  assert.ok(response.body)
  const fragmented = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        for (let offset = 0; offset < chunk.length; offset++)
          controller.enqueue(chunk.subarray(offset, offset + 1))
      },
    })
  )
  const states: ToolActivity[][] = []
  const result = await sendStreamingTradeMessage(
    input,
    (calls) => states.push(calls),
    {
      api: "https://gambit.local/api/trade-chat",
      fetch: async (_url, init) => {
        assert.ok(init)
        assert.equal(init.method, "POST")
        assert.equal(
          new Headers(init.headers).get("accept"),
          "text/event-stream"
        )
        assert.deepEqual(
          JSON.parse(await new Response(init.body).text()),
          input
        )
        return new Response(fragmented, { headers: response.headers })
      },
    }
  )
  assert.equal(result.message, question)
  assert.equal(result.status, "needs_clarification")
  assert.equal(states[0][0].state, "running")
  assert.equal(states.at(-1)?.[0].state, "complete")
  assert.equal(
    states.at(-1)?.length,
    1,
    "Updates replace progress by its call ID"
  )
  assert.equal(getSession(input.sessionId).messages.at(-1)?.text, question)
})

test(
  "browser cancellation aborts the ADK request and leaves its conversation available",
  { timeout: 2000 },
  async () => {
    const input = {
      sessionId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      message: "Trade Andrew.",
    }
    let notifyStarted = () => {}
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    let modelAborted = false
    const model = mockModel([
      (signal) =>
        new Promise((_resolve, reject) => {
          assert.ok(signal)
          signal.addEventListener(
            "abort",
            () => {
              modelAborted = true
              reject(signal.reason)
            },
            { once: true }
          )
          notifyStarted()
        }),
    ])
    const cancellation = new AbortController()
    const pending = assert.rejects(
      sendStreamingTradeMessage(
        input,
        () => {},
        {
          api: "https://gambit.local/api/trade-chat",
          fetch: async () =>
            tradeChatStreamResponse(input, catalogue, {
              model,
              onError: () => {},
            }),
        },
        cancellation.signal
      )
    )
    await started
    cancellation.abort()
    await pending
    assert.equal(modelAborted, true)
    assert.deepEqual(
      await withSessionLock(
        input.sessionId,
        async () => getSession(input.sessionId).messages
      ),
      []
    )
  }
)

test("interrupted, malformed and mismatched server streams cannot become a completed reply", async () => {
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade Andrew.",
  }
  const frame = (event: unknown) => `data: ${JSON.stringify(event)}\r\n\r\n`
  const envelope = { version: 1, requestId: input.requestId }
  const start = frame({ ...envelope, type: "start" })
  const result = frame({
    ...envelope,
    type: "result",
    result: {
      status: "complete",
      message: "Done",
      snapshot: null,
      changes: [],
      snapshots: [],
    },
  })
  const failures = [
    new Response(start, { headers: { "content-type": "text/event-stream" } }),
    new Response(result, { headers: { "content-type": "text/event-stream" } }),
    new Response(start + start + result, {
      headers: { "content-type": "text/event-stream" },
    }),
    new Response(frame({ ...envelope, type: "start", version: 2 }), {
      headers: { "content-type": "text/event-stream" },
    }),
    new Response(
      frame({ ...envelope, type: "start", requestId: "a-different-request" }),
      { headers: { "content-type": "text/event-stream" } }
    ),
    new Response(start + "data: {broken\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
    new Response(
      start +
        frame({ ...envelope, type: "result", result: { status: "complete" } }),
      { headers: { "content-type": "text/event-stream" } }
    ),
    new Response(
      start +
        frame({ ...envelope, type: "error", message: tradeStreamInterrupted }),
      { headers: { "content-type": "text/event-stream" } }
    ),
    new Response(start + result + result, {
      headers: { "content-type": "text/event-stream" },
    }),
    new Response("data: " + "x".repeat(maxTradeEventSize + 1), {
      headers: { "content-type": "text/event-stream" },
    }),
    new Response("private upstream details", { status: 403 }),
    Response.json({ private: "upstream details" }),
  ]
  for (const response of failures)
    await assert.rejects(
      sendStreamingTradeMessage(
        input,
        () => assert.fail("Invalid streams must not publish progress"),
        {
          api: "https://gambit.local/api/trade-chat",
          fetch: async () => response,
        }
      ),
      (cause: unknown) => {
        assert.ok(cause instanceof TradeStreamError)
        assert.equal(cause.message, tradeStreamInterrupted)
        assert.doesNotMatch(cause.message, /private/)
        return true
      }
    )
})

test(
  "disconnecting the response stream cancels the ADK invocation and leaves no partial conversation",
  { timeout: 2000 },
  async () => {
    const input = {
      sessionId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      message: "Trade Andrew.",
    }
    let notifyStarted = () => {}
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    let notifyAborted = () => {}
    const aborted = new Promise<void>((resolve) => {
      notifyAborted = resolve
    })
    const model = mockModel([
      (signal) =>
        new Promise((_resolve, reject) => {
          assert.ok(signal)
          signal.addEventListener(
            "abort",
            () => {
              notifyAborted()
              reject(signal.reason)
            },
            { once: true }
          )
          notifyStarted()
        }),
    ])
    const response = tradeChatStreamResponse(input, catalogue, {
      model,
      onError: () => {},
    })
    assert.ok(response.body)
    const reader = response.body.getReader()
    await reader.read()
    await started
    await reader.cancel()
    await aborted
    assert.deepEqual(
      await withSessionLock(
        input.sessionId,
        async () => getSession(input.sessionId).messages
      ),
      []
    )
  }
)

test("the ADK tool loop streams progress before the final question and persists the history exactly once", async () => {
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade Nick for Andrew.",
  }
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let sawProgress!: () => void
  const progress = new Promise<void>((resolve) => {
    sawProgress = resolve
  })
  const question = "Which Andrew do you want to trade for?"
  const playerIds = catalogue.players
    .filter((p) => ["Andrew Wiggins", "Andrew Nembhard"].includes(p.name))
    .map((p) => p.id)
  const model = mockModel([
    [
      [
        "search_players",
        {
          identities: [{ query: "Andrew", candidatePlayerIds: playerIds }],
          teamId: null,
        },
      ],
    ],
    async () => {
      await gate
      return [["ask_question", questionInput(question, playerIds)]]
    },
  ])
  const states: Array<Array<ToolActivity>> = []
  const response = tradeChatStreamResponse(input, catalogue, { model })
  assert.match(response.headers.get("content-type")!, /text\/event-stream/)
  const transport = {
    api: "https://gambit.local/api/trade-chat",
    fetch: async () => response,
  }
  const pending = sendStreamingTradeMessage(
    input,
    (calls) => {
      states.push(structuredClone(calls))
      if (calls.some((call) => call.label === "Searched for Andrew"))
        sawProgress()
    },
    transport
  )
  try {
    await Promise.race([
      progress,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Progress was buffered until completion")),
          2000
        )
      ),
    ])
    assert.equal(getSession(input.sessionId).messages.length, 0)
  } finally {
    release()
  }
  const result = await pending
  assert.equal(result.status, "needs_clarification")
  assert.equal(result.message, question)
  assert.ok(
    typeof result.workDurationMs === "number" && result.workDurationMs >= 0
  )
  assert.equal(
    getSession(input.sessionId).messages.at(-1)?.workDurationMs,
    result.workDurationMs
  )
  assert.equal(result.toolCalls?.length, 2)
  assert.ok(result.toolCalls.every((call) => call.state === "complete"))
  assert.ok(
    states.some((calls) =>
      calls.some((call) => call.label === "Searching for Andrew…")
    )
  )
  assert.deepEqual(
    getSession(input.sessionId).messages.at(-1)?.toolCalls,
    result.toolCalls
  )
  assert.ok(!JSON.stringify(result.toolCalls).includes("search_players"))
  const replay = await sendStreamingTradeMessage(input, () => {}, {
    api: "https://gambit.local/api/trade-chat",
    fetch: async () => tradeChatStreamResponse(input, catalogue, { model }),
  })
  assert.deepEqual(replay.toolCalls, result.toolCalls)
  assert.equal(replay.workDurationMs, result.workDurationMs)
  assert.equal(getSession(input.sessionId).messages.length, 2)
})

test("the real ADK and OpenAI adapters carry tool results into a continuation and stop at the clarification", async () => {
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade Nick for Andrew.",
  }
  const playerIds = catalogue.players
    .filter((player) =>
      ["Andrew Wiggins", "Andrew Nembhard"].includes(player.name)
    )
    .map((player) => player.id)
  const decodeRequest = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        previous_response_id: Schema.optional(Schema.String),
        instructions: Schema.String,
        input: Schema.Array(Schema.Unknown),
        tools: Schema.Array(
          Schema.Struct({
            name: Schema.String,
            parameters: Schema.Record(Schema.String, Schema.Unknown),
          })
        ),
      })
    )
  )
  let requests = 0
  const model = new OpenAIAdkModel({
    model: "local-integration-model",
    apiKey: "test-key",
    fetchRequest: async (_url, init) => {
      assert.equal(typeof init?.body, "string")
      const body = decodeRequest(init?.body)
      requests++
      assert.ok(body.instructions.includes("trade"))
      assert.equal(
        body.tools.find((tool) => tool.name === "search_players")?.parameters
          .type,
        "object"
      )
      if (requests === 1) {
        assert.equal(body.previous_response_id, undefined)
        assert.deepEqual(body.input, [{ role: "user", content: input.message }])
      } else {
        assert.equal(
          requests,
          2,
          "The finishing tool must not trigger another model call"
        )
        assert.equal(body.previous_response_id, "response-1")
        const outputs = Schema.decodeUnknownSync(
          Schema.Array(
            Schema.Struct({
              type: Schema.Literal("function_call_output"),
              call_id: Schema.String,
              output: Schema.String,
            })
          )
        )(body.input)
        assert.equal(outputs.length, 1)
        assert.equal(outputs[0].call_id, "call-1")
        assert.ok(outputs[0].output.includes("Andrew Wiggins"))
      }
      return Response.json({
        id: `response-${requests}`,
        object: "response",
        status: "completed",
        created_at: 1,
        model: "local-integration-model",
        output: [
          {
            type: "function_call",
            id: `fc-${requests}`,
            call_id: `call-${requests}`,
            name: requests === 1 ? "search_players" : "ask_question",
            arguments: JSON.stringify(
              requests === 1
                ? {
                    identities: [
                      { query: "Andrew", candidatePlayerIds: playerIds },
                    ],
                    teamId: null,
                  }
                : questionInput("Which Andrew do you want?", playerIds)
            ),
          },
        ],
      })
    },
  })
  const result = await sendStreamingTradeMessage(input, () => {}, {
    api: "https://gambit.local/api/trade-chat",
    fetch: async () => tradeChatStreamResponse(input, catalogue, { model }),
  })
  assert.equal(result.status, "needs_clarification")
  assert.equal(result.message, "Which Andrew do you want?")
  assert.equal(requests, 2)
  assert.equal(getSession(input.sessionId).messages.length, 2)
  assert.deepEqual(
    result.toolCalls?.map((call) => call.state),
    ["complete", "complete"]
  )
})

test("failed tool operations are recorded as failures without exposing their technical errors", async () => {
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade Andrew.",
  }
  const response = tradeChatStreamResponse(input, catalogue, {
    model: mockModel([
      [
        [
          "search_players",
          {
            identities: [{ query: "Andrew", candidatePlayerIds: [9999] }],
            teamId: null,
          },
        ],
      ],
      [["ask_question", questionInput("Which player do you mean?")]],
    ]),
  })
  const result = await sendStreamingTradeMessage(input, () => {}, {
    api: "https://gambit.local/api/trade-chat",
    fetch: async () => response,
  })
  assert.equal(result.toolCalls?.[0].state, "error")
  assert.match(result.toolCalls[0].label, /couldn’t finish/)
  assert.ok(!JSON.stringify(result.toolCalls).includes("9999"))
})

test("malformed provider calls cannot execute an ADK finishing tool or publish a clarification", async () => {
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade Andrew.",
  }
  let requests = 0
  const model = new OpenAIAdkModel({
    model: "local-integration-model",
    apiKey: "test-key",
    fetchRequest: async () => {
      requests++
      return Response.json({
        id: "response-malformed",
        status: "completed",
        output: [
          {
            type: "function_call",
            name: "ask_question",
            arguments: JSON.stringify(
              questionInput("This question must not be published")
            ),
            // A valid provider call needs its matching call_id.
          },
        ],
      })
    },
  })
  const result = await sendStreamingTradeMessage(
    input,
    () => assert.fail("The malformed call must not execute"),
    {
      api: "https://gambit.local/api/trade-chat",
      fetch: async () =>
        tradeChatStreamResponse(input, catalogue, { model, onError: () => {} }),
    }
  )
  assert.equal(result.status, "error")
  assert.equal(result.clarification, undefined)
  assert.equal(result.snapshot, null)
  assert.equal(requests, 1, "Malformed responses are not retried")
  assert.doesNotMatch(result.message, /must not be published|call_id/)
  assert.equal(getSession(input.sessionId).records?.questions.length, 0)
})
