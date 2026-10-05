import type { Server } from "socket.io";
import { Types, type Model } from "mongoose";
import { Message } from "../models/message.model";
import { hasBlocked } from "../models/chatBlock.model";

/**
 * Idempotent chat sends.
 *
 * The mobile app keeps unsent messages in an outbox and re-sends them after a
 * reconnect. When the first attempt was saved but its ack was lost (network
 * dropped mid-flight), a naive re-send writes the message twice. The app
 * therefore tags every send with a random `clientMsgId`; a repeat of an id
 * this sender already used returns the stored message instead.
 *
 * `tempId` is not reused for this: web clients generate it from Date.now()
 * alone, so two sends in one millisecond would collide and the second would
 * be silently swallowed.
 */

const MAX_CLIENT_MSG_ID_LENGTH = 100;

export function validClientMsgId(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_CLIENT_MSG_ID_LENGTH
    ? value
    : undefined;
}

function findExisting(model: Model<any>, from: string, clientMsgId: string) {
  return model
    .findOne({ from: new Types.ObjectId(from), clientMsgId })
    .populate("replyTo")
    .lean();
}

/**
 * Create `doc` once per (sender, clientMsgId). Returns `{ existing }` when this
 * id was already stored — the caller acks with it and skips every side effect
 * (broadcast, notification, push), which already ran for the first copy.
 */
export async function createOnce(
  model: Model<any>,
  doc: Record<string, unknown>,
  from: string,
  clientMsgId: string | undefined
): Promise<{ created: any; existing?: undefined } | { existing: any; created?: undefined }> {
  if (!clientMsgId) return { created: await model.create(doc) };

  const prior = await findExisting(model, from, clientMsgId);
  if (prior) return { existing: prior };

  try {
    return { created: await model.create({ ...doc, clientMsgId }) };
  } catch (e: any) {
    // Two retries raced past the lookup; the unique index kept one.
    if (e?.code === 11000) {
      const winner = await findExisting(model, from, clientMsgId);
      if (winner) return { existing: winner };
    }
    throw e;
  }
}

// Messages older than this are left single-ticked on reconnect: the sweep is
// for "their phone came back online", not for back-filling years of history
// on the first connect after this ships.
const DELIVERY_SWEEP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The recipient just connected: everything still pending for them is now
 * reachable, so mark it delivered and tell each sender. Messages from someone
 * the recipient blocked are skipped — a blocked sender must keep seeing a
 * single tick, exactly as if the message never arrived.
 */
export async function markPendingDMsDelivered(io: Server, userId: string) {
  const me = new Types.ObjectId(userId);
  const since = new Date(Date.now() - DELIVERY_SWEEP_WINDOW_MS);
  const pendingMatch = {
    to: me,
    deliveredAt: null,
    readAt: null,
    deletedAt: null,
    createdAt: { $gte: since },
  };

  const conversations: Array<{ _id: { from: Types.ObjectId; convId: string } }> =
    await Message.aggregate([
      { $match: pendingMatch },
      { $group: { _id: { from: "$from", convId: "$convId" } } },
    ]);

  for (const { _id } of conversations) {
    const senderId = _id.from.toString();
    if (await hasBlocked(userId, senderId).catch(() => true)) continue;

    const deliveredAt = new Date();
    const res = await Message.updateMany(
      { ...pendingMatch, from: _id.from, convId: _id.convId },
      { $set: { deliveredAt } }
    );
    if (res.modifiedCount > 0) {
      // `since`: the sweep's window, so the sender doesn't tick older
      // messages this never marked.
      io.to(`user:${senderId}`).emit("dm:delivered", {
        convId: _id.convId,
        by: userId,
        deliveredAt,
        since,
      });
    }
  }
}
