# `server/services/taskroomProvision.ts`

> src/services/taskroomProvision.ts

**Kind:** backend service · **Lines:** 1350

<!-- docgen:auto -->

## Purpose
src/services/taskroomProvision.ts

Provisions an isolated Taskroom room for a single service engagement
(ServiceOpt), and reads that room back on the client's behalf.

Design constraints this file exists to satisfy:

 1. Taskroom v2 is a separate microservice that we do not own. Every call
    below uses an endpoint the Taskroom UI already calls, with the same
    payload shape. No schema change, no new endpoint, no behaviour change on
    that side — a provisioned room is indistinguishable from a hand-made one.

 2. Taskroom v2 has no per-stage visibility flag. The internal/shared
    boundary therefore lives here: the stage ids we create for internal
    columns are recorded on the opt-in as `taskroom.internalStageIds` and
    stripped by `getClientBoard` before anything reaches the client. The […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TaskroomRole` | type |  | 50 |
| `TaskroomCard` | interface |  | 65 |
| `TaskroomStage` | interface |  | 83 |
| `mintUserToken` | function | `async mintUserToken(userId: string \| Types.ObjectId, orgId: string \| Types.ObjectId): Promise<string>` — Mint a short-lived Garage JWT for a user so we can act as them against Taskroom v2, which authenticates with the same token the web app holds. | 100 |
| `taskroomRequest` | function | `async taskroomRequest(path: string, { method = "GET", body, token }: TaskroomRequestOptions): Promise<T>` — Thin wrapper over the Taskroom v2 REST surface. | 130 |
| `ensureCompletedStage` | function | `ensureCompletedStage(stages: IServiceStageTemplate[]): IServiceStageTemplate[]` — Guarantee a client-visible Completed column and order the board as working columns, then Completed, then the internal ones. | 296 |
| `resolveStageTemplates` | function | `resolveStageTemplates(service: Pick<IService, "milestones" \| "taskroomConfig">): IServiceStageTemplate[]` — Build the stage list to seed. | 336 |
| `ensureRoomMembership` | function | `async ensureRoomMembership(token: string, { orgId, workspaceId, spaceId, roomId, person, role, }: { o…): Promise<string>` — Give somebody access to an engagement room, at the role they belong at: `observer` for the client, `member` for the people delivering the work. | 579 |
| `provisionEngagementRoom` | function | `async provisionEngagementRoom(optInId: string \| Types.ObjectId): Promise<IServiceOpt \| null>` — Provision the engagement room for an opt-in, recording the outcome on the opt-in document. | 971 |
| `provisionEngagementRoomAsync` | function | `provisionEngagementRoomAsync(optInId: string \| Types.ObjectId): void` — Fire-and-forget wrapper for checkout paths. | 1051 |
| `ClientBoardStage` | interface |  | 1064 |
| `ClientBoardMember` | interface | A delivery-team member as the client sees them: no rate, no email. | 1074 |
| `ClientBoard` | interface |  | 1080 |
| `DEFAULT_CLIENT_ACCESS` | const | `= { showTaskroomBoard: true, showActivityLogs: true, enableFilesTab: true, revealTimelogS…` | 1103 |
| `getClientBoard` | function | `async getClientBoard(optIn: IServiceOpt, service: IService, options: { /** * Founders reading their own engagement stil…): Promise<ClientBoard \| null>` — Read an engagement board on the client's behalf, with internal columns removed. | 1121 |
| `EngagementRoomFile` | interface |  | 1250 |
| `getRoomFiles` | function | `async getRoomFiles(optIn: IServiceOpt, service: IService): Promise<EngagementRoomFile[]>` — Files attached to cards in the engagement room. | 1265 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.app${path}` (L138)
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `ServiceOpt` (server/models/serviceOpt.model.ts) — reads: `findById`
  - `Service` (server/models/service.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `TASKROOM_V2_URL`, `NEXT_PUBLIC_TASKROOM_URL`
- **Timers / queues:** `setTimeout` at L135
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:**
  - `server/models/service.model.ts` — `Service`, `IService`, `IServiceStageTemplate`, `IServiceTaskTemplate`
  - `server/models/serviceOpt.model.ts` — `ServiceOpt`, `IServiceOpt`
  - `server/models/user.model.ts` — `User`
  - `server/services/jwt.ts` — `signJwt`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/service.ts`
- `server/routes/serviceCheckout.ts`
- `server/services/__tests__/groupTaskroom.test.ts`
- `server/services/groupTaskAuto.ts`
- `server/services/groupTaskManual.ts`
- `server/services/groupTaskRemoval.ts`
- `server/services/groupTaskroom.ts`
- `server/services/groupTaskroomActor.ts`
- `server/services/supportChatTaskroom.ts`
- `server/services/supportTicketTaskroom.ts`
