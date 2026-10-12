Scope: begin loading every screen immediately on scenario selection, in timeline order.

ConversationTimeline owns a scenario-keyed pending queue. Only the first pending screen receives load permission. A fully initialized frozen snapshot advances the queue; a failed screen also advances it and remains retryable. Retries join the tail. Changing scenarios unmounts the previous queue and its preparing frame. IntersectionObserver no longer controls loading.

Preparation frames are invisible and positioned over the visible canvas at their target screen dimensions, allowing lazy assets to complete even when the destination stage is offscreen. Cached frozen documents are initialized even if their load event fired before the effect registered, with a guard against duplicate initialization.

Browser verification:
- Initial Players and picks selection mounted exactly one preparing source for its first reply.
- All four screens then became frozen and ready with zero preparing sources and horizontal scroll still zero.
- Edits and undo began with its first source only. Switching immediately to Trade ideas replaced it with that scenario's first source and three retained screens.
- All three Trade ideas screens became frozen and ready without scrolling, with no errors or preparing sources remaining.

Validation: ten scenario regression tests passed; TypeScript, targeted ESLint and Prettier passed. Production build passed. The viewer's layout and design system remain unchanged.
