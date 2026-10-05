# `server/bat246/models/bat246CardPermission.model.ts`

> Mongoose model and key list for per-card admin grants: lets a specific user administer one BAT246 Admin dashboard card without full owner access.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 44

## Purpose
The BAT246 admin back-office (`/games/bat246/...`) is a grid of "cards" (Boards, Members, Distributors, and so on). Full access is reserved for the owner account (`ALAN_K_EMAIL` in `bat246Permission.service.ts`). This model stores narrower grants, one document per (user, card) pair. `bat246Permission.service.ts` checks them and `bat246Permission.routes.ts` exposes the owner-only API to grant and revoke them.

## How it works
- `BAT246_CARD_KEYS` is the closed list of card keys: `boards`, `members`, `distributors`, `documentation`, `lostmoney`, `inviteandplace`, `b2coinwallet`, `snapbackloans`. It is a `const` tuple, so the `Bat246CardKey` union type is derived from it.
- Schema fields (`timestamps: true`):
  - `userId` (→ `User`, required);
  - `cardKey` (enum `BAT246_CARD_KEYS`, required);
  - `grantedByEmail` (default `""`).
- A unique compound index `{ userId: 1, cardKey: 1 }` allows one grant per pair. The routes grant with an upsert (`findOneAndUpdate`), so granting twice is harmless, and revoke with `deleteOne`.

## Exports
- `BAT246_CARD_KEYS` - readonly tuple of valid card keys.
- `type Bat246CardKey` - union of those keys.
- `interface IBat246CardPermission` - `{ userId, cardKey, grantedByEmail, createdAt, updatedAt }`.
- `Bat246CardPermission` - Mongoose model registered as `"Bat246CardPermission"`.

## Interfaces
- **Database:** collection `bat246cardpermissions`.
  - Read by `isBat246CardAdmin()` and `getGrantedCardKeys()` in `bat246Permission.service.ts`.
  - Read and written by `server/bat246/routes/bat246Permission.routes.ts`, mounted at `/bat246/permissions` (browser: `/backend/bat246/permissions`). Its `GET /`, `POST /grant` and `POST /revoke` routes require `requireAuth` plus `requireAlanKOnly`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246Permission.routes.ts`
- `server/bat246/services/bat246Permission.service.ts`

## Notes
- To add a new admin card, extend `BAT246_CARD_KEYS`. Existing documents are unaffected, but the enum rejects any key that is not in the list.
- Unlike the other BAT246 models, the registered name is PascalCase (`"Bat246CardPermission"`). The collection name is still lower-cased and pluralised.
- Some access never appears in this collection. `bat246Permission.service.ts` defines `DEFAULT_ORG_CARD_KEYS` (`documentation`, `b2coinwallet`): any member of the BAT246 organisation gets those cards with no grant document. The owner account passes every check.
