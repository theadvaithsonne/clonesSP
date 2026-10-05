# `components/dashboard/docusign/shared/LazyPdfPage.tsx`

> React component `LazyPdfPage`.

**Kind:** React component · **Lines:** 113 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Suspense` (react), `Page` (react-pdf)

**Hooks used:** `useState`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LazyPdfPage` | component | `memo(LazyPdfPageImpl)` | 112 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `memo`, `Suspense`, `useEffect`, `useRef`, `useState`
  - `react-pdf` — `Page`

## Used by

- `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`
- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
