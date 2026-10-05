# `lib/identifier.ts`

> Client-side helpers that classify, validate, normalise and format the single "email or phone" login identifier, turning typed phone numbers into canonical E.164.

**Kind:** frontend library · **Lines:** 192

## Purpose
The login screen has one input that accepts either an email address or a phone number. This module decides which one the user is typing (so the UI can reveal a country picker), catches obviously bad values before a request is sent, and builds the exact string posted as the `email` field to the OTP endpoints. The header comment calls it the client-side twin of the backend's `services/identifier.ts`: the server re-classifies and is the authority, so this file exists for UX, not trust. It also centralises the "longest dial code first" E.164 split that had previously been re-implemented (and gotten wrong) in three phone-verify components.

## How it works
- **Mode detection (`detectMode`)** is deliberately lenient and commits early: empty → `"unknown"`; any `@` or any letter → `"email"` (so `abc123` and `9to5@...` read as email); a leading digit or `+` → `"phone"`. It intentionally does *not* require every character to be phone-like, because an earlier strict version flipped the field back to email mode on one stray keystroke and swapped the control out mid-typing.
- **Email validation** uses `EMAIL_RE` (`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`), stated to be the same pattern as `lib/rbac-api.ts:EMAIL_RE`.
- **Phone normalisation (`toPhoneIdentifier`)** builds candidate E.164 readings, most literal first, and lets `libphonenumber-js` pick the first valid one, returning `parsed.number` (libphonenumber's canonical form, which strips national trunk prefixes, so `+91` + `09876543210` becomes `+919876543210`).
  - If the input starts with `+`, the user stated their own country, so the picker's dial code is never prepended; candidates are `+<digits>` and a de-duplicated reading from `dedupeLeadingCode` (repairs back-to-back repeated codes like `+971 971...`).
  - Otherwise candidates are `+<dial><digits>` then `+<digits>` (handles a pasted number that already contains the country code but no `+`, avoiding the doubled-code bug the comments say had to be repaired on 27 accounts).
  - If nothing parses as valid (user mid-type), the first literal candidate is returned so the field round-trips without jumping.
- **`dedupeLeadingCode`** (private) tries code lengths 1-3 and, if the digits begin with the same code twice, drops the repeat; else returns `+<digits>`.
- **`splitE164`** sorts the picker's dial codes by length descending before prefix-matching, so `+1` cannot swallow `+91`.
- **`formatIdentifier`** produces the display string for "we sent a code to X": non-`+` values pass through; for phone numbers the last 10 digits are treated as the subscriber number split 5+5, and the rest as the country code (it does not attempt to know real code lengths).

## Exports
- `type IdentifierMode = "email" | "phone" | "unknown"`.
- `detectMode(raw: string): IdentifierMode` - what the user is typing, decided as they type.
- `isValidEmail(raw: string): boolean` - trimmed value matches `EMAIL_RE`.
- `sanitizeLocalNumber(raw: string): string` - digits only, capped at 15 (E.164 max).
- `toE164(dialCode: string, localNumber: string): string` - plain concatenation `+<dial><digits>` (no validity check).
- `splitE164(e164: string, dialCodes: string[]): { dial: string; local: string } | null` - split a stored number by the longest matching picker code; `null` if not `+`-prefixed or no code matches.
- `buildIdentifier(mode, raw, dialCode): string` - value to send as `email` to `/auth/request-otp` and `/auth/verify-otp`: lower-cased trimmed email, or `toPhoneIdentifier(...)` for phone mode. The key stays named `email` for wire compatibility with multiple clients.
- `toPhoneIdentifier(raw: string, dialCode: string): string` - candidate-based E.164 normalisation described above.
- `isValidPhoneInput(raw: string, dialCode: string): boolean` - whether the normalised number is valid per libphonenumber.
- `countryOfTyped(raw: string): string | null` - ISO country implied by a `+CC...` value so the picker can follow pasted input.
- `formatIdentifier(value: string): string` - human-readable display form.

## Interfaces
- **Backend endpoints called:** none directly; `buildIdentifier` output is what callers post to `POST /backend/auth/request-otp` and `POST /backend/auth/verify-otp`.

## Dependencies
- **Packages:** `libphonenumber-js` - `parsePhoneNumberFromString` for validity, canonical E.164 and country lookup.

## Used by
- `components/welcome/Welcome.tsx` - the login input (`detectMode`, `buildIdentifier`, `isValidEmail`, `isValidPhoneInput`, `countryOfTyped`).
- `app/(auth)/verify/page.tsx` - `formatIdentifier` for the "code sent to" line.
- `components/shared/AssociateAccountCard.tsx` - `isValidEmail`.

## Notes
- Keep in step with the backend's identifier service and with `lib/rbac-api.ts`'s email regex; the server deliberately refuses to guess a country code for a bare number, and so does this file.
- When several readings are valid, the literal one wins on purpose: "inventing a different number is worse than failing".
- `splitE164` is the fix for the `+1`-vs-`+91` bug described in CLAUDE.md's Phone OTP section; the three phone-verify components should use it rather than re-implementing the match.
- `formatIdentifier`'s 10-digit split is only cosmetic and will mis-group numbers whose subscriber part is not 10 digits.
