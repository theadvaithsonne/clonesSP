# `server/scripts/dedupe-shared-phones.ts`

> Resolves phone numbers held by more than one account.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 153

<!-- docgen:auto -->

## Purpose
Resolves phone numbers held by more than one account.

Rule (product decision): the account that had the number FIRST keeps it;
every other account has its phone cleared. No accounts are merged and no
data other than `phone`/`phoneVerified` is touched — a cleared user simply
re-enters their number next time they're asked, and the person who really
owns it wins it back through verification.

── "First" is a proxy ───────────────────────────────────────────────────
There is no `phoneSetAt` field, so we cannot know when a number was typed
in — only when the ACCOUNT was created. An older account may have added the
phone yesterday. Where the oldest account is not also the verified one or
the one carrying the money, that is printed as a CONFLICT so it can be
overruled before applying.

── phoneVerified must be cleared with the number ──────────────────────── […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Filesystem writes:** `writeFileSync("phone-dedupe-log.json")` (L149)

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `fs`
  - `libphonenumber-js` — `parsePhoneNumberFromString`

## Used by

Entry: run by hand: `npx tsx server/scripts/dedupe-shared-phones.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--include-inferred`, `--strict-oldest`.
