// src/services/voipPushNotification.ts
import apn from "@parse/node-apn";
import { env } from "../config/env";
import { VoIPToken } from "../models/voipToken.model";
import { User } from "../models/user.model";
import fs from "fs";

// APNs provider for VoIP push notifications
let voipProvider: apn.Provider | null = null;

interface VoIPPushPayload {
  callerId: string;
  callerName: string;
  callerProfilePicture?: string;
  hasVideo?: boolean;
}

interface SendVoIPResult {
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * Per-device targeting for knock pushes.
 * - excludeDeviceIds: deviceIds that currently have a live socket — skip them,
 *   they get the in-app event instead (avoids a duplicate CallKit ring).
 * - allowLegacyTokens: whether to send to tokens that have no deviceId (older
 *   clients). Defaults to true; the knock-send path sets it false when the user
 *   already has a live mobile socket, preserving the old no-double-ring gate.
 */
export interface KnockPushTargeting {
  excludeDeviceIds?: Set<string>;
  allowLegacyTokens?: boolean;
  /**
   * Which app the call belongs to. A NetworkChains call rings only
   * NetworkChains iPhones; a Garage call only Garage HQ ones (tokens with no
   * `app` predate the field and are all Garage HQ). Unset: every token.
   */
  app?: "networkchain" | "garage";
}

function selectTargetedTokens(
  tokens: Array<{ token: string; deviceId?: string; app?: string }>,
  targeting?: KnockPushTargeting
): string[] {
  const exclude = targeting?.excludeDeviceIds;
  const allowLegacy = targeting?.allowLegacyTokens ?? true;
  const app = targeting?.app;
  return tokens
    .filter((t) =>
      !app ? true : app === "networkchain" ? t.app === "networkchain" : t.app !== "networkchain"
    )
    .filter((t) => (t.deviceId ? !exclude?.has(t.deviceId) : allowLegacy))
    .map((t) => t.token);
}

/**
 * Initialize APNs provider for VoIP push notifications
 */
function initializeProvider(): apn.Provider | null {
  if (voipProvider) {
    return voipProvider;
  }

  // Check if APNs is configured
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID) {
    console.warn("[VOIP] APNs not configured - VoIP push will be disabled");
    return null;
  }

  // Get the APNs key content
  let keyContent: string | undefined;

  if (env.APNS_KEY_CONTENT) {
    // Key content provided directly as environment variable
    keyContent = env.APNS_KEY_CONTENT;
  } else if (env.APNS_KEY_PATH && fs.existsSync(env.APNS_KEY_PATH)) {
    // Key file path provided
    keyContent = fs.readFileSync(env.APNS_KEY_PATH, "utf8");
  }

  if (!keyContent) {
    console.warn("[VOIP] APNs key not found - VoIP push will be disabled");
    return null;
  }

  try {
    voipProvider = new apn.Provider({
      token: {
        key: keyContent,
        keyId: env.APNS_KEY_ID,
        teamId: env.APNS_TEAM_ID,
      },
      production: env.APNS_PRODUCTION,
    });

    console.log("[VOIP] APNs provider initialized successfully");
    return voipProvider;
  } catch (error) {
    console.error("[VOIP] Failed to initialize APNs provider:", error);
    return null;
  }
}

/**
 * Get all active VoIP tokens for a user
 */
async function getUserVoIPTokens(
  userId: string
): Promise<Array<{ token: string; deviceId?: string; app?: string }>> {
  const tokens = await VoIPToken.find({
    userId,
    isActive: true,
  })
    .select("token deviceId app")
    .lean();

  return tokens.map((t: any) => ({ token: t.token, deviceId: t.deviceId, app: t.app }));
}

/**
 * A VoIP push must carry `<bundle id>.voip` of the app that registered the
 * token, or APNs rejects it. Garage HQ and NetworkChains both ring through
 * here; rows without `app` predate the field and are garage-chat.
 */
