# `components/dashboard/ManagementPage.tsx`

> React component `ManagementPage`.

**Kind:** React component · **Lines:** 911 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `Crown`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `CheckCircle2`×2 (lucide-react), `WhitelabelGate`×2 (components/dashboard/WhitelabelGate.tsx), `UserPlus` (lucide-react), `UserRoundCog` (lucide-react), `Clock` (lucide-react), `UserCheck` (lucide-react), `Tag` (lucide-react), `Globe` (lucide-react), `Palette` (lucide-react), `Sparkles` (lucide-react), `CouponInput` (components/ui/coupon-input.tsx), `ExternalLink` (lucide-react), `Save` (lucide-react), `FounderLeaveDashboard` (components/dashboard/FounderLeaveDashboard.tsx), `InvitesPage` (components/dashboard/InviteePage.tsx), `PendingRequestsPage` (components/dashboard/PendingRequestsPage.tsx), `FounderGuestsPage` (components/dashboard/FounderGuestsPage.tsx), `FounderPlatformCouponsPage` (components/dashboard/FounderPlatformCouponsPage.tsx), `DomainManagementPage` (components/dashboard/DomainManagementPage.tsx), `BrandingPage` (local), `TeamAccessPage` (components/dashboard/teamAccess/TeamAccessPage.tsx), `Settings` (lucide-react)

### Props

- **`ManagementPage`**: `activePopover?: string | null`, `setActivePopover?: (popover: string | null) => void`

**Hooks used:** `useState`×13, `useEffect`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ManagementPage)` | component | `ManagementPage({ activePopover, setActivePopover }: ManagementPageProps = …)` | 840 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${apiUrl}/checkout/office-addon/${orgId}/sync` (L185)
  - `GET ${apiUrl}/checkout/office-addon/${orgId}/status` (L194)
  - `POST ${apiUrl}/checkout/office-addon/${orgId}/subscribe` (L233)
  - `GET ${apiUrl}/org/${orgId}/branding` (L282)
  - `PUT ${apiUrl}/org/${orgId}/branding` (L314)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L261

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/button.tsx` — `Button`
  - `lib/auth.ts` — `getToken`
  - `lib/brand-color-context.tsx` — `notifyBrandingChanged`
  - `components/dashboard/FounderLeaveDashboard.tsx` — `FounderLeaveDashboard (default)`
  - `components/dashboard/InviteePage.tsx` — `InvitesPage (default)`
  - `components/dashboard/PendingRequestsPage.tsx` — `PendingRequestsPage (default)`
  - `components/dashboard/AIProvidersPage.tsx` — `AIProvidersPage (default)`
  - `components/dashboard/OpenClawAgentPage.tsx` — `OpenClawAgentPage (default)`
  - `components/dashboard/FounderCouponsPage.tsx` — `FounderCouponsPage (default)`
  - `components/dashboard/FounderPlatformCouponsPage.tsx` — `FounderPlatformCouponsPage (default)`
  - `components/dashboard/DomainManagementPage.tsx` — `DomainManagementPage (default)`
  - `lib/whitelabel-addon-api.ts` — `fetchWhitelabelStatus`, `WhitelabelStatusResponse`
  - `components/dashboard/WhitelabelGate.tsx` — `WhitelabelGate (default)`
  - `components/dashboard/teamAccess/TeamAccessPage.tsx` — `TeamAccessPage (default)`
  - `components/dashboard/FounderGuestsPage.tsx` — `FounderGuestsPage (default)`
  - `components/ui/coupon-input.tsx` — `CouponInput`, `AppliedCoupon`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Settings`, `Calendar`, `UserPlus`, `Clock`, `Sparkles`, `Palette`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
