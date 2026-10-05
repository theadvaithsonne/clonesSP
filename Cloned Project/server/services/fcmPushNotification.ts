// src/services/fcmPushNotification.ts
//
// Direct FCM sender for Android knock-call delivery.
//
// Why direct FCM instead of Expo Push: Expo's API always sets the FCM
// `notification` field on the outgoing message, which Android delivers as a
// system banner when the app is killed — your code never runs. We need a
// data-only message (`data` field only, no `notification`) so FCM dispatches
// to our custom FirebaseMessagingService, which then synthesizes the
// full-screen incoming-call UI via CallNotificationHelper.

import { env } from "../config/env";
import { FCMToken } from "../models/fcmToken.model";
import type { KnockPushTargeting } from "./voipPushNotification";
import fs from "fs";

function selectTargetedTokens(
  tokens: Array<{ token: string; deviceId?: string }>,
  targeting?: KnockPushTargeting
): string[] {
  const exclude = targeting?.excludeDeviceIds;
  const allowLegacy = targeting?.allowLegacyTokens ?? true;
  return tokens
    .filter((t) => (t.deviceId ? !exclude?.has(t.deviceId) : allowLegacy))
    .map((t) => t.token);
}

// Lazy import / lazy init — firebase-admin is optional; if creds aren't set,
// this whole pipeline gracefully no-ops (matching voipPushNotification.ts).
type MessagingApi = {
  send: (msg: any) => Promise<string>;
};

let fcmMessaging: MessagingApi | null = null;
let initAttempted = false;

interface FCMKnockPayload {
  knockerId: string;
  knockerName: string;
  knockerProfilePicture?: string;
  hasVideo?: boolean;
}

interface SendFCMResult {
  sent: number;
  failed: number;
  errors: string[];
}

function initializeProvider(): MessagingApi | null {
  if (fcmMessaging) return fcmMessaging;
  if (initAttempted) return fcmMessaging; // remember the last failure, don't spam logs
  initAttempted = true;

  // Resolve service-account credentials. Two equivalent inputs:
  //   FIREBASE_SERVICE_ACCOUNT_JSON — full JSON as a single env var
  //   FIREBASE_SERVICE_ACCOUNT_PATH — path to a JSON file on disk
  let serviceAccountJson: string | undefined;
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  } else if (
    env.FIREBASE_SERVICE_ACCOUNT_PATH &&
    fs.existsSync(env.FIREBASE_SERVICE_ACCOUNT_PATH)
  ) {
    serviceAccountJson = fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8");
  }

  if (!serviceAccountJson) {
    console.warn(
      "[FCM] Firebase service account not configured — direct FCM (Android knock ring) disabled"
    );
    return null;
  }

  try {
    // Require lazily so the backend doesn't crash if firebase-admin isn't installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    const credentials = JSON.parse(serviceAccountJson);

    const existing = admin.apps.find((a: any) => a?.name === "garage-knocks");
    const app = existing
      ? existing
      : admin.initializeApp(
          { credential: admin.credential.cert(credentials) },
          "garage-knocks"
        );

    fcmMessaging = app.messaging();
    console.log("[FCM] Firebase Admin initialized successfully");
    return fcmMessaging;
  } catch (error) {
    console.error("[FCM] Failed to initialize Firebase Admin:", error);
    return null;
  }
}

async function getUserFCMTokens(
  userId: string
): Promise<Array<{ token: string; deviceId?: string }>> {
  const tokens = await FCMToken.find({ userId, isActive: true })
    .select("token deviceId")
    .lean();
  return tokens.map((t: any) => ({ token: t.token, deviceId: t.deviceId }));
}

async function markTokenInactive(token: string): Promise<void> {
  await FCMToken.findOneAndUpdate({ token }, { isActive: false });
}

async function incrementFailedAttempts(token: string): Promise<void> {
  const MAX_FAILED_ATTEMPTS = 5;
  const updated = await FCMToken.findOneAndUpdate(
    { token },
    { $inc: { failedAttempts: 1 }, lastFailedAt: new Date() },
    { new: true }
  );
  if (updated && updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await markTokenInactive(token);
    console.log(
      `[FCM] Token exceeded max failures, deactivating: ${token.substring(0, 20)}...`
    );
  }
}

