# `server/services/store.ts`

> Module exporting `createStoreForOrganization`, `updateStore`, `getStoreBySlug`, `getStoreInfo`.

**Kind:** backend service · **Lines:** 177

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createStoreForOrganization` | function | `async createStoreForOrganization(orgId: string): Promise<void>` — Create store for organization with default channel (Members) Note: Previously created Employees + Customers channels, now only creates Members | 10 |
| `updateStore` | function | `async updateStore(orgId: string, updates: { name?: string; description?: string; headingText…): Promise<void>` — Update store information | 110 |
| `getStoreBySlug` | function | `async getStoreBySlug(slug: string)` — Get organization by store slug | 151 |
| `getStoreInfo` | function | `async getStoreInfo(orgId: string)` — Get store info for an organization | 158 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`, `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `Channel` (server/models/channel.model.ts) — reads: `countDocuments`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/user.model.ts` — `User`
  - `server/utils/storeSlug.ts` — `generateSlug`, `ensureUniqueSlug`
- **Packages:** none

## Used by

- `server/routes/org.ts`
- `server/services/init.ts`
