# `components/dashboard/CallsPage.tsx`

> React components `CallsPage`, `CallsPage`.

**Kind:** React component · **Lines:** 3827 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×49 (components/ui/button.tsx), `Label`×18 (components/ui/label.tsx), `SelectItem`×17 (components/ui/select.tsx), `Input`×15 (components/ui/input.tsx), `Plus`×14 (lucide-react), `Loader2`×12 (lucide-react), `X`×11 (lucide-react), `Textarea`×9 (components/ui/textarea.tsx), `Timer`×7 (lucide-react), `ArrowLeft`×7 (lucide-react), `MessageSquare`×7 (lucide-react), `Check`×6 (lucide-react), `AnimatePresence`×5 (framer-motion), `DropdownMenuItem`×5 (components/ui/dropdown-menu.tsx), `Trash2`×5 (lucide-react), `FileText`×5 (lucide-react), `Select`×5 (components/ui/select.tsx), `SelectTrigger`×5 (components/ui/select.tsx), `SelectValue`×5 (components/ui/select.tsx), `SelectContent`×5 (components/ui/select.tsx), `Phone`×4 (lucide-react), `EmptyState`×4 (local), `Star`×4 (lucide-react), `Upload`×4 (lucide-react), `Sparkles`×3 (lucide-react), `Video`×3 (lucide-react), `ArrowRight`×3 (lucide-react), `CallCard`×2 (local), `Link2`×2 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `MoreVertical`×2 (lucide-react), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `Edit`×2 (lucide-react), `DropdownMenuSeparator`×2 (components/ui/dropdown-menu.tsx), `CompPlanBadge`×2 (components/dashboard/CommissionPlanSection.tsx), `Save`×2 (lucide-react), `BadgeCheck`×2 (lucide-react), `CommissionPlanSection`×2 (components/dashboard/CommissionPlanSection.tsx), `CheckCircle`×2 (lucide-react), … +35 more

### Props

- **`CallsPage`**: `initialTab?: "calls" | "purchases" | "bookings" | "mycalls" | "reserv…`, `setActivePopover?: (popover: string | null) => void`, `viewRole?: "customer" | "founder"`

**Hooks used:** `useState`×51, `useEffect`×8, `useRef`×3, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CallsPage` | component | `CallsPage({ initialTab = "calls", setActivePopover, viewRole }: Calls…)` | 170 |
| `default (CallsPage)` | component | `CallsPage({ initialTab = "calls", setActivePopover, viewRole }: Calls…)` | 3826 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L326)
  - `POST /backend/upload?orgId=${getOrgId()}` (L1206)
  - `POST /backend/api/invoices/${invoiceId}/apply-platform-coupon` (L3443)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L886, L2999, L3104
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `components/dashboard/ReservesPanel.tsx` — `ReservesPanel`
  - `components/ui/platform-coupon-input.tsx` — `PlatformCouponInput`
  - `lib/api.ts` — `API_URL`
  - `lib/feed-api.ts` — `getCallOfferings`, `getCallOfferingsManage`, `getCallOffering`, `createCallOffering`, `updateCallOffering`, `deleteCallOffering`, `addIntakeQuestion`, `updateIntakeQuestion`, … +15
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuSeparator`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
  - `lib/auth.ts` — `getToken`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`, `invalidatePageCache`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `CompPlanBadge`
  - `lib/form-limits.ts` — `MAX_BENEFITS`, `MAX_FAQS`, `filterNonEmptyStrings`, `limitReachedLabel`
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `showSellablePublished`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Phone`, `Search`, `Grid`, `List`, `TicketCheck`, `Filter`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (3827 lines) — read it by section; line numbers above point into it.
