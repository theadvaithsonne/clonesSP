# `lib/activity.ts`

> Fire-and-forget helper that logs a CRM activity (e.g. a lead or product change) to the external UAT API at `https://uatapi.garage.app/api/crm/activities`.

**Kind:** frontend library · **Lines:** 42

## Purpose
Provides a single `createActivity` call for the old CRM "deals" pages to record what happened to an entity (type, entity type/id/name, description). The CRM backend is an external service, not part of this repo's Express server.

## How it works
`createActivity(payload)` adds a `timestamp` (current ISO time) to the payload and POSTs it as JSON with `authenticatedFetch(buildExternalUrl("crm/activities"))`. `buildExternalUrl` prefixes `API_CONFIG.EXTERNAL_BASE_URL` from `lib/api-config.ts`, hardcoded to `https://uatapi.garage.app/api`. `authenticatedFetch` (in `utils/api.ts`) attaches the user's token from localStorage `garage_tok` (with impersonation handling). A non-OK response is logged with its body text, and thrown errors are caught and logged, so activity logging never blocks the main action.

## Exports
- `interface ActivityPayload` - `{ type: string; entityType: string; entityId: string; entityName?: string; description?: string; [key: string]: unknown }` (extra fields allowed for old callers).
- `createActivity(payload: ActivityPayload): Promise<void>` - POST the activity; never throws.

## Interfaces
- **External services:** `POST https://uatapi.garage.app/api/crm/activities` - the external Garage UAT CRM API.

## Dependencies
- **Internal:** `utils/api.ts` - `authenticatedFetch` (auth header); `lib/api-config.ts` - `buildExternalUrl`.
- **Packages:** none.

## Used by
- `app/(dashboard)/deals/leads/page-old.tsx` and `app/(dashboard)/deals/products/page-old.tsx`. These are `page-old.tsx` files, which Next.js does not treat as route pages, so the helper is effectively unused in the running app.

## Notes
- The destination is the UAT environment regardless of where the app runs, because the base URL is hardcoded in `lib/api-config.ts`.
- Not related to `lib/activity-tracker.ts`, which targets this repo's (now disabled) `/backend/user-activity` route.
