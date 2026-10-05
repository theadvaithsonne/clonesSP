# `scripts/migrate-nc-wallets-to-store-vault.ts`

> One-shot money migration that moves NetworkChain users' local wallet balances (in NC's own database) into their Garage `StoreWallet` ("Store Vault") for the NC organisation, with a dry-run default.

**Kind:** backend helper/test script (writes to two databases, one of them Garage production) · **Lines:** 154

## Purpose
NetworkChains ran its own `wallets` collection (balance and debt in cents) in a separate database (the "contacts-backend"). At the cutover, NC users were meant to see their credit in Garage's Store Vault instead of NC's `/wallet` page. This script reads every NC wallet with a positive balance, credits the same dollar amount to the user's Garage store wallet for the NC org, and (by default) zeroes the NC wallet so the money does not show twice. It is run by hand and imported by nothing.

## How it works
**Configuration (all required, checked at start; the script exits with an error if any is missing):**
- `NC_MONGODB_URI` - NetworkChain's database.
- `NC_ORG_ID` - the Garage organisation id that represents NC; credits go to `StoreWallet{ userId, orgId: NC_ORG_ID }`.
- `FOUNDER_ID` - Garage user id recorded as the crediting founder (`relatedUserId` on the transaction).
- `MONGODB_URI` - Garage database (**production** in this project).

**Flags:** `--dry-run` is the effective default (anything without `--apply` writes nothing). `--apply` performs credits. `--no-zero` (with `--apply`) credits Garage but leaves the NC balance untouched — meant only for a soft cutover.

**Flow:**
1. Connects the default Mongoose connection to Garage (`creditStoreWallet` uses it), and opens a second connection to NC with a minimal `Wallet` schema on collection `wallets` (`userId`, `balance`, `debt`, `migratedToStoreVaultAt`; `strict: false`).
2. Selects NC wallets with `balance > 0` and no `migratedToStoreVaultAt`.
3. For each: converts cents to dollars. In dry-run, logs the planned credit. In apply mode, calls `creditStoreWallet(FOUNDER_ID, userId, NC_ORG_ID, balanceUsd, description, note)` — which, inside a Mongo transaction on the Garage DB, finds or creates the user's USD `StoreWallet`, increases its balance and inserts a `WalletTransaction` of type `credit` — then sets `migratedToStoreVaultAt` (and `balance: 0` unless `--no-zero`) on the NC wallet.
4. Failures per user are logged and counted; the loop continues.
5. Prints a summary (candidates, credited, skipped, failed, total dollars, wallets zeroed) and closes both connections.

## Exports
None. Local `fail(msg)` exits the process; `run()` executes on load.

## Interfaces
- **Database (Garage, `MONGODB_URI`, production):** `StoreWallet` (USD, per user + `NC_ORG_ID`) - created or balance increased; `WalletTransaction` - one `credit` row per migrated user. Both via `creditStoreWallet`.
- **Database (NetworkChain, `NC_MONGODB_URI`):** collection `wallets` - read candidates; write `migratedToStoreVaultAt` and, by default, `balance = 0`.
- **Environment variables:** `MONGODB_URI`, `NC_MONGODB_URI`, `NC_ORG_ID`, `FOUNDER_ID` (see above).

## Dependencies
- **Internal:** `server/services/wallet.ts` - `creditStoreWallet` performs the Garage-side credit and audit transaction.
- **Packages:** `mongoose` - two connections (default + `createConnection`); `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually: `NC_MONGODB_URI=... NC_ORG_ID=... FOUNDER_ID=... npx tsx scripts/migrate-nc-wallets-to-store-vault.ts [--apply] [--no-zero]`. The header's "from /root/garagenew-backend" path refers to the old standalone backend layout.

## Notes
- **Moves real money.** Always run the dry-run first and keep the log (the header suggests redirecting output to a file as an audit trail).
- **Atomicity is weaker than the header claims.** The header says the credit and the NC zero-out run in one session; in the code, `creditStoreWallet` commits its own transaction on the Garage connection, and the NC update happens afterwards on a different connection. If the process dies between the two, the Garage credit is committed but the NC wallet keeps its balance and has no `migratedToStoreVaultAt`, so a re-run would credit that user **again**. Check for such cases before re-running after a crash.
- Idempotency for successful users comes from the `migratedToStoreVaultAt` marker; with `--no-zero` the marker still prevents re-crediting.
- NC `debt` is read into the schema but ignored: only positive `balance` is migrated.
