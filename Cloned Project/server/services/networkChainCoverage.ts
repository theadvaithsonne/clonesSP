// src/services/networkChainCoverage.ts
//
// "Does this user currently have NetworkChain coverage?" — the predicate behind
// the commission split in wallet.ts:creditAffiliateOrPlatform.
//
// DEFINITION (deliberately looser than the rank bonus's):
//   covered = a NetworkChain invoice that is PAID, NOT cancelled, and whose
//   period has not ended. A FREE first month counts, because it is neither
//   cancelled nor expired.
//
// This is NOT services/rankBonus/activeSubscribers.ts. That one additionally
// requires a REAL paid cycle (excluding the free month and top-ups), because
// paying a rank bonus on a freebie would let a free month fund $40+/month. The
// commission split is a softer lever — keep your commission while you are
// covered — so the free month counts here and does not there. Today that is 34
// users versus 3, so the two WILL disagree; that divergence is intentional and
// the reason they are separate functions rather than one shared helper.
//
// Coverage is carried by the LATEST paid invoice in a chain, not by the root:
// renewal advances a CHILD's nextDueDate and leaves the root's first-cycle date
// alone, so checking roots alone reads every renewed member as lapsed. Each
// still-covering invoice is resolved back to its chain root, then to the buyer.

// TWO PREDICATES, ONE GRAPH. This module also answers "who holds an active $25
// Unilevel Plus licence, and who is the nearest upline that does" — see
// `getUnilevelPlusLicensedUsers` / `findLicensedUpline` at the foot of the file.
// That question belongs to the founder comb-plan cascade, not to NetworkChain,
// but it walks the SAME referral edges, and the cache below exists precisely so
// that walk never queries per hop inside a distribution's transaction.
// Duplicating the parent map for a second predicate would reintroduce exactly
// the round-trip storm this file was written to avoid.

import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { PLATFORM_USER_EMAIL } from "./commission";

/**
 * How long a resolved coverage set is reused.
 *
 * One distribution credits ~20 recipients and each would otherwise re-run the
 * same two queries. 60s is short enough that someone who subscribes sees full
 * commission on their next sale, and this only ever decides a SPLIT — never
 * whether money moves at all — so a stale read costs at most one payout's
 * difference, never a lost payment.
 */
const CACHE_TTL_MS = 60_000;

/**
 * Coverage set AND the referral parent map, resolved together.
 *
 * The parent map is cached for a specific reason: creditAffiliateOrPlatform
 * runs inside a single Mongo transaction that spans EVERY recipient of a
 * distribution (unilevelPlusCommission.ts opens one session for all ~20
 * credits). A per-hop User.findById would put hundreds of round trips inside
 * that transaction, pushing it toward the 60s lifetime limit and widening the
 * window for write conflicts. Loading the edges once, outside any hot path,
 * makes the walk pure in-memory arithmetic.
 *
 * Size note: this is one small document per user. Fine at today's scale; if the
 * user count reaches the high hundreds of thousands this should become a
 * $graphLookup or an indexed ancestor query instead.
 */
let cache: {
  at: number;
  users: Set<string>;
  parent: Map<string, string | null>;
} | null = null;

/** Drop the cache — for tests, and after a script mutates subscriptions. */
export function clearNetworkChainCoverageCache() {
  cache = null;
}

/**
 * Every userId with live NetworkChain coverage right now.
 *
 * Returned as a Set because callers do one lookup per commission recipient
 * while walking an upline; the set is tiny (tens of users), so one query up
 * front beats a query per hop.
 */
export async function getNetworkChainCoveredUsers(
  asOf: Date = new Date()
): Promise<Set<string>> {
  return (await load(asOf)).users;
}

