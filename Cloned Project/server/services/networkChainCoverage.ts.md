# `server/services/networkChainCoverage.ts`

> src/services/networkChainCoverage.ts

**Kind:** backend service · **Lines:** 244

<!-- docgen:auto -->

## Purpose
src/services/networkChainCoverage.ts

"Does this user currently have NetworkChain coverage?" — the predicate behind
the commission split in wallet.ts:creditAffiliateOrPlatform.

DEFINITION (deliberately looser than the rank bonus's):
  covered = a NetworkChain invoice that is PAID, NOT cancelled, and whose
  period has not ended. A FREE first month counts, because it is neither
  cancelled nor expired.

This is NOT services/rankBonus/activeSubscribers.ts. That one additionally
requires a REAL paid cycle (excluding the free month and top-ups), because
paying a rank bonus on a freebie would let a free month fund $40+/month. The
commission split is a softer lever — keep your commission while you are
covered — so the free month counts here and does not there. Today that is 34
users versus 3, so the two WILL disagree; that divergence is intentional and […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `clearNetworkChainCoverageCache` | function | `clearNetworkChainCoverageCache()` — Drop the cache — for tests, and after a script mutates subscriptions. | 70 |
| `getNetworkChainCoveredUsers` | function | `async getNetworkChainCoveredUsers(asOf: Date = new Date()): Promise<Set<string>>` — Every userId with live NetworkChain coverage right now. | 81 |
| `findCoveredUpline` | function | `async findCoveredUpline(userId: string, covered: Set<string>): Promise<string \| null>` — First user at or above `userId` who has coverage. | 161 |
| `findUplineIn` | function | `async findUplineIn(userId: string, eligible: Set<string>): Promise<string \| null>` — The walk itself, independent of which predicate defines "eligible". | 175 |
| `clearUnilevelPlusLicenceCache` | function | `clearUnilevelPlusLicenceCache()` — Drop the licence cache — for tests, and after a script grants a licence. | 201 |
| `getUnilevelPlusLicensedUsers` | function | `async getUnilevelPlusLicensedUsers(): Promise<Set<string>>` — Every userId holding an active $25 Unilevel Plus licence. | 216 |
| `findLicensedUpline` | function | `async findLicensedUpline(userId: string, licensed: Set<string>): Promise<string \| null>` — Nearest upline holding an active licence, or null when the chain ends without one — in which case the caller returns the money to the founder. | 238 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/wallet.ts`
