# Testing

Prefer E2E checks of meaningful user journeys. Keep integration coverage where
it verifies a real boundary, such as SQLite persistence, visitor isolation or
the browser stream and ADK/provider adapters. Do not add unit tests, helper-level assertions or tests
that simply reproduce the implementation.

Keep verification proportional to the change. Run the smallest relevant check;
expand only when a failure or unresolved risk warrants it. Routine reversible
edits do not need new tests or repeated full-suite runs. This keeps agent time
and credits focused on shipping useful changes.

## Local integration checks

```sh
npm test
npm run test:deployment
```

`npm test` aliases `test:integration`. The retained checks exercise SQLite
reopening and locks, visitor isolation, conversation selection/reference
round-trips, ADK tool execution, OpenAI continuation, streaming/replay,
quota-error handling, cancellation and shared catalogue loading. Browser
transport checks cover fragmented UTF-8, malformed/truncated streams, request
identity, supported versions and bounded event sizes. The preload
uses an in-memory session database, removes the OpenAI credential and rejects
global fetch requests; service responses are injected locally. These checks
make no paid model calls.

Run one relevant file when investigating a specific boundary:

```sh
node --import ./scripts/integration-test-setup.mjs --test src/server/conversation-store.integration.test.ts
```

`npm run test:cloudflare-limits` builds and checks the local Worker/Durable
Object runtime without calling OpenAI. Use it for changes to deployment limits.

`npm run test:adk-worker` builds and checks the authenticated chat journey in a
real local Worker/Durable Object runtime, including ADK, OpenAI request handling,
progress streaming, durable commit and replay. Its outbound service injects all
external responses locally; it does not call OpenAI or the live trade service.

## E2E checks and review

For UI changes, prefer focused browser journeys using recorded scenarios or
mocked external services. `npm run review:chat` opens the existing recordings
at `/ux-review`; browsing them does not call the model. Inspect only the affected
journey and viewport. Do not refresh or re-record conversations as a routine
validation step.

The `scripts/check-*.mjs` conversational exercises and the recording/refresh
scripts can use the configured model and live validator. Run them only when the
user requests live model verification, and filter to the relevant scenario.
They remain outside `npm test`.

For example, this explicitly live command consumes model credits:

```sh
npm run test:chat:live -- /tmp/gambit-chat-flows.json "scenario name"
```

Historical reports retain their original test counts and evidence. Unit tests
were removed on 12 October 2026; those reports do not describe current coverage.
