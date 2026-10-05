# `server/services/founderEmailTemplates.ts`

> Module exporting `buildFounderReferrerEmail`, `buildFounderManagerEmails`, `buildFounderAdminEmail`, `buildFounderWelcomeEmail` and 1 more.

**Kind:** backend service · **Lines:** 148

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FOUNDER_MANAGERS` | const | `= [ { name: "Nithin", email: "Nithin@garage.app" }, { name: "Punith", email: "Punith@gara…` — Founder managers. Email #2 is sent as ONE personalized send per manager (recipient greeted by name). | 11 |
| `GARAGE_ADMIN_EMAIL` | const | `= "shorupan@gmail.com"` | 17 |
| `FounderVars` | interface |  | 53 |
| `buildFounderReferrerEmail` | function | `buildFounderReferrerEmail(v: FounderVars): { subject: string; html: string; }` | 81 |
| `buildFounderManagerEmails` | function | `buildFounderManagerEmails(v: FounderVars): Array<{ to: string; subject: string; html: string…` — One send per founder manager. | 92 |
| `buildFounderAdminEmail` | function | `buildFounderAdminEmail(v: FounderVars): { to: string; subject: string; html: string; }` | 107 |
| `buildFounderWelcomeEmail` | function | `buildFounderWelcomeEmail(v: FounderVars): { subject: string; html: string; }` | 122 |
| `formatCorporateLocation` | function | `formatCorporateLocation(org: { city?: string \| null; state?: string \| null; country…): string` — Same "city, state, country" join used for the affiliate flow. | 138 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `fs`
  - `path`

## Used by

- `server/services/welcomeEmail.ts`
