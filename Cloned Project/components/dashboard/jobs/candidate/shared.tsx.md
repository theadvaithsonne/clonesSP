# `components/dashboard/jobs/candidate/shared.tsx`

> Small pieces shared by the candidate screens: job facts formatting, the bookmark button and the job cards used in lists.

**Kind:** React component · **Lines:** 150 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Small pieces shared by the candidate screens: job facts formatting, the
bookmark button and the job cards used in lists.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Bookmark`×2 (lucide-react), `OrgLogo` (components/dashboard/jobs/ui.tsx), `SaveButton` (local), `MapPin` (lucide-react), `ApplicationBadge` (local), `RewardBadge` (components/dashboard/jobs/ui.tsx)

### Props

- **`SaveButton`**: `jobId: string`, `compact?: boolean`
- **`ApplicationBadge`**: `job: PublicJob`
- **`JobCard`**: `job: PublicJob`, `onOpen: () => void`, `footer?: React.ReactNode`

**Hooks used:** `useSavedStore`×3 (components/dashboard/jobs/candidate/boardNav.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `workplaceText` | function | `workplaceText(job: Pick<PublicJob, "workplace" \| "officeDays">, long = false): string` | 14 |
| `placeText` | function | `placeText(job: Pick<PublicJob, "locations" \| "workplace" \| "officeDay…): string` | 21 |
| `experienceText` | function | `experienceText(job: Pick<PublicJob, "experienceMin" \| "experienceMax">): string \| null` | 26 |
| `salaryText` | function | `salaryText(job: Pick<PublicJob, "salary">): string \| null` | 35 |
| `postedText` | function | `postedText(job: Pick<PublicJob, "publishedAt">): string` | 39 |
| `employmentText` | function | `employmentText(job: Pick<PublicJob, "employmentType">): string` | 43 |
| `processLabel` | function | `processLabel(c: StageCategory): string` | 47 |
| `daysLeft` | function | `daysLeft(closesAt?: string \| null): number \| null` — Days until a closing date, or null when there is none. | 52 |
| `SaveButton` | component | `SaveButton({ jobId, compact = false }: { jobId: string; compact?: bool…)` | 58 |
| `ApplicationBadge` | component | `ApplicationBadge({ job }: { job: PublicJob })` | 93 |
| `JobCard` | component | `JobCard({ job, onOpen, footer }: { job: PublicJob; onOpen: () => vo…)` — A job as a card — saved jobs grid, similar roles. | 112 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `EMPLOYMENT_LABELS`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `GOLD`, `OrgLogo`, `RewardBadge`, `formatSalary`, `timeAgo`
  - `components/dashboard/jobs/types.ts` — `StageCategory`, `(types only)`
  - `components/dashboard/jobs/candidate/boardNav.tsx` — `useSavedStore`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `PublicJob`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Bookmark`, `MapPin`

## Used by

- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/JobDetailView.tsx`
- `components/dashboard/jobs/candidate/MyApplicationsPage.tsx`
- `components/dashboard/jobs/candidate/SavedPage.tsx`
