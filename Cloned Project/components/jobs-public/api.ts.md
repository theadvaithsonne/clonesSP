# `components/jobs-public/api.ts`

> Plain-fetch client for the public Garage Jobs endpoints.

**Kind:** React component · **Lines:** 66

<!-- docgen:auto -->

## Purpose
Plain-fetch client for the public Garage Jobs endpoints. No auth header:
these pages must work for visitors without a Garage account. Also used by
the route files' `generateMetadata`, so it has no client-only imports.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PUBLIC_API_URL` | const | `= (process.env.NEXT_PUBLIC_API_URL \|\| "http://localhost:4000").replace(/\/+$/, "")` | 7 |
| `PublicJobsError` | class | `extends Error` | 9 |
| `fetchCareersPage` | function | `fetchCareersPage(orgSlug: string, init?: RequestInit & { next?: { revalidate?: number } })` | 40 |
| `fetchPublicJob` | function | `fetchPublicJob(orgSlug: string, jobSlug: string, ref?: string \| null, init?: RequestInit & { next?: { revalidate?: number } })` | 44 |
| `recordJobView` | function | `recordJobView(jobId: string, source: string): void` — Count one view for the job's analytics. | 58 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${path}` (L23)
  - `POST /backend/jobs/public/job/${encodeURIComponent(jobId)}/view` (L59)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `components/jobs-public/types.ts` — `CareersResponse`, `PublicJobResponse`, `(types only)`
- **Packages:** none

## Used by

- `app/jobs/[id]/[jobSlug]/page.tsx`
- `app/jobs/[id]/page.tsx`
- `components/jobs-public/CareersPageClient.tsx`
- `components/jobs-public/PublicJobClient.tsx`
