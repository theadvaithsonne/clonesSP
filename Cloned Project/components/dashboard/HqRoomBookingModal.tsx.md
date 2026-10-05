# `components/dashboard/HqRoomBookingModal.tsx`

> React component `HqRoomBookingModal`.

**Kind:** React component · **Lines:** 420 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×5 (components/ui/input.tsx), `Label`×3 (components/ui/label.tsx), `Loader2`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Clock` (lucide-react), `AlertTriangle` (lucide-react), `Users` (lucide-react), `Check` (lucide-react), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`HqRoomBookingModal`**: `open: boolean`, `onClose: () => void`, `onBookingCreated: () => void`

**Hooks used:** `useState`×10, `useEffect`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HqRoomBookingModal` | component | `HqRoomBookingModal({ open, onClose, onBookingCreated, }: HqRoomBookingModalPro…)` | 50 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list?orgId=${orgId}` (L97)
  - `GET /backend/room-bookings?orgId=${orgId}&startDate=${dayStart.toISOString()}&endDate=${dayEnd.toISOString()}` (L120)
  - `POST /backend/room-bookings?orgId=${orgId}` (L202)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `sonner` — `toast`
  - `lucide-react` — `Clock`, `Users`, `X`, `Loader2`, `AlertTriangle`, `Check`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
