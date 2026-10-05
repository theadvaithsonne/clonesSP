# `server/config/aiOfficeConfig.ts`

> A one-constant allow-list of email addresses permitted to use the "AI Office" feature.

**Kind:** backend config · **Lines:** 4

## Purpose
Holds `ALLOWED_AI_OFFICE_EMAILS`, a hardcoded list of user emails that may access the AI Office. It is a simple feature gate kept in code rather than in the database.

## How it works
The file exports a single string array containing one email address. Nothing on the server reads it.

## Exports
- `ALLOWED_AI_OFFICE_EMAILS: string[]` - the allow-listed emails.

## Dependencies
None.

## Used by
Nothing imports this file; it appears unused on the backend. An identical copy exists at `lib/aiOfficeConfig.ts`, and that frontend copy is the one actually used: `components/dashboard/MainSidebar.tsx` checks the signed-in user's lower-cased email against it to decide whether to show the AI Office entry.

## Notes
- Because only the frontend copy is used, this check is purely cosmetic (a sidebar visibility switch), not a server-side permission. Anything that must be protected needs its own server check.
- The two copies can drift; if the list changes, update `lib/aiOfficeConfig.ts`.
- The list contains a real personal email address; avoid copying it into other docs or logs.
