# `components/athena/components/members-view.tsx`

> A small library of presentational building blocks (scope tabs, sub-tabs, table/card view toggle, search toolbar, card grid and member card) shared by the Athena/Taskroom "people" screens.

**Kind:** React component · **Lines:** 361

## Purpose
The Taskroom (Athena) area has several places that list members of a workspace, space or room: the People dashboard and the room/space members dialogs. This file holds the shared UI pieces those screens use so they look and behave the same. It holds no data fetching and no business state; every component is fully controlled by props. It complements `members-table.tsx`, which provides the table-mode equivalents, and reuses that file's `getInitials` helper for avatar fallbacks.

## How it works
All components are client components (`"use client"`), styled with Tailwind using the dark Garage palette (`#121212`, `#2d2d2d`) and the `bg-brand` / `text-brand-foreground` theme tokens. Class names are merged with `cn` from `lib/utils.ts`.

- **`PeopleScopeTabs`** (L18-L82) renders a pill-shaped segmented control. Each tab shows a bold `label`, a bullet, a truncated `name` (with a `title` tooltip) and a `count` badge. Thin dividers separate tabs. Disabled tabs are dimmed and their clicks are ignored. The active tab swaps colours: brand background, and the count badge inverts to a dark chip.
- **`PeopleSubTabs`** (L89-L127) is a simpler inline pill switcher (label only). `room-members-dialog.tsx` uses it for "Existing Members" / "Available Members".
- **`MembersViewToggle`** (L129-L164) is two icon buttons (`LayoutList`, `LayoutGrid`) that switch between `"table"` and `"card"` modes.
- **`MembersSearchToolbar`** (L166-L223) combines a fixed-width search input (with a `Search` icon) with optional `trailing` controls and the view toggle. `align="split"` (default) puts the search on the left and the controls on the right; `align="end"` groups everything together on the right. The input is controlled: the caller owns `value` and `onChange`.
- **`MembersCardGrid`** (L225-L256) is a scrollable responsive CSS grid (`repeat(auto-fill, minmax(...))`, minimum card width growing from 5.25rem up to 7.75rem at `xl`). An optional `sentinel` node is placed after the grid inside the scroll area, so the caller can attach an IntersectionObserver for infinite scroll. An optional `footer` sits outside the scroll area.
- **`MemberCard`** (L258-L345) is a square avatar tile. The image comes from `userData.profilePicture`, `image` or `avatar`; without one it shows the initials from `getInitials`. Below the image are the name, an optional capitalised role (colour overridable via `roleClassName`) and an optional `badge`. The right-hand dot means one of two things:
  - if `status` is passed, it is a presence dot (green when `status === "active"`, hollow otherwise);
  - otherwise, if `isSelected` is passed, it is a selection dot.

  When `onClick` is given, the card becomes keyboard-accessible (`role="button"`, `tabIndex=0`, Enter or Space activates). The `actions` slot sits top-right over the image, and clicks on it do not bubble to the card.
- **`MemberCardSkeletonGrid`** (L347-L360) renders `count` (default 8) pulsing placeholder cards to show while loading.

## Exports
- `type MemberViewMode = "table" | "card"` - which layout the people list uses.
- `type PeopleScopeTabItem = { id; label; name; count; disabled? }` - one scope tab.
- `PeopleScopeTabs({ tabs, activeId, onChange, className? })` - segmented scope selector with counts.
- `type PeopleSubTabItem = { id; label }` - one sub-tab.
- `PeopleSubTabs({ tabs, activeId, onChange, className? })` - pill sub-tab switcher.
- `MembersViewToggle({ viewMode, onViewModeChange, className? })` - table/card toggle.
- `MembersSearchToolbar({ value, onChange, viewMode, onViewModeChange, placeholder?, className?, trailing?, align? })` - search input plus controls.
- `MembersCardGrid({ children, className?, sentinel?, footer? })` - responsive scrolling grid container.
- `MemberCard({ userData, role?, roleClassName?, status?, isSelected?, onClick?, actions?, badge? })` - single member tile.
- `MemberCardSkeletonGrid({ count? })` - loading placeholders.

## Dependencies
- **Internal:** `components/athena/components/members-table.tsx` - `getInitials` for avatar fallbacks; `lib/utils.ts` - `cn` class merger.
- **Packages:** `react`; `lucide-react` - `LayoutGrid`, `LayoutList` and `Search` icons.

## Used by
- `components/athena/components/WorkspacePeopleDashboard.tsx`
- `components/athena/components/room-members-dialog.tsx` (uses `PeopleSubTabs`)
- `components/athena/components/space-members-dialog.tsx`

It has no route of its own. It renders inside the Taskroom screens that mount those components.

## Notes
- `userData` is typed `any`. The components only read `name`, `profilePicture`, `image` and `avatar`.
- `MemberCard` uses a plain `<img>`, not `next/image`, which matches the repo's unoptimised-images setup.
