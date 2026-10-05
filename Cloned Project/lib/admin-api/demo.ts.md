# `lib/admin-api/demo.ts`

> Hardcoded fake user data shown to the Apple App Store review account in the admin Users page, so the reviewer never sees real records.

**Kind:** frontend library · **Lines:** 83

## Purpose
Apple's App Store reviewers sign in with a fixed account; per the source comment, the backend accepts a static OTP for it. That account must never see real user data. While it is signed in, the admin Users page renders the dummy list from this file and **does not call the real API at all**. Per the source comment, the backend also limits that account to the Users section.

## How it works
- `isDemoAdmin()` reads `localStorage.garage_admin_info`, parses it, and compares `email` with `DEMO_ADMIN_EMAIL`. It returns `false` during SSR, when the key is missing, or on a parse error.
- `demoUser(...)` (internal) builds one `AdminUserListItem`:
  - id `demo-user-<i>`, a fake `+1 555` phone number, affiliate id `aff_demo<i>`;
  - one "Demo Workspace" office with role `founder`;
  - `createdAt` set to i days ago;
  - direct/downline counts derived from the purchase count;
  - commissions set to 10% of volume;
  - the shared `OFFER_DONE` 24-hour-offer state (`completed`).
- `demoUsers()` returns eight fixed people (names, `example.com` emails, US cities), with a mix of verified and unverified accounts and different purchase volumes.

## Exports
- `DEMO_ADMIN_EMAIL: string` - the review account's email address.
- `isDemoAdmin(): boolean` - whether the signed-in admin is the review account.
- `demoUsers(): AdminUserListItem[]` - the fixed list of fake users.

## Interfaces
- **Browser storage / cookies:** reads `localStorage.garage_admin_info`.

## Dependencies
- **Internal:** `lib/admin-api/users.ts` - `AdminUserListItem` type, so the fake rows match the real list shape.

## Used by
- `app/garage-admin/(admin-dashboard)/users/page.tsx`

## Notes
- This check runs only in the browser and exists to protect the reviewer's view, not to control access. The real restriction is enforced on the backend.
- If `AdminUserListItem` gains required fields, update `demoUser` too, or the type check fails.
