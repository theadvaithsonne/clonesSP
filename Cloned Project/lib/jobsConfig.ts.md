# `lib/jobsConfig.ts`

> Hard-coded email allow-list that gates the Garage Jobs feature during its limited rollout.

**Kind:** frontend library · **Lines:** 11

## Purpose
Garage Jobs (the founder job console and the member job board) is not public yet. This file is the single place that decides which accounts can see the Jobs sidebar tabs and open the Jobs pages. Per its comment, widen the rollout by adding an email, and remove the gate entirely when Jobs launches.

## How it works
`isJobsAllowed` returns true only if an email is provided and its trimmed, lower-cased form appears in `ALLOWED_JOBS_EMAILS`. Entries in the list must therefore be written in lower case to match.

## Exports
- `ALLOWED_JOBS_EMAILS: string[]` - the allow-listed account emails (currently one entry).
- `isJobsAllowed(email?: string | null): boolean` - whether the given user email may access Jobs.

## Used by
- `components/dashboard/MainSidebar.tsx` - shows the Jobs tab (and the founder Jobs console only when also `amIFounder`).
- `components/dashboard/jobs/JobsAccessGate.tsx` - blocks the Jobs pages for users not on the list.

## Notes
- This is a client-side UI gate only; it does not protect any backend endpoint. Anyone who calls the Jobs APIs directly is not stopped by this file.
- Changing access requires a code change and redeploy.
