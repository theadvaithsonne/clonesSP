# `components/events/site/EventSiteRenderer.tsx`

> The single renderer for an event's public website.

**Kind:** React component · **Lines:** 2474 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The single renderer for an event's public website.

Used in two places, and that is the point: the /e/[slug] customer page and
the founder's Web Builder canvas both mount this component with the same
props. A block that looks right in the builder therefore looks right live,
with no second implementation to keep in sync.

The layout is the "summit" template: a sticky nav, a centred hero with a
countdown, and alternating white / tinted bands down the page. Every surface
colour comes from a palette derived from `theme.backgroundColor`, so an
organizer who picks a dark background gets the same layout inverted rather
than a half-broken light page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Container`×14 (local), `SectionShell`×10 (local), `SectionHeading`×9 (local), `Eyebrow`×5 (local), `Share2`×2 (lucide-react), `PrimaryButton`×2 (local), `Radio`×2 (lucide-react), `X` (lucide-react), `Menu` (lucide-react), `StatsBand` (local), `Linkedin` (lucide-react), `Twitter` (lucide-react), `Instagram` (lucide-react), `Globe` (lucide-react), `MapPin` (lucide-react), `Navigation` (lucide-react), `Users` (lucide-react), `EventVenueMap` (components/events/site/EventVenueMap.tsx), `ChevronDown` (lucide-react), `TicketIcon` (lucide-react), `PaletteCtx` (local), `SiteNav` (local), `HeroBlock` (local), `AboutBlock` (local), `AgendaBlock` (local), `SpeakersBlock` (local), `SponsorsBlock` (local), `TicketsBlock` (local), `VenueBlock` (local), `FaqBlock` (local), `CtaBannerBlock` (local), `FooterBlock` (local), `MyTicketsSection` (local), `FloatingTicketBar` (local)

### Props

- **`EventSiteRenderer`**: `event: EventProgram`, `blocks: EventBlock[]`, `theme: EventTheme`, `tiers: PublicTier[]`, `speakers: EventSpeaker[]`, `sessions: AgendaSession[]`, `sponsors: EventSponsor[]`, `organizationName?: string`, `organizationIcon?: string`, `onGetTickets?: (tierId?: string) => void`, `onShare?: () => void`, `onSelectBlock?: (blockId: string) => void`, `selectedBlockId?: string | null`, `showHidden?: boolean`, `compact?: boolean`

**Hooks used:** `usePalette`×15 (local), `useState`×12, `useMemo`×9, `useEffect`×2, `useCountdown` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PublicTier` | interface |  | 47 |
| `EventSiteProps` | interface |  | 60 |
| `formatMoney` | function | `formatMoney(amount: number, currency: string): string` | 155 |
| `blockAlign` | function | `blockAlign(block: EventBlock): "left" \| "center" \| "right"` | 325 |
| `blockLayout` | function | `blockLayout(block: EventBlock)` — Tailwind classes for a block's chosen alignment and vertical padding. | 331 |
| `default (EventSiteRenderer)` | component | `EventSiteRenderer(props: EventSiteProps)` | 2258 |

## Interfaces

- **Timers / queues:** `setInterval` at L289
- **External hosts mentioned in the code:** `www.google.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/types.ts` — `AgendaSession`, `EventBlock`, `EventBlockType`, `EventProgram`, `EventSpeaker`, `EventSponsor`, `EventTheme`, `(types only)`
  - `components/dashboard/inlineApps/events/api.ts` — `lookupTickets`, `LookedUpTicket`
  - `components/events/site/EventVenueMap.tsx` — `EventVenueMap (default)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `MapPin`, `Radio`, `Globe`, `Linkedin`, `Twitter`, `Instagram`, …

## Used by

- `app/events/[id]/EventLandingClient.tsx`
- `components/dashboard/inlineApps/events/WebsiteBuilder.tsx`

## Notes

- Large file (2474 lines) — read it by section; line numbers above point into it.
