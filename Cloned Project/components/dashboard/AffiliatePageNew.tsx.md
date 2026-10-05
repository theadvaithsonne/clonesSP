# `components/dashboard/AffiliatePageNew.tsx`

> React component `AffiliatePage`.

**Kind:** React component · **Lines:** 780 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Label`×8 (components/ui/label.tsx), `Card`×5 (components/ui/card.tsx), `CardContent`×5 (components/ui/card.tsx), `Input`×5 (components/ui/input.tsx), `Copy`×4 (lucide-react), `Eye`×3 (lucide-react), `CardHeader`×3 (components/ui/card.tsx), `CardTitle`×3 (components/ui/card.tsx), `Share2`×2 (lucide-react), `AffiliateGlobeView`×2 (components/affiliate/globe/index.ts), `Link2`×2 (lucide-react), `EyeOff`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `Users` (lucide-react), `DollarSign` (lucide-react), `Settings` (lucide-react), `Switch` (components/ui/switch.tsx)

**Hooks used:** `useState`×13, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliatePage` | component | `AffiliatePage()` | 49 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/revenue-network/affiliate/settings?storeId=${storeId}` (L233)
  - `PUT /api/revenue-network/affiliate/settings` (L278)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/feed/channels?orgId=${orgId}` (L160)
  - `GET ${apiUrl}/affiliate/my-affiliate-id` (L181)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `my.garage.app`, `networkchains.com`

## Dependencies

- **Internal:**
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/switch.tsx` — `Switch`
  - `components/affiliate/globe/index.ts` — `AffiliateGlobeView`
  - `lib/auth.ts` — `getToken`
  - `lib/revenue-network-cache.ts` — `getRevenueNetworkData`
  - `lib/revenue-network-api.ts` — `getAffiliateStats`, `AffiliateStats`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Users`, `Share2`, `Eye`, `DollarSign`, `Copy`, `ExternalLink`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`