function voipTopicFor(app?: string): string {
  const bundle = app === "networkchain" ? env.NETWORKCHAIN_APNS_BUNDLE_ID : env.APNS_BUNDLE_ID;
  return `${bundle}.voip`;
}

/**
 * Mark a VoIP token as inactive
 */
async function markTokenInactive(token: string): Promise<void> {
  await VoIPToken.findOneAndUpdate({ token }, { isActive: false });
}

/**
 * Increment failed attempts counter for VoIP token
 */
async function incrementFailedAttempts(token: string): Promise<void> {
  const MAX_FAILED_ATTEMPTS = 5;

  const updated = await VoIPToken.findOneAndUpdate(
    { token },
    {
      $inc: { failedAttempts: 1 },
      lastFailedAt: new Date(),
    },
    { new: true }
  );

  // Deactivate if too many failures
  if (updated && updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    console.log(
      `[VOIP] Token exceeded max failures, deactivating: ${token.substring(0, 20)}...`
    );
    await markTokenInactive(token);
  }
}

/**
 * Send VoIP push notification to a user's iOS devices
 */
export async function sendVoIPPushToUser(
  userId: string,
  payload: VoIPPushPayload,
  targeting?: KnockPushTargeting
): Promise<SendVoIPResult> {
  const result: SendVoIPResult = { sent: 0, failed: 0, errors: [] };

  const provider = initializeProvider();
  if (!provider) {
    console.log("[VOIP] Provider not available, skipping VoIP push");
    return result;
  }

  const allTokens = await getUserVoIPTokens(userId);
  const appByToken = new Map(allTokens.map((t) => [t.token, t.app]));
  const tokens = selectTargetedTokens(allTokens, targeting);

  if (tokens.length === 0) {
    // No VoIP tokens registered
    console.log(`[VOIP] No VoIP tokens for user ${userId}`);
    return result;
  }

  console.log(`[VOIP] Sending VoIP push to ${tokens.length} devices for user ${userId}`);

  // Create the VoIP notification
  const notification = new apn.Notification();

  // VoIP-specific settings
  notification.topic = `${env.APNS_BUNDLE_ID}.voip`;
  notification.pushType = "voip";
  notification.priority = 10;
  notification.expiry = Math.floor(Date.now() / 1000) + 60; // 1 minute expiry

  // Payload that will be delivered to the app
  notification.payload = {
    callerId: payload.callerId,
    callerName: payload.callerName,
    callerProfilePicture: payload.callerProfilePicture || "",
    hasVideo: payload.hasVideo || false,
  };

  // Alert for notification (shown if app doesn't handle it)
  notification.alert = {
    title: "Incoming Call",
    body: `${payload.callerName} wants to connect`,
  };

  // Send to all tokens, each on its own app's topic
  for (const token of tokens) {
    try {
      notification.topic = voipTopicFor(appByToken.get(token));
      const response = await provider.send(notification, token);

      if (response.sent.length > 0) {
        result.sent++;
        // Update lastUsedAt
        await VoIPToken.findOneAndUpdate(
          { token },
          { lastUsedAt: new Date(), failedAttempts: 0 }
        );
        console.log(`[VOIP] Push sent successfully to ${token.substring(0, 20)}...`);
      }

      if (response.failed.length > 0) {
        result.failed++;
        const failure = response.failed[0];
        const errorMessage = failure.response?.reason || "Unknown error";
        result.errors.push(errorMessage);

        console.log(
          `[VOIP] Push failed for ${token.substring(0, 20)}...: ${errorMessage}`
        );

        // Handle specific error types
        if (
          failure.response?.reason === "BadDeviceToken" ||
          failure.response?.reason === "Unregistered" ||
          failure.response?.reason === "DeviceTokenNotForTopic"
        ) {
          console.log(
            `[VOIP] Token invalid, deactivating: ${token.substring(0, 20)}...`
          );
          await markTokenInactive(token);
        } else {
          await incrementFailedAttempts(token);
        }
      }
    } catch (error) {
      result.failed++;
      result.errors.push(String(error));
      console.error(`[VOIP] Error sending push to ${token.substring(0, 20)}...:`, error);
    }
  }

  console.log(
    `[VOIP] Result for user ${userId}: sent=${result.sent}, failed=${result.failed}`
  );

  return result;
}

