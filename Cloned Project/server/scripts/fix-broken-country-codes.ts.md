# `server/scripts/fix-broken-country-codes.ts`

> Repairs phone numbers whose COUNTRY CODE is corrupted.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 170

<!-- docgen:auto -->

## Purpose
Repairs phone numbers whose COUNTRY CODE is corrupted.

The damage this fixes comes from the country picker prepending a dial code
onto a number that already carried one:
    "+91+12048812505"     picker added +91 to a typed +1 number
    "+34 34642227423"     ES code doubled
    "+91917349143724"     +91 in front of 91…
    "+91 09890952662"     national trunk 0 left in after the code

── The safety rule ──────────────────────────────────────────────────────
For each broken value we build every plausible reconstruction and validate
each with libphonenumber. A row is repaired ONLY when exactly ONE candidate
is valid. Two valid candidates means we would be guessing which country the
person is in — that is how you silently move someone's account to another
country — so those are reported for a human instead.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Filesystem writes:** `writeFileSync("phone-cc-repair-log.json")` (L166)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `libphonenumber-js` — `parsePhoneNumberFromString`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-broken-country-codes.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
