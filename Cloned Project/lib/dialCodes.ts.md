# `lib/dialCodes.ts`

> Supplies the country list for phone inputs with a real, dialable calling code in `phonecode` (from libphonenumber-js), replacing the human-readable notes stored by `country-state-city`.

**Kind:** frontend library · **Lines:** 123

## Purpose
`country-state-city` stores a descriptive note in `phonecode`, not a dial code, and for 26 countries the note is not a number (e.g. Dominican Republic `"+1-809 and 1-829"`, Jamaica `"+1-876"`, India `"91"` without a plus, Anguilla `"+1-264"` with one). Concatenating that with a local number caused two production bugs described in the header comment: Dominican users could not register because the backend's phone regex in `routes/profile.ts` rejected the word "and", and on web `toE164` stripped non-digits so numbers were silently saved as undialable values like `+18091829...` (no OTP ever arrived). The inconsistent `+` also rendered `++1-264`. This module returns the same `ICountry` objects with `phonecode` corrected, so every existing read (`+${c.phonecode}`, `c.phonecode.replace(/^\+/, "")`, `digits.startsWith(c.phonecode)`) just works.

## How it works
- **Dial code source.** For each `Country.getAllCountries()` entry, `getCountryCallingCode(isoCode)` from libphonenumber-js gives the calling code as digits only, never prefixed with `+`. For the few uninhabited territories libphonenumber has no metadata for (Antarctica, Bouvet Island, Pitcairn...), it throws and `fallbackDial` takes the first run of digits from the package's own note, so the list length never changes.
- **Deliberate NANP consequence.** A `+1` country's code is `"1"`, not `"1-876"`: the area code becomes part of the number the user types (all ten digits), which is what allows a Dominican 849 number to exist at all.
- **Primary country hoisting.** Prefill code walks this list and picks the first country whose dial code a stored number starts with. Without intervention a US number would resolve to whichever `+1` country sorts first (Canada, or after this change American Samoa). `PRIMARY_FOR_DIAL` maps shared codes to libphonenumber's "main country": `1->US, 7->RU, 39->IT, 44->GB, 47->NO, 61->AU, 212->MA, 262->RE, 358->FI, 590->GP, 599->CW`. While building the output, when the first country with a shared code is reached, the primary country is inserted just before it, and the primary's own alphabetical slot is later skipped. Everything else stays alphabetical.
- **Caching.** The computed list is cached in a module-level variable; later calls return the same array.

## Exports
- `phoneCountries(): ICountry[]` - every country, ordered for the dropdown, with a dialable `phonecode`. Use for any country that feeds a phone field; for a plain country-name field `Country.getAllCountries()` is still fine.
- `phoneCountryByIso(iso: string): ICountry | null` - one country by ISO 3166 alpha-2 code from the corrected list.

## Dependencies
- **Internal:** none.
- **Packages:**
  - `country-state-city` - base `Country` list and the `ICountry` type.
  - `libphonenumber-js` - `getCountryCallingCode` and `CountryCode` type for authoritative calling codes.

## Used by
- `components/shared/ProfilePopover.tsx`, `components/shared/PhoneVerifyBanner.tsx`, `components/webinar/PlanPhoneVerifySheet.tsx` - the three phone-OTP entry points.
- `components/ui/country-code-picker.tsx` - searchable country/dial-code picker.
- `components/dashboard/EnrollDownlineSheet.tsx`
- `app/guest/[slug]/GuestOfficePage.tsx`

## Notes
- Project guidance (CLAUDE.md, "Phone OTP") says that when prefilling from a stored E.164 number, callers should match the **longest** dial code first, or `+1` wins over `+91`. Hoisting here only decides which country wins among those sharing the same code; it does not replace longest-match.
- Mutating an object returned from `phoneCountries()` would mutate the cached list for every caller.
