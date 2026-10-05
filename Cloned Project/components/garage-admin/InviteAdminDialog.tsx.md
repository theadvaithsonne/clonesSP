# `components/garage-admin/InviteAdminDialog.tsx`

> React component `InviteAdminDialog`.

**Kind:** React component · **Lines:** 550 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `Plus`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `Upload` (lucide-react), `DialogTitle` (components/ui/dialog.tsx), `AnimatePresence` (framer-motion), `User2` (lucide-react), `Mail` (lucide-react), `Trash2` (lucide-react), `AdminAccessMatrix` (components/garage-admin/AdminAccessMatrix.tsx)

### Props

- **`InviteAdminDialog`**: `onInvited?: () => void`, `children?: React.ReactNode`

**Hooks used:** `useState`×10, `useCallback`×4, `useEffect`×3, `useRef`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InviteAdminDialog)` | component | `InviteAdminDialog({ onInvited, children, }: { onInvited?: () => void; childre…)` | 43 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `POST /garage-admin/invite` (L268)
- **Timers / queues:** `setTimeout` at L134, L315, L400

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `components/garage-admin/AdminAccessMatrix.tsx` — `AdminAccessMatrix (default)`
  - `lib/admin-api/permissions.ts` — `getAdminPageCatalogue`, `getAdminRolesInUse`, `emptyPermissions`, `AdminPageCatalogue`, `AdminPageLevel`, `AdminRoleInUse`
  - `lib/admin-api/users.ts` — `searchUsers`, `AdminUserSuggestion`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Mail`, `Trash2`, `Plus`, `Upload`, `User2`
  - `sonner` — `toast`

## Used by

- `app/garage-admin/(admin-dashboard)/invitees/page.tsx`
- `app/garage-admin/(admin-dashboard)/layout.tsx`
- `app/garage-admin/(admin-dashboard)/roles/page.tsx`
