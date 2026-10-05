# `server/bat246/services/bat246Permission.service.ts`

> Decides who may use each BAT246 admin back-office card: Alan K always, BAT246-org members for a couple of default cards, and everyone else only with an explicit per-card grant.

**Kind:** BAT246 game module (backend) — service · **Lines:** 65

## Purpose
The BAT246 back-office is split into "cards" such as boards, members, distributors, documentation, lostmoney, inviteandplace, b2coinwallet and snapbackloans; the full list is `BAT246_CARD_KEYS` in `bat246CardPermission.model.ts`. This file holds the single check that BAT246 routes use to gate those cards. It also holds the helper that lists a user's granted cards for the permissions UI.

## How it works
- **Alan K.** A request whose email equals the hardcoded `ALAN_K_EMAIL`, compared case-insensitively, always passes.
- **Default cards.** `DEFAULT_ORG_CARD_KEYS = ["documentation", "b2coinwallet"]` are granted to anyone whose `User.organizations[].organization` includes the hardcoded BAT246 org id (`BAT246_ORG_ID`). The private helper `isBat246OrgMember()` performs that check.
- **Explicit grants.** For any other case there must be a `Bat246CardPermission` document `{ userId, cardKey }` matching at least one of the requested card keys. Routes that share authority, such as Distributors plus Invite and Place, pass several keys.
- **Listing a user's cards.** `getGrantedCardKeys()` merges the explicit grants with the default cards (when the user is an org member) and removes duplicates.

## Exports
- `ALAN_K_EMAIL` — the admin email constant, re-exported for `bat246Permission.routes.ts`.
- `DEFAULT_ORG_CARD_KEYS: Bat246CardKey[]` — cards every BAT246-office member gets automatically. `bat246Permission.routes.ts` uses this same list for its people matrix, so the two never drift apart.
- `isBat246CardAdmin(email, userId, ...cardKeys): Promise<boolean>` — true if the caller is Alan, or holds any of the given cards through an explicit grant or org membership. Returns false when there is no `userId` or no card keys.
- `getGrantedCardKeys(userId): Promise<Bat246CardKey[]>` — every card a non-Alan user currently holds.

## Interfaces
- **Database:** reads `Bat246CardPermission` (model `Bat246CardPermission`) and `User` (`organizations`).

## Dependencies
- **Internal:** `server/bat246/models/bat246CardPermission.model.ts` (the grant model and the `Bat246CardKey` type); `server/models/user.model.ts`.
- **Packages:** `mongoose` (`Types.ObjectId.isValid`).

## Used by
These route files, all mounted under `/bat246` in `server/app.ts` (browser path `/backend/bat246/...`):
- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/routes/bat246LostMoney.routes.ts`
- `server/bat246/routes/bat246Permission.routes.ts`
- `server/bat246/routes/bat246SnapBackLoan.routes.ts`

## Notes
- This file is security-sensitive: it is the authorization gate for admin functions.
- Admin identity is an email comparison, not a role flag. The comments say this is deliberate, and the same email and org-id constants are duplicated in other BAT246 files.
