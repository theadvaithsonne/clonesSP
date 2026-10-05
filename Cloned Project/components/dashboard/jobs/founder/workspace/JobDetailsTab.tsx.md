# `components/dashboard/jobs/founder/workspace/JobDetailsTab.tsx`

> Job workspace · Job details — the posting as it stands, section by section, each with a shortcut into the matching wizard step.

**Kind:** React component · **Lines:** 171 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Job workspace · Job details — the posting as it stands, section by section,
each with a shortcut into the matching wizard step.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Fact`×18 (local), `Section`×5 (local), `Card`×2 (components/dashboard/jobs/ui.tsx), `SafeHtml` (components/dashboard/jobs/ui.tsx), `Chip` (components/dashboard/jobs/ui.tsx), `Building2` (lucide-react), `GraduationCap` (lucide-react), `Globe` (lucide-react), `CopyButton` (components/dashboard/jobs/ui.tsx)

### Props

- **`JobDetailsTab`**: `detail: JobDetailResponse`, `onEdit: (step: number) => void`

**Hooks used:** `useReferralLink` (components/dashboard/jobs/useReferralLink.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (JobDetailsTab)` | component | `JobDetailsTab({ detail, onEdit }: { detail: JobDetailResponse; onEdit: (s…)` | 44 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `EMPLOYMENT_LABELS`, `TEAM_ROLE_META`, `WORKPLACE_LABELS`
  - `components/dashboard/jobs/ui.tsx` — `Card`, `Chip`, `CopyButton`, `GOLD`, `SafeHtml`, `formatDate`, `formatMoney`, `formatSalary`
  - `components/dashboard/jobs/types.ts` — `JobDetailResponse`, `(types only)`
  - `components/dashboard/jobs/useReferralLink.ts` — `useReferralLink`
- **Packages:**
  - `react`
  - `lucide-react` — `Building2`, `Globe`, `GraduationCap`

## Used by

- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
