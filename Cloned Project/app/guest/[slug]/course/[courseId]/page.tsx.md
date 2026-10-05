# `app/guest/[slug]/course/[courseId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/course/[courseId]`.

**Kind:** Next.js page · **Lines:** 873 · **Directive:** `"use client"` · **Route:** `/guest/[slug]/course/[courseId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StarRating`×4 (local), `Link`×3 (next/link), `Button`×3 (components/ui/button.tsx), `Star`×2 (lucide-react), `BookOpen`×2 (lucide-react), `Users`×2 (lucide-react), `Play`×2 (lucide-react), `Check`×2 (lucide-react), `PlayCircle`×2 (lucide-react), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Clock` (lucide-react), `Globe` (lucide-react), `Video` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Lock` (lucide-react)

**Hooks used:** `useState`×6, `useParams` (next/navigation), `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CourseDetailPage)` | component | `CourseDetailPage()` | 253 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/courses/${courseId}` (L309)
  - `GET /backend/guest-auth/hq-by-slug/${slug}` (L327)
  - `GET /backend/guest-auth/hq-items/${slug}` (L337)

## Dependencies

- **Internal:**
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useRouter`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowLeft`, `Star`, `Users`, `Clock`, `Globe`, `Play`, …

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/course/[courseId]` (page).

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L468).
