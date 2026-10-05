# `app/guest/[slug]/testimonials/page.tsx`

> Next.js page rendered at `/guest/[slug]/testimonials`.

**Kind:** Next.js page · **Lines:** 560 · **Directive:** `"use client"` · **Route:** `/guest/[slug]/testimonials` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Star`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `ArrowLeft`×2 (lucide-react), `CategoryChip`×2 (local), `TestimonialCard`×2 (local), `Building2` (lucide-react), `ChevronRight` (lucide-react), `Loader2` (lucide-react), `Check` (lucide-react), `Share2` (lucide-react), `Link` (next/link), `ExternalLink` (lucide-react)

**Hooks used:** `useState`×9, `useRouter`×2 (next/navigation), `useEffect`×2, `useParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TestimonialsShowcasePage)` | component | `TestimonialsShowcasePage()` | 268 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L289)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setTimeout` at L316

## Dependencies

- **Internal:**
  - `lib/testimonials-api.ts` — `getPublicTestimonials`, `TestimonialListItem`, `OrganizationInfo`, `FounderInfo`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useRouter`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `ArrowLeft`, `Building2`, `ExternalLink`, `Loader2`, `Star`, `Quote`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/testimonials` (page).
