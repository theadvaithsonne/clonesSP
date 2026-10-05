# `app/guest/[slug]/components/GuestJoinFlow.tsx`

> React component `GuestJoinFlow`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1244 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×8 (lucide-react), `Label`×7 (components/ui/label.tsx), `Input`×7 (components/ui/input.tsx), `Button`×7 (components/ui/button.tsx), `Check`×3 (lucide-react), `ArrowRight`×3 (lucide-react), `CheckCircle2`×3 (lucide-react), `Dialog`×3 (components/ui/dialog.tsx), `DialogContent`×3 (components/ui/dialog.tsx), `DialogHeader`×3 (components/ui/dialog.tsx), `DialogTitle`×3 (components/ui/dialog.tsx), `DialogDescription`×3 (components/ui/dialog.tsx), `DialogFooter`×3 (components/ui/dialog.tsx), `Building2`×2 (lucide-react), `Mail`×2 (lucide-react), `OtpInput`×2 (components/ui/otp-input.tsx), `RotateCcw`×2 (lucide-react), `User`×2 (lucide-react), `Phone`×2 (lucide-react), `X` (lucide-react), `Lock` (lucide-react), `Send` (lucide-react)

### Props

- **`GuestJoinFlow`**: `organization: GuestJoinFlowOrganization`, `slug: string`, `brandColor: string`, `isOpen: boolean`, `onClose: () => void`, `onStatusChange?: () => void`

**Hooks used:** `useState`×25, `useEffect`×5, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GuestJoinFlow)` | component | `GuestJoinFlow({ organization, slug, brandColor, isOpen, onClose, onStatus…)` | 80 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/guest-limit-status?orgId=${organization._id}` (L199)
  - `POST /backend/guest-auth/request-otp` (L243)
  - `POST /backend/guest-auth/verify-otp` (L260)
  - `GET /backend/guest-auth/hq-by-slug/${slug}?userId=${response.userId}` (L291)
  - `POST /backend/guest-auth/public-join` (L347)
  - `POST /backend/guest-auth/private-join` (L402)
  - `POST /backend/auth/select-org` (L463)
  - `POST /backend/guest-auth/request-join` (L550)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get/set/remove), `guest_email` (localStorage: get/set/remove)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`, `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`
  - `next` — `useRouter`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `ArrowRight`, `Building2`, `User`, `Mail`, `Phone`, `Lock`, …

## Used by

- `app/guest/[slug]/components/GuestNavbar.tsx`
- `app/guest/[slug]/drop/[dropId]/DropPageClient.tsx`
- `app/guest/[slug]/playlist/[playlistId]/PlaylistPageClient.tsx`
- `app/guest/[slug]/recording/[recordingId]/RecordingPageClient.tsx`
- `app/guest/[slug]/testimonials/[testimonialSlug]/TestimonialDetailClient.tsx`
- `app/guest/[slug]/video/[videoId]/VideoPageClient.tsx`
