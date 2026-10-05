# `hooks/useLeadNotifications.ts`

> A React hook that polls the external CRM API for newly created leads and notifies the user with a toast and an email request, with on/off preferences kept in localStorage.

**Kind:** React hook · **Lines:** 288

## Purpose
The Deals page uses this hook so a salesperson notices new leads without refreshing. It keeps track of the newest lead id it has seen. When a newer lead appears it shows a `sonner` toast with a "View" action, and it can also ask a Next.js route to send an email. Preferences (email on/off, in-app on/off, poll interval) are kept per browser.

## How it works
**Preferences.** Defaults are `{ emailEnabled: true, inAppEnabled: true, checkInterval: 30000 }`. On mount the hook loads `leadNotificationPreferences` and `lastCheckedLeadId` from localStorage. `setPreferences` (exported name; internally `savePreferences`) updates state and writes localStorage.

**Polling.** An effect starts polling when `isEnabled && preferences.inAppEnabled`. It does an immediate `checkForNewLeads()`, then repeats every `checkInterval` ms. Polling stops when either flag is off and on unmount. The effect restarts when `isEnabled`, `checkInterval` or `inAppEnabled` change.

**`checkForNewLeads()`.** A re-entrancy guard (`isCheckingRef`) prevents overlapping runs. It exits if `getUserData()` finds no decoded `garage_tok` JWT. It fetches `crm/leads?skip=0&limit=10&sort=-createdAt` from the external API and reads `data.leads` or `data.data`.
- On the first ever check (no stored last id) it only records the newest id and does not notify.
- Afterwards, if the newest id differs from the stored one, it notifies about every lead above the stored id in the list (oldest first). If the stored id is not among the 10 returned, it notifies only about the newest lead.
- It then stores the newest id in state and localStorage.

**`notifyNewLead(lead)`.**
- If in-app notifications are on, it shows a toast "New Lead Received!" with `<leadName> - <source>`. "View" navigates to `/deals/leads/<id>`.
- If email notifications are on and the JWT has an `email`, it POSTs `{ to, leadName, estimatedValue, stage, source, leadId, userName }` to the relative URL `/api/notifications/lead-email`. Errors are logged.

**`testNotification()`** sends a mock lead (`test-<timestamp>`) through `notifyNewLead` and shows a confirmation toast.

## Exports
- `useLeadNotifications()` - returns `{ isEnabled, setIsEnabled, preferences, setPreferences, checkForNewLeads, startPolling, stopPolling, testNotification }`.

## Interfaces
- **External services:** `GET https://uatapi.garage.app/api/crm/leads?skip=0&limit=10&sort=-createdAt` (external Garage UAT API via `buildExternalUrl`, authenticated with `authenticatedFetch`).
- **Backend endpoints called:** `POST /api/notifications/lead-email` (a Next.js-style relative path). **No such route exists in this project** (`app/api/notifications/` is absent), so email notifications currently fail with a 404 and are only logged to the console.
- **Browser storage / cookies:** localStorage `leadNotificationPreferences` (JSON preferences), `lastCheckedLeadId` (newest lead id seen), and `garage_tok` (read via `getUserData`).
- **Background work:** `setInterval` polling every `checkInterval` ms (30 s by default).

## Dependencies
- **Internal:** `utils/api.ts` - `authenticatedFetch`, `getUserData` (decodes the `garage_tok` JWT); `lib/api-config.ts` - `buildExternalUrl`.
- **Packages:** `react`; `sonner` - toasts; `js-cookie` - imported but unused.

## Used by
- `app/(dashboard)/deals/page.tsx`

## Notes
- Polling is turned off when `inAppEnabled` is false, even if `emailEnabled` is true, so email-only notification never happens.
- **Stale closure.** The interval callback keeps the `lastCheckedLeadId` and `preferences` from the render that started polling. On mount that value is usually still `null` (the stored id is loaded by a sibling effect in the same commit), so every tick takes the "first check" branch and never notifies until something restarts the effect. If polling does start with a real id, that id never updates inside the closure, so after a new lead arrives the same leads can be announced again on every tick. Changing `emailEnabled` also does not affect a running interval.
- localStorage is read without a try/catch on mount, so it fails where storage access throws.
