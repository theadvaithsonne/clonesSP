// src/services/pushNotification.ts
import Expo, {
  ExpoPushMessage,
  ExpoPushTicket,
  ExpoPushSuccessTicket,
  ExpoPushErrorTicket,
} from "expo-server-sdk";
import { DeviceToken } from "../models/deviceToken.model";
import { mutedUserIds } from "../models/chatMute.model";
import { hasBlocked, blockersOf } from "../models/chatBlock.model";

// Create Expo SDK client
const expo = new Expo();

type Audience = "chat" | "messaging" | "feed" | "networkchain" | "all";

/**
 * Which `DeviceToken.app` values each audience covers, and whether rows written
 * before the `app` field existed count as part of it.
 *
 * `apps: null` means "no restriction" — every registered app, whatever it is.
 *
 * `legacy` is the half that is easy to get wrong. A row with no `app` predates
 * the field and is a garage-chat install, so any audience containing
 * garage-chat must also accept those rows or the oldest devices silently stop
 * receiving. An audience that EXCLUDES garage-chat has to exclude them for the
 * same reason in reverse — `feed` is the case that forced this: garage-chat
 * ships no feed screens, so a feed push there would open to nothing.
 */
const AUDIENCE_APPS: Record<
  Audience,
  { apps: string[] | null; legacy: boolean }
> = {
  chat: { apps: ["garage-chat"], legacy: true },
  messaging: { apps: ["garage-chat", "networkchain"], legacy: true },
  feed: { apps: ["networkchain"], legacy: false },
  networkchain: { apps: ["networkchain"], legacy: false },
  all: { apps: null, legacy: true },
};

/**
 * The `DeviceToken.features` entry for an Android NetworkChains build that
 * draws chat notifications itself — see `chatMessage` below.
 */
const NATIVE_CHAT_FEATURE = "native-chat";

/**
 * The `DeviceToken.features` entry for a NetworkChains build with native call
 * UI: Android draws a full-screen incoming call from a data-only push, iOS
 * rings through CallKit off a VoIP push (voipPushNotification.ts).
 */
const NATIVE_CALLS_FEATURE = "native-calls";

/**
 * The `DeviceToken.features` entry for an Android NetworkChains build that
 * draws signal / opportunity alerts itself — see `nativeAlert` below.
 */
const NATIVE_ALERTS_FEATURE = "native-alerts";

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: "default" | null;
  channelId?: string; // Android notification channel
  /**
   * Sender's avatar, shown beside their name in the notification shade —
   * the round photo WhatsApp puts on a message.
   *
   * Expo maps this to FCM's `notification.image`, which expo-notifications
   * applies with setLargeIcon on the device. It has to travel in the payload:
   * a push that arrives while the app is killed is built by the OS alone, so
   * the JS side never sees it and cannot attach an image after the fact. On
   * Android this is the ONLY way to get a per-notification photo — a local
   * notification reads its large icon from a static manifest resource.
   *
   * The URL must be publicly fetchable by the device (the utfs.io/uploadthing
   * URLs already are).
   */
  richContent?: { image?: string };
  /**
   * Which registered apps receive this push.
   *
   *  - "chat" (default): garage-chat only. For the things only garage-chat can
   *    land — knocks and calls, which have no screen in any other app.
   *  - "messaging": garage-chat + NetworkChains. The office DM/group threads are
   *    the SAME conversations in both clients (NetworkChains' chat section talks
   *    to this backend's socket), so a message push belongs in both.
   *  - "feed": NetworkChains ONLY. Reactions, comments and mentions on a post.
   *  - "networkchain": NetworkChains ONLY, for anything else that is (1:1
   *    calls ringing there — garage-chat rings its own way).
   *    garage-chat has no feed screens, so it is the one audience that also
   *    drops the legacy no-`app` rows (see AUDIENCE_APPS).
   *  - "all": every app registered against this backend. The wallet money
   *    pushes, which are about the shared wallet rather than any one app.
   *
   * Rows with no `app` predate the field and are garage-chat, so every audience
   * except "feed" and "networkchain" includes them.
   */
  audience?: Audience;
  /**
   * Marks a chat message push (DM / group / mention), which apps draw as a
   * WhatsApp-style conversation: grouped per chat, the sender's face with the
   * app's badge in the corner. Its `data` carries `senderAvatar` and, for a
   * group, `groupPicture` for that.
   *
   *  - Android "native-chat" tokens get it DATA-ONLY. A push with a title/body
   *    is an FCM notification message, which the OS draws on its own while the
   *    app is backgrounded or killed — one flat row per message, app code never
   *    runs. Data-only, the app's messaging service builds it instead.
   *  - Every other token gets the ordinary push with `mutableContent` set, so
   *    an iOS Notification Service Extension runs on it (threads it by chat and
   *    makes it a communication notification). Harmless without one.
   */
  chatMessage?: boolean;
  /**
   * A 1:1 call ringing ("ring") or stopping ("cancel") on NetworkChains.
   *
   *  - Android "native-calls" tokens: DATA-ONLY, so the app's messaging
   *    service shows (or dismisses) its full-screen incoming call even when
   *    killed — a notification message would be drawn by the OS instead.
   *  - iOS "native-calls" tokens: skipped. CallKit rings off the VoIP push; a
   *    banner too would be a second incoming call.
   *  - Anything else (a build without native call UI): "ring" is an ordinary
   *    notification whose tap opens the in-app ringing screen; "cancel" has
   *    nothing to cancel and is skipped.
   */
  nativeCall?: "ring" | "cancel";
  /**
   * A NetworkChains push drawn with a face in the icon slot and the app badge in
   * its corner — signals, opportunities, feed engagement, wallet money. Its
   * `data` carries `avatarUrl` (may be absent; filled from `richContent.image`),
   * `avatarName` (the letter avatar's source when there is no photo) and
   * `alertKey` (whose face it is — the app's conversation/shortcut id).
   *
   *  - Android "native-alerts" tokens get it DATA-ONLY, so the app's messaging
   *    service draws it in every app state (a title/body push is drawn by the
   *    OS while the app is backgrounded, and can't take that layout).
   *  - Every other token gets the ordinary push with `mutableContent` set, so
   *    the iOS Notification Service Extension can restyle it. Older Android
   *    builds show `richContent.image` as the large icon instead.
   */
  nativeAlert?: boolean;
  /** Devices to leave out — ones whose app is open on a live socket. */
  excludeDeviceIds?: Set<string>;
}

