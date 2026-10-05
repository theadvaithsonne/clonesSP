# `components/office/AccessControlModal.tsx`

> React component `AccessControlModal`.

**Kind:** React component · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ToggleRow`×2 (local), `X` (lucide-react), `Mic` (lucide-react), `ScreenShare` (lucide-react), `Loader2` (lucide-react)

### Props

- **`AccessControlModal`**: `open: boolean`, `initial: AccessPolicy`

**Hooks used:** `useState`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AccessControlModal)` | component | `AccessControlModal({ open, initial, onConfirm, onSkip, }: Props)` — Pre-meeting access-control modal shown to the host before entering the room. | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `hooks/office/useAccessControl.ts` — `AccessPolicy`, `(types only)`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Loader2`, `Mic`, `ScreenShare`, `X`

## Used by

- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`
