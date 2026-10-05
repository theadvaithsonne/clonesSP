# `server/services/supportTicketTaskroom.ts`

> Mirror every support ticket onto one shared Taskroom board.

**Kind:** backend service · **Lines:** 500

<!-- docgen:auto -->

## Purpose
Mirror every support ticket onto one shared Taskroom board.

Shorupan's decision ("option 1"): rather than a separate ticket console, each
ticket we create also lands as an UNASSIGNED card on a single "Garage Support"
board that the support team already works in. Assignment is then done by hand
inside the taskroom — NVC/support tickets don't tag anyone, so nothing is
auto-assigned here.

The board is provisioned once, lazily, on the first ticket (create a
workspace → space → room in Taskroom v2, acting as the super admin) and its
coordinates cached on the SupportTicketBoard singleton. Everything is
best-effort and never throws into ticket creation: a Taskroom hiccup must
never stop a ticket being filed.

Reuses Rehan's Taskroom v2 client (taskroomProvision.ts) verbatim — same
endpoints the web app calls, so a provisioned board is indistinguishable from […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createTaskForTicket` | function | `async createTaskForTicket(ticketId: string): Promise<void>` — Mirror one ticket onto the support board as an unassigned card. | 233 |
| `SupportBoardInfo` | interface |  | 315 |
| `getSupportBoardInfo` | function | `async getSupportBoardInfo(): Promise<SupportBoardInfo>` — Where support tasks currently go. | 328 |
| `SupportBoardOption` | interface |  | 343 |
| `listSupportBoardOptions` | function | `async listSupportBoardOptions(): Promise<SupportBoardOption[]>` — Every workspace and board the owner can post to. | 350 |
| `ResolvedBoard` | interface | Point support tasks at a board. | 396 |
| `resolveBoardAsOwner` | function | `async resolveBoardAsOwner(workspaceId: string, roomId: string): Promise<ResolvedBoard>` — Validate a board as the support board owner: live, in the given workspace, and postable (the owner can read its columns). | 411 |
| `getSharedSupportBoard` | function | `async getSharedSupportBoard(): Promise<ResolvedBoard \| null>` — The shared support board, provisioning it if needed; null if unavailable. | 450 |
| `setSupportBoard` | function | `async setSupportBoard(input: { workspaceId: string; roomId: string; selectedBy: s…): Promise<SupportBoardInfo>` | 465 |

## Interfaces

- **Database (Mongoose models used):**
  - `SupportTicketBoard` (server/models/supportTicketBoard.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
- **Environment variables (`process.env`):** `SUPPORT_TICKET_TASKROOM_DISABLED`, `SUPPORT_TICKET_TASKROOM_OWNER_EMAIL`, `SUPPORT_TICKET_TASKROOM_ORG_ID`, `SUPPORT_TICKET_TASKROOM_ROOM_ID`, `SUPPORT_TICKET_TASKROOM_STAGE_ID`

## Dependencies

- **Internal:**
  - `server/models/supportTicketBoard.model.ts` — `SupportTicketBoard`
  - `server/services/taskroomProvision.ts` — `mintUserToken`, `taskroomRequest`
  - `server/services/groupTaskroom.ts` — `pickLandingStageId`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/models/ticket.model.ts`
- `server/routes/garageAdminTickets.ts`
- `server/services/supportChatTaskroom.ts`
