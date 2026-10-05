# `server/models/socialAccount.model.ts`

> src/models/socialAccount.model.ts Verified social media accounts — affiliates connect their TikTok/Instagram/YouTube/Twitter via a bio-code verification flow to prove account ownership.

**Kind:** Mongoose model · **Lines:** 121

<!-- docgen:auto -->

## Purpose
src/models/socialAccount.model.ts
Verified social media accounts — affiliates connect their TikTok/Instagram/YouTube/Twitter
via a bio-code verification flow to prove account ownership.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `SocialAccount`

- **Collection:** `socialaccounts` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `platform` | `String` | required, enum SOCIAL_PLATFORMS |
| `profileUrl` | `String` | required, trim |
| `username` | `String` | required, trim |
| `verificationCode` | `String` | default "" |
| `isVerified` | `Boolean` | default false |
| `verifiedAt` | `Date` | default null |
| `oauthConnected` | `Boolean` | default false |
| `accessToken` | `String` | default null |
| `refreshToken` | `String` | default null |
| `tokenExpiresAt` | `Date` | default null |
| `platformUserId` | `String` | default null |
| `followerCount` | `Number` | default 0 |

### Indexes

- `{ userId: 1, platform: 1 }, { unique: true, name: "user_platform_unique" }` (L106)
- `{ platform: 1, username: 1 }, { name: "platform_username_idx" }` (L112)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ISocialAccount` | interface |  | 8 |
| `SocialAccount` | model | `mongoose.model<ISocialAccount>( "SocialAccount", SocialAccountSchema )` | 117 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/contentCampaign.model.ts` — `SOCIAL_PLATFORMS`, `SocialPlatform`
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/contentSubmission.ts`
- `server/routes/linkPreview.ts`
- `server/routes/socialAccount.ts`
- `server/routes/socialOAuth.ts`
- `server/services/contentPayoutSweeper.ts`