interface SendPushResult {
  sent: number;
  failed: number;
  errors: string[];
}

interface UserPushToken {
  token: string;
  deviceId?: string;
  /** `DeviceToken.app`, with legacy no-`app` rows folded into garage-chat. */
  app: string;
  platform?: string;
  features: string[];
}

/**
 * Get all active push tokens for a user
 */
async function getUserPushTokens(
  userId: string,
  audience: Audience = "chat"
): Promise<UserPushToken[]> {
  const filter: Record<string, any> = {
    userId,
    isActive: true,
  };
  // `$in: [null, ...]` matches missing fields too, which is how legacy rows
  // (written before `app` existed) stay in the garage-chat audiences — and how
  // the `feed` audience keeps them OUT by omitting the null.
  const { apps, legacy } = AUDIENCE_APPS[audience];
  if (apps) {
    filter.app = { $in: legacy ? [null, ...apps] : apps };
  }

  const tokens = await DeviceToken.find(filter)
    .select("token app platform features deviceId")
    .lean();

  return tokens.map((t: any) => ({
    token: t.token,
    deviceId: t.deviceId,
    app: t.app || "garage-chat",
    platform: t.platform,
    features: t.features || [],
  }));
}

/**
 * Sends one chunk, splitting it per Expo project if Expo refuses the mix.
 *
 * Expo rejects a WHOLE request whose tokens belong to more than one project
 * (`PUSH_TOO_MANY_EXPERIENCE_IDS`) — no tickets, nothing delivered to any of
 * them. garage-chat and NetworkChains are separate Expo projects, so every user
 * signed into both lost every message push once the "messaging" audience put
 * both apps' tokens in one request. `sendPushToUser` already groups by
 * `DeviceToken.app`; this is the backstop for a group that still spans
 * projects (e.g. an old garage-chat build on a different project), using the
 * project → tokens map Expo returns with the error.
 *
 * Returns the messages alongside their tickets, in the order sent, so callers
 * pair them by position.
 */
