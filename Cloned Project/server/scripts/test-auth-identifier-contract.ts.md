# `server/scripts/test-auth-identifier-contract.ts`

> Contract test for phone-or-email login.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 129

<!-- docgen:auto -->

## Purpose
Contract test for phone-or-email login.

The whole point of that change was that NO client payload, response shape or
JWT claim moves. This asserts it against a live server + database: the email
path must behave exactly as before, and the phone path must produce the same
response object.

Creates and then deletes its own throwaway accounts. Safe to run repeatedly.

Start a server on 4599 first (see the bottom of this file for a one-liner),
then:  npx tsx src/scripts/test-auth-identifier-contract.ts

Note: with an unset/invalid RESEND_API_KEY the email SEND cannot be
exercised locally, so that one assertion accepts a 500-with-JSON. Everything
else — OTP minting, lookup, signup, response shape — is fully covered.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${B}/auth/email-available?email=${encodeURIComponent(EMAIL)}` (L113)
  - `GET ${B}/auth/email-available?email=${encodeURIComponent(PHONE)}` (L115)
- **Environment variables (`process.env`):** `AUTH_TEST_BASE`, `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/test-auth-identifier-contract.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
