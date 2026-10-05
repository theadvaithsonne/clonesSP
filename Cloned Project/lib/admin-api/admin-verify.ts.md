# `lib/admin-api/admin-verify.ts`

> Client for the garage-admin "Verify your admin" step-up check: fetches the security-question challenge, submits the answer, and swaps in the re-minted admin JWT.

**Kind:** frontend library · **Lines:** 117

## Purpose
After an admin logs in to the garage-admin console, the backend refuses every admin route until the admin answers a security question. This module is the browser half of that gate. It is asked once per login, not once per page load: a correct answer makes the backend issue a new admin token carrying a "verified" claim, and that token replaces the stored one, so a refresh goes straight through while a new login has to answer again.

## How it works
- **Direct `fetch`, not `garageAdminApi`.** `garageAdminApi` in `lib/api.ts` turns any non-2xx response into a bare `Error(message)`. The gate needs the failure body (attempts left, whether the token was killed), so these calls build their own requests. `authHeaders()` reads `garage_admin_token` from `localStorage` and adds `Authorization: Bearer …`. `url()` joins `API_URL` (default `http://localhost:4000`) to the path after trimming trailing slashes.
- **`getAdminVerifyChallenge()`** calls `GET /backend/garage-admin/verify/challenge` with `cache: "no-store"` and returns `body.data`. **It fails open:** a non-2xx response or a network error returns `{ required: false }`. That is safe because the gate is only a client-side prompt; the backend's `requireAdminVerified` middleware (mounted in `server/app.ts` on `/garage-admin` and other admin prefixes) still refuses every admin route until the token is verified.
- **`submitAdminVerification(questionId, answer)`** POSTs `{ questionId, answer }` to `/garage-admin/verify`.
  - Network failure: returns `ok: false`, a "Couldn't reach the server" message and `attemptsLeft: 1`, so the UI does not treat it as a lockout.
  - 2xx with `data.token`: writes the new token to `localStorage.garage_admin_token` and returns `{ ok: true }`. Everything else in the console reads that key, so this write is the whole handoff.
  - 2xx without a token: `{ ok: true }` (the gate is not configured for this admin).
  - Otherwise: `ok: false` with the server's `message` (default "That's not the right answer."), `signOut` (the server has invalidated the token after too many attempts) and `attemptsLeft`.
- **`signOutAdmin()`** removes `garage_admin_token` and `garage_admin_info` (storage errors are ignored) and does a full navigation to `/garage-admin/login`.

## Exports
- `interface AdminVerifyChallenge` - `{ required, attemptsLeft?, questions?: { id, prompt }[] }`. Only prompts are sent to the browser; answer hashes stay on the server.
- `interface AdminVerifyResult` - `{ ok, message?, signOut?, attemptsLeft? }`. Deliberately flat rather than a discriminated union, because the repo compiles with `strict: false`, where narrowing on a boolean literal does not work.
- `getAdminVerifyChallenge(): Promise<AdminVerifyChallenge>` - whether the admin still has to answer, and the questions that can be asked.
- `submitAdminVerification(questionId: string, answer: string): Promise<AdminVerifyResult>` - submits an answer and stores the re-minted token on success.
- `signOutAdmin(): void` - clears admin credentials and sends the browser to the login page.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/garage-admin/verify/challenge` - challenge state (served by `server/routes/garageAdminVerify.ts`, mounted ahead of the admin page gate so it still answers while the rest of the console refuses this admin).
  - `POST /backend/garage-admin/verify` - checks the answer and returns a new token.
- **Environment variables:** `NEXT_PUBLIC_API_URL`, read through `API_URL`.
- **Browser storage / cookies:** `localStorage.garage_admin_token` (read and replaced), `localStorage.garage_admin_info` (removed on sign-out).

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` base.

## Used by
- `app/garage-admin/(admin-dashboard)/layout.tsx`
- `components/garage-admin/AdminVerifyGate.tsx`

## Notes
- The source comment points to `garagenew-backend/src/routes/garageAdminVerify.ts`; in this merged project that file is `server/routes/garageAdminVerify.ts`.
- Failing open is deliberate. Do not rely on this module for security; enforcement is in the backend middleware.
