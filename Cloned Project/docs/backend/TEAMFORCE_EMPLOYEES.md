# Teamforce — Employees Module

Complete reference for the **Employees** section of Teamforce: listing org members, the **Add Employee** flow, update/role/delete operations, access control, schema, and payroll integration.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Route Map](#2-route-map)
3. [Middleware & Access Control](#3-middleware--access-control)
4. [GET / — List All Employees](#4-get----list-all-employees)
5. [GET /:userId — Get Single Employee](#5-get-userid--get-single-employee)
6. [POST / — Add Employee (Full Flow)](#6-post----add-employee-full-flow)
7. [PATCH /:userId — Update Employee Profile](#7-patch-userid--update-employee-profile)
8. [PATCH /:userId/role — Promote/Demote Teamforce Role](#8-patch-useridrole--promotedemote-teamforce-role)
9. [DELETE /:userId/profile — Delete Profile](#9-delete-useridprofile--delete-profile)
10. [TeamforceEmployeeProfile Schema](#10-teamforceemployeeprofile-schema)
11. [Tax Declaration Schema](#11-tax-declaration-schema)
12. [Related Reference Models](#12-related-reference-models)
13. [Field Visibility & Stripping Logic](#13-field-visibility--stripping-logic)
14. [Payroll Integration](#14-payroll-integration)
15. [Error Reference](#15-error-reference)
16. [Bulk Upload CSV Integration](#16-bulk-upload-csv-integration)
17. [Key Files](#17-key-files)

---

## 1. Overview

Teamforce employees are **existing org members** (from the core `User` model) with an optional HR-specific profile layer (`TeamforceEmployeeProfile`). The system supports:

- Multi-tiered access control (Founder → Teamforce Admin → Employee)
- Salary, TDS/tax, and PF configuration per employee
- Attendance assignments (shift, weekly off pattern)
- Leave, payroll, and Full & Final (F&F) settlement integration
- Document storage via S3 URLs
- Education and work experience records

**Route mount point** (`src/app.ts:337`):
```
app.use("/teamforce", teamforceRoutes);
```

All employee endpoints live under:
```
/teamforce/employees
```

---

## 2. Route Map

| Method | Endpoint | Auth Required | Access Level | Purpose |
|--------|----------|:-------------:|:------------:|---------|
| `GET` | `/teamforce/employees` | Yes | Any authenticated user | List all org members with profiles |
| `GET` | `/teamforce/employees/:userId` | Yes | Any authenticated user | Get one employee's full detail |
| `POST` | `/teamforce/employees` | Yes | Founder or Teamforce Admin | Create or upsert employee profile |
| `PATCH` | `/teamforce/employees/:userId` | Yes | Founder, Admin, or Self (limited) | Update employee profile fields |
| `PATCH` | `/teamforce/employees/:userId/role` | Yes | Founder only | Promote/demote Teamforce role |
| `DELETE` | `/teamforce/employees/:userId/profile` | Yes | Founder or Teamforce Admin | Delete profile (keeps org membership) |

**Source files:**
- Routes: [src/routes/teamforce/employees.ts](src/routes/teamforce/employees.ts)
- Helpers: [src/routes/teamforce/_helpers.ts](src/routes/teamforce/_helpers.ts)
- Index: [src/routes/teamforce/index.ts](src/routes/teamforce/index.ts)

---

## 3. Middleware & Access Control

### OrgId Resolution (`getOrgIdStrict`)

```
Priority 1: ?orgId= query parameter  (from localStorage on frontend)
Priority 2: orgId embedded in JWT token
Returns 400 if neither is available
```

### Role Hierarchy

```
Founder
  └── Teamforce Admin  (teamforceRole = "admin" in TeamforceEmployeeProfile)
        └── Employee with managesTeam=true  (recruitment access only)
              └── Regular Employee
```

### Helper Functions

| Helper | Logic | Returns |
|--------|-------|---------|
| `isFounder(req)` | `req.user.role === "founder"` | boolean |
| `hasFullAccess(req)` | isFounder OR profile.teamforceRole === "admin" | Promise\<boolean\> |
| `requireTeamforceWriteAccess(req,res)` | enforces hasFullAccess | 403 if denied |
| `requireFounderOnly(req,res)` | enforces isFounder | 403 if denied |
| `hasRecruitmentAccess(req)` | isFounder OR admin OR managesTeam===true | Promise\<boolean\> |
| `requireRecruitmentAccess(req,res)` | enforces hasRecruitmentAccess | 403 if denied |
| `stripSensitive(profile, fullAccess)` | removes salary/TDS, reporting, attendance, offer letter, and exit fields if !fullAccess | filtered profile |

---

## 4. GET / — List All Employees

**Request:**
```http
GET /teamforce/employees?orgId=<orgId>
Authorization: Bearer <jwt>
```

**Behavior:**
1. Extracts `orgId` from query or JWT.
2. Queries `User` for all members of the org where `membership.guest !== true`.
3. Queries `TeamforceEmployeeProfile` for all profiles in the org.
4. Joins in memory: matches profiles to users by `userId`.
5. Checks `hasFullAccess` for the requesting user.
6. Strips sensitive fields from each profile unless the requester has full access.
7. Populates:
   - `branchId` → `{ _id, name }`
   - `departmentId` → `{ _id, name }`
   - `reportingManagerId` → `{ _id, name, email }`
   - `secondaryReviewerId` → `{ _id, name, email }`
   - `shiftId` → `{ _id, name, startTime, endTime }`
   - `weeklyOffPatternId` → `{ _id, name, offDays }`

**Response shape (`200`):**
```jsonc
{
  "employees": [
    {
      "userId": "...",
      "name": "John Doe",
      "email": "john@company.com",
      "profilePicture": "https://..." | null,
      "role": "stakeholder",          // garage org role
      "joinedAt": "2024-01-15T10:30:00Z",
      "hasProfile": true,
      "teamforceRole": "member",      // HR role (admin | member)
      "profile": { /* see schema section */ }
    }
  ]
}
```

---

## 5. GET /:userId — Get Single Employee

**Request:**
```http
GET /teamforce/employees/:userId?orgId=<orgId>
Authorization: Bearer <jwt>
```

**Behavior:** Same as list but for one user. Populates all reference fields. Applies `stripSensitive` based on requester's access level.

**Response shape (`200`):**
```jsonc
{
  "userId": "...",
  "name": "...",
  "email": "...",
  "profilePicture": "...",
  "role": "stakeholder",
  "joinedAt": "...",
  "hasProfile": true,
  "teamforceRole": "admin",
  "profile": { /* full profile */ }
}
```

---

## 6. POST / — Add Employee (Full Flow)

### Access Control
Requires `requireTeamforceWriteAccess` → **Founder or Teamforce Admin only**.

### Request
```http
POST /teamforce/employees?orgId=<orgId>
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Request Body (Zod-validated)

All fields except `email` are optional.

#### Identity & Contact
| Field | Type | Notes |
|-------|------|-------|
| `email` | `string` (email) | **Required**. Lowercased. Used to find or create User. |
| `name` | `string` | If user has no name, sets it on User. |
| `mobileNumber` | `string` | Phone number, no format enforcement. |
| `pan` | `string` | Auto-trimmed and uppercased. |
| `dateOfBirth` | `string` (ISO date) | Converted to Date. Used for age-tiered tax. |
| `permanentAddress` | `string` | Full address string. |
| `currentAddress` | `string` | Full address string. |
| `sameAsPermanent` | `boolean` | Default: false. |

#### Joining & Organization
| Field | Type | Notes |
|-------|------|-------|
| `dateOfJoining` | `string` (ISO date) | Employee start date. |
| `placeOfJoining` | `string` | City or office name. |
| `branchId` | `string` (ObjectId) | Reference to TeamforceBranch. |
| `departmentId` | `string` (ObjectId) | Reference to TeamforceDepartment. |
| `designation` | `string` | Job title. |
| `employmentType` | `"full-time" \| "part-time" \| "contract" \| "intern" \| "freelance"` | |
| `state` | `string` | State name; used for Professional Tax slab lookup. |
| `cityType` | `"METRO" \| "NON_METRO"` | |

#### Reporting Structure
| Field | Type | Notes |
|-------|------|-------|
| `reportingManagerId` | `string` (ObjectId) | Direct manager's userId. |
| `secondaryReviewerId` | `string \| null` (ObjectId) | Optional secondary approver. |
| `managesTeam` | `boolean` | If true, employee gets recruitment access. |

#### Education
```jsonc
"education": [
  {
    "degreeName": "B.Tech in Computer Science",
    "yearOfPassing": "2012",
    "certificateUrl": "https://s3.../cert.pdf"
  }
]
```

#### Work Experience
```jsonc
"workExperience": [
  {
    "companyName": "Tech Corp",
    "yearsOfExperience": "5",
    "designation": "Software Engineer",
    "referenceName": "Mr. Reference",
    "referenceContact": "+91-9999999999"
  }
]
```

#### Salary (sensitive — only visible to Founder/Admin)
| Field | Type | Notes |
|-------|------|-------|
| `salaryStructureId` | `string` (ObjectId) | Which salary template to apply. |
| `monthlyCtc` | `number` (>= 0) | Monthly Cost-to-Company. Anchor for % calculations. |
| `basicSalary` | `number` | |
| `hra` | `number` | House Rent Allowance. |
| `transportAllowance` | `number` | |
| `providentFund` | `number` | PF deduction amount. |
| `professionalTax` | `number` | PT deduction amount. |
| `variablePay` | `number` | Bonus/incentive. |
| `customAllowances` | `Array<{ name: string, amount: number }>` | Extra earnings. |
| `customDeductions` | `Array<{ name: string, amount: number }>` | Extra deductions. |
| `pfOption` | `"CEILING" \| "ACTUAL"` | CEILING = cap PF at ₹12k/month. |
| `esiApplicable` | `boolean` | Whether ESI applies (typically gross < ₹21k). |

#### Tax (TDS) — sensitive
| Field | Type | Notes |
|-------|------|-------|
| `tdsRegime` | `"new" \| "old"` | Tax regime for TDS computation. |
| `estimatedAnnualTds` | `number` | Annual TDS liability. |
| `autoCalculateTds` | `boolean` | If true, payroll engine computes TDS automatically. |

#### Attendance & Policy
| Field | Type | Notes |
|-------|------|-------|
| `shiftId` | `string` (ObjectId) | Reference to TeamforceShift. |
| `weeklyOffPatternId` | `string` (ObjectId) | Reference to TeamforceWeeklyOffPattern. |

#### Documents (S3 URLs)
| Field | Type |
|-------|------|
| `offerLetterUrl` | `string` |
| `idProofUrl` | `string` |
| `educationCertificatesUrl` | `string` |
| `experienceLettersUrl` | `string` |

#### Bank Details — sensitive
| Field | Type | Notes |
|-------|------|-------|
| `bankAccountHolderName` | `string` | Name as on bank account. |
| `bankAccountType` | `"savings" \| "current"` | |
| `bankAccountNumber` | `string` | Full account number. |
| `bankIfscCode` | `string` | IFSC code. |

#### Exit (F&F Settlement)
| Field | Type | Notes |
|-------|------|-------|
| `exitedAt` | `string \| null` (ISO date) | Last working day. Triggers F&F in next payroll. |
| `exitReason` | `string` | Resignation or termination reason. |

---

### Validation Error Format

The route uses `schema.safeParse(req.body)` (not `.parse()`). On failure it returns a **structured 400** instead of crashing with an unhandled 500:

```jsonc
// HTTP 400
{
  "error": "employmentType: Invalid enum value. Expected 'full-time' | 'part-time' | 'contract' | 'intern' | 'freelance'; email: Invalid email"
}
```

Multiple field errors are joined with `"; "`. The `error` field is always present on a 400 from this endpoint, so API clients should read `response.error` (not `response.message`).

---

### Processing Steps

```
1. schema.safeParse(req.body) → 400 { error: "..." } on validation failure
        ↓
2. getOrgIdStrict → extract orgId (query param or JWT)
        ↓
3. requireTeamforceWriteAccess → 403 if not Founder/Admin
        ↓
4. User Resolution
   ├── User.findOne({ email: body.email.toLowerCase() })
   ├── NOT FOUND → create new User
   │     ├── email (lowercase)
   │     ├── name (body.name || email prefix)
   │     └── organizations[0] = { organization: orgId, role: "stakeholder", joinedAt: now }
   └── FOUND but not in org → User.organizations.push({ organization: orgId, role: "stakeholder", joinedAt: now })
        ↓
5. Update User.name if: body.name provided AND user currently has no name
        ↓
6. Build profileData
   ├── Exclude: email, name (those stay on User)
   ├── Convert ObjectId strings → ObjectId:
   │     branchId, departmentId, reportingManagerId, secondaryReviewerId,
   │     salaryStructureId, shiftId, weeklyOffPatternId
   └── Convert ISO date strings → Date:
         dateOfJoining, dateOfBirth, exitedAt
        ↓
7. Upsert TeamforceEmployeeProfile
   TeamforceEmployeeProfile.findOneAndUpdate(
     { userId, orgId },
     { $set: profileData },
     { upsert: true, new: true }
   )
        ↓
8. Return 201
   { userId, name, email, profile: { ...full profile } }
```

### Response (`201 Created`)
```jsonc
{
  "userId": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@company.com",
  "profile": {
    "_id": "...",
    "userId": "...",
    "orgId": "...",
    "teamforceRole": "member",
    "designation": "Senior Software Engineer",
    "employmentType": "full-time",
    "monthlyCtc": 120000,
    // ... all other profile fields
  }
}
```

---

## 7. PATCH /:userId — Update Employee Profile

**Request:**
```http
PATCH /teamforce/employees/:userId?orgId=<orgId>
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Access Control Logic

| Requester | Allowed Fields |
|-----------|---------------|
| **Founder** | All fields (except `teamforceRole` — use /role endpoint) |
| **Teamforce Admin** | All fields (except `teamforceRole`) |
| **Self-edit (non-manager)** | Personal info only — see table below |

**Fields the employee can edit about themselves:**
```
mobileNumber, permanentAddress, currentAddress, sameAsPermanent,
dateOfBirth, pan, education, workExperience,
idProofUrl, educationCertificatesUrl, experienceLettersUrl,
bankAccountHolderName, bankAccountType, bankAccountNumber, bankIfscCode
```

**Sensitive fields (stripped from self-edits AND from non-admin GET responses):**
```
salaryStructureId, monthlyCtc, basicSalary, hra, transportAllowance,
providentFund, professionalTax, variablePay, customAllowances, customDeductions,
tdsRegime, estimatedAnnualTds, autoCalculateTds, pfOption, esiApplicable,
reportingManagerId, secondaryReviewerId, managesTeam,
shiftId, weeklyOffPatternId,
offerLetterUrl,
exitedAt, exitReason
```

**Manager-only fields (never updatable by self, but NOT hidden in GET — superseded by SENSITIVE_FIELDS for exit/hierarchy/attendance):**
```
teamforceRole, reportingManagerId, secondaryReviewerId, branchId,
departmentId, designation, employmentType, dateOfJoining, placeOfJoining,
managesTeam, shiftId, weeklyOffPatternId, state, cityType, exitedAt, exitReason
```

**Processing:**
1. Verify user exists in org.
2. Strip forbidden fields based on requester role.
3. Convert IDs to ObjectId, date strings to Date objects (same as POST).
4. `TeamforceEmployeeProfile.findOneAndUpdate({ userId, orgId }, { $set: update }, { upsert: true, new: true })`
5. If manager-level requester and `body.name` provided → update `User.name`.

**Response (`200`):**
```jsonc
{ "profile": { /* updated profile */ } }
```

---

## 8. PATCH /:userId/role — Promote/Demote Teamforce Role

**Request:**
```http
PATCH /teamforce/employees/:userId/role?orgId=<orgId>
Authorization: Bearer <jwt>
Content-Type: application/json

{ "teamforceRole": "admin" | "member" }
```

**Access Control:** `requireFounderOnly` — **Founder only**.

**Processing:**
```ts
TeamforceEmployeeProfile.findOneAndUpdate(
  { userId, orgId },
  { $set: { teamforceRole } },
  { upsert: true, new: true }
)
```

**Response (`200`):**
```jsonc
{ "profile": { "teamforceRole": "admin", /* ... */ } }
```

---

## 9. DELETE /:userId/profile — Delete Profile

**Request:**
```http
DELETE /teamforce/employees/:userId/profile?orgId=<orgId>
Authorization: Bearer <jwt>
```

**Access Control:** `requireTeamforceWriteAccess` — Founder or Teamforce Admin.

**Important:** Deletes only the `TeamforceEmployeeProfile` document. The `User` record and org membership are **NOT** affected. The person remains in the organization but loses all HR profile data (salary, TDS, bank details, documents, etc.).

**Response (`200`):**
```jsonc
{ "ok": true }
```

---

## 10. TeamforceEmployeeProfile Schema

**Model file:** [src/models/teamforce/teamforceEmployeeProfile.model.ts](src/models/teamforce/teamforceEmployeeProfile.model.ts)

**Unique index:** `{ userId: 1, orgId: 1 }` — one profile per user per org.

### Core Identity
| Field | Type | Required | Default |
|-------|------|:--------:|:-------:|
| `userId` | ObjectId → User | Yes | — |
| `orgId` | ObjectId → Organization | Yes | — |
| `teamforceRole` | `"admin" \| "member"` | No | `"member"` |
| `createdAt` | Date | Auto | — |
| `updatedAt` | Date | Auto | — |

### Personal Info
| Field | Type |
|-------|------|
| `mobileNumber` | String |
| `pan` | String (uppercase) |
| `dateOfBirth` | Date |
| `permanentAddress` | String |
| `currentAddress` | String |
| `sameAsPermanent` | Boolean (default: false) |

### Joining & Organization
| Field | Type |
|-------|------|
| `dateOfJoining` | Date |
| `placeOfJoining` | String |
| `branchId` | ObjectId → TeamforceBranch |
| `departmentId` | ObjectId → TeamforceDepartment |
| `designation` | String |
| `employmentType` | `"full-time" \| "part-time" \| "contract" \| "intern" \| "freelance"` |
| `state` | String |
| `cityType` | `"METRO" \| "NON_METRO"` |

### Reporting Structure
| Field | Type | Default |
|-------|------|:-------:|
| `reportingManagerId` | ObjectId → User | — |
| `secondaryReviewerId` | ObjectId → User \| null | — |
| `managesTeam` | Boolean | false |
| `deferredLopDays` | Number | 0 (reset each payroll run) |

### Education
```ts
education: [{
  degreeName?: string,
  yearOfPassing?: string,
  certificateUrl?: string,
}]
```

### Work Experience
```ts
workExperience: [{
  companyName?: string,
  yearsOfExperience?: string,
  designation?: string,
  referenceName?: string,
  referenceContact?: string,
}]
```

### Salary (sensitive)
| Field | Type | Notes |
|-------|------|-------|
| `salaryStructureId` | ObjectId → TeamforceSalaryStructure | Salary template |
| `monthlyCtc` | Number | Monthly CTC; anchor for % components |
| `basicSalary` | Number | |
| `hra` | Number | House Rent Allowance |
| `transportAllowance` | Number | |
| `providentFund` | Number | |
| `professionalTax` | Number | |
| `variablePay` | Number | |
| `customAllowances` | `[{ name, amount }]` | |
| `customDeductions` | `[{ name, amount }]` | |
| `pfOption` | `"CEILING" \| "ACTUAL"` | CEILING caps PF at ₹12k/month |
| `esiApplicable` | Boolean | Typically true when gross < ₹21k |

### Tax (sensitive)
| Field | Type |
|-------|------|
| `tdsRegime` | `"new" \| "old"` |
| `estimatedAnnualTds` | Number |
| `autoCalculateTds` | Boolean |

### Attendance
| Field | Type |
|-------|------|
| `shiftId` | ObjectId → TeamforceShift |
| `weeklyOffPatternId` | ObjectId → TeamforceWeeklyOffPattern |

### Exit (F&F)
| Field | Type | Notes |
|-------|------|-------|
| `exitedAt` | Date \| null | When set, next payroll triggers F&F settlement |
| `exitReason` | String | Resignation/termination reason |

### Documents
| Field | Type |
|-------|------|
| `offerLetterUrl` | String (S3 URL) |
| `idProofUrl` | String (S3 URL) |
| `educationCertificatesUrl` | String (S3 URL) |
| `experienceLettersUrl` | String (S3 URL) |

### Bank Details (sensitive)
| Field | Type |
|-------|------|
| `bankAccountHolderName` | String |
| `bankAccountType` | `"savings" \| "current"` |
| `bankAccountNumber` | String |
| `bankIfscCode` | String |

---

## 11. Tax Declaration Schema

**Model file:** [src/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts](src/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts)

**Purpose:** Per-employee, per-financial-year tax declarations. Used by payroll engine to compute TDS.

**Unique index:** `{ userId: 1, orgId: 1, fy: 1 }` — one declaration per FY per user per org.

| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId → User | |
| `orgId` | ObjectId → Organization | |
| `fy` | String | e.g. `"2024-25"` (April-March) |
| `regime` | `"OLD" \| "NEW"` | Default: NEW |
| `locked` | Boolean | When true, declaration is finalized |
| `lockedAt` | Date | Timestamp when locked |

**HRA (Old Regime only):**
```ts
hraDeclaration: {
  monthlyRentPaid: number,
  landlordName: string,
  landlordPan: string,
  ownsHouseInCity: boolean,
}
```

**Chapter VI-A Deductions:**
| Field | Type | Section | Notes |
|-------|------|---------|-------|
| `ltaClaimAmount` | Number | LTA | Old regime only |
| `declared80C` | Number | 80C | Up to ₹1.5L |
| `declaredNpsSelf` | Number | 80CCD(1B) | NPS contributions |
| `declared80DSelf` | Number | 80D | Health insurance — self |
| `declared80DParent` | Number | 80D | Health insurance — parents |
| `parentSeniorCitizen` | Boolean | 80D | Age >= 60 |
| `savingsInterest` | Number | 80TTA | Interest on savings account |
| `fdInterest` | Number | 80TTB | FD interest (senior citizens only) |
| `declared80E` | Number | 80E | Education loan interest |
| `declared80EEA` | Number | 80EEA | First home loan (allowed in new regime) |
| `declared80G` | Number | 80G | Charitable donations |

**Previous Employer (mid-FY joiners):**
```ts
previousEmployer: {
  name: string,
  tan: string,
  grossSalary: number,
  tdsDeducted: number,
  ptPaid: number,
  pfPaid: number,
}
```

---

## 12. Related Reference Models

These models are used as foreign keys in `TeamforceEmployeeProfile`.

### TeamforceBranch
```
orgId, name, code?, address, city, state, country, postalCode, isActive
Unique: { orgId, name }
```

### TeamforceDepartment
```
orgId, name, description?, headId (→ User), isActive
Unique: { orgId, name }
```

### TeamforceShift
```
orgId, name, startTime (HH:mm), endTime (HH:mm),
workingHours, graceMinutes, breakMinutes, isActive
```

### TeamforceWeeklyOffPattern
```
orgId, name, patternType (Fixed | Rotating), offDays ([0-6]), isActive
```
`offDays` uses JavaScript day numbers: `0` = Sunday, `6` = Saturday.

### TeamforceSalaryStructure
```
orgId, name, earnings ([component schemas]), deductions,
taxRegime (new | old), autoTds, estimatedAnnualTds, isActive
Unique (active): { orgId, name }
```

### TeamforcePayrollRun
```
orgId, fyYear, fyMonth
Unique: { orgId, fyYear, fyMonth }
Tracks: FULL vs PARTIAL run, status (DRAFT | APPROVED | PAID),
        totals (grossSum, netSum, tdsSum, pfSum, esiSum, ptSum)
```

---

## 13. Field Visibility & Stripping Logic

**`stripSensitive(profile, fullAccess)`** in [src/routes/teamforce/_helpers.ts](src/routes/teamforce/_helpers.ts)

```
hasFullAccess = true  →  all fields returned
hasFullAccess = false →  the following fields removed from response:
```

| Category | Fields Stripped |
|----------|----------------|
| Salary | `salaryStructureId`, `monthlyCtc`, `basicSalary`, `hra`, `transportAllowance`, `providentFund`, `professionalTax`, `variablePay`, `customAllowances`, `customDeductions` |
| Tax | `tdsRegime`, `estimatedAnnualTds`, `autoCalculateTds` |
| PF/ESI | `pfOption`, `esiApplicable` |
| Reporting | `reportingManagerId`, `secondaryReviewerId`, `managesTeam` |
| Attendance | `shiftId`, `weeklyOffPatternId` |
| Documents | `offerLetterUrl` (offer letter is admin-uploaded; ID proof, education certs, experience letters are employee-visible) |
| Exit / F&F | `exitedAt`, `exitReason` |

**Bank Account Details** (`bankAccountHolderName`, `bankAccountType`, `bankAccountNumber`, `bankIfscCode`) are **NOT stripped** — employees can view and edit their own bank details via self-edit.

**`hasFullAccess` is true when:**
- `req.user.role === "founder"`, OR
- The requesting user's `TeamforceEmployeeProfile.teamforceRole === "admin"` for this org

---

## 14. Payroll Integration

The `TeamforceEmployeeProfile` is the data source for monthly payroll runs.

### How the Payroll Engine Uses Employee Data

| Profile Field | Payroll Usage |
|---------------|---------------|
| `salaryStructureId` | Determines earnings/deductions component template |
| `monthlyCtc` | Anchor for %-based component calculations (e.g., BASIC = 40% of CTC) |
| `state` | Used to look up applicable Professional Tax slab |
| `dateOfBirth` | Age calculation for senior-citizen exemptions in TDS |
| `tdsRegime` | Selects new vs. old tax regime for TDS computation |
| `pfOption` | `CEILING` = cap PF at ₹12k/month; `ACTUAL` = full 12% of basic |
| `esiApplicable` | Whether to compute ESI deduction |
| `autoCalculateTds` | If true, engine auto-computes; otherwise uses `estimatedAnnualTds` |
| `shiftId` + `weeklyOffPatternId` | Attendance → LOP days calculation |
| `deferredLopDays` | Grace-window LOP from prior month; carried forward, reset after payroll |
| `exitedAt` | When set, triggers F&F settlement: full remaining TDS liability, not prorated |
| `exitReason` | Stored on payroll run for audit |

### Payroll Eligibility Check
An employee is included in a payroll run if:
```
profile.salaryStructureId exists AND
profile.monthlyCtc > 0 AND
salary structure is active (isActive: true)
```
Employees without these are skipped with reason codes: `no_salary_structure`, `no_monthly_ctc`.

### Tax Declaration Integration
During TDS calculation:
1. Load `TeamforceEmployeeTaxDeclaration` for `{ userId, orgId, fy }`.
2. Apply 80C, HRA, 80D, NPS, LTA, and other deductions.
3. Include previous employer income/TDS for mid-FY joiners.
4. Result: reduced taxable income → lower TDS per month.

---

## 15. Error Reference

| Status | `error` field | Cause |
|--------|--------------|-------|
| `400` | `"No organization selected"` | No `orgId` in query or JWT |
| `400` | `"<field>: <message>; ..."` | Zod validation failure on POST body — field path + message, multiple errors joined with `"; "` |
| `401` | `"Missing auth"` | No `Authorization` header |
| `401` | `"Invalid token"` | JWT expired or malformed |
| `403` | `"Requires founder or Teamforce Admin role"` | POST/DELETE without write access |
| `403` | `"Founder access required"` | PATCH /role by non-founder |
| `403` | `"Requires founder, admin, or manager role"` | Recruitment actions without access |
| `404` | `"Employee not found in this organization"` | GET/:userId or PATCH on userId not in org |
| `404` | `"User not found in this organization"` | PATCH /role on userId not in org |

**All error responses use the shape `{ "error": "..." }` — never `{ "message": "..." }` for endpoint-generated errors.**

---

## 16. Bulk Upload CSV Integration

The frontend `BulkUploadView` in `AddEmployeeSection.tsx` lets admins import multiple employees at once by uploading a CSV. Each valid row calls `POST /teamforce/employees` individually.

### CSV Template Format

| Column (exact header) | Maps to API field | Notes |
|-----------------------|-------------------|-------|
| `Full Legal Name` | `name` | |
| `Mobile Number` | `mobileNumber` | Any format accepted |
| `Email ID` | `email` | **Required** — rows without email are skipped |
| `Pan` | `pan` | |
| `Date of Joining` | `dateOfJoining` | `dd/mm/yyyy` or `dd-mm-yyyy` or `yyyy-mm-dd` — all accepted; converted to ISO before sending |
| `Place of Joining` | `placeOfJoining` | |
| `Branch` | `branchId` | Display name → resolved to ObjectId via `GET /teamforce/branches` |
| `Department` | `departmentId` | Display name → resolved to ObjectId via `GET /teamforce/departments` |
| `Designation` | `designation` | |
| `Employment Type` | `employmentType` | Display value normalised to API enum — see table below |

### Employment Type Normalisation

The frontend maps common display variants to the API enum before sending:

| CSV value (case-insensitive) | API value sent |
|------------------------------|---------------|
| `Full Time`, `Full-Time`, `Fulltime` | `full-time` |
| `Part Time`, `Part-Time`, `Parttime` | `part-time` |
| `Contract`, `Contractor` | `contract` |
| `Intern`, `Internship` | `intern` |
| `Freelance`, `Freelancer` | `freelance` |

Any unrecognised value is passed through as-is and will fail Zod validation on the backend, surfacing a clear 400 error in the upload error modal.

### Duplicate Detection (Frontend)

Before calling the API, the frontend performs two duplicate checks:

1. **Duplicate within CSV** — if the same email appears on a second row in the same file, that row is skipped and reported as `"Duplicate email in CSV — skipped"`.
2. **Already exists in org** — existing org member emails (fetched via `GET /teamforce/employees` at upload time) are blocked and reported as `"Employee already exists in this organization"`.

Skipped rows are shown in the per-row error modal; they do **not** count as successful imports.

### File Format

Only **CSV** files (`.csv`) are accepted. Excel (`.xlsx`/`.xls`) is not supported — uploading a non-CSV file shows an error immediately on selection before any data is processed.

### Data Preview

After selecting a file, a paginated preview table is shown (10 rows per page, Prev/Next controls) so admins can verify the data before clicking Upload.

### Upload Behaviour

- Rows are processed sequentially (one `POST /teamforce/employees` per valid row).
- If **all rows succeed**: success toast + navigate back to employee list.
- If **any row fails**: error modal appears listing each failed/skipped row with its reason; page stays on the bulk upload view for correction.
- Successful rows within a partially-failed batch are committed — there is no transaction/rollback.

---

## 17. Key Files

| File | Purpose |
|------|---------|
| [src/routes/teamforce/employees.ts](src/routes/teamforce/employees.ts) | All 6 employee endpoints |
| [src/routes/teamforce/index.ts](src/routes/teamforce/index.ts) | Teamforce router composition |
| [src/routes/teamforce/_helpers.ts](src/routes/teamforce/_helpers.ts) | Auth helpers, access control, field stripping |
| [src/models/teamforce/teamforceEmployeeProfile.model.ts](src/models/teamforce/teamforceEmployeeProfile.model.ts) | Main employee HR data schema |
| [src/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts](src/models/teamforce/teamforceEmployeeTaxDeclaration.model.ts) | Per-FY tax declaration schema |
| [src/models/teamforce/teamforceBranch.model.ts](src/models/teamforce/teamforceBranch.model.ts) | Branch reference model |
| [src/models/teamforce/teamforceDepartment.model.ts](src/models/teamforce/teamforceDepartment.model.ts) | Department reference model |
| [src/models/teamforce/teamforceShift.model.ts](src/models/teamforce/teamforceShift.model.ts) | Shift reference model |
| [src/models/teamforce/teamforceWeeklyOffPattern.model.ts](src/models/teamforce/teamforceWeeklyOffPattern.model.ts) | Weekly off pattern reference model |
| [src/models/teamforce/teamforceSalaryStructure.model.ts](src/models/teamforce/teamforceSalaryStructure.model.ts) | Salary template model |
| [src/models/teamforce/teamforcePayrollRun.model.ts](src/models/teamforce/teamforcePayrollRun.model.ts) | Monthly payroll run tracking |
| [src/models/user.model.ts](src/models/user.model.ts) | Core User with multi-org memberships |
| [src/middleware/auth.ts](src/middleware/auth.ts) | JWT authentication middleware |
| [src/app.ts](src/app.ts) | Route mounting (`/teamforce` at line 337) |
