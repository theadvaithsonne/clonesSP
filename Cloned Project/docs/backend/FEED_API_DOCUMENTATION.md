# Feed API Documentation

This document covers the new feed features added to the Roam Backend API.

## Base URL
All endpoints are prefixed with `/feed` and require authentication via JWT token.

---

## Reposts

### Toggle Repost
Toggle repost on a post (repost if not reposted, unrepost if already reposted).

```
POST /feed/posts/:postId/repost?orgId={orgId}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| postId | string | path | Yes | The ID of the post to repost |
| orgId | string | query | Yes | Organization ID |

**Response:**
```json
{
  "success": true,
  "reposted": true,
  "repostsCount": 5
}
```

**Real-time Event:** `feed:post-reposted` emitted to `post:{postId}` room

---

### Get Post Reposts
Get list of users who reposted a post.

```
GET /feed/posts/:postId/reposts?limit={limit}&offset={offset}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| postId | string | path | Yes | The ID of the post |
| limit | number | query | No | Number of results (default: 20) |
| offset | number | query | No | Pagination offset (default: 0) |

**Response:**
```json
{
  "success": true,
  "reposts": [
    {
      "_id": "repost_id",
      "postId": "post_id",
      "userId": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "profilePicture": "https://..."
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25
}
```

---

## Bookmarks

### Toggle Bookmark
Toggle bookmark on a post (bookmark if not bookmarked, remove if already bookmarked).

```
POST /feed/posts/:postId/bookmark?orgId={orgId}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| postId | string | path | Yes | The ID of the post to bookmark |
| orgId | string | query | Yes | Organization ID |

**Response:**
```json
{
  "success": true,
  "bookmarked": true,
  "message": "Post bookmarked"
}
```

---

### Get User Bookmarks
Get all posts bookmarked by the current user.

```
GET /feed/bookmarks?orgId={orgId}&limit={limit}&offset={offset}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| orgId | string | query | Yes | Organization ID |
| limit | number | query | No | Number of results (default: 20) |
| offset | number | query | No | Pagination offset (default: 0) |

**Response:**
```json
{
  "success": true,
  "posts": [
    {
      "_id": "post_id",
      "content": "Post content...",
      "authorId": {
        "_id": "user_id",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "profilePicture": "https://..."
      },
      "channelIds": [
        { "_id": "channel_id", "title": "General" }
      ],
      "likesCount": 10,
      "commentsCount": 5,
      "repostsCount": 2,
      "hasLiked": false,
      "hasBookmarked": true,
      "bookmarkedAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-14T08:00:00Z"
    }
  ],
  "total": 15,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Quote Posts

### Create Quote Post
Create a new post that quotes (embeds) another post.

```
POST /feed/posts/quote?orgId={orgId}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| orgId | string | query | Yes | Organization ID |

