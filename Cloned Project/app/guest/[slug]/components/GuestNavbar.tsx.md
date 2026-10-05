# `app/guest/[slug]/components/GuestNavbar.tsx`

> React component `GuestNavbar`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 659 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `CheckCircle2`×3 (lucide-react), `ArrowLeft`×3 (lucide-react), `XCircle`×2 (lucide-react), `Sun`×2 (lucide-react), `Moon`×2 (lucide-react), `Loader2`×2 (lucide-react), `Clock` (lucide-react), `Building2` (lucide-react), `Link` (next/link), `Menu` (lucide-react), `X` (lucide-react), `ArrowRight` (lucide-react), `GuestJoinFlow` (app/guest/[slug]/components/GuestJoinFlow.tsx)

### Props

- **`GuestNavbar`**: `organization: GuestNavbarOrganization`, `slug: string`, `theme: "light" | "dark"`, `setTheme: (theme: "light" | "dark") => void`, `brandColor: string`, `navItems?: NavItem[]`, `onApplyClick?: () => void`, `isMember?: boolean`, `requestStatus?: "pending" | "approved" | "rejected" | null`, `officePublic?: boolean`, `guestLimitReached?: boolean`, `isAuthenticatedProp?: boolean`, `guestEmailProp?: string | null`, `isWorkspaceUserProp?: boolean`, `workspaceOrgIdProp?: string | null`, `joiningOrg?: boolean`

**Hooks used:** `useState`×9, `useEffect`×3, `useRouter` (next/navigation), `useSearchParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GuestNavbar)` | component | `GuestNavbar({ organization, slug, theme, setTheme, brandColor, navItems…)` | 125 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/guest-limit-status?orgId=${organization._id}` (L232)
  - `GET /backend/guest-auth/hq-items/${slug}` (L273)
  - `GET /backend/public/calls/${organization._id}` (L283)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get), `guest_email` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/button.tsx` — `Button`
  - `lib/auth.ts` — `isAuthenticated as checkWorkspaceAuth`, `getUserDataFromToken`
  - `app/guest/[slug]/components/GuestJoinFlow.tsx` — `GuestJoinFlow (default)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `Building2`, `Sun`, `Moon`, `X`, `Menu`, `ArrowLeft`, …

## Used by

- `app/guest/[slug]/GuestOfficePage.tsx`
- `app/guest/[slug]/call/[callId]/page.tsx`
- `app/guest/[slug]/channel/[channelId]/page.tsx`
- `app/guest/[slug]/course/[courseId]/page.tsx`
- `app/guest/[slug]/post/[postId]/PostPageClient.tsx`
- `app/guest/[slug]/product/[productId]/page.tsx`
- `app/guest/[slug]/service/[serviceId]/page.tsx`
- `app/guest/[slug]/video/[videoId]/VideoPageClient.tsx`
- `app/guest/[slug]/webinar/[webinarId]/WebinarDetailPageClient.tsx`
