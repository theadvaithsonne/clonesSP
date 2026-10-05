# `components/jobs-public/CareersPageClient.tsx`

> C1 · Public careers page — `/jobs/<office slug>`.

**Kind:** React component · **Lines:** 240 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
C1 · Public careers page — `/jobs/<office slug>`.

Everything comes from GET /jobs/public/org/:slug: the office, the careers
page the founder set up in Jobs → Settings, and every live role published
with a public link. Roles link to their public page tagged
`?source=careers_page` so applications are attributed to this page.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PublicTopBar`×3 (components/jobs-public/PublicShell.tsx), `PublicState`×2 (components/jobs-public/PublicShell.tsx), `MapPin`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `OrgLogo` (components/dashboard/jobs/ui.tsx), `Search` (lucide-react), `Briefcase` (lucide-react), `Link` (next/link), `Clock` (lucide-react), `Chip` (components/dashboard/jobs/ui.tsx), `PublicFooter` (components/jobs-public/PublicShell.tsx)

### Props

- **`CareersPageClient`**: `orgSlug: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CareersPageClient)` | component | `CareersPageClient({ orgSlug }: { orgSlug: string })` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `Chip`, `OrgLogo`
  - `components/dashboard/jobs/constants.ts` — `EMPLOYMENT_LABELS`, `WORKPLACE_LABELS`
  - `components/jobs-public/api.ts` — `fetchCareersPage`, `PublicJobsError`
  - `components/jobs-public/PublicShell.tsx` — `PublicFooter`, `PublicState`, `PublicTopBar`
  - `components/jobs-public/types.ts` — `CareersResponse`, `PublicJob`, `(types only)`
- **Packages:**
  - `react`
  - `next`
  - `lucide-react` — `ArrowRight`, `Briefcase`, `Clock`, `MapPin`, `Search`

## Used by

- `app/jobs/[id]/page.tsx`
