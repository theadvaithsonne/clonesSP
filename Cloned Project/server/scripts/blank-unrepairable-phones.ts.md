# `server/scripts/blank-unrepairable-phones.ts`

> Clears phone numbers that cannot be repaired, so the user is asked again.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 54

<!-- docgen:auto -->

## Purpose
Clears phone numbers that cannot be repaired, so the user is asked again.

These are values with a country code that libphonenumber rejects and for
which no mechanical reconstruction exists — digits are genuinely missing
("+912958245" is nine digits where India needs ten), or the value would
repair onto a number another account already holds.

Blanking rather than guessing is the point: a wrong-but-plausible number
routes an OTP to a stranger. An empty field prompts the real owner.

`phoneVerified` is cleared alongside — a verified flag with no number
behind it makes every downstream "has this user verified?" check lie.

  npx tsx src/scripts/blank-unrepairable-phones.ts [--apply]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Filesystem writes:** `writeFileSync("phone-blank-log.json")` (L50)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `libphonenumber-js` — `parsePhoneNumberFromString`

## Used by

Entry: run by hand: `npx tsx server/scripts/blank-unrepairable-phones.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
