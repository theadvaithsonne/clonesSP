# `components/coverfi/brokerage/ImageUpload.tsx`

> React component `ImageUpload`.

**Kind:** React component · **Lines:** 103 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `ImageIcon` (lucide-react), `Upload` (lucide-react), `X` (lucide-react)

### Props

- **`ImageUpload`**: `value?: string`, `onChange: (url: string) => void`, `label?: string`, `className?: string`, `thumbClass?: string`

**Hooks used:** `useRef`, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ImageUpload)` | component | `ImageUpload({ value, onChange, label, className, thumbClass = "h-24 w-2…)` | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/coverfi/uploadFile.ts` — `uploadFile`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `lucide-react` — `Upload`, `X`, `ImageIcon`
  - `sonner` — `toast`

## Used by

- `components/coverfi/brokerage/BrandingForm.tsx`
- `components/coverfi/brokerage/LandingPageBuilder.tsx`
- `components/coverfi/companies/CompanyDetail.tsx`
- `components/coverfi/companies/CompanyWizard.tsx`
- `components/coverfi/corporate/CorporateInfoTab.tsx`
- `components/coverfi/corporate/CorporateStep2Address.tsx`
- `components/coverfi/insurance/InsuranceCompanyFormDialog.tsx`
- `components/coverfi/products/ProductWizard.tsx`
