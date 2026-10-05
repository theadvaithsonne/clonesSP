# `app/(dashboard)/deals/components/FollowUpKnockReminder.tsx`

> A small client component that connects the CRM follow-up reminder hook to the "knock" toast card, so CRM follow-up alerts appear across the whole Deals section.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 10

## Purpose
The Deals section (`/deals/...`) is the CRM area of the app. This component is mounted once in the Deals layout. Whenever a CRM follow-up comes due, the user sees a reminder card with a knock sound, whichever Deals page they are on. It holds no logic of its own: it only connects `useFollowUpReminders` (the data and timing) to `FollowUpKnockCard` (what is shown).

## How it works
- Calls `useFollowUpReminders()` and reads `knock` (the reminder to show, or `null`) and `dismissKnock`.
- Renders `<FollowUpKnockCard knock={knock} onDismiss={dismissKnock} />`. The card renders nothing while `knock` is `null`.

What the hook does underneath:
- It fetches the follow-up list when it mounts and again every 5 minutes, using `authenticatedFetch(buildExternalUrl("crm/activities-followups"))`.
- Once a minute it checks for open follow-ups (not completed and not marked `done`) that have a due date:
  - **Exact-time knock:** a follow-up due today in the current minute produces a knock of type `"exact"`. Its id goes into sessionStorage, so it fires only once per browser session.
  - **Daily 2 PM knock:** at exactly 14:00 local time, if any follow-ups are due today or overdue, it produces one knock of type `"daily"`. This happens at most once per day, tracked in sessionStorage.
- The card slides in at the top right, plays `/knock.mp3` at half volume each time a new knock id appears, and has a dismiss (X) button. That button clears the knock.

## Exports
- `FollowUpKnockReminder()` - named export. A client component with no props that renders the follow-up knock card.

## Interfaces
- **External services:** `GET https://uatapi.garage.app/api/crm/activities-followups`, called through the hook. The base URL is hardcoded as `EXTERNAL_BASE_URL` in `lib/api-config.ts`. This is the external Garage UAT API, not this repo's `/backend`.
- **Browser storage / cookies:** sessionStorage keys `followUpKnock_shownIds` and `followUpKnock_2pmDate`, both written by the hook.
- **Background work:** the hook runs a 5-minute refetch interval and a 1-minute reminder-check interval while this component is mounted.

## Dependencies
- **Internal:** `hooks/useFollowUpReminders.ts` - fetches follow-ups and decides when to knock. `components/crm/FollowUpKnockCard.tsx` - the animated toast card with the sound and dismiss button.
- **Packages:** none directly.

## Used by
- `app/(dashboard)/deals/layout.tsx` - rendered inside `UserProvider` and the `deals-primary-scope` wrapper, so it is active on every route under `/deals`.

## Notes
- Reminder timing depends on the tab being open during the matching minute. If the tab is closed or throttled during that minute, an exact-time reminder is missed and does not fire later. The same applies to the 2 PM check.
- Dedupe state lives in sessionStorage. A new tab or session can show the same knock again.
- The hook also returns `followUps` and `refreshFollowUps`, but this component does not use them.