async function sendChunk(
  chunk: ExpoPushMessage[]
): Promise<{ message: ExpoPushMessage; ticket: ExpoPushTicket }[]> {
  try {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    return chunk.map((message, i) => ({ message, ticket: tickets[i] }));
  } catch (error: any) {
    if (error?.code !== "PUSH_TOO_MANY_EXPERIENCE_IDS" || !error.details) {
      throw error;
    }
    const byToken = new Map(chunk.map((m) => [m.to as string, m]));
    const out: { message: ExpoPushMessage; ticket: ExpoPushTicket }[] = [];
    for (const projectTokens of Object.values(error.details) as string[][]) {
      const group = projectTokens
        .map((t) => byToken.get(t))
        .filter((m): m is ExpoPushMessage => !!m);
      if (group.length === 0) continue;
      const tickets = await expo.sendPushNotificationsAsync(group);
      group.forEach((message, i) => out.push({ message, ticket: tickets[i] }));
    }
    return out;
  }
}

/**
 * Mark a token as inactive
 */
async function markTokenInactive(token: string): Promise<void> {
  await DeviceToken.findOneAndUpdate({ token }, { isActive: false });
}

/**
 * Increment failed attempts counter
 */
async function incrementFailedAttempts(token: string): Promise<void> {
  const MAX_FAILED_ATTEMPTS = 5;

  const updated = await DeviceToken.findOneAndUpdate(
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
      `[PUSH] Token exceeded max failures, deactivating: ${token.substring(0, 20)}...`
    );
    await markTokenInactive(token);
  }
}

/**
 * A chat push as a "native-chat" token receives it: data-only, so the app's
 * messaging service runs in every state and draws the conversation itself.
 *
 * Expo nests `data` as one JSON string under the FCM data key "body"; the
 * Android service unpacks it (ChatMessagingService.payload). The display copy
 * travels as `pushTitle`/`pushBody`, off the `title`/`message` names
 * expo-notifications presents a data message from — a second, plain copy of
 * the message is exactly what this path exists to avoid.
 */
function nativeChatMessage(
  token: string,
  payload: PushNotificationPayload
): ExpoPushMessage {
  return {
    to: token,
    data: {
      ...payload.data,
      render: NATIVE_CHAT_FEATURE,
      pushTitle: payload.title,
      pushBody: payload.body,
      channelId: payload.channelId ?? null,
    },
    // Android only delivers a data message to a backgrounded/killed app
    // promptly (through Doze) at high priority.
    priority: "high",
  };
}

/**
 * A call for an Android "native-calls" build: data-only, so its messaging
 * service raises (or clears) the full-screen incoming call itself in every app
 * state. Same Expo data packaging as nativeChatMessage.
 */
function nativeCallMessage(
  token: string,
  payload: PushNotificationPayload
): ExpoPushMessage {
  return {
    to: token,
    data: { ...payload.data, render: NATIVE_CALLS_FEATURE },
    priority: "high",
    // A ring that arrives after the call rang out is worse than none.
    ttl: 45,
  };
}

/**
 * An alert for an Android "native-alerts" build: data-only, drawn by its
 * messaging service. Same Expo data packaging as nativeChatMessage.
 */
function nativeAlertMessage(
  token: string,
  payload: PushNotificationPayload
): ExpoPushMessage {
  return {
    to: token,
    data: {
      ...payload.data,
      render: NATIVE_ALERTS_FEATURE,
      pushTitle: payload.title,
      pushBody: payload.body,
      channelId: payload.channelId ?? null,
    },
    priority: "high",
  };
}

/**
 * Send push notification to a single user (all their devices)
 */
