# `components/dashboard/docusign/shared/admin/branding/AppearanceSection.tsx`

> React component `AppearanceSection`.

**Kind:** React component · **Lines:** 127 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Segmented`×2 (local), `Check` (lucide-react)

### Props

- **`AppearanceSection`**: `accentColor: string`, `layout: DsBrandingLayout`, `logoSize: DsBrandingLogoSize`, `onChange: (patch: Partial<{ accentColor: string; layout: DsBrandingLa…`, `accentError?: string`

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AppearanceSection` | component | `AppearanceSection({ accentColor, layout, logoSize, onChange, accentError }: A…)` | 39 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/docusign/types.ts` — `DsBrandingLayout`, `DsBrandingLogoSize`, `(types only)`
  - `components/dashboard/docusign/shared/admin/branding/brandingUi.ts` — `ACCENT_SWATCHES`, `FIELD_ERROR`, `FIELD_LABEL`, `HEX_RE`, `SECTION`, `SECTION_SUBTITLE`, `SECTION_TITLE`, `readableTextOn`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `Check`

## Used by

- `components/dashboard/docusign/shared/admin/branding/BrandingTab.tsx`
