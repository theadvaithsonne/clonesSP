# `server/models/notification.model.ts`

> Mongoose model for org-scoped in-app notifications: Betty chat messages, leave requests, task assignments, mentions, join requests and system notices.

**Kind:** Mongoose model · **Lines:** 54

## Purpose
`Notification` stores per-user, per-organization notifications shown in the app's notification surfaces. It began with Betty (the assistant) and leave requests, then grew to cover mentions in groups, posts and comments, plus join requests. A separate `UserNotification` model also exists and is used by other parts of `realtime/socket.ts`, so not every notification lives here.

## How it works
- Fields:
  - `userId` (ref `User`, required, indexed) - recipient; `orgId` (ref `Organization`, **required**, indexed).
  - `type` (required, indexed) - one of `betty_chat`, `leave_request`, `todo_assigned`, `system`, `group_mention`, `join_request`, `post_mention`, `comment_mention`.
  - `priority` - `low` | `normal` (default) | `high`, intended for mention notifications.
  - `title`, `message` - required, trimmed.
  - `data` - `Mixed` payload (for example a leave-request id) that the client uses to deep-link.
  - `isRead` (default false, indexed), `readAt`.
  - `chatMessageId` - unique identifier for Betty chat messages (not a unique index).
  - `senderType` - `user` | `betty` | `system` (default).
- Timestamps on.
- Compound indexes: `{ userId: 1, orgId: 1, createdAt: -1 }` (a user's feed in an org), `{ userId: 1, isRead: 1 }` (unread count), `{ orgId: 1, type: 1 }`.

## Exports
- `Notification` - Mongoose model `"Notification"`.

## Interfaces
- **Database:** `Notification` (collection `notifications`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/realtime/socket.ts` - bulk-inserts mention notifications (`insertMany`).
- `server/routes/betty.ts` (`/betty`) - Betty chat and leave-request notifications.
- `server/routes/guestAuth.ts` (`/guest-auth`) - `join_request` notifications.
- `server/services/feed.ts` - post/comment mentions.
- `server/services/supportChat.ts` - `insertMany` of support-chat notifications.
- `server/services/memberCleanup.service.ts` - `deleteMany` of a removed member's notifications.

## Notes
- Adding a new notification kind requires extending the `type` enum here; otherwise saves fail validation.
- `orgId` is required, so this model cannot hold org-less (global) notifications.
