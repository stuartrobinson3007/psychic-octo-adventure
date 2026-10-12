# Trade discovery

Implemented in the side conversation on 7 October 2026 while the main backend review continued. No new provider, credential, dependency, or deployment is needed.

## Supported requests

| Request                                                                  | Result                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| “Find a suitable trade from Bulls to any two players from another team.” | Starts with one Bulls player for two players from a single other team, discloses this assumption, and shows up to three checked cards. |
| “Find suitable matches.” following that request                          | Continues the same team-level search rather than asking for outgoing names.                                                            |
| “Find Bulls options involving Patrick Williams for two players.”         | Fixes the outgoing player instead of substituting someone else.                                                                        |
| “Find Bulls options with Boston.”                                        | Searches only the requested partner.                                                                                                   |
| “Do not trade Patrick Williams.”                                         | Excludes that player from generated packages.                                                                                          |
| Explicit one/two player counts on each side                              | Uses the requested counts, including two-for-two.                                                                                      |
| Missing source team                                                      | Asks which team to search.                                                                                                             |
| Ambiguous named player constraint                                        | Asks which player the user means.                                                                                                      |
| Picks, signings, three teams, or more than two players per side          | Reports the initial discovery scope restriction.                                                                                       |
| All checked packages fail                                                | Says no passing option was found in the bounded shortlist, without claiming none exists.                                               |
| Engine checks unavailable                                                | Reports incomplete validation; unchecked candidates never appear as valid options.                                                     |

The search identifies candidates that pass the trade engine's rules for the synthetic catalogue. It cannot establish basketball fairness, team fit, a team's willingness to accept, or a globally best trade. Hard age, position, payroll and performance filters are not yet implemented.

## Search and limits

`src/server/trade-discovery.ts` generates eligible player combinations using catalogue ownership. Both incoming players belong to the same partner. Unsupported contracts, no-trade consent and non-positive salaries are excluded. Named outgoing players, selected partner, counts and exclusions are preserved.

Salary proximity determines search order, not legality. The shortlist visits close-salary packages from different partners before additional packages from the same partner. Only a bounded prefix is retained per partner while generating combinations, limiting memory use for two-for-two searches.

Each discovery checks at most 18 packages, with at most three engine requests concurrent and a 25-second search deadline inside the chat turn's existing deadline. It stops once three passing options have been found. Returned evidence must match the candidate's proposal ID and revision. Results include generated/checked counts and unavailable-check counts. The first live Bulls one-for-two search considered 49,650 combinations locally and checked three packages to return three options.

## Agent and conversation integration

`src/server/trade-discovery-tool.ts` contributes the `discover_trades` terminal tool and its instructions. The agent interprets the request as `discovery`, resolves the team and explicit player constraints, and calls the tool. Code generates the packages and publishes the result text; the model does not invent player packages or write a legality verdict.

Integration changes to existing code are limited to:

- `trade-turn.ts`: discovery intent, tool registration, transactional candidate delivery and blocking unchecked discovery prose.
- `trade-harness.ts`: imports the discovery instructions and adds the terminal tool to the instructions.
- `lib/trade/types.ts`: optional `ChatTurnResult.candidates`.
- `use-trade-workspace.ts`: renders candidates through existing cards, flags their history entries, and avoids restoring an unselected candidate as the active trade after reload.

Candidates are separate from the active `snapshot` and committed `snapshots`. Discovery preserves the active trade and its revision history. Options can be saved through the existing card action and selected or edited through follow-up chat requests.

A weak cache tied to the in-memory session retains prior search identity context for follow-up requests. It expires with that session and is not durable across server restarts. Existing retry deduplication returns the same candidates without repeating model or validation calls.

## Verification

Added 13 regression tests covering generation/routing, fixed players/partner/counts/exclusions, contract scope, invalid constraints, invalid/unavailable/mismatched verdicts, bounded calls, cancellation, tool-loop delivery, duplicate requests, active-trade preservation, pending clarification continuation, identity grounding, and research restrictions.

The whole test suite passed with 73 tests at verification time, including the main thread's concurrent additions. TypeScript and lint checks passed for the changed files. Six live model-plus-engine requests passed: the exact screenshot request, its short follow-up, Boston-only candidates, an excluded player, unsupported picks, and missing-source clarification.

Browser verification used a separate local server at `127.0.0.1:3018`, leaving the main thread's servers and browser data alone. The original request produced three Valid cards for Bulls/Heat, Bulls/Bucks and Bulls/Rockets. Options now remain in their original conversation and can be selected or explained through chat. Screenshot: `trade-discovery.jpg`.

The counts above describe historical coverage. Unit tests have since been removed. Prefer focused E2E journeys and useful integration checks; `npm test` now runs local integrations with live network requests disabled. Use existing recordings or mocked services for routine discovery checks. Live exercises use the existing OpenAI key and consume normal API usage; run them only when the user requests live model verification. See [testing guidance](testing.md).

```sh
npm run test:chat:live -- /tmp/gambit-trade-discovery.json "discovery"
```
