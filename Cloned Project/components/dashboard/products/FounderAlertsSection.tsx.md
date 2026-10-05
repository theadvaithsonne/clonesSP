# `components/dashboard/products/FounderAlertsSection.tsx`

> React component `FounderAlertsSection`.

**Kind:** React component · **Lines:** 203 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Plus` (lucide-react), `X` (lucide-react)

### Props

- **`FounderAlertsSection`**: `value: FounderAlertsValue`, `onChange: (next: FounderAlertsValue) => void`, `context: FounderAlertsContext`

**Hooks used:** `useState`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderAlertsContext` | type | Which surface the section is rendered on. | 12 |
| `FounderAlertsValue` | interface |  | 50 |
| `FounderAlertsSection` | component | `FounderAlertsSection({ value, onChange, context, }: { value: FounderAlertsValue;…)` — "Tell me when someone joins" — the founder's own notification toggle. | 66 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Plus`, `X`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/ServiceFormModal.tsx`
- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/products/useFounderAlerts.ts`
