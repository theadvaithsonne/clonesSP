# `lib/bell-refresh.ts`

> Throttled trigger for the app-wide `notifications:refresh` browser event, so busy chats do not flood the server with notification re-fetches.

**Kind:** frontend library · **Lines:** 24

## Purpose
Several UI parts listen for the `notifications:refresh` window event (the sidebar and toolbar badge counts, the notifications panel) and each re-fetches from the server when it fires, so one refresh costs three or four requests per browser. Incoming chat messages want to refresh the bell, and in an active chat that would happen on every message. This helper batches those requests.

## How it works
- Module state: `scheduled` (a pending timeout or `null`) and `lastSent` (when the event last fired).
- `requestBellRefresh()` does nothing on the server or if a refresh is already scheduled. Otherwise it schedules a timeout of `max(0, lastSent + BELL_REFRESH_MS - now)`:
  - the first call (or one after a quiet period) fires on the next tick;
  - later calls within the window share one refresh at the end of the 10-second window.
- When the timeout runs it clears `scheduled`, stamps `lastSent`, and dispatches `new CustomEvent("notifications:refresh")` on `window`.

## Exports
- `BELL_REFRESH_MS = 10_000` - minimum gap between dispatched refreshes.
- `requestBellRefresh(): void` - ask for a (batched) bell refresh.

## Interfaces
- **Browser events:** dispatches `notifications:refresh` on `window` (listened to by, for example, `components/dashboard/MainSidebar.tsx` and `components/dashboard/NotificationPage.tsx`).
- **Background work:** a single `setTimeout` at a time.

## Dependencies
None.

## Used by
- `lib/chat-context.tsx` - on incoming DMs and group messages for conversations that are not open.
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- Only calls routed through this helper are throttled; code that dispatches `notifications:refresh` directly (for example `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/NotificationPage.tsx`) bypasses it.
