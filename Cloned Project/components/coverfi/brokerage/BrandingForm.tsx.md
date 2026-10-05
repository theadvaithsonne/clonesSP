# `components/coverfi/brokerage/BrandingForm.tsx`

> React component `BrandingForm`.

**Kind:** React component · **Lines:** 139 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×2 (components/ui/label.tsx), `Input`×2 (components/ui/input.tsx), `ImageUpload`×2 (components/coverfi/brokerage/ImageUpload.tsx), `ColorField`×2 (local), `Button` (components/ui/button.tsx)

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BrandingForm)` | component | `BrandingForm()` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `lib/coverfi/brokerage-api.ts` — `getBrokerage`, `patchBrokerageBranding`
  - `components/coverfi/brokerage/ImageUpload.tsx` — `ImageUpload (default)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/brokerage/branding/page.tsx`
