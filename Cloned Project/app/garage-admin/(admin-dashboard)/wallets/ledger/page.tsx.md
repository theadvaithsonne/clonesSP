# `app/garage-admin/(admin-dashboard)/wallets/ledger/page.tsx`

> Next.js page rendered at `/garage-admin/wallets/ledger`.

**Kind:** Next.js page · **Lines:** 320 · **Directive:** `"use client"` · **Route:** `/garage-admin/wallets/ledger` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `Link`×2 (next/link), `ListOrdered`×2 (lucide-react), `Input`×2 (components/ui/input.tsx), `FilterChip`×2 (local), `Building2`×2 (lucide-react), `ArrowLeft` (lucide-react), `Loader2` (lucide-react), `Download` (lucide-react), `Icon` (local)

**Hooks used:** `useState`×6, `useMemo`×3, `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LedgerPage)` | component | `LedgerPage()` | 58 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/admin-api/wallets.ts` — `getLedger`, `fetchLedgerCsv`, `WalletTransaction`, `LedgerFilters`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`
  - `next` — `useSearchParams`, `useRouter`
  - `lucide-react` — `Loader2`, `Download`, `ArrowLeft`, `ListOrdered`, `Building2`, `ArrowUpRight`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/wallets/ledger` (page).
