# `components/offices/JoinOfficeDialog.tsx`

> React component `JoinOfficeDialog`.

**Kind:** React component · **Lines:** 215 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Pill`×3 (components/offices/ui.tsx), `PillButton`×3 (components/offices/ui.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `OfficeEmblem` (components/offices/ui.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Loader2` (lucide-react), `Send` (lucide-react), `DoorOpen` (lucide-react)

### Props

- **`JoinOfficeDialog`**: `office: OfficeCardData | null`, `userId: string`, `userName?: string`, `pending: boolean`, `onClose: () => void`, `onJoined: (office: OfficeCardData) => Promise<void> | void`, `onRequested: (office: OfficeCardData) => void`

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JoinOfficeDialog` | component | `JoinOfficeDialog({ office, userId, userName, pending, onClose, onJoined, onR…)` — "Join X?" for an office you're not in. | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogTitle`
  - `lib/discover-api.ts` — `fetchPublicOffice`, `joinPublicOffice`, `requestToJoinOffice`, `PublicOfficeDetails`
  - `components/offices/OfficeCard.tsx` — `OfficeCardData`, `(types only)`
  - `components/offices/ui.tsx` — `OfficeEmblem`, `Pill`, `PillButton`, `initials`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `DoorOpen`, `Loader2`, `Send`
  - `sonner` — `toast`

## Used by

- `app/select-organization/page.tsx`
