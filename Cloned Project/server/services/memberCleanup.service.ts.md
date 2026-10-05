# `server/services/memberCleanup.service.ts`

> Module exporting `CleanupResult`, `RemoveFromOrgOptions`, `memberCleanupService`.

**Kind:** backend service · **Lines:** 585

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CleanupResult` | interface |  | 61 |
| `RemoveFromOrgOptions` | interface |  | 77 |
| `memberCleanupService` | const | `= new MemberCleanupService()` | 584 |

## Interfaces

- **Socket.IO events:**
  - emits: `member:removed`, `member:deleted`, `session:terminated`
- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — reads: `find`; **writes:** `updateMany`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — **writes:** `deleteMany`
  - `Booking` (server/models/booking.model.ts) — **writes:** `updateMany`, `deleteMany`
  - `Task` (server/models/task.model.ts) — **writes:** `updateMany`, `deleteMany`
  - `Todo` (server/models/todo.model.ts) — **writes:** `deleteMany`
  - `Notification` (server/models/notification.model.ts) — **writes:** `deleteMany`
  - `UserActivity` (server/models/userActivity.model.ts) — **writes:** `deleteMany`
  - `User` (server/models/user.model.ts) — reads: `findById`; **writes:** `updateOne`, `updateMany`, `deleteOne`
  - `Message` (server/models/message.model.ts) — **writes:** `deleteMany`
  - `GroupMessage` (server/models/groupMessage.model.ts) — **writes:** `updateMany`
  - `Post` (server/models/post.model.ts) — **writes:** `deleteMany`, `updateMany`
  - `PostComment` (server/models/postComment.model.ts) — **writes:** `deleteMany`
  - `PostLike` (server/models/postLike.model.ts) — **writes:** `deleteMany`
  - `PostBookmark` (server/models/postBookmark.model.ts) — **writes:** `deleteMany`
  - `PostRepost` (server/models/postRepost.model.ts) — **writes:** `deleteMany`
  - `PollVote` (server/models/pollVote.model.ts) — **writes:** `deleteMany`
  - `UserFile` (server/models/cabinet.model.ts) — reads: `find`; **writes:** `deleteMany`
  - `UserCabinet` (server/models/cabinet.model.ts) — **writes:** `deleteMany`
  - `FloorCabinet` (server/models/cabinet.model.ts) — **writes:** `updateMany`
  - `FloorFile` (server/models/cabinet.model.ts) — **writes:** `updateMany`
  - `OrganizationCabinet` (server/models/cabinet.model.ts) — **writes:** `updateMany`
  - `OrganizationFile` (server/models/cabinet.model.ts) — **writes:** `updateMany`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/message.model.ts` — `Message`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/booking.model.ts` — `Booking`
  - `server/models/task.model.ts` — `Task`
  - `server/models/todo.model.ts` — `Todo`
  - `server/models/notification.model.ts` — `Notification`
  - `server/models/userActivity.model.ts` — `UserActivity`
  - `server/models/post.model.ts` — `Post`
  - `server/models/postComment.model.ts` — `PostComment`
  - `server/models/postLike.model.ts` — `PostLike`
  - `server/models/postBookmark.model.ts` — `PostBookmark`
  - `server/models/postRepost.model.ts` — `PostRepost`
  - `server/models/pollVote.model.ts` — `PollVote`
  - `server/models/cabinet.model.ts` — `UserCabinet`, `UserFile`, `FloorCabinet`, `FloorFile`, `OrganizationCabinet`, `OrganizationFile`
  - `server/services/s3.ts` — `s3Service`
  - `server/services/socket.ts` — `getSocketInstance`
  - `server/services/groupTaskroom.ts` — `requestGroupTaskroomSync`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/membership.ts`
- `server/routes/team.ts`
