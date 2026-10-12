# Effect v4 adoption audit

Initial audit: 9 October 2026. The initial findings below describe that historical
working tree. Implementation checkpoints at the end record subsequent adoption;
the latest is 12 October 2026.

## Finding

**Effect is installed but unused.** `package.json` declares `effect: ^4.0.1`; the installed package reports `4.0.1`. Repository searches found no Effect imports, Effect programs, services, Layers, runtime bridges, or Effect-based tests in application source, scripts or configuration. The only direct project reference found outside the lockfile and this new guidance/report was the dependency declaration.

There are no application `@effect/*` dependencies to consolidate or align, and no existing v3 APIs to migrate. Consequently, a successful typecheck establishes that the application compiles, not that it follows Effect v4 practices. The v3-to-v4 skill's API migration workflow does not apply to unused dependencies. No version changes, v3 compatibility code, API replacements, or reference-repository clones were necessary for this audit.

The installed package's `AGENTS.md` was read completely. Its linked guides and source were consulted for Effect construction, services, typed errors, Schema decoding, resource management, HTTP clients, schedules, runtime integration, caching, semaphores and cancellation. Recommendations below use this installed v4 version as the reference.

## Scope and limits

- Searched application source, scripts and configuration for Effect usage and for I/O, environment access, parsing, Promises, concurrency and time boundaries. Excluded dependencies, generated output, public assets, ignored local databases and secret files.
- Reviewed the chat request route, browser stream helper and workspace hook; harness; turn execution and completion/failure logic; trade API I/O and normalizers; conversation loading, SQL leases, stores and request context; discovery/repair evaluation loops; archive checking; Cloudflare request, authorization and storage boundaries.
- Ran both application typechecks and the complete configured `npm test` suite.
- Reproduced the lease-cleanup failure below in an isolated process with an in-memory database.
- This is not a line-by-line correctness proof for every UI component, script or domain calculation. The absence of Effect was checked across the project; detailed behavioral review concentrated on the critical boundaries above. No live model calls, deployment or production changes were performed.

## Confirmed cleanup bug

At `src/server/trade-session.ts:109–113`, the `finally` block calls database lease release **before** resolving the local lock promise and removing its map entry. If release throws, both local cleanup operations are skipped. A subsequent request for the same conversation waits indefinitely on the unresolved promise, even after the database fault is gone. The release failure can also replace an earlier operation failure.

An isolated reproduction replaced the in-memory store's `release` method with a throwing implementation, asserted that the first request rejected, restored the implementation, then observed that a second request stayed pending. This confirms the failure path without relying on a production storage fault. The injected failure does not establish its frequency in production.

The immediate correction is to make local cleanup independent of SQL release success. Under Effect, model local permit ownership and the database lease as separately finalized resources, and retain cleanup failures diagnostically. An in-process semaphore does not replace the database lease, optimistic version checks, browser namespace or replay protection.

## Adoption coverage matrix

