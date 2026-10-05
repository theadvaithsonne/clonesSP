# `server/models/playlist.model.ts`

> Mongoose model for video playlists within an organization, which can mix webinar recordings, standalone videos and course chapters.

**Kind:** Mongoose model · **Lines:** 108

## Purpose
Founders curate published playlists for their office's learners, and each learner can keep a personal playlist. A playlist entry can point at three different kinds of video, so each entry records its source as well as its id. An older format stored only a flat list of ids; that field is kept so legacy documents still load, and the service migrates them when read.

## How it works
- **Video entry** (`VideoEntrySchema`, `_id: false`):
  - `videoSource` (required): `"workshop"` (a `Workshop` recording), `"standalone"` (a `StandaloneVideo`) or `"courseVideo"` (a chapter inside a course).
  - `videoId` (required): `Workshop._id`, `StandaloneVideo._id`, or the chapter id for course videos.
  - `courseId`, `sectionId`, `chapterId`: set only for `courseVideo` so the chapter can be located inside its course.
- **Playlist fields:** `title` (required, max 200), `description` (max 2000), `coverImage`, `organizationId` (ref `Organization`, required, indexed), `createdBy` (ref `User`, required, indexed), `type` (`"founder"` or `"learner"`, default `"learner"`), `isPublished` (default `false`), `videoEntries` (default `[]`), legacy `videoIds` (plain ObjectIds, no ref), `videoCount` (default 0), `timestamps`.
- **Indexes:** `{ organizationId, type, isPublished }` (an org's published founder playlists) and `{ createdBy, type }` (a user's own playlists).
- **Pre-save hook:** keeps `videoCount` in sync - `videoEntries.length` when entries exist, otherwise `videoIds.length`.

## Exports
- `IVideoEntry` - entry interface.
- `IPlaylist` - document interface.
- `Playlist` - the Mongoose model.

## Interfaces
- **Database:** `Playlist` (collection `playlists`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/playlist.ts` - `createPlaylist`, `getPlaylistById`, `getOrCreateLearnerPlaylist`, `getPlaylists`, `updatePlaylist`, `deletePlaylist`, `addVideosToPlaylist`, `addVideoIdsToPlaylist`, `removeVideoFromPlaylist`, `reorderPlaylistVideos`, `getAvailableVideos`. It migrates legacy playlists (only `videoIds`) by writing `videoEntries` and clearing `videoIds`.
- `server/routes/feed.ts` (mounted at `/feed`) and `server/routes/public.ts` (mounted at `/public`, which loads a playlist by id for public pages).

## Notes
- `videoCount` is only recomputed on `save()`; updates through `updateOne`/`findOneAndUpdate` must maintain it themselves.
