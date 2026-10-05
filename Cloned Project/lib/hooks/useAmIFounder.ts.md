# `lib/hooks/useAmIFounder.ts`

> The app-wide hook that answers "who am I in the current organisation": it decodes the session JWT, fetches `/auth/me`, and reports whether the user is a founder (or has full access) of the active org and whether that org is Garage HQ.

**Kind:** React hook · **Lines:** 139

## Purpose
Founder status gates much of the UI: admin-only sidebar items, BAT246 back-office pages, workspace controls, AI provider settings and more (51 files import this hook). The JWT carries only the global role and the active `orgId`; the per-organisation membership role (`founder` / `stakeholder`), the `fullAccess` flag, the org name and the profile picture come from the backend. This hook combines the two.

## How it works
1. **Initial state:** all `userData` fields are `null`, `amIFounder` and `isGarageHQ` are `false`, `loading` is `true`.
2. **Refetch on token change:** it listens for the window event `garage:token-change`, which `lib/auth.ts` dispatches whenever a new token is saved (for example after an org switch), and bumps a trigger counter that reruns the fetch.
3. **Fetch:**
   - `getUserDataFromToken()` decodes the JWT payload (`userId`, `role`, `orgId`, `name`, `email`) without verifying it; `getToken()` reads localStorage `garage_tok`.
   - Without a user id, org id or token it sets `userData` from the token alone and the flags to false.
   - Otherwise it calls `GET /backend/auth/me` and finds the membership whose `id` equals the token's `orgId`. `userData` gets `membershipRole`, `orgName`, `profilePicture`, `guest` (from the membership), `name` and `email` (from the user record).
   - `amIFounder = membershipRole === "founder" || membership.fullAccess === true`.
   - `isGarageHQ` is true when the org name, compared case-insensitively, equals `NEXT_PUBLIC_HQ_NAME` (default `"GARAGE HQ"`).
   - On error both flags are set to false (`userData` keeps its previous value); `loading` always ends false.

## Exports
- `useAmIFounder()` - returns `{ amIFounder: boolean, userData: UserData, loading: boolean, isGarageHQ: boolean }`.
- `type UserData` - `{ userId, role, orgId, membershipRole?, orgName?, profilePicture?, guest?, name?, email? }`; `role` is the global role from the JWT, `membershipRole` the role inside the current org.

## Interfaces
- **Backend endpoints called:** `GET /backend/auth/me` (`server/routes/auth.ts`, `requireAuth`) - user profile and organisation memberships.
- **Environment variables:** `NEXT_PUBLIC_HQ_NAME` - name of the HQ organisation (default `GARAGE HQ`).
- **Browser storage / cookies:** localStorage `garage_tok` (via `lib/auth.ts`).
- **Events:** listens for the DOM event `garage:token-change`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken`, `getUserDataFromToken`; `lib/api.ts` - `api()` fetch wrapper.
- **Packages:** `react` - state and effects.

## Used by
`app/(dashboard)/layout.tsx`, `app/(dashboard)/workspace/WorkspaceClient.tsx`, `app/(dashboard)/auction/page.tsx`, `app/(dashboard)/coverfi/layout.tsx`, most BAT246 pages (`app/(dashboard)/games/bat246/page.tsx`, `[boardId]/page.tsx`, `boards`, `dashboard`, `distributors`, `distributors/[userId]`, `members`, `permission`, `Inviteandplace`), `app/ai-providers/page.tsx`, `app/careers/CareersClient.tsx`, `components/dashboard/AIProvidersPage.tsx`, `BettyDashboardPage.tsx`, `CallsPage.tsx`, `ChannelsPage.tsx`, `ConferenceRoomPage.tsx`, `CreateGroupDialog.tsx`, `DashboardPage.tsx`, `DomainManagementPage.tsx`, `DropsPage.tsx`, `FeedComponents.tsx`, and 26 more. `lib/hooks/useBat246CardAccess.ts` builds on it.

## Notes
- There is no shared cache: every component that calls the hook makes its own `/auth/me` request on mount, so a page with several consumers makes several identical requests.
- Founder status is a UI convenience only. The JWT is decoded, not verified, so the backend must still enforce permissions.
- No `"use client"` directive; it relies on `window` inside effects, so use it only from client components.
