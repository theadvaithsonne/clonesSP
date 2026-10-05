# `components/dashboard/WorkshopsPage.tsx`

> React components `WorkshopsPage`, `CurrencyDropdown`.

**Kind:** React component · **Lines:** 6703 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×21 (components/ui/button.tsx), `Loader2`×11 (lucide-react), `Trash2`×10 (lucide-react), `Calendar`×9 (lucide-react), `X`×9 (lucide-react), `Check`×6 (lucide-react), `Users`×5 (lucide-react), `Info`×5 (lucide-react), `Plus`×4 (lucide-react), `Link2`×3 (lucide-react), `ChevronDown`×3 (lucide-react), `Search`×2 (lucide-react), `WorkshopCard`×2 (local), `Play`×2 (lucide-react), `CreditCard`×2 (lucide-react), `BarChart3`×2 (lucide-react), `Edit`×2 (lucide-react), `ThumbnailCountdown`×2 (local), `Video`×2 (lucide-react), `CompPlanBadge`×2 (components/dashboard/CommissionPlanSection.tsx), `Upload`×2 (lucide-react), `TimeSelector`×2 (components/dashboard/TimeSelector.tsx), `Switch`×2 (components/ui/switch.tsx), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `Clock` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `FounderLiveStreamsTable` (components/dashboard/liveStreams/FounderLiveStreamsTable.tsx), `EditSessionSheet` (components/dashboard/liveStreams/EditSessionSheet.tsx), `ReservesPanel` (components/dashboard/ReservesPanel.tsx), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx), `Input` (components/ui/input.tsx), `Repeat` (lucide-react), `Filter` (lucide-react), `CreateWorkshopModal` (local), … +30 more

### Props

- **`WorkshopsPage`**: `initialTab?: "upcoming" | "completed" | "reserves" | "attendees" | "d…`, `viewRole?: "customer" | "founder"`
- **`CurrencyDropdown`**: `value: string`, `onChange: (val: string) => void`

**Hooks used:** `useState`×66, `useEffect`×19, `useRef`×5, `useOrgShareOrigin`×2 (lib/hooks/useOrgShareOrigin.ts), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useEmailAlerts` (components/dashboard/products/useEmailAlerts.ts), `useFounderAlerts` (components/dashboard/products/useFounderAlerts.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkshopsPage` | component | `WorkshopsPage({ initialTab = "upcoming", viewRole }: WorkshopsPageProps =…)` | 638 |
| `CurrencyDropdownProps` | interface |  | 6630 |
| `CurrencyDropdown` | component | `CurrencyDropdown({ value, onChange }: CurrencyDropdownProps)` | 6635 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L989)
  - `POST /backend/upload` (L4663)
- **Socket.IO events:**
  - listens for: `workshop:preview:live`, `workshop:preview:ended`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L569, L762; `setTimeout` at L1187
- **External hosts mentioned in the code:** `images.unsplash.com`, `www.youtube.com`, `checkout.razorpay.com`, `api.dicebear.com`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getWorkshops`, `getOrgChannels`, `registerForFreeWorkshop`, `cancelWorkshopRegistration`, `createWorkshopOrder`, `verifyWorkshopPayment`, `createWorkshop`, `updateWorkshop as updateWorkshopApi`, … +32
  - `lib/socket.ts` — `connectSocket`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/switch.tsx` — `Switch`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/utils.ts` — `cn`, `parseDateLocal`, `formatTime12Hour`, `stripHtml`
  - `components/dashboard/TimeSelector.tsx` — `TimeSelector`
  - `components/dashboard/ReservesPanel.tsx` — `ReservesPanel`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`, `invalidatePageCache`
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `showSellablePublished`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`, `CompPlanDisplay`, `CompPlanBadge`
  - `components/dashboard/WorkshopAnalyticsModal.tsx` — `WorkshopAnalyticsModal`
  - `components/dashboard/liveStreams/FounderLiveStreamsTable.tsx` — `FounderLiveStreamsTable`
  - `components/dashboard/liveStreams/EditSessionSheet.tsx` — `EditSessionSheet`, `EditSessionTarget`
  - `components/dashboard/liveStreams/SessionScheduleEditor.tsx` — `SessionScheduleEditor`, `isDraftEmpty`, `SessionDraft`, `SessionDraftMap`
  - `lib/recurrence.ts` — `computeSessionDays`, `describePattern`, `matchesPattern`
  - `lib/hooks/useOrgShareOrigin.ts` — `useOrgShareOrigin`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/dashboard/DescriptionEditor.tsx` — `DescriptionEditor (default)`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `components/dashboard/InstantLiveStreamModal.tsx` — `InstantLiveStreamModal`
  - `components/dashboard/SpeakerPicker.tsx` — `SpeakerPicker`
  - `components/dashboard/products/ProductEmailAlertsSection.tsx` — `ProductEmailAlertsSection`
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsSection`
  - `components/dashboard/products/useFounderAlerts.ts` — `useFounderAlerts`
  - `components/webinar/EvergreenSettings.tsx` — `EvergreenSettings (default)`
  - `components/webinar/SimulatedAudienceSettings.tsx` — `SimulatedAudienceSettings (default)`
  - `components/dashboard/products/useEmailAlerts.ts` — `useEmailAlerts`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/brand-color-context.tsx` — `getBrandHex`
  - `lib/form-limits.ts` — `MAX_FAQS`, `MAX_LEARNING_POINTS`, `filterNonEmptyStrings`, `limitReachedLabel`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `Calendar`, `Clock`, `Users`, `ExternalLink`, `MapPin`, `Search`, …
  - `sonner` — `toast`
  - `date-fns` — `format`, `formatDistanceToNow`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Large file (6703 lines) — read it by section; line numbers above point into it.
