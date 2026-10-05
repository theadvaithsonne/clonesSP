# `server/services/appDomainHealth.ts`

> Module exporting `probeAppDomain`, `sweepAppDomainHealth`, `refreshDomainHealth`, `resolveShareOrigin` and 1 more.

**Kind:** backend service · **Lines:** 380

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MIN_LINK_CONTRACT` | const | `= 1` — Minimum linkContract a domain must report to be used for public links. | 37 |
| `CANONICAL_APP_ORIGIN` | const | `= ( process.env.PUBLIC_APP_ORIGIN \|\| "https://my.garage.app" ).replace(/\/+$/, "")` — Origin used when an office has no healthy domain of its own. | 40 |
| `CANONICAL_ORIGIN_ORG_IDS` | const | `= new Set( [ PLATFORM_ORG_ID, ...(process.env.PLATFORM_ORIGIN_ORG_IDS \|\| "") .split(",") …` — Offices whose public links are ALWAYS minted on CANONICAL_APP_ORIGIN, whatever custom domains they hold. | 58 |
| `ProbeResult` | type |  | 74 |
| `probeAppDomain` | function | `async probeAppDomain(domain: string): Promise<ProbeResult>` — Probe one domain's deployment. | 88 |
| `sweepAppDomainHealth` | function | `async sweepAppDomainHealth(): Promise<{ checked: number; unhealthy: string[]; s…` — Probe every verified app domain and persist the verdict. | 171 |
| `refreshDomainHealth` | function | `async refreshDomainHealth(orgId: string, domain: string): Promise<ProbeResult>` — Re-probe one domain immediately and persist the verdict. | 237 |
| `ShareOrigin` | type |  | 271 |
| `resolveShareOrigin` | function | `async resolveShareOrigin(orgId: string): Promise<ShareOrigin>` — The origin an office's PUBLIC links must be built on. | 287 |
| `startAppDomainHealthCron` | function | `startAppDomainHealthCron(intervalMs = 10 * 60_000): NodeJS.Timeout` — Cron entrypoint — invoked from src/index.ts on boot. | 354 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `find`, `findById`
- **Environment variables (`process.env`):** `PUBLIC_APP_ORIGIN`, `PLATFORM_ORIGIN_ORG_IDS`
- **Timers / queues:** `setTimeout` at L91, L373; `setInterval` at L374
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/commission.ts` — `PLATFORM_ORG_ID`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
