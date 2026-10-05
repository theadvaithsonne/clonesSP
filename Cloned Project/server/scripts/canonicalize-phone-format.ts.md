# `server/scripts/canonicalize-phone-format.ts`

> Rewrites every stored phone to strict E.164 — "+917416708117", never "+91 7416708117".

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 89

<!-- docgen:auto -->

## Purpose
Rewrites every stored phone to strict E.164 — "+917416708117", never
"+91 7416708117".

The earlier cleanup validated numbers but did not canonicalise their
FORMAT, because libphonenumber happily calls "+91 7416708117" valid. That
is fine for display and for SMS delivery, and fatal for identity:

  - `User.findOne({ phone })` is an exact string match. A user typing their
    number logs in against the canonical form, which never equals a stored
    value containing a space, so login-by-phone silently fails for them.
  - The unique index compares strings too, so "+91 7416708117" and
    "+917416708117" are two different keys and both can exist.

Refuses to run if canonicalising would collide two accounts onto one number.

  npx tsx src/scripts/canonicalize-phone-format.ts [--apply]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Filesystem writes:** `writeFileSync(logPath)` (L85)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `os`
  - `path`
  - `libphonenumber-js` — `parsePhoneNumberFromString`

## Used by

Entry: run by hand: `npx tsx server/scripts/canonicalize-phone-format.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
