# `components/nc-admin/users/meeting-detail.tsx`

> React component `MeetingDetail`.

**Kind:** React component · **Lines:** 204 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ArrowLeft` (lucide-react), `Loader2` (lucide-react)

### Props

- **`MeetingDetail`**: `userId: string`, `sessionId: string`, `onBack: () => void`

**Hooks used:** `useState`×4, `useRef`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MeetingDetail` | component | `MeetingDetail({ userId, sessionId, onBack, }: { userId: string; sessionId…)` — Read-only transcript + summary for one note-taker session. | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin.ts` — `getAdminUserNoteSession`, `AdminUnauthorizedError`, `AdminNoteSessionDetail`
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Loader2`, `ArrowLeft`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/users/[userId]/page.tsx`
