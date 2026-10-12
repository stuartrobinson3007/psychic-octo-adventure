# Sign-and-trade timeout verification

Prompt: “Sign Terry Rozier to Miami on a one-year minimum contract, then trade him to Boston for Derrick White.”

Before: reproduced the 45-second timeout against the configured live model. A signing-only classification disabled transfer tools and the model repeatedly edited the signing instead of completing the swap.

Fix: keep explicit signing plus transfer requests in the trade workflow, instruct the model to apply the whole request in one turn, and allow 90 seconds for these combined requests. The conversation lease covers that deadline plus 15 seconds for persistence.

After: submitted the exact prompt through the actual chat UI against the configured live model and Basketball GM API. A stable source snapshot isolated the test from concurrent workspace hot reloads. The UI finished in **13,312 ms**, showing Rozier to Boston, White to Miami, and Rozier’s one-year $3,290,014 minimum signing with Miami. All tool calls completed. The persisted conversation contains one revision and releases its lock.

The trade engine returned `invalid_trade` with Miami’s hard-cap and sign-and-trade restrictions. This is a completed evaluation, rather than a request failure.

Validation: 24 focused regression tests passed; TypeScript and production build passed. Targeted lint exited successfully with one existing shadowing warning in concurrently edited code. Build reported the existing large-chunk warning.

Evidence: `rozier-sign-and-trade-2026-10-08.png` and `rozier-sign-and-trade-2026-10-08.json`.