| Boundary | Current implementation | Consistent Effect v4 target | Priority |
| --- | --- | --- | --- |
| External trade HTTP | `trade-api.ts`: native `fetch`, per-call abort timers, generic thrown errors | A `Context.Service` with a Layer using `effect/http`'s fetch-backed client, typed network/status/decode failures, schema-decoded responses and bounded retry policy | First |
| Untrusted requests and archives | `trade-functions.ts`, `proposal-archive.ts`, reference parsers: manual checks plus Zod | Shared `Schema` contracts with Effect-returning decoding inside services; thin framework adapters decode at the edge | First |
| Persisted conversations | `trade-session.ts:35–50`: `JSON.parse` and spreading persisted properties into a typed session | Decode and migrate a versioned persisted schema; retain old-history compatibility deliberately and reject corrupt records explicitly | First |
| Conversation storage | `conversation-store.ts`, `conversation-sql.ts`: lazy Node database singleton and synchronous throwing SQL methods | A storage service with Node and Durable Object implementations; use `Effect.try` for expected throwing operations; scoped ownership for the Node connection | First |
| Conversation locks and leases | `trade-session.ts:80–114`: promise chain, mutable maps, manual lease lifecycle | Per-conversation local permits plus separately scoped SQL lease finalizers, typed busy/conflict errors, cancellation while waiting | First |
| Chat orchestration | `trade-harness.ts`: native Promise operation and late-created 90-second abort signal | A traced Effect service orchestrating authorization, runtime invocation and commit; request cancellation/deadline composed at the entry boundary | First |
| Agent integration | AI SDK loop now; ADK migration planned | ADK owns the model/tool loop; Effect owns surrounding services and lifecycle. Wrap the actual ADK Promise/async-iterable boundaries and pass cancellation through supported APIs | During ADK migration |
| Tool operations | `conversation-turn.ts`: serialized Promise queue and catch-to-error conversion | Effect-backed operations with explicit expected tool errors, interruption and defects; preserve existing staging, evidence and commit behavior | During ADK migration |
| Browser streaming | `trade-chat-stream.ts` on server and in `lib`: SDK framing/reader and callbacks | Keep framework/protocol adapters thin. Scope any Effect-owned producer, subscription or stream; connect disconnects to interruption | During transport migration |
| Catalogue cache | `trade-api.ts:24–25,163–214`: module-level value and shared pending Promise | A service-owned cache with explicit TTL, refresh semantics, sharing and ownership of cancellation; inject it in tests | Next |
| Searches and archive checks | discovery, repair and conversation-checks: manual batches of 3/4, Promise races and abort listeners | Bounded Effect concurrency, one operation budget, typed per-candidate outcomes and safe scoped interruption | Next |
| Authorization and tenant context | `conversation-context.ts`, `cloud-conversation-store.ts`, `cloudflare.ts`: AsyncLocalStorage and native RPC | Explicit request-scoped services for verified browser identity/store/authorization; adapt Cloudflare APIs at the edge | Next |
| Configuration/secrets | `process.env` in harness/store; Cloudflare environment bindings | Config-backed Layers and redacted secret values where appropriate; retain native platform binding adapters | Next |
| Time | native `Date.now`, `new Date`, `performance.now` across caches, leases and budgets | Clock/DateTime for application time and testable TTL/deadline behavior; retain platform-required raw representations at adapters | Next |
| Observability | `console.debug`/`console.warn` and custom tool evidence | Effect logging and named `Effect.fn` spans around meaningful operations, with request/tenant identifiers and safe cause logging; preserve the business audit trail | Next |
| Tests | Node test runner, patched globals and manually supplied dependencies | Test services/Layers, injectable clock and deliberate interruption/cleanup tests. Node tests can bridge Effect at the test boundary; adopting a different runner is a separate choice | With each service |
| Operational scripts | imperative CLI, filesystem, process and HTTP code | Convert substantial maintained workflows if they become part of the Effect application; small smoke scripts do not justify a universal rewrite | Lower |
| React rendering and pure calculations | JSX, state setters, salary/route computations and presentation helpers | Keep ordinary React and pure functions. Effect belongs around effects and validated boundaries, not around every expression | Keep |

Priorities express architectural value, not proof that every native implementation is defective. Several existing protections are useful and must survive adoption.

## Specific consistency gaps

### Expected failures, interruption and defects are mixed

`trade-api.ts` throws generic `Error`s for network, service-shape and evidence problems, then `evaluateProposal` catches all exceptions and emits `validation_unavailable`. Discovery/repair similarly convert broad catches into unavailable outcomes. `conversation-turn.ts:101–133` catches arbitrary operation errors and makes them tool results. This preserves a conservative user-visible result, but does not provide a typed distinction between expected upstream failure and an application defect.

Represent expected transport/decode/validation problems with tagged errors. Preserve the distinction between a business verdict such as `invalid_trade`, a recoverable service failure, cancellation, and a programming defect. Keep the safe public copy while recording detailed causes server-side. Do not add a blanket catch that turns every defect into an ordinary tool result.

### There is no single end-to-end request budget

