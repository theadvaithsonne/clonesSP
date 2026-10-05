# `components/dashboard/CalendarPage.tsx`

> React component `CalendarPage`.

**Kind:** React component · **Lines:** 729 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `FileText` (lucide-react), `Settings` (lucide-react), `AnimatePresence` (framer-motion), `CalendarHeader` (components/dashboard/calendar/CalendarHeader.tsx), `CalendarGrid` (components/dashboard/calendar/CalendarGrid.tsx), `EventDetailsModal` (components/dashboard/calendar/EventDetailsModal.tsx), `CreateEventModal` (components/dashboard/calendar/CreateEventModal.tsx), `EditEventModal` (components/dashboard/calendar/EditEventModal.tsx), `EditMembersModal` (components/dashboard/calendar/EditMembersModal.tsx), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `AlertCircle` (lucide-react), `Loader2` (lucide-react), `Save` (lucide-react), `CardContent` (components/ui/card.tsx), `Switch` (components/ui/switch.tsx)

**Hooks used:** `useState`×15, `useEffect`×3, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CalendarPage)` | component | `CalendarPage()` | 80 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/calendar/availability?orgId=${orgId}` (L133)
  - `GET /backend/calendar/availability?orgId=${orgId}` (L170)
  - `GET /backend/calendar/bookings?orgId=${orgId}` (L175)
  - `GET /backend/events?orgId=${orgId}` (L180)
  - `PATCH /backend/calendar/bookings/${bookingId}/cancel?orgId=${orgId}` (L360)
  - `DELETE /backend/events/${eventId}?orgId=${orgId}` (L400)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L114; `setTimeout` at L127

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/calendar/CalendarHeader.tsx` — `CalendarHeader`
  - `components/dashboard/calendar/CalendarGrid.tsx` — `CalendarGrid`
  - `components/dashboard/calendar/EventDetailsModal.tsx` — `EventDetailsModal`
  - `components/dashboard/calendar/CreateEventModal.tsx` — `CreateEventModal`
  - `components/dashboard/calendar/EditEventModal.tsx` — `EditEventModal`
  - `components/dashboard/calendar/EditMembersModal.tsx` — `EditMembersModal`
  - `lib/calendarUtils.ts` — `ViewMode`, `CalendarEvent`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useRef`
  - `sonner` — `toast`
  - `lucide-react` — `Save`, `Loader2`, `Settings`, `AlertCircle`, `FileText`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
