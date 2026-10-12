# ADK presentation refresh, 12 October 2026

The 14 curated scenarios at `http://127.0.0.1:3000/chat-presentation` now
contain 47 newly recorded turns through the real ADK/OpenAI harness and live
trade validator. Recordings used isolated temporary conversation databases;
the normal application conversation database was not used.

The initial refresh captured one unavailable clarification reply. A single
focused rerun of that three-turn conversation succeeded and replaced the
conversation as a whole. The imported set has no `error` or
`agent_unavailable` replies. These are observed conversations, not assertions
that every domain outcome is successful: invalid trades and clarification
questions remain legitimate recorded outcomes.

The reports are `.ux-review/presentation-adk-refresh.json` and
`.ux-review/presentation-adk-clarification-retry.json`. They were merged through
`import-chat-review.mjs`, then the atlas was rebuilt and verified. All 14
curated JSON assets served by port 3000 match their generated files and carry
backend revision `0a0899d184ca56a0fd292fbcea01e44da0c9f64f694d78534e373657d566a146`.

The wider atlas retains its other historical recordings: 14/171 recorded
conversations are current. Its 220 scenarios and 4,084 viewport references
verify; no full frozen screenshot sweep is claimed.

Browser verification reloads the page, checks the fresh Williams clarification
and the Trade ideas selection/check journey using the current UI, and checks
browser errors. The standalone presentation screenshot is
`adk-presentation-refresh.png`.
