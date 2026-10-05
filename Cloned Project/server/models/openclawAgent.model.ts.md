# `server/models/openclawAgent.model.ts`

> Mongoose model `OpenClawAgent` (collection `openclawagents`) with 14 top-level fields.

**Kind:** Mongoose model · **Lines:** 72

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OpenClawAgent`

- **Collection:** `openclawagents` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `agentId` | `String` | required, unique |
| `name` | `String` | required |
| `role` | `String` | default "" |
| `emoji` | `String` | default "" |
| `agentType` | `String` | default "default", enum ["default", "qa", "voice"] |
| `qaWelcomeMessage` | `String` | default "" |
| `qaPersonaInstructions` | `String` | default "" |
| `qaPageTitle` | `String` | default "" |
| `qaPageSubtitle` | `String` | default "" |
| `llmModel` | `String` | default null, enum [ "openai/gpt-5.1", "openai/gpt-4.1", "open… |
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `deletedAt` | `Date` | index, default null |
| `assignedUserIds` | `[{ type: Schema.Types.ObjectId, ref: "User" }]` | default [] |

### Indexes

- `{ orgId: 1 }` (L67)
- `{ createdBy: 1 }` (L68)
- `{ orgId: 1, deletedAt: 1 }` (L69)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OpenClawAgent` | model | `model("OpenClawAgent", OpenClawAgentSchema)` | 71 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/realtime/openclawWs.ts`
- `server/routes/openclawAgent.ts`
- `server/routes/wallet.ts`
- `server/scripts/migrate-openclaw-agents.ts`
- `server/utils/billingUser.ts`
- `server/utils/openclawAccess.ts`
