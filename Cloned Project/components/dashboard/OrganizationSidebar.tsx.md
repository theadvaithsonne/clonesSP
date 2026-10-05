# `components/dashboard/OrganizationSidebar.tsx`

> React component `OrganizationSidebar`.

**Kind:** React component · **Lines:** 585 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `SidebarTooltipButton`×2 (local), `Compass`×2 (lucide-react), `Clock`×2 (lucide-react), `AnimatePresence` (framer-motion), `OrgItemWithTooltip` (local), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `RoleIcon` (local), `Loader2` (local), `Badge` (components/ui/badge.tsx)

### Props

- **`OrganizationSidebar`**: `collapsed: boolean`, `setActivePopover?: (popover: string | null) => void`, `onMobileClose?: () => void`

**Hooks used:** `useState`×8, `useCallback`×3, `useRef`×2, `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Organization` | type |  | 125 |
| `UserWithOrgs` | type |  | 134 |
| `default (OrganizationSidebar)` | component | `OrganizationSidebar({ collapsed, setActivePopover, onMobileClose, }: Organizati…)` | 148 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/auth/me` (L192)
  - `POST /backend/auth/select-org` (L227)
  - `POST /backend/auth/logout` (L274)
- **Timers / queues:** `setTimeout` at L260
- **External hosts mentioned in the code:** `www.garage.app`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`, `saveToken`, `saveOrgId`, `clearToken`
  - `lib/revenue-network-cache.ts` — `clearRevenueNetworkCache`, `getPageCache`, `setPageCache`
  - `lib/socket.ts` — `connectSocket`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`, `useCallback`
  - `react-dom` — `createPortal`
  - `next` — `useRouter`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `Crown`, `Badge as BadgeIcon`, `Plus`, `LogOut`, …
  - `sonner` — `toast`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
