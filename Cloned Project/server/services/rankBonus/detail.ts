// src/services/rankBonus/detail.ts
//
// Read-only projections behind the admin UI. Nothing here writes.
//
// The point is to answer "why does this person hold this rank, and what would
// move them?" without anyone having to re-run the job or read Mongo by hand.

import { Types } from "mongoose";
import { User } from "../../models/user.model";
import { Invoice } from "../../models/invoice.model";
import { RankQualification } from "../../models/rankQualification.model";
import { RankPlan, RANK_KEYS, payoutFor, RankKey } from "../../models/rankPlan.model";
import { getActivePaidSubscribers } from "./activeSubscribers";

export interface PersonSummary {
  id: string;
  name: string | null;
  email: string | null;
  affiliateId: string | null;
  /** Profile picture URL (from the user record); null when unset. */
  profilePicture: string | null;
  joinedAt: Date | null;
  /** Holds an active PAID subscription right now. */
  active: boolean;
  /** Rank as of the most recent run that touched them. */
  rank: string | null;
  rankPeriodKey: string | null;
  directsCount: number;
  downlineCount: number;
}

function toSummary(u: any, active: Set<string>): PersonSummary {
  return {
    id: u._id.toString(),
    name: u.name ?? null,
    email: u.email ?? null,
    affiliateId: u.affiliateId ?? null,
    profilePicture: u.profilePicture ?? null,
    joinedAt: u.createdAt ?? null,
    active: active.has(u._id.toString()),
    rank: u.ncRank?.current ?? null,
    rankPeriodKey: u.ncRank?.periodKey ?? null,
    directsCount: u.directsCount ?? 0,
    downlineCount: u.downlineCount ?? 0,
  };
}

const PERSON_FIELDS = {
  _id: 1,
  name: 1,
  email: 1,
  affiliateId: 1,
  profilePicture: 1,
  createdAt: 1,
  referredBy: 1,
  directsCount: 1,
  downlineCount: 1,
  ncRank: 1,
} as const;

export interface UserRankDetail {
  user: PersonSummary;
  /** Who referred them, and when they joined under that person. */
  referrer: PersonSummary | null;
  subscription: {
    active: boolean;
    /** Why they're inactive — helps support answer "but I paid". */
    reason: "active_paid" | "free_month_only" | "lapsed" | "never_subscribed";
    currentPeriodEnd: Date | null;
    termMonths: number | null;
    paidCycles: number;
  };
  /** Every direct referral, with the two facts that decide Bronze. */
  directs: PersonSummary[];
  activeDirects: number;
  /** Per-leg summary — which of their legs carries which rank. */
  legs: Array<{
    legHead: PersonSummary;
    /** Highest rank found anywhere in this leg, including the head. */
    topRank: string | null;
    size: number;
  }>;
  /** What they were paid, period by period. */
  history: Array<{
    periodKey: string;
    rank: string;
    bonusUsd: number;
    payoutStatus: string;
    routedToPlatform: boolean;
    paidAt: Date | null;
  }>;
  /** Plain-language "what would promote them". */
  nextRank: {
    target: string;
    requirement: string;
    have: number;
    need: number;
  } | null;
}

