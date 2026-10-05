# `app/taskroom/backOffice/athena/short/[id]/page.tsx`

> Next.js page rendered at `/taskroom/backOffice/athena/short/[id]`.

**Kind:** Next.js page · **Lines:** 74 · **Route:** `/taskroom/backOffice/athena/short/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Props

- **`ShortUrlPage`**: `params: { id: string }`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, }: { params: { id: string }; }): Promise<Metadata>` | 34 |
| `default (ShortUrlPage)` | component | `async ShortUrlPage({ params, }: { params: { id: string }; })` | 62 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${baseUrl}short/urls/${id}` (L23)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `next` — `Metadata`, `redirect`

## Used by

Entry: reached by the Next.js router at `/taskroom/backOffice/athena/short/[id]` (page).
