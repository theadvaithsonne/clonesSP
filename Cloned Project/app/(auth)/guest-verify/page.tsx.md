# `app/(auth)/guest-verify/page.tsx`

> Next.js page for `/guest-verify` that renders the guest OTP-entry screen inside a Suspense boundary.

**Kind:** Next.js page · **Lines:** 11 · **Route:** `/guest-verify`

## Purpose
Second step of the guest access flow: after `/guest-login` sends a code, the visitor lands here (with `?email=...` and optionally `?referCode=...`) to enter the 6-digit OTP. The page file only provides the route; the UI and logic are in the colocated `GuestVerify.tsx`.

## How it works
- Default-exports `GuestVerifyPage`, a server component that renders `<GuestVerify />` inside `<Suspense fallback={<div>Loading...</div>}>`.
- The Suspense boundary is required because `GuestVerify` calls `useSearchParams()`, which in the App Router must be under a Suspense boundary for static rendering.
- Wrapped by `app/(auth)/layout.tsx` (whitelabel provider, mobile viewport lock, pre-login announcements).

## Exports
- `default GuestVerifyPage()` - the page component.

## Dependencies
- **Internal:** `app/(auth)/guest-verify/GuestVerify.tsx` - the OTP screen.
- **Packages:** `react` - `Suspense`.

## Used by
Reached by URL `/guest-verify?email=<email>`; `app/(auth)/guest-login/GuestLogin.tsx` navigates here after requesting a code.
