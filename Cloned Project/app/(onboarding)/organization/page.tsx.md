# `app/(onboarding)/organization/page.tsx`

> Next.js page rendered at `/organization`.

**Kind:** Next.js page · **Lines:** 1142 · **Directive:** `"use client"` · **Route:** `/organization` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×8 (components/ui/label.tsx), `Button`×7 (components/ui/button.tsx), `Input`×5 (components/ui/input.tsx), `Check`×4 (lucide-react), `Popover`×3 (components/ui/popover.tsx), `PopoverTrigger`×3 (components/ui/popover.tsx), `ChevronDown`×3 (lucide-react), `PopoverContent`×3 (components/ui/popover.tsx), `Command`×3 (components/ui/command.tsx), `CommandInput`×3 (components/ui/command.tsx), `CommandList`×3 (components/ui/command.tsx), `CommandEmpty`×3 (components/ui/command.tsx), `CommandGroup`×3 (components/ui/command.tsx), `CommandItem`×3 (components/ui/command.tsx), `Loader2`×3 (lucide-react), `X`×2 (lucide-react), `MapPin` (lucide-react), `Textarea` (components/ui/textarea.tsx), `Building2` (lucide-react), `Checkbox` (components/ui/checkbox.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `TermsAndConditionsModal` (components/onboarding/TermsAndConditionsModal.tsx), `Suspense` (react), `OrganizationPageContent` (local)

**Hooks used:** `useState`×24, `useMemo`×6, `useRef`×5, `useEffect`×3, `useRouter` (next/navigation), `useLicenceGate` (app/(onboarding)/layout.tsx), `useSearchParams` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrganizationPage)` | component | `OrganizationPage()` | 1135 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/uploads/public` (L161)
  - `GET /backend/org/categories` (L203)
  - `GET /backend/org/resolve-pincode?${params.toString()}` (L268)
  - `GET /backend/auth/get-user?userId=${userId}` (L370)
  - `POST /backend/auth/update-user` (L389)
  - `POST /backend/org/create-first-time` (L395)
  - `POST /backend/auth/token-after-org` (L413)
  - `POST /backend/checkout/office/${newOrgId}/subscribe` (L438)
  - `POST /backend/checkout/office/${newOrgId}/start-trial` (L463)
- **Browser storage / cookies:** `garage_org_id` (localStorage: set)
- **Timers / queues:** `setTimeout` at L298, L646, L758, L942

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/auth.ts` — `saveToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/command.tsx` — `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`
  - `lib/utils.ts` — `cn`
  - `app/(onboarding)/layout.tsx` — `useLicenceGate`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/onboarding/TermsAndConditionsModal.tsx` — `TermsAndConditionsModal`
- **Packages:**
  - `react` — `Suspense`, `useState`, `useMemo`, `useEffect`, `useRef`
  - `next` — `useRouter`, `useSearchParams`
  - `sonner` — `toast`
  - `lucide-react` — `Building2`, `Check`, `Loader2`, `MapPin`, `Minus`, `Plus`, …
  - `country-state-city` — `Country`, `State`

## Used by

Entry: reached by the Next.js router at `/organization` (page).