export async function sendPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  const result: SendPushResult = { sent: 0, failed: 0, errors: [] };

  // An alert's picture travels in `data` too: the Android renderer and the iOS
  // extension read it from there, whatever the sender set it as.
  // Only a public https URL — the device fetches it itself.
  const alertImage = payload.richContent?.image;
  if (payload.nativeAlert && alertImage && /^https:\/\//i.test(alertImage) && !payload.data?.avatarUrl) {
    payload = { ...payload, data: { ...payload.data, avatarUrl: alertImage } };
  }

  const tokens = await getUserPushTokens(userId, payload.audience ?? "chat");

  if (tokens.length === 0) {
    // No tokens registered - user might be web-only or hasn't registered token yet
    return result;
  }

  console.log(`[PUSH] Sending to ${tokens.length} devices for user ${userId}`);

  // Build messages for all tokens, one list per app. Each app is its own Expo
  // project and Expo refuses a request that mixes projects — see sendChunk.
  const messagesByApp = new Map<string, ExpoPushMessage[]>();

  for (const { token, app, platform, features, deviceId } of tokens) {
    if (deviceId && payload.excludeDeviceIds?.has(deviceId)) continue;

    const nativeCalls = features.includes(NATIVE_CALLS_FEATURE);
    if (payload.nativeCall === "cancel" && !(nativeCalls && platform === "android")) continue;
    if (payload.nativeCall && nativeCalls && platform === "ios") continue;

    if (!Expo.isExpoPushToken(token)) {
      console.warn(`[PUSH] Invalid Expo push token: ${String(token).substring(0, 20)}...`);
      result.failed++;
      result.errors.push(`Invalid token format`);
      // Mark invalid token as inactive
      await markTokenInactive(token);
      continue;
    }

    const message: ExpoPushMessage =
      payload.nativeCall && nativeCalls && platform === "android"
        ? nativeCallMessage(token, payload)
        : payload.nativeAlert &&
            platform === "android" &&
            features.includes(NATIVE_ALERTS_FEATURE)
          ? nativeAlertMessage(token, payload)
        : payload.chatMessage &&
            platform === "android" &&
            features.includes(NATIVE_CHAT_FEATURE)
          ? nativeChatMessage(token, payload)
          : {
            to: token,
            title: payload.title,
            body: payload.body,
            data: payload.data,
            sound: payload.sound ?? "default",
            badge: payload.badge,
            channelId: payload.channelId,
            ...(payload.richContent?.image
              ? { richContent: { image: payload.richContent.image } }
              : {}),
            // iOS only runs a NotificationService extension (which swaps the
            // app icon for the sender's avatar and threads by chat) when
            // mutable-content is set.
            ...(payload.richContent?.image || payload.chatMessage || payload.nativeAlert
              ? { mutableContent: true }
              : {}),
            priority: "high",
          };
    const group = messagesByApp.get(app);
    if (group) group.push(message);
    else messagesByApp.set(app, [message]);
  }

  if (messagesByApp.size === 0) {
    return result;
  }

  // Send in chunks (Expo recommends max 100 per request), never mixing apps
  const chunks = [...messagesByApp.values()].flatMap((group) =>
    expo.chunkPushNotifications(group)
  );

  for (const chunk of chunks) {
    try {
      const sent = await sendChunk(chunk);

      // Process tickets
      for (const { message, ticket } of sent) {
        const token = message.to as string;

        if (ticket.status === "ok") {
          result.sent++;
          // Update lastUsedAt
          await DeviceToken.findOneAndUpdate(
            { token },
            { lastUsedAt: new Date(), failedAttempts: 0 }
          );
        } else {
          result.failed++;
          const errorTicket = ticket as ExpoPushErrorTicket;
          const errorMessage = errorTicket.message || "Unknown error";
          result.errors.push(errorMessage);

          // Handle specific error types
          if (errorTicket.details?.error === "DeviceNotRegistered") {
            console.log(
              `[PUSH] Device not registered, deactivating token: ${token.substring(0, 20)}...`
            );
            await markTokenInactive(token);
          } else {
            // Increment failed attempts
            await incrementFailedAttempts(token);
          }
        }
      }
    } catch (error) {
      console.error("[PUSH] Error sending chunk:", error);
      result.failed += chunk.length;
      result.errors.push(String(error));
    }
  }

  if (result.sent > 0 || result.failed > 0) {
    console.log(
      `[PUSH] Result for user ${userId}: sent=${result.sent}, failed=${result.failed}`
    );
  }

  return result;
}

/**
 * Send push notifications to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<Map<string, SendPushResult>> {
  const results = new Map<string, SendPushResult>();

  // Process in parallel with concurrency limit
  const CONCURRENCY = 10;
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const batch = userIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((userId) => sendPushToUser(userId, payload))
    );
    batch.forEach((userId, idx) => results.set(userId, batchResults[idx]));
  }

  return results;
}

/**
 * Send DM push notification
 */
