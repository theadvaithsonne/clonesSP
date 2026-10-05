# `app/(dashboard)/settings/team-access/page.tsx`

> Standalone Next.js page at `/settings/team-access` that renders the founder's "Team & Access" delegation console.

**Kind:** Next.js page · **Lines:** 20 · **Route:** `/settings/team-access`

## Purpose
Provides a direct URL for the RBAC delegation console. The same `TeamAccessPage` component is also shown inline as the "Team & Access" tab of Office Settings (`ManagementPage`), so both entry points behave identically.

## How it works
- Client component (`"use client"`).
- Renders `<TeamAccessPage />` inside a full-height `#121216` background.
- No access check happens here. As the file's comment explains, authorisation is enforced server-side: the founder `/rbac` routes sit behind `requireOrgAdmin`, so a non-founder who opens this URL gets the component's locked empty state rather than data.
- What the console does (from `components/dashboard/teamAccess/TeamAccessPage.tsx`): lists members who hold a module, have a pending offer or an expired one; granting creates a pending offer with a 24h expiry; revoking applies immediately. Data comes through `lib/rbac-api.ts` (for example `fetchAllMembers`, `fetchAuditTrail`, `createGrants`, `cancelGrant`).

## Exports
- `default TeamAccessRoute()` - the page component.

## Dependencies
- **Internal:** `components/dashboard/teamAccess/TeamAccessPage.tsx` - the delegation table and all RBAC actions.

## Used by
Reached by Next.js routing at `/settings/team-access`. No file imports it.

## Notes
- Security relies entirely on the backend `/backend/rbac/*` guards; do not add client-only gating and assume it protects anything.
