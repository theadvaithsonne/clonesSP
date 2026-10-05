# `components/shared/GuestFunnelDialog.tsx`

> React component `GuestFunnelDialog`.

**Kind:** React component · **Lines:** 490 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `AlertCircle`×4 (lucide-react), `Copy`×4 (lucide-react), `Link2`×2 (lucide-react), `X`×2 (lucide-react), `Users`×2 (lucide-react), `Check`×2 (lucide-react), `AnimatePresence` (framer-motion)

### Props

- **`GuestFunnelDialog`**: `isOpen: boolean`, `onClose: () => void`, `affiliateId: string`, `orgName?: string | null`, `orgSlug?: string | null`, `orgId?: string | null`

**Hooks used:** `useState`×5, `useOrgShareOrigin` (lib/hooks/useOrgShareOrigin.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GuestFunnelDialog` | component | `GuestFunnelDialog({ isOpen, onClose, affiliateId, orgName, orgSlug, orgId, }:…)` | 28 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/guest-limit-status?orgId=${orgId}` (L49)
- **Timers / queues:** `setTimeout` at L103
- **External hosts mentioned in the code:** `custom.domain`, `www.garage.app`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`, `slugify`
  - `lib/api.ts` — `api`
  - `lib/hooks/useOrgShareOrigin.ts` — `useOrgShareOrigin`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `sonner` — `toast`
  - `lucide-react` — `Copy`, `X`, `Check`, `Users`, `AlertCircle`, `Link2`
  - `framer-motion` — `motion`, `AnimatePresence`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
