# Webinar API Documentation

This document describes the APIs for managing webinars (workshops) in the Roam platform, including starting, stopping, joining, and rejoining webinars for both Founders and Stakeholders.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Start Webinar (Founder)](#1-start-webinar-founder)
   - [Stop Webinar (Founder)](#2-stop-webinar-founder)
   - [Rejoin Webinar (Founder)](#3-rejoin-webinar-founder)
   - [Join Webinar (Stakeholder)](#4-join-webinar-stakeholder)
   - [Rejoin Webinar (Stakeholder)](#5-rejoin-webinar-stakeholder)
4. [Socket.IO Events](#socketio-events)
5. [Implementation Guide](#implementation-guide)
6. [Error Codes](#error-codes)

---

## Overview

Webinars in the Roam platform are built on top of the Workshop and Meet systems:

- **Workshop**: Scheduled event with registration, pricing, and metadata
- **Meet**: Agora-based video conferencing session linked to a workshop
- **MeetParticipant**: Tracks who joins/leaves the video session

### Architecture Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Workshop   │────▶│    Meet     │────▶│   Agora     │
│  (metadata) │     │ (video room)│     │  (video)    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │           ┌──────────────────┐
       │           │ MeetParticipant  │
       │           │ (attendance)     │
       │           └──────────────────┘
       │
       ▼
┌──────────────────────┐
│ WorkshopRegistration │
│ (enrollment)         │
└──────────────────────┘
```

---

## Authentication

All webinar APIs require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The JWT token contains:
- `userId`: The user's ID
- `orgId`: The organization ID (token is scoped to one org)
- `name`: User's display name
- `email`: User's email

### Role-Based Access

| Role | Capabilities |
|------|-------------|
| **Founder** | Start webinar, Stop webinar, Rejoin as host, View analytics |
| **Stakeholder** | Join webinar (if registered), Rejoin as participant |

---

## API Endpoints

### 1. Start Webinar (Founder)

Starts a webinar session. Only the founder (creator) of the workshop can start it.

**Endpoint:** `POST /api/workshops/:workshopId/start`

**Authorization:** Founder only

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workshopId` | string | The workshop/webinar ID |

**Request Body:**
```json
{
  "sessionDate": "2024-01-15"  // Optional: For recurring workshops (YYYY-MM-DD format)
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Webinar started successfully",
  "data": {
    "workshopId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "meetStatus": "live",
    "agoraChannel": "meet_abc123xyz",
    "agoraToken": "006abc123xyz...",
    "agoraUid": 1000001,
    "agoraAppId": "your_agora_app_id",
    "participantId": "65a1b2c3d4e5f6g7h8i9j0k3",
    "joinCode": "ABC-123-XYZ",
    "joinLink": "https://app.roam.com/meet/join?code=ABC-123-XYZ",
    "isHost": true,
    "displayName": "John Doe",
    "startedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | Missing or invalid JWT token |
| 403 | `Only founder can start webinar` | User is not the founder of this org |
| 404 | `Workshop not found` | Workshop doesn't exist or inactive |
| 400 | `Meeting not generated` | Workshop doesn't have a linked meeting |
| 400 | `Webinar already live` | Webinar is already in progress |
| 400 | `Webinar has ended` | Cannot restart an ended webinar |

**Implementation:**

```typescript
// POST /api/workshops/:workshopId/start
router.post("/:workshopId/start", requireAuth, async (req, res) => {
  const { workshopId } = req.params;
  const { sessionDate } = req.body;
  const { userId, orgId } = req.user;

  // 1. Verify user is founder
  const isFounder = await isUserFounder(userId, orgId);
  if (!isFounder) {
    return res.status(403).json({
      success: false,
      error: "Only founder can start webinar"
    });
  }

  // 2. Get workshop and verify ownership
  const workshop = await Workshop.findOne({
    _id: workshopId,
    orgId,
    isActive: true
  });

  if (!workshop) {
    return res.status(404).json({
      success: false,
      error: "Workshop not found"
    });
  }

  // 3. Get or create the meeting
  let meet = await Meet.findById(workshop.meetingId);

  if (!meet) {
    // Generate meeting if not exists
    const joinCode = generateMeetJoinCode();
    meet = await Meet.create({
      orgId,
      hostEmail: req.user.email,
      hostName: req.user.name,
      title: workshop.title,
      description: workshop.description,
      startTime: combineDateTime(workshop.date, workshop.startTime),
      endTime: combineDateTime(workshop.date, workshop.endTime),
      joinCode,
      agoraChannel: generateMeetAgoraChannel(joinCode),
      status: 'scheduled',
      isHostVerified: true // Pre-verified since founder is starting
    });

    // Link meeting to workshop
    workshop.meetingId = meet._id.toString();
    workshop.meetingUrl = `${env.FRONTEND_URL}/meet/join?code=${joinCode}`;
    await workshop.save();
  }

  // 4. Check meeting status
  if (meet.status === 'live') {
    return res.status(400).json({
      success: false,
      error: "Webinar already live"
    });
  }

  if (meet.status === 'ended') {
    return res.status(400).json({
      success: false,
      error: "Webinar has ended"
    });
  }

  // 5. Start the meeting
  meet.status = 'live';
  meet.startedAt = new Date();
  meet.isHostVerified = true;
  meet.screenSharingByUid = undefined;
  await meet.save();

  // 6. Create/update host participant
  const agoraUid = generateGuestAgoraUid();

  let hostParticipant = await MeetParticipant.findOne({
    meetId: meet._id,
    email: req.user.email,
    isHost: true
  });

  if (hostParticipant) {
    hostParticipant.agoraUid = agoraUid;
    hostParticipant.joinedAt = new Date();
    hostParticipant.leftAt = undefined;
    await hostParticipant.save();
  } else {
    hostParticipant = await MeetParticipant.create({
      meetId: meet._id,
      email: req.user.email,
      displayName: req.user.name,
      isHost: true,
      agoraUid,
      joinedAt: new Date()
    });
  }

  // 7. Generate Agora token
  const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

  // 8. Emit socket event for real-time UI update
  emitWorkshopPreviewUpdate(orgId, 'workshop:preview:live', {
    workshopId: workshop._id.toString(),
    meetId: meet._id.toString(),
    title: workshop.title
  });

  // 9. Return response
  return res.json({
    success: true,
    message: "Webinar started successfully",
    data: {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      meetStatus: 'live',
      agoraChannel: meet.agoraChannel,
      agoraToken,
      agoraUid,
      agoraAppId: getAgoraAppId(),
      participantId: hostParticipant._id.toString(),
      joinCode: meet.joinCode,
      joinLink: `${env.FRONTEND_URL}/meet/join?code=${meet.joinCode}`,
      isHost: true,
      displayName: req.user.name,
      startedAt: meet.startedAt
    }
  });
});
```

---

### 2. Stop Webinar (Founder)

Ends a live webinar session. All participants are disconnected.

**Endpoint:** `POST /api/workshops/:workshopId/stop`

**Authorization:** Founder only

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workshopId` | string | The workshop/webinar ID |

**Request Body:**
```json
{
  "sessionDate": "2024-01-15"  // Optional: For recurring workshops
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Webinar ended successfully",
  "data": {
    "workshopId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "meetStatus": "ended",
    "endedAt": "2024-01-15T11:30:00.000Z",
    "duration": 90,
    "totalParticipants": 45
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | Missing or invalid JWT token |
| 403 | `Only founder can stop webinar` | User is not the founder |
| 404 | `Workshop not found` | Workshop doesn't exist |
| 400 | `No active meeting` | No linked meeting exists |
| 400 | `Webinar is not live` | Cannot stop a non-live webinar |

**Implementation:**

```typescript
// POST /api/workshops/:workshopId/stop
router.post("/:workshopId/stop", requireAuth, async (req, res) => {
  const { workshopId } = req.params;
  const { userId, orgId } = req.user;

  // 1. Verify user is founder
  const isFounder = await isUserFounder(userId, orgId);
  if (!isFounder) {
    return res.status(403).json({
      success: false,
      error: "Only founder can stop webinar"
    });
  }

  // 2. Get workshop
  const workshop = await Workshop.findOne({
    _id: workshopId,
    orgId,
    isActive: true
  });

  if (!workshop) {
    return res.status(404).json({
      success: false,
      error: "Workshop not found"
    });
  }

  // 3. Get meeting
  const meet = await Meet.findById(workshop.meetingId);

  if (!meet) {
    return res.status(400).json({
      success: false,
      error: "No active meeting"
    });
  }

  if (meet.status !== 'live') {
    return res.status(400).json({
      success: false,
      error: "Webinar is not live"
    });
  }

  // 4. End the meeting
  meet.status = 'ended';
  meet.endedAt = new Date();
  meet.screenSharingByUid = undefined;
  await meet.save();

  // 5. Mark all participants as left
  const participantResult = await MeetParticipant.updateMany(
    { meetId: meet._id, leftAt: null },
    { leftAt: new Date() }
  );

  // 6. Calculate duration
  const duration = meet.startedAt
    ? Math.round((meet.endedAt.getTime() - meet.startedAt.getTime()) / 60000)
    : 0;

  // 7. Get total participant count
  const totalParticipants = await MeetParticipant.countDocuments({
    meetId: meet._id
  });

  // 8. Emit socket event
  emitWorkshopPreviewUpdate(orgId, 'workshop:preview:ended', {
    workshopId: workshop._id.toString(),
    meetId: meet._id.toString(),
    title: workshop.title
  });

  // 9. Emit to all participants that meeting has ended
  getIO().to(`meet:${meet._id}`).emit('meet:ended', {
    meetId: meet._id.toString(),
    endedAt: meet.endedAt
  });

  return res.json({
    success: true,
    message: "Webinar ended successfully",
    data: {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      meetStatus: 'ended',
      endedAt: meet.endedAt,
      duration,
      totalParticipants
    }
  });
});
```

---

### 3. Rejoin Webinar (Founder)

Allows a founder to rejoin an active webinar they left (e.g., due to connection issues).

**Endpoint:** `POST /api/workshops/:workshopId/rejoin`

**Authorization:** Founder only

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workshopId` | string | The workshop/webinar ID |

**Request Body:**
```json
{
  "sessionDate": "2024-01-15"  // Optional: For recurring workshops
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Rejoined webinar as host",
  "data": {
    "workshopId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "meetStatus": "live",
    "agoraChannel": "meet_abc123xyz",
    "agoraToken": "006abc123xyz...",
    "agoraUid": 1000002,
    "agoraAppId": "your_agora_app_id",
    "participantId": "65a1b2c3d4e5f6g7h8i9j0k3",
    "isHost": true,
    "displayName": "John Doe",
    "rejoinedAt": "2024-01-15T10:30:00.000Z",
    "screenSharingByUid": null
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | Missing or invalid JWT token |
| 403 | `Only founder can rejoin as host` | User is not the founder |
| 404 | `Workshop not found` | Workshop doesn't exist |
| 400 | `No active meeting` | No linked meeting exists |
| 400 | `Webinar is not live` | Can only rejoin live webinars |

**Implementation:**

```typescript
// POST /api/workshops/:workshopId/rejoin
router.post("/:workshopId/rejoin", requireAuth, async (req, res) => {
  const { workshopId } = req.params;
  const { userId, orgId } = req.user;

  // 1. Verify user is founder
  const isFounder = await isUserFounder(userId, orgId);
  if (!isFounder) {
    return res.status(403).json({
      success: false,
      error: "Only founder can rejoin as host"
    });
  }

  // 2. Get workshop
  const workshop = await Workshop.findOne({
    _id: workshopId,
    orgId,
    isActive: true
  });

  if (!workshop) {
    return res.status(404).json({
      success: false,
      error: "Workshop not found"
    });
  }

  // 3. Get meeting
  const meet = await Meet.findById(workshop.meetingId);

  if (!meet) {
    return res.status(400).json({
      success: false,
      error: "No active meeting"
    });
  }

  if (meet.status !== 'live') {
    return res.status(400).json({
      success: false,
      error: "Webinar is not live"
    });
  }

  // 4. Generate new Agora UID for rejoin
  const agoraUid = generateGuestAgoraUid();

  // 5. Update or create host participant
  let hostParticipant = await MeetParticipant.findOne({
    meetId: meet._id,
    email: req.user.email,
    isHost: true
  });

  if (hostParticipant) {
    hostParticipant.agoraUid = agoraUid;
    hostParticipant.joinedAt = new Date();
    hostParticipant.leftAt = undefined;
    await hostParticipant.save();
  } else {
    hostParticipant = await MeetParticipant.create({
      meetId: meet._id,
      email: req.user.email,
      displayName: req.user.name,
      isHost: true,
      agoraUid,
      joinedAt: new Date()
    });
  }

  // 6. Generate Agora token
  const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

  return res.json({
    success: true,
    message: "Rejoined webinar as host",
    data: {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      meetStatus: meet.status,
      agoraChannel: meet.agoraChannel,
      agoraToken,
      agoraUid,
      agoraAppId: getAgoraAppId(),
      participantId: hostParticipant._id.toString(),
      isHost: true,
      displayName: req.user.name,
      rejoinedAt: hostParticipant.joinedAt,
      screenSharingByUid: meet.screenSharingByUid || null
    }
  });
});
```

---

### 4. Join Webinar (Stakeholder)

Allows a registered stakeholder to join a live webinar.

**Endpoint:** `POST /api/workshops/:workshopId/join`

**Authorization:** Stakeholder (must be registered for the workshop)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workshopId` | string | The workshop/webinar ID |

**Request Body:**
```json
{
  "sessionDate": "2024-01-15"  // Optional: For recurring workshops (YYYY-MM-DD format)
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Joined webinar successfully",
  "data": {
    "workshopId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "meetStatus": "live",
    "agoraChannel": "meet_abc123xyz",
    "agoraToken": "006abc123xyz...",
    "agoraUid": 1000005,
    "agoraAppId": "your_agora_app_id",
    "participantId": "65a1b2c3d4e5f6g7h8i9j0k5",
    "isHost": false,
    "displayName": "Jane Smith",
    "joinedAt": "2024-01-15T10:15:00.000Z",
    "screenSharingByUid": 1000001
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | Missing or invalid JWT token |
| 404 | `Workshop not found` | Workshop doesn't exist |
| 403 | `Not registered for this workshop` | User hasn't registered |
| 403 | `No access to this session` | For recurring: no access to this specific session |
| 400 | `No active meeting` | No linked meeting exists |
| 400 | `Webinar has not started` | Meeting isn't live yet |
| 400 | `Webinar has ended` | Meeting has already ended |

**Implementation:**

```typescript
// POST /api/workshops/:workshopId/join
router.post("/:workshopId/join", requireAuth, async (req, res) => {
  const { workshopId } = req.params;
  const { sessionDate } = req.body;
  const { userId, orgId } = req.user;

  // 1. Get workshop
  const workshop = await Workshop.findOne({
    _id: workshopId,
    orgId,
    isActive: true
  });

  if (!workshop) {
    return res.status(404).json({
      success: false,
      error: "Workshop not found"
    });
  }

  // 2. Check if user is registered
  let hasAccess = false;

  if (workshop.isRecurring && sessionDate) {
    // For recurring workshops, check session-specific access
    hasAccess = await hasSessionAccess(userId, workshopId, sessionDate);
  } else {
    // For non-recurring, check general registration
    const registration = await WorkshopRegistration.findOne({
      workshopId,
      userId,
      status: { $ne: 'cancelled' }
    });
    hasAccess = !!registration;
  }

  // Also allow founders to join (they don't need registration)
  const isFounder = await isUserFounder(userId, orgId);

  if (!hasAccess && !isFounder) {
    return res.status(403).json({
      success: false,
      error: workshop.isRecurring && sessionDate
        ? "No access to this session"
        : "Not registered for this workshop"
    });
  }

  // 3. Get meeting
  const meet = await Meet.findById(workshop.meetingId);

  if (!meet) {
    return res.status(400).json({
      success: false,
      error: "No active meeting"
    });
  }

  // 4. Check meeting status
  if (meet.status === 'scheduled') {
    return res.status(400).json({
      success: false,
      error: "Webinar has not started",
      data: {
        scheduledStart: meet.startTime,
        title: workshop.title
      }
    });
  }

  if (meet.status === 'ended') {
    return res.status(400).json({
      success: false,
      error: "Webinar has ended"
    });
  }

  // 5. Generate Agora UID
  const agoraUid = generateGuestAgoraUid();

  // 6. Create participant record
  const participant = await MeetParticipant.create({
    meetId: meet._id,
    email: req.user.email,
    displayName: req.user.name,
    isHost: false,
    agoraUid,
    joinedAt: new Date()
  });

  // 7. Update registration to attended (if exists)
  await WorkshopRegistration.findOneAndUpdate(
    { workshopId, userId, status: 'registered' },
    {
      status: 'attended',
      attendedAt: new Date()
    }
  );

  // 8. Generate Agora token
  const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

  return res.json({
    success: true,
    message: "Joined webinar successfully",
    data: {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      meetStatus: meet.status,
      agoraChannel: meet.agoraChannel,
      agoraToken,
      agoraUid,
      agoraAppId: getAgoraAppId(),
      participantId: participant._id.toString(),
      isHost: false,
      displayName: req.user.name,
      joinedAt: participant.joinedAt,
      screenSharingByUid: meet.screenSharingByUid || null
    }
  });
});
```

---

### 5. Rejoin Webinar (Stakeholder)

Allows a stakeholder to rejoin a webinar they left.

**Endpoint:** `POST /api/workshops/:workshopId/participant-rejoin`

**Authorization:** Stakeholder (must have previously joined)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `workshopId` | string | The workshop/webinar ID |

**Request Body:**
```json
{
  "sessionDate": "2024-01-15"  // Optional: For recurring workshops
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Rejoined webinar successfully",
  "data": {
    "workshopId": "65a1b2c3d4e5f6g7h8i9j0k1",
    "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
    "meetStatus": "live",
    "agoraChannel": "meet_abc123xyz",
    "agoraToken": "006abc123xyz...",
    "agoraUid": 1000006,
    "agoraAppId": "your_agora_app_id",
    "participantId": "65a1b2c3d4e5f6g7h8i9j0k5",
    "isHost": false,
    "displayName": "Jane Smith",
    "rejoinedAt": "2024-01-15T10:45:00.000Z",
    "screenSharingByUid": 1000001
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | Missing or invalid JWT token |
| 404 | `Workshop not found` | Workshop doesn't exist |
| 403 | `Not registered for this workshop` | User never joined |
| 400 | `No active meeting` | No linked meeting exists |
| 400 | `Webinar is not live` | Can only rejoin live webinars |

**Implementation:**

```typescript
// POST /api/workshops/:workshopId/participant-rejoin
router.post("/:workshopId/participant-rejoin", requireAuth, async (req, res) => {
  const { workshopId } = req.params;
  const { userId, orgId } = req.user;

  // 1. Get workshop
  const workshop = await Workshop.findOne({
    _id: workshopId,
    orgId,
    isActive: true
  });

  if (!workshop) {
    return res.status(404).json({
      success: false,
      error: "Workshop not found"
    });
  }

  // 2. Get meeting
  const meet = await Meet.findById(workshop.meetingId);

  if (!meet) {
    return res.status(400).json({
      success: false,
      error: "No active meeting"
    });
  }

  if (meet.status !== 'live') {
    return res.status(400).json({
      success: false,
      error: "Webinar is not live"
    });
  }

  // 3. Check registration
  const registration = await WorkshopRegistration.findOne({
    workshopId,
    userId,
    status: { $in: ['registered', 'attended'] }
  });

  if (!registration) {
    return res.status(403).json({
      success: false,
      error: "Not registered for this workshop"
    });
  }

  // 4. Generate new Agora UID
  const agoraUid = generateGuestAgoraUid();

  // 5. Find existing participant or create new one
  let participant = await MeetParticipant.findOne({
    meetId: meet._id,
    email: req.user.email,
    isHost: false
  });

  if (participant) {
    // Update existing participant record
    participant.agoraUid = agoraUid;
    participant.joinedAt = new Date();
    participant.leftAt = undefined;
    await participant.save();
  } else {
    // Create new participant record
    participant = await MeetParticipant.create({
      meetId: meet._id,
      email: req.user.email,
      displayName: req.user.name,
      isHost: false,
      agoraUid,
      joinedAt: new Date()
    });
  }

  // 6. Generate Agora token
  const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

  return res.json({
    success: true,
    message: "Rejoined webinar successfully",
    data: {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      meetStatus: meet.status,
      agoraChannel: meet.agoraChannel,
      agoraToken,
      agoraUid,
      agoraAppId: getAgoraAppId(),
      participantId: participant._id.toString(),
      isHost: false,
      displayName: req.user.name,
      rejoinedAt: participant.joinedAt,
      screenSharingByUid: meet.screenSharingByUid || null
    }
  });
});
```

---

## Socket.IO Events

The following Socket.IO events are emitted for real-time updates:

### Webinar Status Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `workshop:preview:live` | Server → Client | Webinar has started |
| `workshop:preview:ended` | Server → Client | Webinar has ended |
| `meet:ended` | Server → Client | Meeting forcefully ended (all participants) |

### Payload Examples

**`workshop:preview:live`**
```json
{
  "workshopId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
  "title": "Introduction to TypeScript"
}
```

**`meet:ended`**
```json
{
  "meetId": "65a1b2c3d4e5f6g7h8i9j0k2",
  "endedAt": "2024-01-15T11:30:00.000Z"
}
```

### Listening for Events (Frontend)

```typescript
import { useEffect } from 'react';
import { socket } from '@/lib/socket';

function useWebinarEvents(orgId: string) {
  useEffect(() => {
    // Join organization room
    socket.emit('join:org', { orgId });

    // Listen for webinar going live
    socket.on('workshop:preview:live', (data) => {
      console.log('Webinar started:', data.title);
      // Update UI to show "Join" button
    });

    // Listen for webinar ending
    socket.on('workshop:preview:ended', (data) => {
      console.log('Webinar ended:', data.title);
      // Update UI to show "Ended" status
    });

    // Listen for forced end (when already in meeting)
    socket.on('meet:ended', (data) => {
      console.log('Meeting ended by host');
      // Disconnect from Agora and show ended screen
    });

    return () => {
      socket.off('workshop:preview:live');
      socket.off('workshop:preview:ended');
      socket.off('meet:ended');
    };
  }, [orgId]);
}
```

---

## Implementation Guide

### Complete Route File

Create the file `src/routes/webinar.ts`:

```typescript
import { Router } from "express";
import { Types } from "mongoose";
import { Workshop } from "../models/workshop.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Meet } from "../models/meet.model";
import { MeetParticipant } from "../models/meetParticipant.model";
import { User } from "../models/user.model";
import { requireAuth } from "../middleware/auth";
import { generateMeetJoinCode, generateMeetAgoraChannel } from "../utils/meetCode";
import { generateAgoraToken, generateGuestAgoraUid, getAgoraAppId } from "../services/agora";
import { emitWorkshopPreviewUpdate, getIO } from "../services/socket";
import { env } from "../config/env";

const router = Router();

// Helper: Check if user is founder
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();

  if (!user) return false;

  // Check legacy single-org support
  if (user.organization?.toString() === orgId) {
    if (user.role === "founder" || user.role === "admin") {
      return true;
    }
  }

  // Check multi-org support
  if (user.organizations && Array.isArray(user.organizations)) {
    const membership = user.organizations.find(
      (m: any) => m.organization?.toString() === orgId
    );
    if (membership?.role === "founder") {
      return true;
    }
  }

  return false;
}

// Helper: Combine date and time
function combineDateTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

// 1. START WEBINAR (Founder)
router.post("/:workshopId/start", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { userId, orgId } = req.user;

    // Verify founder
    const founder = await isUserFounder(userId, orgId);
    if (!founder) {
      return res.status(403).json({
        success: false,
        error: "Only founder can start webinar"
      });
    }

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    // Get or create meeting
    let meet = workshop.meetingId
      ? await Meet.findById(workshop.meetingId)
      : null;

    if (!meet) {
      const joinCode = generateMeetJoinCode();
      meet = await Meet.create({
        orgId: new Types.ObjectId(orgId),
        hostEmail: req.user.email,
        hostName: req.user.name,
        title: workshop.title,
        description: workshop.description,
        startTime: combineDateTime(workshop.date, workshop.startTime),
        endTime: combineDateTime(workshop.date, workshop.endTime),
        joinCode,
        agoraChannel: generateMeetAgoraChannel(joinCode),
        status: 'scheduled',
        isHostVerified: true
      });

      workshop.meetingId = meet._id.toString();
      workshop.meetingUrl = `${env.FRONTEND_URL}/meet/join?code=${joinCode}`;
      await workshop.save();
    }

    // Check status
    if (meet.status === 'live') {
      return res.status(400).json({
        success: false,
        error: "Webinar already live"
      });
    }

    if (meet.status === 'ended') {
      return res.status(400).json({
        success: false,
        error: "Webinar has ended"
      });
    }

    // Start meeting
    meet.status = 'live';
    meet.startedAt = new Date();
    meet.isHostVerified = true;
    meet.screenSharingByUid = undefined;
    await meet.save();

    // Create/update host participant
    const agoraUid = generateGuestAgoraUid();

    let hostParticipant = await MeetParticipant.findOne({
      meetId: meet._id,
      email: req.user.email,
      isHost: true
    });

    if (hostParticipant) {
      hostParticipant.agoraUid = agoraUid;
      hostParticipant.joinedAt = new Date();
      hostParticipant.leftAt = undefined;
      await hostParticipant.save();
    } else {
      hostParticipant = await MeetParticipant.create({
        meetId: meet._id,
        email: req.user.email,
        displayName: req.user.name,
        isHost: true,
        agoraUid,
        joinedAt: new Date()
      });
    }

    // Generate Agora token
    const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

    // Emit socket event
    emitWorkshopPreviewUpdate(orgId, 'workshop:preview:live', {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      title: workshop.title
    });

    return res.json({
      success: true,
      message: "Webinar started successfully",
      data: {
        workshopId: workshop._id.toString(),
        meetId: meet._id.toString(),
        meetStatus: 'live',
        agoraChannel: meet.agoraChannel,
        agoraToken,
        agoraUid,
        agoraAppId: getAgoraAppId(),
        participantId: hostParticipant._id.toString(),
        joinCode: meet.joinCode,
        joinLink: `${env.FRONTEND_URL}/meet/join?code=${meet.joinCode}`,
        isHost: true,
        displayName: req.user.name,
        startedAt: meet.startedAt
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error starting webinar:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to start webinar"
    });
  }
});

// 2. STOP WEBINAR (Founder)
router.post("/:workshopId/stop", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { userId, orgId } = req.user;

    // Verify founder
    const founder = await isUserFounder(userId, orgId);
    if (!founder) {
      return res.status(403).json({
        success: false,
        error: "Only founder can stop webinar"
      });
    }

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    // Get meeting
    const meet = await Meet.findById(workshop.meetingId);

    if (!meet) {
      return res.status(400).json({
        success: false,
        error: "No active meeting"
      });
    }

    if (meet.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: "Webinar is not live"
      });
    }

    // End meeting
    meet.status = 'ended';
    meet.endedAt = new Date();
    meet.screenSharingByUid = undefined;
    await meet.save();

    // Mark all participants as left
    await MeetParticipant.updateMany(
      { meetId: meet._id, leftAt: null },
      { leftAt: new Date() }
    );

    // Calculate stats
    const duration = meet.startedAt
      ? Math.round((meet.endedAt.getTime() - meet.startedAt.getTime()) / 60000)
      : 0;

    const totalParticipants = await MeetParticipant.countDocuments({
      meetId: meet._id
    });

    // Emit socket events
    emitWorkshopPreviewUpdate(orgId, 'workshop:preview:ended', {
      workshopId: workshop._id.toString(),
      meetId: meet._id.toString(),
      title: workshop.title
    });

    getIO().to(`meet:${meet._id}`).emit('meet:ended', {
      meetId: meet._id.toString(),
      endedAt: meet.endedAt
    });

    return res.json({
      success: true,
      message: "Webinar ended successfully",
      data: {
        workshopId: workshop._id.toString(),
        meetId: meet._id.toString(),
        meetStatus: 'ended',
        endedAt: meet.endedAt,
        duration,
        totalParticipants
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error stopping webinar:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to stop webinar"
    });
  }
});

// 3. REJOIN WEBINAR (Founder)
router.post("/:workshopId/rejoin", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { userId, orgId } = req.user;

    // Verify founder
    const founder = await isUserFounder(userId, orgId);
    if (!founder) {
      return res.status(403).json({
        success: false,
        error: "Only founder can rejoin as host"
      });
    }

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    // Get meeting
    const meet = await Meet.findById(workshop.meetingId);

    if (!meet) {
      return res.status(400).json({
        success: false,
        error: "No active meeting"
      });
    }

    if (meet.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: "Webinar is not live"
      });
    }

    // Generate new Agora UID
    const agoraUid = generateGuestAgoraUid();

    // Update/create host participant
    let hostParticipant = await MeetParticipant.findOne({
      meetId: meet._id,
      email: req.user.email,
      isHost: true
    });

    if (hostParticipant) {
      hostParticipant.agoraUid = agoraUid;
      hostParticipant.joinedAt = new Date();
      hostParticipant.leftAt = undefined;
      await hostParticipant.save();
    } else {
      hostParticipant = await MeetParticipant.create({
        meetId: meet._id,
        email: req.user.email,
        displayName: req.user.name,
        isHost: true,
        agoraUid,
        joinedAt: new Date()
      });
    }

    // Generate Agora token
    const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

    return res.json({
      success: true,
      message: "Rejoined webinar as host",
      data: {
        workshopId: workshop._id.toString(),
        meetId: meet._id.toString(),
        meetStatus: meet.status,
        agoraChannel: meet.agoraChannel,
        agoraToken,
        agoraUid,
        agoraAppId: getAgoraAppId(),
        participantId: hostParticipant._id.toString(),
        isHost: true,
        displayName: req.user.name,
        rejoinedAt: hostParticipant.joinedAt,
        screenSharingByUid: meet.screenSharingByUid || null
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error rejoining webinar:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to rejoin webinar"
    });
  }
});

// 4. JOIN WEBINAR (Stakeholder)
router.post("/:workshopId/join", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { sessionDate } = req.body;
    const { userId, orgId } = req.user;

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    // Check access
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      const registration = await WorkshopRegistration.findOne({
        workshopId,
        userId,
        status: { $ne: 'cancelled' }
      });

      if (!registration) {
        return res.status(403).json({
          success: false,
          error: "Not registered for this workshop"
        });
      }
    }

    // Get meeting
    const meet = await Meet.findById(workshop.meetingId);

    if (!meet) {
      return res.status(400).json({
        success: false,
        error: "No active meeting"
      });
    }

    if (meet.status === 'scheduled') {
      return res.status(400).json({
        success: false,
        error: "Webinar has not started",
        data: {
          scheduledStart: meet.startTime,
          title: workshop.title
        }
      });
    }

    if (meet.status === 'ended') {
      return res.status(400).json({
        success: false,
        error: "Webinar has ended"
      });
    }

    // Generate Agora UID
    const agoraUid = generateGuestAgoraUid();

    // Create participant
    const participant = await MeetParticipant.create({
      meetId: meet._id,
      email: req.user.email,
      displayName: req.user.name,
      isHost: false,
      agoraUid,
      joinedAt: new Date()
    });

    // Update registration status
    await WorkshopRegistration.findOneAndUpdate(
      { workshopId, userId, status: 'registered' },
      { status: 'attended', attendedAt: new Date() }
    );

    // Generate Agora token
    const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

    return res.json({
      success: true,
      message: "Joined webinar successfully",
      data: {
        workshopId: workshop._id.toString(),
        meetId: meet._id.toString(),
        meetStatus: meet.status,
        agoraChannel: meet.agoraChannel,
        agoraToken,
        agoraUid,
        agoraAppId: getAgoraAppId(),
        participantId: participant._id.toString(),
        isHost: false,
        displayName: req.user.name,
        joinedAt: participant.joinedAt,
        screenSharingByUid: meet.screenSharingByUid || null
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error joining webinar:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to join webinar"
    });
  }
});

// 5. REJOIN WEBINAR (Stakeholder)
router.post("/:workshopId/participant-rejoin", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { userId, orgId } = req.user;

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    // Get meeting
    const meet = await Meet.findById(workshop.meetingId);

    if (!meet) {
      return res.status(400).json({
        success: false,
        error: "No active meeting"
      });
    }

    if (meet.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: "Webinar is not live"
      });
    }

    // Check registration
    const registration = await WorkshopRegistration.findOne({
      workshopId,
      userId,
      status: { $in: ['registered', 'attended'] }
    });

    if (!registration) {
      return res.status(403).json({
        success: false,
        error: "Not registered for this workshop"
      });
    }

    // Generate new Agora UID
    const agoraUid = generateGuestAgoraUid();

    // Update/create participant
    let participant = await MeetParticipant.findOne({
      meetId: meet._id,
      email: req.user.email,
      isHost: false
    });

    if (participant) {
      participant.agoraUid = agoraUid;
      participant.joinedAt = new Date();
      participant.leftAt = undefined;
      await participant.save();
    } else {
      participant = await MeetParticipant.create({
        meetId: meet._id,
        email: req.user.email,
        displayName: req.user.name,
        isHost: false,
        agoraUid,
        joinedAt: new Date()
      });
    }

    // Generate Agora token
    const agoraToken = generateAgoraToken(meet.agoraChannel, agoraUid);

    return res.json({
      success: true,
      message: "Rejoined webinar successfully",
      data: {
        workshopId: workshop._id.toString(),
        meetId: meet._id.toString(),
        meetStatus: meet.status,
        agoraChannel: meet.agoraChannel,
        agoraToken,
        agoraUid,
        agoraAppId: getAgoraAppId(),
        participantId: participant._id.toString(),
        isHost: false,
        displayName: req.user.name,
        rejoinedAt: participant.joinedAt,
        screenSharingByUid: meet.screenSharingByUid || null
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error rejoining webinar:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to rejoin webinar"
    });
  }
});

// 6. LEAVE WEBINAR (Both Founder and Stakeholder)
router.post("/:workshopId/leave", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { participantId } = req.body;
    const { orgId } = req.user;

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    // Mark participant as left
    const participant = await MeetParticipant.findByIdAndUpdate(
      participantId,
      { leftAt: new Date() },
      { new: true }
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        error: "Participant not found"
      });
    }

    return res.json({
      success: true,
      message: "Left webinar successfully",
      data: {
        participantId: participant._id.toString(),
        leftAt: participant.leftAt
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error leaving webinar:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to leave webinar"
    });
  }
});

// 7. GET WEBINAR STATUS
router.get("/:workshopId/status", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { orgId } = req.user;

    const workshop = await Workshop.findOne({
      _id: workshopId,
      orgId,
      isActive: true
    }).lean();

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found"
      });
    }

    const meet = workshop.meetingId
      ? await Meet.findById(workshop.meetingId).lean()
      : null;

    const participantCount = meet
      ? await MeetParticipant.countDocuments({ meetId: meet._id, leftAt: null })
      : 0;

    return res.json({
      success: true,
      data: {
        workshopId: workshop._id.toString(),
        title: workshop.title,
        meetId: meet?._id.toString() || null,
        meetStatus: meet?.status || 'no_meeting',
        isLive: meet?.status === 'live',
        startedAt: meet?.startedAt || null,
        endedAt: meet?.endedAt || null,
        participantCount,
        joinCode: meet?.joinCode || null,
        joinLink: meet?.joinCode
          ? `${env.FRONTEND_URL}/meet/join?code=${meet.joinCode}`
          : null
      }
    });
  } catch (error: any) {
    console.error("[Webinar API] Error getting status:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get webinar status"
    });
  }
});

export default router;
```

### Mount the Routes

Add to `src/app.ts`:

```typescript
import webinarRoutes from "./routes/webinar";

// ... existing routes ...

app.use("/api/workshops", webinarRoutes);
```

---

## Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `WEBINAR_ALREADY_LIVE` | Webinar is already in progress |
| 400 | `WEBINAR_ENDED` | Webinar has already ended |
| 400 | `WEBINAR_NOT_STARTED` | Webinar hasn't started yet |
| 400 | `NO_ACTIVE_MEETING` | No meeting linked to workshop |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FOUNDER_ONLY` | Action requires founder role |
| 403 | `NOT_REGISTERED` | User not registered for workshop |
| 404 | `WORKSHOP_NOT_FOUND` | Workshop doesn't exist |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Frontend Integration Example

```typescript
// services/webinarService.ts
import { api } from '@/lib/api';

interface WebinarJoinResponse {
  success: boolean;
  data: {
    workshopId: string;
    meetId: string;
    meetStatus: string;
    agoraChannel: string;
    agoraToken: string;
    agoraUid: number;
    agoraAppId: string;
    participantId: string;
    isHost: boolean;
    displayName: string;
    joinedAt?: string;
    startedAt?: string;
    screenSharingByUid: number | null;
  };
}

export const webinarService = {
  // Founder APIs
  startWebinar: (workshopId: string) =>
    api.post<WebinarJoinResponse>(`/api/workshops/${workshopId}/start`),

  stopWebinar: (workshopId: string) =>
    api.post(`/api/workshops/${workshopId}/stop`),

  rejoinAsHost: (workshopId: string) =>
    api.post<WebinarJoinResponse>(`/api/workshops/${workshopId}/rejoin`),

  // Stakeholder APIs
  joinWebinar: (workshopId: string, sessionDate?: string) =>
    api.post<WebinarJoinResponse>(`/api/workshops/${workshopId}/join`, { sessionDate }),

  rejoinWebinar: (workshopId: string) =>
    api.post<WebinarJoinResponse>(`/api/workshops/${workshopId}/participant-rejoin`),

  // Common APIs
  leaveWebinar: (workshopId: string, participantId: string) =>
    api.post(`/api/workshops/${workshopId}/leave`, { participantId }),

  getStatus: (workshopId: string) =>
    api.get(`/api/workshops/${workshopId}/status`),
};
```

---

## Summary

| Action | Endpoint | Role | Description |
|--------|----------|------|-------------|
| Start Webinar | `POST /api/workshops/:id/start` | Founder | Start webinar, get Agora credentials |
| Stop Webinar | `POST /api/workshops/:id/stop` | Founder | End webinar, disconnect all |
| Rejoin (Host) | `POST /api/workshops/:id/rejoin` | Founder | Rejoin as host after disconnect |
| Join Webinar | `POST /api/workshops/:id/join` | Stakeholder | Join live webinar |
| Rejoin (Participant) | `POST /api/workshops/:id/participant-rejoin` | Stakeholder | Rejoin after disconnect |
| Leave Webinar | `POST /api/workshops/:id/leave` | Both | Leave webinar gracefully |
| Get Status | `GET /api/workshops/:id/status` | Both | Check webinar status |