export async function sendDMPushNotification(
  recipientId: string,
  senderId: string,
  senderName: string,
  messageText: string,
  convId: string,
  messageId: string,
  senderAvatar?: string | null
): Promise<SendPushResult> {
  // Mute is only meaningful if it reaches HERE. Muting on the device merely
  // hides in-app banners; a backgrounded app still gets the OS notification,
  // which is the bug this check exists to fix. convKey is viewer-relative, so
  // from the recipient's side this conversation is `dm:<senderId>`.
  //
  // A block suppresses the push too — the message is still stored, it just
  // never reaches the person who blocked the sender.
  const convKey = `dm:${senderId}`;
  const [muted, blocked] = await Promise.all([
    mutedUserIds([recipientId], convKey),
    hasBlocked(recipientId, senderId),
  ]);
  if (muted.has(recipientId) || blocked) {
    // Not a failure — there was simply nobody to deliver to.
    return { sent: 0, failed: 0, errors: [] };
  }

  return sendPushToUser(recipientId, {
    title: senderName || "New Message",
    body: messageText || "Sent an attachment",
    data: {
      type: "dm",
      chatId: senderId,
      senderId,
      senderName,
      messageId,
      convId,
      senderAvatar: senderAvatar || null,
    },
    channelId: "messages", // Android channel
    // The same office DM thread exists in NetworkChains — see Audience.
    audience: "messaging",
    ...(senderAvatar ? { richContent: { image: senderAvatar } } : {}),
    chatMessage: true,
  });
}

/**
 * Send group message push notification
 */
export async function sendGroupPushNotification(
  recipientIds: string[],
  senderId: string,
  senderName: string,
  groupId: string,
  groupName: string,
  messageText: string,
  messageId: string,
  /**
   * The SENDER's avatar, deliberately — not the group's. The question the
   * notification shade has to answer is who is talking.
   */
  senderAvatar?: string | null,
  /** The group's own picture — the conversation icon where the app draws it. */
  groupPicture?: string | null
): Promise<Map<string, SendPushResult>> {
  // Exclude sender from recipients
  let filteredRecipients = recipientIds.filter((id) => id !== senderId);

  if (filteredRecipients.length === 0) {
    return new Map();
  }

  // Drop anyone who muted this group, or who has blocked the sender. Both are
  // resolved in ONE query each for the whole member list — a per-recipient
  // lookup here would cost a round trip per member per message, and groups are
  // exactly where that gets expensive.
  const [muted, blockers] = await Promise.all([
    mutedUserIds(filteredRecipients, `group:${groupId}`),
    blockersOf(filteredRecipients, senderId),
  ]);
  if (muted.size || blockers.size) {
    filteredRecipients = filteredRecipients.filter(
      (id) => !muted.has(id) && !blockers.has(id)
    );
    if (filteredRecipients.length === 0) {
      return new Map();
    }
  }

  return sendPushToUsers(filteredRecipients, {
    title: groupName || "Group Message",
    body: `${senderName || "Someone"}: ${messageText || "Sent an attachment"}`,
    data: {
      type: "group",
      chatId: groupId,
      groupId,
      groupName,
      senderId,
      senderName,
      messageId,
      senderAvatar: senderAvatar || null,
      groupPicture: groupPicture || null,
    },
    channelId: "group_messages", // Android channel
    audience: "messaging",
    ...(senderAvatar ? { richContent: { image: senderAvatar } } : {}),
    chatMessage: true,
  });
}

/**
 * Send knock request push notification
 */
export async function sendKnockPushNotification(
  recipientId: string,
  knockerId: string,
  knockerName: string
): Promise<SendPushResult> {
  return sendPushToUser(recipientId, {
    title: "Incoming Knock",
    body: `${knockerName} is knocking to start a conversation`,
    data: {
      type: "knock",
      knockerId,
      knockerName,
    },
    // Reuse the high-priority "incoming_calls" channel created by the Android
    // call plugin (IMPORTANCE_HIGH + ringtone + VISIBILITY_PUBLIC). Without
    // this, Android creates a default-priority channel that's nearly silent.
    channelId: "incoming_calls",
    sound: "default",
  });
}

/**
 * Ring a 1:1 call on the recipient's NetworkChains devices. Its own push —
 * not the knock one above — because that one says "knocking" (Garage HQ's
 * office word) and goes to garage-chat only.
 */
export async function sendNetworkchainCallPush(
  recipientId: string,
  caller: { id: string; name: string; picture?: string },
  excludeDeviceIds?: Set<string>
): Promise<SendPushResult> {
  return sendPushToUser(recipientId, {
    title: caller.name,
    body: "Incoming voice call",
    data: {
      type: "knock",
      knockerId: caller.id,
      knockerName: caller.name,
      knockerProfilePicture: caller.picture || "",
    },
    channelId: "incoming_calls",
    sound: "default",
    audience: "networkchain",
    nativeCall: "ring",
    excludeDeviceIds,
  });
}

