# `server/bat246/scripts/seedBat246.ts`

> Destructive seed script that **wipes the core BAT246 collections** and replaces them with a hand-built demo: one split root board, its left and right child boards, 20 fictional players, their memberships and Green Card (sales credit) ledger, plus the BAT246 entry product.

**Kind:** backend one-off script (wipes and writes production data) · **Lines:** 566

## Purpose
The seed recreates, in data, the reference split scenario described in the game's rules document (the header calls it `BOARD_RULES.md`): Board 1 splits at the moment "Patrick S." on 1st Base D earns his second Green Card, producing Board 2 (Left) and Board 3 (Right) according to the split movement map. It was written so the board UI, lobby, hot box and leaderboard could be developed and demonstrated against a known, consistent state. Because it begins with `deleteMany({})`, running it against `MONGODB_URI`, which in this project is the **production database**, destroys the live game's boards, players, memberships, config and sales-credit ledger.

## How it works

### 1. Connect and wipe (L19-L36)
- `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`).
- Runs `deleteMany({})` in parallel on `Bat246Config`, `Bat246Board`, `Bat246Player`, `Bat246PlayerBoard` and `Bat246SalesCredit`. Other BAT246 collections (movements, distributors, free entries, recruitments, snap-back loans, top ten and so on) are **not** cleared, so they can be left pointing at deleted boards and players.
- Creates a fresh config: `boardCounter: 3`, `familyCounter: 1`, `familySequences: { "1": 102 }` (family 1 used sequence 100 for the root, 101 and 102 for the two children).
- Fixed dates: `splitAt = 2026-05-19T10:00Z`; Board 1 PP end `2026-05-23T05:01Z`; children's PP end `2026-05-24T10:00Z` (split time + 120 h). The root's PP was deliberately still open when the split fired.

### 2. Players (L43-L147)
- `insertMany` of 20 `Bat246Player` docs, `playerIdNo` `1001HI` to `1020HI`, with nickname, a placeholder `@gmail.com` email, `memberSince: 2024-01-01`, and `countryResidence`/`countryOrigin` codes. None has a `userId`, so they are not linked to any Garage user.
- A helper `p(email)` fetches each one into a local variable.
- Per-player `updateOne` calls set `minorLeague.totalEntries` to reflect how many boards each has been on across the scenario (2, 3 or 4). Two players get leaderboard stats:
  - Shorupan P.: `totalBCs: 5`, `goldBCs: 2`, `lbLevel: "H"`, `totalEarnings: 14200`, `cardsEarned` gold 2 / black 1 / brown 1 / green 1 (Home Run tier).
  - Alan M.: `totalBCs: 3`, `goldBCs: 1`, `lbLevel: "T"`, `totalEarnings: 5300`, `cardsEarned` gold 1 / black 1 / green 1 (Triple tier).

### 3. Board 1 - root, `status: "split"` (L149-L236)
`boardNumber: 1`, `trackingNumber: "1-100"`, `title: "1 of 4 Board Basics"`, `generation: 0`, `familyNumber: 1`, `warpCount: 4`, `minorLeagueAmount: 600`, `splitAt`.
- **Home Plate** Jeff D. (Brown), **3rd Base** Nina O. (Black), **2nd Base A/B** Kevin L. / Mike N. (Black).
- **1st Base A-D** Shorupan, Alan, Bill, Patrick: all `cardType: "Gold"`, `salesCredits: 2`, `warpStatus: 2` - every 1st-base player has completed two Green Cards, which is the split condition.
- **AT BAT** 8 players (Alice ... Grace, and Liam at AB8 with `referredBy: Patrick`, the referral that triggered the split).
- **Dugout** Oscar, Pam, Quinn and an overflow entry Sam (referred by Alice), each with `referredBy`.
- **hotBox**: one current holder per card type (Gold Alan, Black Mike, Brown Jeff).
- **leaderBoard**: rows for tiers `G` (empty), `H` (Shorupan), `T` (Alan).
- `penciling`, `prePick`, `onDeckCircle` empty.

### 4. Board 2 - Left child (L238-L316)
`boardNumber: 2`, `trackingNumber: "1-101 L"`, `side: "left"`, `generation: 1`, `parentBoardId: board1`, `status: "active"`, PP end = child PP.
Follows the left half of the split map in the comments: old 3rd -> HP (Nina), old 2nd A -> 3rd (Kevin), old 1st A/B -> 2nd A/B (Shorupan, Alan), old AB1-AB4 -> 1st A-D (Alice with 1 Green Card, Bob, Carol, Dan). Sam is at AB1 (followed his referrer Alice to the left side via on-deck), the remaining seven AT BAT slots are `null`, Oscar is in the dugout. Every moved slot gets `enteredAt: splitAt` and an `entryNo` one higher than on Board 1, while `joinedBoardAt` keeps the original join time.

