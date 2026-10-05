# `components/dashboard/NotificationPage.tsx`

> React component `NotificationPage`.

**Kind:** React component · **Lines:** 1789 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `AnimatePresence`×4 (framer-motion), `Sparkles`×3 (lucide-react), `X`×3 (lucide-react), `Briefcase`×2 (lucide-react), `CheckSquare`×2 (lucide-react), `MessageSquare`×2 (lucide-react), `Users`×2 (lucide-react), `KeyRound`×2 (lucide-react), `Check`×2 (lucide-react), `Inbox`×2 (lucide-react), `UserPlus` (lucide-react), `Globe` (lucide-react), `AtSign` (lucide-react), `MessageCircle` (lucide-react), `DoorOpen` (lucide-react), `User` (lucide-react), `TrendingUp` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `MissedCallsPanel` (components/dashboard/MissedCallsPanel.tsx)

### Props

- **`NotificationPage`**: `onClose: () => void`, `isMini?: boolean`

**Hooks used:** `useState`×9, `useEffect`×3, `useMemo`×3, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NotificationPage)` | component | `NotificationPage({ onClose, isMini = false, }: { onClose: () => void; isMini…)` | 330 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/user-notifications/${stringId}/read` (L697)
  - `DELETE /backend/user-notifications/${stringId}` (L738)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `crm` (localStorage: last-seen-audit-log/read-audit-logs/cleared-audit-logs/read-audit-logs/cleared-audit-logs/last-seen-audit-log)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/teamAccess/AccessInboxModal.tsx` — `openAccessInbox`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/utils.ts` — `cn`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/leadNotifications.ts` — `getLeadNotifications`, `markNotificationsAsRead`, `removeNotification`, `clearAllNotifications`
  - `components/dashboard/MissedCallsPanel.tsx` — `MissedCallsPanel (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`
  - `next` — `useRouter`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`, `MessageSquare`, `Users`, `UserPlus`, `Check`, `Globe`, …

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/RightPanel.tsx`

## Notes

- Large file (1789 lines) — read it by section; line numbers above point into it.
