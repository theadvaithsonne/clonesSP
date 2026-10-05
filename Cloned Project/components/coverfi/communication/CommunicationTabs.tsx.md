# `components/coverfi/communication/CommunicationTabs.tsx`

> Client-side tab bar that switches between the Coverfi Communication "Templates" and "Senders" pages.

**Kind:** React component · **Lines:** 39

## Purpose
The Coverfi Communication area (`/coverfi/communication/*`) has two sub-pages: email templates and email senders. This component renders the horizontal tab strip shown under the section header so users can move between them, highlighting the tab that matches the current URL.

## How it works
- A static `tabs` array holds two entries: `/coverfi/communication/templates` ("Templates") and `/coverfi/communication/senders` ("Senders").
- `usePathname()` (falling back to `""`) gives the current path. A tab is active when the path equals its `href` exactly or starts with `href + "/"`, so the Templates tab stays highlighted on the template editor at `/coverfi/communication/templates/[id]`.
- Each tab is a Next.js `<Link>`; the active one gets white text and a `border-brand` underline, inactive ones a grey (`#9fa0b8`) colour with a transparent border. `cn()` merges the class lists.
- It holds no state and makes no network calls.

## Exports
- `default CommunicationTabs()` - renders the tab navigation; takes no props.

## Dependencies
- **Internal:** `lib/utils.ts` - `cn()` class-name merger.
- **Packages:** `next` - `Link` (`next/link`) and `usePathname` (`next/navigation`).

## Used by
- `app/(dashboard)/coverfi/communication/layout.tsx` - rendered beneath the "Communication" `PageHeader` for every page under `/coverfi/communication` (the index route redirects to `/coverfi/communication/templates`).

## Notes
- Adding a new Communication sub-page needs a new entry in the `tabs` array here as well as the route folder.
