# `lib/account-session.ts`

> Client-side helpers that move the whole app between remembered signed-in accounts (switch, sign out of one, sign out of all) by updating the auth store, cookies and session storage and then hard-reloading.

**Kind:** frontend library · **Lines:** 118

## Purpose
`lib/accounts.ts` keeps the multi-account ledger and the live-session localStorage keys (`garage_tok`, `garage_org_id`). This file handles everything else the app believes about who is signed in: the persisted zustand auth store (`store/authStore.tsx`) and the `auth-token` / `user-data` cookies that Next.js `/api` routes read. It is deliberately kept out of `lib/auth.ts` because that module is imported by `lib/api.ts` (and therefore almost everything), and pulling the store in behind it would create a heavy dependency chain.

## How it works
- **`adoptAccount(account)`** (private) points the auth store at a ledger row. It builds a `Partial<User>` with `userId`, `email`, `name`, `organizationId` (from `orgId`) and explicitly resets `role` to `""` and every impersonation/profile field (`employeeId`, `clientId`, `startupbrokerRole`, `phone`, `phoneVerified`, `originalUserId`, `isSupportAgent`, `impersonatedUser*`) to `undefined`/`null`. Because `setUser` *merges* onto the current user, it first calls `setUser(null)` (which also removes both cookies) and then `setUser(user)` (which re-writes the `user-data` cookie). Finally it sets the `auth-token` cookie to the account's JWT (`path=/`, `secure`, `sameSite=none`, 7-day expiry). The store persists synchronously, so doing this before a hard navigation ensures the reload rehydrates as the new user.
- **`forgetLiveIdentity()`** (private) clears the store and removes the `auth-token` and `user-data` cookies.
- **`switchToAccount`** calls `activateAccount(userId)` from `lib/accounts`; if that returns null (no row, or the JWT expired and the row was dropped) it returns `false` without tearing anything down. Otherwise it adopts the account, calls `sessionStorage.clear()` (dropping the per-tab "add account" flag and other one-shots) and does `window.location.assign(landing)`. A full reload, not a router push, is used so sockets, caches and server-rendered payloads from the previous user cannot survive.
- **`signOutActiveAccount`** asks `activateNextUsableAccount()` for the freshest still-valid remembered account. If one exists it is adopted and the page reloads into it; otherwise the live identity is wiped and the page navigates to `landing`. The comment notes that `clearToken()` in `lib/auth.ts` has already removed the outgoing row from the ledger before this runs.
- **`signOutAllAccounts`** forgets every ledger row via `forgetAccount`, wipes the live identity and navigates.

## Exports
- `switchToAccount(userId: string, landing = "/workspace"): boolean` - activate a remembered account and reload into `landing`; `false` if the account could not be activated (caller should show an error and not navigate).
- `signOutActiveAccount(landing = "/"): void` - sign out of the current account, handing over to the next usable remembered account if any.
- `signOutAllAccounts(landing = "/"): void` - sign out of every account in this browser.

## Interfaces
- **Browser storage / cookies:** writes `auth-token` cookie; indirectly writes/removes `user-data` cookie through `useAuthStore.setUser`; removes both on full sign-out; clears all of `sessionStorage`; localStorage session keys are changed via `lib/accounts` (`garage_tok`, `garage_org_id`, `garage_accounts`) and the persisted auth store (`auth-storage`).

## Dependencies
- **Internal:** `lib/accounts.ts` - ledger operations (`activateAccount`, `activateNextUsableAccount`, `forgetAccount`, `listAccounts`, `StoredAccount`); `store/authStore.tsx` - `useAuthStore` and the `User` type.
- **Packages:** `js-cookie` - setting/removing the `auth-token` and `user-data` cookies.

## Used by
- `components/shared/AccountSwitcher.tsx` - `switchToAccount`.
- `components/dashboard/MainSidebar.tsx` - `signOutActiveAccount("/login")`.
- `components/shared/ProfilePopover.tsx` - `signOutActiveAccount("/")`.

## Notes
- After a switch the store's `role` is `""` and the `user-data` cookie carries an empty role until something calls `refreshUser()` or a fresh login populates it (see the CLAUDE.md "Auth store" section: the main app does not run `checkAuth()`).
- Must only run in the browser; it touches `window`, `sessionStorage` and cookies with no SSR guard.
- `signOutAllAccounts` removes ledger rows but does not itself remove the `garage_tok` / `garage_org_id` keys; callers are expected to have called `clearToken()` (or similar) first.
