# `app/(dashboard)/games/bat246/lostmoney/website/AboutPage.tsx`

> Async server component for the YourMoneyBack "About Us" page: Alan Kippax's personal letter explaining the repayment programme, with a sidebar commitment card and a "Register your claim" link whose path depends on the request's host.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 133

## Purpose
YourMoneyBack.info is a public site inviting people who lost money in earlier versions of Alan Kippax's business (the TLS, Time Leverage System, now TLS - BAT 246, "B2") to claim repayment. This file holds the long-form "About Us" letter. It lives with the other site pages in `lostmoney/website/` and is re-exported as the route page `app/games/bat246/lostmoney/index/about/page.tsx`, so it renders at `/games/bat246/lostmoney/index/about` and, on the custom domain, at `/aboutus`.

## How it works
- **Host-aware link (L44-L50).** Reads the `host` request header via `next/headers` (port stripped, lower-cased) and asks `isLostMoneyCustomDomainHost()` whether it is `yourmoneyback.info` / `www.yourmoneyback.info`. On the custom domain the CTA links to the short branded path `/register`; anywhere else it links to `/games/bat246/lostmoney/index/register`. This mirrors what `SiteHeader` / `SiteFooter` do, and `middleware.ts` rewrites the short paths back to the internal routes on that domain. Doing it server side keeps the first HTML correct and avoids a hydration mismatch.
- **Content.** Three hardcoded paragraph arrays (`PARAGRAPHS`, `PARAGRAPHS_2`, `PARAGRAPHS_3`) form the letter, separated by headings "Now I Want to Make Something Right." and "Perfected Since 1994", followed by a pull-quote and a signature block ("Alan Kippax", "A Continuous Goal", "TLS — BAT 246"). The letter states the intention to return 100% of verified losses, that missing documents are acceptable, and that part of the new TLS revenue is allocated to repayments.
- **Sidebar.** A sticky (on `lg`) aside with an "Our Commitment — Up to 100% of Your Verified Loss" card, a "Subject to review, verification, and available funds. Terms & Conditions apply." disclaimer, and the "Believe you're owed money?" card with the register link.
- Layout is a single column on small screens and `1fr 340px` from `lg`.

## Exports
- `default LostMoneyAboutPage(): Promise<JSX.Element>` - async server component (no props).

## Interfaces
- **Browser storage / cookies:** none. Reads the incoming `host` header only.

## Dependencies
- **Internal:** `lib/lostmoney-domains.ts` - `isLostMoneyCustomDomainHost()` decides branded vs internal link paths.
- **Packages:** `next/link`, `next/headers` (`headers()`), `lucide-react` (`ArrowRight`).

## Used by
- `app/games/bat246/lostmoney/index/about/page.tsx` (re-exports it as the page).
- Rendered inside `LostMoneySiteLayout` via `app/games/bat246/lostmoney/index/layout.tsx`.
- URLs: `/games/bat246/lostmoney/index/about`; `/aboutus` on yourmoneyback.info.

## Notes
- Calling `headers()` makes the route dynamically rendered on every request.
- "Terms & Conditions apply." is styled as an underlined span but is not a link.
- The copy contains specific personal claims (ages, years) as plain strings; edit them here if they change.
