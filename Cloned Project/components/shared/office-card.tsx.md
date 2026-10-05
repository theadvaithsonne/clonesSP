# `components/shared/office-card.tsx`

> React component `OfficeCard`.

**Kind:** React component · **Lines:** 99 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Stat`×3 (local)

### Props

- **`OfficeCard`**: `item: OfficeCardItem`, `selected?: boolean`, `dimmed?: boolean`, `onClick?: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeCardItem` | interface | The one canonical office card (#43), shared by the Links page and anywhere else an office/organization is surfaced (e.g. | 13 |
| `OfficeCard` | component | `OfficeCard({ item, selected, dimmed, onClick, }: { item: OfficeCardIte…)` | 27 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `framer-motion` — `motion`

## Used by

- `components/garage/link-picker.tsx`
- `lib/affiliate/link-card-adapters.ts`
