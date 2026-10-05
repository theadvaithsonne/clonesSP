# `components/dashboard/teamAccess/InvitePeopleDialog.tsx`

> Invite people — multi-email entry plus per-module Admin / No access toggles.

**Kind:** React component · **Lines:** 727 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Invite people — multi-email entry plus per-module Admin / No access toggles.

One constraint shapes this whole dialog: `POST /rbac/grants` and
`/rbac/grants/bulk` take **user ids**, not emails (`{ modules, userId }` /
`{ modules, userIds }` — see src/routes/rbac.ts). So every address typed here
has to resolve to somebody already in the office before it can be granted
anything. Addresses that don't resolve are surfaced as such instead of being
dropped on the floor — inviting a stranger into the org is the `/invites`
flow (Office Settings → Invitees), a different system.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `MemberAvatar`×2 (components/dashboard/teamAccess/shared.tsx), `AccessToggle`×2 (local), `AnimatePresence` (framer-motion), `UserPlus` (lucide-react), `Mail` (lucide-react), `AlertCircle` (lucide-react), `Icon` (local), `Clock3` (lucide-react), `Loader2` (lucide-react), `Send` (lucide-react), `Check` (lucide-react)

### Props

- **`InvitePeopleDialog`**: `open: boolean`, `modules: RbacModule[]`, `members: MemberRow[]`, `onClose: () => void`, `onInvited: () => void`

**Hooks used:** `useState`×6, `useEffect`×5, `useMemo`×2, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InvitePeopleDialog)` | component | `InvitePeopleDialog({ open, modules, members, onClose, onInvited, }: { open: bo…)` | 127 |

## Interfaces

- **Timers / queues:** `setTimeout` at L158

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/rbac-api.ts` — `createBulkGrants`, `isValidEmail`, `notifyRbacChanged`, `MemberRow`, `ModuleKey`, `RbacError`, `RbacModule`
  - `components/dashboard/teamAccess/shared.tsx` — `MemberAvatar`, `moduleIcon`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `AlertCircle`, `Check`, `Clock3`, `Loader2`, `Mail`, `Send`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/teamAccess/TeamAccessPage.tsx`
