# `app/a/[code]/page.tsx`

> Next.js page rendered at `/a/[code]`.

**Kind:** Next.js page · **Lines:** 19 · **Route:** `/a/[code]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`

### Composition

**Renders:** `IrlHandoff` (components/garage-irl/IrlHandoff.tsx)

### Props

- **`BillQrPage`**: `params: Promise<{ code: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { title: "GarageIRL", robots: { index: false, follow: false }, }` | 6 |
| `default (BillQrPage)` | component | `async BillQrPage({ params, }: { params: Promise<{ code: string }>; })` | 11 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-irl/IrlHandoff.tsx` — `IrlHandoff (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/a/[code]` (page).