### 5. Board 3 - Right child (L318-L397)
`boardNumber: 3`, `trackingNumber: "1-102 R"`, `side: "right"`. Right half of the map: Nina again at HP (the old 3rd-base player is duplicated onto both children), old 2nd B -> 3rd (Mike), old 1st C/D -> 2nd A/B (Bill, Patrick), old AB5-AB8 -> 1st A-D (Eve, Frank, Grace, Liam). All eight AT BAT slots `null`, Pam in the dugout and Quinn in the on-deck circle.

Afterwards Board 1 gets `leftChildBoardId` / `rightChildBoardId` (L399-L402).

### 6. Memberships (L404-L475)
`Bat246PlayerBoard.insertMany` for each board with positions in the game's string form (`homePlate`, `firstBase.A`, `atBat.0`, `dugout.3`, `onDeckCircle.0`, ...):
- Board 1: 20 rows, `status: "left"`, `joinedAt: now`, `leftAt: splitAt`.
- Board 2 and Board 3: 10 rows each, `status: "active"`, `joinedAt: splitAt`.

### 7. Green Card ledger (L477-L500)
Ten `Bat246SalesCredit` rows, all `cardType: "Gold"`, `countsForLB: true`, `saleAmount: 650`: two each for the four Board 1 first-base players (Patrick's second at 09:58Z marked as the split trigger), one for Alice at Board 1 `atBat.0`, and one for Alice at Board 2 `firstBase.A` (her recruit Sam).

### 8. Entry product (L502-L547)
Wrapped in `try/catch` so a failure only logs a warning:
- `require`s `Organization` and `User`; picks the first user whose `role` is `admin`, `founder` or `superAdmin`; the org is `process.env.BAT246_ORG_ID`, else `admin.organizationId`, else the first organisation in the collection.
- If no product tagged `bat246_entry` exists, creates "Bat246 Board Entry" (`slug: "bat246-board-entry"`, `sku: "BAT246-ENTRY-001"`, `price: 1`, `currency: "USD"`, digital, `status: "active"`, `tags: ["bat246_entry"]`).
- Sets `inviteProductId` on **all** boards to that product.

### 9. Summary (L549-L559)
Prints the three board ids and tracking numbers and explains that the lobby shows Boards 2 and 3 while Board 1 is reachable by direct URL. Disconnects; errors exit with code 1.

## Exports
None. Top-level `seed()` executes on load.

## Interfaces
- **Database:**
  - `Bat246Config` (collection `bat246configs`) - delete all, create one.
  - `Bat246Board` (collection `bat246boards`) - delete all, create 3, update.
  - `Bat246Player` (collection `bat246players`) - delete all, insert 20, update.
  - `Bat246PlayerBoard` (collection `bat246playerboards`) - delete all, insert 40.
  - `Bat246SalesCredit` (collection `bat246salescredits`) - delete all, insert 10.
  - `Product` (collection `products`) - read; maybe create the entry product.
  - `User`, `Organization` - read only, to choose `createdBy` and the org.
- **Environment variables:** `MONGODB_URI` - connection string (production); `BAT246_ORG_ID` - optional org for the entry product.

## Dependencies
- **Internal:** `server/bat246/models/bat246Config.model.ts`, `bat246Board.model.ts`, `bat246Player.model.ts`, `bat246PlayerBoard.model.ts`, `bat246SalesCredit.model.ts` - game collections; `server/models/product.model.ts` - entry product; `server/models/organization.model.ts`, `server/models/user.model.ts` - loaded with `require` inside the product step.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/seedBat246.ts` (header shows the old `src/...` ts-node path). `seedLbDemo.ts` targets the three tracking numbers this seed creates.

## Notes
- **Never run against production.** There is no confirmation, environment check or dry-run; the first thing it does is delete the live game data. Take a backup first (see `backupAndWipeBat246.ts`, or better a `mongodump`).
- The `User` schema has no `organizationId` field, so `admin?.organizationId` is normally undefined; without `BAT246_ORG_ID` the product goes to whichever organisation `Organization.findOne()` returns first.
- The demo players use placeholder `@gmail.com` addresses that may belong to real people; they are only stored, never emailed by this script.
- Membership positions are zero-based (`atBat.7` is the slot the comments call AB8).
- Values here encode the game rules of the time (split map, card types, LB tiers). If the rules change, this seed becomes a misleading fixture rather than a reference.
