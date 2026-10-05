# `server/services/jobSearch.ts`

> src/services/jobSearch.ts

**Kind:** backend service · **Lines:** 124

<!-- docgen:auto -->

## Purpose
src/services/jobSearch.ts

One definition of "which live postings match these criteria", shared by
GET /jobs/discover and job alerts (endpoints + sweeper digests), so an alert
always finds exactly what the same search shows in Discover.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `JobSearchCriteria` | interface |  | 11 |
| `LIVE_HQ_FILTER` | const | `= { status: "live", "channels.garageHq": true, deletedAt: null, } as const` — Every posting Garage members can see in Jobs → Discover. | 17 |
| `normalizeCriteria` | function | `normalizeCriteria(c: IJobAlertCriteria): IJobAlertCriteria` — Drop empty values so stored criteria and summaries stay clean. | 26 |
| `criteriaFromQuery` | function | `criteriaFromQuery(query: Record<string, unknown>): JobSearchCriteria` — Discover's query string → criteria (comma lists for multi-selects). | 44 |
| `buildJobSearchFilter` | function | `async buildJobSearchFilter(c: JobSearchCriteria, opts: { publishedAfter?: Date } = {}): Promise<Record<string, any>>` — Mongo filter for live Garage-HQ postings matching `c`. | 71 |
| `summarizeCriteria` | function | `summarizeCriteria(c: IJobAlertCriteria): string` — "Product Designer · Bengaluru · Hybrid · Full-time" — the default alert name. | 112 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/jobPosting.model.ts` — `EMPLOYMENT_TYPES`, `WORKPLACE_TYPES`
  - `server/models/jobAlert.model.ts` — `IJobAlertCriteria`, `(types only)`
- **Packages:** none

## Used by

- `server/routes/jobsCandidate.ts`
- `server/services/jobsSweeper.ts`
