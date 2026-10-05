# `lib/calendar.ts`

> Generic "add to calendar" helpers: build Google Calendar and Outlook compose links and produce or download an RFC 5545 `.ics` file for any event.

**Kind:** frontend library · **Lines:** 166

## Purpose
Live sessions (webinars, workshops, bookings) need "Add to Google Calendar / Outlook / Apple Calendar" buttons. Nothing about a particular event is baked in: the caller passes a `CalendarEvent` and gets back a URL or file. It is unrelated to `lib/calendarUtils.ts`, which drives the in-app calendar grid and has its own, different `CalendarEvent` type.

## How it works
### Input
`CalendarEvent` = `{ title, description?, startDateTime, endDateTime?, location?, url? }`. Dates may be an ISO string, a `Date` or epoch milliseconds. For a stream, `location` is typically the join URL.

### Shared normalisation
- `resolveWindow` converts start/end to `Date`s. If the end is missing, invalid, or not after the start, it defaults to start + 1 hour.
- `toBasicUtc` formats a date as `YYYYMMDDTHHMMSSZ` (the basic UTC form both Google and iCalendar expect).
- `toPlainText` strips HTML from rich-text descriptions: `<br>` and `</p>` become newlines, other tags are removed, `&nbsp; &amp; &lt; &gt;` are decoded, runs of 3+ newlines collapse to 2.
- `buildDetails` combines the plain description with `Join here: <url>` when a URL is given.

### Outputs
- `generateGoogleCalendarUrl` -> `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=start/end[&details][&location]`.
- `generateOutlookCalendarUrl` -> `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=...&startdt=...&enddt=...[&body][&location]` (ISO timestamps).
- `buildIcsContent(event, uid?)` builds a `VCALENDAR` with one `VEVENT` (`PRODID:-//Garage//Live Session//EN`, `METHOD:PUBLISH`, `STATUS:CONFIRMED`) and a display alarm 15 minutes before start. The `UID` is `<uid or startStamp-title>@garage.app`. `DTSTAMP` is derived from the event start rather than "now" so the same event always serialises identically. Text values are escaped per RFC 5545 (backslash, `;`, `,`, newlines), lines are folded at 75 characters with space-prefixed continuations, and lines are joined with CRLF.
- `downloadIcsFile(event, fileName?)` wraps the `.ics` in a `text/calendar` Blob, clicks a temporary `<a download>` and revokes the object URL. Default file name is the title slugified (`my-webinar.ics`, or `event.ics`). No-op on the server.

## Exports
- `generateGoogleCalendarUrl(event: CalendarEvent): string`
- `generateOutlookCalendarUrl(event: CalendarEvent): string`
- `buildIcsContent(event: CalendarEvent, uid?: string): string`
- `downloadIcsFile(event: CalendarEvent, fileName?: string): void`
- `CalendarEvent` (interface).

## Interfaces
- **External services:** links open Google Calendar (`calendar.google.com`) and Outlook on the web (`outlook.live.com`); no requests are made by this file.

## Dependencies
None.

## Used by
- `components/webinar/SessionNotStartedCard.tsx`

## Notes
- `downloadIcsFile` never passes a `uid`, so the UID depends on start time and title only.
- Line folding counts JavaScript characters, not octets, so lines with multi-byte characters can exceed RFC 5545's 75-octet limit; calendar apps generally tolerate this.
