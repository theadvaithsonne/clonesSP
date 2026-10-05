import Redis from "ioredis";

interface WorkspaceUser {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
  spaceId: string;
  // "mobile" = logged in with a registered push/VoIP token but no live socket.
  // Reachable via the WhatsApp-style knock push. Not stored in the live Redis
  // presence set — synthesized on demand from active tokens (see socket.ts).
  status?: "available" | "busy" | "afk" | "mobile";
  isScreenSharing?: boolean;
  isRecording?: boolean;
  guest?: boolean;
}

// Create Redis clients for data operations and pub/sub
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

// Initialize Redis clients
export function initRedisClients() {
  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisPub = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisSub = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on("error", (err) => {
      console.error("[REDIS] Client error:", err);
    });

    redisClient.on("connect", () => {
      console.log("[REDIS] Client connected successfully");
    });

    redisPub.on("error", (err) => {
      console.error("[REDIS] Pub client error:", err);
    });

    redisSub.on("error", (err) => {
      console.error("[REDIS] Sub client error:", err);
    });

    // Handle subscriber reconnection
    redisSub.on("reconnecting", () => {
      console.log("[REDIS] Sub client reconnecting...");
    });

    redisSub.on("ready", () => {
      console.log("[REDIS] Sub client ready, ensuring workspace:presence subscription");
      // Re-subscribe after reconnection
      if (redisSub) {
        redisSub.subscribe("workspace:presence", (err) => {
          if (err) {
            console.error("[REDIS] Failed to re-subscribe to workspace:presence:", err);
          } else {
            console.log("[REDIS] Successfully re-subscribed to workspace:presence channel");
          }
        });
      }
    });

    console.log("[REDIS] Clients initialized");
  } catch (error) {
    console.error("[REDIS] Failed to initialize clients:", error);
    // Fallback to in-memory mode if Redis is not available
    console.warn("[REDIS] Running in fallback mode (in-memory only)");
  }
}

// Get Redis clients
export function getRedisClient(): Redis | null {
  return redisClient;
}

export function getRedisPub(): Redis | null {
  return redisPub;
}

export function getRedisSub(): Redis | null {
  return redisSub;
}

// Check if Redis is available
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === "ready";
}

export class WorkspacePresenceService {
  private readonly TTL = 600; // 10 minutes
  private readonly PRESENCE_KEY_PREFIX = "workspace:user:";
  private readonly ONLINE_SET_KEY = "workspace:online";
  private readonly CHANNEL = "workspace:presence";

  // Add user to workspace
  async addUser(userId: string, userData: WorkspaceUser): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;

      // Store user data as hash
      await redisClient!.hmset(key, {
        id: userData.id,
        name: userData.name || "",
        email: userData.email,
        profilePicture: userData.profilePicture || "",
        spaceId: userData.spaceId,
        status: userData.status || "available",
        isScreenSharing: userData.isScreenSharing ? "true" : "false",
        isRecording: userData.isRecording ? "true" : "false",
        guest: userData.guest ? "true" : "false",
      });

      // Set TTL
      await redisClient!.expire(key, this.TTL);

      // Add to online users set
      await redisClient!.sadd(this.ONLINE_SET_KEY, userId);

