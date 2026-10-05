# `lib/country-flag.ts`

> Turns a country name or an ISO-2 code into a flag emoji, with a globe as the fallback.

**Kind:** frontend library · **Lines:** 49

## Purpose
Several APIs, including the public analytics API behind leaderboards and affiliate drawers, return full country names such as `"India"` rather than ISO codes. This file maps those names to ISO-2 codes and builds the matching flag emoji. Admin tables and drawers across the app use it to show a flag next to a user or company.

## How it works
- `COUNTRY_NAME_TO_CODE` maps lower-case English names to ISO-2 codes for about 130 countries. It includes a few aliases: `"czech republic"` and `"czechia"` both map to `CZ`, and `"ivory coast"` maps to `CI`.
- `getCountryFlag(nameOrCode)`:
  - If the input is null or empty, it returns `"🌍"`.
  - If the input is exactly two characters long, it treats it as an ISO code and builds the flag directly (code point `0x1F1E6 + letter - 65`).
  - Otherwise it looks up the lower-cased name in the map. It returns the flag if the name is found and `"🌍"` if not.

## Exports
- `COUNTRY_NAME_TO_CODE: Record<string, string>` - lower-case country name to ISO-2 code.
- `getCountryFlag(nameOrCode: string | null): string` - returns the flag emoji or `"🌍"`.

## Dependencies
None.

## Used by
Garage-admin pages (`companies`, `daily-reports`, `founders`, `networkchain-subs`, `one-time-affiliates`, `user-wallets`, `users`), `components/dashboard/liveStreams/founderStreamCells.tsx`, `founderStreamColumns.tsx`, `components/downline/speakers-drawer.tsx`, `components/garage-admin/CompanyScopeDialog.tsx` and `components/garage-admin/member-profile-view.tsx` (12 importers in total).

## Notes
- The name map is not complete. A name it does not contain falls back to the globe, and so does a different spelling such as "USA" or "UK". Any 2-character string is treated as an ISO code without checking, so lower-case or invalid codes can produce odd symbols.
- The input is not trimmed, so a name with surrounding whitespace will miss the lookup.
