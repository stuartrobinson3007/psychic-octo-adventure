# Chat intentions: live end-to-end review

Checked 8 October 2026 using the configured model, real catalogue, salary/roster validator and HTTP/SSE chat endpoint. The intention suite uses isolated conversations and an isolated temporary SQLite database. No unit tests were added or run.

The current defaults are `gpt-6.1-sol` with low reasoning effort for both structured interpretation and the remaining mechanical tool loop. The existing OpenAI credential is reused. Earlier runs against smaller models exposed semantic mistakes that schema validation alone could not prevent.

## Behaviour corrected

- Player edits carry their own target, replacement and destination roles through clarification. Confirmed identities determine the transfer; a mistaken numeric tool argument cannot silently change the other player.
- Ambiguous names require a choice. Selected answers, typed corrections and fresh requests supersede older name bindings. Duplicate full names retain distinct catalogue identities.
- Replacing a team's sole outgoing player moves that team's role to the replacement's owner, including incoming transfers. Other outgoing assets, scenario settings or an explicit instruction to retain the team preserve its participation.
- A single outgoing player or same-team package starts a checked search immediately. Two identified owners exchange their packages without redundant destination questions; unresolved multi-team routes ask for each genuinely missing destination.
- Compound edits preserve unrelated assets and apply all requested removals/replacements before checking the result. Restoration, undo, historical references and candidate selection use the appropriate proposal/version.
- Research detours preserve pending identity questions. Natural responses such as “the second one” and “go with the first one” select the offered candidate.
- Exception source names identify exceptions rather than transferred players. Contract resets do not imply player removal.
- Shorthand replacements are scoped to an existing asset. “Swap derrick for steph curry” after White/Wiggins produces Curry/Wiggins; “swap driick for steph in that first trade” uses the first displayed revision, tolerates the scoped typo and retains Wiggins. The browser completed those edits in five and six seconds in the recorded check.
- A complete pair supplied during an identity question supersedes the incomplete pair. A fully named new exchange stays a new exchange even if one player was already in the focused trade.
- Contextual edit targets use the latest explicit user referent. “Remove him” after “put Wiggins back” removes Wiggins; after a two-player exchange with no single referent it asks which player.
- Active hypothetical contracts, waivers and signings carry into trades involving the affected player. A waived player cannot be traded by starting a fresh package. Missing signing terms ask one question instead of repeating failed calls.
- Ordinary picks remain supported. Custom protections, swap rights, automatic asset searches, exception combinations and exports receive specific explanations. Requested unsupported height, experience and contract-duration filters cannot silently disappear.

The actual browser flow also confirmed the question is recorded before the selected answer, outgoing-player discovery follows automatically, saved cards survive reload, and completed work appears before assistant content and the waiting marker.

## Coverage

All 44 intention scenarios have complete passing recordings, covering 112 ordered turns. The broad run was followed by complete reruns of corrected or affected conversations; this is not a claim that one uninterrupted batch passed every turn. All six transport checks also passed.

| Area | Examples |
| --- | --- |
| Identity | White, duplicate Kam Jones, Dave correction, selected badges, typo, unknown name and recovery |
| Intention | Outgoing-only discovery, same-team packages, implicit exchanges, fresh requests following invalid trades |
| Editing | Three-team substitution, retained owners, explicit receiving roles, compound changes, removal, rerouting, undo, original-version references |
| Discovery | Named partners, age and position filters, pagination, changed source, impossible filters, repair and candidate selection |
| Conversation | Pending research detours, cancellation, cleared focus, pronouns, explanation, unsupported requests preserving the last trade |
| Transport | Replay, stale versions, invalid selected IDs, expired/forged choices, concurrent requests and malformed input |

Verification results and provenance are in [verification/chat-intentions-e2e.json](verification/chat-intentions-e2e.json). The UX reviewer includes the successful recordings alongside the existing conversations; importing recordings does not make model calls. Open `/ux-review` on the development server, or run `npm run review:chat` and visit `http://127.0.0.1:3018/ux-review`.

The wider trade-machine run also exercises contract salary/years, draft rights, trade exceptions, signings, sign-and-trades, stretching and combined requests. All 20 turns passed across six separate conversations. The reviewer also contains conversations covering those features.

The refreshed reviewer contains 327 recorded chat turns across 115 conversations, including every current live scenario definition. The initial full refresh recorded 322 turns in 114 conversations; complete corrected reruns and the cancellation/clear conversation were then merged. Capturing a response is not a semantic assertion: the 112-turn intention suite and 20-turn machine suite make explicit checks, while the wider recordings were inspected for errors and inappropriate outcomes. The invalid-selected-player scenario intentionally retains its error response. A timed-out pick recording was replaced by a complete rerun.

The review manifest verifies 150 scenarios and 1,456 viewport entries, including composer and other interface fixtures. This confirms current source references and coverage, not that every viewport was manually inspected. The live browser proof for the reported replacement is [verification/scoped-replacement.png](verification/scoped-replacement.png). TypeScript, scoped ESLint, the production build and Cloudflare type checking passed. No deployment was performed.

## Repeat the live checks

Start a separate application server with isolated storage:

```sh
GAMBIT_CONVERSATION_DB=/tmp/gambit-chat-e2e.sqlite npm run dev -- --host 127.0.0.1 --port 3021 --strictPort
```

In another terminal:

```sh
node scripts/check-chat-intentions-e2e.mjs /tmp/gambit-chat-intentions.json
node scripts/check-chat-transport-e2e.mjs /tmp/gambit-chat-intentions.json /tmp/gambit-chat-transport.json
node scripts/check-trade-machine.mjs /tmp/gambit-trade-machine.json
```

The intention runner accepts an optional scenario-name regular expression and `GAMBIT_E2E_URL`. It records actual outcomes and streamed progress, stops dependent turns after failure, and stops the suite if the AI service is unavailable. These checks consume configured-model usage. The transport runner accepts an intention report to exercise replay and stale/concurrent turns against that report's still-running isolated server.

These conversations check representative intentions, not every possible phrase. Passing salary and roster validation does not establish team willingness or trade value. Catalogue ownership, rather than assumptions about real-world rosters, determines transfers.
