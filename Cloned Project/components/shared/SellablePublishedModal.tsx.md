# `components/shared/SellablePublishedModal.tsx`

> The popup a founder sees right after creating (or first publishing) something sellable — a course, community, live stream, digital product, service, 1:1 call, event or job.

**Kind:** React component · **Lines:** 845 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The popup a founder sees right after creating (or first publishing)
something sellable — a course, community, live stream, digital product,
service, 1:1 call, event or job. Left: what was just published and the share
buttons. Right: a buyer's-eye preview card on a gradient of the office's own
brand colour (Manage Org → colour).

Every share link carries the founder's affiliate id (`?ref=<id>`), the same
rule as `lib/affiliate-share.ts`, so traffic their shares bring in is
attributed to them. Relative links resolve against the office's share
origin (its own domain when that is healthy — see useOrgShareOrigin).

Creation flows call `showSellablePublished(item)`; the single
<SellablePublishedHost /> mounted in the dashboard layout renders it. The
host lives outside the creation forms on purpose — most of them unmount the
moment the create call succeeds.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DialogPrimitive`×8 (@radix-ui/react-dialog), `Icon`×3 (local), `Glyph`×2 (local), `FactChips`×2 (local), `SellablePublishedModal` (local), `X` (lucide-react), `Loader2` (lucide-react), `Check` (lucide-react), `Copy` (lucide-react), `Share2` (lucide-react), `ExternalLink` (lucide-react), `PreviewCard` (local), `JobCard` (local), `MediaCard` (local)

### Props

- **`SellablePublishedModal`**: `item: SellablePublishedItem | null`, `onClose: () => void`

**Hooks used:** `useState`×7, `usePublishedStore`×2 (local), `useEffect`×2, `useBrandColors` (lib/brand-color-context.tsx), `useMemo`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SellableKind` | type |  | 51 |
| `SellablePublishedItem` | interface |  | 61 |
| `formatSellablePrice` | function | `formatSellablePrice(amount?: number \| null, currency?: string \| null, per?: string \| null): string` — "$49", "₹1,299.50 / month", "Free". | 205 |
| `subscriptionUnit` | function | `subscriptionUnit(period?: string \| null): string \| null` — weekly → "week", the unit a subscription price is quoted per. | 226 |
| `garageStorefrontUrl` | function | `garageStorefrontUrl(type: "course" \| "channel" \| "service" \| "product", id: string): string` — The garage.app storefront page for a digital item — the same link the right panel's Affiliate view hands out for courses, communities, services and digital products. | 246 |
| `showSellablePublished` | function | `showSellablePublished(item: SellablePublishedItem)` — Open the "published — now share it" popup for a freshly created item. | 266 |
| `SellablePublishedHost` | component | `SellablePublishedHost()` — Mounted once, in the dashboard layout. | 271 |
| `default (SellablePublishedModal)` | component | `SellablePublishedModal({ item, onClose, }: { item: SellablePublishedItem \| null; o…)` | 371 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}` (L287)
- **External hosts mentioned in the code:** `www.garage.app`, `www.facebook.com`, `twitter.com`, `www.linkedin.com`, `api.whatsapp.com`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getOrgId`
  - `lib/brand-color-context.tsx` — `useBrandColors`
  - `lib/affiliate-share.ts` — `copyToClipboard`, `fetchMyAffiliateId`, `withAffiliateRef`
  - `lib/hooks/useOrgShareOrigin.ts` — `fetchOrgShareOrigin`
  - `components/icons/WhatsAppIcon.tsx` — `WhatsAppIcon`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `@radix-ui/react-dialog`
  - `zustand` — `create`
  - `lucide-react` — `BriefcaseBusiness`, `CalendarDays`, `Check`, `Copy`, `ExternalLink`, `GraduationCap`, …

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/CallsPage.tsx`
- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/InstantLiveStreamModal.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/ServiceFormModal.tsx`
- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/inlineApps/events/announceEvent.ts`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
