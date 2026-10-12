---
name: Gambit
description: A quiet conversation workspace for inspecting basketball trades.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.141 0.005 285.823)"
  card: "oklch(1 0 0)"
  popover: "oklch(1 0 0)"
  primary: "oklch(0.508 0.118 165.612)"
  primary-foreground: "oklch(0.979 0.021 166.113)"
  secondary: "oklch(0.967 0.001 286.375)"
  secondary-foreground: "oklch(0.21 0.006 285.885)"
  muted: "oklch(0.967 0.001 286.375)"
  muted-foreground: "oklch(0.552 0.016 285.938)"
  border: "oklch(0.92 0.004 286.32)"
  input: "oklch(0.92 0.004 286.32)"
  ring: "oklch(0.705 0.015 286.067)"
  warning: "oklch(0.79 0.15 80)"
  warning-foreground: "oklch(0.44 0.1 70)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  headline:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "22px"
    fontWeight: 500
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  control:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  label:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "0.525rem"
  md: "0.7rem"
  lg: "0.875rem"
  xl: "1.225rem"
  button-sm: "10px"
  token: "0.7rem"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.button-sm}"
    padding: "0 0.625rem"
    height: "2rem"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, oklch(0.508 0.118 165.612) 80%, transparent)"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.button-sm}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.button-sm}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  search-field:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  navigation-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2.25rem"
  player-badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.token}"
    padding: "0.125rem 0.375rem"
    height: "1.5rem"
  unresolved-badge:
    backgroundColor: "color-mix(in oklab, oklch(0.79 0.15 80) 15%, transparent)"
    textColor: "{colors.warning-foreground}"
    rounded: "{rounded.token}"
    padding: "0.125rem 0.375rem"
    height: "1.5rem"
  trade-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem 0"
  composer:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
---

# Design System: Gambit

## Overview

**Creative North Star: "Conversation is the working surface"**

Gambit retains its incumbent white, zinc and emerald system. Inter Variable, shadcn components backed by Base UI, Hugeicons and restrained rounded controls support a readable conversation with progressively revealed research. This document records the implementation; it does not introduce a new visual identity.

Surfaces stay quiet and copy explains an action or state. Team marks identify the assets being researched. Structural dividers, compact control groups and tabular numbers make detailed trade evidence easier to inspect without turning the workspace into a dashboard.

**Key Characteristics:**
- White surfaces and zinc hierarchy.
- Emerald actions with explicit warning and error states.
- One Inter family for conversation, controls and evidence.
- Rounded shadcn controls and fine structural dividers.
- Progressive supporting space with reduced-motion alternatives.

Source of truth: `src/styles.css`, `src/components/workspace/workspace.css`, `src/components/workspace/motion.css`, and the used components in `src/components/ui/`. Tokens above describe the light workspace. The existing `.dark` block remains the authority for dark token overrides; it is not a separately approved visual direction.

## Colors

The palette pairs white and cool zinc neutrals with a restrained emerald action colour. Preserve the source's OKLCH notation.

### Primary

- **Emerald action:** `primary` fills deliberate actions and the send control; `primary-foreground` supplies their text and icons.

### Neutral

- **White surface:** `background`, `card` and `popover` are the working canvas, evidence containers and floating selection surfaces.
- **Deep zinc:** `foreground` carries names, content and headings; `secondary-foreground` carries secondary control text.
- **Soft zinc:** `muted` and `secondary` distinguish user messages, selected rows and supporting controls.
- **Mid zinc:** `muted-foreground` supports metadata, placeholders and source notes.
- **Fine zinc:** `border` and `input` structure panels and fields; `ring` identifies component focus.

Warning amber and destructive red carry meaning rather than decoration. Unresolved player references use `warning` at fifteen percent opacity with `warning-foreground`; destructive alerts and violation text use `destructive`. These semantic colours do not establish extra brand accents.

**The Meaning Before Colour Rule.** Pair state colour with a readable label or icon; the implementation names unresolved references and trade verdicts explicitly.

## Typography

**Display Font:** Inter Variable, with sans-serif fallback.
**Body Font:** Inter Variable, with sans-serif fallback.

**Character:** A single variable sans family carries both conversational text and compact research evidence. Medium weight distinguishes controls and names without adding a second type voice. The workspace enables `cv02`, `cv03`, `cv04`, `cv11` and `ss01`.

### Hierarchy

- **Headline:** Player identity uses the extracted `headline` role; the welcome and empty-state title use shadcn's large text treatment (1.125rem, medium, tight tracking).
- **Title:** Brand and panel titles use the `title` scale; small trade cards use a medium body-sized title.
- **Body:** Conversation bubbles use the extracted `body` role. The composer uses a more open line-height (1.9) to accommodate inline player references.
- **Control:** Buttons and navigation use the `control` role.
- **Label:** Row metadata, footer notes and small supporting labels use `label`; source notes use the existing smaller size (11px).

Salary values and comparison cells use tabular numerals. At the mobile breakpoint, the workspace base and player-name text use sixteen pixels; shared inputs use their responsive component scale.

**The One Family Rule.** Keep headings, conversation and evidence in Inter Variable; use weight, spacing and size for hierarchy.

## Layout

The app fills the dynamic viewport. A quiet header (64px) sits above an independently scrollable conversation and research workspace. The outer workspace is centred with a maximum width (1640px). Closed research leaves a centred chat column capped at 760px. Opening research allocates 460px to the supporting panel and pushes chat left; details or comparison widen supporting space to 58%, with chat at 42%. Inside that wider research view, the player list occupies 43% while detail takes the remainder.

