# `server/services/supportChat.ts`

> src/services/supportChat.ts

**Kind:** backend service · **Lines:** 572

<!-- docgen:auto -->

## Purpose
src/services/supportChat.ts

Support chats: one group per user, created the first time their profile is
completed (routes/profile.ts), holding

  • the user                       — role "member", can't leave
  • their upline (referredBy)      — role "member"; default sponsor if none
  • every active garage admin      — role "admin", via their User account
  • their assigned support agent   — the assignedSupportAgentId admin

Garage admins are a separate identity (GarageAdmin) from app users, and a
group message's `from` must be a User. Every admin has a User account on the
same email, so that account is the one placed in the group and the one an
admin console reply is sent as.

Membership is kept in sync from the events that change it rather than being […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SUPPORT_ORG_ID` | const | `= "68f1fe05876fcc5fadb61951"` — Garage HQ — the org every support group is filed under. | 31 |
| `DEFAULT_SPONSOR_EMAIL` | const | `= "shorupan@gmail.com"` — Upline for users with no referrer — the same default sponsor profile.ts uses. | 34 |
| `isSupportGroup` | function | `isSupportGroup(g: any): boolean` | 43 |
| `isSupportStaff` | function | `isSupportStaff(g: any, userId: string): boolean` — Staff = a support group's "admin"-role members. | 48 |
| `activeStaffUserIds` | function | `async activeStaffUserIds(): Promise<Types.ObjectId[]>` — User ids of every active, non-excluded garage admin. | 69 |
| `supportGroupName` | function | `supportGroupName(user: any): string` — "Garage \| NVC \| <member> \| <city>" — the naming the Garage team already uses for its WhatsApp member groups, so a support chat reads the same wherever staff meet it. | 102 |
| `ensureSupportGroup` | function | `async ensureSupportGroup(userId: string \| Types.ObjectId): Promise<Types.ObjectId \| null>` — Create the user's support chat, or bring an existing one's membership and name up to date (a profile save may have changed the name or city). | 120 |
| `addStaffToAllSupportGroups` | function | `async addStaffToAllSupportGroups(staffUserId: Types.ObjectId): Promise<void>` — Put a staff user into every support chat (as admin), or promote them where they're already a plain member (e.g. | 209 |
| `removeStaffFromSupportGroups` | function | `async removeStaffFromSupportGroups(staffUserId: Types.ObjectId): Promise<void>` — Take a former staff user out of the support chats — except where they have their own reason to be there: it's their chat, they're the upline (they stay as a plain member), or they're still the assigned agent. | 230 |
| `syncAdminSupportMembership` | function | `async syncAdminSupportMembership(admin: { email?: string \| null; isActive?: boolean \| null; }): Promise<void>` — Bring one admin's support-chat membership in line with their status. | 251 |
| `syncSupportUpline` | function | `async syncSupportUpline(userId: string \| Types.ObjectId): Promise<void>` — Swap the upline in a user's support chat after their referrer changed. | 269 |
| `syncSupportAgent` | function | `async syncSupportAgent(userId: string \| Types.ObjectId): Promise<void>` — Reflect a changed assignedSupportAgentId in the user's support chat: the new agent joins as staff and is recorded; an unassigned agent stays only if they are still active staff anyway. | 304 |
| `recordSupportMessage` | function | `async recordSupportMessage(group: any, msg: { from?: any; text?: string; attachments?: any[]; crea…): Promise<void>` — Record a new top-level message on a support group: the denormalised last message (list preview + "unanswered" flag) and the list sort key. | 355 |
| `postGroupMessageAs` | function | `async postGroupMessageAs(opts: { groupId: string; fromUserId: string; text: string; …): Promise<any>` — Post a top-level text message into a group as `fromUserId`, server-side — how an admin-console reply reaches the chat. | 391 |

## Interfaces

- **Socket.IO events:**
  - emits: `group:message`, `notification:new`
- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `find`, `findById`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `find`, `findById`
  - `Group` (server/models/group.model.ts) — reads: `findOne`, `findById`; **writes:** `updateOne`, `create`, `updateMany`

## Dependencies

- **Internal:**
  - `server/models/group.model.ts` — `Group`
  - `server/models/user.model.ts` — `User`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/realtime/socket.ts`
- `server/routes/affiliate.ts`
- `server/routes/garageAdminDangerZone.ts`
- `server/routes/garageAdminNetworkChainSubs.ts`
- `server/routes/garageAdminSupportChats.ts`
- `server/routes/groups.ts`
- `server/routes/profile.ts`
- `server/scripts/backfill-support-chats.ts`
- `server/services/groupTaskroom.ts`
