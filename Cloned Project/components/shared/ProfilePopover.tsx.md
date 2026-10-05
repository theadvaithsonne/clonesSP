# `components/shared/ProfilePopover.tsx`

> React component `ProfilePopover`.

**Kind:** React component · **Lines:** 3231 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×17 (components/ui/button.tsx), `Input`×16 (components/ui/input.tsx), `Loader2`×13 (lucide-react), `Label`×9 (components/ui/label.tsx), `Check`×8 (lucide-react), `LogOut`×7 (lucide-react), `ChevronDown`×6 (lucide-react), `Req`×6 (local), `X`×5 (lucide-react), `Trash2`×5 (lucide-react), `UserPlus`×5 (lucide-react), `MapPin`×4 (lucide-react), `Mail`×3 (lucide-react), `Search`×3 (lucide-react), `Dialog`×3 (components/ui/dialog.tsx), `DialogContent`×3 (components/ui/dialog.tsx), `DialogHeader`×3 (components/ui/dialog.tsx), `DialogTitle`×3 (components/ui/dialog.tsx), `DialogDescription`×3 (components/ui/dialog.tsx), `User`×2 (lucide-react), `PhoneVerifyTrigger`×2 (local), `Switch`×2 (components/ui/switch.tsx), `ReferrerSuggestionList`×2 (local), `ReferrerPreviewCard`×2 (local), `Pencil`×2 (lucide-react), `AlertTriangle`×2 (lucide-react), `ShieldCheck`×2 (lucide-react), `DialogFooter`×2 (components/ui/dialog.tsx), `Sheet`×2 (components/ui/sheet.tsx), `SheetContent`×2 (components/ui/sheet.tsx), `ReferrerAvatar`×2 (local), `AnimatePresence` (framer-motion), `AssociateAccountCard` (components/shared/AssociateAccountCard.tsx), `Camera` (lucide-react), `Sparkles` (lucide-react), `Upload` (lucide-react), `CountryTypeahead` (local), `BellRing` (lucide-react), `Building2` (lucide-react), `Save` (lucide-react)

### Props

- **`ProfilePopover`**: `isOpen: boolean`, `onClose: () => void`, `user: { id: string; email: string; name?: string; phone?: string | nu…`, `isFirstTimeUser?: boolean`, `onProfileComplete?: () => void`

**Hooks used:** `useState`×41, `useEffect`×10, `useMemo`×10, `useRef`×8, `useAuthStore`×2 (store/authStore.tsx), `useRouter` (next/navigation), `usePathname` (next/navigation), `useSettings` (lib/hooks/useSettings.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProfilePopover` | component | `ProfilePopover({ isOpen, onClose, user, isFirstTimeUser = false, onProfile…)` | 103 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/auth/phone/request-otp` (L228)
  - `POST /backend/auth/phone/verify-otp` (L249)
  - `GET /backend/org/resolve-pincode?${params.toString()}` (L506)
  - `GET /backend/profile?userId=${user.id}` (L544)
  - `GET /backend/bat246/profile/country-of-birth` (L591)
  - `GET /backend/unilevel-plus/users/search?q=${encodeURIComponent(query)}` (L640)
  - `POST /backend/affiliate/change-referrer` (L768)
  - `PUT /backend/bat246/profile/country-of-birth` (L898)
  - `GET /backend/auth/account/status` (L1005)
  - `POST /backend/org/${orgId}/leave` (L1037)
  - `POST /backend/auth/account/deletion-request` (L1058)
  - `DELETE /backend/auth/account` (L1082)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L536, L637, L845

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/switch.tsx` — `Switch`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `api`
  - `components/shared/AssociateAccountCard.tsx` — `AssociateAccountCard`
  - `lib/auth.ts` — `getToken`, `clearToken`
  - `lib/account-session.ts` — `signOutActiveAccount`
  - `store/authStore.tsx` — `useAuthStore`
  - `lib/profilePictureUpload.ts` — `uploadProfilePictureToS3`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`
  - `lib/dialCodes.ts` — `phoneCountries`
  - `lib/hooks/useSettings.ts` — `useSettings`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`, `Fragment`
  - `sonner` — `toast`
  - `lucide-react` — `User`, `MapPin`, `Save`, `X`, `Phone`, `ChevronDown`, …
  - `framer-motion` — `motion`, `AnimatePresence`
  - `next` — `useRouter`, `usePathname`
  - `country-state-city` — `ICountry`

## Used by

- `app/(dashboard)/layout.tsx`
- `app/(onboarding)/office-payment/page.tsx`

## Notes

- Large file (3231 lines) — read it by section; line numbers above point into it.
