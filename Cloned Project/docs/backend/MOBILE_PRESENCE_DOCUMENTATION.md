# Mobile Presence & Online Status Documentation

This document provides comprehensive documentation for implementing user presence (online/offline status) in the Roam mobile application. It covers real-time presence tracking, last seen timestamps, and UI integration patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Base Configuration](#base-configuration)
3. [Presence System Architecture](#presence-system-architecture)
4. [API Endpoints](#api-endpoints)
5. [Socket.IO Events](#socketio-events)
6. [Implementation Guide](#implementation-guide)
7. [UI/UX Best Practices](#uiux-best-practices)
8. [Code Examples](#code-examples)
9. [Error Handling](#error-handling)
10. [Performance Optimization](#performance-optimization)

---

## Overview

The presence system allows you to:

- Display real-time online/offline status for team members
- Show "last seen" timestamps for offline users
- Track user activity states (online, away, offline)
- Display typing indicators in conversations
- Show presence in multiple UI contexts (chat list, user profiles, DM screens)

### Key Features

- **Real-time Updates**: Instant presence changes via Socket.IO
- **Automatic Away Detection**: Users marked as "away" after inactivity
- **Last Seen Tracking**: Precise timestamps when users go offline
- **Batch Updates**: Efficient presence updates for multiple users
- **Reconnection Handling**: Automatic presence restoration on reconnect

---

## Base Configuration

### Requirements

```json
{
  "dependencies": {
    "socket.io-client": "^4.5.0",
    "@react-native-async-storage/async-storage": "^1.19.0",
    "react-native": ">=0.70.0"
  }
}
```

### Base URL

```
Production: https://your-api-domain.com
Development: http://localhost:4000
```

### Authentication

All presence features require authentication via JWT token:

```
Authorization: Bearer <your_jwt_token>
```

---

## Presence System Architecture

### Presence States

The system supports three presence states:

| State     | Description                                  | Color Indicator  |
| --------- | -------------------------------------------- | ---------------- |
| `online`  | User is actively connected and using the app | 🟢 Green         |
| `away`    | User is connected but inactive (5+ minutes)  | 🟡 Yellow/Orange |
| `offline` | User is disconnected                         | ⚫ Gray          |

### State Transitions

```
User Opens App → online
User Inactive 5min → away
User Closes App → offline
User Returns → online
```

### Data Model

**User Presence Object:**

```typescript
interface UserPresence {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeen: string; // ISO timestamp
  lastActive: string; // ISO timestamp
}
```

---

## API Endpoints

### 1. Get Organization Members with Presence

**Endpoint:** `GET /team/list?orgId=<organization_id>`

**Description:** Retrieves all team members with their current online status and last seen information.

**Authentication:** Required (Bearer token)

**Query Parameters:**

| Parameter | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| `orgId`   | string | Yes      | Organization ID |

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
      "profilePicture": "https://uploadthing.com/profile-url",
      "presence": {
        "status": "online",
        "lastSeen": "2024-01-15T10:30:00.000Z",
        "lastActive": "2024-01-15T10:30:00.000Z"
      }
    },
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "id": "64f1a2b3c4d5e6f7g8h9i0j2",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "member",
      "profilePicture": null,
      "presence": {
        "status": "offline",
        "lastSeen": "2024-01-15T09:15:00.000Z",
        "lastActive": "2024-01-15T09:10:00.000Z"
      }
    },
    {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j3",
      "id": "64f1a2b3c4d5e6f7g8h9i0j3",
      "name": "Bob Wilson",
      "email": "bob@example.com",
      "role": "member",
      "profilePicture": "https://uploadthing.com/profile-url-2",
      "presence": {
        "status": "away",
        "lastSeen": "2024-01-15T10:25:00.000Z",
        "lastActive": "2024-01-15T10:20:00.000Z"
      }
    }
  ]
}
```

**Example Request:**

```javascript
const getTeamMembersWithPresence = async (orgId, token) => {
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

### 2. Get Bulk Presence Status

**Endpoint:** `POST /presence/bulk`

**Description:** Get presence status for multiple users at once. Useful for optimizing presence queries.

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "userIds": [
    "64f1a2b3c4d5e6f7g8h9i0j1",
    "64f1a2b3c4d5e6f7g8h9i0j2",
    "64f1a2b3c4d5e6f7g8h9i0j3"
  ]
}
```

**Request Fields:**

| Field     | Type  | Required | Description                 |
| --------- | ----- | -------- | --------------------------- |
| `userIds` | array | Yes      | Array of user IDs (max 100) |

**Response (Success - 200):**

```json
{
  "presence": [
    {
      "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
      "status": "online",
      "lastSeen": "2024-01-15T10:30:00.000Z",
      "lastActive": "2024-01-15T10:30:00.000Z"
    },
    {
      "userId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "status": "offline",
      "lastSeen": "2024-01-15T09:15:00.000Z",
      "lastActive": "2024-01-15T09:10:00.000Z"
    },
    {
      "userId": "64f1a2b3c4d5e6f7g8h9i0j3",
      "status": "away",
      "lastSeen": "2024-01-15T10:25:00.000Z",
      "lastActive": "2024-01-15T10:20:00.000Z"
    }
  ]
}
```

**Example Request:**

```javascript
const getBulkPresence = async (userIds, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/presence/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds }),
    });
    const data = await response.json();
    return data.presence;
  } catch (error) {
    console.error("Error fetching bulk presence:", error);
    throw error;
  }
};
```

---

### 3. Get Single User Presence

**Endpoint:** `GET /presence/:userId`

**Description:** Get presence status for a specific user.

**Authentication:** Required (Bearer token)

**Path Parameters:**

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| `userId`  | string | Yes      | User ID to check |

**Response (Success - 200):**

```json
{
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "status": "online",
  "lastSeen": "2024-01-15T10:30:00.000Z",
  "lastActive": "2024-01-15T10:30:00.000Z"
}
```

**Response (Error - 404):**

```json
{
  "error": "User not found"
}
```

**Example Request:**

```javascript
const getUserPresence = async (userId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/presence/${userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user presence:", error);
    throw error;
  }
};
```

---

## Socket.IO Events

### Connection and Presence

When you connect to Socket.IO, your presence is automatically broadcasted to relevant users (organization members).

### 1. Automatic Presence Broadcasting

**Description:** When a user connects or disconnects, their presence is automatically broadcast to all organization members.

**Event Received:** `presence:update`

**Payload:**

```javascript
{
  userId: "64f1a2b3c4d5e6f7g8h9i0j1",
  status: "online", // or "away" or "offline"
  lastSeen: "2024-01-15T10:30:00.000Z",
  lastActive: "2024-01-15T10:30:00.000Z"
}
```

**Example:**

```javascript
socket.on("presence:update", (presence) => {
  console.log(`User ${presence.userId} is now ${presence.status}`);
  // Update your local presence state
  updateUserPresence(presence.userId, presence);
});
```

---

### 2. Bulk Presence Updates

**Event Received:** `presence:bulk`

**Description:** Receive presence updates for multiple users at once. Sent on initial connection or when multiple users change status simultaneously.

**Payload:**

```javascript
{
  updates: [
    {
      userId: "64f1a2b3c4d5e6f7g8h9i0j1",
      status: "online",
      lastSeen: "2024-01-15T10:30:00.000Z",
      lastActive: "2024-01-15T10:30:00.000Z",
    },
    {
      userId: "64f1a2b3c4d5e6f7g8h9i0j2",
      status: "offline",
      lastSeen: "2024-01-15T09:15:00.000Z",
      lastActive: "2024-01-15T09:10:00.000Z",
    },
  ];
}
```

**Example:**

```javascript
socket.on("presence:bulk", ({ updates }) => {
  console.log(`Received ${updates.length} presence updates`);
  updates.forEach((presence) => {
    updateUserPresence(presence.userId, presence);
  });
});
```

---

### 3. Manual Activity Update

**Event:** `presence:activity`

**Description:** Manually update your last activity timestamp. Useful for preventing "away" status when user is actively using the app.

**Payload:**

```javascript
// No payload required
```

**Response (Acknowledgment):**

```javascript
{
  ok: true,
  status: "online",
  lastActive: "2024-01-15T10:30:00.000Z"
}
```

**Example:**

```javascript
// Send activity heartbeat every 60 seconds when user is active
const sendActivityHeartbeat = () => {
  socket.emit("presence:activity", (ack) => {
    if (ack.ok) {
      console.log("Activity updated:", ack.status);
    }
  });
};

