# `components/dashboard/InviteMemberDialog.tsx`

> React component `InviteMemberDialog`.

**Kind:** React component · **Lines:** 645 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Input`×4 (components/ui/input.tsx), `AnimatePresence`×2 (framer-motion), `User2`×2 (lucide-react), `Mail`×2 (lucide-react), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Building2`×2 (lucide-react), `Trash2`×2 (lucide-react), `Plus`×2 (lucide-react), `Info` (lucide-react), `UserPlus` (lucide-react), `X` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `Upload` (lucide-react), `DialogTitle` (components/ui/dialog.tsx)

### Props

- **`InviteMemberDialog`**: `onInvited?: () => void`, `children?: React.ReactNode`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`

**Hooks used:** `useState`×4, `useCallback`×3, `useMemo`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InviteMemberDialog)` | component | `InviteMemberDialog({ onInvited, children, open: controlledOpen, onOpenChange, …)` | 54 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/floors?orgId=${orgId}` (L83)
  - `POST /backend/invites/create?orgId=${orgId}` (L219)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L246

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Mail`, `Shield`, `Trash2`, `Plus`, `Upload`, `Building2`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/RightPanel.tsx`
