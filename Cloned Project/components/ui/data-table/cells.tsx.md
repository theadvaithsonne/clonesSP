# `components/ui/data-table/cells.tsx`

> React components `Dash`, `Avatar`, `PersonBlock`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 78 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dash` (local), `Avatar` (local)

### Props

- **`Avatar`**: `src?: string | null`, `name?: string | null`, `size?: number`
- **`PersonBlock`**: `name?: string | null`, `email?: string | null`, `avatar?: string | null`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Dash` | component | `Dash()` | 9 |
| `initialsOf` | function | `initialsOf(name: string \| null \| undefined): string` | 13 |
| `Avatar` | component | `Avatar({ src, name, size = 32, }: { src?: string \| null; name?: st…)` | 20 |
| `PersonBlock` | component | `PersonBlock({ name, email, avatar, }: { name?: string \| null; email?: s…)` — Person cell: avatar + name + secondary line. | 58 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`

## Used by

- `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx`
- `components/dashboard/docusign/analytics/TopSendersList.tsx`
- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
- `components/deals/companies/CompaniesDataTable.tsx`
- `components/deals/contacts/ContactsDataTable.tsx`
- `components/deals/funnel/FunnelsDataTable.tsx`
- `components/deals/leads/LeadsDataTable.tsx`
- `components/deals/products/ProductsDataTable.tsx`
- `components/downline/speakers-drawer.tsx`
