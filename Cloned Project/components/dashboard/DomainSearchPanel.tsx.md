# `components/dashboard/DomainSearchPanel.tsx`

> React component `DomainSearchPanel`.

**Kind:** React component · **Lines:** 272 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Check` (lucide-react), `ArrowLeft` (lucide-react), `Search` (lucide-react)

### Props

- **`DomainSearchPanel`**: `orgId: string`

**Hooks used:** `useState`×9

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DomainSearchPanel` | component | `DomainSearchPanel({ orgId }: { orgId: string })` | 42 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/domain-search?${q}` (L63)
  - `POST /backend/initial-setup/domain-request` (L80)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Search`, `Loader2`, `Check`, `ArrowLeft`
  - `sonner` — `toast`

## Used by

- `components/dashboard/DomainManagementPage.tsx`
