# `server/models/serviceOpt.model.ts`

> Mongoose model `ServiceOpt` (collection `serviceopts`) with 16 top-level fields.

**Kind:** Mongoose model · **Lines:** 402

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ServiceOpt`

- **Collection:** `serviceopts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `serviceId` | `Schema.Types.ObjectId` | required, index, ref "Service" |
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `organizationId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `status` | `String` | default "opted", enum ["opted", "in_progress", "completed", "canc… |
| `optedAt` | `Date` | default Date.now |
| `completedAt` | `Date` | — |
| `cancelledAt` | `Date` | — |
| `totalAmount` | `Number` | default 0 |
| `amountPaid` | `Number` | default 0 |
| `amountPending` | `Number` | default 0 |
| `currency` | `String` | default "USD" |
| `milestonesProgress` | `[MilestoneProgressSchema]` | default [] |
| `completedMilestones` | `Number` | default 0 |
| `totalMilestones` | `Number` | default 0 |
| `progressPercentage` | `Number` | default 0 |
| `taskroom` | `ServiceOptTaskroomSchema` | default undefined |

### Indexes

- `{ serviceId: 1, userId: 1 }, { unique: true }` (L340)
- `{ userId: 1, organizationId: 1, status: 1 }` (L343)
- `{ serviceId: 1, status: 1 }` (L346)
- `{ "taskroom.status": 1, "taskroom.attempts": 1 }` (L349)
- `{ "taskroom.roomId": 1 }` (L352)
- `{ organizationId: 1, "milestonesProgress.paymentStatus": 1, }` (L355)

**Schema hooks / virtuals:** `pre("save")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IMilestoneProgress` | interface |  | 4 |
| `IServiceOptTaskroom` | interface |  | 51 |
| `IServiceOpt` | interface |  | 82 |
| `ServiceOpt` | model | `mongoose.model<IServiceOpt>( "ServiceOpt", ServiceOptSchema )` | 398 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/service.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/unifiedOrders.ts`
- `server/services/review.ts`
- `server/services/service.ts`
- `server/services/taskroomProvision.ts`
