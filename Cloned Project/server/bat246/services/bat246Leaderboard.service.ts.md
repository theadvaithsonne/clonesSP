# `server/bat246/services/bat246Leaderboard.service.ts`

> BAT246 per-board Leaderboard: pays the Triple / Home Run / Grand Slam slot holders on every new board entry, and assigns those slots on a freshly split child board through a tier-promotion cascade.

**Kind:** BAT246 game module (backend) - service · **Lines:** 220

## Purpose
Every BAT246 board carries a three-row `leaderBoard` (one slot each for tiers `G` Grand Slam, `H` Home Run, `T` Triple). Players in those slots receive a bonus from every subsequent sale on that board, which reduces Alan K's (root Home Plate's) share of the $650/$160 sale. This file holds both halves: who gets the slots (`assignLbSlots`) and paying them (`payLbHolders`).

## How it works

### Tier table (L24-L29)
| Tier | Per entry | Lifetime cap | Player field |
|---|---|---|---|
| `T` Triple | $100 | $50,000 | `minorLeague.lbEarnings.triple` |
| `H` Home Run | $200 | $100,000 | `minorLeague.lbEarnings.homeRun` |
| `G` Grand Slam | $300 | $300,000 | `minorLeague.lbEarnings.grandSlam` |

Card requirements (`meetsTierCards`), using `minorLeague.cardsEarned`: at least 1 Gold is mandatory; `G` needs 7+ total cards, `H` 5+ total, `T` 2+ Green. "Total" is gold + black + brown + green; Gray cards do not count.

### `payLbHolders(boardId)` (L37-L98)
For each occupied leaderboard row: if the player already reached the tier's lifetime cap, the slot is vacated (player, `qualifiedAt` and `earningsOnBoard` reset) and nothing is paid. Otherwise it pays `min(perEntry, cap - earned)` into the player's store wallet in the organization that owns the `bat246_entry` product (`directCreditStoreWallet`, note "Bat246 LB <tier> bonus (board <tracking>)"), then increments the player's lifetime `lbEarnings.<tier>` and the row's `earningsOnBoard`. Returns the total paid, which the caller subtracts from the root Home Plate credit. Returns 0 if the board has no leaderboard or the organization cannot be resolved.

### `assignLbSlots(boardId, graduatePlayerId)` (L126-L219)
Run once per child board right after a split, for the player who "crossed home plate" (the parent board's old Home Plate occupant):
1. The graduate's entry tier is the highest tier they qualify for by cards and are still under the cap for (`bestEligibleTier`, checked G -> H -> T). No tier means no change.
2. They take that slot. If it was empty, the chain stops.
3. If someone was there, that incumbent is checked for the next tier up (T -> H -> G). If they qualify and are under that cap they move up and displace that tier's occupant, and the check repeats. Otherwise, or when displaced from Grand Slam, they drop off this board's leaderboard.
Every placement resets `qualifiedAt` to now and `earningsOnBoard` to 0. Each new occupant then gets that tier's permanent trophy via `awardTrophy` (dynamic import, fire-and-forget, idempotent). The cascade only looks at this one board.

## Exports
- `payLbHolders(boardId: string): Promise<number>` - pay leaderboard holders for one entry; returns amount paid.
- `assignLbSlots(boardId: string, graduatePlayerId: string | Types.ObjectId): Promise<void>` - run the slot cascade for a new child board.

## Interfaces
- **Database:** `Bat246Board.leaderBoard` (read/write), `Bat246Player.minorLeague` (read, `lbEarnings` increment), `Product` (read, to find the BAT246 organization).
- **Background work:** trophy awards are fire-and-forget.

## Dependencies
- **Internal:** `server/bat246/models/bat246Board.model.ts`, `server/bat246/models/bat246Player.model.ts`; `./bat246Wallet.util` (`directCreditStoreWallet`); `./bat246Trophy.service` (`awardTrophy`, dynamic import); `server/models/product.model.ts` (lazy `require`).
- **Packages:** `mongoose` - `Types.ObjectId`.

## Used by
`server/bat246/services/bat246Entry.service.ts` (`payLbHolders`, inside `payLbAndCreditHp` on every purchase entry) and `server/bat246/services/bat246Split.service.ts` (`assignLbSlots` for both child boards after a split).

## Notes
- The header comment says every tier requires `crossedHp = true`; the code has no such check. Only players passed in as the split graduate ever enter a slot, which has the same effect in practice.
- `payLbHolders` is not transactional: the wallet credit happens before the earnings counters are incremented, so a failure in between could pay without recording it. Concurrent entries on the same board can both read the same `lbEarnings` and slightly exceed a cap.
- A slot is only vacated on the next entry after the cap is reached, never at the moment it is reached.
