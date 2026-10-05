# `server/services/resendDomains.ts`

> src/services/resendDomains.ts

**Kind:** backend service · **Lines:** 187

<!-- docgen:auto -->

## Purpose
src/services/resendDomains.ts

Registering a white-label org's own domain with Resend, so its transactional
mail (OTPs, magic links, offer reminders) can be sent FROM that domain
instead of Garage's.

This is deliberately separate from the Mailcow flow in routes/initialSetup.ts.
The two solve different problems and both are needed:

  Mailcow  — mailboxes. Receiving, IMAP, founder@theirdomain.com as a real
             account someone logs into.
  Resend   — transactional sending only. No inbox, no IMAP, no receiving.

Resend cannot replace Mailcow; it sits alongside it.

── The SPF trap ────────────────────────────────────────────────────────── […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ResendDnsRecord` | interface |  | 29 |
| `ResendDomain` | interface |  | 39 |
| `resendConfigured` | function | `resendConfigured(): boolean` | 47 |
| `mergeSpf` | function | `mergeSpf(existing: string \| null, resendValue: string): string` — Merge Resend's SPF include into an existing SPF record. | 103 |
| `addResendDomain` | function | `async addResendDomain(domain: string, region = "us-east-1"): Promise<ResendDomain>` — Register a domain with Resend and get back the DNS records to publish. | 128 |
| `getResendDomain` | function | `async getResendDomain(id: string): Promise<ResendDomain>` — Current status + records. | 145 |
| `verifyResendDomain` | function | `async verifyResendDomain(id: string): Promise<void>` — Ask Resend to re-check DNS now. | 162 |
| `deleteResendDomain` | function | `async deleteResendDomain(id: string): Promise<void>` — Remove a domain from the Resend account. | 173 |
| `listResendDomains` | function | `async listResendDomains(): Promise<ResendDomain[]>` — All domains on the account — used to find one already registered. | 178 |

## Interfaces

- **External HTTP calls:**
  - `GET api.resend.com${path}` (L63)
- **Environment via `server/config/env.ts`:** `env.RESEND_API_KEY`
- **Timers / queues:** `setTimeout` at L61
- **External hosts mentioned in the code:** `api.resend.com`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:** none

## Used by

- `server/routes/initialSetup.ts`
