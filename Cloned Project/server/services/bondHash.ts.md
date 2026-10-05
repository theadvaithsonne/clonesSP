# `server/services/bondHash.ts`

> Public identifier for a purchased bond — the "bond hash".

**Kind:** backend service · **Lines:** 41

<!-- docgen:auto -->

## Purpose
Public identifier for a purchased bond — the "bond hash".

Anyone holding a bond hash can view that bond's public page (value,
interest paid, remaining payments, schedule), so the identifier must
not be guessable or enumerable. A sequential or short id would let
anyone step through every bond on the platform and scrape what each
one holds.

Format: 12 random digits, never starting with 0 — readable, easy to
paste into a search box, and matches the numeric look of the design
("Bitcoin Bond - 23416167"). ~3.9 x 10^11 possible values: at the
public endpoint's rate limit, guessing even one live bond is not a
practical attack.

This is NOT an on-chain hash. Bonds are wallet-ledger records, so
the id cannot be verified on a blockchain explorer.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BOND_HASH_LENGTH` | const | `= 12` | 20 |
| `generateBondHash` | function | `generateBondHash(): string` | 22 |
| `normalizeBondHash` | function | `normalizeBondHash(raw: unknown): string \| null` — Normalise user input from a search box: tolerate spaces, dashes and a leading "#". | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `crypto`

## Used by

- `server/models/bondHolding.model.ts`
- `server/routes/bond.ts`
- `server/routes/publicBond.ts`
- `server/scripts/backfill-bond-hashes.ts`
- `server/services/__tests__/bondView.test.ts`
- `server/services/bondInvoiceFulfillment.ts`