/**
 * Send a data-only knock message to all of a user's registered FCM tokens.
 * Returns a result summary; on full failure the caller falls back to the
 * Expo push path so the user still gets a (non-ringing) banner.
 */
export async function sendKnockFCMPush(
  recipientId: string,
  payload: FCMKnockPayload,
  targeting?: KnockPushTargeting
): Promise<SendFCMResult> {
  const result: SendFCMResult = { sent: 0, failed: 0, errors: [] };

  const provider = initializeProvider();
  if (!provider) return result;

  const tokens = selectTargetedTokens(
    await getUserFCMTokens(recipientId),
    targeting
  );
  if (tokens.length === 0) {
    console.log(`[FCM] No FCM tokens for user ${recipientId}`);
    return result;
  }

  console.log(
    `[FCM] Sending knock to ${tokens.length} Android device(s) for user ${recipientId}`
  );

  // Data-only message. Critical: no `notification` field — that's what makes
  // FCM dispatch to onMessageReceived in our MessagingService instead of
  // posting a system notification.
  const dataPayload: Record<string, string> = {
    type: "knock",
    callerId: payload.knockerId,
    callerName: payload.knockerName,
    callerProfilePicture: payload.knockerProfilePicture || "",
    hasVideo: String(!!payload.hasVideo),
  };

  for (const token of tokens) {
    try {
      const message = {
        token,
        data: dataPayload,
        android: {
          priority: "high" as const, // wake the device promptly, even when idle
          ttl: 60 * 1000, // 60s — drop stale knocks rather than ringing late
        },
      };

      const messageId = await provider.send(message);
      result.sent++;
      await FCMToken.findOneAndUpdate(
        { token },
        { lastUsedAt: new Date(), failedAttempts: 0 }
      );
      console.log(
        `[FCM] Push sent successfully to ${token.substring(0, 20)}... (id=${messageId})`
      );
    } catch (error: any) {
      result.failed++;
      const code = error?.code || error?.errorInfo?.code || "unknown";
      const message = error?.message || String(error);
      result.errors.push(`${code}: ${message}`);
      console.log(
        `[FCM] Push failed for ${token.substring(0, 20)}...: ${code} ${message}`
      );

      // Deactivate tokens that are clearly invalid; everything else is a
      // transient failure (rate limit, server error, etc.).
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/mismatched-credential"
      ) {
        await markTokenInactive(token);
      } else {
        await incrementFailedAttempts(token);
      }
    }
  }

  console.log(
    `[FCM] Result for user ${recipientId}: sent=${result.sent}, failed=${result.failed}`
  );
  return result;
}

/**
 * Send a data-only cancel message — dismisses a ringing native call UI when
 * the knock was answered/declined on another device or cancelled by the
 * knocker. Handled by the JS background notification task, which ends the
 * active incoming-call session for `callerId`.
 */
export async function sendKnockCancelFCMPush(
  recipientId: string,
  knockerId: string,
  targeting?: KnockPushTargeting
): Promise<SendFCMResult> {
  const result: SendFCMResult = { sent: 0, failed: 0, errors: [] };

  const provider = initializeProvider();
  if (!provider) return result;

  const tokens = selectTargetedTokens(
    await getUserFCMTokens(recipientId),
    targeting
  );
  if (tokens.length === 0) {
    console.log(`[FCM] No FCM tokens for user ${recipientId} (cancel)`);
    return result;
  }

  console.log(
    `[FCM] Sending knock CANCEL to ${tokens.length} Android device(s) for user ${recipientId}`
  );

  const dataPayload: Record<string, string> = {
    type: "knock-cancelled",
    callerId: knockerId,
  };

  for (const token of tokens) {
    try {
      const message = {
        token,
        data: dataPayload,
        android: {
          priority: "high" as const,
          ttl: 30 * 1000, // stale cancels are useless
        },
      };
      await provider.send(message);
      result.sent++;
    } catch (error: any) {
      result.failed++;
      const code = error?.code || error?.errorInfo?.code || "unknown";
      result.errors.push(`${code}: ${error?.message || String(error)}`);
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/mismatched-credential"
      ) {
        await markTokenInactive(token);
      }
    }
  }

  return result;
}
