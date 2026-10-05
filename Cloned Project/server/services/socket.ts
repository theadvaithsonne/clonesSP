import { Server } from "socket.io";
import { User } from "../models/user.model";
import { VoIPToken } from "../models/voipToken.model";
import { DeviceToken } from "../models/deviceToken.model";
import { getRedisClient, isRedisAvailable } from "./redis-presence";

let ioInstance: Server | null = null;

export function setSocketInstance(io: Server) {
  ioInstance = io;
}

export function getSocketInstance(): Server | null {
  return ioInstance;
}

/**
 * Announce that `userId` is now reachable on mobile (logged in with a push/VoIP
 * token but no live socket). Web/desktop clients render this as a "Mobile" card
 * in the online list. Safe to call multiple times — clients merge by user id.
 * Call this AFTER a token is registered, when the user isn't already in live
 * presence (the caller is responsible for that check).
 */
export async function broadcastMobileUserJoined(userId: string): Promise<void> {
  if (!ioInstance) return;
  try {
    // Skip if the user already has a live socket — the existing "available"
    // presence wins; we don't want to flicker their card down to Mobile.
    if (isRedisAvailable()) {
      const inLive = await getRedisClient()!.sismember(
        "workspace:online",
        userId
      );
      if (inLive === 1) return;
    }
    const dbUser: any = await User.findById(userId)
      .select("name email profilePicture")
      .lean();
    if (!dbUser) return;
    ioInstance.to("workspace").emit("workspace:user-joined", {
      id: userId,
      name: dbUser.name || "",
      email: dbUser.email,
      profilePicture: dbUser.profilePicture || undefined,
      spaceId: "lobby",
      status: "mobile",
      isScreenSharing: false,
      isRecording: false,
      guest: false,
    });
  } catch (err) {
    console.error("[Socket] broadcastMobileUserJoined failed:", err);
  }
}

/**
 * Remove `userId` from the workspace list ONLY if they're no longer reachable
 * anywhere (no active mobile tokens). Used after deactivating tokens so the
 * web's Mobile card disappears cleanly. If they still have any active mobile
 * token, this is a no-op — they remain reachable on another device.
 */
export async function broadcastUserGoneIfUnreachable(
  userId: string
): Promise<void> {
  if (!ioInstance) return;
  try {
    const [hasVoip, hasPush] = await Promise.all([
      VoIPToken.exists({ userId, isActive: true }),
      DeviceToken.exists({
        userId,
        isActive: true,
        platform: { $in: ["ios", "android"] },
        // Only garage-chat tokens make a user "reachable" here — a
        // NetworkChains install never receives chat pushes, so it can't
        // keep the Mobile card alive. `$in: [null, ...]` also matches
        // legacy rows written before the `app` field existed.
        app: { $in: [null, "garage-chat"] },
      }),
    ]);
    if (hasVoip || hasPush) return;
    ioInstance.to("workspace").emit("workspace:user-left", { id: userId });
  } catch (err) {
    console.error("[Socket] broadcastUserGoneIfUnreachable failed:", err);
  }
}

export function emitNotification(
  targetUserId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
) {
  if (ioInstance) {
    ioInstance
      .to(`user:${targetUserId}`)
      .emit("workspace:notification", notification);
  }
}

export function emitLeaveRequestNotification(
  targetUserId: string,
  notification: {
    type: "leave_request";
    title: string;
    message: string;
    data: {
      leaveRequestId: string;
      requesterId?: string;
      status?: string;
      approverId?: string;
    };
  }
) {
  if (ioInstance) {
    ioInstance
      .to(`user:${targetUserId}`)
      .emit("workspace:leave-notification", notification);
  }
}

/**
 * Emit workshop preview event to all users in an organization
 * Used to notify workspace clients when a workshop goes live or ends
 */
export function emitWorkshopPreviewUpdate(
  orgId: string,
  event: "workshop:preview:live" | "workshop:preview:ended",
  data: {
    workshopId?: string;
    meetId?: string;
    title?: string;
  }
) {
  if (ioInstance) {
    // Emit to organization room
    ioInstance.to(`org:${orgId}`).emit(event, data);
    console.log(`[Socket] Emitted ${event} to org:${orgId}`, data);
  }
}

export function emitAuctionNew(auction: object) {
  ioInstance?.to("auction:global").emit("auction:new", auction);
}

export function emitAuctionUpdate(auction: object) {
  ioInstance?.to("auction:global").emit("auction:update", auction);
}

export function emitAuctionEnd(auction: object) {
  ioInstance?.to("auction:global").emit("auction:end", auction);
}