The chat route loads the catalogue before invoking the harness. The harness waits for the session lock and performs authorization before constructing its turn abort signal. `withSessionLock` has no cancellation argument while waiting. The browser transport currently sends `abortSignal: undefined`.

The current 90-second bound therefore covers a portion of the operation, not the full request including catalogue loading, queueing and authorization. Establish the budget at the request boundary, forward interruption to interruptible dependencies and waiting, and specify which shared cached work may legitimately outlive an individual requester.

Wrapping an existing Promise in Effect does not cancel underlying work by itself. `Effect.tryPromise` supplies an AbortSignal; adapters must pass it through when the API supports cancellation. ADK cancellation semantics still require verification against the ADK version selected for migration. Synchronous SQL/native computation is not made preemptible merely by wrapping it.

### Shared work and concurrency ownership are manual

Catalogue loading starts six HTTP calls with `Promise.all`. A required request failure rejects the aggregate without automatically cancelling sibling requests. Two optional resources also collapse both transport and malformed-data failures into `undefined`. A future Effect implementation should retain the intended optional-resource behavior while distinguishing why data is absent.

Discovery and repair each implement their own evaluation deadline adapter and batches of three. Archive repair uses four manually coordinated workers. These are bounded today; the gap is consistent lifecycle/error policy, not absence of every concurrency limit.

Model expected per-candidate unavailability as a value when the batch should continue. Otherwise use failure/interruption to stop related work. Explicitly scope shared catalogue work so one caller disconnecting does not accidentally cancel every other caller's load.

### Storage lifetime and tenant context must stay explicit

The Node conversation database is opened lazily and is normally process-lived. Tests manually close their own stores; application ownership and disposal are not expressed through a resource scope. Cloudflare owns its Durable Object SQLite lifecycle, so the Node connection's disposal strategy must not be copied into that adapter.

The request-scoped store and namespace currently protect browser isolation. A future process-global runtime must never capture one browser's store or authorization and reuse it for other requests. Use shared layers only for genuinely shared dependencies; supply tenant-specific services in a request scope.

### Validation currently has multiple sources

Zod defines tool/search/proposal shapes, manual normalizers parse upstream JSON, manual helpers parse chat input, and persisted conversation loading trusts parsed properties. These are not a coherent Effect Schema boundary.

Create shared domain/wire schemas and preserve existing cross-field and authoritative-data checks. Structural decoding is not a replacement for checking player ownership, current revisions, payroll evidence or allowed transitions. If the chosen ADK version requires Zod for tool registration, derive/adapt that registration boundary deliberately rather than maintaining two independent contracts. Verify supported conversion before implementing it.

### Retries need one deliberate policy per boundary

Trade-service requests currently have deadlines but no application retry schedule. Model-provider retry behavior is SDK-owned; the existing provider adapter deliberately avoids retrying fatal credit/authentication errors. During migration, choose whether ADK/provider code or Effect owns each retry budget, and avoid multiplying retry loops.

Retry only failures and operations that warrant it, with finite attempts, delay/backoff and a total deadline. Do not retry authentication/quota failures, decoding defects, stale revisions or committed mutations as though they were transient network errors. Retain request-ID deduplication and exact-version checks.

## Existing protections to retain

- Database leases and optimistic version checks across processes, plus browser namespace isolation.
- Request-ID replay protection and current-question/revision checks.
- Turn-local staging and explicit commit only after successful completion.
- Verification that model-mentioned assets and engine verdict evidence match the requested domain records.
- Bounded model steps, search shortlists/concurrency and conservative unavailable verdicts.
- Public error copy separated from provider details and fatal-account retry handling.

Effect can organize these guarantees; it does not invent or replace their domain semantics.

## How Effect and ADK fit together

```text
React / TanStack / Cloudflare boundary
  -> Effect program: request scope, decode, authorization, lock, deadline
     -> ADK adapter: agent configuration, model calls and tool loop
        -> tool adapters -> Effect trade/domain/storage services
     -> explicit domain commit and persistence
  -> existing result/stream contract -> React
```

