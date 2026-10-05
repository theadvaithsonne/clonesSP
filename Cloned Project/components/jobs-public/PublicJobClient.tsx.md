# `components/jobs-public/PublicJobClient.tsx`

> C2 · Public job page — `/jobs/<office slug>/<job slug>?ref=<affiliateId>`.

**Kind:** React component · **Lines:** 554 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
C2 · Public job page — `/jobs/<office slug>/<job slug>?ref=<affiliateId>`.
C3 · "Sign in to apply" gate.

Applying needs a Garage account. Signed-in visitors go straight to the
in-app apply flow (`/workspace?openApp=jobs&jobId=…`); everyone else signs in
through the normal /login flow, which brings them back to that same link.
The referral code rides along twice: on the workspace link (credits this
application to the referrer) and as the signup referral (`ref` on /login,
stored as `referral_code`) so a brand-new account is attributed too.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Chip`×7 (components/dashboard/jobs/ui.tsx), `Link`×4 (next/link), `PublicTopBar`×3 (components/jobs-public/PublicShell.tsx), `PublicState`×2 (components/jobs-public/PublicShell.tsx), `X`×2 (lucide-react), `Users`×2 (lucide-react), `Avatar` (components/dashboard/jobs/ui.tsx), `Copy` (lucide-react), `MessageCircle` (lucide-react), `Linkedin` (lucide-react), `ArrowLeft` (lucide-react), `CalendarClock` (lucide-react), `OrgLogo` (components/dashboard/jobs/ui.tsx), `SafeHtml` (components/dashboard/jobs/ui.tsx), `GraduationCap` (lucide-react), `ShieldCheck` (lucide-react), `Briefcase` (lucide-react), `Clock` (lucide-react), `MapPin` (lucide-react), `PublicFooter` (components/jobs-public/PublicShell.tsx), `ApplyGate` (local), `Check` (lucide-react)

### Props

- **`PublicJobClient`**: `orgSlug: string`, `jobSlug: string`

**Hooks used:** `useSearchParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PublicJobClient)` | component | `PublicJobClient({ orgSlug, jobSlug }: { orgSlug: string; jobSlug: string })` | 55 |

## Interfaces

- **Browser storage / cookies:** `referral_code` (localStorage: set)
- **External hosts mentioned in the code:** `wa.me`, `www.linkedin.com`, `twitter.com`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/jobs/ui.tsx` — `Avatar`, `Chip`, `OrgLogo`, `SafeHtml`, `formatSalary`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `EMPLOYMENT_LABELS`, `WORKPLACE_LABELS`
  - `components/jobs-public/api.ts` — `fetchCareersPage`, `fetchPublicJob`, `PublicJobsError`, `recordJobView`
  - `components/jobs-public/PublicShell.tsx` — `PublicFooter`, `PublicState`, `PublicTopBar`, `loginUrl`
  - `components/jobs-public/types.ts` — `PublicJobResponse`, `(types only)`
- **Packages:**
  - `react`
  - `next` — `useSearchParams`
  - `lucide-react` — `ArrowLeft`, `Briefcase`, `CalendarClock`, `Check`, `Clock`, `Copy`, …
  - `sonner` — `toast`

## Used by

- `app/jobs/[id]/[jobSlug]/page.tsx`
