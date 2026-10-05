# `app/(dashboard)/coverfi/brokerage/layout.tsx`

> Shared layout for the "My Brokerage" pages: a section header plus the tab strip, above a scrollable content area.

**Kind:** Next.js layout · **Lines:** 24 · **Route:** `/coverfi/brokerage` (wraps `/coverfi/brokerage/**`)

## Purpose
The brokerage area has five tabs: Profile, Branding, Locations, Stakeholders and Landing Page. Each tab is its own route. This layout keeps the header and tabs fixed while the active tab's page renders below.

## How it works
- A server component that renders a full-height flex column:
  - `PageHeader`: eyebrow "Coverfi · Brokerage", title "My Brokerage", the description "Profile, branding, locations, stakeholders, and the public landing page.", a `Building2` icon, and `noDivider`.
  - `BrokerageTabs`: links to `/coverfi/brokerage`, `/branding`, `/locations`, `/employees` and `/landing`. The active tab is highlighted from the pathname.
  - A `flex-1 overflow-auto` container for the page.
- It sits inside `app/(dashboard)/coverfi/layout.tsx`, which supplies the founder check and the password gate.

## Exports
- `default BrokerageLayout({ children })` - the layout component.

## Dependencies
- **Internal:** `components/coverfi/PageHeader.tsx` (header), `components/coverfi/brokerage/BrokerageTabs.tsx` (tab navigation).
- **Packages:** `lucide-react` (`Building2` icon).

## Used by
No file imports it. Next.js applies it to every route under `/coverfi/brokerage`.
