# `components/dashboard/OrdersPage.tsx`

> React component `OrdersPage`.

**Kind:** React component · **Lines:** 3555 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×14 (components/ui/button.tsx), `Loader2`×10 (lucide-react), `TableCell`×8 (components/ui/table.tsx), `CheckCircle2`×7 (lucide-react), `TableHead`×7 (components/ui/table.tsx), `Receipt`×6 (lucide-react), `CreditCard`×6 (lucide-react), `ExternalLink`×5 (lucide-react), `Download`×4 (lucide-react), `AlertCircle`×4 (lucide-react), `Banknote`×4 (lucide-react), `Smartphone`×4 (lucide-react), `AlertDialog`×4 (components/ui/alert-dialog.tsx), `AlertDialogContent`×4 (components/ui/alert-dialog.tsx), `AlertDialogHeader`×4 (components/ui/alert-dialog.tsx), `AlertDialogTitle`×4 (components/ui/alert-dialog.tsx), `AlertDialogDescription`×4 (components/ui/alert-dialog.tsx), `AlertDialogFooter`×4 (components/ui/alert-dialog.tsx), `AlertDialogCancel`×4 (components/ui/alert-dialog.tsx), `Calendar`×3 (lucide-react), `FileText`×3 (lucide-react), `RefreshCw`×3 (lucide-react), `XCircle`×3 (lucide-react), `Zap`×3 (lucide-react), `TableRow`×3 (components/ui/table.tsx), `ArrowUpDown`×3 (lucide-react), `Package`×2 (lucide-react), `User`×2 (lucide-react), `Clock`×2 (lucide-react), `IndianRupee`×2 (lucide-react), `Building2`×2 (lucide-react), `Wallet`×2 (lucide-react), `Sparkles`×2 (lucide-react), `Repeat`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `MapPin` (lucide-react), `Link2` (lucide-react), `Video` (lucide-react), `TrendingUp` (lucide-react), `ChevronLeft` (lucide-react), … +5 more

### Props

- **`OrdersPage`**: `initialType?: UnifiedOrderType | "all" | "garage_subs" | "unilevel_pl…`, `hideTabs?: boolean`, `initialInvoiceTab?: "one_time" | "recurring"`

**Hooks used:** `useState`×37, `useEffect`×7, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrdersPage` | component | `OrdersPage({ // Default landed on "all" when every tab existed; with t…)` | 308 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/unilevel-plus/product` (L452)
  - `GET ${apiUrl}/office-subscription/status?orgId=${orgId}` (L483)
  - `GET ${apiUrl}/office-subscription/payments?orgId=${orgId}` (L515)
  - `GET ${apiUrl}/office-addon-subscription/status?orgId=${orgId}` (L542)
  - `GET ${apiUrl}/office-addon-subscription/payments?orgId=${orgId}` (L571)
  - `GET ${apiUrl}/api/invoices/my/upcoming` (L600)
  - `GET ${apiUrl}/api/invoices/my/list?limit=${limit}&skip=${skip}&invoiceType=${invoiceTab}` (L603)
  - `GET ${apiUrl}/api/third-party/subscriptions` (L664)
  - `PATCH ${apiUrl}/api/third-party/subscriptions/${parentInvoiceId}/term` (L715)
  - `GET ${apiUrl}/api/invoices/autopay/status` (L769)
  - `POST ${apiUrl}/api/invoices/autopay/disable` (L787)
  - `POST ${apiUrl}/api/invoices/${parentId}/autopay/enable` (L822)
  - `POST ${apiUrl}/api/invoices/${parentId}/renew-subscription` (L860)
  - `POST ${apiUrl}/api/invoices/${invoiceId}/cancel` (L892)
  - `POST ${apiUrl}/api/invoices/${parentId}/cancel` (L934)
  - `POST ${apiUrl}/api/invoices/${parentId}/cancel-subscription` (L966)
  - `GET ${apiUrl}/unified-orders?${params.toString()}` (L1079)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L650, L1108

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `lib/utils.ts` — `cn`
  - `lib/webinar/garage-store-plans.ts` — `subscribeStandalone`
  - `lib/auth.ts` — `getToken`
  - `lib/feed-api.ts` — `unsubscribeFromChannel`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Package`, `Search`, `ShoppingBag`, `BookOpen`, `Video`, `Tv`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (3555 lines) — read it by section; line numbers above point into it.
