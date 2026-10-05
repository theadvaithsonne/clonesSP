const DAILY_API_BASE = "https://api.daily.co/v1";
const DAILY_API_KEY = process.env.DAILY_API_KEY || "";

/** Sanitize a spaceId/channel into a valid Daily.co room name (only A-Z, a-z, 0-9, '-', '_') */
export function toDailyRoomName(spaceId: string): string {
  return spaceId.replace(/[^A-Za-z0-9\-_]/g, "-");
}

// Guest UID range: 2,000,000 - 2,999,999 (kept for backward compatibility with existing DB records)
const GUEST_UID_MIN = 2000000;
const GUEST_UID_MAX = 2999999;
const usedGuestUids = new Set<number>();

/**
 * Generate a unique numeric UID for guest users.
 * Kept for backward compatibility with existing database models that store agoraUid.
 * Daily.co itself uses string user_id in tokens, but existing models reference this field.
 */
export function generateGuestUid(): number {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const uid = Math.floor(Math.random() * (GUEST_UID_MAX - GUEST_UID_MIN + 1)) + GUEST_UID_MIN;
    if (!usedGuestUids.has(uid)) {
      usedGuestUids.add(uid);
      setTimeout(() => { usedGuestUids.delete(uid); }, 24 * 60 * 60 * 1000);
      return uid;
    }
    attempts++;
  }

  const timestamp = Date.now() % 999999;
  return GUEST_UID_MIN + timestamp;
}

interface CreateRoomOptions {
  exp?: number;
  max_participants?: number;
  enable_chat?: boolean;       // Default: true
  enable_recording?: string;   // Default: "cloud". Set to "false" or omit to disable.
}

interface CreateRoomResponse {
  url: string;
  name: string;
}

interface CreateMeetingTokenOptions {
  userId: string;
  userName?: string;
  isOwner?: boolean;
  exp?: number;
  enableScreenshare?: boolean; // Whether this user can screen share. Default: true.
  // Note: enable_recording and enable_chat are ROOM-level properties only.
  // They are NOT valid on meeting tokens. Control via room settings + frontend logic.
  // Frontend enforces who can start/stop via recordingStartedByMe logic.
}

/**
 * Delete a Daily.co room by name.
 * Returns true if deleted successfully or room didn't exist.
 */
export async function deleteRoom(name: string): Promise<boolean> {
  if (!DAILY_API_KEY) {
    console.error("[DAILY] DAILY_API_KEY is missing");
    return false;
  }

  try {
    const response = await fetch(`${DAILY_API_BASE}/rooms/${name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (response.ok || response.status === 404) {
      console.log(`[DAILY] Deleted room: ${name}`);
      return true;
    }

    const errorText = await response.text();
    console.error(`[DAILY] Failed to delete room ${name}: ${response.status} ${errorText}`);
    return false;
  } catch (error) {
    console.error("[DAILY] Error deleting room:", error);
    return false;
  }
}

/**
 * Fetch an existing Daily.co room by name.
 */
async function fetchExistingRoom(name: string): Promise<CreateRoomResponse> {
  try {
    const response = await fetch(`${DAILY_API_BASE}/rooms/${name}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`[DAILY] Fetched existing room: ${data.name} (${data.url})`);
      return { url: data.url, name: data.name };
    }
  } catch (error) {
    console.error(`[DAILY] Error fetching existing room ${name}:`, error);
  }
  return { url: "", name: "" };
}

