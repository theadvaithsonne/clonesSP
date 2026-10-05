// src/services/downlineTypeFlags.ts
// Derives the stackable membership sub-states stored on `User.typeFlags` and
// shown as the "Type" column of the 1Network downline table. See the backend
// contract (docs 2026-07-27). Shopper = all three false.
//
//   oneNetworkActivated — active UnilevelPlusPurchase ($25 one-time license)
//   networkChainsSub    — active NC recurring sub WITH a real >$0 paid cycle
//                         (the $0 combo "free first month" does NOT count)
//   founderSub          — active/trial OfficeSubscription where the user is founder
//
// Two entry points: a single-user compute (for maintenance hooks) and a bulk
// compute (for the backfill script and the downline-table endpoint) that runs
// three set-membership queries instead of N×3.

import { Types } from "mongoose";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { NcSubscription } from "../models/ncSubscription.model";

export interface DownlineTypeFlags {
  oneNetworkActivated: boolean;
  networkChainsSub: boolean;
  founderSub: boolean;
}

export const EMPTY_TYPE_FLAGS: DownlineTypeFlags = {
  oneNetworkActivated: false,
  networkChainsSub: false,
  founderSub: false,
};

function toOid(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

/**
 * Compute type flags for a set of users in three queries. Returns a map keyed by
 * the user id string; users with no active state are ABSENT (caller treats a miss
 * as all-false / Shopper).
 */
export async function computeTypeFlagsBulk(
  userIds: (string | Types.ObjectId)[]
): Promise<Map<string, DownlineTypeFlags>> {
  const out = new Map<string, DownlineTypeFlags>();
  if (userIds.length === 0) return out;
  const oids = userIds.map(toOid);
  const now = new Date();

  const [upIds, founderIds, ncIds] = await Promise.all([
    // 1Network Activated — active $25 Unilevel Plus purchase.
    UnilevelPlusPurchase.find({ userId: { $in: oids }, status: "active" }).distinct("userId"),
    // Founder Sub — active/trial office subscription where the user is the founder.
    OfficeSubscription.find({
      founderId: { $in: oids },
      status: { $in: ["active", "trial"] },
    }).distinct("founderId"),
    // NetworkChains Sub — active NC sub covered by a real >$0 paid cycle (excludes
    // the $0 combo free-first-month). `payments.$elemMatch.amountCents > 0` is the
    // discriminator — NOT status alone and NOT priceCents (defaults to 4248).
    NcSubscription.find({
      userId: { $in: oids },
      status: "active",
      currentPeriodEnd: { $gt: now },
      payments: { $elemMatch: { amountCents: { $gt: 0 } } },
    }).distinct("userId"),
  ]);

  const set = (ids: unknown[]) => new Set(ids.map((x) => String(x)));
  const up = set(upIds);
  const founder = set(founderIds);
  const nc = set(ncIds);

  for (const oid of oids) {
    const key = oid.toString();
    const flags: DownlineTypeFlags = {
      oneNetworkActivated: up.has(key),
      networkChainsSub: nc.has(key),
      founderSub: founder.has(key),
    };
    if (flags.oneNetworkActivated || flags.networkChainsSub || flags.founderSub) {
      out.set(key, flags);
    }
  }
  return out;
}

/** Compute type flags for one user (used by maintenance hooks). */
export async function computeTypeFlags(
  userId: string | Types.ObjectId
): Promise<DownlineTypeFlags> {
  const map = await computeTypeFlagsBulk([userId]);
  return map.get(toOid(userId).toString()) ?? { ...EMPTY_TYPE_FLAGS };
}
