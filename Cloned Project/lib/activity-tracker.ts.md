# `lib/activity-tracker.ts`

> Client helper that records user-activity events (logins, tasks, bookings, messages, files, groups, presence) by POSTing them to the backend's `/user-activity` endpoint and broadcasting an optimistic `activity:new` window event.

**Kind:** frontend library · **Lines:** 344

## Purpose
This was the write side of the "Team Activity" feed: UI code called a named helper such as `ActivityTracker.taskCreated(...)` and the activity was stored server-side and shown live in the activity page. The Team Activity feature has since been retired. The backend router mount `app.use("/user-activity", userActivityRoutes)` in `server/app.ts` is commented out, and both importers have their calls commented out, so this module is currently dormant.

## How it works
- **Types.** `ActivityType` enumerates 16 event kinds (`login`, `logout`, `online`, `offline`, `task_created`, `task_completed`, `task_assigned`, `booking_created`, `booking_cancelled`, `message_sent`, `file_uploaded`, `profile_updated`, `floor_assigned`, `group_joined`, `group_left`, `system`). `ActivityCategory` groups them (`auth`, `task`, `booking`, `communication`, `file`, `profile`, `system`, `presence`). `CreateActivityParams` is `{ type, title, description, metadata?, category, priority? }`.
- **`trackActivity(params)`** reads the active org from localStorage `garage_org_id`; if absent it logs a warning and returns. Otherwise it calls `api("/user-activity", { method: "POST", body: { orgId, ...params } }, getToken()!)`, which resolves to `POST /backend/user-activity` with a Bearer token. On success it dispatches a `CustomEvent("activity:new")` whose `detail.activity` is a synthetic record (`_id: "temp-<timestamp>"`, `userId: { _id: "current-user", name: "You" }`, `isRead: false`, ISO timestamps) so listeners can update without refetching. Any error is caught and logged; tracking never throws to the caller.
- **`ActivityTracker`** is a map of convenience wrappers that fill in a human-readable `title`/`description`, the category, a priority and a `metadata` object (ids and names) for each event. Priorities: `taskAssigned` is `high`; login, task created/completed, bookings, file upload, floor assignment and group join/leave are `medium`; the rest are `low`. `online`/`offline` and `setOnline`/`setOffline` are near-duplicates differing only in wording. `floorAssigned` uses category `profile`.

## Exports
- `type ActivityType`, `type ActivityCategory`, `interface ActivityMetadata` (free-form `Record<string, any>`), `interface CreateActivityParams`.
- `trackActivity(params: CreateActivityParams): Promise<void>` - store one activity and emit `activity:new`.
- `ActivityTracker` - object of helpers: `login`, `logout`, `online`, `offline`, `taskCreated`, `taskCompleted`, `taskAssigned`, `bookingCreated`, `bookingCancelled`, `messageSent`, `fileUploaded`, `profileUpdated`, `floorAssigned`, `groupJoined`, `groupLeft`, `system`, `setOnline`, `setOffline`; each returns the `trackActivity` promise.

## Interfaces
- **Backend endpoints called:** `POST /backend/user-activity` - create an activity (handler in `server/routes/userActivity.ts`, `router.post("/")` behind `requireAuth`). The mount is disabled in `server/app.ts`, so this request currently gets a 404 and is logged as a failure.
- **Browser storage / cookies:** reads localStorage `garage_org_id`; token via `getToken()` (localStorage `garage_tok`).
- **Window events:** dispatches `activity:new` (listened to in `components/dashboard/ActivityPage.tsx` and `components/dashboard/BettyAssistant.tsx`).

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (base URL, JSON headers, Bearer auth); `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `app/(auth)/verify/page.tsx` and `components/dashboard/TasksPage.tsx` are listed as importers, but in both the import and the `ActivityTracker.login` / `ActivityTracker.taskCreated` calls are commented out ("disabled with Team Activity retirement"). The module effectively appears unused.

## Notes
- `getToken()!` uses a non-null assertion; with no token `api()` falls back to `getToken()` again and sends no Authorization header.
- Re-enabling requires both uncommenting the router mount in `server/app.ts` and restoring the call sites.
