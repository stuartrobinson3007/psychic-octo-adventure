# Tool progress in chat

Chat submissions use `/api/trade-chat`. The route validates the same input as
the existing server function and runs the same conversation lock, version checks,
clarification reconciliation, tool loop and staged commit logic.

The AI SDK's `onToolExecutionStart` and `onToolExecutionEnd` callbacks emit action
updates through `createUIMessageStream`. The client uses `DefaultChatTransport`
and `readUIMessageStream` for transport, framing and data-part updates. This
streams tool progress while the agent runs; the final text remains the backend's
validated response rather than unused model prose.

Each call has a stable ID and a friendly label. Running labels use the present
participle ("Searching for Andrew…"); completed labels use the past tense
("Searched for Andrew"). Failed calls say they couldn’t finish. Raw arguments,
outputs and function names are not sent in progress events.

The chat shows one substantive unfinished action in call order, including when the SDK
dispatches multiple tools in one step. Between calls it retains the most recent
completed action. Routine interpretation, answer reconciliation, draft assembly
and reply preparation are hidden. Player/team lookups, trade checks and searches
for alternatives remain visible. Once the turn finishes, useful actions appear in
a collapsed accordion aligned with and placed above the assistant's text, alerts
and trade cards. Multi-card replies attach one history to their first card. Its trigger says "Worked
for 12s" or "Worked for 1m 8s", using elapsed time across the whole backend turn,
including model and tool calls. Older recorded histories without timing say
"Work details". Histories and durations are stored with the assistant's
conversation message and included in review recordings when present. Older
messages without recorded calls do not acquire an invented history.

The clarification question stays in the option widget header. While the picker
is open and unanswered, the chat displays a temporary “Waiting for your answer…”
status. Choosing an option hides it; clearing the choice restores it. Submitting
a selected or typed answer reveals the question as an assistant message in its
original position, below its work history and above the user's reply. This also
applies during the next busy turn and when loading saved conversations. The
original question remains in server conversation history for context; the
temporary status is never stored as a message.

The selection-replies review preview includes a replay control for inspecting
the progress and finished states without a model request. The SDK transport tests
exercise real tool callbacks using a mock model, verify that progress arrives
before completion, check friendly failure history, and ensure request retries do
not duplicate messages or histories.

Provider failures are classified separately from trade results. Exhausted API
credits and authentication failures explain that the service connection needs
attention and are not retried. Temporary rate limits retain the SDK retry
behavior. Failed turns preserve the checked trade; provider response bodies,
request content and credentials are never included in user-facing errors or
default diagnostic logs.
