# `server/config/adminPages.ts`

> The garage-admin back-office permission system: the catalogue of grantable admin pages and actions, the URL-to-page rules the gate middleware enforces, and the role presets offered when inviting an admin.

**Kind:** backend config · **Lines:** 1083

## Purpose
A super admin can create admins with a free-text role ("Support Agent", "Finance", ...) and give that role a per-page access level. This file is the single source of truth for that system. The `GarageAdmin` and `GarageAdminRole` Mongoose schemas build their permission maps from `ADMIN_PAGES`; the gate middleware (`server/middleware/garageAdminAuth.ts`) resolves every request path through `resolveAdminPath`; the admin controller serves the catalogue and presets to the invite UI and sidebar. Adding a page means adding it to `ADMIN_PAGES` and adding a rule to `ADMIN_PATH_RULES`; nothing else needs changing.

The most important design rule is the **super-admin boundary**: anything only a super admin may do is never listed as a page, and the gate is **deny-by-default**. A path under a gated prefix that matches no rule requires super admin. New routes are therefore locked down until someone maps them, and super-admin powers cannot be granted away through the UI because no checkbox can express them.

## How it works

### Levels and actions (L28-L97)
- `ADMIN_PAGE_LEVELS = ["none", "view", "manage"]`: `none` hides the page; `view` allows reads (GET/HEAD/OPTIONS); `manage` allows writes (POST/PUT/PATCH/DELETE).
- Pages belong to a group for the sidebar/invite UI: citizens, money, garagepay, networkchains, others (`ADMIN_PAGE_GROUP_LABELS`).
- **Actions** (`AdminPageAction`): pages with more than one distinct kind of write declare independently grantable actions. A grant is stored in the same permission map under the key `"<pageKey>:<actionKey>"` (built by `actionKey()`) with value `none` or `manage`. Page-level `manage` is the superset and authorises every action on that page.
- `ONE_TIME_AFFILIATE_ACTIONS` (`assign-agent`, `mark-nvc`) is shared by One Time Affiliates and NetworkChain Subs, because both pages act on the same User fields.

### The page catalogue `ADMIN_PAGES` (L99-L450)
| Group | Page keys (actions in brackets) |
|---|---|
| Citizens | `users` [extend-offer, move-upline], `founders`, `stakeholders`, `organizations`, `org_kyc`, `categories` [edit-categories, delete-category], `affiliate_guests`, `one_time_affiliates` [assign-agent, mark-nvc], `networkchain_subs` [assign-agent, mark-nvc], `unilevel_plus_licenses` |
| Money | `store_wallets` (labelled "My Crypto Offices"), `founder_sub_bonus`, `cryptosub_bonus`, `whitelabel_bonus`, `addon_renewals`, `daily_reports` (read-only) |
| GaragePay | `platform_coupons` [edit-coupon, toggle-active, manage-assignments], `garage_coupons` [edit-coupons, delete-coupon], `coupon_rules` [edit-rules, delete-rule] |
| NetworkChains | `nc_users`, `nc_earngpt`, `nc_offerings`, `nc_axons`, `nc_catchup`, `nc_live_calls`, `nc_subscriptions`, `nc_funnels`, `nc_ai_cost`, `nc_sentry`, `nc_posthog` |
| Others | `support_tickets` [reply-ticket, set-status], `support_chats`, `otp_codes`, `phone_otp_codes`, `ai_providers` [add-key, delete-key], `coworking_spaces`, `coworking_bookings`, `admin_notifications` |

Each page may carry a sidebar `href` (e.g. `/garage-admin/users`) and a `manageHint` describing what manage unlocks. Notable comments:
- **NetworkChains pages:** the NC console talks to a separate contacts-backend that mints a single token for the whole NC surface, so granting any `nc_*` page unlocks elevation there. These levels decide what the console **shows**, not what that external API refuses.
- **OTP pages:** reading a live login code is enough to log in as that user, so these are view-only, off by default, every view is logged (`otp_code_access_logs`), and codes for admin accounts are hidden from non-super admins. The guards live per route in `routes/auth.ts`.
- `coworking_spaces` manage hint says writes stay super-admin only.
- `/garage-admin/third-party-clients` is deliberately absent: it is a founder surface, handled by `GATE_BYPASS_PATTERNS`.

