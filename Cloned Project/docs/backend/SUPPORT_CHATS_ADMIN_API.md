# Support Chats — Admin API

**Base URL:** `https://test.garage.app`
**Status:** live in production.
**Backend source:** `src/routes/garageAdminSupportChats.ts`, `src/services/supportChat.ts`, `src/services/messageTranslation.ts`

This document is for building the **Support Chats** screen in the garage admin console, where admins see every member's support chat and reply to it.

---

## 1. What a support chat is

- **One per user.** Every user gets exactly one support chat, created automatically the first time they complete their profile.
- **It's a normal group chat,** with the same `Group` / `GroupMessage` models, socket events and app screens as any other group. It's marked `kind: "support"`, and its name looks like `Garage | NVC | Alice | New York` (the city is left off when the member's profile has none) and is kept in sync on every profile save.

**Who's in it:**

| Member | Group role | Notes |
|---|---|---|
| The user | `member` | The person the chat is for. Can't leave or be removed. |
| Their upline (referrer) | `member` | Default sponsor `shorupan@gmail.com` if the user has no referrer. |
| Every **active** garage admin | `admin` | Added through the admin's own **app user account** (same email). The App Store review account `applereview@yopmail.com` is excluded. |
| The user's assigned support agent | `admin` | `User.assignedSupportAgentId`. Normally already in as an active admin. |

**Membership is kept in sync automatically:**
- Inviting an admin adds them to every support chat.
- Deactivating an admin removes them. Re-activating adds them back.
- Every admin login re-syncs as a safety net.
- Changing a user's referrer swaps the upline in their chat.
- Assigning a support agent adds that agent.

The admin UI never needs to manage membership.

**Replies:** an admin console reply is sent **as the admin's own app user**. The member sees e.g. "Punith: …", live, in whichever app they use: NC mobile, NC web, Garage mobile or Garage web.

---

## 2. Authentication

Use the existing garage-admin session: the admin JWT from `POST /garage-admin/login`, sent as `Authorization: Bearer <token>`.

- **Access:** every signed-in admin can use these endpoints, with **no page permission** needed. Every active admin is a participant in every support chat.
- **Step-up verification:** the same rule as the rest of the console. An admin with verification questions set up must have passed `/garage-admin/verify`, otherwise the request gets `403 { code: "ADMIN_VERIFICATION_REQUIRED" }`.
- **App Store review account:** `applereview@yopmail.com` gets `403` on every endpoint. Hide the page for it; the console's demo mode must not call these.
- **Admin without an app account:** if the admin has **no app user account** on their email, the endpoints return `409` with a message like "There is no app account for x@garage.app. Sign up in the app with this email to use support chats." Show that message as-is.

### Response envelope
- **Success:** `{ "success": true, "data": … }`
- **Handler errors:** `{ "success": false, "message": "…" }`
- **Auth-gate errors** (before the handler runs): `{ "error": "…" }`, sometimes with a `code` (see above).

| Status | Meaning |
|---|---|
| 400 | Invalid query or body |
| 401 | Missing, invalid or expired admin token, or the admin is inactive |
| 403 | App Store review account, or step-up verification required |
| 404 | Support chat (or user) not found |
| 409 | Admin has no app user account on their email |
| 502 | Translation service failed (translate endpoint only). Safe to retry. |
| 500 | Server error |

---

## 3. Endpoints

All paths are under `/garage-admin/support-chats`.

### 3.1 List support chats
`GET /garage-admin/support-chats`

| Query | Type | Default | Notes |
|---|---|---|---|
| `filter` | `all` \| `unanswered` \| `mine` | `all` | See below |
| `q` | string (≤100) | – | Matches the **member's** name, email or phone (case-insensitive) |
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 30 | |

**Filters:**
- `unanswered` ("Awaiting reply"): the last message came from someone who is **not staff**, i.e. the member or their upline.
- `mine` ("Assigned to me"): members whose `assignedSupportAgentId` is the calling admin.

**Sort order:** most recent activity first (last message time, or creation time for chats with no messages).

```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "groupId": "6ab3c2…",
        "name": "Garage | NVC | Alice | New York",
        "user": {
          "id": "68f1…", "name": "Alice", "email": "alice@x.com",
          "phone": "+91…", "profilePicture": "https://…", "country": "India"
        },
        "upline": { "id": "…", "name": "Bob", "email": "…", "phone": null, "profilePicture": null, "country": null },
        "assignedAgent": { "id": "<GarageAdmin id>", "name": "Ranjan", "email": "ranjan@garage.app", "profilePicture": null },
        "lastMessage": {
          "text": "How do I withdraw my commission?",
          "fromId": "68f1…",
          "fromName": "Alice",
          "fromStaff": false,
          "hasAttachments": false,
          "at": "2026-09-23T10:15:00.000Z"
        },
        "awaitingReply": true,
        "unread": true,
        "memberCount": 11,
        "activityAt": "2026-09-23T10:15:00.000Z"
      }
    ],
    "total": 1076,
    "page": 1,
    "limit": 30,
    "counts": { "all": 1076, "unanswered": 12, "mine": 3 }
  }
}
```

**Field notes:**
- `upline`, `assignedAgent` and `lastMessage` can each be `null`. `lastMessage` is `null` when the chat has no messages yet.
- `awaitingReply`: the last message is from a non-staff member. Use it for an "Awaiting reply" badge.
- `unread`: there is a newer message than **this admin** last read, and they didn't send it. Use it for an unread dot.
- `counts`: totals for the three filter tabs. They respect `q`.
- `lastMessage.text`: truncated to 500 characters.

### 3.2 Chat details
`GET /garage-admin/support-chats/:groupId`

```json
{
  "success": true,
  "data": {
    "groupId": "6ab3c2…",
    "name": "Garage | NVC | Alice | New York",
    "picture": null,
    "me": "<calling admin's app userId>",
    "user": {
      "id": "…", "name": "Alice", "email": "…", "phone": "…", "profilePicture": "…",
      "country": "India", "city": "Bengaluru", "state": "Karnataka",
      "joinedAt": "2026-01-02T…"
    },
    "uplineId": "…",
    "assignedAgent": { "id": "<GarageAdmin id>", "name": "Ranjan", "email": "ranjan@garage.app" },
    "members": [
      {
        "id": "…", "name": "Alice", "email": "…", "phone": "…", "profilePicture": "…", "country": "…",
        "role": "member", "isMember": true, "isUpline": false, "isStaff": false
      },
      {
        "id": "…", "name": "Punith", "email": "punithraj@garage.app", "phone": null, "profilePicture": null, "country": null,
        "role": "admin", "isMember": false, "isUpline": false, "isStaff": true
      }
    ]
  }
}
```

- `me` is the admin's **app user id**. Compare it with `message.from` to right-align the admin's own messages.
- `isMember` marks the user the chat is for. `isUpline` marks the upline. `isStaff` marks group role `admin`.

### 3.3 Messages
`GET /garage-admin/support-chats/:groupId/messages?cursor=&limit=`

| Query | Default | Notes |
|---|---|---|
| `limit` | 40 | Max 100 |
| `cursor` | – | Pass the previous response's `nextCursor` to load **older** messages |

The response is one page, ordered **oldest → newest** (append to the bottom; prepend older pages to the top). It contains top-level messages only; thread replies are excluded.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "…",
        "groupId": "…",
        "from": "<userId>",
        "text": "How do I withdraw my commission?",
        "attachments": [],
        "mentions": [],
        "replyTo": null,
        "reactions": {},
        "editedAt": null,
        "deletedAt": null,
        "createdAt": "2026-09-23T10:15:00.000Z"
      },
      {
        "_id": "…",
        "groupId": "…",
        "type": "system",
        "event": "member_added",
        "actorId": "…",
        "text": "Punith added Prasanna",
        "createdAt": "…"
      }
    ],
    "nextCursor": "2026-09-20T08:00:00.000Z",
    "users": {
      "<userId>": {
        "name": "Alice", "email": "alice@x.com", "profilePicture": null,
        "isStaff": false, "isMember": true
      }
    }
  }
}
```

How to render each item:

- **Sender:** look up `users[from]` for the name and avatar. `isStaff` marks support-team messages; style them differently, e.g. a "Support" tag.
- **Deleted:** `deletedAt` is set and `text` is empty. Show "This message was deleted".
- **System:** `type: "system"` rows are centred event pills (e.g. "X added Y"). `text` is pre-rendered and `from` is absent.
- **Replies:** `replyTo` is the populated quoted message (or `null`).
- **Attachments:** `attachments[]` has `{ fileName, fileSize, fileType, fileUrl, … }`, the same shape as app group messages.
- **Paging:** `nextCursor` is `null` when there are no older messages.

### 3.4 Send a reply
`POST /garage-admin/support-chats/:groupId/messages`

```json
{ "text": "Hi Alice, go to Wallet → Withdraw.", "replyTo": "<optional messageId>" }
```

- **Body:** `text` is required, trimmed, 1–5000 characters. It's text only; there are no attachments from the console yet.
- **Sender:** the admin's own app user. If that user isn't in the chat yet, they are added as staff first.
- **Delivery:** live to every member over the normal `group:message` socket event, with push notifications. It also updates `lastMessage`, so the chat stops being "awaiting reply".

```json
{
  "success": true,
  "data": {
    "message": {
      "_id": "…", "groupId": "…", "from": "<admin's userId>",
      "text": "Hi Alice, go to Wallet → Withdraw.",
      "attachments": [], "mentions": [], "replyTo": null, "threadId": null,
      "replyCount": 0, "threadResolved": false,
      "editedAt": null, "createdAt": "…", "readAt": null
    }
  }
}
```

Append `data.message` to the thread straight away; no need to refetch.

### 3.5 Mark as read
`POST /garage-admin/support-chats/:groupId/read`

This takes no body and returns `{ "success": true }`. It sets this admin's read marker to now, which clears `unread` in the list. If the admin also has the app open, their app badge updates too. Call it when a chat is opened, and after sending a reply.

### 3.6 Translate messages
`POST /garage-admin/support-chats/:groupId/translate`

```json
{ "messageIds": ["…", "…"], "lang": "en" }
```

| `lang` | Language (show native name) |
|---|---|
| `en` | English |
| `es` | Español |
| `fr` | Français |
| `hi` | हिन्दी |
| `ar` | العربية (render RTL) |
| `zh` | 中文 |

**Batching:** send 1–50 ids per call. For "translate all", split into batches of 50.

```json
{
  "success": true,
  "data": {
    "lang": "en",
    "translations": {
      "<messageId>": "Hello, how do I withdraw my commission?"
    }
  }
}
```

- **Skipped messages:** ids for messages with no text (attachment-only), deleted messages and system rows are **left out** of `translations`. That's not an error.
- **Caching:** translations are cached on the server per message + language, and shared with the apps. A message translated once is instant and free afterwards; an edited message is re-translated automatically.
- **Suggested UI:** a "Translate" item in each message's menu, a language picker, and the translation shown under the original with "Translated · English · Show original". Add an optional "Translate all" toggle in the chat header. Remember the last language used (localStorage).
- **Errors:** a `502` means the translation service failed. Show a toast with Retry.

### 3.7 Create or sync one user's chat (optional)
`POST /garage-admin/support-chats/ensure/:userId`

This creates the user's support chat if it doesn't exist, or brings its membership up to date. It's safe to call any number of times. It returns `{ "success": true, "data": { "groupId": "…" } }`, or `404` if the user doesn't exist. Useful as an "Open support chat" button on a user's admin profile.

---

## 4. Keeping the screen live

The admin console has **no socket connection**, so poll, and only while the browser tab is visible (`document.visibilityState === "visible"`):

| What | Interval | Call |
|---|---|---|
| Open conversation | ~5 s | `GET …/:groupId/messages` (latest page, no cursor). Merge by `_id`. |
| Chat list + counts | ~20 s | `GET /garage-admin/support-chats` with the current filter/q/page |

---

## 5. Suggested screen layout

- **Left pane**
  - Tabs: **All** / **Awaiting reply** / **Assigned to me**, with `counts`.
  - A search box (debounced ~300 ms → `q`) and pagination.
  - Each row shows the member's avatar, name and email, an "Awaiting reply" badge, an unread dot, a last-message preview ("Alice: …"), relative time, and the assigned agent.
- **Right pane**
  - **Header:** the member's name, email, phone, location, upline and assigned agent, plus a member list popover (from 3.2).
  - **Thread:** oldest → newest, with "Load older" (cursor paging). Staff messages are visually distinct, and translation sits in each message's menu, plus "Translate all".
  - **Composer:** Enter sends, Shift+Enter adds a new line. After sending, append `data.message` and call **read**.
- **Access and errors**
  - Put the page in the sidebar for **every admin** except the App Store review account.
  - Show 409 and other errors in a visible banner.

---

## 6. Related user-side endpoints (for reference only)

These are what the apps use (user JWT, not the admin JWT). You don't need them for the console:
- `GET /groups/support?limit=&before=&q=` returns the caller's support chats (paged, not office-scoped). Rows include `memberProfiles`.
- `GET /groups/support/unread` returns `{ count, groupIds }` for the Support tab badge.
- `POST /groups/:groupId/translate` is the same translation, and shares the same cache.
- `GET /groups`, `/groups/unread/all` and `/groups/last-messages` **exclude** support chats.

## 7. Existing implementation

A complete admin screen built on these endpoints already exists in `garage-web-app-nextjs-v1`, on branch `feat/support-chats` (not merged yet):
- `components/garage-admin/SupportChatsConsole.tsx`: the UI
- `lib/admin-api/support-chats.ts`: the typed API client
- `app/garage-admin/(admin-dashboard)/support-chats/page.tsx`: the route
- `app/garage-admin/(admin-dashboard)/layout.tsx`: the sidebar entry

You can reuse it, or treat it as a reference.
