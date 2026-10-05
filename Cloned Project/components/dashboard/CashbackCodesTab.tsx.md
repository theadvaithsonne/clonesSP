# `components/dashboard/CashbackCodesTab.tsx`

> React component `CashbackCodesTab`.

**Kind:** React component · **Lines:** 362 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TicketPercent`×3 (lucide-react), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `SummaryCard`×2 (local), `Plus`×2 (lucide-react), `StatusPill` (local), `ProductTypePill` (local), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreHorizontal` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Edit2` (lucide-react), `ListChecks` (lucide-react), `ToggleLeft` (lucide-react), `ToggleRight` (lucide-react), `Sparkles` (lucide-react), `Send` (lucide-react), `CodeRow` (local), `CashbackCodeSheet` (components/dashboard/CashbackCodeSheet.tsx)

### Props

- **`CashbackCodesTab`**: `orgId: string | null`

**Hooks used:** `useState`×3, `useCashbackCodes` (lib/hooks/useCashbackCodes.ts), `useCashbackSummary` (lib/hooks/useCashbackCodes.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CashbackCodesTab` | component | `CashbackCodesTab({ orgId }: Props)` | 199 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
  - `lib/utils.ts` — `cn`
  - `components/dashboard/CashbackCodeSheet.tsx` — `CashbackCodeSheet`
  - `lib/hooks/useCashbackCodes.ts` — `useCashbackCodes`, `useCashbackSummary`, `setCashbackCodeStatus`, `CashbackCode`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `lucide-react` — `TicketPercent`, `Plus`, `Send`, `MoreHorizontal`, `Edit2`, `ToggleLeft`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/WalletPageNew.tsx`
