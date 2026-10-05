# `app/guest/[slug]/testimonials/[testimonialSlug]/page.tsx`

> Next.js page rendered at `/guest/[slug]/testimonials/[testimonialSlug]`.

**Kind:** Next.js page · **Lines:** 144 · **Route:** `/guest/[slug]/testimonials/[testimonialSlug]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `TestimonialDetailClient` (app/guest/[slug]/testimonials/[testimonialSlug]/TestimonialDetailClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared testimonial links. | 37 |
| `default (Page)` | component | `async Page()` | 141 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/testimonials/${slug}/${testimonialSlug}` (L51)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L69)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/testimonials/[testimonialSlug]/TestimonialDetailClient.tsx` — `TestimonialDetailClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/testimonials/[testimonialSlug]` (page).