At the medium breakpoint (maximum width 1199px), chat and research use a 54% / 46% split. Opening detail hides the player list. At the mobile breakpoint (maximum width 767px), supporting research takes the visible width and chat remains mounted but hidden. The header becomes 60px and its horizontal padding reduces to 14px.

Spacing follows the extracted quarter-rem rhythm in the shared controls, with contextual workspace padding. Conversation padding is 36px 40px 28px on desktop, 28px 24px at medium width and 28px 20px 24px on mobile. Composer margins use 36px desktop horizontal padding, 24px medium and 14px mobile. Research sections use compact row rhythm and separate local scroll areas rather than adding page-height columns.

## Elevation & Depth

Depth combines tonal layering, thin zinc dividers and subtle shadcn shadows. Shared fields, outlined actions and cards use the imported extra-small shadow. Cards add a one-pixel foreground ring at ten percent opacity. Floating popovers use the imported medium shadow and the same subtle ring. Inline assistant messages remain on the canvas; user messages receive a muted rounded bubble.

### Shadow Vocabulary

- **Extra-small:** `0 1px 2px 0 rgb(0 0 0 / 0.05)`; used by the shared field, outlined button and card components.
- **Medium:** `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`; used by floating popovers.

Both values come from the installed Tailwind theme. Preserve the separation between restrained surface depth and floating selection surfaces.

## Shapes

The root radius is 0.875rem. Shared radii derive from it: small at 0.6×, medium at 0.8×, large at 1× and extra-large at 1.4×. Small buttons cap their medium radius at ten pixels. Player references and the composer use a medium corner, while ordinary badges use the existing larger badge radius. Thin dividers and rounded controls carry the form language; team marks remain contained image assets.

## Components

### Buttons

Compact shadcn/Base UI actions use the shared Button API. Primary and secondary detail actions use the small height (2rem); ordinary and icon actions use 2.25rem. Ghost actions support panel navigation, bookmarking and row controls. Outlined actions offer an optional conversation starter.

Primary hover reduces its fill to eighty percent opacity. Secondary hover mixes five percent foreground into the secondary surface. Ghost and outlined hover use the muted surface. Focus uses the shared three-pixel ring at half opacity and changes the border to the ring colour. Disabled actions reduce opacity and block pointer interaction; ordinary pressed actions shift down one pixel.

### Chips

Resolved inline player badges use the shared `player` variant with secondary colour, medium corners and a twenty-four-pixel height. A hashtag icon, team mark and player name communicate the reference. Unresolved references use the shared `warning` variant and an explicit question icon; hover, click or keyboard activation opens candidates. The composer cannot submit unresolved references.

### Cards / Containers

Trade evidence uses the shared small Card: extra-large corners, card surface, subtle ring and shadow, with sixteen-pixel section padding. Its summary remains recognisable while collapsed; the newest version opens by default. Bookmarking records the exact historical version. A Collapsible controls disclosure and an Accordion contains optional salary-rule evidence.

### Inputs / Fields

Player search uses InputGroup and InputGroupInput, with a leading search icon and labelled control. The shared group is 2.25rem high with a fine input border, medium corners and extra-small shadow. Placeholder text uses muted foreground. Focus propagates the component ring to its group. Select filters use the existing shared Select components.

An open options picker retains the accompanying AI explanation in the conversation. Only the duplicate selection question is omitted from the transcript until answered. Trade-list height is capped against viewport height while reserving room for the request and reply; filtering retains the opening list height.

The Lexical composer is a custom editable surface inside InputGroup. Its editor starts at 72px, scrolls at 192px, and uses padding (16px 18px 12px). An inset placeholder and bottom addon keep player search, browsing and send actions aligned. Mobile increases minimum height to 76px and reduces editor padding to 14px.

### Navigation

Players and Saved trades use a shared ToggleGroup in the header, with compact gaps and medium rounded controls. Selected and hovered toggles receive the muted surface. Research mode content stays mounted between selections, preserving inspection state. Closing research restores focus to the composer.

### Progressive motion

Conversation and research dimensions transition over 300ms. The selection popover grows from its Base UI transform origin over 250ms and closes over 150ms; pre-open and closing scales are 0.97 and 0.99. Trade disclosure uses the height supplied by Base UI, with 250ms expand, collapse and chevron motion. These signature transitions share `cubic-bezier(0.22, 1, 0.36, 1)` and disable transitions for reduced motion. Preserve the component lifecycle and origin rather than animating a disconnected overlay.

## Do's and Don'ts

### Do:

- **Do** preserve white/zinc surfaces, emerald actions and the source's semantic OKLCH tokens.
- **Do** use shared shadcn/Base UI controls for actions, fields, selection, navigation and disclosure.
- **Do** keep Inter Variable, tabular numbers for evidence, and explicit labels for state.
- **Do** reveal research progressively and preserve conversation state across viewport changes.
- **Do** honour reduced motion for resizing, popovers and disclosure.

### Don't:

- **Don't** add decorative copy or use team marks as panel ornament.
- **Don't** silently resolve ambiguous player identities or make browsing mutate a proposal.
- **Don't** present illustrative performance as measured player data.
- **Don't** introduce a competing visual identity when extending this workspace.

Not canonized: the older grid-disclosure and custom-dropdown recipes retained in `motion.css` are not the shared components' current Base UI lifecycle. Their unused geometry is excluded from the component system. Component snippets reproduce current shared primitives; they contain no claimed player statistics.
