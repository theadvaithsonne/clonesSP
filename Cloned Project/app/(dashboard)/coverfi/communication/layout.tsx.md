# `app/(dashboard)/coverfi/communication/layout.tsx`

> Shared layout for the Coverfi Communication pages: a section header plus the Templates/Senders tab strip, above a scrollable content area.

**Kind:** Next.js layout · **Lines:** 24 · **Route:** `/coverfi/communication` (wraps `/coverfi/communication/**`)

## Purpose
Coverfi sends outbound email when Coverfi events happen. The Communication area manages two things: email **templates** (rich HTML with variables) and **senders** (from-addresses). This layout keeps the header and tabs in place while the routed page changes.

## How it works
- A server component that renders a full-height flex column:
  - `PageHeader`: eyebrow "Coverfi · Outbound", title "Communication", the description "Email senders and rich-HTML templates triggered by Coverfi events.", a `Mail` icon, and `noDivider`.
  - `CommunicationTabs`: links to `/coverfi/communication/templates` and `/coverfi/communication/senders`.
  - A `flex-1 overflow-auto` container for the page.
- It sits inside `app/(dashboard)/coverfi/layout.tsx`, which supplies the founder check and the password gate.

## Exports
- `default CommunicationLayout({ children })` - the layout component.

## Dependencies
- **Internal:** `components/coverfi/PageHeader.tsx` (header), `components/coverfi/communication/CommunicationTabs.tsx` (tabs).
- **Packages:** `lucide-react` (`Mail` icon).

## Used by
No file imports it. Next.js applies it to every route under `/coverfi/communication`, including the template editor at `/coverfi/communication/templates/[id]`.
