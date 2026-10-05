# `lib/founderPages.ts`

> One shared check for whether the current dashboard "popover" page belongs to the sidebar's Founders menu, plus the `TabSet` type for the top-bar tab sets.

**Kind:** frontend library · **Lines:** 19

## Purpose
The dashboard tracks which in-app page is open with a "popover" string, not a URL. Founder pages (the founder console, Networks Manager and Office Settings) switch `MainSidebar` to its Founders menu and give the dashboard layout its own set of top-bar tabs. Both places call this one function so they always agree on which pages count as founder pages.

## How it works
`isFounderPage` returns `false` for null, undefined or an empty string. Otherwise it returns `true` when the popover:
- starts with `"Founder:"` (every founder-console sub-page),
- equals `"Networks Manager"`,
- equals `"Office Settings"` or starts with `"Office Settings:"`.

The check is case-sensitive.

## Exports
- `isFounderPage(popover: string | null | undefined): boolean` - true when the popover id belongs to the Founders menu.
- `type TabSet = "main" | "founders"` - which set of top-bar tabs is showing.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `app/(dashboard)/layout.tsx` - `getTabSet` returns `"founders"` for founder pages. Recent tabs are stored per `TabSet` (and per org) and sorted by `isFounderPage`.
- `components/dashboard/AppTabBar.tsx`
- `components/dashboard/MainSidebar.tsx` - switches the sidebar to the Founders menu.
- `components/dashboard/NewTabPicker.tsx`

## Notes
- Any new founder page needs a popover id that matches one of these patterns. If it doesn't, the sidebar and tab bar will treat it as a main page.
