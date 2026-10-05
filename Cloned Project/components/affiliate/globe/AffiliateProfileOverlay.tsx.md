# `components/affiliate/globe/AffiliateProfileOverlay.tsx`

> Slide-in right-hand panel that shows any affiliate's profile (badges, stats, contact, offices, referrer) and their direct downlines, with in-panel navigation and a "Grow Your Network" hand-off per office.

**Kind:** React component · **Lines:** 763

## Purpose
Across the dashboard, clicking a person's avatar or "View Profile" (feed, DMs, workspace cards, taskroom chat, the affiliate globe and others) dispatches a window event `affiliate-profile:open`. `app/(dashboard)/layout.tsx` listens for it and mounts this overlay with that user's id. It is the shared "affiliate profile card" of the app: who the person is, what offices they founded or joined, who referred them and who they referred.

## How it works
### Navigation state (L44-L79)
- `currentUserId` starts from the `userId` prop; when the prop changes from outside, it resets and clears `history`.
- `handleNavigate(newId)` pushes the current id onto `history` and switches to another user (used by the "Referred By" card and downline rows). `handleGoBack()` pops back; the Back arrow appears only when history is non-empty.
- Switching users clears the downline list and search and returns to the Details tab.

### Data loading (L136-L201)
- **Profile:** on every `currentUserId` change, `GET /backend/affiliate/user-info/:id` (with `?orgId=` from `localStorage.garage_org_id`). Offices with blank or "unknown" names are filtered out, `officesJoined` is recomputed and `hasChildren` is derived from `directReferrals > 0`. Errors show "Failed to load user profile".
- **Downlines:** fetched lazily the first time the Downlines tab opens, and only if the user has referrals: `GET /backend/affiliate/direct-children/:id` (default page size, no pagination controls). Errors are only logged.

### Layout (L225-L653)
- A blurred backdrop (`z-[950]`, click to close) and a fixed 420 px panel (`z-[1000]`, `animate-slide-in-right`) with close and back buttons.
- **Header:** brand-coloured banner, avatar (initial fallback) with an active/inactive dot, name with a copy button, a role chip ("Guest" if `user.guest`, else "Founder" or "Stakeholder") and the affiliate id as a copy-to-clipboard chip.
- **Details tab:** three `StatCard`s (Referrals = direct, Downline = `totalReferrals`, Joined = relative time via `getTimeAgo`), "Offices Founded" (offices with `role === "founder"`), Contact (mailto email with copy, location via `getLocationString`, formatted join date), "Offices Joined" (all offices, so founded ones appear in both lists) and a clickable "Referred By" card with copyable name and email.
- **Downlines tab:** client-side name filter over the loaded list; each row navigates into that downline inside the panel.
- `handleCopyText` writes to the clipboard and shows a check icon for 2 s (`copiedField`).

### Grow Your Network hand-off (L81-L120)
Each `OfficeCard` with a `slug` has a "Grow Your Network" button. `handleGrowNetwork(office)`:
- on desktop (`min-width: 768px`) dispatches `right-panel:open-information` with `{ type: "grow_network", growNetwork: { kind: "hq", hqSlug, hqLabel } }`, which the dashboard layout uses to open the right panel's share tools for that office's lobby;
- on mobile (where that panel is hidden) dispatches `open:guest-funnel` with `{ orgSlug, orgName, orgId }`;
- then closes the overlay so it does not cover what it opened.
As the comments explain, no affiliate id is sent: the share panel always uses the viewer's own referral code, and the office only chooses which lobby the link points to. The card used to print a `/hq/<slug>?ref=<id>` link directly.

### Sub-components (file-private)
`SectionLabel`, `StatCard` (`emerald | purple | amber`; purple and amber both use the brand colour), `OfficeCard` (icon or building placeholder, name, role or "Guest", Grow Your Network button).

## Exports
- `AffiliateProfileOverlay({ userId, onClose, onViewProfile })`:
  - `userId: string` - the profile to show first.
  - `onClose: () => void` - close the panel.
  - `onViewProfile: (userId: string) => void` - accepted but not used inside the component; in-panel navigation uses local state instead.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/affiliate/user-info/:userId?orgId=` - profile (`server/routes/affiliate.ts`, `requireUserOrGarageAdmin`).
  - `GET /backend/affiliate/direct-children/:userId?orgId=` - direct downlines (`requireAuth`).
- **Browser events:** dispatches `right-panel:open-information` (desktop) or `open:guest-funnel` (mobile); is itself opened by the layout's handler for `affiliate-profile:open`.
- **Browser storage:** reads `garage_org_id` from localStorage; the JWT is added by `api()`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper; `./types` - `AffiliateUser`, `AffiliateOffice`, response types, `getLocationString`.
- **Packages:** `react` (`useState`, `useEffect`), `lucide-react` (icons).

## Used by
- `components/affiliate/globe/index.ts` (re-export), imported by `app/(dashboard)/layout.tsx`, which renders it when `affiliateProfileUserId` is set, i.e. after any component dispatches `affiliate-profile:open` (for example `components/dashboard/DMPage.tsx`, `FeedComponents.tsx`, `AppTabBar.tsx`, workspace `UserSpaceCard.tsx`, `useAffiliateGlobe`).

## Notes
- `user` here is local `useState`, not the auth store (the project's CLAUDE.md calls this out so it is not confused with the store's `setUser`).
- The Downlines tab shows only the first page the backend returns (50 by default); the tab label uses the full `directReferrals` count, so for large networks the list is silently truncated and the search only filters those loaded rows.
- The name, affiliate-id and email copy buttons share one `copiedField` value, so copying the referrer's name also flips the main name's icon.
- Profile visibility is enforced by the backend endpoints; the component itself fetches whatever id it is given.
