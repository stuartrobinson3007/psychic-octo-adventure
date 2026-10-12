# AI SDK to Google ADK migration

Implementation checkpoint: 12 October 2026. OpenAI remains the model provider,
as requested. Both the backend agent runtime and browser transport now operate
without Vercel AI SDK.

## The layers we changed

| Responsibility                          | Before                                                   | Now                                                      |
| --------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Agent definition and tool loop          | AI SDK `ToolLoopAgent`                                   | ADK `LlmAgent` and `Runner`                              |
| Tool registration                       | AI SDK `tool`                                            | ADK `FunctionTool`, with existing Zod argument schemas   |
| OpenAI requests                         | `@ai-sdk/openai`                                         | Official `openai` client behind an ADK `BaseLlm` adapter |
| Runtime progress                        | AI SDK step/tool callbacks                               | ADK tool callbacks and Runner events                     |
| Browser streaming                       | `ai` UI message streams and `DefaultChatTransport`       | Application-owned, versioned SSE events                  |
| Durable conversation and trade evidence | Application SQLite / Durable Objects                     | Retained                                                 |
| React UI and styling                    | Local React components, Tailwind and shared UI libraries | Retained                                                 |

`ai`, `@ai-sdk/react` and `@ai-sdk/openai` are removed. There is no `useChat`
call in the submission flow: the workspace hook owns React state and calls
`sendStreamingTradeMessage`, which submits JSON and consumes our SSE events.
The local AI Elements components keep their React rendering and styling; their
small presentation types now live in `src/components/ai-elements/types.ts`.

## Trace one turn

1. `/api/trade-chat` validates the request, loads the catalogue, and establishes
   the remaining time budget.
2. `trade-harness.ts` acquires the conversation lease, checks versions and replay,
   creates the turn's staged tools, and supplies instructions and saved history.
3. `adk-trade-agent.ts` constructs an `LlmAgent` and a fresh
   `InMemorySessionService`. Saved user/assistant messages become ADK events.
4. `Runner.runAsync` asks `OpenAIAdkModel` for a response. The adapter converts
   the ADK request into an OpenAI Responses request.
5. OpenAI returns a function call, such as `search_players`. ADK validates its
   arguments and executes the registered tool. Tool callbacks publish the
   existing user-facing progress data.
6. ADK supplies the function result on the next model request. The adapter sends
   it as `function_call_output` with the original `call_id`, using
   `previous_response_id` to continue the response chain. It resends instructions
   and avoids replaying prior tool outputs or flattening reasoning into text.
7. A finishing tool, such as `ask_question` or `finish_response`, marks the turn
   finished. The ADK callback sets `skipSummarization`, avoiding another model
   call after the application has its answer.
8. The application commits the completed domain records and canonical exchange,
   saves the replay result, and streams the reply through our browser event
   contract.

The model requests tools. ADK owns their dispatch and the repeated model calls.
Our domain functions still decide asset ownership, authoritative evidence,
proposal validity and what can be committed.

## Session ownership and bounds

ADK's session is invocation-local. It does not replace the durable application
conversation or provide resume-from-mid-turn behavior. On each new turn we seed
it with saved canonical text; larger records remain available through retrieval
tools. OpenAI response IDs belong to that invocation's adapter instance and
cannot cross browser conversations.

`GAMBIT_EXECUTION_MODEL` selects the existing model and defaults to
`gpt-6.1-sol`. `OPENAI_API_KEY` stays server-only. There is one main agent loop;
the older `GAMBIT_INTERPRETATION_MODEL` setting is not used by this harness.

The Runner allows at most 18 model calls. The request has a 90-second budget
covering preparation, queueing, authorization and execution. Tool mutations are
serialized; independent reads and selected trade checks retain bounded
concurrency. Provider SDK retries are disabled; the adapter permits up to two
retries of temporary failures and never retries exhausted credits or failed
authentication. Trade-service POST requests have no automatic retries.

Cancellation reaches the provider and tool requests. Stream disconnection does
not save a partial turn. The conversation lease remains held while outstanding
native work drains, so late completion cannot mutate the next turn's state.
Durable Object RPC and synchronous SQL cannot be made preemptible by an adapter.

## Verification

- Both application and Cloudflare typechecks pass.
- All 33 local integration checks pass, including the real ADK/OpenAI adapter
  continuation, progress-before-completion, terminal tool stopping, replay,
  exhausted-credit handling and stream cancellation. Transport checks also cover
  fragmented UTF-8, browser cancellation, malformed or truncated replies,
  mismatched request IDs, unsupported versions, oversized events and malformed
  provider calls being rejected before tool execution.
- Storage checks cover failed outside-turn saves, release faults, queued cancellation, late native work,
  SQLite reopening and browser isolation. HTTP checks cover response decoding,
  preserved POST rule evidence, rejected-header/stalled-body cleanup and shared catalogue cancellation.
- The Cloudflare build passes. `node scripts/check-adk-worker.mjs` exercises
  password login, a real Worker/Durable Object chat route, ADK, the OpenAI SDK,
  progress streaming, durable commit, replay and concurrent browser isolation
  with locally injected outbound responses. `node scripts/check-cloudflare-limits.mjs` checks local limits.
- No live model requests or deployment were performed. These checks verify the
  integration and mechanics; they do not establish live model quality across
  every historical conversation.

To reproduce the platform check:

```sh
npm run test:adk-worker
```

## Browser event contract

The endpoint remains `POST /api/trade-chat`, with the same `ChatTurnInput` body.
It returns `text/event-stream`; each SSE `data:` field holds a JSON object with
`version: 1`, the submitted `requestId`, and one of four event types:

| Event      | Payload                  | Meaning                                                           |
| ---------- | ------------------------ | ----------------------------------------------------------------- |
| `start`    | Envelope only            | The request's stream has started.                                 |
| `activity` | `activity: ToolActivity` | Insert or update tool progress by its call ID.                    |
| `result`   | `result: ChatTurnResult` | The terminal, committed reply, including cards and clarification. |
| `error`    | A fixed public message   | The stream cannot deliver a completed reply.                      |

For example, a tool update is framed as:

```text
data: {"version":1,"requestId":"example-request","type":"activity","activity":{"id":"call-1","label":"Searching for Andrew…","state":"running"}}

```

A blank line terminates the SSE event. Network chunks may split anywhere,
including within a UTF-8 character; the client decodes the stream before parsing
frames and validating their JSON values. It requires one start event, matching
request identity, supported version and one terminal reply. EOF alone is not
success. Events after a terminal reply are rejected. Pending events are bounded
to 2,097,152 decoded string code units and the browser request has a 95-second deadline.

Tool progress streams while ADK works; final text, cards and clarification arrive
in the completed domain reply, preserving the previous product behavior. This
is not a token-by-token model text stream. ADK Runner events are translated at
the server rather than exposed as the browser's state model.

The application owns this contract, stream lifecycle and React state. OpenAI
continues to own model responses; ADK owns the repeated model/tool loop. Changing
one of those layers no longer requires adopting another framework's chat hook.

Relevant code: `src/server/adk-trade-agent.ts`,
`src/server/openai-adk-model.ts`, `src/server/trade-function-tool.ts`,
`src/server/trade-harness.ts`, and the two `trade-chat-stream.ts` adapters.

References checked against the installed ADK 2.2.1 and OpenAI 7.32.0 source:
[ADK TypeScript](https://adk.dev/get-started/typescript/),
[ADK OpenAI integration](https://adk.dev/agents/models/openai/), and
[OpenAI reasoning continuation](https://developers.openai.com/api/docs/guides/reasoning).
