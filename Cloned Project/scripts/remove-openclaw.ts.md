# `scripts/remove-openclaw.ts`

> One-off destructive script that deletes the hardcoded OpenClaw bot user and pulls it out of every organisation and group in the **production** database.

**Kind:** backend helper/test script (deletes from the configured DB) · **Lines:** 36

## Purpose
An OpenClaw integration account (logged as `openclaw@yopmail.com`) was created as a regular user and added to organisations and groups. This script removes it. It is run by hand and imported by nothing.

## How it works
- Loads `.env` and connects to `MONGODB_URI` (production in this project).
- The user id is hardcoded as the constant `OPENCLAW_USER_ID` (L5).
- `users.deleteOne({ _id })` - permanently deletes the user document.
- `organizations.updateMany({}, { $pull: { members: { userId } } })` - removes the user from the `members` array of every organisation.
- `groups.updateMany({}, { $pull: { members: { userId } } })` - same for every chat group.
- Logs the deleted/modified counts and disconnects. Errors are only logged (`run().catch(console.error)`), so the exit code stays 0 on failure.

## Exports
None.

## Interfaces
- **Database (production):** collection `users` - delete one; `organizations` - update many (`$pull` members); `groups` - update many (`$pull` members). Uses raw collections, so Mongoose hooks do not run.
- **Environment variables:** `MONGODB_URI` - target database.

## Dependencies
- **Packages:** `mongoose` - connection and raw collections; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually: `npx tsx scripts/remove-openclaw.ts`.

## Notes
- Irreversible and not dry-run capable. Other references to the user (messages, wallets, tokens, etc.) are left behind.
- Running it again is harmless (nothing left to delete) but scans every organisation and group.
