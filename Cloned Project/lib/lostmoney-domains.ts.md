# `lib/lostmoney-domains.ts`

> Single source of truth for the hostnames that make up the yourmoneyback.info custom domain of the BAT246 "lost money" site.

**Kind:** frontend library · **Lines:** 14

## Purpose
The BAT246 lost-money website lives in the app tree at `/games/bat246/lostmoney/index/*`, but it is also served from its own branded domain. Several places need to know whether the current request is on that domain: the edge middleware (to rewrite paths), the lost-money layout, and pages that build self-links. This file keeps the host list in one edge-safe module (no Node APIs, so `middleware.ts` can import it).

## How it works
- `LOSTMONEY_CUSTOM_DOMAIN_HOSTS` lists `yourmoneyback.info` and `www.yourmoneyback.info`.
- `isLostMoneyCustomDomainHost(host)` lower-cases the given host and checks membership. Pages use it to choose short branded paths such as `/home` or `/aboutus` on the custom domain instead of the internal `/games/bat246/lostmoney/index/...` route.

## Exports
- `LOSTMONEY_CUSTOM_DOMAIN_HOSTS: readonly string[]` - the custom-domain hostnames.
- `isLostMoneyCustomDomainHost(host: string): boolean` - case-insensitive membership test.

## Dependencies
- **Internal:** none. **Packages:** none.

## Used by
- `middleware.ts` - builds `PATH_DOMAIN_MAP` entries mapping each host to `/games/bat246/lostmoney/index`, and limits the lost-money route aliases to these hosts.
- `app/games/bat246/lostmoney/index/layout.tsx` - detects custom-domain requests.
- `app/(dashboard)/games/bat246/lostmoney/website/HomePage.tsx`, `AboutPage.tsx` - choose branded link paths.

## Notes
- The host must not include a port; the comparison is exact after lower-casing.
- `middleware.ts` uses `LOSTMONEY_CUSTOM_DOMAIN_HOSTS.includes(host)` directly, without the lower-casing that `isLostMoneyCustomDomainHost` applies.
- The project memory notes there is no "yourlostmoney.com" domain; yourmoneyback.info is the real one.
