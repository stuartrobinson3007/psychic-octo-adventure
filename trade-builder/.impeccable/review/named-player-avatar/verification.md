# Named exception avatar fix

Scope: the portrait helper, PlayerAvatar, ClarificationChoice and the single Chris Boucher asset. No roster, recording, backend or presentation-flow changes.

Chris Boucher is absent from the live API's 629-player catalogue but named by Boston's exception endpoint. Current-player name matching therefore omitted the entire avatar. Named monetary choices now retain their name for the separate portrait-only lookup; unknown portrait names and failed image loads use the existing initials fallback.

Desktop and 390px mobile browser checks confirmed the local Boucher image loaded. Every option retains an avatar and all four labels have the same left coordinate on desktop. Existing three catalogue players retain their details actions; Boucher has none. Selecting his exception sets aria-pressed=true and keeps the image visible. The mobile page stays within its 390px viewport. Existing UI labels and choice copy remain unchanged.

Prettier, scoped ESLint and TypeScript pass. The Impeccable detector reports no findings. The original roster catalogue checksum still matches its pinned manifest. New portrait source and checksum are stored in public/player-headshots/named-manifest.json. Screenshots: desktop.png and mobile.png. Temporary verification tab closed and viewport reset.

Cached frozen presentation screens need a viewer refresh to regenerate their HTML. No cache-clearing behavior was added to the shared viewer.
