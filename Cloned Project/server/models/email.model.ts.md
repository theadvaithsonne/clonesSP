# `server/models/email.model.ts`

> Mongoose model that caches email messages synced over IMAP from a user's org mailbox, and records messages sent from the app.

**Kind:** Mongoose model · **Lines:** 122

## Purpose
In Initial Setup, an organisation can connect its own domain to a hosted mail server and create mailboxes for users. The built-in mail client then syncs messages from that mailbox into this collection so the inbox can be listed and paged without hitting IMAP on every request. Messages sent through the app are stored here too.

## How it works
Fields (`IEmail`):
- Ownership: `organization` (ref `Organization`), `user` (ref `User`) and `mailbox` (the email address string). All are required and indexed.
- Location: `folder` (required, default `"INBOX"`, indexed), `uid` (IMAP UID, required), `seqno`, and `messageId` (indexed).
- Headers and content: `subject`, `from`, `to` (default `""`), `cc`, `bcc`, `date`, `text`, `html`, `hasHtml` (default false), and `attachments` (a count, not file data).
- State: `flags` (IMAP flags array), `isRead`, `isStarred`.
- Timestamps are on.

Indexes:
- `{ user, organization, folder, date: -1 }` for newest-first folder listings.
- A unique index on `{ user, organization, folder, uid }`, so re-syncing a folder upserts instead of duplicating.

## Exports
- `IEmail` - document interface.
- `Email` - the model (default collection `emails`). Registered without a `models` guard.

## Interfaces
- **Database:** `Email` (collection `emails`) - read, upserted and created.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/initialSetup.ts` (mounted at `/initial-setup`). `GET /backend/initial-setup/emails` lists and counts stored mail. `POST /backend/initial-setup/sync-emails` and `GET /backend/initial-setup/fetch-inbox` upsert synced messages with `findOneAndUpdate`. `POST /backend/initial-setup/send-email` creates a row for the sent message.

## Notes
- Note that the unique key does not include `mailbox`. One user with two mailboxes in the same org and folder could collide on the same IMAP `uid`, because UIDs are only unique per mailbox.
- Full message bodies (`text`, `html`) are stored. The collection holds private correspondence.