/** Stop a NetworkChains call ringing: answered elsewhere, declined, cancelled or rung out. */
export async function sendNetworkchainCallCancelPush(
  recipientId: string,
  callerId: string,
  excludeDeviceIds?: Set<string>
): Promise<SendPushResult> {
  return sendPushToUser(recipientId, {
    title: "",
    body: "",
    data: { type: "knock-cancel", knockerId: callerId },
    audience: "networkchain",
    nativeCall: "cancel",
    excludeDeviceIds,
  });
}

/**
 * Send incoming call push notification
 */
export async function sendCallPushNotification(
  recipientId: string,
  callerId: string,
  callerName: string,
  callType: "video" | "audio" = "video"
): Promise<SendPushResult> {
  return sendPushToUser(recipientId, {
    title: "Incoming Call",
    body: `${callerName} is calling you`,
    data: {
      type: "call",
      callerId,
      callerName,
      callType,
    },
    channelId: "calls", // Android channel for calls
    sound: "default",
  });
}

/**
 * Send group mention push notification
 */
export async function sendMentionPushNotification(
  recipientId: string,
  senderId: string,
  senderName: string,
  groupId: string,
  groupName: string,
  messageText: string,
  messageId: string,
  senderAvatar?: string | null,
  groupPicture?: string | null
): Promise<SendPushResult> {
  // A MUTE is deliberately not checked here: mentions are meant to cut through
  // a muted conversation, matching WhatsApp and Slack.
  //
  // A BLOCK is different. Without this check, blocking someone still leaves
  // them a way to put a notification on your phone — just @ you in any group
  // you share. That is the one escape hatch blocking exists to close.
  if (await hasBlocked(recipientId, senderId)) {
    return { sent: 0, failed: 0, errors: [] };
  }

  return sendPushToUser(recipientId, {
    title: `${senderName} mentioned you`,
    body: messageText
      ? messageText.substring(0, 100) + (messageText.length > 100 ? "..." : "")
      : "Mentioned you in a message",
    data: {
      type: "group", // Navigate to group chat
      chatId: groupId,
      groupId,
      groupName,
      senderId,
      senderName,
      messageId,
      isMention: true,
      senderAvatar: senderAvatar || null,
      groupPicture: groupPicture || null,
    },
    channelId: "mentions", // Android channel for mentions
    sound: "default",
    audience: "messaging",
    ...(senderAvatar ? { richContent: { image: senderAvatar } } : {}),
    // Drawn into the group's conversation, not as a notification of its own.
    chatMessage: true,
  });
}

/**
 * Push an affiliate-commission earning to the recipient. Fired from
 * `creditAffiliateOrPlatform` after every credit — regardless of whether
 * the actual money settled to their affiliate wallet or was routed to
 * the platform (recipient hasn't activated Unilevel Plus). In both
 * cases the affiliate wallet visibly shows the credit, so the push is
 * accurate.
 *
 * `amount` is in the currency's smallest unit (cents / paise). The
 * helper formats it with Intl.NumberFormat so the notification body
 * reads "$4.50 commission" rather than "450 commission".
 *
 * Optional `routedToPlatform`: when true the body appends a nudge
 * telling the recipient the credit is locked until UP activation.
 * Fire-and-forget — the caller MUST NOT await this or it'll swallow
 * a real-time push into a background worker.
 */
export async function sendCommissionEarnedPushNotification(
  recipientId: string,
  params: {
    amount: number;
    currency: string;
    description?: string;
    /**
     * Amount unit — most commission credits are in the currency's smallest
     * unit (cents/paise). Rank-bonus payouts pass whole units (dollars) —
     * see rankBonus/payout.ts. Pass `"whole"` in that case; default is
     * `"smallest"`.
     */
    unit?: "smallest" | "whole";
    /** Level 1..N when this was an affiliate-chain commission. Omit for non-chain earnings. */
    level?: number;
    /** `true` when the earning routed to the platform (recipient hasn't activated UP). */
    routedToPlatform?: boolean;
    /** Optional deep-link hint the app can use to open the wallet on tap. */
    walletDeepLink?: string;
  }
): Promise<SendPushResult> {
  const {
    amount,
    currency,
    description,
    unit,
    level,
    routedToPlatform,
    walletDeepLink,
  } = params;

  const divisor = unit === "whole" ? 1 : 100;
  const formatted = (() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (currency || "USD").toUpperCase(),
      }).format((amount || 0) / divisor);
    } catch {
      return `${currency} ${((amount || 0) / divisor).toFixed(2)}`;
    }
  })();

  const title = level
    ? `You earned ${formatted} (Level ${level})`
    : `You earned ${formatted}`;

  const bodyBase = description
    ? description
    : "New affiliate commission credited to your wallet.";
  const body = routedToPlatform
    ? `${bodyBase} Activate Unilevel Plus to unlock this earning.`
    : bodyBase;

  return sendPushToUser(recipientId, {
    title,
    body,
    data: {
      type: "commission_earned",
      amount,
      currency: (currency || "USD").toUpperCase(),
      level: level ?? null,
      routedToPlatform: !!routedToPlatform,
      ...(walletDeepLink ? { deepLink: walletDeepLink } : {}),
      // No person behind a commission — a "$" letter avatar is its face.
      avatarName: "$",
      alertKey: "wallet:commission",
    },
    channelId: "earnings", // Android channel; add to app manifest if not present.
    sound: "default",
    badge: 1,
    audience: "all", // wallet money — deliver to networkchain installs too
    nativeAlert: true,
  });
}

