# `lib/accounts.ts`

> The browser-side multi-account ledger: remembers every account signed in on this browser (Gmail-style) in localStorage and copies a chosen account's JWT/org into the live session keys when switching.

**Kind:** frontend library · **Lines:** 261

## Purpose
Historically the app kept exactly one session: a JWT in `garage_tok`, the active org in `garage_org_id`, the persisted auth store, and the `auth-token` / `user-data` cookies. Everything reads that session through `getToken()` in `lib/auth.ts`. Instead of teaching all of that about multiple users, this module leaves those keys as "the active session" and adds a ledger (`garage_accounts`) beside them. Switching becomes "copy the chosen row into the session keys and hard-navigate". The store/cookie half of a switch lives in `lib/account-session.ts`.

## How it works
**Storage keys**
- `garage_accounts` (localStorage) - JSON array of `StoredAccount` rows.
- `garage_adding_account` (sessionStorage, per tab) - "add account" flow flag.
- `garage_tok`, `garage_org_id` (localStorage) - the live-session keys owned by `lib/auth.ts`; duplicated here as constants to avoid an import cycle (`lib/auth.ts` imports this module).

**JWT handling.** `parseJwt` base64url-decodes the payload with no signature verification (the server verifies). `isAccountExpired` treats a token that cannot be parsed or has no numeric `exp` as expired, because a ledger row outlives its token and activating a dead token would leave the app on an account that 401s every request. An optional `toleranceSeconds` lets callers treat near-expiry as expired.

**Reading/writing the ledger.** `readRegistry` returns `[]` on SSR, missing data or corrupt JSON and filters out rows lacking `userId` or `token`, so a broken ledger never locks anyone out (the live session lives in its own keys). `writeRegistry` swallows quota/blocked-storage errors so a failed remember never breaks the sign-in that triggered it. `listAccounts` sorts by `lastUsedAt` descending.

**Remembering.** `rememberAccount` derives `userId` (and default `orgId`, `name`, `email`) from the JWT claims, so it can be called anywhere that has just written a token. Explicit params win over claims, which win over the existing row's values; a name/email is never blanked by a partial payload. The row is moved to the front with a fresh `lastUsedAt`. `seedFromLiveSession` creates a row from the current `garage_tok` for users who signed in before multi-account existed (idempotent). `setAccountPicture` patches only the avatar without touching `lastUsedAt` (so the switcher is not reordered) and returns whether anything changed, letting callers avoid render loops.

**Activating.** `activateAccount` finds the row; if its token has expired it drops the row and returns `null`. Otherwise it writes `garage_tok`, writes or removes `garage_org_id`, bumps `lastUsedAt` and returns the row. Callers must check the result before tearing down the current session. `activateNextUsableAccount` walks the list newest-first, retiring dead rows as a side effect, and returns the first account that activates.

**Add-account flag.** The login page normally bounces an authenticated visitor to the workspace. `beginAddAccount` (set by the switcher) marks the tab as deliberately adding another account; login/verify honour `isAddingAccount`, and verify calls `endAddAccount` on success.

The active account is shared across tabs (it is in localStorage); other surfaces follow via the `garage:token-change` / `garage:logout` window events that `lib/auth.ts` dispatches.

## Exports
- `interface StoredAccount` - `{ userId, token, orgId: string | null, name?, email?, profilePicture?, lastUsedAt: number }`.
- `isAccountExpired(account, toleranceSeconds = 0): boolean` - whether the row's JWT is unusable.
- `listAccounts(): StoredAccount[]` - all rows, most recently used first.
- `activeUserId(): string | null` - `userId` claim of the live `garage_tok`.
- `rememberAccount({ token, orgId?, name?, email?, profilePicture? }): StoredAccount[]` - upsert the given session as most recent; returns the new list.
- `seedFromLiveSession(): StoredAccount[]` - add a row for the live session if missing.
- `setAccountPicture(userId, profilePicture): boolean` - update a row's avatar only.
- `findAccount(userId): StoredAccount | null` - read one row.
- `activateAccount(userId): StoredAccount | null` - make a row the live session (null if missing/expired).
- `forgetAccount(userId): StoredAccount[]` - remove one row.
- `clearAccounts(): void` - delete the whole ledger key.
- `beginAddAccount()`, `isAddingAccount(): boolean`, `endAddAccount()` - per-tab add-account flag.
- `activateNextUsableAccount(): StoredAccount | null` - activate the freshest still-valid row.

## Interfaces
- **Browser storage / cookies:** localStorage `garage_accounts`, `garage_tok`, `garage_org_id`; sessionStorage `garage_adding_account`.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `lib/auth.ts` - `rememberAccount` when a token or org is saved, `forgetAccount` in `clearToken()`.
- `lib/account-session.ts` - switching and sign-out orchestration.
- `components/shared/AccountSwitcher.tsx`, `components/dashboard/MainSidebar.tsx`, `components/shared/CancelAddAccount.tsx`, `components/welcome/Welcome.tsx`, `app/(auth)/verify/page.tsx` (route `/verify`).

## Notes
- Every account's JWT is stored in plain localStorage, so anything with script access to the origin can read all remembered sessions, not only the active one.
- `activateAccount` does not guard on `hasWindow()`; it is only safe to call in the browser.
- The JWT decode is unverified and is used only for display/ordering and expiry checks, never for authorization.
