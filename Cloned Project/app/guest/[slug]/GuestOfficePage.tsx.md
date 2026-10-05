# `app/guest/[slug]/GuestOfficePage.tsx`

> React component `GuestOfficePage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 3300 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×9 (lucide-react), `Button`×8 (components/ui/button.tsx), `Label`×8 (components/ui/label.tsx), `Link`×7 (next/link), `Input`×7 (components/ui/input.tsx), `Check`×6 (lucide-react), `Building2`×4 (lucide-react), `Clock`×4 (lucide-react), `CheckCircle2`×4 (lucide-react), `ArrowRight`×4 (lucide-react), `User`×3 (lucide-react), `Crown`×3 (lucide-react), `Dialog`×3 (components/ui/dialog.tsx), `DialogContent`×3 (components/ui/dialog.tsx), `DialogHeader`×3 (components/ui/dialog.tsx), `DialogTitle`×3 (components/ui/dialog.tsx), `DialogDescription`×3 (components/ui/dialog.tsx), `DialogFooter`×3 (components/ui/dialog.tsx), `Users`×2 (lucide-react), `BookOpen`×2 (lucide-react), `Star`×2 (lucide-react), `Lock`×2 (lucide-react), `Mail`×2 (lucide-react), `OtpInput`×2 (components/ui/otp-input.tsx), `RotateCcw`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `Search`×2 (lucide-react), `ArrowLeft` (lucide-react), `OpenInAppBanner` (components/ui/open-in-app-banner.tsx), `GuestNavbar` (app/guest/[slug]/components/GuestNavbar.tsx), `Hash` (lucide-react), `Calendar` (lucide-react), `Play` (lucide-react), `Phone` (lucide-react), `Video` (lucide-react), `ShoppingBag` (lucide-react), `Download` (lucide-react), `Briefcase` (lucide-react), `X` (lucide-react), `Textarea` (components/ui/textarea.tsx), … +2 more

**Hooks used:** `useState`×45, `useEffect`×10, `useMemo`×5, `useParams` (next/navigation), `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GuestOfficePage)` | component | `GuestOfficePage()` | 253 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/guest-auth/guest-limit-status?orgId=${organization!._id}` (L514)
  - `GET /backend/public/calls/${organization!._id}` (L538)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L569)
  - `GET /backend/guest-auth/hq-items/${slug}` (L618)
  - `POST /backend/guest-auth/request-otp` (L667)
  - `POST /backend/guest-auth/verify-otp` (L686)
  - `POST /backend/guest-auth/public-join` (L779)
  - `POST /backend/guest-auth/private-join` (L843)
  - `POST /backend/auth/select-org` (L916)
  - `POST /backend/guest-auth/request-join` (L1029)
- **Browser storage / cookies:** `guest_user_id` (localStorage: get/remove/set), `guest_email` (localStorage: get/remove/set)
- **Timers / queues:** `setTimeout` at L650
- **External hosts mentioned in the code:** `www.youtube.com`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/utils.ts` — `parseDateLocal`, `formatTime12Hour`, `stripHtml`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/otp-input.tsx` — `OtpInput (default)`
  - `components/dashboard/CommissionPlanSection.tsx` — `CompPlanBadge`
  - `lib/dialCodes.ts` — `phoneCountries`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`, `getUserDataFromToken`, `isAuthenticated as checkWorkspaceAuth`
  - `app/guest/[slug]/components/GuestNavbar.tsx` — `GuestNavbar (default)`
  - `components/ui/open-in-app-banner.tsx` — `OpenInAppBanner`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useMemo`, `useRef`
  - `next` — `useParams`, `useRouter`, `useSearchParams`
  - `lucide-react` — `Building2`, `MapPin`, `Clock`, `CheckCircle2`, `XCircle`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `app/guest/[slug]/page.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L1620).
- Large file (3300 lines) — read it by section; line numbers above point into it.
