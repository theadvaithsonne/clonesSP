# `hooks/useFollowUpReminders.ts`

> A React hook that polls CRM follow-up activities from the external Garage UAT API and raises an in-app "knock" reminder when a follow-up is due this minute, plus one 2 pm daily reminder for follow-ups due today or overdue.

**Kind:** React hook · **Lines:** 194

## Purpose
The Deals/CRM area shows a "knock" card (the platform's word for a tap-on-the-shoulder prompt) to remind sales users about scheduled follow-ups. This hook does the fetching and timing. It returns at most one active `knock` object that the card components render and dismiss.

## How it works
**Fetching.** `fetchFollowUps()` calls `authenticatedFetch(buildExternalUrl("crm/activities-followups"))`, which goes to the **external** API `https://uatapi.garage.app/api/crm/activities-followups` (base URL hardcoded in `lib/api-config.ts`, not part of this repo). The response list is taken from `data.data`, `data.activities`, `data.followups`, or the body itself, and any non-array result becomes `[]`. It runs on mount and then every 5 minutes. Errors are only logged.

**Filtering.** A follow-up counts as open unless `isCompleted === true` or `status` is `completed`/`done` (case-insensitive). Its due date is `dueDate`, falling back to `scheduledDate`. Items with no valid date are ignored.

**Checking (every 60 s, plus once immediately whenever the list changes):**
1. *Exact-time knock*: for each open item due **today** whose hour and minute equal the current minute, a knock id `"<_id|leadId|followup>-<midnight timestamp>"` is built. If that id is not already in sessionStorage, it is recorded and a knock of `type: "exact"` is set (title defaults to "Follow-up due now", subtitle is entity and contact name joined with " · "). Only the first match per tick fires. Items with no `_id`, no `leadId` and no `dueDate` are skipped.
2. *Daily 2 pm knock*: if the time is exactly 14:00 and the 2 pm reminder has not fired today, it collects open items due today or earlier. If there are any, it marks today as shown and sets a `type: "daily"` knock: "Follow-up reminder", with either the single item's names or "You have N follow-up(s) due", linked to the first item's lead.

**De-duplication** uses sessionStorage, so it lasts only for the current tab session.

## Exports
- `useFollowUpReminders()` - returns `{ knock: FollowUpKnock | null, dismissKnock(), followUps: FollowUpItem[], refreshFollowUps() }`.
- `interface FollowUpItem` - loose shape of a follow-up from the API (`_id`, `leadId`, `lead`, `title`, `entityName`, `contactName`, `dueDate`, `scheduledDate`, `status`, `isCompleted`, plus any other keys).
- `interface FollowUpKnock` - `{ id, type: "exact" | "daily", title, subtitle?, leadId?, dueDate?, entityName? }`.

## Interfaces
- **External services:** `GET https://uatapi.garage.app/api/crm/activities-followups` (external Garage UAT API), with an auth header added by `authenticatedFetch`.
- **Browser storage / cookies:** sessionStorage `followUpKnock_shownIds` (JSON array of knock ids already shown) and `followUpKnock_2pmDate` (the `toDateString()` of the day the 2 pm reminder fired). `authenticatedFetch` reads the auth token from localStorage/cookies.
- **Background work:** 5-minute refetch interval and 60-second check interval, both cleared on unmount.

## Dependencies
- **Internal:** `utils/api.ts` - `authenticatedFetch` (adds the bearer token, retries); `lib/api-config.ts` - `buildExternalUrl` (prefixes the UAT API base).
- **Packages:** `react`.

## Used by
- `app/(dashboard)/deals/components/FollowUpKnockReminder.tsx`
- `components/crm/FollowUpKnockCard.tsx`

## Notes
- The checks compare exact minutes, so a reminder is missed if the tab is in the background and the browser throttles the 60-second timer past the due minute, or if the page is opened after the minute passed. Likewise, the 2 pm reminder only fires if a tick lands during 14:00-14:00:59.
- `useRef` is imported but not used.
