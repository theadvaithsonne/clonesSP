# `lib/bat246Office.ts`

> Constants and helpers for BAT 246 "exclusive mode": detects when the session is scoped to the BAT 246 office or the visitor is on bat246.com, and decides where a BAT 246 login should land.

**Kind:** frontend library · **Lines:** 114

## Purpose
BAT 246 is a game/affiliate programme that runs as its own office inside Garage. When the signed-in token is scoped to that office, the dashboard becomes a single-purpose BAT 246 app: the sidebar shows only the BAT 246 entry, the BAT 246 coin badge replaces the Garage logo, and login lands on a BAT 246 page. Switching to any other office restores the normal Garage chrome. This file is the one place that knows the BAT 246 office id, its paths and logo, and the logic that drives that switch.

## How it works
### Office detection (token-based)
- `BAT246_ORG_ID` is a hard-coded MongoDB ObjectId of the BAT 246 organisation. `isBat246OrgId(orgId)` compares against it.
- `isBat246Session()` reads `orgId` from the JWT claims via `getUserDataFromToken()` (no network call), so the answer is known on the very first client render and the full Garage sidebar never flashes.
- `useIsBat246Office()` wraps that in `useSyncExternalStore`. It subscribes to the window `storage` event (the token only changes via a login or org switch, which navigate/reload, or from another tab). The server snapshot is `false`, so it is hydration-safe; React re-renders with the real value before first paint.

### Landing after login
- `defaultHomeFor(orgId)` is synchronous: `/games/bat246` for the BAT 246 office, `/workspace` otherwise. It cannot tell a qualified distributor from a newcomer.
- `bat246LandingPath()` asks the backend whether the current user is a qualified distributor. Qualified -> the hub `/games/bat246`; not qualified, or the lookup failed -> Game Boards `/games/bat246/boards` (where qualifying happens, and the hub is one click away). Must run after `saveToken()` with the BAT 246-scoped token, because `api()` reads the stored token.
- `resolveHomeFor(orgId)` is the async version to use after login: BAT 246 office -> `bat246LandingPath()`, else `/workspace`.

### Domain detection (hostname-based)
- `isBat246Domain()` tests `getCurrentDomain()` (from `lib/whitelabel.ts`) against `/(^|\.)bat246\.com$/i`, so `bat246.com` and any subdomain such as `www.` match. Used to give the login/verify pages BAT 246 chrome (`components/welcome/Bat246AuthChrome.tsx`) whether or not the domain is registered as a white-label office.
- `useIsBat246Domain()` is the hook form; it never re-subscribes because the hostname cannot change under a mounted page. Server snapshot `false`.

## Exports
- `BAT246_ORG_ID: string` - the BAT 246 organisation id.
- `BAT246_HOME_PATH = "/games/bat246"` - the hub.
- `BAT246_BOARDS_PATH = "/games/bat246/boards"` - Game Boards.
- `BAT246_LOGO_SRC = "/images/bat246-favicon-b2.png"` - the gold B2 coin used for the office icon.
- `BAT246_FAVICON_SRC` - same image, used for the browser-tab icon.
- `BAT246_DISPLAY_NAME = "BAT 246"`.
- `isBat246OrgId(orgId: string | null | undefined): boolean`
- `isBat246Session(): boolean` - non-hook check for handlers/effects.
- `defaultHomeFor(orgId): string` - synchronous landing path.
- `bat246LandingPath(): Promise<string>` - hub or Game Boards based on distributor qualification.
- `resolveHomeFor(orgId): Promise<string>` - landing path to use after login.
- `useIsBat246Office(): boolean` - hook form of `isBat246Session`.
- `isBat246Domain(): boolean` - visitor is on bat246.com.
- `useIsBat246Domain(): boolean` - hook form of `isBat246Domain`.

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/distributor/progress` - served by `server/bat246/routes/bat246.routes.ts` (router mounted at `/bat246`, `requireAuth`); only `isQualified` is read here.
- **Browser storage:** reads the JWT from localStorage (`garage_tok`) through `lib/auth.ts`; listens to the `storage` event.

## Dependencies
- **Internal:** `lib/api.ts` - authenticated fetch; `lib/auth.ts` - `getUserDataFromToken` for the token's `orgId`; `lib/whitelabel.ts` - `getCurrentDomain` for the hostname.
- **Packages:** `react` - `useSyncExternalStore`.

## Used by
- `app/(auth)/verify/page.tsx`, `app/accept-invite/page.tsx`, `app/select-organization/page.tsx` - post-login landing.
- `app/(dashboard)/layout.tsx`, `components/dashboard/MainSidebar.tsx`, `components/dashboard/MobileHeader.tsx` - exclusive-mode chrome.
- `components/bat246/Bat246Branding.tsx`, `components/shared/OpenInAppGate.tsx`, `components/welcome/Bat246AuthChrome.tsx`, `components/welcome/Welcome.tsx`.

## Notes
- **Local-testing override is live:** at the time of writing, `getCurrentDomain()` in `lib/whitelabel.ts` begins with an uncommented `return "bat246.com";` marked "LOCAL TESTING ... Comment it out for production". With that line in place, `isBat246Domain()` / `useIsBat246Domain()` return `true` on every host, so every login/verify page gets BAT 246 chrome.
- The office id is hard-coded; a different database (for example a staging copy with a different BAT 246 org id) will never enter exclusive mode.
- `useIsBat246Office` does not react to same-tab `garage:token-change` / `garage:org-change` events, only to cross-tab `storage` events; it relies on login/org switches navigating or reloading.
