# `server/services/installIntent.ts`

> Module exporting `hashIp`, `clientIp`, `recordIntent`, `claimIntent`.

**Kind:** backend service · **Lines:** 252

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MATCH_WINDOW_MS` | const | `= 60 * 60 * 1000` — An intent is only matchable for an hour after it was written — a launch later than that is almost certainly an unrelated install. | 6 |
| `hashIp` | function | `hashIp(ip?: string \| null): string \| null` | 12 |
| `clientIp` | function | `clientIp(req: any): string \| null` | 17 |
| `InstallIntentApp` | type | Garage Shop, Garage HQ, NetworkChains (a third-party client of this backend), and GarageIRL ("pay", the Garage Pay buyer app, com.garagepayseller.app). | 29 |
| `Fingerprint` | interface |  | 31 |
| `recordIntent` | function | `async recordIntent(input: { link: string; affiliateId?: string \| null; fp: Fin…)` | 136 |
| `RECLAIM_WINDOW_MS` | const | `= 3 * 60 * 60 * 1000` — A claimed row stays answerable to the same device for this long (rows are deleted at 3h regardless, so this is the practical ceiling). | 175 |
| `claimIntent` | function | `async claimIntent(fp: Fingerprint, opts: { reclaim?: boolean } = {}): Promise<string \| null>` | 197 |

## Interfaces

- **Database (Mongoose models used):**
  - `InstallIntent` (server/models/installIntent.model.ts) — reads: `find`; **writes:** `create`, `findOneAndUpdate`
- **Environment variables (`process.env`):** `IP_HASH_SALT`

## Dependencies

- **Internal:**
  - `server/models/installIntent.model.ts` — `InstallIntent`
- **Packages:**
  - `crypto`

## Used by

- `server/routes/public.ts`
- `server/services/__tests__/installIntent.test.ts`
