# `components/coverfi/brokerage/LandingPageBuilder.tsx`

> React component `LandingPageBuilder`.

**Kind:** React component · **Lines:** 217 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×4 (components/ui/label.tsx), `Button`×4 (components/ui/button.tsx), `Input`×3 (components/ui/input.tsx), `Badge`×2 (components/ui/badge.tsx), `CheckCircle2` (lucide-react), `Plus` (lucide-react), `X` (lucide-react), `ImageUpload` (components/coverfi/brokerage/ImageUpload.tsx)

**Hooks used:** `useState`×5, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LandingPageBuilder)` | component | `LandingPageBuilder()` | 26 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/coverfi/brokerage-api.ts` — `getBrokerage`, `saveLandingPage`, `publishLandingPage`
  - `components/coverfi/brokerage/ImageUpload.tsx` — `ImageUpload (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Plus`, `X`, `CheckCircle2`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/brokerage/landing/page.tsx`
