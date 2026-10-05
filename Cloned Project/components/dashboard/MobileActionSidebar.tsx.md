# `components/dashboard/MobileActionSidebar.tsx`

> React component `MobileActionSidebar`.

**Kind:** React component · **Lines:** 1327 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×11 (components/ui/button.tsx), `ActionButton`×11 (local), `Avatar`×6 (components/ui/avatar.tsx), `AvatarImage`×6 (components/ui/avatar.tsx), `AvatarFallback`×6 (components/ui/avatar.tsx), `X`×6 (lucide-react), `Users`×4 (lucide-react), `Bell`×3 (lucide-react), `AnimatePresence`×2 (framer-motion), `ChevronLeft`×2 (lucide-react), `Building2`×2 (lucide-react), `MessageSquare` (lucide-react), `UserPlus` (lucide-react), `Globe` (lucide-react), `AtSign` (lucide-react), `MessageCircle` (lucide-react), `User` (lucide-react), `Settings` (lucide-react), `Link2` (lucide-react), `LogOut` (lucide-react), `PowerOff` (lucide-react), `Power` (lucide-react), `Badge` (components/ui/badge.tsx), `Play` (lucide-react), `Square` (lucide-react), `Clock` (lucide-react), `Coffee` (lucide-react), `Check` (lucide-react), `Trash2` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`MobileActionSidebar`**: `onOpenOrgCabinet?: () => void`, `isClockedIn?: boolean | null`, `clockActionLoading?: boolean`, `onClockToggle?: () => void`, `isRecording?: boolean`, `shouldForceRecording?: boolean`, `onStartRecording?: () => void`, `onStopRecording?: () => void`, `myStatus?: "available" | "busy" | "afk" | "offline"`, `mySpaceId?: string`, `onStatusChange?: (status: "available" | "busy" | "afk") => void`, `onOpenTodo?: () => void`, `onOpenNotifications?: () => void`, `onOpenMembers?: () => void`, `membersCount?: number`, `onOpenFloors?: () => void`, `currentFloorName?: string`, `className?: string`, `amIFounder?: boolean`

**Hooks used:** `useState`×6, `useEffect`×3, `useMobileSidebar` (lib/mobile-sidebar-context.tsx), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (MobileActionSidebar)` | component | `MobileActionSidebar({ onOpenOrgCabinet, isClockedIn, clockActionLoading, onCloc…)` | 151 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `DELETE /backend/user-notifications/${notificationId}` (L254)
  - `POST /backend/auth/logout` (L336)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L200

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/mobile-sidebar-context.tsx` — `useMobileSidebar`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `clearToken`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/revenue-network-cache.ts` — `clearRevenueNetworkCache`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `Bell`, `Building2`, `CheckSquare`, `ChevronLeft`, `ChevronRight`, `Clock`, …
  - `next` — `useRouter`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
