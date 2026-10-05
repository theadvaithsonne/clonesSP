# `components/dashboard/CoursesPage.tsx`

> React component `CoursesPage`.

**Kind:** React component · **Lines:** 9982 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×25 (lucide-react), `Button`×22 (components/ui/button.tsx), `Label`×20 (components/ui/label.tsx), `Trash2`×17 (lucide-react), `BookOpen`×16 (lucide-react), `X`×16 (lucide-react), `SelectItem`×13 (components/ui/select.tsx), `FileText`×13 (lucide-react), `CheckCircle2`×12 (lucide-react), `Video`×11 (lucide-react), `Plus`×9 (lucide-react), `ChevronRight`×9 (lucide-react), `ClipboardList`×8 (lucide-react), `Input`×8 (components/ui/input.tsx), `Upload`×8 (lucide-react), `Play`×7 (lucide-react), `CheckCircle`×7 (lucide-react), `Edit`×7 (lucide-react), `LinkIcon`×6 (lucide-react), `DropdownMenuItem`×6 (components/ui/dropdown-menu.tsx), `ChevronDown`×6 (lucide-react), `FileCode`×6 (lucide-react), `Check`×5 (lucide-react), `FileDown`×5 (lucide-react), `CourseCard`×4 (local), `Select`×4 (components/ui/select.tsx), `SelectTrigger`×4 (components/ui/select.tsx), `SelectValue`×4 (components/ui/select.tsx), `SelectContent`×4 (components/ui/select.tsx), `AlertTriangle`×4 (lucide-react), `PlusCircle`×4 (lucide-react), `ArrowLeft`×4 (lucide-react), `Save`×3 (lucide-react), `BarChart3`×3 (lucide-react), `Users`×3 (lucide-react), `ExternalLink`×3 (lucide-react), `Link2`×3 (lucide-react), `Copy`×3 (lucide-react), `Info`×3 (lucide-react), `Dialog`×3 (components/ui/dialog.tsx), … +67 more

### Props

- **`CoursesPage`**: `initialSection?: "courses" | "analytics" | "enrolled" | "reserves" | …`, `viewRole?: "customer" | "founder"`

**Hooks used:** `useState`×187, `useEffect`×30, `useRef`×14, `useEmailAlerts`×2 (components/dashboard/products/useEmailAlerts.ts), `useFounderAlerts`×2 (components/dashboard/products/useFounderAlerts.ts), `useRatingSummaries` (lib/hooks/useRatingSummaries.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CoursesPage` | component | `CoursesPage({ initialSection = "courses", viewRole }: CoursesPageProps …)` | 719 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L1127)
  - `POST /backend/api/invoices/${invoiceId}/apply-platform-coupon` (L2717)
  - `POST /backend/upload` (L4127)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setInterval` at L341, L8186; `setTimeout` at L873, L1564, L2840, L6492, L6879, …
- **External hosts mentioned in the code:** `www.youtube.com`, `checkout.razorpay.com`, `youtube.com`, `vimeo.com`, `img.youtube.com`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getCourses`, `getCourse`, `createCourse`, `updateCourse`, `deleteCourse`, `cloneCourse`, `addCourseSection`, `updateCourseSection`, … +73
  - `components/dashboard/products/ProductEmailAlertsSection.tsx` — `ProductEmailAlertsSection`
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsSection`
  - `components/dashboard/products/useFounderAlerts.ts` — `useFounderAlerts`
  - `components/dashboard/products/useEmailAlerts.ts` — `useEmailAlerts`
  - `components/dashboard/ProductThankYouPageEditor.tsx` — `ProductThankYouPageEditor (default)`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `lib/utils.ts` — `cn`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `components/dashboard/WorkshopsPage.tsx` — `CurrencyDropdown`
  - `components/shared/ChannelMultiSelect.tsx` — `ChannelMultiSelect`
  - `components/ui/platform-coupon-input.tsx` — `PlatformCouponInput`
  - `lib/auth.ts` — `getToken`
  - `components/ui/rich-text-editor.tsx` — `RichTextEditor`
  - `components/dashboard/ReservesPanel.tsx` — `ReservesPanel`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`, `CompPlanDisplay`, `CompPlanBadge`
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`, `invalidatePageCache`
  - `lib/videoUrl.ts` — `getYouTubeEmbedUrl`, `getVimeoEmbedUrl`, `getYouTubeThumbnail`, `isYouTubeUrl`, `fetchYouTubeOEmbed`, `YouTubeOEmbed`
  - `components/dashboard/DescriptionEditor.tsx` — `DescriptionEditor (default)`
  - `components/dashboard/CustomVideoPlayer.tsx` — `CustomVideoPlayer (default)`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `components/reviews/index.ts` — `CardRatingRow`, `RatingsReviewsCard`
  - `lib/hooks/useRatingSummaries.ts` — `useRatingSummaries`
  - `lib/reviews-api.ts` — `RatingSummary`, `(types only)`
  - `lib/form-limits.ts` — `MAX_LEARNING_POINTS`, `limitReachedLabel`
  - `lib/brand-color-context.tsx` — `getBrandHex`
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `garageStorefrontUrl`, `showSellablePublished`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`, `useMemo`
  - `react-dom` — `createPortal`
  - `lucide-react` — `BookOpen`, `Clock`, `User`, `Play`, `CheckCircle2`, `ExternalLink`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L3518), `dangerouslySetInnerHTML` (L3740), `dangerouslySetInnerHTML` (L8761), `dangerouslySetInnerHTML` (L8974), `dangerouslySetInnerHTML` (L9452).
- Large file (9982 lines) — read it by section; line numbers above point into it.
