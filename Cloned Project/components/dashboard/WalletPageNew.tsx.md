# `components/dashboard/WalletPageNew.tsx`

> React component `WalletPage`.

**Kind:** React component · **Lines:** 4208 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×24 (components/ui/button.tsx), `Loader2`×12 (lucide-react), `Building2`×6 (lucide-react), `Send`×5 (lucide-react), `Wallet`×4 (lucide-react), `Zap`×4 (lucide-react), `ArrowRightLeft`×4 (lucide-react), `DropdownMenuRadioItem`×4 (components/ui/dropdown-menu.tsx), `Gift`×3 (lucide-react), `CheckCircle2`×3 (lucide-react), `Lock`×3 (lucide-react), `RefreshCw`×3 (lucide-react), `Search`×3 (lucide-react), `PayoutAccountsSection`×3 (components/dashboard/PayoutAccountsSection.tsx), `WithdrawalPreferenceSection`×3 (components/dashboard/WithdrawalPreferenceSection.tsx), `Plus`×2 (lucide-react), `Package`×2 (lucide-react), `Sparkles`×2 (lucide-react), `History`×2 (lucide-react), `Popover`×2 (components/ui/popover.tsx), `PopoverTrigger`×2 (components/ui/popover.tsx), `ChevronDown`×2 (lucide-react), `PopoverContent`×2 (components/ui/popover.tsx), `Check`×2 (lucide-react), `UserPlus`×2 (lucide-react), `WalletPageInternal` (local), `TicketPercent` (lucide-react), `CreditCard` (lucide-react), `CashbackCodesTab` (components/dashboard/CashbackCodesTab.tsx), `PaymentMethodsPanel` (components/dashboard/PaymentMethodsPanel.tsx), `PlatformCouponInput` (components/ui/platform-coupon-input.tsx), `Tag` (lucide-react), `PaymentMethodSelector` (components/checkout/PaymentMethodSelector.tsx), `FreeMonthBanner` (components/dashboard/UnilevelPlusOfferPanel.tsx), `BundlePicker` (components/dashboard/UnilevelPlusOfferPanel.tsx), `Minus` (lucide-react), `QrCode` (lucide-react), `ArrowLeftRight` (lucide-react), `MultiCurrencyTransferSheet` (components/dashboard/MultiCurrencyTransferSheet.tsx), `X` (lucide-react), … +14 more

**Hooks used:** `useState`×76, `useEffect`×6

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WalletPage` | component | `WalletPage()` | 231 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/api/invoices/${upInvoiceId}/apply-platform-coupon` (L1904)
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `lib/csvExport.ts` — `exportRowsAsCsv`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuTrigger`, `DropdownMenuLabel`, `DropdownMenuSeparator`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/feed-api.ts` — `getAllWallets`, `getStoreWalletTransactions`, `getAffiliateWalletTransactions`, `getAffiliateWalletBalance`, `getUnilevelPlusProduct`, `createUnilevelPlusOrder`, `verifyUnilevelPlusPayment`, `getReserveLicenses`, … +15
  - `components/dashboard/UnilevelPlusOfferPanel.tsx` — `FreeMonthBanner`, `BundlePicker`
  - `lib/auth.ts` — `getOrgId`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`
  - `lib/content-rewards-api.ts` — `fetchContentRewardsBalance`, `fetchContentRewardsTransactions`, `transferContentRewards`, `ContentRewardsBalance`
  - `components/dashboard/PayoutAccountsSection.tsx` — `PayoutAccountsSection`
  - `components/dashboard/WithdrawalPreferenceSection.tsx` — `WithdrawalPreferenceSection`
  - `components/dashboard/RewardsTab.tsx` — `RewardsTab`
  - `components/dashboard/CashbackCodesTab.tsx` — `CashbackCodesTab`
  - `components/dashboard/TopUpStoreWalletSheet.tsx` — `TopUpStoreWalletSheet`
  - `components/dashboard/DepositCryptoSheet.tsx` — `DepositCryptoSheet`
  - `components/dashboard/MultiCurrencyTransferSheet.tsx` — `MultiCurrencyTransferSheet`
  - `lib/feed-api.ts` — `getStoreWalletCurrencies`, `transferStoreWalletMulti`, `StoreWalletCurrencyEntry`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `components/dashboard/PaymentMethodsPanel.tsx` — `PaymentMethodsPanel`
  - `components/ui/platform-coupon-input.tsx` — `PlatformCouponInput`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `lib/api.ts` — `API_URL`
  - `lib/brand-color-context.tsx` — `getBrandHex`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `sonner` — `toast`
  - `lucide-react` — `Wallet`, `CreditCard`, `ArrowUpRight`, `ArrowDownLeft`, `ArrowRightLeft`, `Send`, …

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (4208 lines) — read it by section; line numbers above point into it.