export async function getUserRankDetail(
  userIdRaw: string,
  thirdPartyClientId: Types.ObjectId | string
): Promise<UserRankDetail | null> {
  const userId = new Types.ObjectId(userIdRaw);
  const user = await User.findById(userId).select(PERSON_FIELDS).lean();
  if (!user) return null;

  const { active } = await getActivePaidSubscribers(thirdPartyClientId);

  const [referrer, directs, plan, history] = await Promise.all([
    user.referredBy
      ? User.findById(user.referredBy).select(PERSON_FIELDS).lean()
      : null,
    // `_id: { $ne: userId }` excludes a SELF-REFERRER from their own directs.
    // The network founder has `referredBy === _id`, so without this he appears
    // as one of his own referrals — inflating the count, adding a leg headed by
    // himself, and letting him count toward his own Bronze.
    User.find({ referredBy: userId, _id: { $ne: userId } })
      .select(PERSON_FIELDS)
      .sort({ createdAt: 1 })
      .lean(),
    RankPlan.findOne({ isActive: true }).lean(),
    RankQualification.find({ userId })
      .sort({ periodKey: -1 })
      .limit(24)
      .lean(),
  ]);

  // ── Subscription state, with a reason rather than a bare boolean ─────────
  const roots = await Invoice.find({
    "lineItems.itemType": "third_party_subscription",
    thirdPartyClientId:
      typeof thirdPartyClientId === "string"
        ? new Types.ObjectId(thirdPartyClientId)
        : thirdPartyClientId,
    userId,
    parentInvoiceId: { $exists: false },
  })
    .select({ _id: 1, nextDueDate: 1, cancelledAt: 1, metadata: 1 })
    .lean();

  let reason: UserRankDetail["subscription"]["reason"] = "never_subscribed";
  let currentPeriodEnd: Date | null = null;
  let paidCycles = 0;
  let termMonths: number | null = null;

  if (roots.length) {
    const rootIds = roots.map((r) => r._id);
    const paid = await Invoice.find({
      $or: [{ _id: { $in: rootIds } }, { parentInvoiceId: { $in: rootIds } }],
      status: "paid",
      "metadata.kind": { $nin: ["topup", "combo_free_first_month"] },
      $and: [
        {
          $or: [
            { totalAmount: { $gt: 0 } },
            { "metadata.prepaidViaBundle": { $exists: true } },
          ],
        },
      ],
    })
      .select({ _id: 1, metadata: 1, recurringIntervalMonths: 1 })
      .lean();

    paidCycles = paid.length;

    // Coverage end = the LATEST nextDueDate across the whole chain (root OR any
    // renewal cycle). Renewal advances a child's date, not the root's, so the
    // root alone understates coverage for every renewed subscriber.
    const cycles = await Invoice.find({
      $or: [{ _id: { $in: rootIds } }, { parentInvoiceId: { $in: rootIds } }],
      cancelledAt: { $in: [null, undefined] },
    })
      .select({ nextDueDate: 1 })
      .lean();
    currentPeriodEnd = cycles.reduce<Date | null>((mx, c) => {
      const d = c.nextDueDate ? new Date(c.nextDueDate) : null;
      return d && (!mx || d > mx) ? d : mx;
    }, null);
    const covered = !!currentPeriodEnd && currentPeriodEnd > new Date();

    termMonths =
      (paid[paid.length - 1]?.metadata as any)?.termMonths ??
      paid[paid.length - 1]?.recurringIntervalMonths ??
      null;

    if (active.has(userIdRaw)) reason = "active_paid";
    else if (covered && paidCycles === 0) reason = "free_month_only";
    else reason = "lapsed";
  }

  // Membership of `active` can come from something other than this user's own
  // invoices — the platform account is active by definition, with or without a
  // chain of its own. Without this, such an account reads `active: true` and
  // `reason: "never_subscribed"` at the same time, which the UI renders as a
  // contradiction.
  if (active.has(userIdRaw)) reason = "active_paid";

  // ── Legs: the top rank present anywhere in each direct's subtree ─────────
  // One aggregation over `ancestors` rather than a walk per leg.
  const legs: UserRankDetail["legs"] = [];
  if (directs.length) {
    const rankOrder = new Map(RANK_KEYS.map((k, i) => [k as string, i]));
    const directIds = directs.map((d) => d._id);
    const inLegs = await User.aggregate([
      { $match: { ancestors: { $in: directIds } } },
      {
        $addFields: {
          legRoot: {
            $arrayElemAt: [{ $setIntersection: ["$ancestors", directIds] }, 0],
          },
        },
      },
      {
        $group: {
          _id: "$legRoot",
          size: { $sum: 1 },
          ranks: { $addToSet: "$ncRank.current" },
        },
      },
    ]);
    const byLeg = new Map(inLegs.map((l: any) => [String(l._id), l]));

    for (const d of directs) {
      const agg = byLeg.get(d._id.toString());
      const candidates: string[] = [
        d.ncRank?.current,
        ...((agg?.ranks || []) as (string | null | undefined)[]),
      ].filter((c): c is string => typeof c === "string" && c.length > 0);
      let top: string | null = null;
      for (const c of candidates) {
        if (top === null || (rankOrder.get(c) ?? -1) > (rankOrder.get(top) ?? -1)) {
          top = c;
        }
      }
      legs.push({
        legHead: toSummary(d, active),
        topRank: top,
        size: (agg?.size || 0) + 1,
      });
    }
  }

  // ── What would promote them ─────────────────────────────────────────────
  const activeDirects = directs.filter((d) => active.has(d._id.toString())).length;
  let nextRank: UserRankDetail["nextRank"] = null;
  if (plan) {
    const currentOrdinal = user.ncRank?.current
      ? RANK_KEYS.indexOf(user.ncRank.current as RankKey)
      : -1;
    if (currentOrdinal < 0) {
      const need = plan.tiers[0].requiredActiveDirects || 5;
      nextRank = {
        target: "Bronze",
        requirement: `${need} directs with an active paid subscription (and your own active)`,
        have: activeDirects,
        need,
      };
    } else if (currentOrdinal < RANK_KEYS.length - 1) {
      const target = RANK_KEYS[currentOrdinal + 1];
      const below = RANK_KEYS[currentOrdinal];
      const need = plan.tiers[currentOrdinal + 1].requiredLegs || 0;
      const rankOrder = new Map(RANK_KEYS.map((k, i) => [k as string, i]));
      const have = legs.filter(
        (l) =>
          l.topRank != null &&
          (rankOrder.get(l.topRank) ?? -1) >= (rankOrder.get(below) ?? 99)
      ).length;
      nextRank = {
        target,
        requirement: `1 ${below} in each of ${need} separate legs`,
        have,
        need,
      };
    }
  }

  return {
    user: toSummary(user, active),
    referrer: referrer ? toSummary(referrer, active) : null,
    subscription: {
      active: active.has(userIdRaw),
      reason,
      currentPeriodEnd,
      termMonths,
      paidCycles,
    },
    directs: directs.map((d) => toSummary(d, active)),
    activeDirects,
    legs,
    history: history.map((h) => ({
      periodKey: h.periodKey,
      rank: h.rank,
      bonusUsd: h.bonusUsd,
      payoutStatus: h.payoutStatus,
      routedToPlatform: h.routedToPlatform,
      paidAt: h.paidAt ?? null,
    })),
    nextRank,
  };
}