Use `ManagedRuntime` to bridge external framework callbacks into Effect, with lifecycle and request-service ownership appropriate to Node versus Workers. Run Effect at actual framework/SDK boundaries, rather than repeatedly leaving and re-entering it inside domain services. This design does not require adopting Effect's own AI agent modules in addition to ADK.

## Suggested learning sequence

1. Capture the baseline failures and repair the independent lock-cleanup bug. Distinguish those changes from framework adoption.
2. Build one trade HTTP service and one response Schema. Trace `Effect<A, E, R>` as result, expected failure and required services; inject a test HTTP layer.
3. Introduce tagged errors and request/persisted schemas, preserving the current wire/domain behavior.
4. Introduce storage/request services, scoped leases and cancellation; verify local SQLite and Cloudflare browser isolation.
5. Connect ADK to those services through small SDK adapters. Keep the current browser stream while learning agent sessions/events.
6. Consolidate cache/search lifecycle, config, time and observability. Migrate browser transport separately when its replacement contract is understood.

For each stage test observable guarantees: cancellation reaches the adapter; cleanup runs on failure/interruption; optional data failures stay distinguishable; stale writes never commit; duplicate requests are safe; browser identities never share private state. A typecheck alone cannot establish these behaviors.

## Validation results

- `npm run typecheck`: passed.
- `npm run typecheck:cloudflare`: passed.
- `npm test`: **115 tests; 98 passed; 17 failed; no skipped or cancelled tests**. Run against the unchanged application implementation.
- Failures cover clarification/receipt behavior, copy/review fixtures, persisted selection state, engine-verdict expectations and two stream/tool-progress cases. These require separate diagnosis; they cannot be attributed to an Effect migration that has not happened.
- Full captured test output: `docs/evidence/effect-audit-tests-2026-10-09.txt`.
- Isolated injected database-release failure: reproduced the unresolved local lock.
- Application/API replacements constructed: **none**. No application casts, compatibility shims or test weakening were introduced.
- Documentation changes: this report and the Effect reading requirement in project `AGENTS.md`.

## Version-matched references

- `node_modules/effect/AGENTS.md`.
- `node_modules/effect/ai-docs/src/04_integration/10_managed-runtime.ts`.
- `node_modules/effect/ai-docs/src/50_http-client/10_basics.ts`.
- `node_modules/effect/ai-docs/src/01_effect/02_schema/10_schema-basics.ts`.
- `node_modules/effect/ai-docs/src/01_effect/01_basics/10_creating-effects.ts`.
- `node_modules/effect/ai-docs/src/01_effect/05_resources/10_acquire-release.ts`.
- `node_modules/effect/ai-docs/src/06_schedule/10_schedules.ts`.
- Cancellation/runtime and concurrency/cache definitions in `node_modules/effect/src/Effect.ts`, `ManagedRuntime.ts`, `Semaphore.ts`, `Cache.ts` and `Schema.ts`.

## Learning exercise: first adoption step, 12 October 2026

The original findings and test counts above remain the 9 October snapshot. The project now uses Effect for shared trade-service GET requests through `src/server/trade-service-http.ts`.

`readTradeServiceJson` returns `Effect<unknown, TradeServiceRequestError, HttpClient.HttpClient>`. It describes a lazy HTTP program with a client dependency, non-2xx rejection, JSON decoding, a 12-second deadline, and a typed error retaining the underlying cause. The existing Promise-returning `get` function supplies the fetch-backed HTTP Layer and platform fetch explicitly, then runs the program with the caller's AbortSignal. Explicit fetch provision avoids the HTTP reference's cached default retaining an earlier injected test transport.

This is an incremental transport boundary, not complete adoption: response shapes still use existing normalizers, POST requests are unchanged, and the Promise bridge remains inside the existing imperative trade API. The next learning step is Schema decoding and moving domain operations into Effect so the typed error/dependency channels remain visible farther up the application.

Verification: both typechecks passed; all 13 current local integration tests passed, including four new contract-service boundary checks for successful retrieval, non-2xx failure, malformed JSON and cancellation reaching fetch. The test suite was reorganized before this step, so its current counts are not comparable to the historical 115-test audit. A locally injected transport also confirmed zero requests when constructing the Effect and one when running it. No live network/model requests were made.

