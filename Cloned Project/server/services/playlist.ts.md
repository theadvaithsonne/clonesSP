# `server/services/playlist.ts`

> Module exporting `createPlaylist`, `getPlaylistById`, `getOrCreateLearnerPlaylist`, `getPlaylists` and 7 more.

**Kind:** backend service · **Lines:** 633

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createPlaylist` | function | `async createPlaylist(data: { title: string; description?: string; coverImage?: s…): Promise<IPlaylist>` | 84 |
| `getPlaylistById` | function | `async getPlaylistById(playlistId: string): Promise<any \| null>` | 139 |
| `getOrCreateLearnerPlaylist` | function | `async getOrCreateLearnerPlaylist(userId: string, organizationId: string): Promise<IPlaylist>` — Get or create a learner's default playlist. | 291 |
| `getPlaylists` | function | `async getPlaylists(organizationId: string, userId: string, isFounder: boolean): Promise<IPlaylist[]>` — Get playlists visible to a user: - Founders see all org playlists (their own + learner public ones are N/A, founder playlists) - Learners see their own playlists + founder-published playlists | 327 |
| `updatePlaylist` | function | `async updatePlaylist(playlistId: string, data: Partial<{ title: string; description: string; coverIm…): Promise<IPlaylist \| null>` | 357 |
| `deletePlaylist` | function | `async deletePlaylist(playlistId: string): Promise<boolean>` | 407 |
| `addVideosToPlaylist` | function | `async addVideosToPlaylist(playlistId: string, entries: { videoSource: "workshop" \| "standalone" \| "course…): Promise<IPlaylist \| null>` | 414 |
| `addVideoIdsToPlaylist` | function | `async addVideoIdsToPlaylist(playlistId: string, workshopIds: string[]): Promise<IPlaylist \| null>` — Legacy wrapper: add workshop/standalone IDs (auto-wraps as workshopIds, used by quick-add) | 474 |
| `removeVideoFromPlaylist` | function | `async removeVideoFromPlaylist(playlistId: string, videoId: string, videoSource?: string): Promise<IPlaylist \| null>` | 484 |
| `reorderPlaylistVideos` | function | `async reorderPlaylistVideos(playlistId: string, orderedEntries: { videoSource: "workshop" \| "standalone" \| …): Promise<IPlaylist \| null>` | 524 |
| `getAvailableVideos` | function | `async getAvailableVideos(organizationId: string): Promise<{ livestream: any[]; uploaded: any[]; cou…` — Get all available videos for playlist creation, categorized by source. | 559 |

## Interfaces

- **Database (Mongoose models used):**
  - `Workshop` (server/models/workshop.model.ts) — reads: `find`
  - `StandaloneVideo` (server/models/standaloneVideo.model.ts) — reads: `find`
  - `Playlist` (server/models/playlist.model.ts) — reads: `findById`, `findOne`, `find`; **writes:** `findByIdAndUpdate`, `new + save`, `findByIdAndDelete`
  - `Course` (server/models/course.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/playlist.model.ts` — `Playlist`, `IPlaylist`, `IVideoEntry`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/standaloneVideo.model.ts` — `StandaloneVideo`
  - `server/models/course.model.ts` — `Course`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/playlist.ts`
