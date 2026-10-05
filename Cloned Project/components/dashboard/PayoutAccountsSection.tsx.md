# `components/dashboard/PayoutAccountsSection.tsx`

> React component `PayoutAccountsSection`.

**Kind:** React component · **Lines:** 669 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FieldLabel`×17 (local), `Input`×14 (components/ui/input.tsx), `Button`×8 (components/ui/button.tsx), `SectionDivider`×5 (local), `Loader2`×4 (lucide-react), `Select`×3 (components/ui/select.tsx), `SelectTrigger`×3 (components/ui/select.tsx), `SelectValue`×3 (components/ui/select.tsx), `SelectContent`×3 (components/ui/select.tsx), `SelectItem`×3 (components/ui/select.tsx), `Landmark`×3 (lucide-react), `Coins`×3 (lucide-react), `CheckCircle2`×2 (lucide-react), `Pencil`×2 (lucide-react), `Trash2`×2 (lucide-react), `Plus`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `DialogDescription`×2 (components/ui/dialog.tsx), `AddressFields`×2 (local), `Icon` (local), `Wallet` (lucide-react)

### Props

- **`PayoutAccountsSection`**: `walletType: WalletAccountWalletType`, `orgId?: string | null`

**Hooks used:** `useState`×10, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PayoutAccountsSection` | component | `PayoutAccountsSection({ walletType, orgId, }: { walletType: WalletAccountWalletTy…)` | 218 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/feed-api.ts` — `getWalletAccounts`, `saveWalletAccount`, `deleteWalletAccount`, `WalletAccountData`, `WalletAccountWalletType`, `BankAddress`, `CryptoNetwork`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`
  - `lucide-react` — `Landmark`, `Pencil`, `Loader2`, `Plus`, `Building2`, `CreditCard`, …
  - `sonner` — `toast`
  - `country-state-city` — `Country`

## Used by

- `components/dashboard/WalletPageNew.tsx`
