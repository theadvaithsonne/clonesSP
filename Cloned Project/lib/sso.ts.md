# `lib/sso.ts`

> Small helper module for single sign-on into embedded (iframe) apps: it decides which apps support SSO, fetches a one-time exchange token from the backend, and appends it to the iframe URL.

**Kind:** frontend library · **Lines:** 28

## Purpose
Some apps open inside the dashboard in an iframe. Currently only the "thoughts" (Notes) app does SSO. Instead of making the user log in again, the dashboard asks the Garage backend for a short-lived exchange token and passes it to the embedded app as a query parameter. The embedded app's backend then validates it server-to-server.

## How it works
- `SSO_ENABLED_APPS` maps an app ID to its SSO target app name. Only `thoughts: "thoughts"` is present.
- `generateExchangeToken(targetApp)` calls `api()` from `lib/api.ts` (which adds the `garage_tok` Bearer token) with `POST /sso/exchange-token` and body `{ targetApp }`, and returns `exchangeToken`. On the backend (`server/routes/sso.ts`) this route requires auth. It signs a JWT with `purpose: "sso_exchange"`, a random `jti`, the user ID, org ID and role, and a 60-second expiry, and tracks the `jti` for one-time use.
- `buildSSOUrl(baseUrl, token)` sets the `sso_token` search parameter on the URL. It throws if `baseUrl` is not an absolute URL.

## Exports
- `SSO_ENABLED_APPS: Record<string, string>` - app ID to SSO target name.
- `isSSOEnabled(appId): boolean` - whether the app is in the map.
- `generateExchangeToken(targetApp): Promise<string>` - fetches a one-time token.
- `buildSSOUrl(baseUrl, exchangeToken): string` - URL with `?sso_token=...`.

## Interfaces
- **Backend endpoints called:** `POST /backend/sso/exchange-token` - requires auth; returns `{ exchangeToken }`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` authenticated fetch wrapper.

## Used by
- `components/dashboard/AppContainer.tsx` - when an iframe app loads, it checks `isSSOEnabled`, generates a token, and sets the iframe `src` to `buildSSOUrl(app.url, token)`. If token generation fails it falls back to the direct URL. It also listens for an `SSO_READY` postMessage from the iframe.

## Notes
- The token travels in the query string, so it can end up in the embedded app's access logs and history. That is acceptable here only because it expires after 60 seconds and is single-use.