### Second step: schema-validated contract options

`src/server/contract-options.ts` now defines the upstream contract-options response with Effect Schema. Finite numeric fields preserve the existing numeric checks; nested tiers are validated; optional string fields distinguish an omitted key from an explicit null. Extra service fields remain tolerated. The decoded response's player identity is still checked against the requested player, because a structurally valid response alone does not establish matching evidence.

`readContractOptions` is an Effect operation returning `ContractOptions`, with expected failures `TradeServiceRequestError | InvalidContractOptionsError` and an HTTP-client dependency. It retrieves JSON, decodes the schema, verifies identity, then performs the existing funding-route transformation. The public `contractOptions` function remains a Promise bridge for existing callers; its type is re-exported from `trade-api.ts` to preserve imports. Both legacy GET callers and contract retrieval share the HTTP runtime bridge.

The general JSON reader still returns `unknown` for endpoints not yet migrated. Contract-options input/response validation does not replace the model-tool Zod schemas, catalogue authorization checks, or engine verdict checks. No coercion of numeric strings is performed. `Schema.optionalKey` is the installed v4 API for exact optional keys; `Schema.NullOr` independently permits null values.

Verification: seven focused HTTP/domain integration tests and both typechecks passed. The checks cover funding routes, optional/null fields and extra service data, malformed contract field types/missing fields, mismatched player identity, HTTP failures, invalid JSON and cancellation. No live network/model requests were made.

### Third step: application service, Layer and managed runtime

`src/server/trade-service.ts` defines `TradeService` with v4 `Context.Service`. Its methods describe the current contract-options operation and transitional generic JSON reads. `TradeService.layer` acquires an HTTP client during construction and provides that client to the existing Effect operations, so callers require the domain service rather than the HTTP implementation.

`src/server/trade-runtime.ts` composes the service Layer with `FetchHttpClient.layer` and an explicitly supplied fetch implementation. `createTradeRuntime` creates an independent `ManagedRuntime`; its services build lazily and are reused across calls. The application adapter uses a lazy shared runtime. The public `get` and `contractOptions` Promise boundaries call `TradeService.use` through that runtime and forward cancellation. Tests may supply their own runtime at those boundaries.

The shared runtime currently contains only the stateless service and HTTP client. Browser identity, conversation state and tenant storage are not captured by it. Test runtimes are disposed in finalizers; the application exposes disposal and recreates the shared runtime after disposal, and disposes it on Vite module replacement. No database connections or background tasks have been added to this runtime. Resourceful or tenant-specific Layers need appropriate ownership when introduced later.

The HTTP integration checks now inject a transport into a dedicated runtime instead of modifying global fetch. Eight focused checks and both typechecks passed, including concurrent independent runtimes and repeated operations using the same runtime. This verifies the service graph while retaining response validation, funding routes, typed failures and cancellation. No live network/model requests were made.

### Adoption checkpoint alongside ADK, 12 October 2026

The current implementation extends adoption across the critical application
boundaries. This replaces the initial audit's “installed but unused” condition;
the historical matrix and baseline counts above are retained as evidence.