/**
 * Push a peer wallet transfer to the recipient. Fired from the store-wallet
 * transfer paths in services/wallet.ts (`transferStoreCreditsBetweenOrgs`,
 * `transferStoreToContentRewards`) after the Mongo transaction commits.
 *
 * `amount` is in WHOLE currency units — store wallets hold dollar floats,
 * unlike commission credits (cents/paise). No divisor here; passing cents
 * would show "$2500.00" for a $25 transfer.
 *
 * Rides the existing "earnings" Android channel so current builds deliver
 * it without an app update. `type: "transfer_received"` is only known to
 * app builds that handle it — older builds still display the notification
 * but do nothing on tap.
 */
export async function sendTransferReceivedPushNotification(
  recipientId: string,
  params: {
    /** Whole currency units (dollars), matching store-wallet balances. */
    amount: number;
    currency: string;
    /** Sender's display name; title falls back to "You received …" without it. */
    senderName?: string;
    /** Sender's user id and photo — the notification's face. */
    senderId?: string;
    senderAvatar?: string;
    /** Sender-provided note. Body falls back to a destination line without it. */
    description?: string;
    /** Which of the recipient's wallets was credited. Default: store. */
    destination?: "store" | "content_rewards";
    /** App-internal route hint for the tap handler; it falls back to /wallet. */
    walletDeepLink?: string;
  }
): Promise<SendPushResult> {
  const {
    amount,
    currency,
    senderName,
    senderId,
    senderAvatar,
    description,
    destination,
    walletDeepLink,
  } = params;

  const formatted = (() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (currency || "USD").toUpperCase(),
      }).format(amount || 0);
    } catch {
      return `${currency} ${(amount || 0).toFixed(2)}`;
    }
  })();

  const title = senderName
    ? `${senderName} sent you ${formatted}`
    : `You received ${formatted}`;

  const body = description
    ? description
    : destination === "content_rewards"
      ? "Credited to your Content Rewards wallet."
      : "Credited to your store wallet.";

  return sendPushToUser(recipientId, {
    title,
    body,
    data: {
      type: "transfer_received",
      amount,
      currency: (currency || "USD").toUpperCase(),
      senderName: senderName ?? null,
      destination: destination || "store",
      ...(walletDeepLink ? { deepLink: walletDeepLink } : {}),
      avatarName: senderName || "$",
      alertKey: senderId ? `wallet:${senderId}` : "wallet:transfer",
    },
    channelId: "earnings",
    sound: "default",
    badge: 1,
    audience: "all", // wallet money — deliver to networkchain installs too
    nativeAlert: true,
    ...(senderAvatar ? { richContent: { image: senderAvatar } } : {}),
  });
}

/**
 * What someone did to your post. Mirrors the row types the Activity tab
 * renders (`getFeedActivity`), minus `save`.
 *
 * A save is deliberately absent: bookmarking is a private filing action, and
 * neither Instagram nor X pushes it. It still SHOWS in the Activity list, which
 * is pull-based — the difference is only whether it vibrates the author's
 * phone.
 */
export type FeedEngagement =
  | { kind: "reaction"; reactionType: string }
  /** A reaction on a COMMENT. Distinct from `reaction`, which is on the post:
   *  the recipient is the comment's author, and the copy has to say so. */
  | { kind: "comment_reaction"; commentId: string; reactionType: string; text?: string }
  | { kind: "comment"; commentId: string; text: string }
  | { kind: "reply"; commentId: string; text: string }
  | { kind: "mention"; surface: "post" | "comment"; text: string }
  | { kind: "repost" }
  | { kind: "quote"; text: string };

