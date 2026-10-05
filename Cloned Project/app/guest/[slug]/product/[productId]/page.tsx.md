# `app/guest/[slug]/product/[productId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/product/[productId]`.

**Kind:** Next.js page · **Lines:** 711 · **Directive:** `"use client"` · **Route:** `/guest/[slug]/product/[productId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Package`×4 (lucide-react), `Check`×3 (lucide-react), `Star`×2 (lucide-react), `Link`×2 (next/link), `Button`×2 (components/ui/button.tsx), `StarRating`×2 (local), `Download`×2 (lucide-react), `ShoppingBag` (lucide-react), `OpenInAppBanner` (components/ui/open-in-app-banner.tsx), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Shield` (lucide-react), `RefreshCw` (lucide-react), `Zap` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Users` (lucide-react), `Lock` (lucide-react)

**Hooks used:** `useState`×7, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProductDetailPage)` | component | `ProductDetailPage()` | 162 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/products/${productId}` (L234)
  - `GET /backend/guest-auth/hq-by-slug/${slug}` (L251)
  - `GET /backend/guest-auth/hq-items/${slug}` (L261)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `stripHtml`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
  - `components/ui/open-in-app-banner.tsx` — `OpenInAppBanner`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Star`, `Users`, `Download`, `Check`, `ChevronDown`, …

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/product/[productId]` (page).

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L358).
