# `lib/aiOfficeConfig.ts`

> A hard-coded allow-list of email addresses that may see the "AI Office" entry in the dashboard sidebar.

**Kind:** frontend library · **Lines:** 4

## Purpose
The AI Office feature is gated to specific people rather than to a role or plan. This file holds that list so the sidebar can check the signed-in user's email against it.

## How it works
It exports one array, `ALLOWED_AI_OFFICE_EMAILS`, which currently contains a single address (line 2). `components/dashboard/MainSidebar.tsx` computes `isAiOfficeAllowed` by testing whether the lower-cased `userData.email` is in the list.

## Exports
- `ALLOWED_AI_OFFICE_EMAILS: string[]` - emails allowed to see AI Office.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `components/dashboard/MainSidebar.tsx`.

## Notes
- This gate exists only in the browser. It hides a menu entry and does not protect anything on the server. Any backend route behind AI Office has to enforce its own access check.
- The sidebar lower-cases the user's email but not the list entries, so every address added here must be written in lower case.
- Granting access means editing source code and redeploying.
