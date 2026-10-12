Scope: retain loaded screens for the three most recently selected scenarios.

The route maintains recency separately from stable catalog render order. Each retained ScenarioView keeps its conversation data, frozen iframe documents and timeline state mounted. Inactive panes retain full geometry but are invisible, inert and excluded from accessibility. Their unfinished queues pause. Returning reuses completed screens and resumes only pending work. A fourth selection unmounts the least recently used pane. Sidebar navigation avoids the router's scroll reset.

Browser verification confirmed:
- Returning to Trade ideas reused all three loaded snapshots with zero preparing sources and the same capture identity.
- Revisiting Trade ideas refreshed its recency; selecting Players and picks then evicted Player clarification, while Trade ideas retained the same loaded snapshots.
- Returning to the evicted Player clarification started a fresh source, and the cache remained limited to three panes.
- A later cached Player clarification return reused all four screens with zero preparing sources. Its timeline position remained 297px across a scenario switch when measured without inspecting iframe contents.

Thirteen targeted tests pass, covering LRU eviction after a revisit, duplicate prevention, stable current-selection identity and the existing presentation story requirements. TypeScript, targeted ESLint, Prettier and production build pass. Existing design-system files remain unchanged.
