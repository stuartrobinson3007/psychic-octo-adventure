# Questions and searchable choices

Questions without options render immediately as assistant messages, with the ordinary composer below. They remain in the transcript before and after the user answers. Questions with options stay in the choice header while awaiting an answer, then appear in the transcript when answered.

Unrestricted team-selection questions are supplied with every catalogue team at the backend clarification boundary. Explicitly scoped choices, such as participants in an existing trade, remain scoped. Team options carry stable team IDs, canonical submitted values and searchable aliases. The catalogue list is ordered by the displayed team name.

Search is an optional clarification capability (`optionSearch`), rather than a team-specific widget branch. The shared options component filters labels, details and optional `searchText`. Filtering never rewrites an option's ID or value. Single-choice questions clear a selection hidden by a new filter. Multiple-choice questions retain every selection across filters, including no-match results. An empty result leaves the search and composer usable. A new clarification remounts the options component using its question ID, resetting local filter state.

## Multiple selections

Questions declare optional `selectionLimits: { min, max }`. Without limits they remain single-choice. The assistant sets these limits explicitly through `ask_question`; the frontend does not infer them by matching words in the question. A request for exactly three teams uses `{ min: 3, max: 3 }`.

For multiple choices, the widget uses square checkboxes and shows `selected/max` in muted text at the right of the question header. Unselected choices are disabled at the maximum; selected choices remain available to deselect. A partial selection disables Send until the minimum is met. With no selections, an ordinary typed reply remains available.

The answer includes the question ID, every selected option ID and any supplemental text. The backend resolves canonical choices from the saved question and rejects stale questions, duplicates and counts outside the limits. The transcript keeps all choices in a single “You selected” receipt and preserves the question before the answer. Existing single-choice answers and saved receipts remain readable.

## Verification

The real HTTP/SSE conversation checks passed all six turns across two scenarios: Steph discovery → unsigned brother → signing-team question → Boston selection with contract terms, and an unknown player question answered through ordinary text with a nickname. The signing question offered all 30 catalogue teams, and the answer completed Seth Curry's signing in Boston.

Browser checks covered full-width search, abbreviation filtering, selection, the disabled Send state after filtering out a selection, no matches, clearing the filter, and the full list on a 393px viewport. UX review contains the recorded conversations plus interactive searchable-team and free-text-question checkpoints. No unit tests were added.

### Multiple-selection verification — 9 October 2026

Nine live backend turns passed: a three-team question, four rejected malformed/stale selection answers, a valid three-team answer with explicit routes, a four-team follow-up, and an independent single-player identity question and answer. Run `node scripts/check-multi-selection.mjs` to reproduce. Evidence: [backend report](verification/multi-selection-e2e.json).

The live browser journey checked selection across Boston/Denver/Golden State filters, the three-choice cap, deselection and disabled Send, keyboard Space, no matches, all three selection receipts, the retained question, and the resulting three-team routes. The 390px mobile layout kept the counter aligned inside the header with no horizontal overflow. A single-player question still displayed circular choices without a counter. No unit tests were added or run.

The three-team UX review recording was refreshed using an actual multi-choice submission, and the review recorder now supports `chooseTeamIds` and `chooseOptionIds`. App and Cloudflare typechecks, production builds and formatting checks passed.
