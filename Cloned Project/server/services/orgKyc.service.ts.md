# `server/services/orgKyc.service.ts`

> Shared KYC logic between the garage-admin console and the founder-facing routes: the built-in requirement catalog, requirement normalisation, and the serializer that mints fresh presigned view URLs.

**Kind:** backend service · **Lines:** 260

<!-- docgen:auto -->

## Purpose
Shared KYC logic between the garage-admin console and the founder-facing
routes: the built-in requirement catalog, requirement normalisation, and the
serializer that mints fresh presigned view URLs.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DEFAULT_KYC_REQUIREMENTS` | const | `= [ { key: "pan_card", label: "PAN Card", kind: "file", description: "Scan or photo of th…` — The options the console offers out of the box. | 21 |
| `slugifyRequirementKey` | function | `slugifyRequirementKey(label: string): string` — Slug a custom label into a stable key. | 57 |
| `OrgKycError` | class | `extends Error` | 66 |
| `normalizeRequirements` | function | `normalizeRequirements(raw: unknown): IOrgKycRequirement[]` — Accept whatever the console sent and return a clean requirement list. | 81 |
| `getOrCreateOrgKyc` | function | `async getOrCreateOrgKyc(orgId: string): Promise<IOrgKyc>` — Load the office's record, creating an empty one on first touch. | 118 |
| `requirementsSatisfied` | function | `requirementsSatisfied(doc: IOrgKyc): boolean` — Every REQUIRED requirement has at least one submission that isn't rejected. | 136 |
| `missingRequirements` | function | `missingRequirements(doc: IOrgKyc): string[]` — Which required requirements are still missing an answer. | 147 |
| `syncOrgKycMirror` | function | `async syncOrgKycMirror(orgId: Types.ObjectId \| string, status: OrgKycStatus, verifiedAt?: Date \| null): Promise<void>` — Mirror the status onto the Organization so office listings and the founder's own session can show a verified badge without a second collection read. | 164 |
| `SerializedOrgKyc` | interface |  | 184 |
| `serializeOrgKyc` | function | `async serializeOrgKyc(doc: IOrgKyc, withViewUrls = true): Promise<SerializedOrgKyc>` | 216 |

## Interfaces

- **Database (Mongoose models used):**
  - `OrgKyc` (server/models/orgKyc.model.ts) — reads: `findOne`; **writes:** `create`
  - `Organization` (server/models/organization.model.ts) — **writes:** `updateOne`

## Dependencies

- **Internal:**
  - `server/models/orgKyc.model.ts` — `IOrgKyc`, `IOrgKycRequirement`, `OrgKyc`, `OrgKycStatus`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/orgKycStorage.ts` — `presignKycView`, `isKycStorageConfigured`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/garageAdminOrgKyc.ts`
- `server/routes/orgKyc.ts`
