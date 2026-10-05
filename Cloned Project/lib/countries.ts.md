# `lib/countries.ts`

> A static list of about 200 countries with ISO 3166-1 alpha-2 codes and E.164 dial codes, plus a helper that turns an ISO code into a flag emoji.

**Kind:** frontend library · **Lines:** 227

## Purpose
This file gives phone country-code pickers and country filters one shared country list. It ships no flag images: each flag is built at render time from the ISO code using Unicode regional-indicator symbols. India is the default country, which fits Garage's main market.

## How it works
- `Country` is `{ code, dial, name }`, for example `{ code: "IN", dial: "+91", name: "India" }`.
- `COUNTRIES` is sorted alphabetically by English name (L23-L223). Some entries share a dial code: the US and Canada both use `+1`, and Kazakhstan and Russia both use `+7`. Caribbean nations that sit inside the North American plan use their full `+1NPA` prefix, for example `+1876` for Jamaica and `+1809` for the Dominican Republic.
- `flagEmoji(code)` upper-cases the code, removes anything that is not A-Z, and maps each letter to the code point `127397 + charCode`. 127397 is 0x1F1E6 minus 65, so this produces the two regional-indicator symbols that render as a flag.
- `DEFAULT_COUNTRY` is the India entry, or the first entry if India is missing.

## Exports
- `interface Country` - `{ code: string; dial: string; name: string }`.
- `flagEmoji(code: string): string` - converts an ISO-2 code to a flag emoji.
- `COUNTRIES: Country[]` - the full list.
- `DEFAULT_COUNTRY: Country` - India.

## Dependencies
None. The file is pure data plus a helper.

## Used by
- `components/garage-admin/OneTimeAffiliatesFilterDrawer.tsx` - uses `COUNTRIES` and `flagEmoji` for a country filter.
- `components/garage-admin/member-profile-view.tsx` - uses `COUNTRIES`.

## Notes
- Because several countries share a dial code, you cannot reliably map a dial code back to one country with a simple lookup. When matching a stored E.164 number, try the longest prefix first (for example `+1876` before `+1`). The project CLAUDE.md gives the same rule for the phone-OTP pickers.
- `lib/country-flag.ts` contains a similar flag helper that also accepts full country names. The two files are independent.
- Phone OTP entry points use the `country-state-city` package rather than this list.
