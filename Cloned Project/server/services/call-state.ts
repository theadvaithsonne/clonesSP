import { getRedisClient, isRedisAvailable } from "./redis-presence";

interface CallParticipant {
  socketId: string;
  visitorId: string; // For web browser tab identification (future enhancement)
  answeredAt: number;
  deviceType: "web" | "mobile" | "unknown";
}

// In-memory fallback for single-server deployments
const inMemoryCallState = new Map<string, Map<string, CallParticipant>>();
const inMemoryUserCalls = new Map<string, string>(); // userId -> channelName

export class CallStateService {
  private readonly CALL_KEY_PREFIX = "call:active:";
  private readonly USER_CALL_KEY_PREFIX = "call:user:";
  private readonly CALL_TTL = 7200; // 2 hours max call duration

  /**
   * Try to join a call. Returns whether this device is allowed to join.
   * Uses Redis HSETNX for atomic check-and-set to handle race conditions.
   */
  async tryJoinCall(
    channelName: string,
    userId: string,
    socketId: string,
    deviceType: "web" | "mobile" | "unknown" = "unknown"
  ): Promise<{
    allowed: boolean;
    existingSocketId?: string;
    existingDevice?: string;
  }> {
    const participant: CallParticipant = {
      socketId,
      visitorId: "",
      answeredAt: Date.now(),
      deviceType,
    };

    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      const callKey = `${this.CALL_KEY_PREFIX}${channelName}`;
      const userCallKey = `${this.USER_CALL_KEY_PREFIX}${userId}`;

      // Atomic: only set if user NOT already in this call
      const wasSet = await redis.hsetnx(
        callKey,
        userId,
        JSON.stringify(participant)
      );

      if (wasSet === 1) {
        // This device wins - set TTLs
        await redis.expire(callKey, this.CALL_TTL);
        await redis.set(userCallKey, channelName, "EX", this.CALL_TTL);
        console.log(
          `[CALL-STATE] User ${userId} joined call ${channelName} on ${deviceType}`
        );
        return { allowed: true };
      } else {
        // Another device already joined - get their info
        const existing = await redis.hget(callKey, userId);
        if (existing) {
          const data = JSON.parse(existing) as CallParticipant;
          console.log(
            `[CALL-STATE] User ${userId} blocked from ${channelName} - already on ${data.deviceType}`
          );
          return {
            allowed: false,
            existingSocketId: data.socketId,
            existingDevice: data.deviceType,
          };
        }
        return { allowed: false };
      }
    } else {
      // In-memory fallback
      if (!inMemoryCallState.has(channelName)) {
        inMemoryCallState.set(channelName, new Map());
      }
      const channelParticipants = inMemoryCallState.get(channelName)!;

      if (!channelParticipants.has(userId)) {
        channelParticipants.set(userId, participant);
        inMemoryUserCalls.set(userId, channelName);
        console.log(
          `[CALL-STATE] (in-memory) User ${userId} joined call ${channelName} on ${deviceType}`
        );
        return { allowed: true };
      } else {
        const existing = channelParticipants.get(userId)!;
        console.log(
          `[CALL-STATE] (in-memory) User ${userId} blocked from ${channelName} - already on ${existing.deviceType}`
        );
        return {
          allowed: false,
          existingSocketId: existing.socketId,
          existingDevice: existing.deviceType,
        };
      }
    }
  }

  /**
   * Check if user is in a specific call
   */
  async isUserInCall(channelName: string, userId: string): Promise<boolean> {
    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      return (
        (await redis.hexists(
          `${this.CALL_KEY_PREFIX}${channelName}`,
          userId
        )) === 1
      );
    }
    return inMemoryCallState.get(channelName)?.has(userId) ?? false;
  }

  /**
   * Get user's current call channel (if any)
   */
  async getUserCurrentCall(userId: string): Promise<string | null> {
    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      return await redis.get(`${this.USER_CALL_KEY_PREFIX}${userId}`);
    }
    return inMemoryUserCalls.get(userId) ?? null;
  }

  /**
   * Remove user from call (on leave or disconnect)
   */
  async leaveCall(channelName: string, userId: string): Promise<void> {
    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      await redis.hdel(`${this.CALL_KEY_PREFIX}${channelName}`, userId);
      await redis.del(`${this.USER_CALL_KEY_PREFIX}${userId}`);
      console.log(`[CALL-STATE] User ${userId} left call ${channelName}`);
    } else {
      inMemoryCallState.get(channelName)?.delete(userId);
      inMemoryUserCalls.delete(userId);
      if (inMemoryCallState.get(channelName)?.size === 0) {
        inMemoryCallState.delete(channelName);
      }
      console.log(
        `[CALL-STATE] (in-memory) User ${userId} left call ${channelName}`
      );
    }
  }

  /**
   * Get call participant info
   */
  async getCallParticipant(
    channelName: string,
    userId: string
  ): Promise<CallParticipant | null> {
    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      const data = await redis.hget(
        `${this.CALL_KEY_PREFIX}${channelName}`,
        userId
      );
      return data ? JSON.parse(data) : null;
    }
    return inMemoryCallState.get(channelName)?.get(userId) ?? null;
  }

  /**
   * Update socket ID for reconnection scenario
   */
  async updateSocketId(
    channelName: string,
    userId: string,
    newSocketId: string
  ): Promise<void> {
    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      const existing = await redis.hget(
        `${this.CALL_KEY_PREFIX}${channelName}`,
        userId
      );
      if (existing) {
        const data = JSON.parse(existing) as CallParticipant;
        data.socketId = newSocketId;
        await redis.hset(
          `${this.CALL_KEY_PREFIX}${channelName}`,
          userId,
          JSON.stringify(data)
        );
        console.log(
          `[CALL-STATE] Updated socket for ${userId} in ${channelName}`
        );
      }
    } else {
      const channelParticipants = inMemoryCallState.get(channelName);
      if (channelParticipants?.has(userId)) {
        const data = channelParticipants.get(userId)!;
        data.socketId = newSocketId;
        console.log(
          `[CALL-STATE] (in-memory) Updated socket for ${userId} in ${channelName}`
        );
      }
    }
  }

  /**
   * Force-join a call by clearing stale state for the same user first.
   * Used when a user reconnects (page reload) and the old socket is dead.
   */
  async forceRejoin(
    channelName: string,
    userId: string,
    newSocketId: string,
    deviceType: "web" | "mobile" | "unknown" = "unknown"
  ): Promise<void> {
    await this.leaveCall(channelName, userId);
    const result = await this.tryJoinCall(channelName, userId, newSocketId, deviceType);
    if (!result.allowed) {
      console.error(`[CALL-STATE] forceRejoin still blocked for ${userId} in ${channelName}`);
    }
  }

  /**
   * Get all participants in a call
   */
  async getCallParticipants(
    channelName: string
  ): Promise<Map<string, CallParticipant>> {
    if (isRedisAvailable()) {
      const redis = getRedisClient()!;
      const data = await redis.hgetall(
        `${this.CALL_KEY_PREFIX}${channelName}`
      );
      const result = new Map<string, CallParticipant>();
      for (const [key, value] of Object.entries(data)) {
        result.set(key, JSON.parse(value));
      }
      return result;
    }
    return inMemoryCallState.get(channelName) ?? new Map();
  }
}

export const callStateService = new CallStateService();
