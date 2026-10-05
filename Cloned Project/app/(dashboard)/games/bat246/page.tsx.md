# `app/(dashboard)/games/bat246/page.tsx`

> BAT246 landing page ("BAT 246 Admin Dashboard" / "BAT 246 Dashboard"): auto-joins the user to the BAT246 office if needed, sends board-position holders to their dashboard, and shows a grid of tiles filtered by the user's permission grants.

**Kind:** Next.js page · **Lines:** 383 · **Route:** `/games/bat246`

## Purpose
This is where the sidebar "BAT 246" link (and `/games`, by redirect) lands. It acts as a router and home screen for the BAT246 game's back office. It decides who the user is in BAT246 terms (Alan, a granted admin, a board-position holder, or a plain office member) and shows each the right set of navigation tiles, plus office-wide stats for admins.

## How it works

### Roles (L114-L130)
- `useAmIFounder()` supplies `userData` (email, `orgName`) and `loading`.
- `useMyBat246Grants()` supplies `isAlanK` and `grantedKeys` (from `GET /backend/bat246/permissions/mine`).
- `DEFAULT_MEMBER_CARD_KEYS` (`documentation`, `b2coinwallet`) mirrors the backend's `DEFAULT_ORG_CARD_KEYS`: every office member gets these automatically, so they do not count as admin access. `hasRealAdminGrant` is true only when the user holds some other key. `isAdmin = isAlanK || hasRealAdminGrant`.

### Org auto-join and routing effect (L232-L291)
1. If the user's current org (`userData.orgName`) is not one of `BAT246_ORGS` (`"TestCompany XYZ"`, `"Bat246"`, `"BAT 246"`):
   - If `sessionStorage["bat246_org_autojoin_attempted"]` is already set, give up and `router.replace("/workspace")`.
   - Otherwise set that flag and `POST ${API}/bat246/office/join`. The backend adds the user to the BAT246 org as a `stakeholder` (if not already a member) and returns a new JWT scoped to that org. The page stores it in `localStorage["garage_tok"]`, stores the returned `orgId` in `localStorage["garage_org_id"]` (with a hardcoded org-id fallback on L255) and reloads. On failure it goes to `/workspace`.
   - The sessionStorage key is shared with `boards/page.tsx`, so the two pages together can make at most one join attempt and never loop.
2. When the org is a BAT246 one, the flag is cleared.
3. Alan or a real admin stays on the page (`checkingBoardPosition` set false).
4. Anyone else (once their email is known) is checked with `GET ${API}/bat246/my-dashboard-access`; when `hasAccess` is true they are redirected to `/games/bat246/dashboard` (the richer board-position page). Otherwise they stay and see the default tiles.
- While loading, or while that board-position check runs for a non-admin, the page renders `null`, so a board holder never sees the tile grid flash before redirecting.

### Admin stats (L293-L320, L352-L366)
- Only for `isAdmin`. Uses a module-level cache (`_statsCache`, 60-second `STATS_TTL`).
- Otherwise fetches in parallel `GET ${API}/office/bat246/members` (also stored via `setMembersCache` so the Members page opens instantly) and `GET ${API}/bat246/distributors?page=1&limit=1` (only `total` is used). Displays two `StatCard`s: Office Members and Distributors.

### Tiles (L132-L230, L322-L378)
`CARDS` defines nine tiles, each with href, icon, label, subtitle, colours and optionally a `cardKey` or `alwaysVisible`:

| Tile | Route | Visibility rule |
|---|---|---|
| Game Boards | `/games/bat246/boards` | `cardKey: "boards"`, `alwaysVisible` |
| Office Members | `/games/bat246/members` | `members` grant |
| Distributors | `/games/bat246/distributors` | `distributors` grant |
| Documentation | `/games/bat246/documentation` | `documentation` grant (every member has it by default) |
| Lost Money | `/games/bat246/lostmoney` | `lostmoney` grant |
| Invite and Place | `/games/bat246/Inviteandplace` | `inviteandplace` grant |
| Permissions | `/games/bat246/permission` | no cardKey: Alan only |
| B2 Coin Wallet | `/games/bat246/B2CoinWallet` | `alwaysVisible`; uses image `/images/bat246-b2coin-logo.png` instead of an icon |
| Snap Back Loans | `/games/bat246/snapbackloans` | `alwaysVisible`; the destination page itself switches between admin and member views |

`visibleCards = CARDS.filter(c => isAlanK || c.alwaysVisible || (c.cardKey && grantedKeys.includes(c.cardKey)))`. Tiles render as `NavTile`s numbered 1..n in a 1/2/3-column responsive grid. The header shows the title, `Bat246ReferralInviteButton`, and `Bat246NotificationBell`.

## Exports
- `default Bat246AdminPage()` - the landing page component.

Internal: `NavTile`, `StatCard`, `CardCfg` interface, constants `BAT246_ORGS`, `DEFAULT_MEMBER_CARD_KEYS`, `STATS_TTL`.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/bat246/office/join` - add the user to the BAT246 org and return a re-scoped JWT.
  - `GET /backend/bat246/my-dashboard-access` - whether the user has a board position (`hasAccess`).
  - `GET /backend/office/bat246/members` - member count (admin stats).
  - `GET /backend/bat246/distributors?page=1&limit=1` - distributor total (admin stats).
  - Indirectly `GET /backend/bat246/permissions/mine` via `useMyBat246Grants`.
- **Browser storage:** `localStorage["garage_tok"]` (read; overwritten after auto-join), `localStorage["garage_org_id"]` (written after auto-join), `sessionStorage["bat246_org_autojoin_attempted"]` (one-shot guard, shared with `boards/page.tsx`).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).

## Dependencies
- **Internal:**
  - `lib/hooks/useAmIFounder.ts` - current user and org name.
  - `lib/hooks/useBat246CardAccess.ts` - `useMyBat246Grants` and the `Bat246CardKey` type.
  - `lib/bat246MembersCache.ts` - `setMembersCache` to warm the Members page cache.
  - `components/bat246/Bat246NotificationBell.tsx` - notifications bell in the header.
  - `components/bat246/Bat246ReferralInviteButton.tsx` - referral invite button in the header.
- **Packages:** `react`, `next` (`useRouter`, `Link`), `lucide-react` (tile icons).

## Used by
- Next.js route `/games/bat246`; the target of the sidebar "BAT 246" link and of the `/games` redirect. No file imports it.

## Notes
- Tile visibility is a UI convenience, not a security boundary; the destination pages and backend routes do their own checks (with varying strictness).
- The org check matches on the org's display name (`orgName`), including a test org name, rather than on an id.
- The `snapbackloans` card key exists in `BAT246_CARD_KEYS` but is not used for tile visibility here (the tile is `alwaysVisible`); it only gates the admin view inside the Snap Back Loans page.
