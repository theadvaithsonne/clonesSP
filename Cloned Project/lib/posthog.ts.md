# `lib/posthog.ts`

> ============================================================ PostHog browser SDK — analytics, session replay, error tracking ============================================================

**Kind:** frontend library · **Lines:** 135

<!-- docgen:auto -->

## Purpose
============================================================
PostHog browser SDK — analytics, session replay, error tracking
============================================================

Shares ONE PostHog project (554016) with all garage apps + NetworkChains;
each surface tags its events with an `app` super property so they stay
separable. This repo serves TWO surfaces from one bundle — my.garage.app
(`garage-web`) and admin.garage.app (`garage-admin-web`) — so the tag is
computed per page load rather than hardcoded; see currentSurface(). Session
replays land in the shared admin panel, filterable by that property.

The API host is a first-party garage domain (test.garage.app/ingest — roam's
reverse proxy) rather than posthog.com, so browser ad-blockers and on-device
DNS/VPN blockers can't URL-match *.posthog.com and drop events. Cross-origin
is fine: roam's cors() allows it (same pattern as NetworkChains web).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GarageSurface` | type | Which surface this page load is, for the `app` super property. | 35 |
| `currentSurface` | function | `currentSurface(): GarageSurface` | 37 |
| `registerSurface` | function | `registerSurface(): void` — Re-stamps the `app` super property for the current surface. | 53 |
| `initPostHog` | function | `initPostHog(): void` | 64 |
| `getDistinctId` | function | `getDistinctId(): string \| null` — Current distinct_id (anonymous or identified). | 100 |
| `identifyUser` | function | `identifyUser(user: { id: string; email?: string; displayName?: string; }): void` — Identify a user — merges prior anonymous events into this user_id. | 110 |
| `setOrgGroup` | function | `setOrgGroup(org: { id: string; name?: string }): void` — Associate the current user with an organization (PostHog groups). | 123 |
| `resetPostHog` | function | `resetPostHog(): void` — Reset on logout — fresh anonymous distinct_id for the next visitor. | 129 |
| `default (posthog)` | default |  | 134 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NODE_ENV`
- **External hosts mentioned in the code:** `test.garage.app`, `us.posthog.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `posthog-js`

## Used by

- `components/PostHogInit.tsx`
