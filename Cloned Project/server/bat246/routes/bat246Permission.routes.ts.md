# `server/bat246/routes/bat246Permission.routes.ts`

> Express router for the BAT246 admin Permissions page. Only the admin can grant and revoke per-card back-office access. It also serves a people × cards access matrix, and lets any user read their own grants.

**Kind:** BAT246 game module (backend) — Express router · **Lines:** 311 · **Mounted at:** `/bat246/permissions` (browser: `/backend/bat246/permissions`)

## Purpose
The BAT246 back office is split into "cards" (`BAT246_CARD_KEYS`): `boards`, `members`, `distributors`, `documentation`, `lostmoney`, `inviteandplace`, `b2coinwallet`, `snapbackloans`. The admin (`ALAN_K_EMAIL`) always has every card. Other people get access in three ways:
- **Explicit grants**, stored in `Bat246CardPermission`. This router manages them.
- **Organisation default:** every BAT246-office member gets `documentation` and `b2coinwallet` (`DEFAULT_ORG_CARD_KEYS`).
- **Legacy board position:** holding Home Plate, 3rd Base, 2nd Base A/B or 1st Base on any board grants `boards`, `members`, `distributors` and `inviteandplace` through the older `/games/bat246/dashboard` hub.

The other BAT246 routers check access with `isBat246CardAdmin` in `bat246Permission.service.ts`.

## How it works
- `requireAlanKOnly` returns 403 unless `req.user.email`, lower-cased, equals `ALAN_K_EMAIL`. Managing permissions can never itself be granted.
- `isValidCardKey(v)` checks a value against `BAT246_CARD_KEYS`.
- `scanLegacyDashboardUserIds()`:
  - Loads the Home Plate, 3rd Base, 2nd Base A/B and 1st Base slots of every board.
  - Collects their `playerId`s and maps them to Garage `userId`s through `Bat246Player`.
  - This is the reverse of `hasDashboardAccess()` in `bat246.routes.ts`.
- `LEGACY_OVERLAP_CARDS = ["boards", "members", "distributors", "inviteandplace"]`: the cards a board position grants.

Routes (all `requireAuth`; all except `/mine` also `requireAlanKOnly`):
- `GET /`: every grant, newest first, grouped by card as `byCard[cardKey] = [{_id, userId, name, email, grantedByEmail, createdAt}]`. Grants belonging to deleted users are skipped.
- `GET /search-users?q=`: up to 10 verified users in the BAT246 organisation (`BAT246_ORG_ID`), matched by name, email or phone (regex escaped).
- `POST /grant {userId, cardKey}`: validates both, returns 404 for an unknown user, and refuses to grant to the admin. Upserts `{userId, cardKey}` with `grantedByEmail`.
- `POST /revoke {userId, cardKey}`: `deleteOne`. Revoking a grant that does not exist still succeeds, so the call is safe to repeat.
- `GET /legacy-dashboard-access`: read-only list of people (`playerId`, `name`, `email` from the slot snapshot) who hold a qualifying board position. These cannot be revoked here.
- `GET /people-matrix`:
  - Rows are the BAT246-organisation members, plus anyone outside the organisation who has a grant or a legacy position. The admin is excluded.
  - For each card the row gets `{granted, legacy}`. `legacy` is true when the access comes from a board position (overlap cards) or from organisation membership (default cards). `granted = legacy || explicit grant`.
  - Rows are sorted by name or email.
- `POST /bulk-update {changes: [{userId, cardKey, granted}]}`:
  - Applies each change in order: upsert when `granted`, delete otherwise.
  - Malformed entries are skipped, and the admin as a target is skipped.
  - Legacy access is never touched; the grid shows those cells disabled.
- `GET /mine` (any signed-in user): `{ cardKeys: getGrantedCardKeys(userId) }`, which is explicit grants plus the organisation defaults. Used by the frontend to decide which back-office tiles to show.

## Exports
- `default` — the Express `Router`.

## Interfaces
- **Endpoints served:** `GET /`, `GET /search-users`, `POST /grant`, `POST /revoke`, `GET /legacy-dashboard-access`, `GET /people-matrix`, `POST /bulk-update`, `GET /mine`, all under `/backend/bat246/permissions`.
- **Database:**
  - `Bat246CardPermission`: read, upsert, delete.
  - `User`: read.
  - `Bat246Board` and `Bat246Player`: read, for the legacy-position scan.

## Dependencies
- **Internal:**
  - `server/bat246/models/bat246CardPermission.model.ts` (`Bat246CardPermission`, `BAT246_CARD_KEYS`, `Bat246CardKey`).
  - `server/bat246/services/bat246Permission.service.ts` (`ALAN_K_EMAIL`, `getGrantedCardKeys`, `DEFAULT_ORG_CARD_KEYS`).
  - `server/bat246/models/bat246Board.model.ts`, `server/bat246/models/bat246Player.model.ts`, `server/models/user.model.ts`, `server/middleware/auth.ts`.
- **Packages:** `express` (Router), `mongoose` (`Types.ObjectId`).

## Used by
- Mounted in `server/app.ts` with `app.use("/bat246/permissions", bat246PermissionRoutes)`.
- Frontend: `app/(dashboard)/games/bat246/permission/page.tsx` (the admin grid), `lib/hooks/useBat246CardAccess.ts` (`GET /mine`).

## Notes
- `/mine` does not include legacy board-position access. Legacy access is enforced separately, for example by `hasDashboardAccess()` in `bat246.routes.ts`.
- `bulk-update` writes each change in its own sequential query, with no transaction. A failure partway through leaves the earlier changes applied.
- `BAT246_ORG_ID` is hardcoded here and repeated in other BAT246 files.
