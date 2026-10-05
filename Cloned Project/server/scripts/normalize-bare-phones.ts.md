# `server/scripts/normalize-bare-phones.ts`

> Stamps +91 onto phone numbers stored without a country code.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 83

<!-- docgen:auto -->

## Purpose
Stamps +91 onto phone numbers stored without a country code.

349 accounts hold a bare number ("7416708117"). services/twoFactorSms.ts
already assumes +91 for these at SEND time; this makes that assumption
explicit in the data so `phone` can carry a unique index.

── This is a decision, not a derivation ─────────────────────────────────
187 of these are syntactically valid as BOTH +91 and +1. We are choosing
India because that is where the user base is, NOT because the data says so.
The reversal log records every original value, and any user whose number is
actually foreign will correct it the next time they verify.

Only writes when "+91<digits>" is a VALID Indian number — a bare value that
is not a real Indian number is left for the blanking pass rather than being
turned into a plausible-looking wrong one.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Filesystem writes:** `writeFileSync("phone-normalize-log.json")` (L79)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `libphonenumber-js` — `parsePhoneNumberFromString`

## Used by

Entry: run by hand: `npx tsx server/scripts/normalize-bare-phones.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
