# `components/dashboard/BankDetailsSection.tsx`

> React component `BankDetailsSection`.

**Kind:** React component · **Lines:** 609 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FieldLabel`×13 (local), `Input`×11 (components/ui/input.tsx), `SectionDivider`×5 (local), `Landmark`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `AddressFields`×2 (local), `Icon` (local), `CheckCircle2` (lucide-react), `Pencil` (lucide-react), `Plus` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Loader2` (lucide-react)

**Hooks used:** `useState`×6, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BankDetailsSection` | component | `BankDetailsSection()` | 207 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/feed-api.ts` — `getBankDetails`, `saveBankDetails`, `BankDetailsData`, `BankAddress`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Landmark`, `Pencil`, `Loader2`, `Plus`, `Building2`, `CreditCard`, …
  - `sonner` — `toast`
  - `country-state-city` — `Country`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
