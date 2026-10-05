# `server/models/bank-details.model.ts`

> Mongoose model `BankDetails`: a user's single set of bank-account details for payouts, including branch and beneficiary addresses.

**Kind:** Mongoose model · **Lines:** 38

## Purpose
Holds the bank information a user enters for wallet withdrawals. It is the older storage for payout details; a migration script moves these records into wallet accounts.

## How it works
- `userId` - ref `User`, required, unique: one record per user.
- Required: `country`, `bankName`, `branchAddress`, `accountNumber`, `swiftCode`, `beneficiaryName`, `beneficiaryAddress`.
- Optional (default `""`): `routingNumber`, `ibanNumber`.
- `branchAddress` and `beneficiaryAddress` use an embedded address sub-schema (no `_id`): `line1`, `line2`, `city`, `state`, `postalCode`, `country`, all defaulting to `""`.
- Timestamps on; collection `bankdetails`.

## Exports
- `BankDetails` - Mongoose model.

## Interfaces
- **Database:** `BankDetails` (collection `bankdetails`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/wallet.ts` - mounted at `/wallet` (browser `/backend/wallet`); reads (`findOne`) and upserts (`findOneAndUpdate`) the current user's details.
- `server/scripts/migrateBankDetailsToWalletAccount.ts` - one-off migration run by hand; connects to `MONGODB_URI`, the production database.

## Notes
- Account numbers, SWIFT and IBAN are stored in plaintext; treat this collection as sensitive personal/financial data.
