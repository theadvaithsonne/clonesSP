# `app/(auth)/page.tsx`

> The app's root page (`/`): renders the client-side welcome/login screen and, on gotobigwin.com only, supplies BAT 246 social-share metadata.

**Kind:** Next.js page · **Lines:** 48 · **Route:** `/`

## Purpose
This is the landing page every visitor hits at the site root. The `(auth)` route group does not appear in the URL, so the page lives at `/` and shares the auth layout with `/login` and `/verify`. The visible UI is entirely delegated to `WelcomeRootClient`; this server component exists mainly so that link-preview crawlers (WhatsApp, Twitter and similar), which never run client JavaScript, can receive per-host metadata.

## How it works
- `generateMetadata()` reads the `host` request header (via `next/headers`), strips any port and lowercases it.
- If the host does not contain `gotobigwin.com`, it returns `{}`. Next.js merges an empty object with the root layout's static `metadata` (in `app/layout.tsx`), so my.garage.app and every other white-label domain keep their existing title and description.
- On gotobigwin.com it returns a BAT 246 title ("BAT 246 - Go To Big Win"), a description, OpenGraph and Twitter `summary_large_image` cards using `/images/bat246-alan-logo.png`, and overrides the favicon / shortcut / apple icon with `/images/bat246-favicon-b2.png` (the gold B2 coin). The favicon override is needed because `app/favicon.ico` is one global file for every domain.
- The default export `AuthRootPage` simply renders `<WelcomeRootClient />`, which wraps the `Welcome` component (from `components/welcome`) in a `Suspense` boundary with a skeleton fallback.

## Exports
- `default AuthRootPage()` - server component rendering the welcome/login client.
- `generateMetadata(): Promise<Metadata>` - per-request metadata; non-empty only on gotobigwin.com hosts.

## Dependencies
- **Internal:** `app/(auth)/WelcomeRootClient.tsx` - client wrapper around the `Welcome` login screen.
- **Packages:** `next` - `Metadata` type and `headers()` for reading the request host.

## Used by
Not imported by any file. Reached by Next.js routing at `/` (host-based rewrites in `middleware.ts` may route other domains elsewhere before reaching it).

## Notes
- Because `generateMetadata` calls `headers()`, this route is rendered dynamically per request rather than statically.
- The host check is a substring match (`includes("gotobigwin.com")`), so any subdomain of gotobigwin.com also gets the BAT 246 preview.
- The comment explains that the page used to be pure `"use client"`, which made per-host metadata impossible; keep the client UI in `WelcomeRootClient` so this file can stay a server component.
