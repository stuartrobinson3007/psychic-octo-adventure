# Shadcn UI audit

Audited 7 October 2026 against the official @shadcn registry, using the project's Base UI / Vega preset, Hugeicons, Tailwind 4, and @ alias.

## Installation

All 62 source-bearing UI components are installed in src/components/ui. The registry lists 63 entries: the legacy form entry is empty for this Base UI preset. Both view @shadcn/form and add @shadcn/form --yes were checked; neither supplies a source file. Forms use Field and FieldGroup. Sonner was the missing source component and is now installed; Base UI toast remains the recommended active notification primitive. No existing components were overwritten with the CLI.

## Active UI

| Surface | Components |
| --- | --- |
| Workspace actions | Button, ToggleGroup, Badge, DropdownMenu with DropdownMenuGroup |
| Chat | MessageScrollerProvider, MessageScroller, Viewport, Content, Item, Button; Message, MessageContent; Bubble, BubbleContent |
| Welcome and empty states | Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia |
| Composer | FieldGroup, Field, FieldLabel, InputGroup, InputGroupAddon, Button, Spinner |
| # player search | Popover, PopoverTrigger, PopoverContent, PopoverTitle; Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty |
| Player badges | Badge player/warning variants, Tooltip; ambiguity choices use Popover and Command |
| Roster search and filters | InputGroupInput, InputGroupAddon, InputGroupButton; Select with items, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem; Collapsible |
| Team marks | Avatar logo variant, AvatarImage, AvatarFallback |
| Research panels | ScrollArea, Separator |
| Player comparison | Table, TableHeader, TableBody, TableFooter, TableCaption, TableRow, TableHead, TableCell |
| Trade results | CardHeader, CardTitle, CardDescription, CardContent, CardFooter; controlled Collapsible; Badge, Alert, Accordion, Separator, Spinner |
| Saved trades | Card with CardAction, Button, Badge, ScrollArea, Empty |
| Status and errors | Marker, MarkerIcon, MarkerContent; Alert, AlertDescription |

## Remaining custom UI

Lexical remains the rich-text engine because a textarea cannot host atomic player references. Its controls and references are library components. Domain-specific trade math, player definition lists, research layout, and motion remain custom. There are no standalone native controls in the active workspace; the sole native button render target is composed inside Badge and PopoverTrigger for the accessible ambiguous-reference chip.

The retired CSS for buttons, selects, popovers, badges, cards, and bubbles was removed. Component appearance comes from variants and semantic tokens. Panel transitions retain the existing motion curve.

## Review

Checked the complete component inventory and local source imports. Corrected generated CommandDialog title/description placement inside DialogContent. Select and Command items have their groups; dropdown items have their group; team marks have a fallback. Validation: six player-matching/message-reference tests passed; typecheck, lint, and client/server production builds passed. Browser checks covered roster filters, team drill-down, keyboard selection, ambiguity resolution, live trade validation, salary rules, saving, two-player comparison, and the 390px mobile layout.

Installed source components: accordion, alert, alert-dialog, aspect-ratio, attachment, avatar, badge, breadcrumb, bubble, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, dialog, direction, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, marker, menubar, message, message-scroller, native-select, navigation-menu, pagination, popover, progress, questionnaire, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toast, toggle, toggle-group, tooltip.
