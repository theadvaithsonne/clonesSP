# Porting the NetworkChains super-admin panel into the Garage admin panel

**Date:** 2026-09-02
**Status:** Implemented (Phase 1 + Phase 2) — NC-app removal still deferred
**Primary repo:** `client/garage-web-app-nextjs-v1`
**Also touches:** `server/contacts-backend` (one new auth endpoint)
**Source repo (read-only for this work):** `client/networkchains-web-app-nextjs-v1-invite-clone`

## Goal

The NetworkChains super-admin panel currently lives at `networkchains.com/admin`.
Bring it into the Garage admin panel at `admin.garage.app/garage-admin`, under the
"NetworkChains" dashboard type that already exists in the top-right type switcher
but today renders only a `DashboardComingSoon` placeholder.

**Explicitly out of scope:** removing or redirecting the panel in the NetworkChains
web app. Per the product decision on 2026-09-02, `networkchains.com/admin` keeps
working unchanged. Both panels will call the same contacts-backend admin endpoints
until a later cutover. There is no data migration — only a second front door.

## Current state

### Target: `client/garage-web-app-nextjs-v1`

`app/garage-admin/(admin-dashboard)/layout.tsx` is the super-admin shell. Relevant
mechanics:

- `DASHBOARD_TYPES` (layout.tsx:100) declares four dashboard types —
  `admin` (`ready: true`), `support`, `fulfillment`, `networkchains` (all
  `ready: false`).
- Selection persists to `localStorage` under `garage_admin_selected_dashboard`.
- When `selectedMeta.ready` is false the sidebar renders nothing and the main
  column renders `DashboardComingSoon` (layout.tsx:1165).
- Navigation is modelled as `NavGroupModel[]` — accordion groups of `NavLeaf`
  items, each leaf declaring either a `page` key (checked against the admin's
  per-page permissions) or `superOnly: true`.
- Auth is `garage_admin_token` in `localStorage` plus a cached `garage_admin_info`
  profile, re-fetched from `/garage-admin/profile` on every mount, against
  garagenew-backend.

**Known defect this design fixes:** the selected dashboard type is client state
only and is not reflected in the URL. Selecting "NetworkChains" leaves you on
e.g. `/garage-admin/one-time-affiliates` while rendering the NC placeholder, so a
refresh or a deep link lands in an inconsistent state.

### Source: `client/networkchains-web-app-nextjs-v1-invite-clone`

- `app/(admin)/` — 11 nav sections, ~8.9k lines including detail routes.
- `app/(admin)/layout.tsx` — tries `elevateAdmin()` silently, falls back to
  `AdminOtpGate`, then wraps children in `AdminShell` (its own sidebar).
- `components/admin/` — `admin-shell.tsx`, `admin-otp-gate.tsx`,
  `device-switch.tsx`, `product-switch.tsx`, and `axons/`, `sentry/`, `users/`
  subfolders.
- `lib/api/admin*.ts` — ~2.5k lines across `admin.ts`, `admin-axons.ts`,
  `admin-funnels.ts`, `admin-posthog.ts`, `admin-sentry.ts`, `admin-tickets.ts`.
  All call contacts-backend with a `nc_admin_token` bearer, deliberately separate
  from the user session token.

The 11 sections and their source routes:

| Section | Source route | Notes |
|---|---|---|
| Users | `/admin/users` (+ `[userId]`) | table page; detail is 1402 lines |
| EarnGPT | `/admin/earngpt-learning` | table page |
| Offerings | `/admin/offerings` | table page |
| Aixons | `/admin/axons` (+ `[axonId]`) | table page; detail 555 lines |
| Catch Up | `/admin/meet` | bespoke, 1082 lines |
| Live Calls | `/admin/meet/live` | bespoke, 1538 lines |
| Revenue | `/admin/subscriptions` | heaviest table page, 472 lines |
| Funnels | `/admin/funnels` (+ `[id]`) | pulls in `funnel-studio` |
| AI Cost | `/admin/ai-cost` | bespoke, no table |
| Sentry | `/admin/sentry` (+ `[issueId]`) | table page |
| Replays | `/admin/posthog` | bespoke |