/** The eight reactions, as the composer names them, for the push title. */
const REACTION_WORD: Record<string, string> = {
  like: "liked",
  love: "loved",
  laugh: "laughed at",
  wow: "was wowed by",
  sad: "was saddened by",
  angry: "was angered by",
  fire: "🔥'd",
  clap: "applauded",
};

function feedPushCopy(
  actorName: string,
  engagement: FeedEngagement,
  postContent?: string | null
): { title: string; body: string } {
  const excerpt = (s?: string | null, fallback = "") => {
    const t = (s ?? "").trim();
    if (!t) return fallback;
    return t.length > 100 ? `${t.slice(0, 100)}...` : t;
  };

  switch (engagement.kind) {
    case "reaction":
      return {
        title: `${actorName} ${REACTION_WORD[engagement.reactionType] ?? "reacted to"} your post`,
        body: excerpt(postContent, "Tap to see your post"),
      };
    case "comment_reaction":
      return {
        title: `${actorName} ${REACTION_WORD[engagement.reactionType] ?? "reacted to"} your comment`,
        // The comment's own text, not the post's — it is the thing reacted to.
        body: excerpt(engagement.text, "Tap to see your comment"),
      };
    case "comment":
      return {
        title: `${actorName} commented on your post`,
        body: excerpt(engagement.text, "Tap to read the comment"),
      };
    case "reply":
      return {
        title: `${actorName} replied to your comment`,
        body: excerpt(engagement.text, "Tap to read the reply"),
      };
    case "mention":
      return {
        title: `${actorName} mentioned you in a ${engagement.surface}`,
        body: excerpt(engagement.text, "Tap to see it"),
      };
    case "repost":
      return {
        title: `${actorName} reposted your post`,
        body: excerpt(postContent, "Tap to see your post"),
      };
    case "quote":
      return {
        title: `${actorName} quoted your post`,
        body: excerpt(engagement.text, "Tap to see the quote"),
      };
  }
}

/**
 * Push a feed engagement to the author of the post (or of the parent comment).
 *
 * Self-engagement and blocks are handled HERE rather than at each call site, so
 * a new call site cannot forget them: liking your own post is not news, and
 * without the block check, blocking someone still leaves them a way to buzz
 * your phone — react to any post of yours.
 *
 * `postId` drives the tap target. The app routes `data.deepLink` ahead of
 * anything else (`lib/push-notifications.ts`), and `/feed/:id` is the post
 * detail screen.
 *
 * Fire-and-forget at the call sites: a failed push must never fail the write
 * that triggered it.
 */
export async function sendFeedEngagementPushNotification(
  recipientId: string,
  actor: { id: string; name?: string | null; avatar?: string | null },
  post: { id: string; content?: string | null },
  engagement: FeedEngagement
): Promise<SendPushResult> {
  const empty: SendPushResult = { sent: 0, failed: 0, errors: [] };

  if (!recipientId || recipientId === actor.id) return empty;
  if (await hasBlocked(recipientId, actor.id)) return empty;

  const actorName = actor.name?.trim() || "Someone";
  const { title, body } = feedPushCopy(actorName, engagement, post.content);

  return sendPushToUser(recipientId, {
    title,
    body,
    data: {
      type: "feed",
      engagement: engagement.kind,
      postId: post.id,
      actorId: actor.id,
      actorName,
      ...(engagement.kind === "comment" ||
      engagement.kind === "reply" ||
      engagement.kind === "comment_reaction"
        ? { commentId: engagement.commentId }
        : {}),
      ...(engagement.kind === "reaction" || engagement.kind === "comment_reaction"
        ? { reactionType: engagement.reactionType }
        : {}),
      deepLink: `/feed/${post.id}`,
      avatarName: actorName,
      alertKey: `feed:${actor.id}`,
    },
    // "default" rather than a dedicated channel on purpose: an Android channel
    // has to already exist on the device or the notification is dropped, and
    // "default" is the one every NetworkChains install has created since its
    // first version. A `feed` channel can follow once a build carrying it is
    // the floor.
    channelId: "default",
    sound: "default",
    audience: "feed",
    nativeAlert: true,
    ...(actor.avatar ? { richContent: { image: actor.avatar } } : {}),
  });
}