      // Publish event
      await redisPub!.publish(
        this.CHANNEL,
        JSON.stringify({
          type: "user-joined",
          user: userData,
        })
      );
    } catch (error) {
      console.error("[REDIS] Error adding user:", error);
    }
  }

  // Get all online users
  async getAllUsers(): Promise<WorkspaceUser[]> {
    if (!isRedisAvailable()) return [];

    try {
      const userIds = await redisClient!.smembers(this.ONLINE_SET_KEY);

      if (userIds.length === 0) return [];

      // Use pipeline for batch fetching
      const pipeline = redisClient!.pipeline();
      userIds.forEach((id) => pipeline.hgetall(`${this.PRESENCE_KEY_PREFIX}${id}`));

      const results = await pipeline.exec();

      const users: WorkspaceUser[] = [];

      results?.forEach((r) => {
        if (r && r[1]) {
          const data = r[1] as any;
          if (data.id && data.email) {
            users.push({
              id: data.id,
              name: data.name || undefined,
              email: data.email,
              profilePicture: data.profilePicture || undefined,
              spaceId: data.spaceId,
              status: data.status as "available" | "busy" | "afk",
              isScreenSharing: data.isScreenSharing === "true",
              isRecording: data.isRecording === "true",
              guest: data.guest === "true",
            });
          }
        }
      });

      return users;
    } catch (error) {
      console.error("[REDIS] Error getting all users:", error);
      return [];
    }
  }

  // Get specific user
  async getUser(userId: string): Promise<WorkspaceUser | null> {
    if (!isRedisAvailable()) return null;

    try {
      const data = await redisClient!.hgetall(`${this.PRESENCE_KEY_PREFIX}${userId}`);

      if (!data || !data.id) return null;

      return {
        id: data.id,
        name: data.name || undefined,
        email: data.email,
        profilePicture: data.profilePicture || undefined,
        spaceId: data.spaceId,
        status: data.status as "available" | "busy" | "afk",
        isScreenSharing: data.isScreenSharing === "true",
        isRecording: data.isRecording === "true",
        guest: data.guest === "true",
      };
    } catch (error) {
      console.error("[REDIS] Error getting user:", error);
      return null;
    }
  }

  // Update user status. 'mobile' is a server-side transition used when the
  // socket disconnects but the user still has an active VoIP/push token —
  // we keep them in Redis with status='mobile' instead of removing.
  async updateUserStatus(userId: string, status: "available" | "busy" | "afk" | "mobile"): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      await redisClient!.hset(key, "status", status);
      await redisClient!.expire(key, this.TTL);

      await redisPub!.publish(
        this.CHANNEL,
        JSON.stringify({
          type: "user-status-changed",
          userId,
          status,
        })
      );
    } catch (error) {
      console.error("[REDIS] Error updating user status:", error);
    }
  }

  // Update user space
  async updateUserSpace(userId: string, spaceId: string): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      await redisClient!.hset(key, "spaceId", spaceId);
      await redisClient!.expire(key, this.TTL);

      await redisPub!.publish(
        this.CHANNEL,
        JSON.stringify({
          type: "user-moved-space",
          userId,
          spaceId,
        })
      );
    } catch (error) {
      console.error("[REDIS] Error updating user space:", error);
    }
  }

  // Update screen sharing state
  async updateScreenShare(userId: string, isSharing: boolean): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      await redisClient!.hset(key, "isScreenSharing", isSharing ? "true" : "false");
      await redisClient!.expire(key, this.TTL);

      await redisPub!.publish(
        this.CHANNEL,
        JSON.stringify({
          type: "screen-share-state",
          userId,
          isSharing,
        })
      );
    } catch (error) {
      console.error("[REDIS] Error updating screen share:", error);
    }
  }

  // Update recording state
  async updateRecording(userId: string, isRecording: boolean): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      await redisClient!.hset(key, "isRecording", isRecording ? "true" : "false");
      await redisClient!.expire(key, this.TTL);

      await redisPub!.publish(
        this.CHANNEL,
        JSON.stringify({
          type: "user-recording-changed",
          userId,
          isRecording,
        })
      );
    } catch (error) {
      console.error("[REDIS] Error updating recording state:", error);
    }
  }

  // Remove user from workspace
  async removeUser(userId: string): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;

      // Get user data before removing
      const userData = await redisClient!.hgetall(key);

      // Remove user data
      await redisClient!.del(key);
      await redisClient!.srem(this.ONLINE_SET_KEY, userId);

      // Publish event
      await redisPub!.publish(
        this.CHANNEL,
        JSON.stringify({
          type: "user-left",
          userId,
          user: userData,
        })
      );
    } catch (error) {
      console.error("[REDIS] Error removing user:", error);
    }
  }

  // Refresh user TTL (keep alive)
  async refreshUser(userId: string): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
      await redisClient!.expire(key, this.TTL);
    } catch (error) {
      console.error("[REDIS] Error refreshing user TTL:", error);
    }
  }

  // Check if user exists
  async userExists(userId: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;

    try {
      return (await redisClient!.sismember(this.ONLINE_SET_KEY, userId)) === 1;
    } catch (error) {
      console.error("[REDIS] Error checking user existence:", error);
      return false;
    }
  }

  // Get users in specific space
  async getUsersInSpace(spaceId: string): Promise<WorkspaceUser[]> {
    if (!isRedisAvailable()) return [];

    try {
      const allUsers = await this.getAllUsers();
      return allUsers.filter((u) => u.spaceId === spaceId);
    } catch (error) {
      console.error("[REDIS] Error getting users in space:", error);
      return [];
    }
  }

  // Cleanup stale users (run periodically)
  async cleanupStaleUsers(): Promise<void> {
    if (!isRedisAvailable()) return;

    try {
      const userIds = await redisClient!.smembers(this.ONLINE_SET_KEY);

      for (const userId of userIds) {
        const key = `${this.PRESENCE_KEY_PREFIX}${userId}`;
        const exists = await redisClient!.exists(key);

        if (!exists) {
          // User key expired, remove from online set
          await redisClient!.srem(this.ONLINE_SET_KEY, userId);
          console.log(`[REDIS] Cleaned up stale user: ${userId}`);
        }
      }
    } catch (error) {
      console.error("[REDIS] Error cleaning up stale users:", error);
    }
  }
}
