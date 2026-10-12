# Moving on from a clarification

A new question dismisses the previous option widget and its waiting indicator. The original question stays in the transcript. An unfinished trade remains available to resume with a typed answer, without forcing its choices into an unrelated response.

The conversation response and reload view expose a clarification only when it belongs to the latest successful assistant reply. The chat also checks that relationship when rendering older saved recordings. A stale option submission is rejected.

For unselected typed text, interpretation now distinguishes a new research, explanation or value question before reconciliation can amend a pending trade. Selected answers with extra text still require reconciliation first. Corrected name references update the stored edit roles as well as the draft request text.

Verified on 8 October 2026: 15 live HTTP/SSE turns across five conversations passed, covering research interruptions, resuming an edit, a new ambiguous research question, selected-player corrections and the previous typo fix. The real browser composer was exercised, and the dismissed picker stayed closed after reload. Typecheck, scoped lint and build passed. No unit tests were added or run.

The review recordings and future recording briefs reflect this behaviour. See [the verification summary](verification/research-dismisses-old-choices-e2e.json).
