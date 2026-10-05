# `server/models/teamforce/teamforceRecruitmentRequest.model.ts`

> Mongoose model `TeamforceRecruitmentRequest` (collection `teamforcerecruitmentrequests`) with 21 top-level fields.

**Kind:** Mongoose model · **Lines:** 97

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `TeamforceRecruitmentRequest`

- **Collection:** `teamforcerecruitmentrequests` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Types.ObjectId` | required, index, ref "Organization" |
| `positionName` | `String` | required, trim |
| `department` | `String` | required, trim |
| `branch` | `String` | required, trim |
| `reportingManager` | `String` | required, trim |
| `employmentType` | `String` | default "Full-Time", enum EMPLOYMENT_TYPES |
| `numberOfOpenings` | `Number` | required, default 1 |
| `experienceRequired` | `String` | required, enum EXPERIENCE_RANGES |
| `jobLocation` | `String` | required, trim |
| `expectedJoiningDate` | `Date` | required |
| `roleSummary` | `String` | default "" |
| `keyResponsibilities` | `String` | default "" |
| `requiredSkills` | `String` | default "" |
| `preferredSkills` | `String` | default "" |
| `approver` | `String` | default "" |
| `approvers` | `[String]` | default [] |
| `status` | `String` | index, default "draft", enum RECRUITMENT_STATUSES |
| `customFieldsDraft` | `[CustomFieldSchema]` | default [] |
| `customFieldsPublished` | `[CustomFieldSchema]` | default [] |
| `createdBy` | `Types.ObjectId` | required, ref "User" |
| `isActive` | `Boolean` | default true |

### Indexes

- `{ orgId: 1, isActive: 1, createdAt: -1 }` (L91)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RECRUITMENT_STATUSES` | const | `= [ "draft", "approval_pending", "approved", "floated", "closed", ] as const` | 3 |
| `EMPLOYMENT_TYPES` | const | `= [ "Full-Time", "Part-Time", "Contract", "Intern", ] as const` | 11 |
| `EXPERIENCE_RANGES` | const | `= ["0-2", "2-5", "5-8", "8+"] as const` | 18 |
| `CUSTOM_FIELD_TYPES` | const | `= ["text", "number", "upload"] as const` | 20 |
| `TeamforceRecruitmentRequest` | model | `model( "TeamforceRecruitmentRequest", TeamforceRecruitmentRequestSchema )` | 93 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/teamforce/candidates.ts`
- `server/routes/teamforce/recruitmentRequests.ts`