/**
 * Send VoIP push notification for knock request
 * This shows the native iOS call UI even when app is terminated
 */
export async function sendKnockVoIPPush(
  recipientId: string,
  knockerId: string,
  knockerName: string,
  knockerProfilePicture?: string,
  targeting?: KnockPushTargeting
): Promise<SendVoIPResult> {
  // Get knocker's profile picture if not provided
  let profilePicture = knockerProfilePicture;
  if (!profilePicture) {
    try {
      const knocker = await User.findById(knockerId).select("profilePicture").lean();
      profilePicture = (knocker as any)?.profilePicture || "";
    } catch {
      profilePicture = "";
    }
  }

  return sendVoIPPushToUser(
    recipientId,
    {
      callerId: knockerId,
      callerName: knockerName,
      callerProfilePicture: profilePicture,
      hasVideo: false, // Knocks are audio-first, video can be added after joining
    },
    targeting
  );
}

/**
 * Send a VoIP cancel push — stops a ringing CallKit UI when the knock was
 * answered/declined on another device or cancelled by the knocker. The app's
 * PushKit handler sees `type: "cancel"` and ends the matching incoming call
 * instead of reporting a new one.
 */
export async function sendKnockVoIPCancelPush(
  recipientId: string,
  knockerId: string,
  targeting?: KnockPushTargeting
): Promise<SendVoIPResult> {
  const result: SendVoIPResult = { sent: 0, failed: 0, errors: [] };

  const provider = initializeProvider();
  if (!provider) {
    console.log("[VOIP] Provider not available, skipping VoIP cancel push");
    return result;
  }

  const allTokens = await getUserVoIPTokens(recipientId);
  const appByToken = new Map(allTokens.map((t) => [t.token, t.app]));
  const tokens = selectTargetedTokens(allTokens, targeting);
  if (tokens.length === 0) {
    console.log(`[VOIP] No VoIP tokens for user ${recipientId} (cancel)`);
    return result;
  }

  console.log(
    `[VOIP] Sending VoIP CANCEL push to ${tokens.length} devices for user ${recipientId}`
  );

  const notification = new apn.Notification();
  notification.topic = `${env.APNS_BUNDLE_ID}.voip`;
  notification.pushType = "voip";
  notification.priority = 10;
  notification.expiry = Math.floor(Date.now() / 1000) + 30; // stale cancels are useless

  notification.payload = {
    type: "cancel",
    callerId: knockerId,
  };

  for (const token of tokens) {
    try {
      notification.topic = voipTopicFor(appByToken.get(token));
      const response = await provider.send(notification, token);
      if (response.sent.length > 0) {
        result.sent++;
      }
      if (response.failed.length > 0) {
        result.failed++;
        const failure = response.failed[0];
        const errorMessage = failure.response?.reason || "Unknown error";
        result.errors.push(errorMessage);
        if (
          failure.response?.reason === "BadDeviceToken" ||
          failure.response?.reason === "Unregistered" ||
          failure.response?.reason === "DeviceTokenNotForTopic"
        ) {
          await markTokenInactive(token);
        }
      }
    } catch (error) {
      result.failed++;
      result.errors.push(String(error));
      console.error(
        `[VOIP] Error sending cancel push to ${token.substring(0, 20)}...:`,
        error
      );
    }
  }

  return result;
}

/**
 * Shutdown the APNs provider (call on server shutdown)
 */
export function shutdownVoIPProvider(): void {
  if (voipProvider) {
    voipProvider.shutdown();
    voipProvider = null;
    console.log("[VOIP] APNs provider shutdown");
  }
}
