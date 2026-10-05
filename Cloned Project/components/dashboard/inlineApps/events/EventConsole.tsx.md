# `components/dashboard/inlineApps/events/EventConsole.tsx`

> One event's workspace.

**Kind:** React component · **Lines:** 567 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
One event's workspace.

Deliberately has NO navigation of its own. The PLAN / SELL / REACH sections
are driven by the dashboard's floating bottom bar (see `founder-events` in
app/(dashboard)/layout.tsx), the same way Deals and Taskroom work — so the
screen is the event, not a sidebar next to the event.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/dashboard/inlineApps/events/ui.tsx), `StatTile`×4 (components/dashboard/inlineApps/events/ui.tsx), `Card`×3 (components/dashboard/inlineApps/events/ui.tsx), `Layers`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `Loader2` (lucide-react), `Overview` (local), `AgendaSection` (components/dashboard/inlineApps/events/sections/AgendaSection.tsx), `SpeakersSection` (components/dashboard/inlineApps/events/sections/SpeakersSection.tsx), `SponsorsSection` (components/dashboard/inlineApps/events/sections/SponsorsSection.tsx), `TicketsSection` (components/dashboard/inlineApps/events/sections/TicketsSection.tsx), `RegistrationsSection` (components/dashboard/inlineApps/events/sections/RegistrationsSection.tsx), `CouponsSection` (components/dashboard/inlineApps/events/sections/CouponsSection.tsx), `WebsiteLaunchpad` (local), `WebsiteSettings` (components/dashboard/inlineApps/events/sections/WebsiteSettings.tsx), `CampaignsSection` (components/dashboard/inlineApps/events/sections/CampaignsSection.tsx), `CreateEventModal` (components/dashboard/inlineApps/events/CreateEventModal.tsx), `Maximize2` (lucide-react), `Pencil` (lucide-react), `LinkIcon` (lucide-react), `Check` (lucide-react), `Circle` (lucide-react), `Globe` (lucide-react)

### Props

- **`EventConsole`**: `eventId: string`, `section: ConsoleSection`, `onSectionChange: (s: ConsoleSection) => void`, `onBack: () => void`, `onOpenBuilder: (publicUrl: string) => void`, `onManageCoupons?: () => void`, `onOpenNetworkMail?: (campaignId: string) => void`

**Hooks used:** `useState`×7, `useEffect`×4, `useCallback`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ConsoleSection` | type |  | 49 |
| `default (EventConsole)` | component | `EventConsole({ eventId, section, onSectionChange, onBack, onOpenBuilder,…)` | 80 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `GOLD`, `StatTile`, `formatMoney`, `ConsoleAction`
  - `components/dashboard/inlineApps/events/api.ts` — `getEvent`, `publishEvent`, `unpublishEvent`
  - `components/dashboard/inlineApps/events/announceEvent.ts` — `announceEvent`
  - `components/dashboard/inlineApps/events/types.ts` — `ChecklistItem`, `EventMetrics`, `EventProgram`, `TicketTier`, `(types only)`
  - `components/dashboard/inlineApps/events/sections/TicketsSection.tsx` — `TicketsSection (default)`
  - `components/dashboard/inlineApps/events/sections/RegistrationsSection.tsx` — `RegistrationsSection (default)`
  - `components/dashboard/inlineApps/events/sections/CouponsSection.tsx` — `CouponsSection (default)`
  - `components/dashboard/inlineApps/events/sections/SpeakersSection.tsx` — `SpeakersSection (default)`
  - `components/dashboard/inlineApps/events/sections/AgendaSection.tsx` — `AgendaSection (default)`
  - `components/dashboard/inlineApps/events/sections/SponsorsSection.tsx` — `SponsorsSection (default)`
  - `components/dashboard/inlineApps/events/sections/CampaignsSection.tsx` — `CampaignsSection (default)`
  - `components/dashboard/inlineApps/events/sections/WebsiteSettings.tsx` — `WebsiteSettings (default)`
  - `components/dashboard/inlineApps/events/CreateEventModal.tsx` — `CreateEventModal (default)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Check`, `Circle`, `ExternalLink`, `Globe`, `Layers`, `Link as LinkIcon`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventsApp.tsx`
