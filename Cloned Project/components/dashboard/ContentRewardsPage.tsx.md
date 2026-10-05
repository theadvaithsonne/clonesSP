# `components/dashboard/ContentRewardsPage.tsx`

> React component `ContentRewardsPage`.

**Kind:** React component · **Lines:** 1248 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Stat`×12 (local), `Loader2`×10 (lucide-react), `Plus`×4 (lucide-react), `ExternalLink`×4 (lucide-react), `Link2`×3 (lucide-react), `Megaphone`×3 (lucide-react), `CheckCircle2`×3 (lucide-react), `RefreshCw`×3 (lucide-react), `Wallet`×2 (lucide-react), `X`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Lock`×2 (lucide-react), `FileText`×2 (lucide-react), `Trash2`×2 (lucide-react), `Eye`×2 (lucide-react), `SubmissionRow`×2 (local), `BarChart3`×2 (lucide-react), `Icon` (local), `Sparkles` (lucide-react), `ImageIcon` (lucide-react), `Upload` (lucide-react), `DollarSign` (lucide-react), `XCircle` (lucide-react), `ArrowLeft` (lucide-react), `Send` (lucide-react), `ResponsiveContainer` (recharts), `AreaChart` (recharts), `CartesianGrid` (recharts), `XAxis` (recharts), `YAxis` (recharts), `Tooltip` (recharts), `Area` (recharts), `CampaignDetail` (local), `Gift` (lucide-react), `AlertCircle` (lucide-react), `PerformanceDashboard` (local), `Clock` (lucide-react), `CampaignCard` (local), `CreateCampaignModal` (local)

**Hooks used:** `useState`×40, `useEffect`×5, `useRef`, `useBrandColors` (lib/brand-color-context.tsx), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ContentRewardsPage` | component | `ContentRewardsPage()` | 1108 |

## Interfaces

- **External hosts mentioned in the code:** `drive.google.com`

## Dependencies

- **Internal:**
  - `lib/content-rewards-api.ts` — `fetchCampaigns`, `createCampaign`, `updateCampaign`, `deleteCampaign`, `fetchCampaignStats`, `fetchCampaignSubmissions`, `reviewSubmission`, `refreshCampaignViews`, … +9
  - `lib/feed-api.ts` — `uploadFile`
  - `lib/auth.ts` — `getOrgId`
  - `lib/brand-color-context.tsx` — `useBrandColors`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`, `useRef`
  - `lucide-react` — `Gift`, `Plus`, `Eye`, `DollarSign`, `Users`, `CheckCircle2`, …
  - `recharts` — `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, …

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`
