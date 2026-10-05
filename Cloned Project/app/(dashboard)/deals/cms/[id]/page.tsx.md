# `app/(dashboard)/deals/cms/[id]/page.tsx`

> Client page that opens the Deals CMS page builder for one CMS page, behind the CMS password gate.

**Kind:** Next.js page · **Lines:** 33 · **Route:** `/deals/cms/[id]`

## Purpose
The Deals (CRM) module has a small CMS for building landing pages. `/deals/cms` lists the pages, and this route opens the visual builder (`PageBuilderShell`) for the page whose id is in the URL. It is the deep-linkable, full-route version of the builder. In inline mode the list page opens the builder in place instead of navigating here.

## How it works
- It reads `id` from `useParams()` and turns it into a string. If the id is empty it renders nothing.
- `inline` is true when the page runs inside the Deals inline overlay. `isDealsInlineMode()` reads the global `window.__garageDealsInline`, which `DealsApp` sets. In inline mode `DealsNavbar` is hidden, because the overlay supplies its own chrome.
- Everything is wrapped in `CmsPageAccessGuard`:
  - It checks `isCmsAccessUnlocked()` (a sessionStorage flag). If access is not yet unlocked it shows `CmsPasswordDialog`.
  - A correct password unlocks access for the rest of the browser session.
  - Closing the dialog sends the user to `/deals` with `router.replace`.
- `PageBuilderShell` receives `pageId` and an `onBack` handler that calls `router.push("/deals/cms")` to return to the CMS dashboard.
- The builder loads and saves the page through `lib/cms/api.ts`. Those calls go to the external `https://uatapi.garage.app/api/cms/pages/...` (via `buildExternalUrl`), not to this repo's backend.

## Exports
- `default DealsCmsBuilderPage()` - the page component.

## Interfaces
- **External services:** `uatapi.garage.app` CMS endpoints, called by `PageBuilderShell` through `lib/cms/api.ts`.
- **Browser storage / cookies:** indirectly, the sessionStorage key `garage:cms-access-unlocked` (read and written by `lib/cms/accessGate.ts` through `CmsPageAccessGuard`).

## Dependencies
- **Internal:**
  - `components/crm/DealsNavbar.tsx` - the Deals top navigation, shown only outside inline mode.
  - `components/deals/cms/CmsPageAccessGuard.tsx` - the password gate.
  - `components/deals/cms/PageBuilderShell.tsx` - the builder UI.
  - `lib/deals-events.ts` - `isDealsInlineMode()`.
- **Packages:** `next` - `useParams` and `useRouter` from `next/navigation`.

## Used by
Nothing imports it. Next.js serves it at `/deals/cms/<pageId>`. Outside inline mode, `app/(dashboard)/deals/cms/page.tsx` navigates here when a page is opened.

## Notes
- The CMS gate is client-side only. `lib/cms/accessGate.ts` hardcodes the CMS password as a string constant (`CMS_ACCESS_PASSWORD`) and compares it in the browser, so the gate deters casual users but provides no real security.
- `inline` is computed during render from a global flag, not from React state. This works because `DealsApp` sets the flag synchronously before its child pages render.
