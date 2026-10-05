# `lib/webinar-device.ts`

> Gives each browser tab a stable webinar device ID and a human label such as "Chrome on Mac", used by the webinar server's same-device / second-device logic.

**Kind:** frontend library · **Lines:** 76

## Purpose
When a user joins a webinar, the server must tell "this device reconnecting" apart from "the same user on a second device" (the header points at the backend's `isSameDevice` check in its webinar presence module, now under `server/realtime/`). The webinar room sends this ID with its join so a page refresh is treated as a reconnect, while a second tab or device leads to a "which device do you want to use?" prompt. The browser label is what that prompt shows on the other device.

## How it works
- **Device ID (`getWebinarDeviceId`)** is stored in `sessionStorage` under `garage.webinar.deviceId`. sessionStorage is chosen on purpose: it is tab-scoped (two tabs count as two devices, since both can hold media) and survives a refresh (the reconnect case that must not be prompted). The value is `crypto.randomUUID()` or, without that API, a `web-<timestamp>-<random>` string. It is also cached in a module variable.
  - During SSR (`window` undefined) it returns `""`.
  - If storage throws (blocked), it mints an ID kept only in memory, so it at least stays stable for the life of the page; otherwise every resync would look like a new device.
- **Browser label (`describeThisBrowser`)** prefers `navigator.userAgentData` (brands and platform), then falls back to user-agent regexes for Edge, Opera, Firefox, Chrome and Safari, and for iOS, Android, Windows, Mac and Linux. "Microsoft " / "Google " prefixes are dropped and `macOS` becomes `Mac`. The result is capped at 40 characters; without `navigator` it returns `"your browser"`.

## Exports
- `getWebinarDeviceId(): string` - per-tab device ID (empty string during SSR).
- `describeThisBrowser(): string` - short "Browser on OS" description.

## Interfaces
- **Browser storage / cookies:** `sessionStorage["garage.webinar.deviceId"]`.

## Dependencies
- None.

## Used by
- `app/webinar/[id]/WebinarRoomClient.tsx` (the `/webinar/[id]` room).

## Notes
- The order of the UA regex fallbacks matters: Edge and Opera user agents also contain `Chrome/`, and Chrome's contains `Safari/`, so they are tested first.
