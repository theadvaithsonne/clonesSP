# `app/(dashboard)/deals/cms/page.tsx`

> Client page for the Deals CMS: it shows the CMS dashboard (the list of pages) and opens the page builder, either by route navigation or in place when running inside the Deals inline overlay.

**Kind:** Next.js page · **Lines:** 48 · **Route:** `/deals/cms`

## Purpose
The Deals (CRM) module includes a CMS for building and publishing landing pages. This page is its entry point. It works in two places:
- as a normal route at `/deals/cms`;
- inside the dashboard's inline Deals app (`components/dashboard/inlineApps/deals/DealsApp.tsx`), which dynamically imports this file for its "cms" section.

## How it works
- `inline` comes from `isDealsInlineMode()`, which reads the global flag `window.__garageDealsInline`. `DealsApp` sets that flag synchronously so child pages detect inline mode on first paint.
- `builderId` is local state, holding the id of the CMS page being edited in place.
- `openBuilder(pageId)` is passed to `CmsDashboard` as `onOpenBuilder`:
  - **In inline mode** it stores `pageId` in `builderId`. Navigating would leave the overlay, so the builder is shown in place.
  - **Otherwise** it calls `router.push("/deals/cms/<pageId>")`, which loads the standalone builder route `app/(dashboard)/deals/cms/[id]/page.tsx`.
- When `builderId` is set, the page renders `PageBuilderShell` with that id. Its `onBack` handler clears `builderId` and returns to the dashboard view.
- When `builderId` is not set, the page renders `CmsDashboard` in a scrolling container.
- Both views are wrapped in `CmsPageAccessGuard`:
  - The user must enter the CMS password once per browser session (a sessionStorage flag).
  - Cancelling the dialog does `router.replace("/deals")`.
- Both views show `DealsNavbar` only outside inline mode.
- `CmsDashboard` and `PageBuilderShell` read and write CMS pages, forms, domains and rules through `lib/cms/api.ts`. Those calls go to the external `https://uatapi.garage.app/api/cms/...`, not to this repo's Express backend.

## Exports
- `default DealsCmsPage()` - the page component. `DealsApp` also uses it as a component.

## Interfaces
- **External services:** `uatapi.garage.app` CMS API, called by the child components through `lib/cms/api.ts`.
- **Browser storage / cookies:** indirectly, the sessionStorage key `garage:cms-access-unlocked` (through `CmsPageAccessGuard` and `lib/cms/accessGate.ts`).

## Dependencies
- **Internal:**
  - `components/crm/DealsNavbar.tsx` - the Deals top navigation, shown only outside inline mode.
  - `components/deals/cms/CmsDashboard.tsx` - the list of CMS pages and their actions.
  - `components/deals/cms/PageBuilderShell.tsx` - the visual page builder.
  - `components/deals/cms/CmsPageAccessGuard.tsx` - the password gate.
  - `lib/deals-events.ts` - `isDealsInlineMode()`.
- **Packages:** `react` - `useState`; `next` - `useRouter` from `next/navigation`.

## Used by
- `components/dashboard/inlineApps/deals/DealsApp.tsx`, through a `next/dynamic` import, rendered for the inline "cms" section.
- Next.js, as the route `/deals/cms`. The builder's `onBack` in `app/(dashboard)/deals/cms/[id]/page.tsx` navigates back here.

## Notes
- Inline mode has a second gate. `dispatchDealsInlineNavigate("cms")` in `lib/deals-events.ts` asks for CMS access (`requestCmsAccess`) before switching sections. `CmsPageAccessGuard` here then checks the same sessionStorage flag again.
- The CMS password is a hardcoded constant in `lib/cms/accessGate.ts`, checked only in the browser. Treat the gate as a UI deterrent, not as access control.
- `inline` is computed from a global during render, not stored in state, so it does not re-render if the flag changes after mount.
