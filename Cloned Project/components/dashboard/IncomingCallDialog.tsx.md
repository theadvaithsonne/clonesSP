# `components/dashboard/IncomingCallDialog.tsx`

> React component `IncomingCallDialog`.

**Kind:** React component · **Lines:** 85 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `DialogTitle` (components/ui/dialog.tsx), `Mic` (lucide-react), `Video` (lucide-react), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `PhoneOff` (lucide-react), `Phone` (lucide-react)

### Props

- **`IncomingCallDialog`**: `open: boolean`, `callerName?: string`, `callType?: 'audio' | 'video'`, `onAccept: () => void`, `onDecline: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (IncomingCallDialog)` | component | `IncomingCallDialog({ open, callerName, callType = 'video', onAccept, onDecline…)` | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
- **Packages:**
  - `lucide-react` — `Phone`, `PhoneOff`, `Video`, `Mic`

## Used by

- `app/(dashboard)/layout.tsx`
