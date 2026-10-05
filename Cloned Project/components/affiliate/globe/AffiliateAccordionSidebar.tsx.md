# `components/affiliate/globe/AffiliateAccordionSidebar.tsx`

> Sidebar for the affiliate globe: breadcrumbs, focused-user header, referral search and email deep search, an infinitely scrolling list of direct referrals with plan and Unilevel Plus leg badges, and a stats footer.

**Kind:** React component · **Lines:** 702

## Purpose
The list half of the affiliate network explorer. While the globe shows where referrals are, this panel shows who they are and lets the user navigate the tree: drill into a referral, go back up through breadcrumbs, search the current level or find anyone in the whole downline by email. It is fully controlled: all data and actions come from `useAffiliateGlobe` via `AffiliateGlobeView`.

## How it works
### Breadcrumbs and header (L183-L292)
- When history has more than one entry, the last three entries are shown as clickable breadcrumbs (`onNavigateToIndex(actualIndex)`); the root is labelled "You" and the current one is disabled.
- The header shows a Back button (`onGoBack`) when not at the root, then the focused user's avatar (initial fallback), name ("You" at the root), a Founder or Member badge, a `$25` badge if `purchases.unilevelPlus` or `isPaidFounder`, `PlanBadge`s for basic/pro office plans, the direct referral count (plus total downline when larger) and a View Profile button (`onViewProfile`).

### Search (L100-L145, L294-L402)
- **Referrals search** (default): a text input kept in `localSearchQuery`, debounced 300 ms before calling `onSearch(value)` (server-side search on the current level). It re-syncs from the `searchQuery` prop, so navigation clears it. The clear button cancels the pending timer and searches "".
- **Find by Email:** a toggle shown only at the root. Submitting (button or Enter) calls `onSearchByEmail(email)`; on `{ success: true }` the input is cleared and the mode switches off (the hook has already navigated to the found user). `emailSearchError` and a hint ("Searches all levels of your downline") are shown below. Leaving the root automatically exits email mode.

### Referral list (L404-L465)
- Shows a spinner while `isLoading`, an empty state ("No members found" when searching, otherwise "No referrals yet"), or one `AccordionItem` per child.
- Infinite scroll: `handleScroll` calls `onLoadMore()` when within 100 px of the bottom and `hasMore && !isLoadingMore`. A "Load more (n of total)" button is a fallback.
- `expandedItems` (a `Set` of ids) tracks which rows show their "View N referrals ->" shortcut.

### Unilevel Plus leg numbers (L72-L98, L532-L562)
- A memo picks the children with `purchases.unilevelPlus`, sorts them by `joinedAt` ascending and numbers them 1..n (`legNumberMap`), with `totalUpActive` as the count.
- `LegBadge` shows `L<n>` coloured by tier: emerald when `totalUpActive >= 10 && legNumber >= 10` (Tier 1 and Tier 2), blue when `totalUpActive >= 4 && legNumber >= 4` (Tier 1), grey otherwise. Its tooltip explains the tier rule.
- With pagination only the loaded pages are numbered; the comment notes leading positions are still right because the backend returns directs in creation order.

### Footer (L467-L501, desktop only)
"Loaded" (or "Results" when searching) count with `/total` when more exist, and "With Network": the number of loaded children that have their own referrals.

### Sub-components (file-private)
- `PlanBadge({ plan, size })` - a `D` (Distributor's Office, basic) or `F` (Founder's Office, pro) chip that expands to the full label on hover.
- `LegBadge({ legNumber, totalUpActive })` - described above.
- `AccordionItem(...)` - one referral row: expand chevron (hidden without children), avatar, name, `F` founder chip, `$25`, leg and plan badges, referral count; clicking the row calls `onSelect` (drill down); a separate profile button; an active/inactive status dot.

## Exports
- `AffiliateAccordionSidebar(props: AffiliateAccordionSidebarProps)` - props: `focusedUser`, `directChildren`, `navigationHistory`, `onSelectUser(userId)`, `onViewProfile(userId)`, `onGoBack()`, `onNavigateToIndex(index)`, `isLoading`, `isLoadingMore`, `hasMore`, `totalCount`, `onLoadMore()`, `searchQuery`, `onSearch(query)`, `onSearchByEmail(email) => Promise<{ error } | { success: true }>`, `isEmailSearching`, `emailSearchError`.

## Interfaces
- **Background work:** a 300 ms debounce timer for search, cleared on unmount.

## Dependencies
- **Internal:** `./types` - `AffiliateUser`.
- **Packages:** `react` - hooks; `lucide-react` - icons.

## Used by
- `components/affiliate/globe/AffiliateGlobeView.tsx`
- `components/affiliate/globe/index.ts` (re-export)

## Notes
- **Leg badge rules are out of date with the backend.** The comments point to a `getActiveUpLegNumber` function in `services/unilevelPlusCommission.ts` that no longer exists. The backend now (`getActiveUpDirectCount` in `server/services/unilevelPlusCommission.ts`, changed 2026-09-16) qualifies an upline for infinity Tier 1/Tier 2 by headcount alone (at least `INFINITY_T1_MIN_LEGS = 4` / `INFINITY_T2_MIN_LEGS = 10` directs with an active Unilevel Plus licence), whatever leg the sale came through. `LegBadge` still also requires the leg's position to be at least 4 / 10, so it shows legs 1-3 (and 4-9 for Tier 2) as not qualifying, and its tooltip "Leg position must be >=4 for Tier 1" is wrong. The colours and tooltip text need updating to match.
- The `$25` badge in the header and rows also lights up for `isPaidFounder`, while leg numbering counts only `purchases.unilevelPlus`.
- The email-mode reset effect depends on `isAtRoot` only (`emailSearchMode` is read but not listed).
