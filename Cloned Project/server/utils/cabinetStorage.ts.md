# `server/utils/cabinetStorage.ts`

> Module exporting `getOrgStoragePlan`, `getOrgStorageUsage`, `getOrgStorageDetails`, `checkOrgUploadQuota`.

**Kind:** backend utility · **Lines:** 291

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `STARTER_STORAGE_BYTES` | const | `= 2 * 1024 * 1024 * 1024` — How much cabinet space an office gets, by plan. | 17 |
| `PRO_STORAGE_BYTES` | const | `= 200 * 1024 * 1024 * 1024` | 18 |
| `OrgPlanSlug` | type |  | 20 |
| `OrgStoragePlan` | interface |  | 22 |
| `getOrgStoragePlan` | function | `async getOrgStoragePlan(organizationId: string \| Types.ObjectId): Promise<OrgStoragePlan>` — Resolve the office's plan and its storage cap. | 99 |
| `OrgStorageUsage` | interface |  | 144 |
| `getOrgStorageUsage` | function | `async getOrgStorageUsage(organizationId: string \| Types.ObjectId): Promise<OrgStorageUsage>` — Bytes the office cabinet currently holds, split the way the storage banner renders it. | 156 |
| `OrgStorageDetails` | interface |  | 205 |
| `getOrgStorageDetails` | function | `async getOrgStorageDetails(organizationId: string \| Types.ObjectId): Promise<OrgStorageDetails>` — The `storageDetails` block every organization cabinet response returns. | 212 |
| `QuotaCheck` | interface |  | 236 |
| `checkOrgUploadQuota` | function | `async checkOrgUploadQuota(organizationId: string \| Types.ObjectId, incomingBytes: number): Promise<QuotaCheck>` — Whether `incomingBytes` still fits inside the office's plan allowance. | 251 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `OfficeSubscription` (server/models/officeSubscription.model.ts) — reads: `find`
  - `OrganizationFile` (server/models/cabinet.model.ts) — reads: `aggregate`

## Dependencies

- **Internal:**
  - `server/models/cabinet.model.ts` — `OrganizationFile`
  - `server/models/officePlan.model.ts` — `OFFICE_PLAN_IDS`
  - `server/models/officeSubscription.model.ts` — `OfficeSubscription`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/officeSubscription.ts` — `hasActiveOfficeSubscription`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/controllers/cabinet.controller.ts`
