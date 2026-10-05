# `components/dashboard/docusign/shared/AuditTrailView.tsx`

> React component `AuditTrailView`.

**Kind:** React component · **Lines:** 64 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `History` (lucide-react), `Button` (components/ui/button.tsx), `Loader2` (lucide-react)

### Props

- **`AuditTrailView`**: `entries: DsAuditLogEntry[]`, `hasMore?: boolean`, `isLoadingMore?: boolean`, `onLoadMore?: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AuditTrailView` | component | `AuditTrailView({ entries, hasMore, isLoadingMore, onLoadMore }: AuditTrail…)` | 36 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsAuditLogEntry`
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `lucide-react` — `History`, `Loader2`

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
