# `components/dashboard/docusign/shared/admin/branding/BrandingTab.tsx`

> React component `BrandingTab`.

**Kind:** React component · **Lines:** 290 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Palette` (lucide-react), `Loader2` (lucide-react), `AppearanceSection` (components/dashboard/docusign/shared/admin/branding/AppearanceSection.tsx), `EmailContentSection` (components/dashboard/docusign/shared/admin/branding/EmailContentSection.tsx), `BrandingPreview` (components/dashboard/docusign/shared/admin/branding/BrandingPreview.tsx)

### Props

- **`BrandingTab`**: `onDirtyChange?: (dirty: boolean) => void`

**Hooks used:** `useState`×10, `useEffect`×5, `useCallback`×2, `useMemo`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BrandingTab` | component | `BrandingTab({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => vo…)` | 29 |

## Interfaces

- **Timers / queues:** `setTimeout` at L91

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/docusign/shared-api.ts` — `getDocusignBranding`, `previewDocusignBranding`, `updateDocusignBranding`
  - `lib/docusign/types.ts` — `DsBranding`, `DsBrandingEditor`, `DsBrandingFieldError`, `DsBrandingPreview`, `DsEmailContent`, `DsEmailKind`, `(types only)`
  - `components/dashboard/docusign/shared/admin/branding/AppearanceSection.tsx` — `AppearanceSection`
  - `components/dashboard/docusign/shared/admin/branding/EmailContentSection.tsx` — `EmailContentSection`
  - `components/dashboard/docusign/shared/admin/branding/BrandingPreview.tsx` — `BrandingPreview`
  - `components/dashboard/docusign/shared/admin/branding/brandingUi.ts` — `FIELD_ERROR`, `FIELD_HINT`, `FIELD_LABEL`, `TEXT_AREA`, `TEXT_INPUT`, `errorFor`, `normalizeBranding`, `withDefaultsFilled`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Loader2`, `Palette`

## Used by

- `components/dashboard/docusign/shared/AdminPanel.tsx`
