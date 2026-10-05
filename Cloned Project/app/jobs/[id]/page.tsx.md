# `app/jobs/[id]/page.tsx`

> Next.js page rendered at `/jobs/[id]`.

**Kind:** Next.js page · **Lines:** 88 · **Route:** `/jobs/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `Suspense` (react), `JobLandingClient` (app/jobs/[id]/JobLandingClient.tsx), `CareersPageClient` (components/jobs-public/CareersPageClient.tsx)

### Props

- **`JobsRootPage`**: `params: Promise<{ id: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params }: PageProps): Promise<Metadata>` | 32 |
| `default (JobsRootPage)` | component | `async JobsRootPage({ params }: PageProps)` | 71 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_APP_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/jobs/[id]/JobLandingClient.tsx` — `JobLandingClient (default)`
  - `components/jobs-public/CareersPageClient.tsx` — `CareersPageClient (default)`
  - `components/jobs-public/api.ts` — `fetchCareersPage`
- **Packages:**
  - `react` — `Suspense`
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/jobs/[id]` (page).
