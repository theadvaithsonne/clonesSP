# `lib/api-config.ts`

> Base-URL settings and retry tuning for the external Garage "UAT" API (taskroom, deals, thoughts and similar modules) and for this app's own Next.js `/api` routes.

**Kind:** frontend library · **Lines:** 34

## Purpose
Several older dashboard modules (Deals/CRM, Taskroom, Thoughts/Notes and others) don't talk to this repo's Express backend. They talk to a separate service at `https://uatapi.garage.app/api`. This file is the single place that URL is set, with small helpers that build full URLs and the retry/backoff constants that `utils/api.ts` uses.

## How it works
- `API_CONFIG.EXTERNAL_BASE_URL` is hard-coded to `https://uatapi.garage.app/api`. Commented-out alternatives (a test host and `localhost:3001`) show how environments used to be switched by editing source. No environment variable overrides it.
- `API_CONFIG.INTERNAL_BASE_URL` is `/api`, the prefix for this app's Next.js route handlers (`app/api/**/route.ts`).
- `buildExternalUrl(endpoint)` and `buildInternalUrl(endpoint)` strip one leading `/` from the endpoint and join it to the matching base, so you never get a double slash.
- `RATE_LIMIT_CONFIG` holds retry settings: up to 3 retries, a 1s base delay doubling up to a 10s cap, and the retryable statuses 429, 500, 502, 503, 504 and `0` (network error). `utils/api.ts` reads these to compute exponential backoff.

## Exports
- `API_CONFIG` - `{ EXTERNAL_BASE_URL, INTERNAL_BASE_URL }`.
- `buildExternalUrl(endpoint: string): string` - full URL on the external UAT API.
- `buildInternalUrl(endpoint: string): string` - `/api/...` URL for a Next.js route.
- `RATE_LIMIT_CONFIG` - `{ MAX_RETRIES, BASE_DELAY, MAX_DELAY, BACKOFF_MULTIPLIER, RETRYABLE_STATUS_CODES }`.

## Interfaces
- **External services:** `https://uatapi.garage.app/api` (the external Garage UAT API for flowboard, taskroom, deals and thoughts). It is not part of this repo.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
Imported by 61 files, including `app/(dashboard)/deals/*` (companies, contacts, funnel, leads, products, the Facebook integration), `app/(dashboard)/taskroom/**` (taskroom cards, sub-pages, the document manager, assigned-to-me), `app/(dashboard)/thoughts/**` (pages, the note drawer, share popover, version history, block components), `utils/api.ts` (`RATE_LIMIT_CONFIG`) and `store/athena/authStore.tsx` (`buildExternalUrl`, `buildInternalUrl`), and 36 more.

## Notes
- Calls built with `buildExternalUrl` go to the external UAT host even in production. Moving these modules to another environment means editing line 7.