/** Coverage set + parent map, both from one cached load. */
async function load(asOf: Date = new Date()): Promise<{
  users: Set<string>;
  parent: Map<string, string | null>;
}> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;

  const covering = await Invoice.find({
    "lineItems.itemType": "third_party_subscription",
    status: "paid",
    cancelledAt: { $in: [null, undefined] },
    nextDueDate: { $gt: asOf },
  })
    .select({ _id: 1, parentInvoiceId: 1 })
    .lean();

  const rootIds = [
    ...new Set(
      covering.map((i: any) => String(i.parentInvoiceId ?? i._id))
    ),
  ].map((s) => new Types.ObjectId(s));

  const users = new Set<string>();
  if (rootIds.length) {
    const roots = await Invoice.find({ _id: { $in: rootIds } })
      .select({ userId: 1 })
      .lean();
    for (const r of roots as any[]) {
      if (r.userId) users.add(String(r.userId));
    }
  }

  // The platform account is covered by definition — it is the destination of
  // every forfeited half, and requiring it to subscribe to itself would make
  // the upline walk terminate on an "inactive" node. Matches how it is already
  // treated in wallet.ts and rankBonus/activeSubscribers.ts.
  const { User } = await import("../models/user.model");
  const platform = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  if (platform) users.add(String(platform._id));

  // Referral edges for the upline walk. `.lean()` with a two-field projection
  // keeps this cheap — it is the only reason the walk can avoid querying.
  const { User: UserModel } = await import("../models/user.model");
  const edges = await UserModel.find({})
    .select({ _id: 1, referredBy: 1 })
    .lean();
  const parent = new Map<string, string | null>(
    (edges as any[]).map((u) => [
      String(u._id),
      u.referredBy ? String(u.referredBy) : null,
    ])
  );

  cache = { at: Date.now(), users, parent };
  return cache;
}

/** Hard ceiling on the upline walk, matching affiliate.ts's cycle guard. */
const MAX_UPLINE_HOPS = 100;

/**
 * First user at or above `userId` who has coverage.
 *
 * Walks `referredBy` one hop at a time rather than trusting `User.ancestors`:
 * the denormalised array can be stale after a re-parent, and money distribution
 * elsewhere in this codebase deliberately never trusts it (see the comment in
 * commission.ts's referral-chain helper).
 *
 * Returns null when the chain ends without one — the caller sends the money to
 * the platform. A self-referrer (the network founder) terminates the walk
 * rather than looping forever.
 */
export async function findCoveredUpline(
  userId: string,
  covered: Set<string>
): Promise<string | null> {
  return findUplineIn(userId, covered);
}

/**
 * The walk itself, independent of which predicate defines "eligible".
 *
 * `findCoveredUpline` (NetworkChain) and `findLicensedUpline` (founder
 * cascade) are the same traversal over the same edges against different sets,
 * so they share one implementation rather than drifting apart.
 */
export async function findUplineIn(
  userId: string,
  eligible: Set<string>
): Promise<string | null> {
  const { parent } = await load();
  const visited = new Set<string>([String(userId)]);
  let cursor = String(userId);

  for (let hop = 0; hop < MAX_UPLINE_HOPS; hop++) {
    const next = parent.get(cursor) ?? null;
    // No parent, self-referrer, or a cycle — the chain is done.
    if (!next || next === cursor || visited.has(next)) return null;
    if (eligible.has(next)) return next;
    visited.add(next);
    cursor = next;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Unilevel Plus licence holders — the founder comb-plan cascade's predicate.
// ─────────────────────────────────────────────────────────────────────────

let licenceCache: { at: number; users: Set<string> } | null = null;

/** Drop the licence cache — for tests, and after a script grants a licence. */
export function clearUnilevelPlusLicenceCache() {
  licenceCache = null;
}

/**
 * Every userId holding an active $25 Unilevel Plus licence.
 *
 * THE PLATFORM ACCOUNT IS DELIBERATELY EXCLUDED, which is the opposite of
 * `getNetworkChainCoveredUsers`. There the platform is the terminus — the
 * forfeited half has to land somewhere. Here it must not be: a founder comb
 * plan is funded out of the founder's own margin, and the rule is that when
 * the cascade runs out of real licensed uplines the money goes back to the
 * FOUNDER, not to the platform. Including the platform would silently make it
 * the beneficiary of every short chain.
 */
export async function getUnilevelPlusLicensedUsers(): Promise<Set<string>> {
  if (licenceCache && Date.now() - licenceCache.at < CACHE_TTL_MS) {
    return licenceCache.users;
  }
  const { UnilevelPlusPurchase } = await import(
    "../models/unilevelPlusPurchase.model"
  );
  const rows = await UnilevelPlusPurchase.find({ status: "active" })
    .select({ userId: 1 })
    .lean();
  const users = new Set<string>(
    (rows as any[]).map((r) => String(r.userId)).filter(Boolean)
  );

  licenceCache = { at: Date.now(), users };
  return users;
}

/**
 * Nearest upline holding an active licence, or null when the chain ends
 * without one — in which case the caller returns the money to the founder.
 */
export async function findLicensedUpline(
  userId: string,
  licensed: Set<string>
): Promise<string | null> {
  return findUplineIn(userId, licensed);
}