## Key findings that shaped this design

### 1. The two backends share a JWT secret and a database

Verified from local `.env` files, which mirror prod:

- `garagenew-backend` and `contacts-backend` use the **same** `JWT_SECRET`.
- Both point at the **same** MongoDB: `starfish-db-blr1-...ondigitalocean.com/roam-admin-prod`.

This means contacts-backend can verify a `garage_admin_token` signature *and*
look the admin up in the `garageadmins` collection directly. Silent elevation can
therefore do a real DB re-check rather than trusting a JWT claim — matching the
stated intent of the existing `/admin/auth/elevate`, whose comment says it checks
"that user's CURRENT email (DB lookup, not the JWT claim)".

The garage admin JWT payload already carries what is needed:
`{ garageAdminId, role, email }` (`garageAdmin.controller.ts:277`).

### 2. Garage's `DataTable` is a superset already built to host the NC look

The two `components/data-table/` stacks have diverged — garage's `DataTable.tsx`
is 935 lines vs NC's 650, and garage's `types.ts` is 149 lines vs NC's 74 — but
they are the same lineage (identical
`table-fixed border-separate border-spacing-0 text-[13px]` shell, the same
`#FFC200` accent, the same sort menu, the same `rangeLabel` footer).

Garage's version was written with NC as its reference default. From its own prop
docs:

- `stickyBg` — *"Defaults to NC's near-black"*
- `borderColor` — *"Defaults to NC's grey"*
- `topBar?: ReactNode` — *"The whole top control bar (view selector + search + actions). Page-supplied."*
- `onColumnFilter` — *"Only used by tables that drive their own filter UI (NC Subs opens a drawer)."*

It also already has controlled `filters` / `onFiltersChange`, `selectable`,
`selectedIds`, `onToggleRow`, `onToggleAll`, and `footerTotals`.

**Consequence:** the requirement "keep the NetworkChains admin panel looking
exactly as it does today" is satisfied by garage's `DataTable` *defaults*. The
only genuine visual gap is right-pinned columns.

### 3. `NEXT_PUBLIC_API_URL` means different things in the two apps

| App | `NEXT_PUBLIC_API_URL` resolves to |
|---|---|
| NetworkChains web | contacts-backend (`https://backend.networkchains.com`) |
| Garage web | garagenew-backend (`http://localhost:4000` in dev) |

NC's `lib/api/admin.ts:14` reads `NEXT_PUBLIC_API_URL`. Porting it verbatim would
send every NC admin request to the Garage backend and 404 silently. The ported
clients must read a distinct variable.

**Unrelated pre-existing bug, noted not fixed:** five office hooks in
garage-web-app (`hooks/office/useHostControls.ts`, `useAccessControl.ts`,
`useVoiceMemos.ts`, `useRecording.ts`, `useConferenceRecordings.ts` and
`components/office/MeetHeader.tsx`) use
`process.env.NEXT_PUBLIC_API_URL ?? 'https://backend.networkchains.com'`. Because
`NEXT_PUBLIC_API_URL` *is* set in this app, that fallback is dead and those hooks
hit the Garage backend. `lib/office-api.ts` uses the correct
`NEXT_PUBLIC_OFFICE_API_URL`. This is out of scope for this work but should be
raised separately.

## Design

### Routing

NC pages get real routes under the existing admin dashboard group:

```
app/garage-admin/(admin-dashboard)/networkchains/
  users/page.tsx
  users/[userId]/page.tsx
  earngpt-learning/page.tsx
  offerings/page.tsx
  axons/page.tsx
  axons/[axonId]/page.tsx
  meet/page.tsx
  meet/live/page.tsx
  subscriptions/page.tsx
  funnels/page.tsx
  funnels/[id]/page.tsx
  ai-cost/page.tsx
  sentry/page.tsx
  sentry/[issueId]/page.tsx
  posthog/page.tsx
```

Selecting "NetworkChains" in the `TypeSheet` sets the persisted type **and**
pushes the first leaf of `NC_GROUPS` — derived from the nav model rather than
hardcoded, so it stays correct while Phase 1 ships only two pages. Selecting
"Admin" from an `/garage-admin/networkchains/*` route pushes back to
`/garage-admin/dashboard`. Landing directly on an `/garage-admin/networkchains/*`
URL forces `selectedDashboard = "networkchains"` on mount, so a deep link is
self-consistent without relying on `localStorage`.

