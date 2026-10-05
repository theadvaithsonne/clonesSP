# `lib/crm/activitiesFollowUpsApi.ts`

> Small helpers for the CRM "Activities & Follow-ups" list: one builds the query URL for the follow-ups endpoint, the other is a client-side text search over activity rows.

**Kind:** frontend library · **Lines:** 106

## Purpose
The Deals dashboard (`/deals`) shows the CRM activities and follow-ups that are due. The data comes from the external CRM API (`https://uatapi.garage.app/api`, not this repo's `/backend`). This module keeps two things in one place: how filter and search state turns into query-string parameters, and how the same search is matched locally. The page needs the local match for rows it adds optimistically, or when the API ignores the search.

## How it works
**`buildActivitiesFollowUpsUrl(basePath, query)`** builds a relative path (by default `crm/activities-followups`) with a `URLSearchParams` query string:
- `assignedTo` is added only if it is set and is not the sentinel `"all"`.
- `filter` (`"today" | "next7days" | "pastDue"`) is passed through as given.
- `search` is trimmed. If the trimmed value looks like an ISO date (`YYYY-MM-DD`), it is also sent as `dueDate`.
- An explicit `query.dueDate` (trimmed) overrides any `dueDate` taken from the search.
- With no parameters, the bare `basePath` is returned. The result is relative, and the caller wraps it in `buildExternalUrl()` from `lib/api-config.ts`.

**`activityMatchesFollowUpSearch(activity, searchRaw)`** is the client-side fallback:
- An empty query matches everything.
- It builds a lowercase "haystack" string from the activity's `title`, `companyName`, `entityName`, `contactName`, `description` and `assignedToName`. It adds the nested `leadDetails` fields `leadName`, `name`, `companyName`, owner name (`ownerName`, or `owner` as a string or `{name}`) and `ownerEmail`. It also adds each lead contact's full name, each `assignedToDetails` user's name or email, and the due date.
- The due date comes from `dueDate`, then `scheduledDate`, then `createdAt`. It is rendered two ways: ISO `YYYY-MM-DD` and `en-GB` style "04 Oct 2026", so users can search in either form.
- A row matches if the haystack contains the whole query, or failing that, if every whitespace-separated token appears somewhere in it (an AND match).

## Exports
- `type ActivitiesFollowUpsFilter` - `"today" | "next7days" | "pastDue"`.
- `type ActivitiesFollowUpsQuery` - `{ assignedTo?, filter?, search?, dueDate? }`.
- `buildActivitiesFollowUpsUrl(basePath = "crm/activities-followups", query = {}): string` - relative URL with the query string.
- `activityMatchesFollowUpSearch(activity: Record<string, unknown>, searchRaw: string): boolean` - local search predicate.

## Interfaces
- **External services:** the URL it builds targets the external CRM API at `https://uatapi.garage.app/api/crm/activities-followups` (after the caller applies `buildExternalUrl`). This module makes no request itself.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `app/(dashboard)/deals/page.tsx` (route `/deals`). It calls `buildActivitiesFollowUpsUrl("crm/activities-followups", { assignedTo, search })` when loading the dashboard, and `activityMatchesFollowUpSearch` to filter fetched and optimistically appended rows.

## Notes
- The `toISOString()` date label is in UTC while the `en-GB` label is in local time. Near midnight the two labels can name different days.
