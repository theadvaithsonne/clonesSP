# `app/guest/[slug]/article/[postId]/ArticlePageClient.tsx`

> React component `ArticlePageClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 965 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Building2`×2 (lucide-react), `Clock`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `Play` (lucide-react), `Youtube` (lucide-react), `AlertCircle` (lucide-react), `FileText` (lucide-react), `YouTubePreviewCard` (local), `ExternalLink` (lucide-react), `User` (lucide-react)

**Hooks used:** `useState`×8, `useEffect`×5, `useRef`×2, `useParams` (next/navigation), `useRouter` (next/navigation), `useSearchParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ArticlePageClient)` | component | `ArticlePageClient()` | 290 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/posts/${postId}` (L389)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L411)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)
- **External hosts mentioned in the code:** `img.youtube.com`

## Dependencies

- **Internal:**
  - `lib/content-tracker.ts` — `ContentTracker`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `lib/deeplink.ts` — `buildOfficeJoinLoginUrl`
  - `components/feed/article-editor.css` (side effect)
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `next` — `useParams`, `useRouter`, `useSearchParams`
  - `lucide-react` — `Clock`, `FileText`, `Loader2`, `AlertCircle`, `Building2`, `ArrowRight`, …
  - `dompurify`

## Used by

- `app/guest/[slug]/article/[postId]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L644).