`/garage-admin/networkchains` itself redirects to that same first leaf.

### Auth: silent elevation

New endpoint in `server/contacts-backend/src/routes/admin-auth.ts`, mounted at
`POST /admin/auth/elevate-garage`. It does **not** use `requireAuth` (that
middleware demands `userId` + `orgId`, which a garage admin token does not carry).
Instead:

1. Read the bearer token; `jwt.verify` with `env.JWT_SECRET`.
2. Require a `garageAdminId` claim; reject otherwise.
3. Look up that id in the `garageadmins` collection (same DB). Require the record
   to exist, be `isActive`, and have `role === "garage-super-admin"`.
4. Require the record's **current** email to be in `superAdminEmails()` — the same
   allowlist gating the OTP flow.
5. Mint `jwt.sign({ admin: true, email }, env.JWT_SECRET, { expiresIn: "2h" })` —
   byte-identical in shape to what `/elevate` returns.
6. Emit the same PostHog audit event shape as the other admin-auth routes.

This grants no privilege that an allowlisted super admin does not already hold via
`/elevate` or the OTP flow; it only accepts a different proof of identity. It is
the one non-frontend piece of this work and must ship before Phase 1 functions
end-to-end.

Contacts-backend needs a read-only Mongoose model for `garageadmins` (id, email,
role, isActive). It must not write to that collection.

Frontend: `lib/nc-admin-api/auth.ts` in garage-web-app exposes
`ensureNcAdminToken()` — returns a cached `nc_admin_token` from `localStorage`, or
POSTs `garage_admin_token` to `/admin/auth/elevate-garage` and caches the result.
On any `401` from an NC admin call, clear `nc_admin_token`, re-elevate once, and
retry. If re-elevation fails, render a "not authorised for NetworkChains admin"
panel — never an OTP gate. `admin-otp-gate.tsx` is not ported.

Because the NC hooks gate on `enabled: tokenPresent` and elevation is async, the
NC section needs its own layout at
`app/garage-admin/(admin-dashboard)/networkchains/layout.tsx` that blocks on
`ensureNcAdminToken()` and renders a spinner until it resolves — the same shape as
NC's `app/(admin)/layout.tsx` minus the OTP branch. NC pages that today respond to
`AdminUnauthorizedError` with `clearAdminToken()` + `window.location.reload()`
must instead re-elevate through this layout; a reload would bounce the admin out
of the Garage shell.

**React Query is not mounted app-wide in garage-web-app.** There is no root
`QueryClientProvider` — the app uses scoped providers per ported feature
(`components/downline/downline-query-provider.tsx`,
`components/vaults/vaults-query-provider.tsx`). Every NC admin page is built on
`useQuery`, so the NC layout also mounts an `NcAdminQueryProvider` following that
same established pattern.

### Chrome

- `DASHBOARD_TYPES` entry `networkchains` flips to `ready: true`.
- The layout picks its nav group set from `selectedDashboard`: the existing
  `allGroups` for `admin`, a new `NC_GROUPS` for `networkchains`.
- `NC_GROUPS` reuses `NavGroupModel` so the accordion, collapsed rail, hover
  flyouts, active-pill styling, and persisted open-group state all work unchanged.
- **`NC_GROUPS` is a single group**, keyed `networkchains`, titled "NetworkChains",
  holding all 11 leaves in NC's existing order (Users, EarnGPT, Offerings, Aixons,
  Catch Up, Live Calls, Revenue, Funnels, AI Cost, Sentry, Replays). NC's own
  sidebar is a flat list, so one always-expanded group is the arrangement closest
  to "the look stays as it is" — carving the 11 into thematic sub-groups would be
  a redesign, not a port. It can be split later if the list proves unwieldy.
- NC leaves are `superOnly: true`. NC admin has no per-page permission catalogue
  and the elevation endpoint already requires `garage-super-admin`, so a
  non-super-admin must never see the group. `canSeeLeaf` already returns false for
  `superOnly` leaves when `isSuperAdmin` is false, and `groups` drops
  now-empty groups — so a non-super-admin sees no NC nav without further work.
