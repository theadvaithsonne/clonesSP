# `components/dashboard/BookingDialog.tsx`

> React component `BookingDialog`.

**Kind:** React component · **Lines:** 247 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Calendar`×3 (lucide-react), `Input`×2 (components/ui/input.tsx), `Clock`×2 (lucide-react), `Loader2`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `AlertCircle` (lucide-react)

### Props

- **`BookingDialog`**: `targetUser: PeerState | null`, `onClose: () => void`

**Hooks used:** `useState`×7, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BookingDialog)` | component | `BookingDialog({ targetUser, onClose, }: BookingDialogProps)` | 23 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/calendar/${targetUser.id}/slots?date=${date}&orgId=${orgId}` (L46)
  - `POST /backend/calendar/bookings?orgId=${orgId}` (L87)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `app/(dashboard)/workspace/types.ts` — `PeerState`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `sonner` — `toast`
  - `lucide-react` — `Calendar`, `Clock`, `Loader2`, `AlertCircle`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
