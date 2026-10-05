# `lib/crm/leadContactActions.ts`

> Client-side actions for contacting a CRM lead by email (a Gmail compose link) or WhatsApp (a wa.me link). A WhatsApp contact also triggers CRM task housekeeping: it closes today's open follow-ups, logs the contact as a completed task, and schedules a follow-up for tomorrow.

**Kind:** frontend library · **Lines:** 480

## Purpose
The Deals CRM screens show email and WhatsApp buttons on leads and activity cards. Opening Gmail is trivial. A WhatsApp click is treated as a real contact event, so the lead's task list should show it and the follow-up cadence should move forward without manual work. This module holds that workflow so the dashboard, the lead detail page and the shared `LeadContactQuickActions` component behave the same way. Every request goes to the **external CRM API** (`https://uatapi.garage.app/api`, via `buildExternalUrl`), not to this repo's `/backend`.

## How it works

### ID and field resolution (L29-L145)
- `resolveLeadId(lead, overrideLeadId?)` (exported) takes the first non-empty value of: the override, `lead._id`, `lead.id`, then `lead.leadId` (a string, or an object's `_id`/`id`). It works on a lead row, an activity, or a `leadDetails` object.
- Internal helpers: `resolveTaskLeadId` (from `task.leadId` or `task.lead`, as a string or an object), `resolveTaskId`, `isOpenTask` (`false` if `isCompleted`, or if status is `completed`/`done`), `isDueToday` (compares local calendar dates), and `endOfDayIso` (23:59:59 local time, as ISO).
- `resolveLeadAssigneeId(lead, fallbackUserId)` takes the first ID found from `assignedTo`, then `assignedUsers[0]`, then `ownerId`/`owner`, and falls back to the current user. The comment explains why: new tasks are assigned to the lead's owner so that the dashboard's `assignedTo` filter still shows them.
- `resolveLeadDisplayName` uses `name`/`leadName`, then `companyName`/`company` (a string or `{name}`).
- `buildDashboardFollowUpActivity(...)` builds an activity-shaped object for the new follow-up, with title, due and scheduled dates, `status: "open"`, `priority: "medium"`, and a `leadDetails` stub. The Activities & Follow-ups list can then add it optimistically, before it refetches.

### Auth context (L184-L199)
`getAuthContext()` reads the JWT from `localStorage["garage_tok"]` and decodes it with `jwt-decode`, without verifying it. It returns `userId` (`userId` or `id`) and `organizationId` (`orgId`). If the token is missing or bad, both come back empty.

### CRM API wrappers (L201-L299)
All of these use `authenticatedFetch` from `utils/api.ts`, which attaches the auth token and retries on rate-limit and server errors. Errors are swallowed and returned as empty or false results.
- `fetchLeadTasks(leadId)` - `GET crm/leads/:leadId`. It reads `tasks` from `data.lead`, `data.data` or `data`.
- `fetchActivitiesFollowUps()` - `GET crm/activities-followups`, unfiltered. It accepts `data.data`, `data.activities`, `data.followups` or a bare array.
- `markTaskCompleted(taskId)` - `PUT crm/tasks/:taskId` with `{ status: "completed", isCompleted: true }`.
- `completeTodaysOpenFollowUpsForLead(leadId)` - fetches both lists in parallel. It collects the IDs of tasks that belong to this lead, are still open and are due today (by `dueDate` or `scheduledDate`), skipping duplicates, then marks them all completed with `Promise.allSettled`. Any open task due today counts, not only ones classed as follow-ups.
- `createCrmTask(payload)` - `POST crm/tasks`. It returns `{ ok, taskId? }`, taking the ID from `data.data`, `data.task` or `data`.

### Public actions (L301-L479)
- `formatPhoneForWhatsApp(phone)` removes every non-digit. A 10-digit number gets the Indian country code `91` in front. Anything else is returned as digits.
- `openLeadEmail(lead)` finds the email (`resolveLeadEmail`) and opens `https://mail.google.com/mail/?view=cm&to=...` in a new tab. With no email, it shows the toast "No email available".
- `openLeadWhatsApp(lead, { leadId?, onSuccess? })` finds the phone and formats it (toasts "No phone number available" / "Invalid phone number" on failure). It opens `https://wa.me/<digits>` in a new tab, then starts `createWhatsAppContactTask` without waiting for it.
- `createWhatsAppContactTask(lead, { leadId?, onSuccess?, showToast? })` returns `Promise<boolean>`:
  1. Resolves the lead ID. With none, it logs a warning and returns `false`.
  2. Gets the user and organisation from the JWT, and the assignee from the lead.
  3. `completeTodaysOpenFollowUpsForLead(leadId)`.
  4. Creates a task titled **"Contacted on WhatsApp"** with an `en-IN` timestamp in its description, `status: "completed"`, `isCompleted: true`, and due now. Because the backend may not keep the completed status on create, it then calls `markTaskCompleted` on the new task. If the create response had no ID, it first finds the newest open task on the lead whose title contains "contacted on whatsapp".
  5. Creates a **"Follow-up with Lead"** task due at the end of tomorrow (local time), `status: "open"`, with the description "WhatsApp contact completed. Further follow-up needed ...", plus `FOLLOW_UP_TASK_DEFAULTS` (`type: "follow-up"`, `isFollowUp: true`). On success it calls `dispatchDealsActivityFollowUpAppend(...)` so the dashboard list shows the task straight away.
  6. If the contact-log task failed, it returns `false`. Otherwise it shows the toast "WhatsApp contact logged." (adding "Next reminder set for <date>." if the follow-up was created) unless `showToast === false`. It then fires `DEALS_CRM_STATS_REFRESH_EVENT` on `window`, awaits `onSuccess`, and returns `true`.
  7. Any thrown error is logged and the function returns `false`.

## Exports
- `resolveLeadId(lead, overrideLeadId?): string` - finds the CRM lead ID from several record shapes.
- `formatPhoneForWhatsApp(phone: string): string` - digits only, with `91` added to 10-digit numbers.
- `openLeadEmail(lead): void` - opens Gmail compose to the lead.
- `createWhatsAppContactTask(lead, options?): Promise<boolean>` - the WhatsApp-contact task workflow described above.
- `openLeadWhatsApp(lead, options?): void` - opens the WhatsApp chat and runs the task workflow in the background.

## Interfaces
- **External services (CRM API at `https://uatapi.garage.app/api`, via `buildExternalUrl`):**
  - `GET /crm/leads/:leadId` - the lead's tasks.
  - `GET /crm/activities-followups` - all visible activities and follow-ups.
  - `PUT /crm/tasks/:taskId` - mark a task completed.
  - `POST /crm/tasks` - create the contact-log task and the follow-up task.
  - Gmail web compose (`mail.google.com`) and WhatsApp (`wa.me`), opened in new tabs.
- **Browser storage / cookies:** reads `localStorage["garage_tok"]` (the JWT) to get the user and org IDs. `authenticatedFetch` also reads the auth token from storage and cookies.
- **Browser events:** dispatches `deals:activity-followup-append` (via `dispatchDealsActivityFollowUpAppend`) and `deals:crm-stats-refresh` (`DEALS_CRM_STATS_REFRESH_EVENT`) on `window`.

## Dependencies
- **Internal:**
  - `lib/api-config.ts` - `buildExternalUrl`, which puts the external CRM base URL in front of paths.
  - `utils/api.ts` - `authenticatedFetch`, an authenticated fetch with retry.
  - `lib/crm/isFollowUpTask.ts` - `FOLLOW_UP_TASK_DEFAULTS`.
  - `lib/crm/resolveLeadContactInfo.ts` - `resolveLeadEmail` and `resolveLeadPhone`.
  - `lib/deals-events.ts` - the event name and the dispatcher for Deals dashboard refreshes.
- **Packages:** `jwt-decode` (reads the JWT payload), `sonner` (toasts).

## Used by
- `app/(dashboard)/deals/page.tsx` (route `/deals`) - `resolveLeadId`, `openLeadWhatsApp` and `openLeadEmail` on activity cards.
- `app/(dashboard)/deals/leads/[id]/page.tsx` (route `/deals/leads/[id]`) - calls `createWhatsAppContactTask` after its own WhatsApp link handling.
- `components/crm/LeadContactQuickActions.tsx` - the shared email and WhatsApp buttons (`openLeadEmail`, `openLeadWhatsApp`).

## Notes
- The `91` prefix assumes Indian numbers. A 10-digit number from another country gets the wrong country code.
- `completeTodaysOpenFollowUpsForLead` closes **every** open task due today for the lead, not only follow-ups. A WhatsApp click can therefore complete unrelated tasks due today.
- `fetchActivitiesFollowUps` fetches the whole unfiltered list just to find this lead's tasks, which can be a large request.
- `CrmTaskRecord` does not declare `title` or `createdAt`, yet the fallback lookup reads them. The build ignores type errors (see `next.config.ts`), but `tsc` may report this file.
- The JWT is decoded without verification. That is fine here, because it only fills `createdBy`/`organizationId` hints, and the CRM API authenticates the request itself.
- `app/(dashboard)/deals/leads/page.tsx` and `app/(dashboard)/deals/leads/[id]/page.tsx` each define their own local `formatPhoneForWhatsApp` instead of importing this one.
