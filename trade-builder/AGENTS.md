# Testing preference

Prefer E2E checks of meaningful user journeys. Integration tests are appropriate
for real boundaries such as storage, SDK transport and deployment. Do not add
unit tests or tests that mirror implementation details.

Keep verification proportional to the change: run the smallest relevant check,
and expand only when a failure or unresolved risk warrants it. Avoid spending
agent credits creating or repeatedly running tests for routine reversible edits.
Use recorded UI scenarios or mocked external services for ordinary E2E checks.
Live model checks consume API credits; run them only when the user requests live
model verification, using a focused scenario rather than the full suite.

See [testing guidance](docs/testing.md) for commands and coverage. `npm test`
runs only local integration checks with live network requests disabled.

# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.
