# `lib/crm/followUpSchedule.ts`

> A pure function that turns a follow-up form (start date, interval in days, optional end date) into a list of due dates, or into a validation error.

**Kind:** frontend library · **Lines:** 79

## Purpose
On the CRM leads page, a user can schedule a run of follow-up tasks for a lead. This module works out which dates those tasks fall on, so the page can create one CRM task per date and show the schedule before saving. It does no I/O.

## How it works
`buildFollowUpSchedule(scheduledDate, followUpIntervalDays, autoFollowUpEndDate)`:
1. If there is no `scheduledDate`, it returns the error "Please select a valid start date".
2. It parses the interval with `parseInt`. A value that is not a finite positive integer falls back to **2 days**.
3. `usingDefaultPattern` is `true` when both the interval field and the end date are blank. The UI uses this to say "default pattern" was used.
4. It parses the start date as **local midnight** (`${date}T00:00:00`). An invalid start date returns "Please select a valid start date".
5. If an end date is given, it is parsed the same way. An invalid end date returns "Please select a valid end date". An end date earlier than the start returns "End date cannot be before follow-up date".
6. It generates the dates:
   - **With an end date:** from the start date, stepping by `intervalDays`, while the date is on or before the end date. The end date itself is included.
   - **Without an end date:** exactly **3** dates: start, start + interval, start + 2 x interval.

Every result, including an error result, carries `intervalDays` and `usingDefaultPattern`. Error results have an empty `dueDates` array.

## Exports
- `type FollowUpScheduleResult` - `{ dueDates: Date[]; intervalDays: number; usingDefaultPattern: boolean; error?: string }`.
- `buildFollowUpSchedule(scheduledDate: string, followUpIntervalDays: string, autoFollowUpEndDate: string): FollowUpScheduleResult` - computes the schedule. The inputs are form strings (`YYYY-MM-DD` dates and a numeric string).

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `app/(dashboard)/deals/leads/page.tsx` (route `/deals/leads`). It calls the function in its follow-up scheduling flow and checks `schedule.error` before creating tasks.

## Notes
- There is no upper bound on the number of dates. A long range with a 1-day interval produces one entry per day, and the caller creates one task for each.
- `app/(dashboard)/deals/page.tsx` has its own local `buildFollowUpSchedulePreview` function instead of using this module. The two may drift apart.
