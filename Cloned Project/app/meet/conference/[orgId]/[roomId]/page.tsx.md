# `app/meet/conference/[orgId]/[roomId]/page.tsx`

> Next.js page rendered at `/meet/conference/[orgId]/[roomId]`.

**Kind:** Next.js page · **Lines:** 40 · **Route:** `/meet/conference/[orgId]/[roomId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `dynamic`, `revalidate`, `metadata`

### Composition

**Renders:** `ConferenceCallStandalone` (app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx)

### Props

- **`Page`**: `params: Promise<{ orgId: string; roomId: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `dynamic` | const | `= "force-dynamic"` | 7 |
| `revalidate` | const | `= 0` | 8 |
| `metadata` | const | `= { title: "Conference Room", }` | 10 |
| `default (Page)` | component | `async Page({ params, }: { params: Promise<{ orgId: string; roomId: str…)` | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` — `ConferenceCallStandalone (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/meet/conference/[orgId]/[roomId]` (page).
