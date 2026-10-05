# `app/(dashboard)/games/bat246/lostmoney/website/_components/SiteFooter.tsx`

> Footer for the YourMoneyBack.info (BAT246 Lost Money) public website, with domain-aware links to the site's pages.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 55

## Purpose
Shared footer for every page of the Lost Money website. It shows the brand, a short mission line, a "Site" link list and a quote, plus a copyright and disclaimer bar. Like `SiteHeader`, it switches between short public URLs and the internal Next.js paths depending on which host the site is served from.

## How it works
- `BASE` is `/games/bat246/lostmoney/index`, the internal route prefix of the site.
- When `isCustomDomain` is true (the site is being viewed on its own domain), links use the short aliases `/home`, `/aboutus`, `/register`, `/paidlist`, `/testimonials`, which `middleware.ts` rewrites (`LOSTMONEY_ROUTE_ALIASES`) to the internal routes. Otherwise it links to `${BASE}`, `${BASE}/about`, `${BASE}/register`, `${BASE}/paid`, `${BASE}/testimonials` directly.
- Three columns (one on mobile): brand with `ShieldCheck` icon and mission text; the five site links; a quote attributed to Alan Kippax.
- Bottom bar: copyright year from `new Date().getFullYear()` and a disclaimer that claims are reviewed individually and repayment is not guaranteed.
- No `"use client"` directive and no state, so it can render as a server component.

## Exports
- `SiteFooter({ isCustomDomain = false }: { isCustomDomain?: boolean })` - the footer element.

## Dependencies
- **Packages:** `next` (`next/link`), `lucide-react` (`ShieldCheck`).

## Used by
- `app/(dashboard)/games/bat246/lostmoney/website/LostMoneySiteLayout.tsx`, which receives `isCustomDomain` from `app/games/bat246/lostmoney/index/layout.tsx` (host check via `isLostMoneyCustomDomainHost`).

## Notes
- The copyright text contains a stray `;-` after "YourMoneyBack.info" (L48); this is in the source, not a rendering issue.
- The link set must stay in sync with `SiteHeader` and with the aliases in `middleware.ts`.
