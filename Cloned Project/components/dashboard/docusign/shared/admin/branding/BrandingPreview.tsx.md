# `components/dashboard/docusign/shared/admin/branding/BrandingPreview.tsx`

> React component `BrandingPreview`.

**Kind:** React component · **Lines:** 57 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `InboxStrip` (local), `ResponsiveEmailFrame` (components/shared/EmailTemplatePreview.tsx)

### Props

- **`BrandingPreview`**: `preview: DsBrandingPreview | null`, `isLoading: boolean`, `error: string | null`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BrandingPreview` | component | `BrandingPreview({ preview, isLoading, error }: BrandingPreviewProps)` | 34 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/shared/EmailTemplatePreview.tsx` — `ResponsiveEmailFrame`
  - `lib/docusign/types.ts` — `DsBrandingPreview`, `(types only)`
- **Packages:**
  - `lucide-react` — `Loader2`

## Used by

- `components/dashboard/docusign/shared/admin/branding/BrandingTab.tsx`
