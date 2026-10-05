# `components/ui/open-in-app-banner.tsx`

> OpenInAppBanner

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 328 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
OpenInAppBanner

Shows a sticky bottom banner on mobile browsers offering to open the
Garage Store app. Behaviour:

 Android (Chrome):
   Uses the Android Intent URL format: intent://<path>#Intent;scheme=...;package=...;end
   WITHOUT S.browser_fallback_url — so if the app is not installed Chrome
   simply shows its native "can't open" state instead of auto-redirecting
   to the Play Store. The user can visit the Play Store manually if they wish.

 iOS (Safari):
   Fires the custom-scheme URI (garagestore://). After a 1.8 s timeout,
   if the page is still visible (app didn't open), redirects to the App Store.

The banner is only rendered on narrow viewports (phones), hidden on […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`OpenInAppBanner`**: `deepLinkPath: string`, `contentTitle?: string`

**Hooks used:** `useState`×3, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OpenInAppBanner` | component | `OpenInAppBanner({ deepLinkPath, contentTitle }: OpenInAppBannerProps)` | 58 |

## Interfaces

- **Timers / queues:** `setTimeout` at L69, L105, L117

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`

## Used by

- `app/guest/[slug]/GuestOfficePage.tsx`
- `app/guest/[slug]/product/[productId]/page.tsx`
