# Minor typos in player names

For `trade derrik white for andrew wiggins`, the assistant should resolve Derrick White and check the swap immediately. A question offering Derrick and Coby White discards the supplied first name and interrupts an otherwise complete request.

Name resolution now keeps the whole supplied name before falling back to fragments. It accepts a single insertion, deletion, substitution or adjacent-letter transposition in one sufficiently long name word, with the remaining name words matching. Exact matches take priority; automatic correction requires one unique best catalogue identity. A surname alone or equally close full-name matches still require a choice. Nicknames and unknown names remain clarification requests.

This applies to initial trades and subsequent replacements. Confirmed catalogue identities determine the result, and the card shows the canonical name. No correction confirmation or extra spelling notice is necessary for these clear cases.

Clarification choices are also grounded in the literal name evidence, so the model cannot offer only one assumed player when the surname is ambiguous. A selected answer accompanied by additional text remains provisional until that text is reconciled.

On 8 October 2026, the final real HTTP/SSE run passed **21 turns across 10 conversations**, using the configured model and validator:

- Full-name deletion and transposition: `Derrik White`, `Derrick Whtie`.
- A different first name: `Coby Whte` resolves Coby, not Derrick.
- Follow-up replacement: `replace White with Jrue Holidy` retains the existing receiving role.
- Equally close matches: `Jalin Williams` offers Jalen and Jaylin Williams.
- Bare `White` offers both identities, then uses the selected player.
- Duplicate full names, unknown-name recovery, correction of a selected player, outgoing-player discovery and natural candidate selection.

The actual browser composer was also exercised with the original typo: it produced a checked swap without opening a question widget. The existing UX review scenario was replaced with that completed flow. No unit tests were added or run. Typecheck, scoped lint and the build passed.

The recorded verification summary is [verification/typo-resolution-e2e.json](verification/typo-resolution-e2e.json).
