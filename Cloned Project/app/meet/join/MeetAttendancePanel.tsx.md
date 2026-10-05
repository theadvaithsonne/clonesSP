# `app/meet/join/MeetAttendancePanel.tsx`

> React component `MeetAttendancePanel`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 572 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Users`×4 (lucide-react), `UserX`×4 (lucide-react), `Circle`×4 (lucide-react), `Button`×3 (components/ui/button.tsx), `UserCheck`×2 (lucide-react), `UserPlus`×2 (lucide-react), `ChevronUp`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Clock`×2 (lucide-react), `RefreshCw` (lucide-react), `X` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `Loader2` (lucide-react)

### Props

- **`MeetAttendancePanel`**: `joinCode: string`, `isOpen: boolean`, `onClose: () => void`, `onKickParticipant?: (participantId: string) => void | Promise<void>`

**Hooks used:** `useState`×5, `useCallback`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MeetAttendancePanel)` | component | `MeetAttendancePanel({ joinCode, isOpen, onClose, onKickParticipant, }: MeetAtte…)` | 88 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/meet/attendance?code=${joinCode}` (L115)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L138

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Users`, `UserCheck`, `UserX`, `UserPlus`, `Clock`, `ChevronDown`, …

## Used by

- `app/meet/join/MeetVideoCall.tsx`
