# `server/services/namecom.ts`

> name.com domain reseller.

**Kind:** backend service · **Lines:** 165

<!-- docgen:auto -->

## Purpose
name.com domain reseller.

Garage buys domains as a RESELLER and is the registrant — the founder
leases the domain while they're on the platform. Pricing is name.com's
cost plus NAMECOM_MARGIN_PERCENT, applied here on the server; a price
that arrives from a client is never trusted.

Purchasing sits IN FRONT of the flow that already works: once a domain is
registered, `add-app-domain` attaches it to the right Vercel project and
issues the DNS records. Nothing downstream of registration is new.

Point NAMECOM_API_URL at https://api.dev.name.com while developing. The
sandbox is free; against production every successful register call spends
real money and cannot be undone.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `namecomConfigured` | function | `namecomConfigured(): boolean` | 23 |
| `namecomIsLive` | function | `namecomIsLive(): boolean` — True when pointed at the live API, where registrations cost real money. | 28 |
| `applyMargin` | function | `applyMargin(costUsd: number): number` — Cost in USD → what we charge, rounded up to a whole cent. | 72 |
| `DomainOffer` | interface |  | 77 |
| `checkAvailability` | function | `async checkAvailability(domains: string[]): Promise<DomainOffer[]>` — Exact-match availability for specific domains. | 102 |
| `searchDomains` | function | `async searchDomains(keyword: string): Promise<DomainOffer[]>` — Suggestions for a keyword — what a founder actually wants when they type "bigwin" rather than a full domain. | 122 |
| `registerDomain` | function | `async registerDomain(opts: { domain: string; costUsd: number; years?: number; }): Promise<{ domain: string; expiresAt: string \| nul…` — Register a domain. SPENDS MONEY against the live API. | 144 |

## Interfaces

- **External HTTP calls:**
  - `GET api.dev.name.com${path}` (L45)
- **Environment variables (`process.env`):** `NAMECOM_API_URL`, `NAMECOM_USERNAME`, `NAMECOM_API_TOKEN`, `NAMECOM_MARGIN_PERCENT`
- **External hosts mentioned in the code:** `api.dev.name.com`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/initialSetup.ts`
