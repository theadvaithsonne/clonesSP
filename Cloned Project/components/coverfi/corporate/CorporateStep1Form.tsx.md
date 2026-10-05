# `components/coverfi/corporate/CorporateStep1Form.tsx`

> React component `CorporateStep1Form`.

**Kind:** React component · **Lines:** 309 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×14 (components/ui/input.tsx), `Field`×8 (local), `Button`×4 (components/ui/button.tsx), `Link` (next/link), `ArrowLeft` (lucide-react), `Stepper` (components/coverfi/corporate/Stepper.tsx), `Plus` (lucide-react), `X` (lucide-react), `Label` (components/ui/label.tsx)

**Hooks used:** `useState`×3, `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateStep1Form)` | component | `CorporateStep1Form()` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `lib/coverfi/corporate-api.ts` — `createCorporateStep1`
  - `lib/coverfi/types.ts` — `CorporatePoc`, `(types only)`
  - `components/coverfi/corporate/Stepper.tsx` — `Stepper`, `STEP_LABELS`
- **Packages:**
  - `react` — `useState`
  - `next` — `useRouter`
  - `lucide-react` — `ArrowLeft`, `Plus`, `X`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/corporate/new/page.tsx`
