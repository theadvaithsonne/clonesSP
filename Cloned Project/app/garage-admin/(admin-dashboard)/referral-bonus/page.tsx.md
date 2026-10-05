# `app/garage-admin/(admin-dashboard)/referral-bonus/page.tsx`

> Next.js page rendered at `/garage-admin/referral-bonus`.

**Kind:** Next.js page · **Lines:** 432 · **Directive:** `"use client"` · **Route:** `/garage-admin/referral-bonus` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Stat`×3 (local), `AlertTriangle`×2 (lucide-react), `Gift`×2 (lucide-react), `Loader2` (lucide-react), `RefreshCw` (lucide-react), `PowerOff` (lucide-react), `Wallet` (lucide-react), `Users` (lucide-react), `MailWarning` (lucide-react)

**Hooks used:** `useState`×6, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ReferralBonusPage)` | component | `ReferralBonusPage()` | 57 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/referral-bonus` (L70)
  - `GET /garage-admin/referral-bonus/payouts?limit=25` (L71)
  - `PUT /garage-admin/referral-bonus` (L93)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Gift`, `Loader2`, `RefreshCw`, `Wallet`, `AlertTriangle`, `Users`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/referral-bonus` (page).
