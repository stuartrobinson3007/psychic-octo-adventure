> Historical investigation. Superseded by [trade idea selection](../trade-ideas.md).

# Persistent exhaustive search

Implemented 9 October 2026. The investigation remains a record of the old limits and the reasoning behind this change.

## What changed

Discovery now declares a finite space of all supported eligible two-team packages, with one to three players on each side. Partner traversal is interleaved; salary proximity orders incoming packages without discarding any. The cursor addresses a combination directly, so a later invocation resumes without regenerating and checking the preceding pairs. The previous 18-check, 50,000-combination and three-result stopping rules are gone.

Repair and replacement use the same runner and evidence checks. Their scope remains one-player additions or one unpinned same-team replacement, across the original participating teams (up to four). A targeted replacement preserves every other asset, destination, signing, exception and salary override. Payroll filtering now uses the effective scenario payroll used by the validator.

Search state distinguishes considered combinations, locally filtered combinations, conclusive checks, passing results and unresolved checks. Completion requires reaching the end with no unresolved checks. A service failure is not a negative rules verdict. Recognized signing/pick rule rejections carry typed evidence; incomplete signing evidence does not count as fully valid. A catalogue fingerprint change stops the run rather than mixing different roster facts.

Passing results are saved in ordinal rows, outside the conversation. Showing three options is a page operation, not a search budget. Each displayed batch remains immutable, including when the user refers to its middle option after a later edit or page. Refining a search creates another version; the previous run and its displayed history remain identifiable. Superseded work is cancelled at commit. Normal chat can stop or resume a specific run.

## Storage and scheduling

The accepted chat response and its search/control intents commit in one SQLite transaction. A failed turn never starts an orphaned job. Result pages and cursor updates also commit together. Delivery is idempotent; leases reject stale in-flight writes after cancellation or another owner has taken over.

Local development runs a bounded scheduler backed by SQLite. A process restart reopens due work. Cloudflare uses the existing browser's Durable Object and durable alarms, so a closed browser does not stop the search. Each invocation advances a bounded slice; its time/CPU budget does not become a search-coverage limit. Local validation calls share three slots per process. Cloudflare also reserves batches through the shared usage guard, with two 20-second batch leases and a shared daily budget. Unavailable checks back off and pause after three failed attempts; retry retains the cursor and successful evidence.

Validation cache identity includes the pinned data timestamp/fingerprint and every proposal setting, excluding generated proposal IDs, revision/creation timestamps and ancestry. It does not confuse different hypothetical salaries or signing terms. Cache evidence retains its validation time, and is rebound only to an equivalent generated proposal identity. Cached facts have a one-day retention period.

Progress reads use compact state, not entire catalogues or result pools. The conversation's semantic version does not change on each progress tick. Large conversation payloads are chunked into bounded SQL rows, preserving Unicode boundaries, so showing many result pages does not exceed Cloudflare's per-row limit.

## Chat behaviour

The composer becomes available after the initial response while the search continues. Progress updates the original reply. If no first page was ready initially, the first three checked options appear there when available; they do not create a new assistant turn or steal a pending identity question. A later successful turn commits that projected page into its original transcript position. Polling preserves expanded cards and draft/selection state. The live review playground retains its isolated conversation ID across reloads.

The progress display separates filtered combinations from actual rule checks, exposes search scope, and explains saved progress/recovery. There is no mandatory Continue, Check trade or Needs review workflow. Numeric follow-ups inherit the relevant constraint's unit and meaning from the referenced search, rather than asking implausible age questions in a salary-budget discussion.

## Evidence

No unit tests were added. Opt-in integration scripts exercise the real catalogue/validator/model and durable storage:

- [exhaustive-search-e2e.json](evidence/exhaustive-search-e2e.json): all 6,735 Bulls pairs considered, all 160 matching packages conclusively checked, no passing result; restart recovery; all 224 Boston–Miami pairs checked with 62 passing results; non-repeating pages; traversal past 50,000 combinations; service outage/retry; scenario payroll and fixed replacement routes; live historical references.
- [search-conversation-e2e.json](evidence/search-conversation-e2e.json): an initial validator outage followed by real recovery, unrelated research, another open identity question during completion, delayed first-page retention, later pages, search refinement and cancellation/resumption.
- [search-storage-e2e.json](evidence/search-storage-e2e.json): a six-megabyte Unicode conversation, transaction rollback on failed intent publication, stale cancellation writes, duplicate delivery and database reopen.
- [cloudflare-search-runtime.json](evidence/cloudflare-search-runtime.json): shipped Worker instantiated in Miniflare, global search leases, authentication isolation, large Unicode history in the production Durable Object store, and a real scheduled alarm detecting stale data without a browser request.
- [search-browser-recovery.json](evidence/search-browser-recovery.json): a live 10,920-combination search survives browser refresh, retains proposal ordering and stops through normal chat.
- [financial-discovery-e2e.json](evidence/financial-discovery-e2e.json): refreshed screenshot scenario and a salary-budget refinement interpreted from context.

The atlas has 206 scenarios and 2,020 current live views. All 76 changed journey/lifecycle views have fresh, verified frozen screenshots and DOM snapshots across mobile, tablet, laptop and desktop. Desktop/mobile proof screenshots are in `docs/evidence/exhaustive-search-{desktop,mobile}.jpg`.

The atlas includes these recorded chat journeys and authored running/completed/paused/cancelled/stale checkpoints. Recordings now retain the actual conversation view, including background changes to earlier replies. `--settle-searches` optionally records the settled view. Older unrelated recordings retain their original backend evidence; a current live UI render is not a claim that every older model transcript was rerun.

## Deliberate limits

Exhaustive means complete within the declared finite scope, using supported eligible players and available evidence. Discovery does not automatically enumerate three/four-team trade graphs, picks, rights or new signing terms. Those assets/settings remain fixed where supported by repair/replacement. Discovery is not a team-fit or trade-value evaluator.

Large spaces can take a long time against the existing remote validator and shared service budget. An upstream batch/versioned engine would improve this substantially. The upstream service still supplies no atomic roster/rules version or capacity agreement. We detect changes in locally fetched facts and validate exact proposal evidence; we do not claim universal NBA legality or an atomic upstream snapshot.
