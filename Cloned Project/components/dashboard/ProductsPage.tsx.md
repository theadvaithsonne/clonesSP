# `components/dashboard/ProductsPage.tsx`

> React component `ProductsPage`.

**Kind:** React component · **Lines:** 5663 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×20 (components/ui/button.tsx), `Input`×14 (components/ui/input.tsx), `X`×13 (lucide-react), `Loader2`×12 (lucide-react), `Link2`×10 (lucide-react), `DropdownMenuItem`×9 (components/ui/dropdown-menu.tsx), `ShoppingBag`×6 (lucide-react), `Plus`×6 (lucide-react), `Edit`×5 (lucide-react), `Label`×5 (components/ui/label.tsx), `Trash2`×4 (lucide-react), `Sparkles`×4 (lucide-react), `Download`×4 (lucide-react), `ProductCard`×3 (local), `DropdownMenu`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×3 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×3 (components/ui/dropdown-menu.tsx), `CheckCircle`×3 (lucide-react), `Package`×3 (lucide-react), `Eye`×2 (lucide-react), `MoreVertical`×2 (lucide-react), `ImageIcon`×2 (lucide-react), `Video`×2 (lucide-react), `FileText`×2 (lucide-react), `Textarea`×2 (components/ui/textarea.tsx), `ArrowLeft`×2 (lucide-react), `RatingsReviewsCard`×2 (components/reviews/index.ts), `Truck`×2 (lucide-react), `ProductDetailView` (local), `ReservesPanel` (components/dashboard/ReservesPanel.tsx), `OrdersView` (local), `Filter` (lucide-react), `ProductThankYouPageEditor` (components/dashboard/ProductThankYouPageEditor.tsx), `CreateProductModal` (local), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), … +33 more

### Props

- **`ProductsPage`**: `initialTab?: "products" | "orders" | "reserves"`, `viewRole?: "customer" | "founder"`

**Hooks used:** `useState`×92, `useEffect`×22, `useRef`×9, `useMemo`×3, `useRatingSummaries`×2 (lib/hooks/useRatingSummaries.ts), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useEmailAlerts` (components/dashboard/products/useEmailAlerts.ts), `useFounderAlerts` (components/dashboard/products/useFounderAlerts.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ProductsPage` | component | `ProductsPage({ initialTab = "products", viewRole }: ProductsPageProps = …)` | 160 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L323)
  - `POST /backend/upload` (L1619)
  - `GET /backend/profile?userId=${tokenData.userId}` (L3749)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `garage_org_name` (localStorage: get), `garage_org_slug` (localStorage: get), `products` (sessionStorage: pending-order-id/pending-order-id)
- **Timers / queues:** `setTimeout` at L1418, L3867, L4966
- **External hosts mentioned in the code:** `www.youtube.com`, `api.dicebear.com`, `checkout.razorpay.com`, `www.garage.app`, `drive.google.com`, `img.youtube.com`, `nela-app.s3.us-east-1.amazonaws.com`

## Dependencies

- **Internal:**
  - `components/ui/switch.tsx` — `Switch`
  - `lib/feed-api.ts` — `getProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `getMyProductOrders`, `getAllProductOrders`, `getProductOrderStats`, … +18
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `lib/utils.ts` — `cn`, `stripHtml`
  - `components/shared/ChannelMultiSelect.tsx` — `ChannelMultiSelect`
  - `components/dashboard/DescriptionEditor.tsx` — `DescriptionEditor (default)`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `components/dashboard/WorkshopsPage.tsx` — `CurrencyDropdown`
  - `lib/auth.ts` — `getToken`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/dashboard/ReservesPanel.tsx` — `ReservesPanel`
  - `components/dashboard/ProductThankYouPageEditor.tsx` — `ProductThankYouPageEditor (default)`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`, `CompPlanDisplay`, `CompPlanBadge`
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`, `invalidatePageCache`
  - `components/reviews/index.ts` — `CardRatingRow`, `RatingsReviewsCard`
  - `lib/hooks/useRatingSummaries.ts` — `useRatingSummaries`
  - `lib/reviews-api.ts` — `RatingSummary`, `(types only)`
  - `components/dashboard/products/ProductEmailAlertsSection.tsx` — `ProductEmailAlertsSection`
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsSection`
  - `components/dashboard/products/useFounderAlerts.ts` — `useFounderAlerts`
  - `components/dashboard/products/useEmailAlerts.ts` — `useEmailAlerts`
  - `lib/form-limits.ts` — `MAX_FAQS`, `MAX_KEY_FEATURES`, `limitReachedLabel`
  - `lib/brand-color-context.tsx` — `getBrandHex`
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `garageStorefrontUrl`, `showSellablePublished`, `subscriptionUnit`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`
  - `lucide-react` — `ShoppingBag`, `Search`, `Grid`, `List`, `ShoppingCart`, `Filter`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L762), `dangerouslySetInnerHTML` (L936), `dangerouslySetInnerHTML` (L1041), `dangerouslySetInnerHTML` (L4275).
- Large file (5663 lines) — read it by section; line numbers above point into it.
