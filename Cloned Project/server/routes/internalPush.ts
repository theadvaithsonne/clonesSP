/**
 * Service-to-service push for NetworkChains.
 *
 * contacts-backend owns signals and opportunities but has no push
 * infrastructure — this backend is the only push sender (DeviceToken lives
 * here). It calls this route whenever a user gets a new signal or opportunity.
 *
 * Auth: `X-Internal-Api-Key: <INTERNAL_API_KEY>` — the key contacts-backend
 * already holds as GARAGE_HQ_INTERNAL_API_KEY for /wallet/hq.
 *
 * The audience is pinned to "networkchain": the screens these pushes open
 * exist only in the NetworkChains app, so no other app's tokens are reached.
 *
 * Every push here is an alert (`nativeAlert`): the contact's photo or the
 * product's image (`image`) is drawn in the icon slot with the app badge in
 * its corner — natively on Android "native-alerts" builds and by the iOS
 * Notification Service Extension; older Android builds show it as the large
 * icon via `richContent.image`.
 */
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { requireInternalKey } from "../middleware/auth";
import { sendPushToUser } from "../services/pushNotification";

const router = Router();

const MAX_ITEMS = 100;

interface PushItem {
  title?: unknown;
  body?: unknown;
  data?: unknown;
  channelId?: unknown;
  image?: unknown;
}

/** Only a public https image can be fetched by the device. */
function imageUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const url = v.trim();
  return /^https:\/\/\S+$/i.test(url) && url.length <= 2048 ? url : undefined;
}

function clean(item: PushItem) {
  const title = typeof item.title === "string" ? item.title.trim().slice(0, 200) : "";
  const body = typeof item.body === "string" ? item.body.trim().slice(0, 500) : "";
  if (!title && !body) return null;
  const image = imageUrl(item.image);
  const data =
    item.data && typeof item.data === "object" && !Array.isArray(item.data)
      ? (item.data as Record<string, any>)
      : {};
  return {
    title,
    body,
    data: { ...data, ...(image ? { avatarUrl: image } : {}) },
    channelId: typeof item.channelId === "string" ? item.channelId : undefined,
    ...(image ? { richContent: { image } } : {}),
    nativeAlert: true,
  };
}

// POST /internal/push/user
// Body: { userId, notifications: [{ title, body, data?, channelId? }] }
// One push per entry, sent in order. Returns the summed send result.
router.post("/user", requireInternalKey, async (req: Request, res: Response) => {
  const { userId, notifications } = req.body ?? {};
  if (typeof userId !== "string" || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "valid userId is required" });
  }
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return res.status(400).json({ error: "notifications must be a non-empty array" });
  }
  if (notifications.length > MAX_ITEMS) {
    return res.status(400).json({ error: `at most ${MAX_ITEMS} notifications per call` });
  }

  const items = notifications.map(clean).filter((n): n is NonNullable<typeof n> => !!n);
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const r = await sendPushToUser(userId, { ...item, audience: "networkchain" });
      sent += r.sent;
      failed += r.failed;
    } catch (err) {
      failed++;
      console.error("[internal-push] send failed:", err);
    }
  }
  return res.json({ ok: true, notifications: items.length, sent, failed });
});

export default router;
