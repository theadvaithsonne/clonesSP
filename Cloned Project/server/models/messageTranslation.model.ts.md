# `server/models/messageTranslation.model.ts`

> Mongoose model caching the machine translation of one group-chat message into one language.

**Kind:** Mongoose model · **Lines:** 29

## Purpose
When a user asks to read a group chat in another language, `server/services/messageTranslation.ts` translates the messages and caches each result here. The cache has its own collection rather than a `translations` field on `GroupMessage`, because the message routes return whole documents: a map on the message would be sent along with every page of every thread to every client.

## How it works
- Fields: `messageId` (ref `GroupMessage`, required), `lang` (required), `srcHash` (required: a hash of the text that was translated), `text` (the translation, default `""`). Timestamps on.
- Unique index `{ messageId: 1, lang: 1 }` - one cached translation per message per language.
- **Invalidation without hooks:** after a message is edited, its text no longer hashes to `srcHash`. The service treats that as a cache miss, re-translates and overwrites the row, so the edit path needs no invalidation logic.
- Model registration is guarded with `mongoose.models.MessageTranslation ||` so a second evaluation reuses the compiled model.

## Exports
- `MessageTranslation` - the Mongoose model.

## Interfaces
- **Database:** `MessageTranslation` (collection `messagetranslations`). The service reads cached rows with `find({ messageId: { $in }, lang })` and writes misses with an unordered `bulkWrite` of upserts keyed on `{ messageId, lang }`. A failed cache write is only logged, since it costs nothing more than a re-translation next time.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/messageTranslation.ts` - the only importer.