- The header brand already renders `selectedMeta.label`, so it reads
  "NetworkChains" with no change.
- `AdminShell` and `admin-otp-gate` are **not** ported. `DashboardComingSoon` stays
  for `support` and `fulfillment`.

### Dependencies

Ported into garage-web-app:

| From NC | To garage | Notes |
|---|---|---|
| `lib/api/admin*.ts` (6 files) | `lib/nc-admin-api/` | base URL switched to `NEXT_PUBLIC_NC_API_URL`; token helpers replaced by `ensureNcAdminToken()` |
| `components/admin/{axons,sentry,users}/` | `components/nc-admin/` | verbatim |
| `components/admin/{device-switch,product-switch}.tsx` | `components/nc-admin/` | verbatim |
| `components/data-table/{TableTopBar,ExportPanel,FilterDrawer,SelectionBar,AppliedFilterChips}.tsx` | `components/data-table/` | these are `topBar` slot content, not table internals |
| `components/funnel-studio/`, `lib/funnel-tree.ts`, `lib/api/funnels.ts` | same paths | Phase 2, Funnels only |
| `components/icons/platform-logos`, `components/layout/nav-icons`, `components/page-transition`, `components/ui/confirm-dialog`, `lib/admin/product`, `lib/utils/format`, `lib/hooks/use-debounced-value`, `lib/hooks/use-admin-funnels`, `lib/hooks/use-admin-usage` | same paths | absent from garage today |

Already present in garage, reused as-is: `components/data-table/DataTable`,
`components/affiliate/globe/*`, `components/ui/{badge,button,dialog,input,skeleton}`,
`lib/utils`, `lib/auth`.

NC's `AppliedFilterChips.tsx` **is** ported. Garage's `DataTable` renders its own
chips row, but only from the `filters` prop; NC pages drive their filters through
`onColumnFilter` + a `FilterDrawer` and render `<AppliedFilterChips>` themselves
*inside* the `topBar` slot. Since they never pass `filters`, garage's internal
chips row stays empty and there is no double render. Verified against
`app/(admin)/admin/subscriptions/page.tsx:359-415`.

### DataTable changes required for visual parity

Garage's `DataTable` carries NC's *colours* as defaults (`stickyBg = "#0b0b0b"`,
`borderColor = "rgba(255,255,255,0.06)"`) but not its *metrics*. Two hardcoded
constants differ and both are visible at a glance:

| | NC | Garage |
|---|---|---|
| Row height | auto (`py-3.5`, ~45px) | `ROW_H = 95` fixed |
| Header height | `h-12` (48px) | `h-[45px]` |
| Right-pinned columns | `frozen: "right"` supported | not supported |

Garage's 95px rows exist for its own tables' avatar-plus-multi-line-money cells.
Rendering NC's compact tables at 95px would be an obvious regression against the
"look stays as it is" requirement, so three additive changes are needed:

1. **`frozen: "right"`.** `types.ts`: widen `frozen?: boolean` to
   `frozen?: boolean | "left" | "right"`, `true` continuing to mean `"left"`.
   `DataTable.tsx`: port NC's `stickyRight` offset map (trailing-contiguous only)
   and thread it through the header `<th>` and `RowInner` `<td>` alongside the
   existing `stickyLeft`.
2. **`rowHeight?: number | "auto"`**, defaulting to `95`. NC pages pass `"auto"`,
   which drops the `height` style and lets `py-3.5` size the row, matching NC
   exactly.
3. **`headerHeight?: number`**, defaulting to `45`. NC pages pass `48`.

All three default to today's garage behaviour, and every existing garage caller
passes `frozen: true` or omits it — so no currently shipping table changes.

Also reconcile `PaginationProps.recordsPerPage`, which is required in garage and
optional in NC — ported pages must supply it.

## Phasing

### Phase 1 — thin slice

Proves every mechanism before the bulk lands.

