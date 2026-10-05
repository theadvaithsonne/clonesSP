# `components/dashboard/ChannelsPage.tsx`

> React component `ChannelsPage`.

**Kind:** React component · **Lines:** 4933 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×8 (lucide-react), `Input`×6 (components/ui/input.tsx), `Rss`×5 (lucide-react), `Users`×5 (lucide-react), `Button`×4 (components/ui/button.tsx), `AlertDialog`×4 (components/ui/alert-dialog.tsx), `AlertDialogContent`×4 (components/ui/alert-dialog.tsx), `AlertDialogHeader`×4 (components/ui/alert-dialog.tsx), `AlertDialogTitle`×4 (components/ui/alert-dialog.tsx), `AlertDialogDescription`×4 (components/ui/alert-dialog.tsx), `AlertDialogFooter`×4 (components/ui/alert-dialog.tsx), `AlertDialogCancel`×4 (components/ui/alert-dialog.tsx), `AlertDialogAction`×4 (components/ui/alert-dialog.tsx), `Loader2`×4 (lucide-react), `Info`×3 (lucide-react), `SelectItem`×3 (components/ui/select.tsx), `Plus`×3 (lucide-react), `Link2`×2 (lucide-react), `CardRatingRow`×2 (components/reviews/index.ts), `Check`×2 (lucide-react), `CreditCard`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `CommunityStreamOverlay`×2 (components/community-stream/index.ts), `ReservesPanel`×2 (components/dashboard/ReservesPanel.tsx), `Trash2`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `UserPlus` (lucide-react), `Ban` (lucide-react), `MyCommunityCard` (local), `CommunityCardCustomer` (local), `ChannelPaymentModalNew` (components/dashboard/ChannelPaymentModalNew.tsx), `FounderMembersPanel` (components/dashboard/FounderMembersPanel.tsx), `User` (lucide-react), `Star` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `Crop` (lucide-react), … +22 more

### Props

- **`ChannelsPage`**: `initialView?: "main" | "reserves" | "members" | "my-communities"`, `viewRole?: "customer" | "founder"`

**Hooks used:** `useState`×63, `useEffect`×21, `useRef`×9, `useMemo`, `useCallback`, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useRatingSummaries` (lib/hooks/useRatingSummaries.ts), `useEmailAlerts` (components/dashboard/products/useEmailAlerts.ts), `useFounderAlerts` (components/dashboard/products/useFounderAlerts.ts), `useCommunityStream` (components/community-stream/index.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatCardPrice` | function | `formatCardPrice(amount: number, currency: string = "USD"): string` | 163 |
| `ChannelsPage` | component | `ChannelsPage({ initialView = "main", viewRole }: ChannelsPageProps = {})` | 961 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}` (L1028)
  - `GET /backend/affiliate/my-affiliate-id` (L1630)
  - `POST /backend/upload` (L2252)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `www.youtube.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/DescriptionEditor.tsx` — `DescriptionEditor (default)`
  - `lib/feed-api.ts` — `getOrgChannels`, `createChannel`, `updateChannel`, `deleteChannel`, `getChannelSubscribers`, `getSubscribedChannels`, `subscribeToFreeChannel`, `unsubscribeFromChannel`, … +11
  - `lib/auth.ts` — `getToken`
  - `lib/api.ts` — `api`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`, `CompPlanDisplay`, `CompPlanBadge`
  - `components/dashboard/products/ProductEmailAlertsSection.tsx` — `ProductEmailAlertsSection`
  - `components/dashboard/ProductThankYouPageEditor.tsx` — `ProductThankYouPageEditor (default)`
  - `components/dashboard/products/useEmailAlerts.ts` — `useEmailAlerts`
  - `components/dashboard/products/useFounderAlerts.ts` — `useFounderAlerts`
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsSection`
  - `components/dashboard/ChannelPaymentModalNew.tsx` — `ChannelPaymentModalNew`
  - `components/dashboard/ReservesPanel.tsx` — `ReservesPanel`
  - `components/shared/ImageCropDialog.tsx` — `ImageCropDialog (default)`, `CropState`
  - `lib/coverOriginal.ts` — `resolveCropSource`, `resolveOriginalToRemember`, `writeCoverOriginal`
  - `components/dashboard/FounderMembersPanel.tsx` — `FounderMembersPanel`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`, `slugify`
  - `components/community-stream/index.ts` — `useCommunityStream`, `CommunityStreamOverlay`
  - `components/dashboard/WorkshopsPage.tsx` — `CurrencyDropdown`
  - `components/reviews/index.ts` — `CardRatingRow`
  - `lib/hooks/useRatingSummaries.ts` — `useRatingSummaries`
  - `lib/reviews-api.ts` — `RatingSummary`, `(types only)`
  - `lib/form-limits.ts` — `MAX_BENEFITS`, `MAX_FAQS`, `limitReachedLabel`
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `garageStorefrontUrl`, `showSellablePublished`, `subscriptionUnit`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Rss`, `Plus`, `Edit2`, `Trash2`, `Users`, `X`, …
  - `sonner` — `toast`
  - `emoji-picker-react` — `Theme`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L438), `dangerouslySetInnerHTML` (L720).
- Large file (4933 lines) — read it by section; line numbers above point into it.
