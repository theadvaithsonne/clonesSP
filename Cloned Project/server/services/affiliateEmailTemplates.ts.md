# `server/services/affiliateEmailTemplates.ts`

> Module exporting `buildReferrerEmail`, `buildManagerEmail`, `buildAdminEmail`, `buildWelcomeEmail` and 1 more.

**Kind:** backend service · **Lines:** 145

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MANAGER_EMAIL` | const | `= "amanulla@garage.app"` | 9 |
| `ADMIN_EMAIL` | const | `= "shorupan@gmail.com"` | 11 |
| `PLATFORM_CC` | const | `= ["philip@garage.app", "shorupan@gmail.com"]` — CC on every affiliate-onboard notification. | 16 |
| `AffiliateVars` | interface |  | 55 |
| `buildReferrerEmail` | function | `buildReferrerEmail(v: AffiliateVars): { subject: string; html: string; }` | 80 |
| `buildManagerEmail` | function | `buildManagerEmail(v: AffiliateVars): { to: string; subject: string; html: string; }` | 90 |
| `buildAdminEmail` | function | `buildAdminEmail(v: AffiliateVars): { to: string; subject: string; html: string; }` | 105 |
| `buildWelcomeEmail` | function | `buildWelcomeEmail(v: AffiliateVars): { subject: string; html: string; }` | 120 |
| `formatAffiliateLocation` | function | `formatAffiliateLocation(user: { city?: string \| null; state?: string \| null; countr…): string` — Build a comma-joined display location from user profile fields. | 135 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `fs`
  - `path`

## Used by

- `server/services/welcomeEmail.ts`
