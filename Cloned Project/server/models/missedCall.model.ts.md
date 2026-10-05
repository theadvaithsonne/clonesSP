# `server/models/missedCall.model.ts`

> Mongoose model for WhatsApp-style missed-call records, written when a workspace "knock" goes unanswered.

**Kind:** Mongoose model · **Lines:** 84

## Purpose
When someone knocks (rings) a user in the workspace and the knock auto-expires unanswered (45 seconds, per the header comment), a `MissedCall` row is created for the recipient. The web and mobile headers show a missed-call badge from these rows. Other call surfaces (1-on-1 bookings, conference rooms) intentionally do not create missed calls, because "didn't show up" means something different for scheduled, opt-in flows. Declining a knock is also excluded, because it is a deliberate action rather than a miss.

## How it works
- Fields:
  - `toUserId`, `fromUserId` - ref `User`, required, indexed.
  - `orgId` - ref `Organization`, optional, sparse index. It is the org the recipient was active in, and may be missing for cross-org knocks (for example a global DM contact ringing while the recipient is on another org's surface).
  - `kind` - enum `["knock"]`, default `knock`. A forward-compatibility lever for adding more sources without a migration.
  - `fromName`, `fromAvatar` - a snapshot of the caller at the time of the miss. This saves a populate on every list read and keeps old entries meaningful if the caller later renames.
  - `occurredAt` - required, default now.
  - `viewedAt` - set when the recipient opens the missed-calls list (clears the badge).
  - `dismissedAt` - explicit dismiss, sparse index. Dismissed rows are filtered out of the default list but kept. Rows are never deleted, for history.
- Timestamps on.
- Indexes:
  - `{ toUserId: 1, viewedAt: 1, dismissedAt: 1 }` - covers the unviewed-count badge query that clients poll.
  - `{ toUserId: 1, occurredAt: -1 }` - newest-first list.

## Exports
- `MissedCall` - Mongoose model `"MissedCall"`.
- `IMissedCall` - interface.

## Interfaces
- **Database:** `MissedCall` (collection `missedcalls`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/realtime/socket.ts` - `MissedCall.create(...)` when a knock expires (`expireKnock`).
- `server/routes/missedCall.ts` (mounted at `/missed-calls`, browser `/backend/missed-calls`) - list, count, mark viewed, dismiss.
