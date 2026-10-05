/**
 * Emit ChannelMembershipEvent rows for the founder Unsub Log.
 *
 * Two entry points:
 *   emitUnsubscribeEvent()  fires from services/feed.ts:unsubscribeFromChannel
 *                            for all three branches (free / one-time / recurring).
 *   emitExpiredEvents()      fires from the sweeper in index.ts when it
 *                            flips "cancelling this cycle" members to
 *                            fully expired. Bulk-friendly — pass every
 *                            membership that got flipped in the same
 *                            update, and this inserts one event per row.
 *
 * Both entry points are best-effort: they log and swallow errors so a
 * broken log write can't take down a cancel or the daily sweeper.
 */

import { Types } from "mongoose";
import { ChannelMembershipEvent } from "../models/channelMembershipEvent.model";
import { convertToUsd } from "../utils/exchangeRate";

function dayDiff(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function classifyChannel(channel: any): {
  channelKind: "free" | "one_time" | "recurring";
  subscriptionPeriod:
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | null;
} {
  if (channel?.isFree) return { channelKind: "free", subscriptionPeriod: null };
  if (!channel?.isSubscription) {
    return { channelKind: "one_time", subscriptionPeriod: null };
  }
  return {
    channelKind: "recurring",
    subscriptionPeriod: channel.subscriptionPeriod ?? null,
  };
}

/**
 * Compute the user's lifetime USD paid for THIS specific channel by
 * summing every paid Invoice line item and converting each currency
 * bucket via convertToUsd. Shared shape with the analytics endpoint so
 * the Unsub Log's snapshot column matches the founder's Members panel
 * for the same (user, channel).
 */
async function computeLifetimeValueUsd(
  userId: Types.ObjectId,
  channelId: Types.ObjectId,
  orgId: Types.ObjectId
): Promise<number> {
  const { Invoice } = await import("../models/invoice.model");
  const agg = await Invoice.aggregate([
    {
      $match: {
        userId,
        organizationId: orgId,
        status: "paid",
      },
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.itemType": "channel",
        "lineItems.itemId": channelId,
      },
    },
    {
      $group: {
        _id: {
          currency: {
            $ifNull: ["$lineItems.originalCurrency", "$itemCurrency"],
          },
        },
        totalMinor: { $sum: "$lineItems.totalPrice" },
      },
    },
  ]);

  let usd = 0;
  for (const bucket of agg) {
    const currency = bucket._id.currency || "USD";
    const native = (bucket.totalMinor || 0) / 100;
    if (native <= 0) continue;
    const { usdAmount } = await convertToUsd(native, currency);
    usd += usdAmount;
  }
  return Math.round(usd * 100) / 100;
}

interface EmitUnsubscribeEventArgs {
  membership: any; // ChannelMembership doc (mongoose or lean)
  channel: any; // Channel doc (lean)
  user: any | null; // User doc/lean — populated for snapshot only
  parentInvoiceId: Types.ObjectId | null;
  accessUntil: Date | null;
  occurredAt?: Date;
}

export async function emitUnsubscribeEvent(
  args: EmitUnsubscribeEventArgs
): Promise<void> {
  try {
    const {
      membership,
      channel,
      user,
      parentInvoiceId,
      accessUntil,
      occurredAt = new Date(),
    } = args;

    const { channelKind, subscriptionPeriod } = classifyChannel(channel);
    const userId = membership.userId as Types.ObjectId;
    const channelId = channel._id as Types.ObjectId;
    const orgId =
      (channel.storeId as Types.ObjectId) ||
      (membership.orgId as Types.ObjectId);

    // days-used from join → cancel; days-left from cancel → accessUntil
    // (recurring only — free/one-time have no future window).
    const joinedAt = membership.joinedAt
      ? new Date(membership.joinedAt)
      : null;
    const activeDaysUsed = joinedAt ? dayDiff(occurredAt, joinedAt) : null;
    const activeDaysLeftAtCancel =
      channelKind === "recurring" && accessUntil
        ? dayDiff(accessUntil, occurredAt)
        : channelKind === "recurring"
          ? null
          : 0;

    const ltvUsd = await computeLifetimeValueUsd(userId, channelId, orgId);

    await ChannelMembershipEvent.create({
      userId,
      channelId,
      orgId,
      eventType: "unsubscribed",
      occurredAt,
      channelKind,
      subscriptionPeriod,
      accessUntil: accessUntil || null,
      activeDaysUsed,
      activeDaysLeftAtCancel,
      lifetimeValueUsdSnapshot: ltvUsd,
      parentInvoiceId: parentInvoiceId ?? null,
      membershipId: membership._id,
      customerEmailSnapshot: user?.email ?? null,
      customerNameSnapshot: user?.name ?? null,
    });
  } catch (err: any) {
    // Never break the caller. The Unsub Log is diagnostic — if the
    // insert fails the cancel itself still succeeded.
    console.error(
      "[ChannelMembershipEvent] failed to emit unsubscribed event:",
      err?.message ?? err
    );
  }
}