| Boundary | Implemented replacement |
| --- | --- |
| Trade HTTP | `TradeService` owns GET, POST and contract options through `effect/http`. All calls have bounded deadlines and retain safe tagged failures and underlying causes. POST preserves HTTP status and recognized business-rule evidence, without automatic retries. |
| Catalogue | Bounded `Effect.all` fetches, schema-backed normalization, `DateTime` timestamp, typed optional-resource recovery and per-runtime `cachedInvalidateWithTTL`; failures have zero TTL. Subscriber cancellation is shared deliberately. |
| Persisted and wire values | Shared roster/proposal/chat/record schemas checked against the domain interfaces. Persisted conversations and retained catalogues are decoded; chat input and streamed activity/results are validated at their boundaries. Existing semantic ownership/evidence guards remain. |
| Local database lifetime | A Config-backed `LocalConversationDatabase` Layer uses `acquireRelease`, held by a ManagedRuntime, with explicit disposal and Vite cleanup. Constructor failure closes the native connection. Cloudflare continues to own Durable Object SQLite. |
| Request storage and authorization | `ConversationStorage.layer` captures the current request's store, namespace and authorization function. It is supplied per turn and never put in the shared HTTP runtime. Claim/save timestamps use Clock. |
| Locks and leases | Semaphore permits, lock-map references, active cache state and SQL leases have independent scoped cleanup. A release defect cannot strand the local permit. Failed/cancelled turns invalidate cached session state. Outstanding native operation work drains before lease release. |
| Request orchestration | The route sets a 90-second preparation budget and passes its remaining time to the conversation turn; queueing and authorization are inside that turn's deadline. Root cancellation reaches queued waits, ADK, provider calls and trade requests. |
| Agent and provider | Runner's async iterable is consumed through Effect Stream. The OpenAI adapter owns an explicit bounded retry Schedule and disables SDK retries; fatal quota/auth failures never retry. Secrets use Config.Redacted. |
| Tool execution | Semaphore serialization and named expected domain/service errors replace broad tool catch-to-result behavior. Unexpected errors become defects. Selected proposal checks and independent team reads use bounded `Effect.forEach`. |
| Archive checks | A single 45-second Effect budget covers catalogue retrieval and bounded checks; timeout produces unavailable evidence for unfinished checks. Interruption propagates and never becomes an illegal verdict. |
| Browser stream | Scoped cancellation, decoded activity/results and request interruption; React unmount cancels the pending request. The native response adapter connects reader cancellation to the running turn. |
| Observability | Named operations and spans around HTTP/storage/client boundaries; safe structured warning logs for optional resources and chat failure, with request identity and failure category. Business execution records and user-facing progress remain separate. |

Native React rendering, pure domain algorithms, Web Crypto, framework handlers,
Durable Object RPC and the existing platform SQL driver remain adapters or pure
code. Effect does not make synchronous SQL preemptible or cancel a Durable
Object RPC that has no cancellation API. The native operation drain preserves
lease ownership in those cases. SQL connection/runtime disposal should occur as
part of application lifecycle cleanup; it is not a per-request action.

ADK's tool registration requires Zod in this version. That supported SDK boundary
retains the existing parameter schemas, with original JSON Schema retained by
`TradeFunctionTool` for OpenAI. It is distinct from the shared persisted/wire
schemas and does not replace semantic trade checks. Legacy archive migrations
and small operational scripts remain ordinary native adapters. No v3 APIs or
compatibility layer were introduced; no Effect package upgrade was required.

Verification: both typechecks and 27 offline integration checks passed; targeted
lint passed. Cloudflare build and local Worker checks cover usage limits and an
authenticated chat through ADK/OpenAI, progress, durable persistence and replay.
Focused lifecycle checks cover release failure, queued cancellation and late
native work. HTTP checks cover POST evidence and both individual/all-subscriber
cache cancellation. No live model request or deployment was performed.

These are verified coverage statements, not a proof that every source line or
every possible failure is correct. The original initial test failures were not
“fixed” by weakening tests; the test suite was independently reorganized before
these changes, as recorded in `docs/testing.md`.

### Browser transport and cache checkpoint, 12 October 2026

The retained AI SDK transport has now been replaced. `TradeChatClient` is a
request-local service Layer backed by `effect/http`; scoped HTTP lifetime covers
the body reader as well as the initial fetch. The consumer decodes UTF-8, uses
the installed v4 SSE decoder and validates a shared versioned event Schema.
It rejects unexpected content types, mismatched request identity, unsupported
versions, invalid ordering, malformed/missing results and oversized events.
Its bounded request and expected failures retain one safe public error type.

The server bridges ADK progress callbacks into a Queue and Stream, validates
outgoing events and exposes a native ReadableStream. The producer has its own
scope: interruption aborts the native turn before its drain finalizer waits.
Queue completion is finalized independently. This ownership order was checked
through both direct reader cancellation and cancellation by the browser client.

