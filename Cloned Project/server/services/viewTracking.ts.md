# `server/services/viewTracking.ts`

> src/services/viewTracking.ts View tracking service for Content Rewards.

**Kind:** backend service · **Lines:** 364

<!-- docgen:auto -->

## Purpose
src/services/viewTracking.ts
View tracking service for Content Rewards.
Uses YouTube Data API v3 for view counts. Instagram support coming soon.
All scraping and TikTok/Twitter code has been removed.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `detectPlatform` | function | `detectPlatform(url: string): string \| null` — Detect platform from a post URL | 43 |
| `extractUsername` | function | `extractUsername(url: string, platform: string): string` — Extract username from a social media profile URL | 52 |
| `validatePostUrl` | function | `validatePostUrl(url: string, platform: string): boolean` — Validate that a post URL belongs to the correct platform | 71 |
| `extractUsernameFromPostUrl` | function | `extractUsernameFromPostUrl(url: string, platform: string): string` — Extract the username from a content post URL. | 81 |
| `generateVerificationCode` | function | `generateVerificationCode(): string` — Generate a random verification code for social account bio verification | 99 |
| `verifyBioCode` | function | `async verifyBioCode(profileUrl: string, platform: string, code: string): Promise<{ verified: boolean; error?: string }>` — Verify that a social media profile bio contains the verification code. | 114 |
| `extractPlatformPostId` | function | `extractPlatformPostId(url: string, platform: string): string` — Extract the platform-specific post/video ID from a URL. | 192 |
| `fetchYouTubeViewsViaAPI` | function | `async fetchYouTubeViewsViaAPI(videoId: string): Promise<{ views: number; success: boolean; error?…` — Fetch YouTube views via Data API v3 (API key only — no OAuth needed). | 207 |
| `fetchYouTubeVideoChannelId` | function | `async fetchYouTubeVideoChannelId(videoId: string): Promise<{ channelId: string; channelTitle: string…` — Fetch the channel ID that owns a YouTube video. | 243 |
| `resolveYouTubeChannelId` | function | `async resolveYouTubeChannelId(handleOrUrl: string): Promise<{ channelId: string; success: boolean; er…` — Resolve a YouTube handle (e.g. | 278 |
| `fetchViewsAuto` | function | `async fetchViewsAuto(postUrl: string, platform: string, _accessToken?: string \| null, _platformUserId?: string \| null): Promise<{ views: number; success: boolean; source…` — Master function: fetch views using the best available method. | 343 |

## Interfaces

- **External HTTP calls:**
  - `GET https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}` (L216)
  - `GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}` (L252)
  - `GET https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}` (L305)
  - `GET https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${handle}&key=${apiKey}` (L319)
- **Environment variables (`process.env`):** `YOUTUBE_API_KEY`
- **External hosts mentioned in the code:** `www.googleapis.com`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/contentSubmission.ts`
- `server/routes/linkPreview.ts`
- `server/routes/socialAccount.ts`
- `server/routes/socialOAuth.ts`
- `server/services/contentPayoutSweeper.ts`