export interface SubscriberRow extends PersonSummary {
  referrerName: string | null;
  referrerEmail: string | null;
  referrerId: string | null;
  activeDirects: number;
}

/**
 * The people-first view: everyone in the tree with their subscription state,
 * who referred them, and their rank. Filterable so the admin can answer
 * "show me active subscribers with no rank" or "show me every Silver".
 */
/** Whitelist — anything else would let the caller sort on an unindexed field. */
const SORTABLE: Record<string, string> = {
  name: "name",
  email: "email",
  rank: "ncRank.current",
  joinedAt: "createdAt",
  directsCount: "directsCount",
  downlineCount: "downlineCount",
};

export async function listSubscribers(opts: {
  thirdPartyClientId: Types.ObjectId | string;
  search?: string;
  status?: "active" | "inactive";
  rank?: string;
  /** Key from SORTABLE. Unknown keys fall back to the default ordering. */
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  skip?: number;
}): Promise<{
  rows: SubscriberRow[];
  total: number;
  activeTotal: number;
  /** Headcount per rank across the WHOLE tree, ignoring the current filters. */
  rankCounts: Record<string, number>;
  rankedTotal: number;
}> {
  const { active } = await getActivePaidSubscribers(opts.thirdPartyClientId);
  const limit = Math.min(opts.limit ?? 50, 200);
  const skip = Math.max(opts.skip ?? 0, 0);

  const q: any = {};
  if (opts.search) {
    const rx = new RegExp(opts.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    q.$or = [{ name: rx }, { email: rx }, { phone: rx }, { affiliateId: rx }];
  }
  if (opts.rank) q["ncRank.current"] = opts.rank;
  if (opts.status === "active") {
    q._id = { $in: [...active].map((id) => new Types.ObjectId(id)) };
  } else if (opts.status === "inactive") {
    q._id = { $nin: [...active].map((id) => new Types.ObjectId(id)) };
  }

  // Default puts the people who matter first: biggest organisations on top.
  const sortField = opts.sortBy ? SORTABLE[opts.sortBy] : undefined;
  const sortSpec: Record<string, 1 | -1> = sortField
    ? { [sortField]: opts.sortOrder === "asc" ? 1 : -1, _id: 1 }
    : { directsCount: -1, createdAt: -1 };

  const [users, total, rankAgg] = await Promise.all([
    User.find(q)
      .select({ ...PERSON_FIELDS })
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(q),
    User.aggregate([
      { $match: { "ncRank.current": { $in: RANK_KEYS as unknown as string[] } } },
      { $group: { _id: "$ncRank.current", n: { $sum: 1 } } },
    ]),
  ]);

  const rankCounts: Record<string, number> = {};
  for (const k of RANK_KEYS) rankCounts[k] = 0;
  let rankedTotal = 0;
  for (const r of rankAgg as Array<{ _id: string; n: number }>) {
    rankCounts[r._id] = r.n;
    rankedTotal += r.n;
  }

  // Referrer names + active-direct counts, both in one round trip each.
  const referrerIds = users.map((u) => u.referredBy).filter(Boolean);
  const referrers = referrerIds.length
    ? await User.find({ _id: { $in: referrerIds } })
        .select({ _id: 1, name: 1, email: 1 })
        .lean()
    : [];
  const refById = new Map(referrers.map((r) => [r._id.toString(), r]));

  const userIds = users.map((u) => u._id);
  const directRows = await User.find({ referredBy: { $in: userIds } })
    .select({ _id: 1, referredBy: 1 })
    .lean();
  const activeDirectCount = new Map<string, number>();
  for (const d of directRows) {
    if (!active.has(d._id.toString())) continue;
    const key = String(d.referredBy);
    // A self-referrer must not count as their own active direct — otherwise
    // the founder starts one step closer to Bronze than everyone else.
    if (key === d._id.toString()) continue;
    activeDirectCount.set(key, (activeDirectCount.get(key) || 0) + 1);
  }

  return {
    total,
    activeTotal: active.size,
    rankCounts,
    rankedTotal,
    rows: users.map((u) => {
      const ref = u.referredBy ? refById.get(u.referredBy.toString()) : null;
      return {
        ...toSummary(u, active),
        referrerId: u.referredBy ? u.referredBy.toString() : null,
        referrerName: ref?.name ?? null,
        referrerEmail: ref?.email ?? null,
        activeDirects: activeDirectCount.get(u._id.toString()) || 0,
      };
    }),
  };
}
