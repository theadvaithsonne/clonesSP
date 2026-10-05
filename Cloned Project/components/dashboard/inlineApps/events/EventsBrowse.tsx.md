# `components/dashboard/inlineApps/events/EventsBrowse.tsx`

> Attendee-facing Events: Discover.

**Kind:** React component · **Lines:** 682 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Attendee-facing Events: Discover.

No founder functionality at all — browse the office's published events,
open one, and buy it without leaving the app (see EventCheckoutView, which
runs the same checkout API as the public /events/[slug] page).

Top to bottom: filters, the featured event, then what's on this week and
everything after it. The featured slot is meant to hold the office's
most-viewed event, but nothing records event views yet, so it holds the
soonest one.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FilterDropdown`×4 (components/dashboard/inlineApps/events/browse-ui.tsx), `EmptyPanel`×3 (components/dashboard/inlineApps/events/browse-ui.tsx), `Search`×2 (lucide-react), `CalendarDays`×2 (lucide-react), `SectionHeading`×2 (components/dashboard/inlineApps/events/browse-ui.tsx), `EventCover`×2 (components/dashboard/inlineApps/events/browse-ui.tsx), `EventCard` (components/dashboard/inlineApps/events/browse-ui.tsx), `BookmarkButton` (components/dashboard/inlineApps/events/browse-ui.tsx), `EventFlowView` (components/dashboard/inlineApps/events/EventFlowView.tsx), `LinkIcon` (lucide-react), `CardSkeleton` (components/dashboard/inlineApps/events/browse-ui.tsx), `FeaturedEvent` (local), `ShareEventsModal` (local), `MapPin` (lucide-react), `Users` (lucide-react), `X` (lucide-react), `Check` (lucide-react), `Copy` (lucide-react)

### Props

- **`EventsBrowse`**: `onOpenPurchases?: () => void`

**Hooks used:** `useState`×13, `useEffect`×5, `useMemo`×3, `useSavedEvents` (components/dashboard/inlineApps/events/browse-ui.tsx), `useRef`, `useCallback`, `useHideBottomBar` (components/dashboard/inlineApps/events/ui.tsx), `useEventShareUrl` (components/dashboard/inlineApps/events/browse-ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventsBrowse)` | component | `EventsBrowse({ onOpenPurchases, }: { /** Switches the dashboard to Event…)` | 77 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/affiliate-share.ts` — `copyToClipboard`, `withAffiliateRef`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/inlineApps/events/api.ts` — `browsePublicEvents`, `getPublicEvent`, `BrowseEvent`, `PublicEventPayload`
  - `components/dashboard/inlineApps/events/ui.tsx` — `EVENT_CATEGORIES`, `useHideBottomBar`
  - `components/dashboard/inlineApps/events/browse-format.ts` — `DateFilter`, `dateRange`, `dayMonth`, `endOfWeek`, `fromPriceLabel`, `isLive`, `locationLabel`, `matchesDate`, … +1
  - `components/dashboard/inlineApps/events/browse-ui.tsx` — `BookmarkButton`, `CARD_GRID`, `CardSkeleton`, `EmptyPanel`, `EventCard`, `EventCover`, `FilterDropdown`, `OUTLINE_BUTTON`, … +4
  - `components/dashboard/inlineApps/events/EventFlowView.tsx` — `EventFlowView (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `CalendarDays`, `Check`, `Copy`, `Link as LinkIcon`, `MapPin`, `Search`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
