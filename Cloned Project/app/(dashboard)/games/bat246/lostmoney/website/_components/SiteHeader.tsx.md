# `app/(dashboard)/games/bat246/lostmoney/website/_components/SiteHeader.tsx`

> Sticky, responsive header for the YourMoneyBack.info (BAT246 Lost Money) public website, with active-link highlighting, a mobile menu and a "Register Your Claim" call to action.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 109

## Purpose
Top navigation shared by every page of the Lost Money website. The site is reachable two ways: on its own domain (where short URLs such as `/aboutus` are used) and inside the main Garage app (for example from the admin "Lost Money Website" preview tile), where the internal route paths must be used. The header picks the right link set for each case.

## How it works
- `BASE` is `/games/bat246/lostmoney/index`.
- Two static link tables:
  - `CUSTOM_DOMAIN_NAV_LINKS` - `/home`, `/aboutus`, `/paidlist`, `/testimonials`. These only work on the custom domain, where `middleware.ts`'s `LOSTMONEY_ROUTE_ALIASES` rewrites them to the internal routes.
  - `INTERNAL_NAV_LINKS` - `${BASE}`, `${BASE}/about`, `${BASE}/paid`, `${BASE}/testimonials`.
- `isCustomDomain` selects the table, the logo's home link (`/home` or `BASE`) and the register link (`/register` or `${BASE}/register`).
- A link is "active" (emerald text) when `usePathname()` equals its `href` exactly. On the custom domain the browser path is the short alias, so the comparison still works.
- Desktop (`lg+`): logo, inline nav, and a "Register Your Claim" button. Below `lg`: a hamburger button toggles `open`, revealing a stacked nav plus the register button; tapping any link closes the menu.
- The header is `sticky top-0 z-50` with a translucent dark background and backdrop blur.

## Exports
- `SiteHeader({ isCustomDomain = false }: { isCustomDomain?: boolean })` - the header element (client component).

## Dependencies
- **Packages:** `next` (`next/link`, `usePathname` from `next/navigation`), `react` (`useState`), `lucide-react` (`Menu`, `X`, `ShieldCheck`).

## Used by
- `app/(dashboard)/games/bat246/lostmoney/website/LostMoneySiteLayout.tsx`, which gets `isCustomDomain` from `app/games/bat246/lostmoney/index/layout.tsx`.

## Notes
- The nav omits "Register" as a regular link because it is the call-to-action button; `SiteFooter` lists it as a normal link.
- Keep both link tables in sync with `SiteFooter` and the middleware alias map; adding a page means updating all three.