The browser's cached workspace now uses a schema-backed JSON codec for both
legacy version 1 and current version 2, including cached entries, trade records,
bookmarks and focus. Read/write effects retain typed storage/decode failures;
React catches them at its UI boundary. Received conversation views are decoded
before applying them to state. Initial loading is an owned, bounded Fiber with
server-function cancellation signals and cleanup on unmount/reload; stale work
cannot import into a newly selected conversation. Model availability also reads
Config's optional redacted credential rather than directly inspecting env data.

Ordinary React state setters, rendering, pure helpers and native framework/SQL/
Web Crypto implementations remain appropriate adapters. These changes extend
the audited critical boundaries; they do not assert a correctness proof for all
source code. No v3 compatibility facade, invented v4 API or casts to silence
migration errors were introduced.

Verification for this checkpoint: both typechecks, 31 offline integration checks,
targeted lint, Cloudflare build and the authenticated local Worker chat journey.
The extra stream checks cover fragmented Unicode, interrupted data, invalid
events and browser cancellation. No live model calls or deployment were made.

Provider responses are now decoded before exposing function calls to ADK: valid
completed response identity, supported output variants, nonempty call identity
and JSON object arguments are required. Unavailable tool names are rejected
and schema failures are outside the retry schedule. Nullable provider error
fields preserve fatal quota classification. The request's native platform
context is restored explicitly for conversation loading and operation callbacks,
including after queued waits. The local Worker journey checks concurrent
visitors with colliding conversation/request IDs and independent replay.


### Remaining request and persistence boundaries, 12 October 2026

The follow-up audit found and closed gaps beyond the streamed chat request:

- Browser recovery, trade checking, search refresh and search paging now run as
  owned, bounded Effect requests. Each generated server-function call receives
  its cancellation signal. React cleanup cancels pending actions on unmount or
  conversation reload. Conversation identity is captured before asynchronous
  work, decoded results precede state updates, and interrupted work cannot
  execute later state-update effects. Finalizers avoid updating unmounted UI.
- Catalogue loading and refresh use the same owned lifecycle and decode
  `CatalogueResultSchema`. Trade checks and paging also decode their shared
  snapshot/page schemas. Recovery has its own bounded window within the action
  budget; timeout can trigger recovery while root cancellation propagates.
- Generated server-function handlers forward the incoming Request signal to
  conversation locking and catalogue loading. A trade recheck loads its catalogue
  inside the lock's operation budget. Catalogue handlers recover only named
  expected service/catalogue failures, preserving interruption and defects.
- Saving a reply/snapshot outside an active turn now uses the request-local
  storage service and a scoped lease. Claim, save and release share the existing
  Clock-backed implementation. A failed save invalidates the unsaved session
  cache, releases its lease and permits a subsequent successful durable save.
- Trade HTTP requests explicitly scope the fetch controller through JSON body
  consumption. Rejected response headers and a stalled body both close the
  request; mutation requests remain unretried.

The source inventory includes the native Cloudflare/auth/SQL/ADK adapters,
vendored optional AI Elements media helpers, development review tools and DOM
presentation lifecycles. Keeping those platform implementations or pure
calculations native is deliberate; adoption does not mean replacing every
Promise, timer, state setter, collection or calculation with Effect. Native
synchronous helpers still format metadata and inspect platform timestamps;
application deadlines, retries, shared catalogue TTL and conversation leases
use Effect scheduling/Clock. Native operations without interruption support are
still drained before their turn lease is released.

Verification: both typechecks, targeted lint, all 33 offline integration checks,
Cloudflare build and the authenticated injected Worker journey passed. New
boundary checks exercise failed outside-turn persistence and HTTP cleanup after
rejected headers/stalled JSON. The Worker journey still verifies concurrent
browser isolation and replay. No live provider calls or deployment occurred.

This checkpoint describes the audited application coverage. It does not claim
that adoption or a passing test suite proves every possible execution correct.
