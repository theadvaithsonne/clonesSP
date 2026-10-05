# `components/affiliate/globe/index.ts`

> Barrel file that re-exports the affiliate "globe" network explorer: its view, map, sidebar, profile overlay, data hook and shared types.

**Kind:** React component (barrel module) · **Lines:** 8

## Purpose
The affiliate globe is a small feature folder that lets a user explore their referral (downline) network on a 3D Mapbox globe with a sidebar list, plus a slide-in profile panel for any affiliate. This index gives the rest of the app a single import path, `@/components/affiliate/globe`, so consumers do not need to know the internal file layout.

## How it works
It contains only re-export statements; no logic runs here.

## Exports
- `AffiliateGlobeView` - from `./AffiliateGlobeView`; the full globe-plus-sidebar screen.
- `AffiliateGlobeMap` - from `./AffiliateGlobeMap`; the Mapbox globe on its own.
- `AffiliateAccordionSidebar` - from `./AffiliateAccordionSidebar`; the referral list / search sidebar.
- `AffiliateProfileOverlay` - from `./AffiliateProfileOverlay`; the slide-in profile panel.
- `useAffiliateGlobe` - from `./hooks/useAffiliateGlobe`; state and data-loading hook behind the view.
- `export * from "./types"` - all types (`AffiliateUser`, `AffiliateOffice`, `GlobeMarkerData`, response types, ...), `COUNTRY_COORDINATES` and the helpers `assignFallbackCoordinates`, `isValidCoordinate`, `getLocationString`.

## Dependencies
- **Internal:** every file in `components/affiliate/globe/` listed above.

## Used by
- `app/(dashboard)/layout.tsx` - imports `AffiliateProfileOverlay`, mounted once for the whole dashboard and opened by the `affiliate-profile:open` window event.
- `components/dashboard/AffiliatePageNew.tsx` - imports `AffiliateGlobeView` for the affiliate page's globe tab.
