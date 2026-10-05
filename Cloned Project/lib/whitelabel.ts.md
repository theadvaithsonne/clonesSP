# `lib/whitelabel.ts`

> Module exporting `getCurrentDomain`, `isWhitelabelDomain`, `fetchWhitelabelOrg`.

**Kind:** frontend library · **Lines:** 118

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WhitelabelOrgData` | interface |  | 4 |
| `WhitelabelConfig` | interface |  | 15 |
| `MAIN_APP_DOMAIN` | const | `= "my.garage.app"` | 31 |
| `ADMIN_APP_DOMAIN` | export |  | 37 |
| `getCurrentDomain` | function | `getCurrentDomain(): string` — Get the current domain with support for local testing. | 43 |
| `isWhitelabelDomain` | function | `isWhitelabelDomain(domain: string): boolean` — Check if current domain is a whitelabel domain. | 55 |
| `fetchWhitelabelOrg` | function | `async fetchWhitelabelOrg(domain: string): Promise<WhitelabelOrgData \| null>` — Fetch whitelabel organization data from backend. | 74 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/initial-setup/lookup-app-domain?domain=${encodeURIComponent(
        domain
      )}` (L78)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/admin-domain.ts` — `ADMIN_APP_DOMAIN`
- **Packages:** none

## Used by

- `app/(auth)/layout.tsx`
- `app/(auth)/verify/page.tsx`
- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/shared/OpenInAppGate.tsx`
- `lib/bat246Office.ts`
- `lib/hooks/useWhitelabel.ts`
- `lib/whitelabel-context.tsx`
