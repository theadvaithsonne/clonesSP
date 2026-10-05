# `app/guest/[slug]/testimonials/[testimonialSlug]/TestimonialDetailClient.tsx`

> React component `TestimonialDetailClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 795 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Building2`×4 (lucide-react), `Button`×4 (components/ui/button.tsx), `Star`×2 (lucide-react), `ArrowLeft`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `ExternalLink`×2 (lucide-react), `Link` (next/link), `Quote` (lucide-react), `ContentBlockRenderer` (local), `User` (lucide-react), `Globe` (lucide-react), `Link2` (lucide-react), `BarChart3` (lucide-react), `RelatedTestimonialCard` (local), `ChevronRight` (lucide-react), `GuestJoinFlow` (app/guest/[slug]/components/GuestJoinFlow.tsx)

**Hooks used:** `useState`×12, `useEffect`×6, `useRouter`×2 (next/navigation), `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TestimonialDetailClient)` | component | `TestimonialDetailClient()` | 190 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L262)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)
- **External hosts mentioned in the code:** `www.youtube.com`

## Dependencies

- **Internal:**
  - `lib/testimonials-api.ts` — `getPublicTestimonialDetail`, `Testimonial`, `TestimonialListItem`, `OrganizationInfo`, `FounderInfo`, `ContentBlock`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `lib/content-tracker.ts` — `ContentTracker`
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `app/guest/[slug]/components/GuestJoinFlow.tsx` — `GuestJoinFlow (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`
  - `next` — `useParams`, `useSearchParams`, `useRouter`
  - `framer-motion` — `motion`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `Building2`, `ExternalLink`, `Globe`, `Loader2`, …

## Used by

- `app/guest/[slug]/testimonials/[testimonialSlug]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L71).