// Set up heartbeat interval
const heartbeatInterval = setInterval(() => {
  if (isAppActive) {
    sendActivityHeartbeat();
  }
}, 60000); // Every 60 seconds
```

---

### 4. Request Presence for Specific Users

**Event:** `presence:subscribe`

**Description:** Subscribe to presence updates for specific users. Useful for DM conversations or focused views.

**Payload:**

```javascript
{
  userIds: ["64f1a2b3c4d5e6f7g8h9i0j1", "64f1a2b3c4d5e6f7g8h9i0j2"];
}
```

**Response (Acknowledgment):**

```javascript
{
  ok: true,
  presence: [
    {
      userId: "64f1a2b3c4d5e6f7g8h9i0j1",
      status: "online",
      lastSeen: "2024-01-15T10:30:00.000Z",
      lastActive: "2024-01-15T10:30:00.000Z"
    },
    {
      userId: "64f1a2b3c4d5e6f7g8h9i0j2",
      status: "away",
      lastSeen: "2024-01-15T10:25:00.000Z",
      lastActive: "2024-01-15T10:20:00.000Z"
    }
  ]
}
```

**Example:**

```javascript
const subscribeToUserPresence = (userIds) => {
  socket.emit("presence:subscribe", { userIds }, (ack) => {
    if (ack.ok) {
      console.log("Subscribed to presence for", userIds.length, "users");
      ack.presence.forEach((presence) => {
        updateUserPresence(presence.userId, presence);
      });
    }
  });
};
```

---

### 5. Unsubscribe from Presence

**Event:** `presence:unsubscribe`

**Description:** Unsubscribe from presence updates for specific users. Clean up when leaving screens.

**Payload:**

```javascript
{
  userIds: ["64f1a2b3c4d5e6f7g8h9i0j1", "64f1a2b3c4d5e6f7g8h9i0j2"];
}
```

**Response (Acknowledgment):**

```javascript
{
  ok: true;
}
```

**Example:**

```javascript
const unsubscribeFromUserPresence = (userIds) => {
  socket.emit("presence:unsubscribe", { userIds }, (ack) => {
    if (ack.ok) {
      console.log("Unsubscribed from presence");
    }
  });
};
```

---

## Implementation Guide

### Step 1: Set Up Presence State Management

Create a context or state management solution for presence:

```javascript
import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";

