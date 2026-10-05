# `components/dashboard/OfficeSubscriptionLock.tsx`

> React component `OfficeSubscriptionLock`.

**Kind:** React component · **Lines:** 652 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×6 (lucide-react), `Button`×5 (components/ui/button.tsx), `RefreshCw`×3 (lucide-react), `UserCircle`×2 (lucide-react), `CreditCard`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `OfficeSubscriptionLockImpl` (local), `AlertTriangle` (lucide-react), `Lock` (lucide-react), `FileText` (lucide-react), `ArrowRight` (lucide-react), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `Building2` (lucide-react)

### Props

- **`OfficeSubscriptionLock`**: `children: React.ReactNode`

**Hooks used:** `useState`×12, `useEffect`×5, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeSubscriptionLock` | component | `OfficeSubscriptionLock({ children, }: OfficeSubscriptionLockProps)` — Public wrapper — decides whether to mount the real lock implementation or bypass it entirely. | 89 |
| `useOfficeSubscription` | hook | `useOfficeSubscription()` | 594 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/checkout/office/${currentOrgId}/refresh-status` (L169)
  - `GET /backend/checkout/office/${currentOrgId}/recovery` (L200)
  - `GET /backend/auth/me` (L227)
  - `POST /backend/auth/select-org` (L248)
  - `GET /backend/office-subscription/status?orgId=${orgId}` (L290)
- **Socket.IO events:**
  - listens for: `office:subscription:update`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L164; `setTimeout` at L262

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `saveToken`, `saveOrgId`, `getUserIdFromToken`
  - `lib/revenue-network-cache.ts` — `clearRevenueNetworkCache`
  - `lib/socket.ts` — `connectSocket`, `getSocket`
  - `lib/featureFlags.ts` — `SUBSCRIPTIONS_ENABLED`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`
  - `next` — `useRouter`
  - `lucide-react` — `Lock`, `CreditCard`, `ArrowRight`, `Loader2`, `RefreshCw`, `UserCircle`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
