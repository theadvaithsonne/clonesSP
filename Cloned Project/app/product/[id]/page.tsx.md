# `app/product/[id]/page.tsx`

> Next.js page rendered at `/product/[id]`.

**Kind:** Next.js page · **Lines:** 38 · **Route:** `/product/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `IrlHandoff` (components/garage-irl/IrlHandoff.tsx)

### Props

- **`ProductSharePage`**: `params: Promise<{ id: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params }: Props): Promise<Metadata>` | 12 |
| `default (ProductSharePage)` | component | `async ProductSharePage({ params }: Props)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/garage-irl/IrlHandoff.tsx` — `IrlHandoff (default)`
  - `lib/garageIrl.ts` — `fetchIrlProduct`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/product/[id]` (page).
