# `lib/downlines-api.ts`

> Small client for the Enroll-a-Downline flow: pre-checks whether an email is already a Garage user and pre-registers a new user under the caller's referral in a chosen office.

**Kind:** frontend library · **Lines:** 69

## Purpose
The Enroll-a-Downline slide-in lets a signed-in member create an account for someone else, referred by themselves, inside one of the offices (organisations) they belong to. This file holds the two network calls that slide-in needs, built on the shared `api()` helper so they carry the user's bearer token and go to `NEXT_PUBLIC_API_URL` (`<app origin>/backend`).

## How it works
- `checkDownlineEmail(email)` sends `GET /backend/downlines/check-email?email=...` (URL-encoded) and reduces the `{ success, exists }` response to `{ exists: boolean }`. The sheet uses it to disable submit before the rest of the form is filled in. On the server (`server/routes/downlines.ts`) the route is behind `requireAuth` to avoid an open email-enumeration oracle, lower-cases the email, and returns 400 `INVALID_EMAIL` for malformed input.
- `enrollDownline(body)` sends `POST /backend/downlines/enroll` with the JSON body. Server-side (same router) it checks that the caller is a member of `orgId` (403 `NOT_A_MEMBER`), that the org exists (404 `ORG_NOT_FOUND`) and that the email is new (409 `USER_EXISTS`); then creates a guest `User` with `referredBy` set to the caller, a stakeholder membership on the org's lowest floor, a fresh affiliate id, adds them to Garage HQ as a guest, auto-joins community channels and emails them a link to `/login?email=...`. The client returns `{ success, user, orgName }`.
- Error handling: `api()` throws a plain `Error` whose message is the backend's `error` or `message` field. `enrollDownline` catches it and rethrows a new `Error` with the same message (fallback "Failed to enroll downline"), typed as `EnrollDownlineError`.
- Location fields mirror the ProfilePopover pattern: the caller picks a country, types a postal code, and the UI auto-fills city and state.

## Exports
- `enrollDownline(body: EnrollDownlineInput): Promise<EnrollDownlineResult>` - creates the downline account.
- `checkDownlineEmail(email: string): Promise<{ exists: boolean }>` - pre-flight duplicate check.
- `interface EnrollDownlineInput` - `orgId`, `email` (required); optional `name`, `phone`, `country`, `postalCode`, `city`, `state`, `designation`.
- `interface EnrollDownlineResult` - `{ success, user: { _id, email, name | null }, orgName }`.
- `interface EnrollDownlineError extends Error` - optional `code` and `status`.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/downlines/check-email?email=...` - auth required; does a user with this email exist.
  - `POST /backend/downlines/enroll` - auth required; pre-register the downline.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper with auth header and error extraction.
- **Packages:** none.

## Used by
- `components/dashboard/EnrollDownlineSheet.tsx` - calls `checkDownlineEmail` on email entry and `enrollDownline` on submit.

## Notes
- The doc comment promises that the thrown error carries `code` (e.g. `USER_EXISTS`), but the implementation never sets `code` or `status`: `api()` only exposes the message, and when the backend responds with both fields `api()` prefers `error`, so the message is usually the code string itself (e.g. `"USER_EXISTS"`). Callers must match on `err.message`.
- The server re-checks `USER_EXISTS`, so the pre-flight check is a UX convenience, not a guarantee.
