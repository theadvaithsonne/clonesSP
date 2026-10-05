# `app/docs/layout.tsx`

> Next.js layout for `/docs`.

**Kind:** Next.js layout · **Lines:** 51 · **Route:** `/docs` (layout)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`

### Composition

**Renders:** `Chrome` (app/docs/components/Chrome.tsx)

### Props

- **`DocsLayout`**: `children: React.ReactNode`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { title: { default: "Garage — the manual", template: "%s · Garage docs", }, description…` | 35 |
| `default (DocsLayout)` | component | `DocsLayout({ children }: { children: React.ReactNode })` | 44 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/docs/docs.css` (side effect)
  - `app/docs/components/Chrome.tsx` — `Chrome (default)`
- **Packages:**
  - `next` — `Metadata`, `IBM_Plex_Mono`, `IBM_Plex_Sans`, `IBM_Plex_Serif`

## Used by

Entry: reached by the Next.js router at `/docs` (layout).
