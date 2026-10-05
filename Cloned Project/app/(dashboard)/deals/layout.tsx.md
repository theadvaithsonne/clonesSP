# `app/(dashboard)/deals/layout.tsx`

> Client-side Next.js layout that wraps every `/deals/*` route in its own theme provider, user context, toaster, follow-up "knock" reminder and CMS password gate.

**Kind:** Next.js layout · **Lines:** 30 · **Route:** `/deals` (and every nested `/deals/...` page)

## Purpose
The Deals area (the CRM: leads, funnels, contacts, companies, products, CMS, Facebook) has its own look and theme, separate from the rest of the dashboard. This layout gives those pages a separate `next-themes` theme store, a user context, a toast host and two always-mounted helpers: the follow-up reminder card and the host for the CMS password dialog.

## How it works
- `ThemeProvider` (a local wrapper around `next-themes`) is set up with `attribute="class"`, `defaultTheme="dark"`, `enableSystem` and `disableTransitionOnChange`. Its `storageKey="deals-theme"` keeps the Deals theme apart from the main app theme. Child pages such as `deals/funnel/page.tsx` read it with `useTheme()` and support `"light"`, `"dark"` and a custom `"color"` theme.
- `UserProvider` from `context/UserContext.tsx` exposes the current user (read from the `garage_tok` token in localStorage) to Deals pages through `useUser()`.
- Everything sits inside `<div className="deals-primary-scope">`, so the CSS primary-colour overrides apply only inside Deals.
- `<Toaster position="top-center" />` is the `sonner` toast host. Pages call `toast.success/error`.
- `<FollowUpKnockReminder />` uses `useFollowUpReminders()`, which polls `crm/activities-followups` on the external CRM API (`https://uatapi.garage.app/api`, through `buildExternalUrl`) every 5 minutes. It shows a `FollowUpKnockCard` when a follow-up is due.
- `<CmsAccessGateHost />` registers a password dialog with `lib/cms/accessGate.ts`. CMS actions anywhere in Deals can then ask for the CMS password before they run.

## Exports
- `default DealsLayout({ children })` - the layout component.

## Interfaces
- **External services:** the CRM API at `https://uatapi.garage.app/api` (polled by the follow-up reminder). It is not part of this repo.
- **Browser storage / cookies:** localStorage key `deals-theme` (theme choice, written by next-themes). The child components also read `garage_tok` from localStorage (UserContext) and use a sessionStorage unlock flag (CMS gate).
- **Background work:** a 5-minute polling interval plus a reminder-check interval, both inside `useFollowUpReminders`.

## Dependencies
- **Internal:** `app/(dashboard)/deals/components/theme-provider.tsx` - thin `next-themes` wrapper; `app/(dashboard)/deals/components/FollowUpKnockReminder.tsx` - follow-up reminder card; `components/deals/cms/CmsAccessGateHost.tsx` - CMS password dialog host; `context/UserContext.tsx` - `UserProvider`.
- **Packages:** `sonner` - `Toaster`.

## Used by
Next.js applies it automatically to every route under `app/(dashboard)/deals/`. Because `(dashboard)` is a route group, those URLs start at `/deals`. It sits inside `app/(dashboard)/layout.tsx`. Nothing imports it directly.

## Notes
- The inline Deals app (`components/dashboard/inlineApps/deals/DealsApp.tsx`) loads the Deals page components directly with `dynamic(import(...))`, so this layout does not wrap them there. Inline mode has to supply its own theme, toaster and providers.
- The CMS gate checks the password only in the browser, against a constant hardcoded in `lib/cms/accessGate.ts`. Treat it as a UI speed bump, not as security.
