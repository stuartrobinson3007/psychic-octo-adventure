# Multi-team trades

Named player trades support two through four participating teams. The existing engine accepts explicit source and destination teams for each transfer; the previous restriction was in the local proposal checks and agent workflow.

Cards with three or four teams keep team columns side by side inside a horizontal scroll area. Desktop shows two full columns and a glimpse of the third; narrow screens show one column with a glimpse of the next. Keyboard arrows and trackpad scrolling work. Each received player names their source team, and salary evidence remains visible for every participant.

Chat can add participating teams, add players with explicit destinations, reroute a player, replace a player while preserving other routes, and undo an edit. Missing destinations prompt clarification. Validation checks the exact final proposal and cannot silently change it after checking. Automatic package discovery remains limited to two teams; bounded repair suggestions consider all participating teams.

## Verification — 8 October 2026

- 224 automated tests passed, including multi-team payloads, per-team evidence, routing, replacement, clarification, undo and repair.
- Typecheck, lint and production build passed.
- All 13 live HTTP/SSE scenarios passed using the configured model and trade engine. [Scenario results](verification/multi-team-live.json).
- Browser checks covered three- and four-team cards, horizontal keyboard and trackpad scrolling, desktop and a 390px viewport, saving a three-team version, reloading, and reopening its original routes after creating a newer four-team version.
- Neither tested viewport produced horizontal page overflow. Narrow-screen verification used an emulated viewport; physical touch input was not tested.

[Desktop screenshot](verification/multi-team-desktop.jpg) · [Narrow-screen screenshot](verification/multi-team-mobile.jpg)
