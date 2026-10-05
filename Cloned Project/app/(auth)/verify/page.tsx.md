# `app/(auth)/verify/page.tsx`

> The OTP verification step of sign-in (`/verify`): checks the 6-digit code, populates the auth store, saves the session token and routes the user to the right office, game or onboarding screen.

**Kind:** Next.js page · **Lines:** 675 · **Route:** `/verify`

## Purpose
After the login screen (`components/welcome`, reached at `/` or `/login`) sends a one-time code to an email address or phone number, the user lands here with `?email=<identifier>`. This page submits the code to the backend, and then contains essentially all post-login routing logic for the main app: storefront deep links, the "talk" intent, the white-label upgrade intent, the BAT 246 domain, auto-selected orgs, white-label domains, the multi-office picker and first-time office creation. It is also the single place where the login response is copied into the persisted zustand auth store, so any new user field returned by `/auth/verify-otp` must be copied here too (see CLAUDE.md, "Auth store: what login must carry").

## How it works

### Query parameters read
- `email` - the identifier the code was sent to. If it starts with `+` it is treated as an E.164 phone number and left as-is; otherwise it is lowercased so different-case emails resolve to one account. Missing identifier: the page immediately `router.replace("/login")`.
- `source=bat246` - BAT 246 office-invite popup styling (`showPoweredBy`): larger text, main logo hidden, "Powered By Garage" logo at the bottom.
- `referCode` - forwarded as `referralCode` to `verify-otp` and `public-join`.
- `intent` - `join-office` / `item-deeplink` (deep links, checked via `isDeeplinkIntent`), `talk`, or `whitelabel`.
- `orgId`, `orgSlug` - target office for deep-link joins.
- `redirect` - post-login destination; always sanitised with `safeRedirect` (same-origin paths only) except in the no-organisation branch (see Notes).

### verify() (L84-L428)
Runs when the code has 6 digits and nothing is loading (button click or Enter key).
1. `POST /backend/auth/verify-otp` with `{ email, code, referralCode }`. The response holds `user` (id, email, name, role, phone, phoneVerified, organizations[], hasOrganizations, currentOrg) and, when an org was auto-selected or the user has no orgs, a `token`.
2. `endAddAccount()` clears the per-tab "add account" flag (sessionStorage) used by the account switcher.
3. `useAuthStore.getState().setUser(...)` stores `userId`, `email`, `name`, `role`, `phone` and `phoneVerified`. The comment records a real bug: dropping `phone`/`phoneVerified` here made verified users look unverified after clearing cookies.
4. Routing, first matching branch wins:
   - **Deep link** (`intent` is a deeplink intent and `orgId` present, L147-L207): `POST /backend/guest-auth/public-join` with `{ guestUserId, orgId, name, referralCode }`. On success saves the org-scoped token and `orgId`, toasts, and pushes to `redirect` or a default (BAT 246 landing path for the BAT 246 org, else `/workspace?orgId=...`), appending `completeProfile=true` via `withCompleteProfile` when the join reports `needsProfileCompletion` or the user has `profileComplete === false`. On failure (403 for a private office or guest limit) it shows the error and, if `orgSlug` is present, saves the user token and sends the user to `/guest/<orgSlug>`; otherwise it falls through to the branches below. This failure deliberately does not hit the outer "Invalid OTP" catch.
   - **`intent=talk`** (L210-L241): finds the parent org (GARAGE HQ, `parent === true`) and calls `POST /backend/auth/select-org` with `{ userId, orgId }`, saves the token and `garage_org_id`, then goes to `redirect` or `/workspace`. If there is no parent org but a token and `currentOrg` exist, it uses those.
   - **`intent=whitelabel`** (L248-L275): saves any token. Users with no office of their own (excluding `parent` and `guest` memberships) go to `/office-payment?newOffice=true&redirect=...`; others go to `/select-organization` with the user details, organisation list, `redirect` (default `/workspace?openApp=whitelabel`) and `intent=whitelabel` in the query string.
   - **bat246.com, existing BAT 246 member** (L282-L299): if the current org is not the BAT 246 org (or there is no token), calls `POST /backend/auth/select-org` with `BAT246_ORG_ID`; saves token and org id, then routes to `bat246LandingPath()` (hub for qualified distributors, Game Boards otherwise, decided by `GET /backend/bat246/distributor/progress`).
   - **bat246.com, non-member with a token** (L309-L328): saves the token, then `POST /backend/bat246/office/join`; if it returns a token, saves it plus the org id and routes to the BAT 246 landing path. Errors are logged and the flow falls through.
   - **Auto-selected org** (L338-L350): requires both `token` and `currentOrg.id` (a user with no orgs now also gets a user-scoped token, so the token alone is not enough). Saves token and `garage_org_id`, routes via `resolveHomeFor(currentOrg.id)`.
   - **Has organisations** (L353-L406): on a white-label domain (`isWhitelabelDomain(getCurrentDomain())`), `fetchWhitelabelOrg` looks up the domain's office (`GET /backend/initial-setup/lookup-app-domain`); if the user belongs to it, `select-org` is called and they go straight in. Otherwise the user-scoped token is saved (so `/organization`'s "Create Workspace" does not 401) and they go to `/select-organization` with `userId`, `email`, `name`, `organizations` (JSON) and optional `redirect`.
   - **No organisations** (L413-L421): saves the user-scoped token (needed because `POST /org/create-first-time` requires auth) and pushes `/organization?userId=...&redirect=...`.
