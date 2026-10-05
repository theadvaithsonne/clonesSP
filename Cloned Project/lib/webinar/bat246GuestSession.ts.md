# `lib/webinar/bat246GuestSession.ts`

> Saves, reads and clears a BAT246-only webinar guest session (join token plus display name) in localStorage so a verified visitor can come back without repeating email/OTP.

**Kind:** frontend library · **Lines:** 93

## Purpose
The BAT246 funnel's pre-join popup (the `BAT246_ORG_ID` branch in `WebinarPreJoin.tsx`) verifies a visitor by email and OTP once. This module lets that visitor return, through the gotobigwin.com "Live Webinar" tile (`Bat246Landing.tsx`) or a re-visit of `/webinar/[id]`, without verifying again, as long as the webinar has not gone live. It is deliberately a separate tiny module so this BAT246 mechanism stays out of the general webinar join flow used by every other organisation.

## How it works
- Key per webinar: `bat246_webinar_session_<webinarId>`, so a stale session for a replaced webinar never resolves.
- Value: JSON `{ token, displayName, savedAt }`.
- TTL is 11 hours (`SESSION_TTL_MS`), kept under the 12-hour expiry of the tokens issued by the backend's join-verify-otp, join-anonymous and demo-host-join flows, so the client treats a session as stale before the server would reject its token.
- `readBat246GuestSession` validates the shape (non-empty string `token` and `displayName`, numeric `savedAt`); a malformed or expired entry is removed and `null` is returned. JSON parse errors also return `null`.
- All functions are no-ops during SSR and swallow storage errors (private browsing, quota); the join still works for that visit, it just will not resume.

## Exports
- `interface Bat246GuestSession` - `{ token: string; displayName: string; savedAt: number }`.
- `saveBat246GuestSession(webinarId: string, token: string, displayName: string): void`
- `readBat246GuestSession(webinarId: string): Bat246GuestSession | null`
- `clearBat246GuestSession(webinarId: string): void`

## Interfaces
- **Browser storage / cookies:** `localStorage["bat246_webinar_session_<webinarId>"]`.

## Dependencies
- None.

## Used by
- `components/webinar/WebinarPreJoin.tsx`
- `components/welcome/Bat246Landing.tsx`

## Notes
- The stored value is a bearer join token in localStorage, readable by any script on the origin; the short TTL limits exposure.
