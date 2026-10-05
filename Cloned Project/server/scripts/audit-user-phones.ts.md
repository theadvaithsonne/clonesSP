# `server/scripts/audit-user-phones.ts`

> Phone data audit — the pre-work for making `users.phone` unique.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 215

<!-- docgen:auto -->

## Purpose
Phone data audit — the pre-work for making `users.phone` unique.

Produces three lists, because they need three different remedies:

  A. SHARED      one real number on more than one account. Blocks a unique
                 index outright.
  B. NO COUNTRY  stored without a "+CC". These are NOT known-Indian numbers:
                 services/twoFactorSms.ts guesses `+91` for any bare
                 10-digit input, so the country on file is our assumption,
                 not the user's statement. Fine as a delivery fallback,
                 unusable as an identity key.
  C. MALFORMED   fails libphonenumber validation for its own country, or
                 cannot be parsed at all.

Validation is libphonenumber-js, not regex. Hand-rolled rules produce false
positives here — an Indian mobile legitimately begins with 9, so "+91 9177…" […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Filesystem writes:** `mkdirSync(OUT)` (L70), `writeFileSync(path.join(OUT, "A-shared-numbers.csv"))` (L165), `writeFileSync(path.join(OUT, "B-no-country-code.csv"))` (L177), `writeFileSync(path.join(OUT, "C-malformed.csv"))` (L196)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `path`
  - `libphonenumber-js` — `parsePhoneNumberFromString`

## Used by

Entry: run by hand: `npx tsx server/scripts/audit-user-phones.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--out`.
