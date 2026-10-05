# `lib/auth.ts`

> Client-side session helpers: store, read and clear the user's JWT and selected organisation in localStorage, decode the token's claims, and check expiry.

**Kind:** frontend library · **Lines:** 148

## Purpose
This is the single source of truth for "who is signed in, and in which office" on the browser. The backend issues a JWT at login; the frontend keeps it in `localStorage` and every API helper (`lib/api.ts` and many others) reads it from here to send `Authorization: Bearer ...`. It is imported by roughly 235 files. Saving or clearing the token here is also the hook point for the multi-account switcher (`lib/accounts.ts`) and for app-wide "token changed / org changed / logged out" browser events.

## How it works
### Storage keys
- `garage_tok` - the consumer session JWT.
- `garage_org_id` - the currently selected organisation (office).
- `garage_admin_token` - the garage-admin console's separate token (set by `app/garage-admin/login/page.tsx`); read-only here.

All functions guard on `typeof window !== "undefined"` so they are safe to import from server components; on the server they return `null`/`false` or do nothing.

### Writing the session
- `saveToken(t)` writes `garage_tok`, records the session in the multi-account ledger via `rememberAccount({ token, orgId })` (identity comes from the token's claims), then dispatches `garage:token-change`. Every sign-in path goes through it, so it is also where the account switcher first learns about an account.
- `clearToken()` decodes the userId from the current token, removes `garage_tok` and `garage_org_id`, drops that account from the ledger with `forgetAccount(userId)` (other accounts stay), and dispatches `garage:logout`.
- `saveOrgId(orgId)` writes `garage_org_id`, refreshes the ledger row with the new org (so switching accounts away and back restores the right office), and dispatches `garage:org-change` (which `lib/brand-color-context.tsx` listens to in order to repaint the office accent colour).
- `clearOrgId()` removes `garage_org_id` without events.

### Reading claims
The JWT payload (second dot-separated segment) is base64url-decoded with `atob` after swapping `-`/`_` for `+`/`/`. No signature verification happens - the claims are trusted for UI decisions only; the backend verifies the token on every request.
- `getUserIdFromToken()` - `payload.userId`.
- `getUserDataFromToken()` - `{ userId, role, orgId, name, email }`, each `null` if absent or on decode failure.
- `getTokenExpiry()` - `payload.exp` (seconds since epoch) via the private `decodeJwtPayload`.
- `isTokenExpired(toleranceSeconds = 0)` - true when there is no `exp` or `now >= exp - tolerance`.
- `isAuthenticated()` - token present and not expired.

## Exports
- `saveToken(t: string): void` - persist token, update ledger, fire `garage:token-change`.
- `getToken(): string | null` - the consumer JWT.
- `getAdminToken(): string | null` - the garage-admin token, for routes that also accept an admin token when there is no consumer session.
- `clearToken(): void` - sign out the active account, fire `garage:logout`.
- `saveOrgId(orgId: string): void` - select an office, fire `garage:org-change`.
- `getOrgId(): string | null` - selected office id.
- `clearOrgId(): void` - forget the selected office.
- `getUserIdFromToken(): string | null`
- `getUserDataFromToken(): { userId; role; orgId; name; email }` (all `string | null`)
- `getTokenExpiry(): number | null`
- `isTokenExpired(toleranceSeconds?: number): boolean`
- `isAuthenticated(): boolean`

## Interfaces
- **Browser storage / cookies:** localStorage `garage_tok`, `garage_org_id` (read/write), `garage_admin_token` (read).
- **Browser events dispatched on `window`:** `garage:token-change`, `garage:logout`, `garage:org-change`.

## Dependencies
- **Internal:** `lib/accounts.ts` - `rememberAccount` / `forgetAccount` maintain the multi-account ledger used by the account switcher.

## Used by
235 files, including `app/(dashboard)/layout.tsx`, `app/(auth)/verify/page.tsx`, `app/(onboarding)/layout.tsx` and the onboarding pages, `app/accept-invite/page.tsx`, `app/(dashboard)/workspace/WorkspaceClient.tsx` and its hooks (`useFloors`, `useLocalMedia`, `useMediasoupAudience`, `useRecording`), `app/(dashboard)/deals/page.tsx`, `app/(dashboard)/thoughts/page.tsx`, `app/cabinet/view/[fileId]/page.tsx`, `app/ai-providers/page.tsx`, and many library files such as `lib/api.ts`, `lib/chat-context.tsx`, `lib/bat246Office.ts` and `lib/brand-color-context.tsx` (and about 210 more).

## Notes
- `clearToken()` also clears the org id, but `saveToken()` does not set one; callers save the org separately with `saveOrgId()`.
- The org in the token's claims (`getUserDataFromToken().orgId`) and the stored `garage_org_id` are independent values; `lib/bat246Office.ts` keys BAT 246 "exclusive mode" off the token's `orgId`.
- The token in localStorage is readable by any script on the origin (no httpOnly cookie).