5. Any thrown error outside the deep-link join shows "Invalid OTP. Please try again." and clears the input.

### Resend and keyboard
- `resend()` calls `POST /backend/auth/request-otp` with `{ email, isResend: true }`, blocks resending for 60 seconds via `resendAt`, and toasts according to phone vs email.
- A window `keydown` listener submits on Enter when 6 digits are entered.

### Rendering (L460-L659)
Full-viewport fixed layout with scroll and touch locked. Left panel: `Bat246LeftPanel` on bat246.com, otherwise a cover image (the white-label org's `coverPhoto` when available, else `./login_picture.jpg`) hidden below `lg`. Right panel: Back button (to `/login`), logo (`Bat246Title` on bat246.com, otherwise `WelcomeLogo` with white-label branding; hidden when `showPoweredBy`), the "Enter the 6-digit code sent to ..." line with `formatIdentifier(email)`, the `OtpInput`, a Verify button, "Use a different email or number" (to `/login?flow=login`), the Resend button, a terms disclaimer and optional "Powered By" footers. bat246.com uses the class constants from `Bat246AuthChrome` for sizes.

## Exports
- `default VerifyWholePage()` - wraps the inner `VerifyPage` in `Suspense` (required because it uses `useSearchParams`) with a spinner fallback.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/auth/verify-otp` - verify code, get user and optional token.
  - `POST /backend/auth/request-otp` - resend the code (`isResend: true`).
  - `POST /backend/auth/select-org` - get an org-scoped token for GARAGE HQ, BAT 246 or the white-label office.
  - `POST /backend/guest-auth/public-join` - join a public office from a storefront deep link.
  - `POST /backend/bat246/office/join` - add a bat246.com visitor to the BAT 246 office.
  - `GET /backend/bat246/distributor/progress` - indirectly via `bat246LandingPath()`.
  - `GET /backend/initial-setup/lookup-app-domain` - indirectly via `fetchWhitelabelOrg()`.
- **Browser storage / cookies:** localStorage `garage_tok` (via `saveToken`) and `garage_org_id` (set directly and via `saveOrgId`); the multi-account ledger updated inside `saveToken`/`saveOrgId`; the persisted zustand store `auth-storage`; sessionStorage add-account flag cleared by `endAddAccount`.
- **Background work:** a 250 ms `setInterval` while a resend cooldown is active (it does nothing; see Notes).

## Dependencies
- **Internal:**
  - `lib/api.ts` - `api()` fetch wrapper against `NEXT_PUBLIC_API_URL` (the `/backend` prefix).
  - `lib/auth.ts` - `saveToken`, `saveOrgId`.
  - `lib/accounts.ts` - `endAddAccount`.
  - `lib/deeplink.ts` - `isDeeplinkIntent`, `safeRedirect`, `withCompleteProfile`.
  - `lib/identifier.ts` - `formatIdentifier` for displaying the email/phone.
  - `lib/whitelabel.ts` - `getCurrentDomain`, `isWhitelabelDomain`, `fetchWhitelabelOrg`.
  - `lib/whitelabel-context.tsx` - `useWhitelabelContext` for branding (cover photo, org name/icon).
  - `lib/bat246Office.ts` - `BAT246_ORG_ID`, `isBat246OrgId`, `bat246LandingPath`, `resolveHomeFor`, `useIsBat246Domain`.
  - `store/authStore.tsx` - `useAuthStore` (`setUser`).
  - `components/ui/button.tsx`, `components/ui/otp-input.tsx` - form controls.
  - `components/welcome/WelcomeLogo.tsx`, `components/welcome/Bat246AuthChrome.tsx` - branding and BAT 246 chrome.
  - `lib/utils.ts` - `cn` class merger.
  - `lib/activity-tracker.ts` - listed as an import by the import graph, but the import and every `ActivityTracker.login` call are commented out (Team Activity retired).
- **Packages:** `react`, `next` (`useRouter`, `useSearchParams`, `Image`), `lucide-react` (icons), `sonner` (toasts).

## Used by
Not imported by any file. Reached by Next.js routing at `/verify`, navigated to from the login step with `?email=...` and any forwarded deep-link params.

## Notes
- **Countdown does not tick:** `secondsLeft` is a `useMemo` keyed only on `resendAt`, and the 250 ms interval callback is empty, so nothing re-renders each second. The label shows "Resend in 60s" and only updates when something else re-renders (for example typing in the OTP input); the disabled state can therefore stay on after the cooldown until a re-render.
- The `redirect` param in the no-organisation branch is forwarded to `/organization` without `safeRedirect`, unlike every other branch; whether that page sanitises it is outside this file.
- The Enter-key effect depends only on `code`, so it captures a `verify` closure from that render; this works because `verify` reads `code` and search params current at that render.
- All branches that hold a token call `saveToken` before navigation; several pages downstream (`/select-organization`, `/organization`) now require auth, which is why tokens are saved even before the user picks an office.
- `garage_org_id` is sometimes written directly with `localStorage.setItem` instead of `saveOrgId`, which skips the account-ledger update and the `garage:org-change` event that `saveOrgId` performs.
