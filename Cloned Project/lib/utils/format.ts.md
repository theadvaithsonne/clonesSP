# `lib/utils/format.ts`

> Small display-formatting helpers (dates, relative times, phone numbers, initials, truncation, contact avatar URL).

**Kind:** frontend library · **Lines:** 50

## Purpose
A grab-bag of pure formatting functions used by UI that renders contacts and tasks. Date helpers wrap `date-fns`; the rest are plain string utilities. None of them touch the network or browser storage, so they are safe on the server and the client.

## How it works
- Date helpers always wrap their input in `new Date(...)`, so they accept ISO strings or `Date` objects. An unparseable string makes `date-fns` `format` throw (`RangeError: Invalid time value`); callers should guard values that may be missing.
- `formatPhone` strips non-digits and only reformats exactly 10-digit numbers as US style `(123) 456-7890`; anything else (including E.164 numbers with a country code) is returned unchanged.
- `getInitials` upper-cases the first letter of each name and falls back to `"?"`.
- `truncate` appends `"..."` after `length` characters (the result is therefore `length + 3` long).
- `contactPhotoUrl` returns the contact's own `imageUrl` if non-blank, otherwise the first `socialProfiles[].imageUrl` that is non-blank. The comment explains why: merged or LinkedIn-enriched contacts often store the photo only on a social profile, so without this fallback the avatar would show initials although a picture exists.

## Exports
- `formatDate(date: string | Date, formatStr = "MMM d, yyyy"): string` - format with a `date-fns` pattern.
- `formatDateTime(date: string | Date): string` - `"MMM d, yyyy h:mm a"`.
- `formatRelativeTime(date: string | Date): string` - e.g. "3 hours ago" (`formatDistanceToNow` with `addSuffix`).
- `formatPhone(phone: string): string` - US 10-digit formatting, otherwise passthrough.
- `getInitials(firstName: string, lastName?: string): string` - one or two capital letters, or `"?"`.
- `truncate(text: string, length: number): string` - cut and add an ellipsis.
- `contactPhotoUrl(contact: { imageUrl?; socialProfiles? }): string | undefined` - best avatar URL for a contact.

## Dependencies
- **Packages:** `date-fns` - `format`, `formatDistanceToNow`.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx`
- `components/chat/GroupTasksPanel.tsx`
