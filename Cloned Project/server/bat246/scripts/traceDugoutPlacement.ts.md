# `server/bat246/scripts/traceDugoutPlacement.ts`

> Read-only diagnostic script that, for two hard-coded user emails, prints where their BAT246 player sits on every board and which checkout invoices carried BAT246 placement parameters.

**Kind:** backend one-off script (read-only, connects to the production DB) · **Lines:** 77

## Purpose
Written to investigate why two specific buyers ended up in a board's dugout (or another unexpected position). It connects the chain User -> `Bat246Player` -> board slot -> invoice metadata, so you can see who the slot says referred them and which `bat246*` parameters the checkout actually recorded.

## How it works
- `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.** Uses the raw driver only; nothing is written.
- `EMAILS` (L6) holds two real customer email addresses. For each:
  1. `users.findOne({ email })` - prints `_id`, `name`, `referredBy`.
  2. `bat246players.findOne({ userId })` - prints `_id`, `playerIdNo`, `nickname`.
  3. `bat246boards.find(...)` with an `$or` over every slot path that can hold a player: `homePlate`, `thirdBase`, `secondBaseA`, `secondBaseB`, `firstBase`, `atBat`, `dugout`, `onDeckCircle` (each `.playerId`). For each board a local `findSlot` helper locates the exact slot (with array index) and prints the position plus the slot's `referredBy`, `referredByName` and `enteredAt`.
  4. `invoices.find({ userId }).sort({ createdAt: -1 }).limit(10)`, then keeps invoices whose `metadata.type` is `"product_checkout"` or whose metadata has any of `bat246Pos`, `bat246GenRef`, `bat246UpperRef`, `bat246DugoutRef`, `bat246Ref`, and prints `_id`, `status`, `createdAt`, `itemType` and the full `metadata`.
- Disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:** collections `users`, `bat246players`, `bat246boards`, `invoices` - read only.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Packages:** `mongoose` (raw collection access), `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/traceDugoutPlacement.ts`.

## Notes
- The output contains customers' personal data (names, emails, invoice metadata); do not paste it into shared channels.
- Useful as a template: the invoice-metadata keys it checks are the BAT246 placement/referral parameters that checkout forwards to the backend (compare `fixMissingAB8Entry.ts`, which repairs a case where `bat246GenRef` was not forwarded).
