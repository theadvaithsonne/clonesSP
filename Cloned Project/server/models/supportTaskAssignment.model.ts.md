# `server/models/supportTaskAssignment.model.ts`

> Mongoose model caching who a support-chat Taskroom card was assigned to from the admin console, so the console can show assignees without calling Taskroom.

**Kind:** Mongoose model · **Lines:** 27

## Purpose
In the admin Support Chats console, staff can "Assign to..." a Taskroom card created from a support chat. That covers both "Add to Taskroom" cards and mirrored tickets. Taskroom (an external service) holds the real assignment. This local copy lets the console show the assignee on each task note without a Taskroom round-trip per message.

## How it works
- Fields: `groupId` (ObjectId -> `Group`, the support chat; required, indexed), `taskId` (Taskroom card id, string, required), `userId` (ObjectId -> `User`, required), `name` (display name, required), `assignedBy` (string, default null).
- Only `createdAt` is recorded (`timestamps: { createdAt: true, updatedAt: false }`).
- A unique index on `{ groupId, taskId, userId }` allows several assignees per card but no duplicate rows.
- The collection name is explicitly `support_task_assignments`.

## Exports
- `SupportTaskAssignment` - Mongoose model `"SupportTaskAssignment"` bound to `support_task_assignments`.

## Interfaces
- **Database:** `SupportTaskAssignment` (collection `support_task_assignments`) - read, upserted and deleted.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/supportChatTaskroom.ts`, which loads the model with a dynamic import. It lists assignments with `find({ groupId })`, records an assignment with `updateOne` (upsert), and clears a card's assignments with `deleteMany({ groupId, taskId })`.
