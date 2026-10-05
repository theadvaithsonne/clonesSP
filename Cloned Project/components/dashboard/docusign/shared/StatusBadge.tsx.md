# `components/dashboard/docusign/shared/StatusBadge.tsx`

> React component `StatusBadge`.

**Kind:** React component · **Lines:** 32 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Badge` (components/ui/badge.tsx)

### Props

- **`StatusBadge`**: `status: string`, `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StatusBadge` | component | `StatusBadge({ status, className }: { status: string; className?: string…)` | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/badge.tsx` — `Badge`
  - `lib/utils.ts` — `cn`
- **Packages:** none

## Used by

- `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
- `components/dashboard/docusign/internal/DocumentsList.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
- `components/dashboard/docusign/shared/BundleBar.tsx`
