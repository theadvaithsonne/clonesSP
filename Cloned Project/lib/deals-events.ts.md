# `lib/deals-events.ts`

> Client-side event bus for the Deals (CRM) app: window `CustomEvent` names, dispatch helpers and a React hook that let Deals pages refresh, navigate and open leads without route changes.

**Kind:** frontend library · **Lines:** 120

## Purpose
The Deals CRM runs in two modes: as normal routes under `/deals/*`, and "inline" inside the BackOffice overlay (`components/dashboard/inlineApps/deals/DealsApp.tsx`), where switching sections must not trigger a Next.js navigation. Components in different parts of the tree (header refresh button, mobile nav, lead dialogs, Facebook import) need to tell each other "refetch" or "go to section X". This file centralises the event names and the small helpers that fire and listen to them, so producers and consumers stay decoupled. It is marked `"use client"`.

## How it works
All communication uses `window.dispatchEvent(new CustomEvent(name, { detail }))`. Every dispatcher returns early when `window` is undefined (SSR-safe).

**Event names and payloads**

| Constant | Event string | `detail` | Meaning |
|---|---|---|---|
| `DEALS_CRM_STATS_REFRESH_EVENT` | `deals:crm-stats-refresh` | (defined only) | Lead created/updated; dashboard should refetch counts and conversion rate. No dispatcher in this file. |
| `DEALS_LEADS_REFRESH_EVENT` | `deals:leads-refresh` | none | Leads list should refetch (e.g. after a Facebook import). |
| `DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT` | `deals:activity-followup-append` | `{ activity }` | Optimistically append a follow-up to "Activities & Follow-ups" before the API catches up. |
| `DEALS_INLINE_REFRESH_EVENT` | `deals:inline-refresh` | `{ section }` | BackOffice Deals header refresh button: refetch the active section without a page reload. |
| `DEALS_INLINE_NAVIGATE_EVENT` | `deals:inline-navigate` | `{ section }` | Mobile nav switches inline section without closing the app. |
| (literal) | `deals:open-lead-inline` | `{ leadId }` | Open a lead inside the inline overlay. |

**Inline mode detection.** `isDealsInlineMode()` checks a global flag `window.__garageDealsInline` (set by the inline host). `openDealsLeadInline` and `useDealsInlineRefresh` do nothing outside inline mode.

**CMS gate on navigation.** `dispatchDealsInlineNavigate("cms")` does not fire immediately: it lazy-imports `lib/cms/accessGate.ts` and calls `requestCmsAccess(navigate)`, so the navigation only happens once the CMS password dialog is satisfied (or the session is already unlocked). The dynamic import keeps the gate out of every Deals bundle at module init. If no dialog host is registered, `requestCmsAccess` fails closed and the navigation never happens.

**Pending lead hand-off.** `openDealsLeadInline` also writes the lead id to `sessionStorage` under `deals:inline-pending-lead-id` (errors ignored), so a listener that mounts after the event can still pick it up. It returns `true` when the event was dispatched, `false` otherwise (no window, empty id, not inline) so callers can fall back to route navigation.

**`useDealsInlineRefresh(section, onRefresh)`.** Keeps the latest `onRefresh` in a ref (so callers need not memoise it) and, only in inline mode, subscribes to `deals:inline-refresh`; it invokes the callback when `detail.section` equals its own `section`. The listener is removed on unmount or when `section` changes.

## Exports
- `DEALS_CRM_STATS_REFRESH_EVENT`, `DEALS_LEADS_REFRESH_EVENT`, `DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT`, `DEALS_INLINE_REFRESH_EVENT`, `DEALS_INLINE_NAVIGATE_EVENT` - event-name string constants (see table).
- `dispatchDealsLeadsRefresh(): void` - fire `deals:leads-refresh`.
- `dispatchDealsActivityFollowUpAppend(activity: Record<string, unknown>): void` - fire the optimistic follow-up event.
- `type DealsInlineSection` - `"dashboard" | "leads" | "leads-detail" | "funnel" | "contacts" | "companies" | "products" | "cms"`.
- `type DealsInlineNavigateSection` - `DealsInlineSection` without `"leads-detail"`.
- `dispatchDealsInlineNavigate(section: DealsInlineNavigateSection): void` - fire inline navigation (CMS behind the password gate).
- `dispatchDealsInlineRefresh(section: DealsInlineSection): void` - fire an inline refresh for a section.
- `isDealsInlineMode(): boolean` - whether `window.__garageDealsInline` is truthy.
- `openDealsLeadInline(leadId: string): boolean` - open a lead in the inline overlay.
- `useDealsInlineRefresh(section, onRefresh): void` - React hook to refetch on inline refresh.

## Interfaces
- **Browser storage / cookies:** `sessionStorage["deals:inline-pending-lead-id"]` (written by `openDealsLeadInline`); indirectly `sessionStorage["garage:cms-access-unlocked"]` via the CMS gate.

## Dependencies
- **Internal:** `lib/cms/accessGate.ts` - `requestCmsAccess`, lazily imported for the CMS section.
- **Packages:** `react` - `useEffect`, `useRef` for the refresh hook.

## Used by
`app/(dashboard)/deals/page.tsx`, `app/(dashboard)/deals/leads/page.tsx`, `app/(dashboard)/deals/leads/[id]/page.tsx`, `app/(dashboard)/deals/funnel/page.tsx`, `app/(dashboard)/deals/contacts/page.tsx`, `app/(dashboard)/deals/companies/page.tsx`, `app/(dashboard)/deals/products/page.tsx`, `app/(dashboard)/deals/cms/page.tsx`, `app/(dashboard)/deals/cms/[id]/page.tsx`, `app/(dashboard)/deals/facebook/facebookintegration.jsx`, `components/crm/CRMPageLayout.tsx`, `components/crm/DealsNavbar.tsx`, `components/crm/ViewFunnelDialog.tsx`, `components/crm/leads/DeleteLeadsDialog.tsx`, `components/dashboard/inlineApps/deals/DealsApp.tsx`, `components/dashboard/inlineApps/deals/DealsMobileNav.tsx`, `components/deals/FunnelFlow.tsx`, `components/deals/cms/CmsDashboard.tsx`, `lib/crm/leadContactActions.ts` (19 importers in total).

## Notes
- `"deals:open-lead-inline"` and the sessionStorage key are string literals, not exported constants; listeners must match them exactly.
- The CMS password gate is purely client-side (the password lives in `lib/cms/accessGate.ts` source), so it is a UX speed bump, not access control.
