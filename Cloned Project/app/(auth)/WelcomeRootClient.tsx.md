# `app/(auth)/WelcomeRootClient.tsx`

> Client wrapper that renders the shared `Welcome` sign-in/landing experience for the site root (`/`) inside a Suspense boundary with a skeleton fallback.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 24

## Purpose
`app/(auth)/page.tsx` is a server component (it needs `generateMetadata` to set gotobigwin.com link-preview tags per request), so it cannot itself be a client component. This small `"use client"` file holds the client half: it mounts `Welcome`, which reads URL search params with `useSearchParams()` and therefore must sit under a `<Suspense>` boundary in the App Router.

## How it works
- `WelcomeLoadingFallback` (not exported) draws a dark full-screen placeholder (`#0c0c0e` background) with two pulsing blocks, a logo tile and a title bar, so the page does not flash empty while `Welcome` suspends.
- `WelcomeRootClient` returns `<Suspense fallback={<WelcomeLoadingFallback />}><Welcome /></Suspense>`.
- All real behaviour (login/OTP flows, referral handling, whitelabel branding, the BAT246 landing on its domains) lives in `components/welcome/Welcome.tsx`.

The same fallback markup is duplicated in `app/(auth)/login/page.tsx`.

## Exports
- `WelcomeRootClient()` - named export; client component rendering `Welcome` inside Suspense.

## Dependencies
- **Internal:** `components/welcome/index.ts` - re-exports `Welcome` (from `components/welcome/Welcome.tsx`).
- **Packages:** `react` - `Suspense`.

## Used by
- `app/(auth)/page.tsx` - the root route `/` (the `(auth)` group does not appear in URLs), wrapped by `app/(auth)/layout.tsx`.
