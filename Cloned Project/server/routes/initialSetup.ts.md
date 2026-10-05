# `server/routes/initialSetup.ts`

> Express router with 29 endpoints, mounted at `/initial-setup`.

**Kind:** Express router · **Lines:** 3014 · **Mounted at:** `/initial-setup` (browser: `/backend/initial-setup`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (29)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/domain-config` | `/backend/initial-setup/domain-config` | `requireAuth` | inline | 207 |
| POST | `/domain-config` | `/backend/initial-setup/domain-config` | `requireAuth` | inline | 250 |
| POST | `/verify-dns` | `/backend/initial-setup/verify-dns` | `requireAuth` | inline | 337 |
| POST | `/add-domain-to-mailcow` | `/backend/initial-setup/add-domain-to-mailcow` | `requireAuth` | inline | 429 |
| POST | `/create-mailbox` | `/backend/initial-setup/create-mailbox` | `requireAuth` | inline | 487 |
| POST | `/save-mailbox` | `/backend/initial-setup/save-mailbox` | `requireAuth` | inline | 628 |
| GET | `/user-mailboxes` | `/backend/initial-setup/user-mailboxes` | `requireAuth` | inline | 720 |
| POST | `/add-user-mailbox` | `/backend/initial-setup/add-user-mailbox` | `requireAuth` | inline | 762 |
| POST | `/switch-mailbox` | `/backend/initial-setup/switch-mailbox` | `requireAuth` | inline | 827 |
| GET | `/emails` | `/backend/initial-setup/emails` | `requireAuth` | inline | 892 |
| POST | `/sync-emails` | `/backend/initial-setup/sync-emails` | `requireAuth` | inline | 939 |
| GET | `/fetch-inbox` | `/backend/initial-setup/fetch-inbox` | `requireAuth` | inline | 1079 |
| GET | `/folders` | `/backend/initial-setup/folders` | `requireAuth` | inline | 1431 |
| GET | `/status` | `/backend/initial-setup/status` | `requireAuth` | inline | 1534 |
| POST | `/reset-domain-config` | `/backend/initial-setup/reset-domain-config` | `requireAuth` | inline | 1613 |
| POST | `/send-email` | `/backend/initial-setup/send-email` | `requireAuth` | inline | 1653 |
| GET | `/domain-search` | `/backend/initial-setup/domain-search` | `requireAuth` | inline | 2116 |
| POST | `/domain-request` | `/backend/initial-setup/domain-request` | `requireAuth` | inline | 2160 |
| POST | `/add-app-domain` | `/backend/initial-setup/add-app-domain` | `requireAuth` | inline | 2243 |
| GET | `/app-domains` | `/backend/initial-setup/app-domains` | `requireAuth` | inline | 2367 |
| POST | `/verify-app-domain` | `/backend/initial-setup/verify-app-domain` | `requireAuth` | inline | 2399 |
| DELETE | `/app-domain` | `/backend/initial-setup/app-domain` | `requireAuth` | inline | 2524 |
| POST | `/set-primary-app-domain` | `/backend/initial-setup/set-primary-app-domain` | `requireAuth` | inline | 2574 |
| GET | `/verify-domain-for-ssl` | `/backend/initial-setup/verify-domain-for-ssl` | — | inline | 2621 |
| GET | `/lookup-app-domain` | `/backend/initial-setup/lookup-app-domain` | — | inline | 2650 |
| GET | `/email-sender` | `/backend/initial-setup/email-sender` | `requireAuth` | inline | 2758 |
| POST | `/email-sender` | `/backend/initial-setup/email-sender` | `requireAuth` | inline | 2806 |
| DELETE | `/email-sender` | `/backend/initial-setup/email-sender` | `requireAuth` | inline | 2910 |
| POST | `/email-sender/verify` | `/backend/initial-setup/email-sender/verify` | `requireAuth` | inline | 2977 |

**Hooks used:** `useMailProxy`×4 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DomainKind` | type | Which Vercel project a custom domain attaches to. | 1853 |
| `addDomainToVercel` | function | `async addDomainToVercel(domain: string, kind: DomainKind = "app"): Promise<{ success: boolean; error?: string; verce…` | 1878 |
| `removeDomainFromVercel` | function | `async removeDomainFromVercel(domain: string, kind: DomainKind = "app"): Promise<void>` | 1936 |
| `getDomainFromVercel` | function | `async getDomainFromVercel(domain: string, kind: DomainKind = "app"): Promise<{ verified: boolean; verification?: Verce…` | 2008 |
| `verificationToDnsRecords` | function | `verificationToDnsRecords(verification: VercelVerification[] \| undefined): Array<{ type: string; name: string; value: string…` | 2038 |
| `default (router)` | default |  | 3013 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${MAIL_PROXY_URL}${endpoint}` (L86)
  - `GET ${MAILCOW_API_URL}${endpoint}` (L165)
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `findOne`, `exists`
  - `Email` (server/models/email.model.ts) — reads: `find`, `countDocuments`, `findOne`; **writes:** `findOneAndUpdate`, `create`
  - `DomainPurchaseRequest` (server/models/domainPurchaseRequest.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_STORE_PROJECT_ID`, `VERCEL_CRYPTOBRAND_PROJECT_ID`, `VERCEL_OTC_PROJECT_ID`, `VERCEL_OTC_TEAM_ID`, `VERCEL_STORE_TEAM_ID`, `VERCEL_CRYPTOBRAND_TEAM_ID`, `APP_SERVER_IP`
- **Environment via `server/config/env.ts`:** `env.MAILCOW_API_URL`, `env.MAILCOW_API_KEY_READ`, `env.MAILCOW_API_KEY_WRITE`, `env.MAIL_PROXY_URL`, `env.MAIL_PROXY_API_KEY`
- **External hosts mentioned in the code:** `api.vercel.com`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/utils/accessCheck.ts` — `hasFounderAccess`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/domainPurchaseRequest.model.ts` — `DomainPurchaseRequest`
  - `server/services/namecom.ts` — `namecomConfigured`, `namecomIsLive`, `checkAvailability`, `searchDomains`
  - `server/models/user.model.ts` — `User`
  - `server/models/email.model.ts` — `Email`
  - `server/config/env.ts` — `env`
  - `server/types/mongoose.ts` — `DnsRecord`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `dns`
  - `util` — `promisify`
  - `child_process` — `exec`
  - `imap`
  - `mailparser` — `simpleParser`
  - `nodemailer`
  - `mongoose`

## Used by

- `server/app.ts`
- `server/routes/eventManagement.ts`

Entry: mounted in `server/app.ts` at `/initial-setup`.

## Notes

- Security-relevant constructs: `exec()` (L2091).
- Large file (3014 lines) — read it by section; line numbers above point into it.
