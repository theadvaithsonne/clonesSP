# `lib/hooks/useWhitelabel.ts`

> React hook that detects whether the app is being served on an organisation's white-label domain and, if so, loads that org's branding from the backend.

**Kind:** React hook · **Lines:** 75

## Purpose
Offices can run Garage on their own domain with their own name, icon, colours and cover photo. This hook resolves that branding once per page load in the browser and returns a `WhitelabelConfig`. It is consumed by `lib/whitelabel-context.tsx`, which exposes the result to the rest of the app through a React context.

## How it works
- Starts from `DEFAULT_CONFIG`: not white-label, Garage yellow `#FBD10D` for both colours, `whitelabelActive: true`, `isLoading: true`.
- A mount-only effect:
  1. `getCurrentDomain()` gets the host name.
  2. If `isWhitelabelDomain(domain)` is false (the main app domain, the admin domain, their subdomains, `localhost`, `127.0.0.1`), it sets the defaults with `domain` filled in and `isLoading: false`.
  3. Otherwise it calls `fetchWhitelabelOrg(domain)`. On `null` (lookup failed or domain unknown/unverified) it returns the defaults with `isWhitelabel: true` and `error: "Failed to fetch organization data for this domain"`.
  4. On success it sets `isWhitelabel: true` plus `orgId`, `orgName`, `orgIcon`, `primaryColor`, `secondaryColor`, `coverPhoto` and `whitelabelActive` from the lookup.
- No caching: each page load fetches again.

## Exports
- `useWhitelabel(): WhitelabelConfig` - current branding state (see `WhitelabelConfig` in `lib/whitelabel.ts`).

## Interfaces
- **Backend endpoints called** (indirectly, via `fetchWhitelabelOrg`): `GET /backend/initial-setup/lookup-app-domain?domain=<host>` - unauthenticated lookup served by `server/routes/initialSetup.ts` (router mounted at `/initial-setup`).

## Dependencies
- **Internal:** `lib/whitelabel.ts` - `WhitelabelConfig` type, `getCurrentDomain`, `isWhitelabelDomain`, `fetchWhitelabelOrg` (which also applies colour fallbacks and treats a missing `whitelabelActive` as active).
- **Packages:** `react` - `useState`, `useEffect`.

## Used by
- `lib/whitelabel-context.tsx` - wraps the hook in a provider. Other files (`components/welcome/Welcome.tsx`, `app/(auth)/layout.tsx`, `app/(auth)/page.tsx`) mention it in comments about the login-page flash caused by branding resolving only in the browser.

## Notes
- **Hardcoded test domain:** in the current `lib/whitelabel.ts`, `getCurrentDomain()` unconditionally returns `"bat246.com"` (a "LOCAL TESTING" line left uncommented), so every host, including production and localhost, is treated as the `bat246.com` white-label domain. That line must be commented out again for real host detection.
- Because the first render always uses `DEFAULT_CONFIG` with `isLoading: true`, server-rendered and first client paint show Garage branding; consumers should gate on `isLoading` to avoid a flash.
