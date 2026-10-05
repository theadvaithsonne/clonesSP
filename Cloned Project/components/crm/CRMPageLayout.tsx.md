# `components/crm/CRMPageLayout.tsx`

> Full-height page shell for the Deals (CRM) pages: it shows the Deals navbar (except in inline mode) above a themed main content area.

**Kind:** React component · **Lines:** 41

## Purpose
Gives the Deals dashboard, contacts and companies pages one shared frame, so they get the same background, the same navbar and the same scrolling behaviour. A slot for the left `CRMSidebar` is still in the markup but is commented out, so today the layout is navbar plus content only.

## How it works
- Reads `theme` from `next-themes`. When the theme is `"color"`, the outer wrapper, content column and `<main>` use the `#0A0A1E` background. Any other theme uses `bg-background`.
- `isDealsInlineMode()` (from `lib/deals-events.ts`) returns true when `window.__garageDealsInline` is set. `DealsApp` (`components/dashboard/inlineApps/deals/DealsApp.tsx`) sets that flag when Deals runs as an inline overlay inside the dashboard. In that mode `DealsNavbar` is skipped because DealsApp supplies its own header.
- The `fill` prop changes how scrolling works:
  - `fill` true: `<main>` becomes a non-scrolling flex column (`flex min-h-0 flex-1 flex-col overflow-hidden`), so a child such as the shared DataTable can own the vertical scroll (sticky header, pinned footer).
  - Default: `<main>` scrolls vertically (`overflow-y-auto`) and has `pb-28` bottom padding.
- The outer container is `h-screen overflow-hidden`, so the page itself never scrolls. Only `<main>` (or its child) does.

## Exports
- `default CRMPageLayout({ children, fill? }: CRMPageLayoutProps)` - wraps `children` in the Deals shell. `fill?: boolean` hands the full height to the page instead of scrolling it.

## Dependencies
- **Internal:** `components/crm/DealsNavbar.tsx` - top navigation for routed Deals pages; `components/crm/CRMSidebar.tsx` - imported but only referenced in a commented-out JSX line; `lib/deals-events.ts` - `isDealsInlineMode()`.
- **Packages:** `next-themes` - current theme for background selection.

## Used by
- `app/(dashboard)/deals/page.tsx` (`/deals`)
- `app/(dashboard)/deals/contacts/page.tsx` (`/deals/contacts`)
- `app/(dashboard)/deals/companies/page.tsx` (`/deals/companies`)

## Notes
- The `CRMSidebar` import is unused at runtime, but it still pulls that module into the bundle.
- `isDealsInlineMode()` reads `window`, so it returns false on the server render and can return true on the client. This could cause a hydration mismatch around the navbar. In practice these pages are client components inside the dashboard.
