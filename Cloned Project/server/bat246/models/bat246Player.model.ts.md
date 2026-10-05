# `server/bat246/models/bat246Player.model.ts`

> Mongoose model for a BAT246 player: the in-game identity linked to a Garage user, holding the player ID, membership and billing state, free-entry counters, separate minor- and major-league statistics, and permanent trophies.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 83

## Purpose
Board slots, movements and leaderboards all point to a player (`ref: "bat246Players"`), not directly to a `User`. This model is that game identity. It holds what persists across boards: career statistics, cards earned, leaderboard level, trophies, and the BAT246 membership subscription. `Bat246Distributor` holds the business and qualification side; `Bat246Distributor.playerId` links the two.

## How it works

### `LeagueStatsSchema` (`_id: false`), used for both `minorLeague` and `majorLeague`
- `totalEntries`, `timesAllStar`, `totalBCs`, `goldBCs`.
- `lbLevel`: `none | T | H | G`. T is Triple, H is Home Run, G is Grand Slam.
- `lbStats`: `{ triple, homeRun, grandSlam }`, counts per tier.
- `cardsEarned`: `{ gold, black, brown, gray, green, noCard, freeGray, gray160 }`. The two gray sub-types are kept separate so the leaderboard never merges them into one ×N stack. They mirror `freeGrayCards` and `grayCard160` on board slots.
- `totalEarnings`, `matchingBonuses`.
- `crossedHp` and `crossedHpAt`: whether the player has crossed Home Plate. `bat246Split.service.ts` sets them; the leaderboard tier rules in `bat246Leaderboard.service.ts` require `crossedHp = true`.
- `lbEarnings`: `{ triple, homeRun, grandSlam }`.

### `Bat246PlayerSchema` (`timestamps: true`)
- **Identity:**
  - `userId` (→ `User`, indexed);
  - `playerIdNo`: required and unique, in the form `2000HI`, `2001HI`, .... `createBat246Player()` in `bat246PlayerId.util.ts` issues it from the highest existing numeric id and retries on a duplicate-key error;
  - `nickname`, `email` (required), `role`, `memberSince`, `countryResidence`, `countryOrigin`.
- **Membership:**
  - `membershipActive` and `membershipExpiresAt`;
  - `membershipPlan`: `"trial" | "monthly" | null`. `null` means a legacy $20/year member or someone who never activated;
  - `membershipStartedAt`;
  - `nextBillingAt`: when `runDueMembershipBilling()` should next charge. For trial users it starts as the trial end date, then moves forward one month after each charge. Legacy members have `null` and are never billed.
- **Free entries:** `freeEntriesEarned`, `freeEntriesUsed`, `freeEntryInterval` (default 3).
- **Leagues:** `minorLeague` and `majorLeague`, each defaulting to an empty stats object.
- **`trophies`:** `{ T, H, G }`, each `null` or `{ earnedAt, boardId → bat246Boards, boardTrackingNo }`. A trophy is awarded once, the first time the player holds that leaderboard tier on any board, and is never removed, even after the leaderboard slot is vacated. `bat246Trophy.service.ts` awards them. `bat246Layaway.service.ts` uses them for eligibility: a G trophy gives a 300 cap in the "leaderboard" pool, H gives 200 and T gives 100.

## Exports
- `Bat246Player` - Mongoose model registered as `"bat246Players"`.

## Interfaces
- **Database:** collection `bat246players`. BAT246 services, controllers, routes, scripts and tests read and write it, as do `server/routes/invoice.ts` and `productCheckout.ts`.
- **Background work:** `server/index.ts` schedules the membership billing sweeper, which runs `runDueMembershipBilling()` one minute after boot and then every 6 hours. It picks up players whose `nextBillingAt` is due.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/bat246/__tests__/bat246Admin.service.test.ts`, `server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/routes/bat246Permission.routes.ts`, `server/bat246/scripts/addPlayersToOrg.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/fixMissingAB8Entry.ts`, `server/bat246/scripts/runSplitPhase2.ts`, `server/bat246/scripts/seedBat246.ts`, `server/bat246/scripts/seedLbDemo.ts`, `server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts`, `bat246BoardInvite.service.ts`, `bat246Entry.service.ts`, `bat246Layaway.service.ts`, `bat246Leaderboard.service.ts`, `bat246MembershipBilling.service.ts`, `bat246PlayerId.util.ts`, `bat246PodInvite.service.ts`, `bat246Split.service.ts`, `bat246Trophy.service.ts`, `bat246Wallet.util.ts`, `server/routes/invoice.ts`, `server/routes/productCheckout.ts`, `server/scripts/bat246-backfill-auto-placement.ts`, and 10 more.

## Notes
- The schema comment describes a "free 3-month window", but the code uses `MEMBERSHIP_TRIAL_MONTHS = 2` in `bat246MembershipBilling.service.ts`, and the sweeper comment in `server/index.ts` also says two months. The monthly fee is `MEMBERSHIP_MONTHLY_FEE = 12`.
- Create players through `createBat246Player()`, never with a count-based id. The util's header explains how deleted rows once caused `playerIdNo` collisions that blocked new signups.
- `userId` is not unique. Some code looks a player up with `findOne({ userId })`, so a duplicate player for one user can make lookups unpredictable.