const PresenceContext = createContext(null);

export const PresenceProvider = ({ children, token, orgId }) => {
  const [presenceMap, setPresenceMap] = useState(new Map());
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) return;

    // Connect to socket
    const newSocket = io(API_BASE_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
    });

    newSocket.on("connect", () => {
      console.log("Presence socket connected");

      // Request initial presence for org members
      fetchOrgPresence();
    });

    // Listen for presence updates
    newSocket.on("presence:update", (presence) => {
      setPresenceMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(presence.userId, presence);
        return newMap;
      });
    });

    // Listen for bulk updates
    newSocket.on("presence:bulk", ({ updates }) => {
      setPresenceMap((prev) => {
        const newMap = new Map(prev);
        updates.forEach((presence) => {
          newMap.set(presence.userId, presence);
        });
        return newMap;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const fetchOrgPresence = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/team/list?orgId=${orgId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();

      const newMap = new Map();
      data.members.forEach((member) => {
        if (member.presence) {
          newMap.set(member.id, member.presence);
        }
      });
      setPresenceMap(newMap);
    } catch (error) {
      console.error("Error fetching org presence:", error);
    }
  };

  const getPresence = (userId) => {
    return (
      presenceMap.get(userId) || {
        status: "offline",
        lastSeen: null,
        lastActive: null,
      }
    );
  };

  const subscribeToUsers = (userIds) => {
    if (socket) {
      socket.emit("presence:subscribe", { userIds }, (ack) => {
        if (ack.ok) {
          ack.presence.forEach((presence) => {
            setPresenceMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(presence.userId, presence);
              return newMap;
            });
          });
        }
      });
    }
  };

  const sendActivity = () => {
    if (socket) {
      socket.emit("presence:activity");
    }
  };

  return (
    <PresenceContext.Provider
      value={{
        presenceMap,
        getPresence,
        subscribeToUsers,
        sendActivity,
        socket,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within PresenceProvider");
  }
  return context;
};
```

---

### Step 2: Create Presence Indicator Component

```javascript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { usePresence } from "./PresenceContext";

const PresenceIndicator = ({ userId, showLabel = false, size = "small" }) => {
  const { getPresence } = usePresence();
  const presence = getPresence(userId);

  const getStatusColor = () => {
    switch (presence.status) {
      case "online":
        return "#10B981"; // Green
      case "away":
        return "#F59E0B"; // Orange
      case "offline":
      default:
        return "#6B7280"; // Gray
    }
  };

  const getStatusLabel = () => {
    switch (presence.status) {
      case "online":
        return "Online";
      case "away":
        return "Away";
      case "offline":
      default:
        return "Offline";
    }
  };

  const indicatorSize = size === "small" ? 8 : size === "medium" ? 12 : 16;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.indicator,
          {
            width: indicatorSize,
            height: indicatorSize,
            borderRadius: indicatorSize / 2,
            backgroundColor: getStatusColor(),
          },
        ]}
      />
      {showLabel && (
        <Text style={[styles.label, { color: getStatusColor() }]}>
          {getStatusLabel()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  indicator: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  label: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
  },
});

export default PresenceIndicator;
```

---

### Step 3: Create Last Seen Component

```javascript
import React, { useState, useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { usePresence } from "./PresenceContext";

const LastSeenText = ({ userId, style }) => {
  const { getPresence } = usePresence();
  const presence = getPresence(userId);
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    const updateTimeAgo = () => {
      if (presence.status === "online") {
        setTimeAgo("Active now");
        return;
      }

      if (!presence.lastSeen) {
        setTimeAgo("Offline");
        return;
      }

      const lastSeenDate = new Date(presence.lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        setTimeAgo("Just now");
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins} minute${diffMins > 1 ? "s" : ""} ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours} hour${diffHours > 1 ? "s" : ""} ago`);
      } else if (diffDays < 7) {
        setTimeAgo(`${diffDays} day${diffDays > 1 ? "s" : ""} ago`);
      } else {
        setTimeAgo(lastSeenDate.toLocaleDateString());
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [presence]);

  return <Text style={[styles.text, style]}>{timeAgo}</Text>;
};

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: "#6B7280",
  },
});

export default LastSeenText;
```

---

### Step 4: Activity Tracking Hook

```javascript
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { usePresence } from "./PresenceContext";

export const useActivityTracking = () => {
  const { sendActivity } = usePresence();
  const appState = useRef(AppState.currentState);
  const activityInterval = useRef(null);

  useEffect(() => {
    // Start activity heartbeat
    activityInterval.current = setInterval(() => {
      if (appState.current === "active") {
        sendActivity();
      }
    }, 60000); // Every 60 seconds

    // Listen for app state changes
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground
        sendActivity();
      }

      appState.current = nextAppState;
    });

    return () => {
      if (activityInterval.current) {
        clearInterval(activityInterval.current);
      }
      subscription?.remove();
    };
  }, [sendActivity]);
};
```

---

### Step 5: User List with Presence

```javascript
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import PresenceIndicator from "./PresenceIndicator";
import LastSeenText from "./LastSeenText";
import { usePresence } from "./PresenceContext";

const UserListScreen = ({ navigation, token, orgId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getPresence } = usePresence();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/team/list?orgId=${orgId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setUsers(data.members);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const aPresence = getPresence(a.id);
    const bPresence = getPresence(b.id);

    // Sort by status: online > away > offline
    const statusOrder = { online: 0, away: 1, offline: 2 };
    return statusOrder[aPresence.status] - statusOrder[bPresence.status];
  });

  const renderUser = ({ item }) => {
    const presence = getPresence(item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => navigation.navigate("Chat", { userId: item.id })}
      >
        <View style={styles.avatarContainer}>
          {item.profilePicture ? (
            <Image
              source={{ uri: item.profilePicture }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {item.name?.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <View style={styles.presenceIndicatorPosition}>
            <PresenceIndicator userId={item.id} size="medium" />
          </View>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>{item.name || item.email}</Text>
            {presence.status === "online" && (
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>Online</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <LastSeenText userId={item.id} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchUsers}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  listContent: {
    padding: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 12,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#6B7280",
  },
  presenceIndicatorPosition: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginRight: 8,
  },
  onlineBadge: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
});

export default UserListScreen;
```

---

### Step 6: DM Screen with Presence

```javascript
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import PresenceIndicator from "./PresenceIndicator";
import LastSeenText from "./LastSeenText";
import { usePresence } from "./PresenceContext";

const DMScreen = ({ route }) => {
  const { userId, userName } = route.params;
  const { subscribeToUsers, getPresence } = usePresence();
  const presence = getPresence(userId);

  useEffect(() => {
    // Subscribe to this user's presence
    subscribeToUsers([userId]);
  }, [userId]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{userName}</Text>
        <View style={styles.headerStatus}>
          <PresenceIndicator userId={userId} size="small" />
          {presence.status === "online" ? (
            <Text style={styles.headerStatusText}>Active now</Text>
          ) : (
            <LastSeenText userId={userId} style={styles.headerStatusText} />
          )}
        </View>
      </View>

      {/* Chat messages */}
      <View style={styles.messagesContainer}>
        {/* Your chat implementation */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  headerStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerStatusText: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 6,
  },
  messagesContainer: {
    flex: 1,
  },
});

export default DMScreen;
```

---

## UI/UX Best Practices

### 1. Visual Indicators

**Color Coding:**

- 🟢 **Green (#10B981)**: Online/Active
- 🟡 **Orange (#F59E0B)**: Away/Idle
- ⚫ **Gray (#6B7280)**: Offline

**Indicator Sizes:**

- Small (8px): Chat list, inline mentions
- Medium (12px): User profiles, DM headers
- Large (16px): Profile screens, detailed views

### 2. Last Seen Display

**Format Guidelines:**

- "Active now" - User is online
- "Just now" - < 1 minute ago
- "5 minutes ago" - < 60 minutes
- "2 hours ago" - < 24 hours
- "3 days ago" - < 7 days
- "Jan 15, 2024" - > 7 days

### 3. User List Sorting

Sort users by presence priority:

1. Online users (alphabetically)
2. Away users (alphabetically)
3. Offline users (by last seen, most recent first)

### 4. Real-time Updates

- Update presence indicators immediately on socket events
- Smoothly animate status changes
- Don't flash/blink indicators rapidly
- Batch updates when possible

### 5. Performance Considerations

- Limit visible presence indicators (virtualize long lists)
- Unsubscribe from presence when leaving screens
- Cache presence data locally
- Use memoization for presence components

---

## Code Examples

### Complete App Integration

```javascript
// App.js
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PresenceProvider } from "./contexts/PresenceContext";
import { useActivityTracking } from "./hooks/useActivityTracking";

import LoginScreen from "./screens/LoginScreen";
import UserListScreen from "./screens/UserListScreen";
import DMScreen from "./screens/DMScreen";

const Stack = createStackNavigator();

const AppNavigator = ({ token, orgId }) => {
  // Enable activity tracking
  useActivityTracking();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="UserList"
        component={UserListScreen}
        options={{ title: "Team Members" }}
      />
      <Stack.Screen
        name="DM"
        component={DMScreen}
        options={{ title: "Chat" }}
      />
    </Stack.Navigator>
  );
};

export default function App() {
  const [token, setToken] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthData();
  }, []);

  const loadAuthData = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("auth_token");
      const savedOrgId = await AsyncStorage.getItem("org_id");
      setToken(savedToken);
      setOrgId(savedOrgId);
    } catch (error) {
      console.error("Error loading auth data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Or loading screen
  }

  if (!token || !orgId) {
    return (
      <LoginScreen
        onLogin={(t, o) => {
          setToken(t);
          setOrgId(o);
        }}
      />
    );
  }

  return (
    <PresenceProvider token={token} orgId={orgId}>
      <NavigationContainer>
        <AppNavigator token={token} orgId={orgId} />
      </NavigationContainer>
    </PresenceProvider>
  );
}
```

---

### Presence in Chat List

```javascript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import PresenceIndicator from "./PresenceIndicator";
import { usePresence } from "./PresenceContext";

const ChatListItem = ({ conversation, onPress }) => {
  const { getPresence } = usePresence();
  const otherUserId = conversation.otherUserId;
  const presence = getPresence(otherUserId);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
        <View style={styles.presenceIndicator}>
          <PresenceIndicator userId={otherUserId} size="small" />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{conversation.name}</Text>
          <Text style={styles.time}>{conversation.lastMessageTime}</Text>
        </View>

        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {conversation.lastMessage}
          </Text>
          {conversation.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>

        {presence.status === "online" && (
          <Text style={styles.onlineText}>● Active now</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  presenceIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  time: {
    fontSize: 12,
    color: "#6B7280",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: "#6B7280",
  },
  unreadBadge: {
    backgroundColor: "#3B82F6",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  onlineText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "500",
  },
});

export default ChatListItem;
```

---

## Error Handling

### Socket Connection Errors

```javascript
socket.on("connect_error", (error) => {
  console.error("Presence connection error:", error);

  // Show user-friendly message
  if (error.message === "Invalid token") {
    // Redirect to login
    navigation.navigate("Login");
  } else {
    // Show retry option
    showErrorToast("Connection lost. Retrying...");
  }
});
```

### Reconnection Handling

```javascript
socket.on("reconnect", (attemptNumber) => {
  console.log("Reconnected after", attemptNumber, "attempts");

  // Re-fetch presence data
  fetchOrgPresence();

  // Send activity update
  socket.emit("presence:activity");
});
```

### API Error Handling

```javascript
const getUserPresence = async (userId, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/presence/${userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // User not found - show as offline
        return { status: "offline", lastSeen: null };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user presence:", error);
    // Return offline status as fallback
    return { status: "offline", lastSeen: null };
  }
};
```

---

## Performance Optimization

### 1. Memoize Presence Components

```javascript
import React, { memo } from "react";

const PresenceIndicator = memo(
  ({ userId, showLabel, size }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Only re-render if userId changes
    return prevProps.userId === nextProps.userId;
  }
);
```

### 2. Virtualize Long Lists

```javascript
import { FlatList } from "react-native";

const UserList = ({ users }) => {
  return (
    <FlatList
      data={users}
      renderItem={({ item }) => <UserListItem user={item} />}
      keyExtractor={(item) => item.id}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={21}
      removeClippedSubviews={true}
    />
  );
};
```

### 3. Debounce Activity Updates

```javascript
import { useCallback, useRef } from "react";

const useActivityTracking = () => {
  const { sendActivity } = usePresence();
  const timeoutRef = useRef(null);

  const debouncedSendActivity = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      sendActivity();
    }, 5000); // Wait 5 seconds before sending
  }, [sendActivity]);

  return { debouncedSendActivity };
};
```

### 4. Batch Presence Queries

```javascript
// Instead of fetching presence one by one
const fetchPresenceOneByOne = async (userIds) => {
  for (const userId of userIds) {
    await getUserPresence(userId);
  }
};

// Use bulk API
const fetchPresenceBulk = async (userIds) => {
  const presence = await getBulkPresence(userIds);
  return presence;
};
```

### 5. Cache Presence Data

```javascript
const presenceCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

const getCachedPresence = (userId) => {
  const cached = presenceCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCachedPresence = (userId, presence) => {
  presenceCache.set(userId, {
    data: presence,
    timestamp: Date.now(),
  });
};
```

---

## Testing Presence

### Test Scenarios

1. **User comes online**: Open app, verify indicator shows green
2. **User goes offline**: Close app, verify indicator turns gray after timeout
3. **User goes away**: Leave app idle for 5+ minutes, verify indicator turns yellow
4. **Multiple devices**: Open app on two devices, verify presence syncs
5. **Network interruption**: Disconnect network, verify graceful degradation
6. **Reconnection**: Restore network, verify presence updates automatically

### Testing Tools

```javascript
// Presence test utility
const testPresence = {
  async simulateOnline(userId) {
    // Emit mock presence update
    socket.emit("presence:update", {
      userId,
      status: "online",
      lastSeen: new Date().toISOString(),
    });
  },

  async simulateOffline(userId) {
    socket.emit("presence:update", {
      userId,
      status: "offline",
      lastSeen: new Date().toISOString(),
    });
  },

  async simulateAway(userId) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    socket.emit("presence:update", {
      userId,
      status: "away",
      lastActive: fiveMinutesAgo.toISOString(),
    });
  },
};
```

---

## Troubleshooting

### Common Issues

**Issue: Presence not updating**

- Check socket connection status
- Verify token is valid
- Ensure user IDs match exactly
- Check network connectivity

**Issue: Stuck in "away" status**

- Verify activity heartbeat is running
- Check app state listener is active
- Ensure sendActivity() is being called

**Issue: Presence indicator flickering**

- Implement debouncing for updates
- Use memoization for components
- Batch presence updates

**Issue: High battery drain**

- Reduce heartbeat frequency (max 60s)
- Use socket.io efficiently
- Unsubscribe when not needed

---

## Support

For questions or issues regarding presence implementation, contact the development team.

**Last Updated:** 2024-01-15
**Version:** 1.0.0

---

## Changelog

### Version 1.0.0 (2024-01-15)

- Initial presence documentation
- Socket.IO event specifications
- REST API endpoints
- Complete implementation examples
- UI/UX best practices
- Performance optimization guidelines
