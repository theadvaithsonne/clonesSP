# `components/dashboard/inlineApps/events/EventDetailView.tsx`

> One event, as an attendee sees it inside the dashboard.

**Kind:** React component · **Lines:** 1349 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
One event, as an attendee sees it inside the dashboard.

Reads the same public payload as /events/[slug] but lays it out as the
in-app event page: hero, host, then Overview / Agenda / Speakers /
Sponsors & Expo / Venue & FAQ beside a sticky ticket panel. Buying still
hands off to the one checkout page every entry point shares.

Organizer copy (the About text, FAQ, venue note, "most popular" pass) comes
from the event's published website blocks, so what the organizer wrote in
the Web Builder is what shows here.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SectionHeading`×11 (components/dashboard/inlineApps/events/browse-ui.tsx), `MoreLink`×3 (local), `Breadcrumb`×2 (local), `Agenda`×2 (local), `SpeakerGrid`×2 (local), `SponsorWall`×2 (local), `VenueCard`×2 (local), `FaqList`×2 (local), `LinkedInGlyph`×2 (components/dashboard/inlineApps/events/browse-ui.tsx), `XLogo`×2 (components/dashboard/inlineApps/events/browse-ui.tsx), `EmptyPanel` (components/dashboard/inlineApps/events/browse-ui.tsx), `Loader2` (lucide-react), `Hero` (local), `OrgAvatar` (local), `Users` (lucide-react), `AboutSection` (local), `TicketPanel` (local), `SharePanel` (local), `ChevronRight` (lucide-react), `EventCover` (components/dashboard/inlineApps/events/browse-ui.tsx), `LinkIcon` (lucide-react), `ArrowRight` (lucide-react), `SessionCard` (local), `SpeakerStack` (local), `Instagram` (lucide-react), `Globe` (lucide-react), `SponsorMark` (local), `Radio` (lucide-react), `MapPin` (lucide-react), `Navigation` (lucide-react), `EventVenueMap` (components/events/site/EventVenueMap.tsx), `ChevronDown` (lucide-react), `WhatsAppIcon` (components/icons/WhatsAppIcon.tsx), `Mail` (lucide-react)

### Props

- **`EventDetailView`**: `slug: string`, `rootLabel: string`, `onBack: () => void`, `initial?: PublicEventPayload | null`, `onLoaded?: (payload: PublicEventPayload) => void`, `onGetTickets: (slug: string, tierId?: string) => void`

**Hooks used:** `useState`×9, `useRef`×2, `useMemo`×2, `useEventShareUrl` (components/dashboard/inlineApps/events/browse-ui.tsx), `useEffect`, `useCountdown` (lib/hooks/useCountdown.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventDetailView)` | component | `EventDetailView({ slug, rootLabel, onBack, initial, onLoaded, onGetTickets,…)` | 87 |

## Interfaces

- **External hosts mentioned in the code:** `www.google.com`

## Dependencies

- **Internal:**
  - `components/events/site/EventVenueMap.tsx` — `EventVenueMap (default)`
  - `components/events/ShareEventModal.tsx` — `shareTargets`
  - `components/icons/WhatsAppIcon.tsx` — `WhatsAppIcon`
  - `lib/affiliate-share.ts` — `copyToClipboard`
  - `lib/brand-color-context.tsx` — `getBrandHex`
  - `lib/hooks/useCountdown.ts` — `useCountdown`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/inlineApps/events/api.ts` — `getPublicEvent`, `PublicEventPayload`, `PublicTierPayload`
  - `components/dashboard/inlineApps/events/types.ts` — `AgendaSession`, `EventProgram`, `EventSpeaker`, `EventSponsor`, `(types only)`
  - `components/dashboard/inlineApps/events/sections/AgendaSection.tsx` — `TRACK_COLORS`
  - `components/dashboard/inlineApps/events/browse-format.ts` — `clock`, `dateRange`, `dayCount`, `dayKey`, `durationLabel`, `hasEnded`, `isLive`, `money`, … +1
  - `components/dashboard/inlineApps/events/browse-ui.tsx` — `EmptyPanel`, `EventCover`, `LinkedInGlyph`, `OUTLINE_BUTTON`, `PAGE`, `SectionHeading`, `XLogo`, `displayUrl`, … +1
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ArrowRight`, `ChevronDown`, `ChevronRight`, `Globe`, `Instagram`, `Link as LinkIcon`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventFlowView.tsx`
