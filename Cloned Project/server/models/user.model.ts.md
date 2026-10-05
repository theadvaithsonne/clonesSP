# `server/models/user.model.ts`

> src/models/user.model.ts (add fields if missing)

**Kind:** Mongoose model · **Lines:** 525

<!-- docgen:auto -->

## Purpose
src/models/user.model.ts  (add fields if missing)

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `User`

- **Collection:** `users` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `email` | `String` | — |
| `name` | `String` | — |
| `organization` | `Schema.Types.ObjectId` | ref "Organization" |
| `role` | `String` | default "user", enum ["admin", "user", "founder", "stakeholder"] |
| `organizations` | `[OrgMembershipSchema]` | — |
| `isVerified` | `Boolean` | default false |
| `department` | `String` | — |
| `country` | `String` | — |
| `state` | `String` | — |
| `city` | `String` | — |
| `postalCode` | `String` | — |
| `phone` | `String` | — |
| `phoneVerified` | `Boolean` | default false |
| `latitude` | `Number` | — |
| `longitude` | `Number` | — |
| `level2Field1` | `String` | — |
| `level2Field2` | `String` | — |
| `profileComplete` | `Boolean` | default false |
| `profileCompletedAt` | `Date` | default Date.now |
| `offerExpiresAtOverride` | `Date` | — |
| `offerExtendedAt` | `Date` | — |
| `offerExtendedByAdminId` | `Schema.Types.ObjectId` | ref "GarageAdmin" |
| `offerExtendedByUserId` | `Schema.Types.ObjectId` | ref "User" |
| `paymentProfile` | `{ stripe, razorpay, removedInstruments }` | nested |
| `profilePicture` | `String` | — |
| `designation` | `String` | trim |
| `isFirstTimeUser` | `Boolean` | default false |
| `affiliateId` | `String` | unique, sparse |
| `referredBy` | `Schema.Types.ObjectId` | ref "User" |
| `referredBySource` | `String` | enum ["affiliate", "founder_default"] |
| `ancestors` | `[{ type: Schema.Types.ObjectId, ref: "User" }]` | default [] |
| `depth` | `Number` | default 0 |
| `legNumber` | `Number` | default null |
| `directsCount` | `Number` | default 0 |
| `downlineCount` | `Number` | default 0 |
| `typeFlags` | `{ oneNetworkActivated, networkChainsSub, founderSub }` | nested |
| `rank1` | `String` | default null |
| `rank2` | `String` | default null |
| `ncRank` | `{ current, periodKey, updatedAt }` | nested |
| `assignedSupportAgentId` | `Schema.Types.ObjectId` | index, ref "GarageAdmin" |
| `assignedSupportAgentAt` | `Date` | — |
| `assignedSupportAgentBy` | `Schema.Types.ObjectId` | ref "GarageAdmin" |
| `nvcChatCreatedAt` | `Date` | — |
| `nvcChatCreatedBy` | `Schema.Types.ObjectId` | ref "GarageAdmin" |
| `guest` | `Boolean` | default false |
| `openclawAgents` | `[{ agentId, name, orgId }]` | nested |
| `mailboxes` | `[{ organization, created, email, localPart, domain, credentials, createdAt, isActive }]` | nested |
| `lastSeenAt` | `Date` | — |

### Indexes

- `{ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } }` (L345)
- `{ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } }` (L349)
- `{ "organizations.organization": 1 }` (L353)
- `{ affiliateId: 1 }` (L354)
- `{ referredBy: 1 }` (L355)
- `{ ancestors: 1 }` (L357)
- `{ ancestors: 1, depth: 1 }` (L358)
- `{ "openclawAgents.orgId": 1 }` (L359)
- `{ lastSeenAt: -1 }` (L360)

**Schema hooks / virtuals:** `pre("save")`, `post("save")`, `post("findOneAndUpdate")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `User` | model | `model("User", UserSchema)` | 524 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `scripts/inspect-push-tokens.ts`
- `scripts/mint-synthetic-combo.ts`
- `scripts/test-commission-push.ts`
- `scripts/test-franchise-e2e.ts`
- `scripts/test-knock-push.ts`
- `scripts/test-transfer-push.ts`
- `server/bat246/__tests__/bat246.controller.test.ts`
- `server/bat246/__tests__/bat246Admin.service.test.ts`
- `server/bat246/controllers/bat246.controller.ts`
- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/routes/bat246LostMoney.routes.ts`
- `server/bat246/routes/bat246Permission.routes.ts`
- `server/bat246/scripts/addPlayersToOrg.ts`
- `server/bat246/scripts/addTestUsers10to19.ts`
- `server/bat246/scripts/createAlanKFreeCoupon.ts`
- `server/bat246/scripts/fixMissingAB8Entry.ts`
- `server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts`
- `server/bat246/scripts/seedBat246.ts`
- `server/bat246/scripts/seedBat246Product.ts`
- `server/bat246/scripts/seedBat246ProductForOrg.ts`
- `server/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts`
- `server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`
- `server/bat246/services/bat246.service.ts`
- `server/bat246/services/bat246Admin.service.ts`
- `server/bat246/services/bat246BoardInvite.service.ts`
- _…and 304 more_
