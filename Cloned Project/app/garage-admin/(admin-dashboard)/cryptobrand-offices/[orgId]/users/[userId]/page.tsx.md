# `app/garage-admin/(admin-dashboard)/cryptobrand-offices/[orgId]/users/[userId]/page.tsx`

> Leaf page: /garage-admin/cryptobrand-offices/[orgId]/users/[userId]

**Kind:** Next.js page · **Lines:** 493 · **Directive:** `"use client"` · **Route:** `/garage-admin/cryptobrand-offices/[orgId]/users/[userId]` (page)

<!-- docgen:auto -->

## Purpose
Leaf page: /garage-admin/cryptobrand-offices/[orgId]/users/[userId]

Shows all multi-currency wallets (USD parent + INR / ETH / BTC
siblings) for the selected user on the selected cryptobrand office.
Each wallet row has a "Top up" button that opens a modal to credit
a raw amount in the wallet's native currency (no FX).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Wallet`×2 (lucide-react), `Loader2`×2 (lucide-react), `Coins`×2 (lucide-react), `Plus`×2 (lucide-react), `Label`×2 (components/ui/label.tsx), `Input`×2 (components/ui/input.tsx), `DollarSign` (lucide-react), `Bitcoin` (lucide-react), `Link` (next/link), `ArrowLeft` (lucide-react), `Mail` (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `CardTitle` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `Badge` (components/ui/badge.tsx), `Star` (lucide-react), `TopupModal` (local), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx)

**Hooks used:** `useState`×6, `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useParams` (next/navigation), `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CryptobrandUserWalletsPage)` | component | `CryptobrandUserWalletsPage()` | 89 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/store-wallets/user/${userId}/org/${orgId}` (L104)
  - `POST /garage-admin/store-wallets/${wallet.walletId}/topup` (L303)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `garageAdminApi`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/badge.tsx` — `Badge`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `next` — `useParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Bitcoin`, `Wallet`, `Loader2`, `Plus`, `Mail`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/cryptobrand-offices/[orgId]/users/[userId]` (page).