interface ExpiredMembershipInput {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  channelId: Types.ObjectId;
  orgId: Types.ObjectId;
  joinedAt?: Date;
  cancelledAt?: Date;
  nextPaymentDate?: Date;
}

/**
 * One-shot bulk insert for the sweeper. Skips memberships that already
 * have an "expired" event logged (idempotent under crash-restart).
 */
export async function emitExpiredEvents(
  memberships: ExpiredMembershipInput[]
): Promise<void> {
  if (memberships.length === 0) return;
  try {
    const { User } = await import("../models/user.model");
    const { Channel } = await import("../models/channel.model");

    // Bail out early on rows that already have an "expired" event
    // logged, so a crash-and-restart in the sweeper doesn't double-log.
    const membershipIds = memberships.map((m) => m._id);
    const existing = await ChannelMembershipEvent.find({
      membershipId: { $in: membershipIds },
      eventType: "expired",
    })
      .select("membershipId")
      .lean();
    const alreadyLogged = new Set(
      existing.map((e: any) => e.membershipId.toString())
    );
    const fresh = memberships.filter(
      (m) => !alreadyLogged.has(m._id.toString())
    );
    if (fresh.length === 0) return;

    // Batch fetch users + channels so we don't do N per-row queries.
    const userIds = Array.from(new Set(fresh.map((m) => m.userId.toString())));
    const channelIds = Array.from(
      new Set(fresh.map((m) => m.channelId.toString()))
    );
    const [users, channels] = await Promise.all([
      User.find({ _id: { $in: userIds } })
        .select("name email")
        .lean(),
      Channel.find({ _id: { $in: channelIds } })
        .select("title isFree isSubscription subscriptionPeriod storeId")
        .lean(),
    ]);
    const userById = new Map(users.map((u: any) => [u._id.toString(), u]));
    const channelById = new Map(
      channels.map((c: any) => [c._id.toString(), c])
    );

    const occurredAt = new Date();

    // LTV per (user, channel) — snapshot at expiry time. Sequential
    // await inside the map is fine; sweeper batches are typically small
    // (single-digit expirations per run).
    const rows = [] as any[];
    for (const m of fresh) {
      const channel = channelById.get(m.channelId.toString());
      const user = userById.get(m.userId.toString());
      const { channelKind, subscriptionPeriod } = classifyChannel(channel);
      const ltvUsd = await computeLifetimeValueUsd(
        m.userId,
        m.channelId,
        m.orgId
      );
      const activeDaysUsed = m.joinedAt
        ? dayDiff(occurredAt, new Date(m.joinedAt))
        : null;

      rows.push({
        userId: m.userId,
        channelId: m.channelId,
        orgId: m.orgId,
        eventType: "expired",
        occurredAt,
        channelKind,
        subscriptionPeriod,
        // The nextPaymentDate the sweeper just tripped is the exact
        // "access ended at" instant — preserve it in the log.
        accessUntil: m.nextPaymentDate ?? null,
        activeDaysUsed,
        // By definition zero on expired — the sweeper only fires
        // after accessUntil elapsed.
        activeDaysLeftAtCancel: 0,
        lifetimeValueUsdSnapshot: ltvUsd,
        parentInvoiceId: null,
        membershipId: m._id,
        customerEmailSnapshot: user?.email ?? null,
        customerNameSnapshot: user?.name ?? null,
      });
    }

    if (rows.length > 0) {
      await ChannelMembershipEvent.insertMany(rows, { ordered: false });
    }
  } catch (err: any) {
    console.error(
      "[ChannelMembershipEvent] failed to emit expired events:",
      err?.message ?? err
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// payment_defaulted — involuntary lapse when a recurring child invoice
// hits its due date unpaid. See sweepChannelPaymentDefaults in
// src/index.ts. Distinct from "expired" (which follows a manual cancel);
// distinct from "unsubscribed" (which IS the manual cancel). Founders
// can filter for these in the Unsub Log to see who's silently churning
// vs. explicitly leaving.
// ─────────────────────────────────────────────────────────────────────────

interface PaymentDefaultedInput {
  // The now-inactive membership row that was just flipped by the sweeper.
  membership: {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    channelId: Types.ObjectId;
    orgId: Types.ObjectId;
    joinedAt?: Date;
  };
  // The parent invoice whose recurring cycle went unpaid. Stamped as the
  // event's parentInvoiceId so founders can trace the sub that lapsed.
  parent: {
    _id: Types.ObjectId;
  };
}

export async function emitPaymentDefaultedEvents(
  inputs: PaymentDefaultedInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const { User } = await import("../models/user.model");
    const { Channel } = await import("../models/channel.model");

    // Idempotency: skip (membership, parent) pairs we've already logged
    // a "payment_defaulted" event for. Uses membershipId + parentInvoiceId
    // as the composite key — same parent could theoretically default
    // twice if a founder re-activated and it defaulted again, so we key
    // on the parent too rather than membershipId alone.
    const membershipIds = inputs.map((i) => i.membership._id);
    const parentIds = inputs.map((i) => i.parent._id);
    const existing = await ChannelMembershipEvent.find({
      membershipId: { $in: membershipIds },
      parentInvoiceId: { $in: parentIds },
      eventType: "payment_defaulted",
    })
      .select("membershipId parentInvoiceId")
      .lean();
    const alreadyLogged = new Set(
      existing.map(
        (e: any) =>
          `${e.membershipId.toString()}:${e.parentInvoiceId?.toString?.() ?? ""}`,
      ),
    );
    const fresh = inputs.filter(
      (i) =>
        !alreadyLogged.has(
          `${i.membership._id.toString()}:${i.parent._id.toString()}`,
        ),
    );
    if (fresh.length === 0) return;

    // Batch fetch users + channels — one query each regardless of batch.
    const userIds = Array.from(
      new Set(fresh.map((i) => i.membership.userId.toString())),
    );
    const channelIds = Array.from(
      new Set(fresh.map((i) => i.membership.channelId.toString())),
    );
    const [users, channels] = await Promise.all([
      User.find({ _id: { $in: userIds } })
        .select("name email")
        .lean(),
      Channel.find({ _id: { $in: channelIds } })
        .select("title isFree isSubscription subscriptionPeriod storeId")
        .lean(),
    ]);
    const userById = new Map(users.map((u: any) => [u._id.toString(), u]));
    const channelById = new Map(
      channels.map((c: any) => [c._id.toString(), c]),
    );

    const occurredAt = new Date();

    const rows = [] as any[];
    for (const { membership: m, parent } of fresh) {
      const channel = channelById.get(m.channelId.toString());
      const user = userById.get(m.userId.toString());
      const { channelKind, subscriptionPeriod } = classifyChannel(channel);
      const ltvUsd = await computeLifetimeValueUsd(
        m.userId,
        m.channelId,
        m.orgId,
      );
      const activeDaysUsed = m.joinedAt
        ? dayDiff(occurredAt, new Date(m.joinedAt))
        : null;

      rows.push({
        userId: m.userId,
        channelId: m.channelId,
        orgId: m.orgId,
        eventType: "payment_defaulted",
        occurredAt,
        channelKind,
        subscriptionPeriod,
        // Access was cut at sweep time — the exact instant we're
        // recording. No "grace window ends at" concept for defaults.
        accessUntil: occurredAt,
        activeDaysUsed,
        // No remaining paid runway on a default — the buyer never paid
        // for this cycle.
        activeDaysLeftAtCancel: 0,
        lifetimeValueUsdSnapshot: ltvUsd,
        // Distinct from "expired" (which sets null): preserve the link
        // back to the sub that lapsed so founders can jump to the
        // parent invoice from the log row.
        parentInvoiceId: parent._id,
        membershipId: m._id,
        customerEmailSnapshot: user?.email ?? null,
        customerNameSnapshot: user?.name ?? null,
      });
    }

    if (rows.length > 0) {
      await ChannelMembershipEvent.insertMany(rows, { ordered: false });
    }
  } catch (err: any) {
    console.error(
      "[ChannelMembershipEvent] failed to emit payment_defaulted events:",
      err?.message ?? err,
    );
  }
}

/**
 * Compute LTV in USD for a user × workshop across every paid invoice
 * they have with itemType: "workshop" and itemId: workshopId. Grouped
 * by currency then converted so mixed USD/INR buys sum correctly.
 * Mirrors the channel LTV helper above.
 */
async function computeWorkshopLtvUsd(
  userId: Types.ObjectId,
  workshopId: Types.ObjectId,
  orgId: Types.ObjectId
): Promise<number> {
  const { Invoice } = await import("../models/invoice.model");
  const agg = await Invoice.aggregate([
    {
      $match: {
        userId,
        organizationId: orgId,
        status: "paid",
      },
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.itemType": "workshop",
        "lineItems.itemId": workshopId,
      },
    },
    {
      $group: {
        _id: {
          currency: {
            $ifNull: ["$lineItems.originalCurrency", "$itemCurrency"],
          },
        },
        totalMinor: { $sum: "$lineItems.totalPrice" },
      },
    },
  ]);

  let usd = 0;
  for (const bucket of agg) {
    const currency = bucket._id.currency || "USD";
    const native = (bucket.totalMinor || 0) / 100;
    if (native <= 0) continue;
    const { usdAmount } = await convertToUsd(native, currency);
    usd += usdAmount;
  }
  return Math.round(usd * 100) / 100;
}

function classifyWorkshop(workshop: any): {
  channelKind: "free" | "one_time" | "recurring";
  subscriptionPeriod:
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | null;
} {
  // Reusing the channelKind vocabulary since the Unsub Log renders both
  // side by side. A recurring live stream (isRecurring: true) is
  // semantically the "recurring" bucket even though workshops don't do
  // per-cycle billing in practice — the founder set the pattern up
  // that way.
  if (workshop?.isFree) return { channelKind: "free", subscriptionPeriod: null };
  if (workshop?.isRecurring) {
    return {
      channelKind: "recurring",
      subscriptionPeriod: workshop.subscriptionPeriod ?? null,
    };
  }
  return { channelKind: "one_time", subscriptionPeriod: null };
}

interface EmitWorkshopUnsubscribeArgs {
  registration: any;
  workshop: any;
  user: any | null;
  // Present for per-session cancels; null for full-mode cancels.
  sessionDate?: Date | null;
  occurredAt?: Date;
}

/**
 * Emit an `unsubscribed` MembershipEvent for a workshop cancel — full
 * or per-session. Best-effort: swallowed on error so a broken log
 * write never blocks the cancel.
 */
export async function emitWorkshopUnsubscribeEvent(
  args: EmitWorkshopUnsubscribeArgs
): Promise<void> {
  try {
    const {
      registration,
      workshop,
      user,
      sessionDate = null,
      occurredAt = new Date(),
    } = args;

    const { channelKind, subscriptionPeriod } = classifyWorkshop(workshop);
    const userId = registration.userId as Types.ObjectId;
    const workshopId = workshop._id as Types.ObjectId;
    const orgId =
      (workshop.orgId as Types.ObjectId) ||
      (registration.orgId as Types.ObjectId);

    const enrolledAt = registration.enrolledAt || registration.registeredAt;
    const activeDaysUsed = enrolledAt
      ? dayDiff(occurredAt, new Date(enrolledAt))
      : null;

    const ltvUsd = await computeWorkshopLtvUsd(userId, workshopId, orgId);

    await ChannelMembershipEvent.create({
      userId,
      channelId: null,
      orgId,
      eventType: "unsubscribed",
      itemKind: "workshop",
      workshopId,
      sessionDate,
      occurredAt,
      channelKind,
      subscriptionPeriod,
      // Workshop cancels don't have a "keep-until" boundary — they're
      // instant. `accessUntil` stays null, `activeDaysLeftAtCancel`
      // stays 0.
      accessUntil: null,
      activeDaysUsed,
      activeDaysLeftAtCancel: 0,
      lifetimeValueUsdSnapshot: ltvUsd,
      parentInvoiceId: null,
      membershipId: registration._id,
      customerEmailSnapshot: user?.email ?? null,
      customerNameSnapshot: user?.name ?? null,
    });
  } catch (err: any) {
    console.error(
      "[ChannelMembershipEvent] failed to emit workshop unsubscribed event:",
      err?.message ?? err
    );
  }
}
