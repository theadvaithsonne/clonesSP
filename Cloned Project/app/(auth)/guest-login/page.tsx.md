# `app/(auth)/guest-login/page.tsx`

> Next.js page for `/guest-login` that renders the guest email-entry form inside a Suspense boundary.

**Kind:** Next.js page · **Lines:** 11 · **Route:** `/guest-login`

## Purpose
Route entry point for guest access: a visitor without a full account enters an email, gets a one-time code and can then browse and request to join organisations (HQs). The page file only provides the route; the UI lives in the colocated `GuestLogin.tsx`.

## How it works
- Default-exports `GuestLoginPage`, a server component that renders `<GuestLogin />` inside `<Suspense fallback={<div>Loading...</div>}>`.
- The Suspense boundary is the conventional App Router wrapper for client components that use navigation hooks; `GuestLogin` itself only uses `useRouter`, so the fallback is rarely visible.
- The page is wrapped by `app/(auth)/layout.tsx`, which applies the whitelabel provider, the mobile viewport/scroll lock and the pre-login announcement host.

## Exports
- `default GuestLoginPage()` - the page component.

## Dependencies
- **Internal:** `app/(auth)/guest-login/GuestLogin.tsx` - the form.
- **Packages:** `react` - `Suspense`.

## Used by
Reached by URL `/guest-login`. Linked from `app/browse-hqs/BrowseHQs.tsx` (redirects there when no guest session is stored) and from `app/(auth)/guest-verify/GuestVerify.tsx` ("Use a different email" and the missing-email redirect). Listed in the in-app docs at `app/docs/content/chapters/02-access.ts`.
