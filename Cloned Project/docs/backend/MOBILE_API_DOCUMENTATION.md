# Mobile API Documentation for Expo App

This document provides comprehensive API documentation for integrating the Roam backend with a mobile Expo application. It covers authentication, organization management, chat (one-to-one and group), and file attachments.

---

## Table of Contents

1. [Base Configuration](#base-configuration)
2. [Authentication Flow](#authentication-flow)
3. [Organization Selection](#organization-selection)
4. [Chat System Overview](#chat-system-overview)
5. [One-to-One Chat APIs](#one-to-one-chat-apis)
6. [Group Chat APIs](#group-chat-apis)
7. [Real-Time Messaging (Socket.IO)](#real-time-messaging-socketio)
8. [File Attachments](#file-attachments)
9. [Error Handling](#error-handling)

---

## Base Configuration

### Base URL

```
Production: https://your-api-domain.com
Development: http://localhost:4000
```

### Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Socket.IO Configuration

- **Path**: `/socket.io`
- **Connection**: WebSocket connection for real-time features
- **Authentication**: Token sent via `auth.token` in handshake or `Authorization` header

---

## Authentication Flow

The authentication flow consists of three main steps:

1. Request OTP (One-Time Password)
2. Verify OTP and get user info + organizations
3. Select organization to get JWT token

### 1. Request OTP

**Endpoint:** `POST /auth/request-otp`

**Description:** Sends a 6-digit OTP code to the user's email. The OTP is valid for 10 minutes.

**Request Body:**

```json
{
  "email": "user@example.com",
  "purpose": "login"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `purpose` | string | No | Default: "login". Options: "login" or "invite" |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

**Response (Error - 400):**

```json
{
  "error": "Invalid email format"
}
```

**Example Request (React Native/Expo):**

```javascript
const requestOTP = async (email) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        purpose: "login",
      }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error requesting OTP:", error);
    throw error;
  }
};
```

---

### 2. Verify OTP

**Endpoint:** `POST /auth/verify-otp`

**Description:** Verifies the OTP code and returns user information along with their organizations. If the user has only one organization, a token is automatically included.

**Request Body:**

```json
{
  "email": "user@example.com",
  "code": "123456",
  "referralCode": "REF123" // Optional
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `code` | string | Yes | 6-digit OTP code |
| `referralCode` | string | No | Optional referral code |

**Response (Success - 200):**

**Scenario 1: User has one organization (token auto-included)**

```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "email": "user@example.com",
    "name": "John Doe",
    "organizations": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "name": "Acme Corp",
        "role": "founder",
        "joinedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "hasOrganizations": true,
    "currentOrg": {
      "id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "name": "Acme Corp",
      "role": "founder",
      "joinedAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Scenario 2: User has multiple organizations (no token)**

```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "email": "user@example.com",
    "name": "John Doe",
    "organizations": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "name": "Acme Corp",
        "role": "founder",
        "joinedAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j3",
        "name": "Tech Startup",
        "role": "member",
        "joinedAt": "2024-02-01T09:15:00.000Z"
      }
    ],
    "hasOrganizations": true
  },
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1"
}
```

**Scenario 3: User has no organizations**

```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "email": "user@example.com",
    "name": null,
    "organizations": [],
    "hasOrganizations": false
  },
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `user.id` | string | User's unique identifier |
| `user.email` | string | User's email |
| `user.name` | string \| null | User's name (null if not set) |
| `user.organizations` | array | List of organizations user belongs to |
| `user.hasOrganizations` | boolean | Whether user has any organizations |
| `user.currentOrg` | object \| undefined | Current organization (if single org) |
| `userId` | string | User ID (always present) |
| `token` | string \| undefined | JWT token (only if single org) |

**Response (Error - 400):**

```json
{
  "error": "Invalid OTP"
}
```

**Example Request (React Native/Expo):**

```javascript
const verifyOTP = async (email, code, referralCode = null) => {
  try {
    const body = {
      email: email,
      code: code,
    };

    if (referralCode) {
      body.referralCode = referralCode;
    }

    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Verification failed");
    }

    // Store token if present
    if (data.token) {
      await AsyncStorage.setItem("auth_token", data.token);
      await AsyncStorage.setItem("user_id", data.userId);
      await AsyncStorage.setItem("org_id", data.user.currentOrg.id);
    }

    return data;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
};
```

---

### 3. Select Organization

**Endpoint:** `POST /auth/select-org`

**Description:** Selects an organization and returns a JWT token for that organization. Use this when the user has multiple organizations or after creating a new organization.

**Request Body:**

```json
{
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "orgId": "64f1a2b3c4d5e6f7g8h9i0j2"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | Yes | User's ID (from verify-otp response) |
| `orgId` | string | Yes | Organization ID to select |

**Response (Success - 200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "currentOrg": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j2",
    "name": "Acme Corp",
    "role": "founder",
    "joinedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `token` | string | JWT token for authenticated requests |
| `currentOrg.id` | string | Organization ID |
| `currentOrg.name` | string | Organization name |
| `currentOrg.role` | string | User's role in organization |
| `currentOrg.joinedAt` | string | When user joined (ISO 8601) |

**Response (Error - 404):**

```json
{
  "error": "User not found"
}
```

**Response (Error - 400):**

```json
{
  "error": "Organization not found for user"
}
```

**Example Request (React Native/Expo):**

```javascript
const selectOrganization = async (userId, orgId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/select-org`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: userId,
        orgId: orgId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Organization selection failed");
    }

    // Store token and org info
    await AsyncStorage.setItem("auth_token", data.token);
    await AsyncStorage.setItem("org_id", data.currentOrg.id);
    await AsyncStorage.setItem("user_role", data.currentOrg.role);

    return data;
  } catch (error) {
    console.error("Error selecting organization:", error);
    throw error;
  }
};
```

---

### 4. Get Current User Info

**Endpoint:** `GET /auth/me`

**Description:** Gets the current authenticated user's information including all organizations.

**Authentication:** Required (Bearer token)

**Response (Success - 200):**

```json
{
  "user": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "email": "user@example.com",
    "name": "John Doe",
    "profilePicture": "https://uploadthing.com/profile-url",
    "organizations": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "name": "Acme Corp",
        "icon": "https://uploadthing.com/icon-url",
        "role": "founder",
        "joinedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

## Organization Selection

### Get User's Organizations List

The organizations list is returned in the `/auth/verify-otp` response. No separate endpoint is needed to get the list.

However, you can also get the current user's organizations using `/auth/me` (see above).

---

## Chat System Overview

The chat system supports two types of conversations:

1. **One-to-One (Direct Messages)**: Private conversations between two users
2. **Group Chats**: Conversations with multiple participants

Both types use:

- **REST APIs** for fetching message history, marking as read, editing, and deleting messages
- **Socket.IO** for real-time message delivery and typing indicators

### Key Concepts

#### Conversation ID (DM)

For one-to-one chats, the conversation ID is generated as: `dm:<user1_id>:<user2_id>` where user IDs are sorted alphabetically. This ensures both users share the same conversation ID.

Example: If User A (ID: `abc123`) chats with User B (ID: `xyz789`), the conversation ID is `dm:abc123:xyz789`.

#### Message Pagination

Messages are fetched with cursor-based pagination:

- Use `cursor` parameter with the ISO timestamp of the oldest message in current batch
- Use `limit` parameter (max 100, default 40) to control page size
- `nextCursor` in response indicates if more messages are available

---

## One-to-One Chat APIs

### Get Team Members

**Endpoint:** `GET /team/list?orgId=<organization_id>`

**Description:** Gets all members of an organization. Use this to display the list of users you can message.

**Authentication:** Required (Bearer token)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orgId` | string | Yes | Organization ID |

**Response (Success - 200):**

```json
{
  "members": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "founder",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "profilePicture": "https://uploadthing.com/profile-url"
    },
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "member",
      "createdAt": "2024-02-01T09:15:00.000Z",
      "profilePicture": null
    }
  ]
}
```

**Example Request:**

```javascript
const getTeamMembers = async (orgId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/team/list?orgId=${orgId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data.members;
  } catch (error) {
    console.error("Error fetching team members:", error);
    throw error;
  }
};
```

---

### Get DM Messages

**Endpoint:** `GET /dm/:otherId/messages?cursor=<iso_timestamp>&limit=40`

**Description:** Fetches messages in a direct message conversation. Messages are returned in chronological order (oldest first). Use cursor-based pagination to load more.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `otherId` | string | Yes | The other user's ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cursor` | string | No | ISO timestamp of oldest message for pagination |
| `limit` | number | No | Max messages to return (max 100, default 40) |

**Response (Success - 200):**

```json
{
  "items": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "convId": "dm:abc123:xyz789",
      "from": "64f1a2b3c4d5e6f7g8h9i0j1",
      "to": "64f1a2b3c4d5e6f7g8h9i0j2",
      "text": "Hello!",
      "attachments": [],
      "replyTo": null,
      "editedAt": null,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j3",
      "convId": "dm:abc123:xyz789",
      "from": "64f1a2b3c4d5e6f7g8h9i0j2",
      "to": "64f1a2b3c4d5e6f7g8h9i0j1",
      "text": "Hi there!",
      "attachments": [
        {
          "fileName": "image.jpg",
          "fileSize": 1024000,
          "fileType": "image/jpeg",
          "fileUrl": "https://s3.amazonaws.com/bucket/file-key",
          "fileKey": "file-key",
          "uploadedAt": "2024-01-15T10:31:00.000Z"
        }
      ],
      "replyTo": "64f1a2b3c4d5e6f7g8h9i0j1",
      "editedAt": null,
      "readAt": "2024-01-15T10:32:00.000Z",
      "createdAt": "2024-01-15T10:31:00.000Z",
      "updatedAt": "2024-01-15T10:31:00.000Z"
    }
  ],
  "nextCursor": "2024-01-15T10:30:00.000Z"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `items` | array | Array of message objects (chronological order) |
| `nextCursor` | string \| null | ISO timestamp to use for next page (null if no more messages) |

**Message Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Message ID |
| `convId` | string | Conversation ID |
| `from` | string | Sender's user ID |
| `to` | string | Recipient's user ID |
| `text` | string | Message text |
| `attachments` | array | Array of attachment objects |
| `replyTo` | string \| null | ID of message being replied to |
| `editedAt` | string \| null | ISO timestamp when edited (null if never edited) |
| `readAt` | string \| null | ISO timestamp when read (null if unread) |
| `createdAt` | string | ISO timestamp when created |
| `updatedAt` | string | ISO timestamp when updated |

**Example Request:**

```javascript
const getDMMessages = async (otherId, token, cursor = null, limit = 40) => {
  try {
    let url = `${API_BASE_URL}/dm/${otherId}/messages?limit=${limit}`;
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching DM messages:", error);
    throw error;
  }
};
```

---

### Mark DM Messages as Read

**Endpoint:** `POST /dm/:otherId/read`

**Description:** Marks all unread messages in a conversation as read up to a specific timestamp.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `otherId` | string | Yes | The other user's ID |

**Request Body (Optional):**

```json
{
  "upTo": "2024-01-15T10:31:00.000Z"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `upTo` | string | No | ISO timestamp. Defaults to current time if not provided |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

**Example Request:**

```javascript
const markDMAsRead = async (otherId, token, upTo = null) => {
  try {
    const body = {};
    if (upTo) {
      body.upTo = upTo;
    }

    const response = await fetch(`${API_BASE_URL}/dm/${otherId}/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error marking DM as read:", error);
    throw error;
  }
};
```

---

### Get Unread DM Counts

**Endpoint:** `GET /dm/unread`

**Description:** Gets unread message counts for all direct message conversations.

**Authentication:** Required (Bearer token)

**Response (Success - 200):**

```json
{
  "unread": [
    {
      "convId": "dm:abc123:xyz789",
      "otherId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "count": 5,
      "latestAt": "2024-01-15T10:31:00.000Z"
    },
    {
      "convId": "dm:abc123:def456",
      "otherId": "64f1a2b3c4d5e6f7g8h9i0j3",
      "count": 2,
      "latestAt": "2024-01-15T09:15:00.000Z"
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `unread` | array | Array of unread count objects |
| `unread[].convId` | string | Conversation ID |
| `unread[].otherId` | string | Other user's ID |
| `unread[].count` | number | Number of unread messages |
| `unread[].latestAt` | string | ISO timestamp of latest unread message |

---

### Edit DM Message

**Endpoint:** `PUT /dm/message/:messageId`

**Description:** Edits a message sent by the current user. Only the sender can edit their own messages.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messageId` | string | Yes | Message ID to edit |

**Request Body:**

```json
{
  "text": "Updated message text"
}
```

**Response (Success - 200):**

```json
{
  "ok": true,
  "message": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "text": "Updated message text",
    "editedAt": "2024-01-15T10:35:00.000Z",
    ...
  }
}
```

---

### Delete DM Message

**Endpoint:** `DELETE /dm/message/:messageId`

**Description:** Deletes a message sent by the current user. Only the sender can delete their own messages.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messageId` | string | Yes | Message ID to delete |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

---

## Group Chat APIs

### List Groups

**Endpoint:** `GET /groups`

**Description:** Gets all groups the current user is a member of, including unread message counts.

**Authentication:** Required (Bearer token)

**Response (Success - 200):**

```json
{
  "groups": [
    {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Engineering Team",
      "picture": "https://uploadthing.com/group-picture-url",
      "unread": 3,
      "members": [
        {
          "userId": "64f1a2b3c4d5e6f7g8h9i0j2",
          "role": "admin",
          "joinedAt": "2024-01-15T10:30:00.000Z",
          "lastReadAt": "2024-01-15T09:00:00.000Z"
        },
        {
          "userId": "64f1a2b3c4d5e6f7g8h9i0j3",
          "role": "member",
          "joinedAt": "2024-01-15T10:30:00.000Z",
          "lastReadAt": "1970-01-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `groups` | array | Array of group objects |
| `groups[].id` | string | Group ID |
| `groups[].name` | string | Group name |
| `groups[].picture` | string \| null | URL to group picture (null if not set) |
| `groups[].unread` | number | Number of unread messages |
| `groups[].members` | array | Array of member objects |

**Member Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID |
| `role` | string | Role: "admin" or "member" |
| `joinedAt` | string | ISO timestamp when joined |
| `lastReadAt` | string | ISO timestamp of last read message |

---

### Create Group

**Endpoint:** `POST /groups`

**Description:** Creates a new group with the specified name and members. The current user is automatically added as an admin.

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "name": "Engineering Team",
  "memberIds": ["64f1a2b3c4d5e6f7g8h9i0j2", "64f1a2b3c4d5e6f7g8h9i0j3"]
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group name (2-80 characters) |
| `memberIds` | array | Yes | Array of user IDs to add as members (can be empty) |

**Response (Success - 200):**

```json
{
  "ok": true,
  "group": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Engineering Team"
  }
}
```

**Response (Error - 400):**

```json
{
  "error": "Name must be at least 2 characters"
}
```

**Example Request:**

```javascript
const createGroup = async (name, memberIds, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        memberIds: memberIds || [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create group");
    }

    return data.group;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};
```

---

### Add Members to Group

**Endpoint:** `POST /groups/:groupId/members`

**Description:** Adds new members to an existing group. The current user must be a member of the group.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |

**Request Body:**

```json
{
  "memberIds": ["64f1a2b3c4d5e6f7g8h9i0j4", "64f1a2b3c4d5e6f7g8h9i0j5"]
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `memberIds` | array | Yes | Array of user IDs to add (minimum 1) |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

**Response (Error - 404):**

```json
{
  "error": "Group not found"
}
```

**Response (Error - 403):**

```json
{
  "error": "Not a member"
}
```

---

### Get Group Messages

**Endpoint:** `GET /groups/:groupId/messages?cursor=<iso_timestamp>&limit=40`

**Description:** Fetches messages in a group. Messages are returned in chronological order (oldest first). Use cursor-based pagination to load more.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cursor` | string | No | ISO timestamp of oldest message for pagination |
| `limit` | number | No | Max messages to return (max 100, default 40) |

**Response (Success - 200):**

```json
{
  "items": [
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "groupId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "from": "64f1a2b3c4d5e6f7g8h9i0j3",
      "text": "Hello everyone!",
      "attachments": [],
      "mentions": [],
      "replyTo": null,
      "editedAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j4",
      "groupId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "from": "64f1a2b3c4d5e6f7g8h9i0j5",
      "text": "@john.doe Check this out!",
      "attachments": [
        {
          "fileName": "image.jpg",
          "fileSize": 1024000,
          "fileType": "image/jpeg",
          "fileUrl": "https://s3.amazonaws.com/bucket/file-key",
          "fileKey": "file-key",
          "uploadedAt": "2024-01-15T10:31:00.000Z"
        }
      ],
      "mentions": ["64f1a2b3c4d5e6f7g8h9i0j3"],
      "replyTo": "64f1a2b3c4d5e6f7g8h9i0j1",
      "editedAt": null,
      "createdAt": "2024-01-15T10:31:00.000Z",
      "updatedAt": "2024-01-15T10:31:00.000Z"
    }
  ],
  "nextCursor": "2024-01-15T10:30:00.000Z"
}
```

**Message Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Message ID |
| `groupId` | string | Group ID |
| `from` | string | Sender's user ID |
| `text` | string | Message text (may be empty if only attachments) |
| `attachments` | array | Array of attachment objects |
| `mentions` | array | Array of user IDs mentioned in the message |
| `replyTo` | string \| null | ID of message being replied to |
| `editedAt` | string \| null | ISO timestamp when edited (null if never edited) |
| `createdAt` | string | ISO timestamp when created |
| `updatedAt` | string | ISO timestamp when updated |

**Note:** Group messages support attachments, mentions, and replies. Messages can have either text, attachments, or both.

---

### Mark Group Messages as Read

**Endpoint:** `POST /groups/:groupId/read`

**Description:** Marks all messages in a group as read up to a specific timestamp by updating the user's `lastReadAt`.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |

**Request Body (Optional):**

```json
{
  "upTo": "2024-01-15T10:31:00.000Z"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `upTo` | string | No | ISO timestamp. Defaults to current time if not provided |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

---

### Get Unread Counts for All Groups

**Endpoint:** `GET /groups/unread/all`

**Description:** Gets unread message counts for all groups the user is a member of.

**Authentication:** Required (Bearer token)

**Response (Success - 200):**

```json
{
  "groups": [
    {
      "groupId": "64f1a2b3c4d5e6f7g8h9i0j1",
      "count": 5
    },
    {
      "groupId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "count": 0
    }
  ]
}
```

---

### Get Single Group Details

**Endpoint:** `GET /groups/:groupId`

**Description:** Gets detailed information about a specific group, including all members and their roles.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |

**Response (Success - 200):**

```json
{
  "id": "64f1a2b3c4d5e6f7g8h9i0j1",
  "name": "Engineering Team",
  "picture": "https://uploadthing.com/group-picture-url",
  "createdBy": "64f1a2b3c4d5e6f7g8h9i0j2",
  "members": [
    {
      "userId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "role": "admin",
      "joinedAt": "2024-01-15T10:30:00.000Z",
      "lastReadAt": "2024-01-15T09:00:00.000Z"
    },
    {
      "userId": "64f1a2b3c4d5e6f7g8h9i0j3",
      "role": "member",
      "joinedAt": "2024-01-15T10:30:00.000Z",
      "lastReadAt": "1970-01-01T00:00:00.000Z"
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Group ID |
| `name` | string | Group name |
| `picture` | string \| null | URL to group picture (null if not set) |
| `createdBy` | string | User ID of the group creator |
| `members` | array | Array of member objects |

**Response (Error - 404):**

```json
{
  "error": "Group not found or access denied"
}
```

---

### Update Group

**Endpoint:** `PUT /groups/:groupId`

**Description:** Updates a group's name and/or picture. Only admins (group creator or members with admin role) can update groups.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |

**Request Body:**

```json
{
  "name": "Updated Group Name",
  "picture": "https://uploadthing.com/new-picture-url"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New group name (2-80 characters) |
| `picture` | string \| null | No | URL to new group picture (null to remove) |

**Note:** Both fields are optional. Only include fields you want to update.

**Response (Success - 200):**

```json
{
  "ok": true,
  "group": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Updated Group Name",
    "picture": "https://uploadthing.com/new-picture-url"
  }
}
```

**Response (Error - 403):**

```json
{
  "error": "Only admins can update the group"
}
```

**Response (Error - 404):**

```json
{
  "error": "Group not found or access denied"
}
```

**Example Request:**

```javascript
const updateGroup = async (groupId, updates, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to update group");
    }

    return data.group;
  } catch (error) {
    console.error("Error updating group:", error);
    throw error;
  }
};
```

---

### Remove Member from Group

**Endpoint:** `DELETE /groups/:groupId/members/:memberId`

**Description:** Removes a member from a group. Admins can remove any member (except the group creator), and users can remove themselves.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |
| `memberId` | string | Yes | User ID of the member to remove |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

**Response (Error - 403):**

```json
{
  "error": "Only admins can remove other members"
}
```

or

```json
{
  "error": "Cannot remove the group creator"
}
```

**Response (Error - 404):**

```json
{
  "error": "Group not found"
}
```

**Example Request:**

```javascript
const removeMember = async (groupId, memberId, token) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/groups/${groupId}/members/${memberId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to remove member");
    }

    return data;
  } catch (error) {
    console.error("Error removing member:", error);
    throw error;
  }
};
```

---

### Edit Group Message

**Endpoint:** `PUT /groups/:groupId/message/:messageId`

**Description:** Edits a group message sent by the current user. Only the sender can edit their own messages.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |
| `messageId` | string | Yes | Message ID to edit |

**Request Body:**

```json
{
  "text": "Updated message text"
}
```

**Response (Success - 200):**

```json
{
  "ok": true,
  "message": {
    "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "text": "Updated message text",
    "editedAt": "2024-01-15T10:35:00.000Z",
    ...
  }
}
```

**Response (Error - 404):**

```json
{
  "error": "Message not found or not authorized"
}
```

---

### Delete Group Message

**Endpoint:** `DELETE /groups/:groupId/message/:messageId`

**Description:** Deletes a group message sent by the current user. Only the sender can delete their own messages.

**Authentication:** Required (Bearer token)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |
| `messageId` | string | Yes | Message ID to delete |

**Response (Success - 200):**

```json
{
  "ok": true
}
```

**Response (Error - 404):**

```json
{
  "error": "Message not found or not authorized"
}
```

---

## Link Preview API

### Get Link Preview Metadata

**Endpoint:** `POST /link-preview`

**Description:** Fetches metadata (title, description, image, etc.) from a URL for displaying link previews in chat messages.

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "url": "https://example.com/article"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Valid URL to fetch metadata from |

**Response (Success - 200):**

```json
{
  "ok": true,
  "metadata": {
    "title": "Example Article Title",
    "description": "This is a description of the article",
    "image": "https://example.com/image.jpg",
    "url": "https://example.com/article",
    "siteName": "Example Site"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Success flag |
| `metadata.title` | string \| undefined | Page title (from og:title or <title> tag) |
| `metadata.description` | string \| undefined | Page description (from og:description or meta description) |
| `metadata.image` | string \| undefined | Preview image URL (from og:image) |
| `metadata.url` | string | Original URL |
| `metadata.siteName` | string \| undefined | Site name (from og:site_name) |

**Response (Error - 400):**

```json
{
  "ok": false,
  "error": "Invalid URL format"
}
```

**Response (Error - 500):**

```json
{
  "ok": false,
  "error": "Failed to fetch link preview"
}
```

**Example Request:**

```javascript
const getLinkPreview = async (url, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/link-preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Failed to fetch link preview");
    }

    return data.metadata;
  } catch (error) {
    console.error("Error fetching link preview:", error);
    throw error;
  }
};
```

---

## Real-Time Messaging (Socket.IO)

Real-time messaging uses Socket.IO for instant message delivery, typing indicators, and read receipts. You need to establish a WebSocket connection after authentication.

### Socket.IO Connection

**Connection URL:** `ws://your-api-domain.com/socket.io` (or `wss://` for production)

**Authentication:**

- Send token via `auth.token` in handshake
- Or via `Authorization` header: `Authorization: Bearer <token>`

**Example Connection (React Native with socket.io-client):**

```javascript
import { io } from "socket.io-client";

const connectSocket = async (token) => {
  const socket = io(API_BASE_URL, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: {
      token: token,
    },
    // Alternative: use headers
    // extraHeaders: {
    //   Authorization: `Bearer ${token}`
    // }
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  return socket;
};
```

---

### One-to-One Chat Events

#### Join DM Conversation

**Event:** `dm:join`

**Payload:**

```javascript
{
  otherId: "64f1a2b3c4d5e6f7g8h9i0j2";
}
```

**Description:** Join a DM conversation room to receive real-time messages.

**Example:**

```javascript
socket.emit("dm:join", { otherId: "64f1a2b3c4d5e6f7g8h9i0j2" });
```

---

#### Send DM Message

**Event:** `dm:message`

**Payload:**

```javascript
{
  otherId: "64f1a2b3c4d5e6f7g8h9i0j2",
  text: "Hello!",
  tempId: "temp-123", // Optional: client-generated ID for optimistic updates
  attachments: [ // Optional
    {
      fileName: "image.jpg",
      fileSize: 1024000,
      fileType: "image/jpeg",
      fileUrl: "https://s3.amazonaws.com/bucket/file-key"
    }
  ],
  replyTo: "64f1a2b3c4d5e6f7g8h9i0j1" // Optional: message ID being replied to
}
```

**Response (Acknowledgment):**

```javascript
{
  ok: true,
  msg: {
    _id: "64f1a2b3c4d5e6f7g8h9i0j3",
    convId: "dm:abc123:xyz789",
    from: "64f1a2b3c4d5e6f7g8h9i0j1",
    to: "64f1a2b3c4d5e6f7g8h9i0j2",
    text: "Hello!",
    attachments: [...],
    replyTo: null,
    editedAt: null,
    createdAt: "2024-01-15T10:30:00.000Z",
    readAt: null,
    tempId: "temp-123"
  }
}
```

**Event Received:** `dm:message`

**Description:** Sent to all participants in the conversation when a new message is created.

**Example:**

```javascript
// Send message
socket.emit(
  "dm:message",
  {
    otherId: "64f1a2b3c4d5e6f7g8h9i0j2",
    text: "Hello!",
    tempId: "temp-123",
  },
  (ack) => {
    if (ack.ok) {
      console.log("Message sent:", ack.msg);
      // Update UI with server message (replace temp message)
    } else {
      console.error("Failed to send:", ack.error);
      // Show error, mark temp message as failed
    }
  }
);

// Receive messages
socket.on("dm:message", (message) => {
  console.log("New message received:", message);
  // Add message to chat UI
});
```

---

#### Typing Indicators

**Event (Start Typing):** `dm:typing`

**Payload:**

```javascript
{
  otherId: "64f1a2b3c4d5e6f7g8h9i0j2";
}
```

**Event (Stop Typing):** `dm:stopTyping`

**Payload:**

```javascript
{
  otherId: "64f1a2b3c4d5e6f7g8h9i0j2";
}
```

**Event Received:** `dm:typing` / `dm:stopTyping`

**Payload Received:**

```javascript
{
  userId: "64f1a2b3c4d5e6f7g8h9i0j2",
  userName: "John Doe" // Only for typing event
}
```

**Example:**

```javascript
let typingTimeout;

// Start typing
const handleTextChange = (text) => {
  if (text.length > 0) {
    socket.emit("dm:typing", { otherId: otherUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("dm:stopTyping", { otherId: otherUserId });
    }, 3000); // Stop typing after 3 seconds of inactivity
  }
};

// Receive typing indicators
socket.on("dm:typing", ({ userId, userName }) => {
  // Show "John Doe is typing..." in UI
  console.log(`${userName} is typing...`);
});

socket.on("dm:stopTyping", ({ userId }) => {
  // Hide typing indicator
  console.log("User stopped typing");
});
```

---

### Group Chat Events

#### Join Group

**Event:** `group:join`

**Payload:**

```javascript
{
  groupId: "64f1a2b3c4d5e6f7g8h9i0j1";
}
```

**Description:** Join a group room to receive real-time messages.

**Example:**

```javascript
socket.emit("group:join", { groupId: "64f1a2b3c4d5e6f7g8h9i0j1" });
```

---

#### Send Group Message

**Event:** `group:message`

**Payload:**

```javascript
{
  groupId: "64f1a2b3c4d5e6f7g8h9i0j1",
  text: "@john.doe Hello everyone!", // Optional if attachments present
  tempId: "temp-123", // Optional: client-generated ID
  attachments: [ // Optional
    {
      fileName: "image.jpg",
      fileSize: 1024000,
      fileType: "image/jpeg",
      fileUrl: "https://s3.amazonaws.com/bucket/file-key",
      fileKey: "file-key" // Optional, extracted from URL if not provided
    }
  ],
  replyTo: "64f1a2b3c4d5e6f7g8h9i0j2" // Optional: message ID being replied to
}
```

**Payload Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `groupId` | string | Yes | Group ID |
| `text` | string | No\* | Message text (required if no attachments) |
| `tempId` | string | No | Client-generated temporary ID for optimistic updates |
| `attachments` | array | No | Array of attachment objects (required if no text) |
| `replyTo` | string | No | ID of message being replied to |

**Note:** Message must have either `text` or `attachments` (or both).

**Response (Acknowledgment):**

```javascript
{
  ok: true,
  msg: {
    _id: "64f1a2b3c4d5e6f7g8h9i0j2",
    groupId: "64f1a2b3c4d5e6f7g8h9i0j1",
    from: "64f1a2b3c4d5e6f7g8h9i0j3",
    text: "@john.doe Hello everyone!",
    attachments: [...],
    mentions: ["64f1a2b3c4d5e6f7g8h9i0j4"], // Array of mentioned user IDs
    replyTo: "64f1a2b3c4d5e6f7g8h9i0j2",
    editedAt: null,
    createdAt: "2024-01-15T10:30:00.000Z",
    tempId: "temp-123"
  }
}
```

**Event Received:** `group:message`

**Description:** Sent to all members of the group when a new message is created. If users are mentioned (using `@username` in the text), they receive high-priority notifications.

**Mentions:**

- Users can be mentioned in group messages using `@username`, `@email`, or `@userId`
- Mentioned users receive a `group_mention` notification with high priority
- The `mentions` array in the message contains all mentioned user IDs
- Mention matching supports full names with spaces (e.g., `@John Doe`)

**Example:**

```javascript
// Send message with attachment and mention
socket.emit(
  "group:message",
  {
    groupId: "64f1a2b3c4d5e6f7g8h9i0j1",
    text: "@john.doe Check this out!",
    tempId: "temp-123",
    attachments: [
      {
        fileName: "image.jpg",
        fileSize: 1024000,
        fileType: "image/jpeg",
        fileUrl: "https://s3.amazonaws.com/bucket/file-key",
      },
    ],
    replyTo: "64f1a2b3c4d5e6f7g8h9i0j2",
  },
  (ack) => {
    if (ack.ok) {
      console.log("Message sent:", ack.msg);
      // Message will include parsed mentions array
    } else {
      console.error("Failed to send:", ack.error);
    }
  }
);

// Receive messages
socket.on("group:message", (message) => {
  console.log("New group message:", message);
  // Check if current user is mentioned
  if (message.mentions && message.mentions.includes(currentUserId)) {
    // Show prominent notification
    showMentionNotification(message);
  }
  // Add message to group chat UI
});
```

**Notifications for Mentions:**
When a user is mentioned in a group message, they receive a notification with:

- `type: "group_mention"`
- `priority: "high"`
- Includes group ID, group name, message ID, and sender information

---

## File Attachments

### Upload File

**Endpoint:** `POST /upload`

**Description:** Uploads a file to S3 and returns a presigned URL that's valid for 7 days. Use this before sending messages with attachments.

**Authentication:** Required (Bearer token)

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field

**Request Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | File to upload (max 10MB) |

**Supported File Types:**

- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Videos: `video/mp4`, `video/webm`, `video/quicktime`
- Documents: `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Archives: `application/zip`, `application/x-rar-compressed`

**Response (Success - 200):**

```json
{
  "url": "https://s3.amazonaws.com/bucket/file-key?signature=...",
  "key": "user-id/org-id/filename.jpg",
  "fileName": "image.jpg",
  "fileSize": 1024000,
  "fileType": "image/jpeg"
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Presigned URL (valid for 7 days) |
| `key` | string | S3 file key |
| `fileName` | string | Original filename |
| `fileSize` | number | File size in bytes |
| `fileType` | string | MIME type |

**Response (Error - 400):**

```json
{
  "error": "No file provided"
}
```

**Response (Error - 413):**

```json
{
  "error": "File too large"
}
```

**Example Request (React Native/Expo):**

```javascript
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const uploadFile = async (fileUri, fileName, mimeType, token) => {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to blob (for web) or FormData (for React Native)
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Example: Upload image from gallery
const pickAndUploadImage = async (token) => {
  // Request permission
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissionResult.granted) {
    throw new Error('Permission not granted');
  }

  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    const asset = result.assets[0];
    const uploadResult = await uploadFile(
      asset.uri,
      asset.fileName || 'image.jpg',
      asset.type || 'image/jpeg',
      token
    );
    return uploadResult;
  }
};
```

---

### Using Attachments in Messages

After uploading a file, include the attachment information when sending a message via Socket.IO:

```javascript
// 1. Upload file first
const uploadResult = await uploadFile(fileUri, fileName, mimeType, token);

// 2. Send message with attachment
socket.emit(
  "dm:message",
  {
    otherId: otherUserId,
    text: "Check out this image!",
    attachments: [
      {
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        fileType: uploadResult.fileType,
        fileUrl: uploadResult.url,
      },
    ],
  },
  (ack) => {
    if (ack.ok) {
      console.log("Message with attachment sent:", ack.msg);
    }
  }
);
```

---

## Error Handling

### HTTP Status Codes

| Code | Description                                |
| ---- | ------------------------------------------ |
| 200  | Success                                    |
| 400  | Bad Request (invalid input)                |
| 401  | Unauthorized (missing or invalid token)    |
| 403  | Forbidden (not authorized for this action) |
| 404  | Not Found                                  |
| 413  | Payload Too Large (file upload)            |
| 500  | Internal Server Error                      |

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### Common Error Scenarios

#### Authentication Errors

```json
{
  "error": "Missing auth"
}
```

**Solution:** Include `Authorization: Bearer <token>` header

#### Invalid Token

```json
{
  "error": "Invalid token"
}
```

**Solution:** Request a new token via `/auth/select-org` or re-authenticate

#### Validation Errors

```json
{
  "error": "Name must be at least 2 characters"
}
```

**Solution:** Validate input on client side before sending

---

## Complete Example: Chat Implementation Flow

Here's a complete example of implementing chat in your Expo app:

```javascript
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const useChat = (otherUserId, token) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const newSocket = io(API_BASE_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      // Join DM conversation
      newSocket.emit("dm:join", { otherId: otherUserId });
    });

    // Listen for messages
    newSocket.on("dm:message", (message) => {
      setMessages((prev) => {
        // Check if message already exists (avoid duplicates)
        if (
          prev.find((m) => m._id === message._id || m.tempId === message.tempId)
        ) {
          return prev;
        }
        return [...prev, message];
      });
    });

    // Listen for typing indicators
    newSocket.on("dm:typing", () => setIsTyping(true));
    newSocket.on("dm:stopTyping", () => setIsTyping(false));

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, otherUserId]);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/dm/${otherUserId}/messages?limit=40`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();
        setMessages(data.items.reverse()); // Reverse to show newest at bottom
        setNextCursor(data.nextCursor);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token && otherUserId) {
      loadMessages();
    }
  }, [token, otherUserId]);

  // Send message
  const sendMessage = (text, attachments = []) => {
    if (!socket || !text.trim()) return;

    const tempId = `temp-${Date.now()}`;

    // Optimistically add message
    const tempMessage = {
      tempId,
      text,
      from: currentUserId,
      to: otherUserId,
      createdAt: new Date().toISOString(),
      attachments,
    };
    setMessages((prev) => [...prev, tempMessage]);

    // Send via socket
    socket.emit(
      "dm:message",
      {
        otherId: otherUserId,
        text,
        tempId,
        attachments,
      },
      (ack) => {
        if (ack.ok) {
          // Replace temp message with server message
          setMessages((prev) =>
            prev.map((m) => (m.tempId === tempId ? ack.msg : m))
          );
        } else {
          // Mark as failed
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === tempId ? { ...m, failed: true, error: ack.error } : m
            )
          );
        }
      }
    );
  };

  // Mark as read
  const markAsRead = async () => {
    try {
      await fetch(`${API_BASE_URL}/dm/${otherUserId}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Load more messages (pagination)
  const loadMore = async () => {
    if (!nextCursor || loading) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/dm/${otherUserId}/messages?cursor=${nextCursor}&limit=40`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      setMessages((prev) => [...data.items.reverse(), ...prev]);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Error loading more messages:", error);
    }
  };

  return {
    messages,
    sendMessage,
    markAsRead,
    loadMore,
    isTyping,
    loading,
    hasMore: !!nextCursor,
  };
};
```

---

## Best Practices

### 1. Token Management

- Store token securely using `@react-native-async-storage/async-storage` or `expo-secure-store`
- Refresh token when it expires (JWT expires in 7 days)
- Handle token expiration gracefully (redirect to login)

### 2. Socket Connection

- Reconnect automatically on disconnect
- Handle connection errors gracefully
- Join conversation rooms only when needed
- Clean up socket connections when component unmounts

### 3. Message Handling

- Use optimistic updates for better UX
- Handle duplicate messages (check message ID)
- Implement message queuing for offline support
- Show loading states while sending

### 4. File Uploads

- Validate file size and type before upload
- Show upload progress
- Handle upload failures gracefully
- Clean up failed uploads

### 5. Performance

- Implement pagination for message lists
- Use flat lists for large message lists
- Cache user profiles and avatars
- Optimize image rendering

---

## Support

For questions or issues, contact the development team or refer to the main API documentation.

**Last Updated:** 2024-01-15

---

## Additional Features Added

### Group Management

- **Group Pictures**: Groups can have custom profile pictures
- **Edit Groups**: Admins can update group names and pictures
- **Remove Members**: Admins can remove members; users can leave groups themselves

### Message Features

- **Edit Messages**: Users can edit their own messages in both DM and group chats
- **Delete Messages**: Users can delete their own messages in both DM and group chats
- **Reply to Messages**: Both DM and group messages support replying to specific messages
- **Mentions in Groups**: Tag users in group chats using `@username` to send high-priority notifications
- **Attachments in Groups**: Group messages support file attachments (images, videos, documents)
- **Link Previews**: Automatic link preview generation for shared URLs

### Notifications

- **Mention Notifications**: High-priority notifications when mentioned in group chats
- **Rich Notifications**: Notifications include context (group name, sender, message preview)
