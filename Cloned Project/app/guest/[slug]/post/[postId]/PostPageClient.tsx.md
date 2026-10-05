# `app/guest/[slug]/post/[postId]/PostPageClient.tsx`

> React component `PostPageClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 732 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `ArrowRight`×2 (lucide-react), `Image` (lucide-react), `Play` (lucide-react), `Music` (lucide-react), `FileText` (lucide-react), `AlertCircle` (lucide-react), `Link` (next/link), `AttachmentIcon` (local), `MessageCircle` (lucide-react), `Repeat2` (lucide-react), `Building2` (lucide-react), `User` (lucide-react)

**Hooks used:** `useState`×8, `useEffect`×4, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PostPageClient)` | component | `PostPageClient()` | 172 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/posts/${postId}` (L268)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L297)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `components/ui/button.tsx` — `Button`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
  - `lib/deeplink.ts` — `buildOfficeJoinLoginUrl`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useParams`, `useSearchParams`, `useRouter`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `Building2`, `User`, `Heart`, `MessageCircle`, …

## Used by

- `app/guest/[slug]/post/[postId]/page.tsx`
