# `components/announcements/AnnouncementHost.tsx`

> Client component that fetches the live Alerts & Promotions for one surface and shows the highest-priority one this browser has not dismissed, wiring up snooze and discard.

**Kind:** React component · **Lines:** 90

## Purpose
This is the behavioural half of Alerts & Promotions; `AnnouncementCard.tsx` is the visual half. Two instances are mounted: one in `app/(auth)/layout.tsx` with `surface="pre-login"` (login and signup screens) and one in `app/(dashboard)/layout.tsx` with `surface="post-login"`. It decides which announcement, if any, to show and records the user's dismissals. It is built so that a failed fetch renders nothing: a promo must never break a login screen.

## How it works
- **Fetch on mount** (L37-L55): calls `fetchActiveAnnouncements(surface)`, which requests `GET /backend/public/announcements/active?surface=...` and never throws (returns `[]` on any error). The backend returns enabled rows inside their schedule window that target the surface or `"everywhere"`, sorted by priority then newest, capped at 10.
- **Filter**: rows for which `isAnnouncementHidden(a)` is true (discarded in localStorage or snoozed in sessionStorage, keyed by `id:version`) are dropped. If none remain, nothing happens.
- **Delay**: when there is something to show, a `setTimeout` of `delayMs` (default 900 ms; the auth layout passes 600) flips `ready` so a freshly loaded page can paint before a dialog lands on it. An `alive` flag and timer cleanup stop stale updates after unmount or a surface/delay change.
- **Current item**: `current` is the first row whose `id` is not in `dismissedNow` (in-memory list for this mount). Dismissing one therefore reveals the next, if any.
- **Dismiss** ("Not now" / X / Escape / backdrop click): `snoozeAnnouncement(current)` writes to sessionStorage, so it returns on the next visit, and the id is added to `dismissedNow`.
- **Discard** ("Don't show this again"): `discardAnnouncement(current)` writes to localStorage, so it is retired on this browser until an admin bumps the version (which changes the storage key).
- **Navigate**: clicking the CTA is treated as a discard (permanent), so the dialog does not reappear on the page the button just opened.
- Renders `AnnouncementOverlay` with `data={current}` once `ready` and `current` are both set; otherwise returns `null`.

## Exports
- `default AnnouncementHost({ surface, delayMs = 900 })` - `surface` is `"pre-login" | "post-login"`; `delayMs` is the wait before showing.

## Interfaces
- **Backend endpoints called:** `GET /backend/public/announcements/active?surface=pre-login|post-login` (via `fetchActiveAnnouncements`), unauthenticated, served by `server/routes/publicAnnouncements.ts` mounted at `/public/announcements`.
- **Database:** indirectly, the backend reads the `Announcement` model (`server/models/announcement.model.ts`).
- **Browser storage / cookies:** through `lib/announcements.ts`: localStorage key `garage_announcements_dismissed` (discards) and sessionStorage key `garage_announcements_snoozed` (snoozes), each a JSON array of `id:version` strings capped at 100.
- **Background work:** a single one-shot `setTimeout` for the show delay.

## Dependencies
- **Internal:** `lib/announcements.ts` - `Announcement` type, `fetchActiveAnnouncements`, `isAnnouncementHidden`, `snoozeAnnouncement`, `discardAnnouncement`; `components/announcements/AnnouncementCard.tsx` - `AnnouncementOverlay` for rendering.
- **Packages:** `react` - state, effects, memo and callbacks.

## Used by
- `app/(auth)/layout.tsx` - `<AnnouncementHost surface="pre-login" delayMs={600} />`, wrapping the auth routes (login, signup and so on).
- `app/(dashboard)/layout.tsx` - `<AnnouncementHost surface="post-login" />`, wrapping all dashboard routes.

## Notes
- Only one announcement is visible at a time; others in the list queue behind it for this mount.
- Hidden-state is checked once at fetch time. A discard in another tab will not hide an already-loaded card until the next mount.
