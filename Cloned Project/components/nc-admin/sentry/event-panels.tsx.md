# `components/nc-admin/sentry/event-panels.tsx`

> React components `Panel`, `TagsPanel`, `ContextsPanel`, `UserPanel` and 3 more.

**Kind:** React component · **Lines:** 224 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Panel`×6 (local), `KeyVals`×4 (local), `ChevronRight` (lucide-react)

### Props

- **`Panel`**: `title: string`, `count?: number`, `children: React.ReactNode`, `defaultOpen?: boolean`
- **`TagsPanel`**: `event: SentryEvent`
- **`ContextsPanel`**: `event: SentryEvent`
- **`UserPanel`**: `event: SentryEvent`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Panel` | component | `Panel({ title, count, children, defaultOpen = true, }: { title: s…)` — Collapsible titled section shell, matching the admin card language. | 13 |
| `TagsPanel` | component | `TagsPanel({ event }: { event: SentryEvent })` | 69 |
| `ContextsPanel` | component | `ContextsPanel({ event }: { event: SentryEvent })` | 93 |
| `UserPanel` | component | `UserPanel({ event }: { event: SentryEvent })` | 118 |
| `RequestPanel` | component | `RequestPanel({ request }: { request: SentryRequestEntry \| null })` | 129 |
| `BreadcrumbsPanel` | component | `BreadcrumbsPanel({ crumbs }: { crumbs: SentryBreadcrumb[] })` | 172 |
| `RawJsonPanel` | component | `RawJsonPanel({ event }: { event: SentryEvent })` | 215 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-sentry.ts` — `SentryBreadcrumb`, `SentryEvent`, `SentryRequestEntry`, `(types only)`
  - `lib/nc-admin-api/admin-sentry.ts` — `levelClass`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ChevronRight`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/sentry/[issueId]/page.tsx`
