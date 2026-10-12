# Draft pick browser validation

Verified on 8 October 2026 against the live catalogue and chat harness at `http://127.0.0.1:3041/`, using a separate `/tmp/gambit-pick-ui.sqlite` conversation database.

## Behavior

- Search for Charlotte, 2030 and the second round distinguishes the Boston-owned Charlotte pick from the Charlotte-owned pick and a Utah-origin swap owned by Charlotte.
- The Boston-owned Charlotte pick was inserted through the browser, removed through chat and then re-added through chat. Version 4 retained both players and Miami's 2029 first-round pick. Version 5 contained both players and both picks, with the Charlotte pick routed to Miami and existing protections retained. Both versions passed validation.
- Insertion marks a pick as in the message and disables duplicate insertion. Lexical undo removes the reference; redo restores it.
- Reload restores the submitted, clickable pick reference. Opening it shows the same exact pick identity and ownership.
- Catalogue refresh preserves the owner filter and unsent message. Switching between Players and Draft picks preserves filters. A desktop drag changed the pane from 460px to 500px and back.
- Mobile insertion returns to chat and retains the inserted reference. The 390px viewport has no horizontal document overflow.
- Unavailable and swap rows remain inspectable. Their insertion controls are disabled with a reason. Protection details explicitly say when terms are unavailable.

## Automated checks

- Six focused tests passed: search/availability, range validation and player/pick ID collisions, clarification offset preservation, exact duplicate-label resolution, changed ownership rejection before model execution, and archive restoration.
- TypeScript checking and the production build passed. Lint on touched files had zero errors and one existing/concurrent `no-shadow` warning in `trade-turn.ts`.
- One Impeccable detector pass over the changed UI returned `[]`.
- The full suite returned 267 passed and 20 failed out of 287. All 20 failing test names also fail in an isolated copy with this feature's explicit pick resolution, selected-ID seeding and clarification offset additions removed. That comparison returned 264 passed and 23 failed: the same 20 failures, two new feature tests whose implementations were intentionally removed, and an existing review-manifest test because its external fixture directory was not copied. The remaining failures concern existing clarification, discovery and trade routing behavior; they were not repaired as part of this browser extension.

Logs: `/tmp/gambit-pick-browser-final-tests.log`, `/tmp/gambit-pick-browser-final-build.log`, `/tmp/gambit-pick-browser-all-tests.log`, `/tmp/gambit-pick-browser-baseline-tests.log`, `/tmp/gambit-pick-browser-baseline-all-tests.log`.

## Final capture matrix

- `pick-browser-desktop.jpg`: 1440×1000, expanded filters and the latest valid mixed trade.
- `pick-browser-user-1280.jpg`: 1280×720, the user's desktop width.
- `pick-browser-mobile.jpg`: 390×844, filters and result rows.
- `pick-browser-details-desktop.jpg`: 1280×720, ownership and protection details.
- `pick-browser-details-mobile.jpg`: 390×844, the same protected pick.
- `pick-browser-composer-mobile.jpg`: 390×844, an inserted reference in the composer.
- `pick-browser-user-current.jpg`: 746×977, the current in-app width; no horizontal document overflow.

The first inspection's readable-label and missing-protection-terms findings were fixed together. The final confirmation round received a ship disposition. A documenter subsequently identified concurrent changes to the filter trigger; all six captures were refreshed and the current in-app width added for another full review. That review identified the lost visible in-message row state. It was restored in one edit, all seven captures refreshed, and the reviewer scored the fix resolved with disposition ship. Current captures use the Charlotte 2030 second-round search, showing the selected Boston-owned pick, another Charlotte-owned pick and an unavailable swap. Final typecheck, production build and pick-browser lint passed. No new shipping raster assets were introduced.
