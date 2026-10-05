# `components/dashboard/MultiCurrencyTransferSheet.tsx`

> Multi-currency transfer + convert sheet for cryptobrand offices.

**Kind:** React component · **Lines:** 444 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Multi-currency transfer + convert sheet for cryptobrand offices.

Two modes:
  • "convert": self-transfer between my currency wallets in the same
    or a different org I'm a member of.
  • "transfer": cross-user transfer with optional currency conversion
    at spot (I send USD, they receive BTC).

Backed by:
  GET  /wallet/store/currencies?orgId=X
  POST /wallet/store/convert
  POST /wallet/store/transfer-multi

The wallet chooser filters to actual currencies the target user
holds — non-cryptobrand orgs only expose USD. FX preview updates
as the user types the amount (500ms debounce, uses the same helper […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×5 (components/ui/label.tsx), `Input`×3 (components/ui/input.tsx), `Loader2`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `ArrowLeftRight` (lucide-react), `Send` (lucide-react), `ArrowRight` (lucide-react)

### Props

- **`MultiCurrencyTransferSheet`**: `open: boolean`, `onClose: () => void`, `mode: TransferMode`, `myOrgs: OrgOption[]`, `defaultFromOrgId?: string`, `defaultFromCurrency?: string`, `recipient?: { userId: string; name: string; orgs: OrgOption[] }`, `onCompleted?: () => void`

**Hooks used:** `useState`×14, `useEffect`×3, `useMemo`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TransferMode` | type |  | 42 |
| `OrgOption` | interface |  | 44 |
| `TransferSheetProps` | interface |  | 50 |
| `MultiCurrencyTransferSheet` | component | `MultiCurrencyTransferSheet({ open, onClose, mode, myOrgs, defaultFromOrgId, defaultFro…)` | 81 |

## Interfaces

- **Timers / queues:** `setTimeout` at L164

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `lib/feed-api.ts` — `getStoreWalletCurrencies`, `convertStoreWallet`, `transferStoreWalletMulti`, `StoreWalletCurrencyEntry`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `Loader2`, `ArrowRight`, `ArrowLeftRight`, `Send`, `X`, `ChevronDown`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WalletPageNew.tsx`
