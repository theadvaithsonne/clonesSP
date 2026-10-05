# `components/PostHogInit.tsx`

> Client component that boots PostHog analytics and keeps the PostHog identity in sync with the logged-in user from the JWT.

**Kind:** React component · **Lines:** 64

## Purpose
Mounted once in the root layout so it survives client-side navigation. It initialises `posthog-js` (through `lib/posthog.ts`), identifies the browser as the signed-in user, attaches the user's organisation as a PostHog group, and resets to an anonymous id on logout. Identifying by the JWT `userId` (the same id used by NetworkChains and the React Native apps, per the file's header comment) merges a person's activity across Garage surfaces into a single PostHog profile.

## How it works
Two effects:

1. **Surface tagging** - runs on every `pathname` change (`usePathname`) and calls `registerSurface()`, which re-registers the `app` super property (`garage-web` or `garage-admin-web`). Without this, moving between the member app and `/garage-admin` in one session would leave later events tagged with the wrong product. `registerSurface()` is a no-op until PostHog has been initialised; on first load the surface is set by `initPostHog`'s `loaded` callback instead.
2. **Init and identity** - runs once on mount:
   - `initPostHog()` (idempotent; disabled if `NEXT_PUBLIC_POSTHOG_KEY` is missing).
   - Defines `apply()`, which reads `getUserDataFromToken()`:
     - If a `userId` exists and differs from the last one applied: `identifyUser({ id, email, displayName })`, and `setOrgGroup({ id: orgId })` when the token carries an `orgId`.
     - If there is no user but one was previously identified: `resetPostHog()`.
   - Calls `apply()` immediately, then on the window events `storage` (token changed in another tab), `garage:token-change` (dispatched by `lib/auth.ts` when the token is set) and `garage:logout`.
   - Removes the three listeners on unmount.
- Renders `null`.

## Exports
- `default PostHogInit()` - side-effect-only component.

## Interfaces
- **External services:** PostHog (host from `NEXT_PUBLIC_POSTHOG_HOST`, default proxy `https://test.garage.app/ingest`, configured in `lib/posthog.ts`).
- **Environment variables:** indirectly `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` via `lib/posthog.ts`.
- **Browser storage / cookies:** reads the auth token through `getUserDataFromToken()`; listens to `storage` events. PostHog itself persists to `localStorage+cookie`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getUserDataFromToken()` decodes the stored JWT into `{ userId, role, orgId, name, email }`.
- **Internal:** `lib/posthog.ts` - `initPostHog`, `identifyUser`, `setOrgGroup`, `resetPostHog`, `registerSurface`.
- **Packages:** `react` (`useEffect`), `next` (`next/navigation` `usePathname`).

## Used by
- `app/layout.tsx` (root layout), so it is active on every Next.js route.

## Notes
- `currentUserId` is a closure variable, not React state, so re-identification only happens when the user id actually changes.
- Switching directly from one user to another (without a logout in between) calls `identifyUser` for the new id without a `reset` first.