1. `POST /admin/auth/elevate-garage` on contacts-backend + read-only garage-admin model.
2. `lib/nc-admin-api/auth.ts` with `ensureNcAdminToken()` + 401 retry.
3. `NEXT_PUBLIC_NC_API_URL` wired, defaulting to `https://backend.networkchains.com`.
4. Routing: `networkchains` → `ready: true`, `NC_GROUPS`, TypeSheet navigation,
   deep-link type sync. In Phase 1 `NC_GROUPS` lists only the two ported leaves
   (AI Cost, Revenue) — an unported leaf must not appear and 404. Phase 2 adds the
   remaining nine as each lands.
5. `frozen: "right"` in garage's DataTable.
6. **AI Cost** (`/garage-admin/networkchains/ai-cost`) — bespoke layout, no table:
   isolates the auth path.
7. **Revenue** (`/garage-admin/networkchains/subscriptions`) — the only page using
   all of `TableTopBar` + `FilterDrawer` + `SelectionBar` + `ExportPanel` + chips:
   isolates the table path.

If the auth or table assumptions are wrong, they fail here rather than nine pages later.

### Phase 2 — remaining nine sections

Users (+ detail), Aixons (+ detail), Catch Up, Live Calls, Offerings, EarnGPT
Learning, Funnels (+ detail), Sentry (+ detail), Replays. Funnels is sequenced last
— it drags in `funnel-studio` and the funnel enum/field mirror that must stay in
step across sites.

## Testing

**Available infrastructure.** contacts-backend has a test runner:
`npm test` → `node --import tsx --test 'src/**/*.test.ts'` (Node's built-in
runner, `node:test` + `assert/strict`, tests colocated in `src/`, models stubbed
rather than hitting Mongo — see `test/security/synapse-idor.test.ts` for the
house `stub()` pattern). **garage-web-app has no test framework at all** — its only
scripts are `dev`, `build`, `start`, `lint`. Introducing one is out of scope for
this port, so frontend verification is `npx tsc --noEmit`, `npm run lint`,
`npm run build`, and screenshot comparison against the live NC panel. Backend work
is genuinely test-driven; frontend work is not, and the plan says so rather than
pretending otherwise.

- **Elevation endpoint** — unit tests in contacts-backend: valid garage
  super-admin token → 200 + a token that `/admin/usage` accepts; non-super-admin
  role → 403; allowlisted role but email absent from `SUPER_ADMIN_EMAILS` → 403;
  inactive admin record → 403; token signed with a wrong secret → 401; token with
  `userId` but no `garageAdminId` → 401.
- **Token lifecycle** — a forced `401` from an NC admin call clears
  `nc_admin_token`, re-elevates once, and retries; a second failure renders the
  not-authorised panel and does not loop.
- **Routing** — deep-linking `/garage-admin/networkchains/ai-cost` in a fresh
  browser (empty `localStorage`) renders the NC dashboard with NC nav, not the
  Admin one; switching to Admin and back preserves position.
- **Permissions** — a `garage-admin` (non-super) sees no NetworkChains nav group
  and gets the not-authorised panel on a direct NC URL.
- **Visual parity** — each ported page screenshot-compared against the same page
  on `networkchains.com/admin`. This is the acceptance bar for the port, per the
  "look stays as it is" requirement.
- **Regression** — existing garage admin tables (One Time Affiliates, NetworkChain
  Subs, Users, founder Live Streams) render unchanged after the `frozen` widening.

## Risks

1. **New production auth surface.** `/admin/auth/elevate-garage` is real auth code
   on a live backend. Mitigated by mirroring the existing `/elevate` gate exactly
   (DB lookup + allowlist), granting no new privilege, and unit-testing the
   rejection paths.
2. **Two front doors to the same admin API.** Intentional per the product
   decision. No data migration, but changes to contacts-backend admin endpoints now
   affect two UIs until cutover.
3. **`funnel-studio` drag.** Funnels pulls the largest dependency subtree and
   touches the cross-site funnel enum/field mirror. Sequenced last in Phase 2 so it
   cannot block the rest.
4. **Silent divergence between the two panels.** Once ported, the NC-app copy and
   the Garage copy of these pages can drift. Accepted for now; resolved by the
   later cutover that deletes the NC-app copy.
