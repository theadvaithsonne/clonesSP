# `components/dashboard/Marketplace.tsx`

> React component `MarketplacePage`.

**Kind:** React component · **Lines:** 543 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Link`×3 (next/link), `AppIcon` (components/dashboard/AppIcon.tsx), `CheckCircle2` (lucide-react), `Users` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Checkbox` (components/ui/checkbox.tsx)

### Props

- **`MarketplacePage`**: `onOpenApp?: (appId: string) => void`

**Hooks used:** `useState`×8, `useMemo`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CATALOG` | const | `= [ // { // appId: "garage", // name: "Garage", // url: "https://my.garage.app/", // icon…` | 22 |
| `default (MarketplacePage)` | component | `MarketplacePage({ onOpenApp, }: { onOpenApp?: (appId: string) => void; })` | 148 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/apps/my?orgId=${orgId}` (L177)
  - `GET /backend/apps/admin/assignees?appId=${encodeURIComponent(
          app.appId
        )}&orgId=${orgId}` (L212)
  - `POST /backend/apps/admin/assign?orgId=${orgId}` (L276)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `deals.garage.app`, `taskrooms.garage.app`, `flowboards.garage.app`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/AppIcon.tsx` — `AppIcon (default)`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `next`
  - `sonner` — `toast`
  - `lucide-react` — `Search`, `Users`, `CheckCircle2`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/DeskstreamPage.tsx`
- `components/dashboard/MainSidebar.tsx`