**Request Body:**
```json
{
  "content": "My thoughts on this post...",
  "channelIds": ["channel_id_1"],
  "quotedPostId": "original_post_id",
  "tags": ["opinion", "discussion"],
  "attachments": [
    {
      "type": "image",
      "url": "https://...",
      "name": "image.jpg",
      "fileKey": "s3_key"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Post content (1-5000 chars) |
| channelIds | string[] | Yes | Array of channel IDs to post to |
| quotedPostId | string | Yes | ID of the post being quoted |
| tags | string[] | No | Array of hashtags (max 50 chars each) |
| attachments | object[] | No | Array of media attachments |

**Response:**
```json
{
  "success": true,
  "message": "Quote post created successfully",
  "post": {
    "_id": "new_post_id",
    "content": "My thoughts on this post...",
    "authorId": { ... },
    "channelIds": [ ... ],
    "quotedPostId": {
      "_id": "original_post_id",
      "content": "Original post content...",
      "authorId": { ... },
      "channelIds": [ ... ],
      "likesCount": 50,
      "commentsCount": 20,
      "createdAt": "2024-01-10T12:00:00Z"
    },
    "likesCount": 0,
    "commentsCount": 0,
    "repostsCount": 0,
    "hasLiked": false,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Real-time Event:** `feed:new-post` emitted to channel and org feed rooms

---

## Share Links

### Get Share Link
Generate a shareable link for a post.

```
GET /feed/posts/:postId/share?orgId={orgId}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| postId | string | path | Yes | The ID of the post |
| orgId | string | query | Yes | Organization ID |

**Response:**
```json
{
  "success": true,
  "shareLink": "https://app.roam.com/org/org_id/feed/post/post_id",
  "postId": "post_id"
}
```

---

## Trending Hashtags

### Get Trending Tags
Get trending hashtags in the organization, weighted by post count and engagement.

```
GET /feed/trending/tags?orgId={orgId}&limit={limit}&timeRange={timeRange}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| orgId | string | query | Yes | Organization ID |
| limit | number | query | No | Number of tags to return (default: 10) |
| timeRange | number | query | No | Days to look back (default: 7) |

**Response:**
```json
{
  "success": true,
  "trending": [
    { "tag": "announcement", "count": 45 },
    { "tag": "product", "count": 32 },
    { "tag": "team", "count": 28 },
    { "tag": "update", "count": 21 },
    { "tag": "milestone", "count": 15 }
  ]
}
```

**Algorithm:** Tags are scored by: `count + (engagement * 0.5)` where engagement = likes + comments + reposts

---

### Search Posts by Tag
Search for posts containing a specific hashtag.

```
GET /feed/search/tag/:tag?orgId={orgId}&limit={limit}&offset={offset}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| tag | string | path | Yes | The hashtag to search for (without #) |
| orgId | string | query | Yes | Organization ID |
| limit | number | query | No | Number of results (default: 20) |
| offset | number | query | No | Pagination offset (default: 0) |

**Response:**
```json
{
  "success": true,
  "tag": "announcement",
  "posts": [
    {
      "_id": "post_id",
      "content": "Big #announcement today!",
      "authorId": { ... },
      "channelIds": [ ... ],
      "tags": ["announcement", "news"],
      "likesCount": 25,
      "commentsCount": 10,
      "repostsCount": 5,
      "hasLiked": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 45,
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Polls

### Create Poll Post
Create a new post with an attached poll.

```
POST /feed/posts/poll?orgId={orgId}
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| orgId | string | query | Yes | Organization ID |

**Request Body:**
```json
{
  "content": "What do you think about our new feature?",
  "channelIds": ["channel_id_1"],
  "tags": ["feedback", "poll"],
  "poll": {
    "question": "What do you think about our new feature?",
    "options": ["Love it!", "It's okay", "Needs improvement", "Not a fan"],
    "durationHours": 24,
    "isMultipleChoice": false
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | No | Post content (default: poll question) |
| channelIds | string[] | Yes | Array of channel IDs to post to |
| tags | string[] | No | Array of hashtags |
| poll.question | string | Yes | Poll question (1-280 chars) |
| poll.options | string[] | Yes | 2-4 poll options (each max 100 chars) |
| poll.durationHours | number | Yes | Poll duration in hours (1-168, max 7 days) |
| poll.isMultipleChoice | boolean | No | Allow selecting multiple options (default: false) |

**Response:**
```json
{
  "success": true,
  "message": "Poll created successfully",
  "post": {
    "_id": "post_id",
    "content": "What do you think about our new feature?",
    "authorId": { ... },
    "channelIds": [ ... ],
    "hasPoll": true,
    "likesCount": 0,
    "commentsCount": 0,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "poll": {
    "_id": "poll_id",
    "postId": "post_id",
    "question": "What do you think about our new feature?",
    "options": [
      { "_id": "opt_1", "text": "Love it!", "votesCount": 0 },
      { "_id": "opt_2", "text": "It's okay", "votesCount": 0 },
      { "_id": "opt_3", "text": "Needs improvement", "votesCount": 0 },
      { "_id": "opt_4", "text": "Not a fan", "votesCount": 0 }
    ],
    "totalVotes": 0,
    "endsAt": "2024-01-16T10:30:00Z",
    "isMultipleChoice": false,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Real-time Event:** `feed:new-post` emitted to channel and org feed rooms

---

### Get Poll for Post
Get poll data for a specific post.

```
GET /feed/posts/:postId/poll
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| postId | string | path | Yes | The ID of the post |

**Response:**
```json
{
  "success": true,
  "poll": {
    "_id": "poll_id",
    "postId": "post_id",
    "question": "What do you think about our new feature?",
    "options": [
      { "_id": "opt_1", "text": "Love it!", "votesCount": 15 },
      { "_id": "opt_2", "text": "It's okay", "votesCount": 8 },
      { "_id": "opt_3", "text": "Needs improvement", "votesCount": 5 },
      { "_id": "opt_4", "text": "Not a fan", "votesCount": 2 }
    ],
    "totalVotes": 30,
    "endsAt": "2024-01-16T10:30:00Z",
    "isMultipleChoice": false,
    "isActive": true,
    "hasVoted": true,
    "userVotedOptions": ["opt_1"],
    "isExpired": false
  }
}
```

---

### Vote on Poll
Submit a vote on a poll.

```
POST /feed/polls/:pollId/vote
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| pollId | string | path | Yes | The ID of the poll |

**Request Body:**
```json
{
  "optionIds": ["opt_1"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| optionIds | string[] | Yes | Array of selected option IDs (1 for single choice, 1+ for multiple choice) |

**Response:**
```json
{
  "success": true,
  "message": "Vote recorded",
  "poll": {
    "_id": "poll_id",
    "postId": "post_id",
    "question": "What do you think about our new feature?",
    "options": [
      { "_id": "opt_1", "text": "Love it!", "votesCount": 16 },
      { "_id": "opt_2", "text": "It's okay", "votesCount": 8 },
      { "_id": "opt_3", "text": "Needs improvement", "votesCount": 5 },
      { "_id": "opt_4", "text": "Not a fan", "votesCount": 2 }
    ],
    "totalVotes": 31,
    "endsAt": "2024-01-16T10:30:00Z",
    "isMultipleChoice": false,
    "isActive": true
  }
}
```

**Error Responses:**
- `400` - "Poll not found"
- `400` - "Poll is no longer active"
- `400` - "Poll has ended"
- `400` - "This poll only allows single choice"
- `400` - "Invalid option selected"
- `400` - "You have already voted"

**Real-time Event:** `feed:poll-voted` emitted to `post:{postId}` room

---

### Get Poll Results
Get detailed poll results with percentages.

```
GET /feed/polls/:pollId/results
```

**Parameters:**
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| pollId | string | path | Yes | The ID of the poll |

**Response:**
```json
{
  "success": true,
  "poll": {
    "_id": "poll_id",
    "postId": "post_id",
    "question": "What do you think about our new feature?",
    "totalVotes": 31,
    "endsAt": "2024-01-16T10:30:00Z",
    "isMultipleChoice": false,
    "isActive": true
  },
  "results": [
    { "optionId": "opt_1", "text": "Love it!", "votes": 16, "percentage": 52 },
    { "optionId": "opt_2", "text": "It's okay", "votes": 8, "percentage": 26 },
    { "optionId": "opt_3", "text": "Needs improvement", "votes": 5, "percentage": 16 },
    { "optionId": "opt_4", "text": "Not a fan", "votes": 2, "percentage": 6 }
  ]
}
```

---

## Data Models

### PostRepost
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Unique identifier |
| postId | ObjectId | Reference to Post |
| userId | ObjectId | Reference to User who reposted |
| orgId | ObjectId | Reference to Organization |
| createdAt | Date | When the repost was created |

**Indexes:**
- `{ postId: 1, userId: 1 }` - unique (prevents duplicate reposts)
- `{ userId: 1, createdAt: -1 }` - user's reposts
- `{ postId: 1, createdAt: -1 }` - post's reposts

---

### PostBookmark
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Unique identifier |
| postId | ObjectId | Reference to Post |
| userId | ObjectId | Reference to User who bookmarked |
| orgId | ObjectId | Reference to Organization |
| createdAt | Date | When the bookmark was created |

**Indexes:**
- `{ postId: 1, userId: 1 }` - unique (prevents duplicate bookmarks)
- `{ userId: 1, orgId: 1, createdAt: -1 }` - user's bookmarks by org

---

### Poll
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Unique identifier |
| postId | ObjectId | Reference to Post (unique) |
| orgId | ObjectId | Reference to Organization |
| question | String | Poll question (max 280 chars) |
| options | Array | Poll options with vote counts |
| options.text | String | Option text (max 100 chars) |
| options.votesCount | Number | Number of votes for this option |
| totalVotes | Number | Total votes across all options |
| endsAt | Date | When the poll expires |
| isMultipleChoice | Boolean | Allow multiple selections |
| isActive | Boolean | Poll is active |
| createdAt | Date | Creation timestamp |
| updatedAt | Date | Last update timestamp |

**Indexes:**
- `{ postId: 1 }` - unique
- `{ orgId: 1, isActive: 1, endsAt: 1 }` - active polls

---

### PollVote
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Unique identifier |
| pollId | ObjectId | Reference to Poll |
| userId | ObjectId | Reference to User who voted |
| optionIds | ObjectId[] | Array of selected option IDs |
| createdAt | Date | When the vote was cast |

**Indexes:**
- `{ pollId: 1, userId: 1 }` - unique (one vote per user per poll)

---

### Post Model Updates
New fields added to the Post model:

| Field | Type | Description |
|-------|------|-------------|
| repostsCount | Number | Denormalized repost count |
| quotedPostId | ObjectId | Reference to quoted Post (for quote posts) |
| hasPoll | Boolean | Whether post has an attached poll |

---

## Socket.IO Events

### Events Emitted

| Event | Room | Payload | Description |
|-------|------|---------|-------------|
| `feed:post-reposted` | `post:{postId}` | `{ postId, repostsCount, userId, reposted }` | Post was reposted/unreposted |
| `feed:poll-voted` | `post:{postId}` | `{ pollId, poll }` | Someone voted on a poll |
| `feed:new-post` | `channel:{channelId}`, `org:{orgId}:feed` | `{ post }` | New post created (including quote posts and polls) |

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information (in development)"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors, business logic errors)
- `403` - Forbidden (not subscribed to channel, not founder)
- `404` - Not Found (post, poll, etc. not found)
- `500` - Internal Server Error
