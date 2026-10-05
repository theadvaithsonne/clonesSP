# `components/nc-admin/sentry/stack-trace.tsx`

> React component `StackTrace`.

**Kind:** React component · **Lines:** 142 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ExceptionBlock` (local), `Frame` (local), `ChevronRight` (lucide-react)

### Props

- **`StackTrace`**: `values: SentryExceptionValue[]`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StackTrace` | component | `StackTrace({ values }: { values: SentryExceptionValue[] })` — Sentry-faithful stack trace: chained exceptions, newest frame first, in-app frames highlighted and expanded, with pre/error/post source context. | 11 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin-sentry.ts` — `SentryExceptionValue`, `SentryFrame`, `(types only)`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ChevronRight`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/sentry/[issueId]/page.tsx`
