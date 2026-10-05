# `components/dashboard/ContentRewardsAffiliatePage.tsx`

> React component `ContentRewardsAffiliatePage`.

**Kind:** React component · **Lines:** 132 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Sparkles`×2 (lucide-react), `Users` (lucide-react), `Eye` (lucide-react), `ArrowRight` (lucide-react), `Loader2` (lucide-react), `Gift` (lucide-react), `ExternalLink` (lucide-react), `DiscoverCampaignCard` (local)

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ContentRewardsAffiliatePage` | component | `ContentRewardsAffiliatePage()` | 82 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_NC_REWARDS_URL`
- **External hosts mentioned in the code:** `networkchains.com`

## Dependencies

- **Internal:**
  - `lib/content-rewards-api.ts` — `fetchActiveCampaigns`, `Campaign`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Gift`, `Loader2`, `Sparkles`, `Eye`, `Users`, `ExternalLink`, …

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`