export async function createRoom(
  name: string,
  options?: CreateRoomOptions
): Promise<CreateRoomResponse> {
  if (!DAILY_API_KEY) {
    console.error("[DAILY] DAILY_API_KEY is missing");
    return { url: "", name: "" };
  }

  try {
    const properties: Record<string, any> = {
      enable_screenshare: true,
      enable_chat: options?.enable_chat !== false, // default true
      enable_recording: options?.enable_recording ?? "cloud",
    };
    if (options?.exp) properties.exp = options.exp;
    if (options?.max_participants)
      properties.max_participants = options.max_participants;

    const response = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({ name, properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Room already exists — update its properties (safe, no race condition)
      if (
        response.status === 409 ||
        (response.status === 400 && errorText.includes("already exists"))
      ) {
        console.log(`[DAILY] Room ${name} already exists, updating properties`);
        const patchResponse = await fetch(`${DAILY_API_BASE}/rooms/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DAILY_API_KEY}`,
          },
          body: JSON.stringify({ properties }),
        });
        if (patchResponse.ok) {
          const patchData = await patchResponse.json();
          console.log(`[DAILY] Updated existing room: ${patchData.name} (${patchData.url})`);
          return { url: patchData.url, name: patchData.name };
        }
        // If update fails, just fetch the existing room
        console.warn(`[DAILY] Failed to update room properties, fetching existing`);
        return await fetchExistingRoom(name);
      }

      console.error(`[DAILY] Failed to create room: ${response.status} ${errorText}`);
      return { url: "", name: "" };
    }

    const data = await response.json();
    console.log(`[DAILY] Created room: ${data.name} (${data.url})`);
    return { url: data.url, name: data.name };
  } catch (error) {
    console.error("[DAILY] Error creating room:", error);
    return { url: "", name: "" };
  }
}

// --- Recording tracking ---
// Maps Daily room names to recording context (org, user, meeting title)
// Populated when users join calls, used by webhook to know where to upload
const recordingContextMap = new Map<string, {
  organizationId: string;
  userId: string;
  meetingTitle: string;
  spaceId: string;
}>();

export function setRecordingContext(roomName: string, context: {
  organizationId: string;
  userId: string;
  meetingTitle: string;
  spaceId: string;
}) {
  recordingContextMap.set(roomName, context);
  // Auto-expire after 4 hours
  setTimeout(() => recordingContextMap.delete(roomName), 4 * 60 * 60 * 1000);
}

export function getRecordingContext(roomName: string) {
  return recordingContextMap.get(roomName) || null;
}

/**
 * Get a temporary download link for a Daily.co cloud recording.
 */
export async function getRecordingDownloadLink(recordingId: string): Promise<string | null> {
  if (!DAILY_API_KEY) return null;

  try {
    const response = await fetch(`${DAILY_API_BASE}/recordings/${recordingId}/access-link`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (!response.ok) {
      console.error(`[DAILY] Failed to get recording download link: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.download_link || null;
  } catch (error) {
    console.error("[DAILY] Error getting recording download link:", error);
    return null;
  }
}

/**
 * List recordings for a room.
 */
export async function listRecordings(roomName?: string): Promise<any[]> {
  if (!DAILY_API_KEY) return [];

  try {
    const url = roomName
      ? `${DAILY_API_BASE}/recordings?room_name=${roomName}`
      : `${DAILY_API_BASE}/recordings?limit=50`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("[DAILY] Error listing recordings:", error);
    return [];
  }
}

export async function createMeetingToken(
  roomName: string,
  options: CreateMeetingTokenOptions
): Promise<string> {
  if (!DAILY_API_KEY) {
    console.error("[DAILY] DAILY_API_KEY is missing");
    return "";
  }

  try {
    const properties: Record<string, any> = {
      room_name: roomName,
      user_id: options.userId,
      enable_screenshare: options.enableScreenshare !== false, // default true
    };
    // Note: enable_recording and enable_chat are ROOM-level properties, not valid on tokens.
    // Recording/chat access is controlled by room settings + frontend logic.
    if (options.userName) properties.user_name = options.userName;
    if (options.isOwner !== undefined) properties.is_owner = options.isOwner;
    if (options.exp) properties.exp = options.exp;

    const response = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DAILY] Failed to create meeting token: ${response.status} ${errorText}`);
      return "";
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error("[DAILY] Error creating meeting token:", error);
    return "";
  }
}
