# `components/dashboard/inlineApps/events/browse-ui.tsx`

> Building blocks for the attendee-facing Events pages (Discover, the event page and Purchases).

**Kind:** React component · **Lines:** 451 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Building blocks for the attendee-facing Events pages (Discover, the event
page and Purchases).

These pages follow their own dark palette rather than the founder console's:
#181818 page, #202020 cards on #262626 hairlines, with the office's brand
colour (`brand` tokens) as the only accent.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `EventCover`×2 (local), `Bookmark` (lucide-react), `ChevronDown` (lucide-react), `Check` (lucide-react)

### Props

- **`EventCover`**: `src?: string`, `className?: string`
- **`BookmarkButton`**: `saved: boolean`, `onToggle: () => void`, `className?: string`
- **`EventCard`**: `image?: string`, `label: string`, `title: string`, `subtitle?: string`, `footer?: React.ReactNode`, `corner?: React.ReactNode`, `onOpen?: () => void`
- **`EventBar`**: `image?: string`, `name: string`, `meta: string`

**Hooks used:** `useState`×6, `useEffect`×5, `useCallback`×2, `useAuthStore` (store/authStore.tsx), `useMemo`, `useRef`, `useOrgShareOrigin` (lib/hooks/useOrgShareOrigin.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EventCover` | component | `EventCover({ src, className = "", }: { src?: string; className?: strin…)` — An event banner, or a brand-tinted panel when there is none. | 20 |
| `useSavedEvents` | hook | `useSavedEvents()` — Bookmarked events, per user and office. | 63 |
| `BookmarkButton` | component | `BookmarkButton({ saved, onToggle, className = "", }: { saved: boolean; onT…)` | 112 |
| `EventCard` | component | `EventCard({ image, label, title, subtitle, footer, corner, onOpen, }:…)` — The grid card used by Discover and Purchases. | 146 |
| `EventBar` | component | `EventBar({ image, name, meta, }: { image?: string; name: string; met…)` — The event as a one-line strip: banner thumbnail, name, date and place. | 206 |
| `CardSkeleton` | component | `CardSkeleton()` | 228 |
| `CARD_GRID` | const | `= "grid grid-cols-1 gap-5 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4"` | 242 |
| `PAGE` | const | `= "mx-auto w-full max-w-[1240px] px-5 pb-32 pt-7 @3xl:px-10"` — Page column: the design's 40px gutters, capped so ultra-wide screens don't stretch the grid. | 246 |
| `OUTLINE_BUTTON` | const | `= "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#2e2e2e]…` | 248 |
| `EmptyPanel` | component | `EmptyPanel({ icon, title, description, action, }: { icon?: React.React…)` | 251 |
| `SectionHeading` | component | `SectionHeading({ children, className = "", }: { children: React.ReactNode;…)` | 276 |
| `FilterOption` | interface |  | 294 |
| `FilterDropdown` | component | `FilterDropdown({ value, onChange, options, placeholder, align = "left", }:…)` — A compact dark dropdown for the filter row. | 304 |
| `useEventShareUrl` | hook | `useEventShareUrl(slug?: string)` — The public link to an event, carrying the viewer's own affiliate id so a purchase through it is credited to them. | 401 |
| `displayUrl` | function | `displayUrl(url: string)` — "garage.app/events/x?ref=y" — the link as the eye reads it. | 431 |
| `XLogo` | component | `XLogo({ className = "" }: { className?: string })` | 435 |
| `LinkedInGlyph` | component | `LinkedInGlyph({ className = "" }: { className?: string })` — LinkedIn's "in" without the rounded square, as it sits in running UI. | 444 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`
  - `lib/affiliate-share.ts` — `fetchMyAffiliateId`, `withAffiliateRef`
  - `lib/hooks/useOrgShareOrigin.ts` — `useOrgShareOrigin`
  - `store/authStore.tsx` — `useAuthStore`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Bookmark`, `Check`, `ChevronDown`

## Used by

- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/dashboard/inlineApps/events/EventsBrowse.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