### Permission-map helpers (L452-L604)
- `ADMIN_PAGE_KEYS` and `ADMIN_ACTION_KEYS` (all `"page:action"` keys) are the whitelists; `isAdminPageKey`, `isAdminActionKey`, `isAdminPageLevel` validate input.
- `emptyPagePermissions()` returns a fresh all-`none` map.
- `normalizePagePermissions(raw)` is how a stored map must always be read: `.lean()` queries skip schema defaults and old rows lack newer keys. It starts from all-`none`, copies valid page levels, and copies action keys only when granted (not `none`). `sanitizePagePermissions` is the same function, used on what a super admin submits so unknown keys are dropped.
- `LEGACY_ADMIN_PERMISSIONS`: what an admin row created before page RBAC is worth: view on `users`, `founders`, `stakeholders`, `organizations`, `unilevel_plus_licenses`, plus manage on `support_chats`. NC pages are intentionally left `none` so old rows do not silently gain the NetworkChains console. It is a separate constant from the "garage-admin" preset so editing the preset cannot reinterpret history.
- `resolvePagePermissions(raw, wasSet)` is the one function that decides what an admin holds. `wasSet` is `GarageAdmin.pagePermissionsSet`; when false, the legacy map applies. The flag is needed because Mongoose fills sub-document defaults on hydration, so a legacy row and a deliberately all-`none` row look identical.
- `levelSatisfies(held, required)`: `none` always passes; `view` needs view or manage; `manage` needs manage.
- `permissionsSatisfy(permissions, pages, level, action?)`: a read only checks page view. A write passes on page-level manage **or**, if the route names an action, on that action grant. Passing on **any** of the candidate pages is enough (some routes are shared by two pages). The gate, per-route guards and the frontend mirror this rule.
- `levelForMethod(method)`: GET/HEAD/OPTIONS -> `view`, everything else -> `manage`.

### Path classification lists (L606-L700)
- `PUBLIC_ADMIN_PATHS`: the login handshake (`/garage-admin/login`, `/request-otp`, `/ensure-admin`).
- `GATE_BYPASS_PATTERNS`: subtrees under a gated prefix that authenticate normal users instead of admins: `/garage-admin/third-party-clients` (requireAuth + requireFounder) and `/garage-admin/coworking-spaces/public` (member-facing list). Without this, users would get "Admin not found".
- `ALWAYS_ALLOWED_ADMIN_PATHS`: any authenticated admin may reach `/garage-admin/profile`, `/garage-admin/admin-pages` (the catalogue), `/garage-admin/upload` and `/garage-admin/support/my-assignments` (self-scoped Support Agent dashboard). `ALWAYS_ALLOWED_ADMIN_PATTERNS` is currently empty (Support Chats moved out of it to become a grantable page).
- `SUPER_ONLY_PATTERNS`, checked before page rules so they win: admin management (`/invite`, `/admins`, `/admin-roles`); danger zone (user/org delete-preview, `DELETE /users/:id`, `DELETE /organizations/:id`, `/users/:id/complete-profile`); `/organizations/:id/assign-admin`; saved cards (`/users/:id/saved-cards`) and `/orgs`; money out and wallets (`/withdrawals`, `/withdrawal-preferences`, `/user-wallets`, `/wallets`, `/platform-fee-overrides`, `/rank-bonus`, `/auction-settlements`). The comments state each is also guarded by `requireGarageSuperAdmin` in its own router; this list makes the boundary visible in one place. Assigning a support agent and viewing OTP codes used to be here and are now grantable.

### Path rules `ADMIN_PATH_RULES` (L702-L944)
An ordered list of `{ test, page, action?, methods? }`. First match wins, so specific rules precede broad ones; a rule with `methods` only applies to those verbs and otherwise falls through. Highlights:
- Shared cross-page user actions come first: `/users/:id/assign-agent` and `/networkchain-subs/:id/assign-agent` -> pages one_time_affiliates or networkchain_subs, action `assign-agent`; `/users/:id/nvc-chat` -> action `mark-nvc`; `/assignable-agents` -> readable by either page.
- `/users/:id/extend-offer` and `/users/:id/move-upline` -> `users` with their actions, above the broad `/users` rule.
- Citizens prefixes map to their pages. `/org-kyc` maps to `org_kyc` and is listed before `/organizations`; holding organizations does not grant KYC documents.
- Method-scoped deletes: `DELETE /categories/:id`, `/coupon-rules/:id`, `/coupons/:id` map to delete actions; other writes on those prefixes map to the edit actions (`/coupon-rule-items` counts as edit-rules).
- Platform coupons: `/:id/activate|deactivate` -> toggle-active; `/:id/assignments` and `/assignments/:id` -> manage-assignments; `/:id` and the collection root -> edit-coupon.
- Money: `/cryptobrand-offices` and `/store-wallets` -> store_wallets; the three monthly-bonus prefixes; `/whitelabel-addon/admin` and `/cryptosub-addon/admin` -> addon_renewals; `/daily-reports`.
- Others: `/support-chats`; `/tickets/support-board` -> support_chats or support_tickets (must precede the ticket rules); `/tickets/:id/messages` -> reply-ticket; `/tickets/:id` -> set-status; `/ai-providers/keys/:id` -> delete-key, `/ai-providers/keys` -> add-key; `/coworking-spaces`; `/coworking-bookings/admin`; `/garage-admin/notifications` -> admin_notifications; `/garage-admin/library-affiliate` -> nc_funnels (the one endpoint on this backend the NC funnel editor needs).

