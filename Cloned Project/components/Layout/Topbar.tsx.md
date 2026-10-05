# `components/Layout/Topbar.tsx`

> Static sticky header for the onboarding shell, with a "TEAM • ONBOARDING" home link and Dashboard and Login links.

**Kind:** React component · **Lines:** 31

## Purpose
The header used by `Shell` on the team onboarding page. It gives users a way back to the home page, the dashboard or the login page while setting up a team.

## How it works
- Renders a `<header>` with the `glass-pro` utility class (a frosted-glass style defined in global CSS), `sticky top-0 z-20`.
- Inside a `max-w-6xl` container:
  - Left: `next/link` to `/` labelled "TEAM • ONBOARDING".
  - Right: `<nav>` with links to `/dashboard` and `/login`.
- Colours come from the theme variables `--muted-foreground` and `--foreground`.
- No state, props or effects.

## Exports
- `default Topbar()` - the header element.

## Dependencies
- **Packages:** `next` - `next/link` for client-side navigation.

## Used by
- `components/Layout/Shell.tsx`, which in turn is used by `app/(onboarding)/team/page.tsx` (route `/team`).

## Notes
- The Login link is shown regardless of whether the user is signed in; the component has no auth awareness.
