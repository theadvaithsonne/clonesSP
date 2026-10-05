# `components/dashboard/ServicesPage.tsx`

> React component `ServicesPage`.

**Kind:** React component · **Lines:** 2276 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `Loader2`×6 (lucide-react), `StatCard`×4 (local), `Briefcase`×4 (lucide-react), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `Check`×4 (lucide-react), `Clock`×3 (lucide-react), `Package`×2 (lucide-react), `CompPlanBadge`×2 (components/dashboard/CommissionPlanSection.tsx), `Link2`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `Users`×2 (lucide-react), `ServiceDetailView` (local), `FounderEmptyState` (local), `CustomerEmptyState` (local), `ServiceCard` (local), `OptInsView` (local), `MyServicesView` (local), `CreateDigitalServiceModal` (components/dashboard/ServiceFormModal.tsx), `EditServiceModal` (components/dashboard/ServiceFormModal.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `Layers` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `Menu` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `Edit` (lucide-react), `Pause` (lucide-react), `Play` (lucide-react), `Trash2` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Target` (lucide-react), … +8 more

### Props

- **`ServicesPage`**: `initialTab?: "services" | "optins" | "myservices"`, `viewRole?: "customer" | "founder"`

**Hooks used:** `useState`×26, `useEffect`×13, `useAmIFounder`×2 (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ServicesPage` | component | `ServicesPage({ initialTab = "services", viewRole }: ServicesPageProps = …)` | 87 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L292)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `services` (sessionStorage: pending-service-id/pending-service-id)
- **Timers / queues:** `setTimeout` at L1428
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getServices`, `getService`, `updateService`, `deleteService`, `getServiceOptIns`, `getMyServiceOptIns`, `optInToService`, `startServiceMilestone`, … +10
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
  - `lib/auth.ts` — `getToken`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`, `invalidatePageCache`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/dashboard/CommissionPlanSection.tsx` — `CompPlanBadge`
  - `components/dashboard/ServiceFormModal.tsx` — `CreateDigitalServiceModal`, `EditServiceModal`, `announceService`
  - `components/dashboard/ServiceMediaCarousel.tsx` — `ServiceMediaCarousel`, `buildServiceMedia`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `components/dashboard/ServiceEngagementView.tsx` — `ServiceEngagementView`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Briefcase`, `X`, `Package`, `Layers`, `Menu`, `Pause`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (2276 lines) — read it by section; line numbers above point into it.
