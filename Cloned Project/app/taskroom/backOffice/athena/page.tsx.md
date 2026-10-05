# `app/taskroom/backOffice/athena/page.tsx`

> Next.js page rendered at `/taskroom/backOffice/athena`.

**Kind:** Next.js page · **Lines:** 93 · **Route:** `/taskroom/backOffice/athena` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `Suspense` (react), `Loader2` (lucide-react), `AthenaDeepLink` (app/taskroom/backOffice/athena/AthenaDeepLink.tsx)

### Props

- **`Page`**: `searchParams?: Record<string, string | string[] | undefined>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ searchParams }: Props): Promise<Metadata>` | 43 |
| `default (Page)` | component | `async Page({ searchParams }: Props)` | 80 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_APP_URL`
- **External hosts mentioned in the code:** `garage.app`

## Dependencies

- **Internal:**
  - `app/taskroom/backOffice/athena/AthenaDeepLink.tsx` — `AthenaDeepLink (default)`
- **Packages:**
  - `react` — `Suspense`
  - `next` — `Metadata`
  - `lucide-react` — `Loader2`

## Used by

Entry: reached by the Next.js router at `/taskroom/backOffice/athena` (page).
