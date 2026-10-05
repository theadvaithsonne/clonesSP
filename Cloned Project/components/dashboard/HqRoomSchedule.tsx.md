# `components/dashboard/HqRoomSchedule.tsx`

> React component `HqRoomSchedule`.

**Kind:** React component · **Lines:** 209 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetHeader` (components/ui/sheet.tsx), `SheetTitle` (components/ui/sheet.tsx), `Building2` (lucide-react), `Button` (components/ui/button.tsx), `Plus` (lucide-react), `Calendar` (lucide-react), `Clock` (lucide-react), `Users` (lucide-react), `Loader2` (lucide-react), `Trash2` (lucide-react)

### Props

- **`HqRoomSchedule`**: `open: boolean`, `onClose: () => void`, `bookings: RoomBooking[]`, `onBookRoom: () => void`, `onRefresh: () => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HqRoomSchedule` | component | `HqRoomSchedule({ open, onClose, bookings, onBookRoom, onRefresh, }: HqRoom…)` | 34 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `PATCH /backend/room-bookings/${bookingId}/cancel?orgId=${orgId}` (L50)
- **Browser storage / cookies:** `garage_user_id` (localStorage: get), `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
  - `components/ui/button.tsx` — `Button`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/workspace/types.ts` — `RoomBooking`
- **Packages:**
  - `react` — `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Building2`, `Calendar`, `Clock`, `Users`, `Trash2`, `Plus`, …

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `components/dashboard/ConferenceRoomPage.tsx`
