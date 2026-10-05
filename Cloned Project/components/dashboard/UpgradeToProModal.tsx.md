# `components/dashboard/UpgradeToProModal.tsx`

> React component `UpgradeToProModal`.

**Kind:** React component · **Lines:** 506 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×4 (lucide-react), `Button`×2 (components/ui/button.tsx), `Rocket`×2 (lucide-react), `Crown`×2 (lucide-react), `Loader2`×2 (lucide-react), `Sparkles`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogTrigger` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Wallet` (lucide-react), `Calendar` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`UpgradeToProModal`**: `onUpgraded?: () => void`, `children?: React.ReactNode`

**Hooks used:** `useState`×14, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (UpgradeToProModal)` | component | `UpgradeToProModal({ onUpgraded, children, }: { onUpgraded?: () => void; child…)` | 63 |
| `useCanUpgrade` | hook | `useCanUpgrade()` | 346 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/checkout/office/${orgId}/upgrade/preview` (L87)
  - `POST /backend/checkout/office/${orgId}/upgrade/initiate` (L114)
  - `GET /backend/office-subscription/status?orgId=${orgId}` (L383)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L147

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `Rocket`, `Crown`, `Check`, `ArrowRight`, `Loader2`, `Sparkles`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MainSidebar.tsx`
