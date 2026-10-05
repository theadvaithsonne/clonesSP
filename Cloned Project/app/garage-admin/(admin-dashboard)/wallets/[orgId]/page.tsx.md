# `app/garage-admin/(admin-dashboard)/wallets/[orgId]/page.tsx`

> Next.js page rendered at `/garage-admin/wallets/[orgId]`.

**Kind:** Next.js page · **Lines:** 267 · **Directive:** `"use client"` · **Route:** `/garage-admin/wallets/[orgId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×6 (components/ui/button.tsx), `Loader2` (lucide-react), `Link` (next/link), `ArrowLeft` (lucide-react), `Building2` (lucide-react), `Plus` (lucide-react), `Minus` (lucide-react), `Eraser` (lucide-react), `Download` (lucide-react), `Wallet` (lucide-react), `Icon` (local), `WalletActionDialog` (components/admin/wallets/WalletActionDialogs.tsx)

**Hooks used:** `useState`×6, `useParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrgWalletDetailPage)` | component | `OrgWalletDetailPage()` | 41 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/admin/wallets/WalletActionDialogs.tsx` — `WalletActionDialog`
  - `lib/admin-api/wallets.ts` — `getOrgWallet`, `getOrgWalletTransactions`, `OrgWalletDetail`, `WalletTransaction`
  - `lib/csvExport.ts` — `exportRowsAsCsv`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useParams`
  - `lucide-react` — `ArrowLeft`, `Loader2`, `Plus`, `Minus`, `Eraser`, `Building2`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/wallets/[orgId]` (page).