### `resolveAdminPath(path, method)` (L946-L1003)
Strips the query string and trailing slashes, then returns a verdict in this order: `public` (public paths and bypass patterns), `any-admin` (always-allowed), `super-only` (super-only patterns, respecting methods), `page` (first matching rule, with `pages`, `level` from the method, and optional `action`), and finally `super-only` for anything unmatched.

### Presets and reserved names (L1005-L1083)
`ADMIN_ROLE_PRESETS` are code constants the invite dialog offers as starting points (picking one stamps its levels; the super admin can then edit):
- `garage-admin` ("Admin"): view on the five legacy citizen pages.
- `support-agent`: manage support_tickets, view users and organizations.
- `finance`: manage the three coupon pages; view store_wallets, organizations, daily_reports. No payouts.
- `read-only`: view on every page.

`RESERVED_ROLE_NAMES` (`garage-super-admin`, `super admin`) cannot be typed as a role name; `isReservedRoleName` compares trimmed lower-case input.

## Exports
- Types: `AdminPageLevel`, `AdminPageGroup`, `AdminPageAction`, `AdminPage`, `AdminPathVerdict`, `AdminRolePreset`.
- Constants: `ADMIN_PAGE_LEVELS`, `ADMIN_PAGE_GROUP_LABELS`, `ADMIN_PAGES`, `ADMIN_PAGE_KEYS`, `ADMIN_ACTION_KEYS`, `LEGACY_ADMIN_PERMISSIONS`, `PUBLIC_ADMIN_PATHS`, `GATE_BYPASS_PATTERNS`, `ALWAYS_ALLOWED_ADMIN_PATTERNS`, `ALWAYS_ALLOWED_ADMIN_PATHS`, `SUPER_ONLY_PATTERNS`, `ADMIN_PATH_RULES`, `ADMIN_ROLE_PRESETS`, `RESERVED_ROLE_NAMES`.
- `actionKey(page, action): string` - `"page:action"` storage key.
- `isAdminPageKey(value): boolean`, `isAdminActionKey(value): boolean`, `isAdminPageLevel(value): value is AdminPageLevel`.
- `emptyPagePermissions()`, `normalizePagePermissions(raw)`, `sanitizePagePermissions(raw)`, `resolvePagePermissions(raw, wasSet)` - all return `Record<string, AdminPageLevel>`.
- `levelSatisfies(held, required): boolean`, `permissionsSatisfy(permissions, pages, level, action?): boolean`, `levelForMethod(method): AdminPageLevel`.
- `resolveAdminPath(path, method): AdminPathVerdict`.
- `isReservedRoleName(role): boolean`.

## Interfaces
- **Endpoints governed:** the gate is mounted in `server/app.ts` on `/garage-admin`, `/ai-providers`, `/coworking-bookings/admin`, `/whitelabel-addon/admin` and `/cryptosub-addon/admin` (browser: `/backend/...`). The middleware rebuilds the full path from `req.baseUrl + req.path`, which is why the rules are written as full paths. Super admins bypass page checks; a failed check returns 403 with "You have read-only access to this section" or "You do not have access to this section".
- **Endpoints using the catalogue:** `GET /backend/garage-admin/admin-pages` (any admin) returns the catalogue and presets via `garageAdmin.controller.ts`; `/backend/garage-admin/admin-roles` (super only) manages saved roles.
- **Database (schemas built from it):** `GarageAdmin` and `GarageAdminRole` permission sub-documents; `strict: false` lets the `"page:action"` keys be stored next to the fixed page fields.

## Dependencies
None (pure configuration and functions).

## Used by
- `server/middleware/garageAdminAuth.ts` - `garageAdminPageGate`, `requireAdminPage`, `requireAnyAdminPage`, `requireAdminAction`.
- `server/controllers/garageAdmin.controller.ts` - permission resolution, presets, reserved-name checks.
- `server/models/garageAdmin.model.ts`, `server/models/garageAdminRole.model.ts` - schema generation.

## Notes
- Order in `ADMIN_PATH_RULES` is load-bearing; a broad rule placed above a specific one silently changes which page/action authorises a route.
- New admin endpoints are super-admin only until mapped here; if a delegated admin unexpectedly gets "Super admin access required", a missing rule is the likely cause.
- The frontend mirrors `permissionsSatisfy`; changing the rule here requires the same change on the frontend.
- The comment block above `GATE_BYPASS_PATTERNS` contains a leftover doc comment meant for `ALWAYS_ALLOWED_ADMIN_PATHS` (two consecutive JSDoc blocks).
