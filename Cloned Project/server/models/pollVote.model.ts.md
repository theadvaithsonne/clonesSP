# `server/models/pollVote.model.ts`

> Mongoose model for one user's vote on a feed poll, limited to one vote document per user per poll.

**Kind:** Mongoose model · **Lines:** 39

## Purpose
Stores who voted for what on a `Poll` (`poll.model.ts`), so the feed can show which options the viewer picked and so a user cannot vote twice. Aggregate counts live on the poll itself.

## How it works
- Fields: `pollId` (ref `Poll`, required, indexed), `userId` (ref `User`, required, indexed), `optionIds[]` (ObjectIds of the chosen `Poll.options` entries; several when the poll is multiple choice), `timestamps`.
- Unique index `{ pollId: 1, userId: 1 }` prevents a second vote document for the same user and poll; changing a vote means updating `optionIds`.

## Exports
- `IPollVote` - document interface.
- `PollVote` - the Mongoose model.

## Interfaces
- **Database:** `PollVote` (collection `pollvotes`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/feed.ts` - records votes and loads the viewer's vote when rendering posts with polls.
- `server/services/memberCleanup.service.ts` - removes a departing member's feed data, including their votes.

## Notes
- `optionIds` has no ref; validity against the poll's options is checked by the service.
