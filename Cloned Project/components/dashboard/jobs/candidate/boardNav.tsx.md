# `components/dashboard/jobs/candidate/boardNav.tsx`

> Navigation and small shared state for the candidate Job Board.

**Kind:** React component · **Lines:** 196 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Navigation and small shared state for the candidate Job Board.

Each screen is a dashboard popover key ("Job Board", "Job Board:Job", …) so
the sidebar, top tab and back/forward history treat it like any other page.
Which job is open lives in a sessionStorage-backed store, so a reload lands
back on the same job. Saved-job ids live in a separate in-memory store that
every screen shares, so a bookmark toggled on one page shows on the others.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BoardNavContext` (local)

### Props

- **`BoardNavProvider`**: `onNavigate: (page: string) => void`, `children: React.ReactNode`

**Hooks used:** `useBoardStore` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BOARD_PAGES` | const | `= { discover: "Job Board", job: "Job Board:Job", apply: "Job Board:Apply", applications: …` | 19 |
| `ApplicationsTab` | type |  | 27 |
| `SavedTab` | type |  | 28 |
| `useBoardStore` | const | `= create<BoardState>()( persist( (set) => ({ jobId: null, applyJobId: null, applicationsTab: "activ…` | 38 |
| `rememberReferral` | function | `rememberReferral(jobId: string, data: { ref?: string \| null; source?: string \| null })` — Remember whose link (and which surface) brought the candidate to a job. | 66 |
| `referralFor` | function | `referralFor(jobId: string): { ref?: string; source?: ApplySource }` | 79 |
| `useSavedStore` | const | `= create<SavedState>()((set, get) => ({ ids: new Set<string>(), loaded: false, loading: false, load…` | 107 |
| `BoardNav` | interface |  | 154 |
| `BoardNavProvider` | component | `BoardNavProvider({ onNavigate, children }: { onNavigate: (page: string) => v…)` | 164 |
| `useBoardNav` | hook | `useBoardNav(): BoardNav` | 191 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `errorMessage`
  - `components/dashboard/jobs/candidate/candidateApi.ts` — `* as candidateApi`
  - `components/dashboard/jobs/candidate/candidateTypes.ts` — `ApplySource`, `PublicJob`, `(types only)`
- **Packages:**
  - `react`
  - `sonner` — `toast`
  - `zustand` — `create`, `persist`, `createJSONStorage`

## Used by

- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/CandidateJobsApp.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/JobPage.tsx`
- `components/dashboard/jobs/candidate/MyApplicationsPage.tsx`
- `components/dashboard/jobs/candidate/SavedPage.tsx`
- `components/dashboard/jobs/candidate/shared.tsx`
