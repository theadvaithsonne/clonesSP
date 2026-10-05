# `components/dashboard/AffiliateSettingsPage.tsx`

> React component `AffiliateSettingsPage`.

**Kind:** React component · **Lines:** 536 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×7 (components/ui/label.tsx), `Button`×6 (components/ui/button.tsx), `Input`×5 (components/ui/input.tsx), `Copy`×3 (lucide-react), `Card`×2 (components/ui/card.tsx), `CardHeader`×2 (components/ui/card.tsx), `CardTitle`×2 (components/ui/card.tsx), `Link2`×2 (lucide-react), `CardContent`×2 (components/ui/card.tsx), `ExternalLink`×2 (lucide-react), `EyeOff` (lucide-react), `Eye` (lucide-react), `Settings` (lucide-react), `Switch` (components/ui/switch.tsx)

**Hooks used:** `useState`×6, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliateSettingsPage` | component | `AffiliateSettingsPage()` | 39 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/revenue-network/channels?storeId=${storeId}` (L100)
  - `GET /api/revenue-network/affiliate/links?storeId=${storeId}` (L116)
  - `POST /api/revenue-network/affiliate/links` (L146)
  - `GET /api/revenue-network/affiliate/settings?storeId=${storeId}` (L190)
  - `PUT /api/revenue-network/affiliate/settings` (L235)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/switch.tsx` — `Switch`
  - `lib/auth.ts` — `getToken`
  - `lib/revenue-network-cache.ts` — `getRevenueNetworkData`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Copy`, `ExternalLink`, `Eye`, `EyeOff`, `Settings`, `Link2`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
