// src/services/genealogy/data.ts
// DB access for /affiliate/genealogy/*. Maths lives in ./pure.
import { Types } from "mongoose";
import { User } from "../../models/user.model";
import { Invoice } from "../../models/invoice.model";
import { UnilevelPlusPurchase } from "../../models/unilevelPlusPurchase.model";
import { UnilevelPlusDistribution } from "../../models/unilevelPlusDistribution.model";
import { CommissionDistribution } from "../../models/commissionDistribution.model";
import { WalletTransaction } from "../../models/walletTransaction.model";
import { RankPlan } from "../../models/rankPlan.model";
import { getActivePaidSubscribers } from "../rankBonus/activeSubscribers";
import { getRateTable } from "../../fx/fxService";
import {
  NcStatus, TreeMember, EarnSplit, memberStatus, legHeadOf, netMinor, minorToUsd,
  monthStart, upEarnings, addSplits, emptySplit,
} from "./pure";

export class GenealogyError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

const oid = (s: string) => new Types.ObjectId(s);

/** Effective view root: the caller, or a member of the caller's downline. */
export async function resolveRoot(callerId: string, rootParam?: string) {
  const rootId = rootParam && rootParam !== "me" ? rootParam : callerId;
  if (!Types.ObjectId.isValid(rootId)) throw new GenealogyError(400, "INVALID_ROOT");
  const rootOid = oid(rootId);
  const filter =
    rootId === callerId ? { _id: rootOid } : { _id: rootOid, ancestors: oid(callerId) };
  const root = await User.findOne(filter).select("_id depth").lean();
  if (!root) {
    throw rootId === callerId
      ? new GenealogyError(404, "USER_NOT_FOUND")
      : new GenealogyError(403, "NOT_YOUR_DOWNLINE");
  }
  return { rootId, rootOid, depth: (root as any).depth ?? 0 };
}

/** `memberId` must be the root or inside its subtree; 404 otherwise (no leak). */
export async function assertUnder(rootOid: Types.ObjectId, memberId: string) {
  if (!Types.ObjectId.isValid(memberId)) throw new GenealogyError(400, "INVALID_MEMBER");
  const mOid = oid(memberId);
  if (mOid.equals(rootOid)) return mOid;
  const ok = await User.exists({ _id: mOid, ancestors: rootOid });
  if (!ok) throw new GenealogyError(404, "MEMBER_NOT_FOUND");
  return mOid;
}

// ── NC subscription + UP qualification ──────────────────────────────────────

let clientMemo: { id: Types.ObjectId | null; at: number } | null = null;
async function ncClientId(): Promise<Types.ObjectId | null> {
  if (clientMemo && Date.now() - clientMemo.at < 10 * 60_000) return clientMemo.id;
  const plan = await RankPlan.findOne({ isActive: true }).select("thirdPartyClientId").lean();
  clientMemo = { id: (plan as any)?.thirdPartyClientId ?? null, at: Date.now() };
  return clientMemo.id;
}

let activeMemo: { set: Set<string>; at: number } | null = null;
async function activeSubscribers(): Promise<Set<string>> {
  if (activeMemo && Date.now() - activeMemo.at < 60_000) return activeMemo.set;
  const client = await ncClientId();
  const set = client ? (await getActivePaidSubscribers(client)).active : new Set<string>();
  activeMemo = { set, at: Date.now() };
  return set;
}

/** active = paid NC subscriber now; hasChain = owns any NC chain root;
 *  qualified = active UnilevelPlusPurchase. `ids` omitted = platform-wide. */
export async function statusSets(ids?: Types.ObjectId[]) {
  const client = await ncClientId();
  const scope = ids ? { userId: { $in: ids } } : {};
  const [active, chainUsers, upUsers] = await Promise.all([
    activeSubscribers(),
    client
      ? Invoice.distinct("userId", {
          ...scope,
          "lineItems.itemType": "third_party_subscription",
          thirdPartyClientId: client,
          parentInvoiceId: { $exists: false },
          // A pending/unpaid chain root is not "ever subscribed" — without this
          // an abandoned checkout would read as lapsed instead of never.
          status: "paid",
          // A top-up-only "chain root" isn't a real subscription — without
          // this a top-up member would read as lapsed instead of never.
          "metadata.kind": { $ne: "topup" },
        })
      : Promise.resolve([]),
    UnilevelPlusPurchase.distinct("userId", { ...scope, status: "active" }),
  ]);
  return {
    active,
    hasChain: new Set((chainUsers as unknown[]).map(String)),
    qualified: new Set((upUsers as unknown[]).map(String)),
  };
}

export function ncOf(id: string, s: { active: Set<string>; hasChain: Set<string> }): NcStatus {
  if (s.active.has(id)) return "active";
  return s.hasChain.has(id) ? "lapsed" : "never";
}

// ── Volume (USD, ex-GST) ────────────────────────────────────────────────────

/** Paid-invoice volume per user in [from, to). `ids` omitted = platform-wide. */
export async function volumeUsdByUser(from: Date, to: Date, ids?: Types.ObjectId[]) {
  const [rows, table] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          ...(ids ? { userId: { $in: ids } } : {}),
          status: "paid",
          // Wallet top-ups aren't products or volume — a member who tops up
          // and then spends from the wallet would otherwise count twice.
          "lineItems.itemType": { $nin: ["store_wallet_topup", "auction_wallet_topup"] },
          "metadata.kind": { $ne: "topup" },
        },
      },
      { $addFields: { _at: { $ifNull: ["$paidAt", "$createdAt"] } } },
      { $match: { _at: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: { u: "$userId", c: "$paymentCurrency" },
          total: { $sum: "$totalAmount" },
          tax: { $sum: { $ifNull: ["$tax", 0] } },
          ship: { $sum: { $ifNull: ["$shippingCost", 0] } },
        },
      },
    ]),
    getRateTable("USD"),
  ]);
  const out = new Map<string, number>();
  for (const r of rows as any[]) {
    const usd = minorToUsd(
      netMinor({ totalAmount: r.total, tax: r.tax, shippingCost: r.ship }),
      r._id.c,
      table.rates,
    );
    const k = String(r._id.u);
    out.set(k, Math.round(((out.get(k) || 0) + usd) * 100) / 100);
  }
  return out;
}

// ── Whole-subtree memo ──────────────────────────────────────────────────────

const TREE_TTL_MS = 60_000;
const TREE_MEMO_MAX = 200;
const treeMemo = new Map<string, { at: number; value: Promise<any> }>();

/** The root plus every descendant, with status, leg, level and this month's
 *  volume attached. Memoized per root for 60 s, bounded to the most recent
 *  200 roots (oldest evicted first) so it can't grow without bound.
 *  ponytail: loads the whole subtree into memory; fine to tens of thousands
 *  of members, move to per-query aggregation if a single network outgrows that. */
export function loadTree(rootOid: Types.ObjectId): Promise<{
  root: TreeMember;
  members: TreeMember[];
  byId: Map<string, TreeMember>;
}> {
  const key = String(rootOid);
  const hit = treeMemo.get(key);
  if (hit && Date.now() - hit.at < TREE_TTL_MS) return hit.value;

  const value = buildTree(rootOid);
  // Only evict the entry that is still THIS promise — a later call may have
  // already replaced it with a fresh build, and that one must survive.
  value.catch(() => {
    if (treeMemo.get(key)?.value === value) treeMemo.delete(key);
  });

  const now = Date.now();
  for (const [k, v] of treeMemo) {
    if (now - v.at >= TREE_TTL_MS) treeMemo.delete(k);
  }
  while (treeMemo.size >= TREE_MEMO_MAX) {
    const oldestKey = treeMemo.keys().next().value;
    if (oldestKey === undefined) break;
    treeMemo.delete(oldestKey);
  }
  treeMemo.set(key, { at: now, value });
  return value;
}

async function buildTree(rootOid: Types.ObjectId) {
  const rootId = String(rootOid);
  const SELECT =
    "_id referredBy name affiliateId profilePicture depth ancestors createdAt ncRank directsCount downlineCount";
  const [rootDoc, docs] = await Promise.all([
    User.findById(rootOid).select(SELECT).lean(),
    User.find({ ancestors: rootOid }).select(SELECT).lean(),
  ]);
  if (!rootDoc) throw new GenealogyError(404, "USER_NOT_FOUND");
  const all = [rootDoc, ...(docs as any[])] as any[];
  const ids = all.map((d) => d._id as Types.ObjectId);
  const now = new Date();
  const [sets, vol] = await Promise.all([
    statusSets(ids),
    volumeUsdByUser(monthStart(now), now, ids),
  ]);
  const rootDepth = (rootDoc as any).depth ?? 0;
  const toMember = (d: any): TreeMember => {
    const id = String(d._id);
    const nc = ncOf(id, sets);
    const qualified = sets.qualified.has(id);
    return {
      id,
      parentId:
        id === rootId
          ? null
          : d.ancestors?.length
            ? String(d.ancestors[d.ancestors.length - 1])
            : d.referredBy
              ? String(d.referredBy)
              : null,
      name: d.name || "Unknown",
      handle: d.affiliateId || null,
      avatar: d.profilePicture || "",
      depth: d.depth ?? 0,
      level: (d.depth ?? 0) - rootDepth,
      legHead: id === rootId ? null : legHeadOf(d.ancestors, rootId, id),
      joinedAt: d.createdAt ?? null,
      rank: d.ncRank?.current ?? null,
      directs: d.directsCount ?? 0,
      teamSize: d.downlineCount ?? 0,
      nc,
      qualified,
      status: memberStatus(nc, qualified),
      volumeUsd: vol.get(id) || 0,
    };
  };
  const members = all.map(toMember);
  return { root: members[0], members, byId: new Map(members.map((x) => [x.id, x])) };
}

// ── Earnings: what `me` earned from `member` ────────────────────────────────

export async function earningsFromMember(me: Types.ObjectId, member: Types.ObjectId) {
  const meId = String(me);
  const since = monthStart(new Date());
  const [up, comb, nc, table] = await Promise.all([
    UnilevelPlusDistribution.find({
      buyerId: member,
      status: "completed",
      $or: [
        { directBonusRecipientId: me },
        { "levelBonusRecipients.userId": me },
        { "infinityTier1Recipients.userId": me },
        { "infinityTier2Recipients.userId": me },
      ],
    })
      .select(
        "createdAt directBonusRecipientId directBonusAmount directBonusCreditedAmount levelBonusRecipients infinityTier1Recipients infinityTier2Recipients",
      )
      .lean(),
    CommissionDistribution.find({ customerId: member, status: "completed", "commissions.userId": me })
      .select("createdAt currency commissions")
      .lean(),
    WalletTransaction.find({
      userId: me,
      relatedUserId: member,
      walletType: "affiliate",
      "metadata.bonusType": "networkchain_direct",
    })
      .select("createdAt amount")
      .lean(),
    getRateTable("USD"),
  ]);

  // comb-plan commissions can be halved by the NC coverage split at credit
  // time (creditAffiliateOrPlatform); the distribution row keeps the original
  // plan amount, so the actual credited amount has to come from the wallet
  // transaction it posted, falling back to the plan amount when there isn't one.
  const myTxIds = new Set<string>();
  for (const d of comb as any[]) {
    for (const c of d.commissions || []) {
      if (String(c.userId) === meId && c.transactionId) myTxIds.add(String(c.transactionId));
    }
  }
  const txRows = myTxIds.size
    ? await WalletTransaction.find({ _id: { $in: [...myTxIds].map(oid) } })
        .select("_id amount")
        .lean()
    : [];
  const txAmountById = new Map((txRows as any[]).map((t) => [String(t._id), t.amount]));

  const split = (rowsSince: (at: Date) => boolean): EarnSplit => {
    const upPart = upEarnings(meId, (up as any[]).filter((r) => rowsSince(r.createdAt)));
    let direct = 0;
    let level = 0;
    for (const d of comb as any[]) {
      if (!rowsSince(d.createdAt)) continue;
      for (const c of d.commissions || []) {
        if (String(c.userId) !== meId) continue;
        const txId = c.transactionId ? String(c.transactionId) : null;
        const amount = (txId && txAmountById.has(txId)) ? txAmountById.get(txId)! : (c.amount || 0);
        // amount is WHOLE units in the distribution's currency.
        const usd = minorToUsd(Math.round(amount * 100), d.currency, table.rates);
        if (c.level <= 1) direct += usd;
        else level += usd;
      }
    }
    for (const t of nc as any[]) if (rowsSince(t.createdAt)) direct += t.amount || 0;
    return addSplits(upPart, { direct, level, infinity: 0, total: 0 });
  };
  return {
    thisMonth: split((at) => !!at && new Date(at) >= since),
    lifetime: split(() => true),
  };
}

// ── Member detail helpers ───────────────────────────────────────────────────

/** Latest nextDueDate across the member's NC chain (null when none). */
export async function ncRenewalDate(userId: Types.ObjectId): Promise<Date | null> {
  const client = await ncClientId();
  if (!client) return null;
  const roots = await Invoice.find({
    "lineItems.itemType": "third_party_subscription",
    thirdPartyClientId: client,
    userId,
    parentInvoiceId: { $exists: false },
    cancelledAt: { $in: [null, undefined] },
  })
    .select("_id")
    .lean();
  if (!roots.length) return null;
  const rootIds = roots.map((r) => r._id);
  const last = await Invoice.findOne({
    $or: [{ _id: { $in: rootIds } }, { parentInvoiceId: { $in: rootIds } }],
    status: "paid",
    cancelledAt: { $in: [null, undefined] },
    nextDueDate: { $ne: null },
  })
    .sort({ nextDueDate: -1 })
    .select("nextDueDate")
    .lean();
  return (last as any)?.nextDueDate ?? null;
}

/** Distinct paid products, newest first; amount is the latest ex-GST USD price. */
export async function productsBought(userId: Types.ObjectId) {
  const [invoices, table] = await Promise.all([
    Invoice.find({
      userId,
      status: "paid",
      // Wallet top-ups aren't products.
      "lineItems.itemType": { $nin: ["store_wallet_topup", "auction_wallet_topup"] },
      "metadata.kind": { $ne: "topup" },
    })
      .sort({ paidAt: 1, createdAt: 1 })
      .select("paidAt createdAt isRecurring paymentCurrency lineItems.itemName lineItems.itemType lineItems.totalPrice lineItems.originalCurrency")
      .lean(),
    getRateTable("USD"),
  ]);
  const byName = new Map<string, { name: string; itemType: string; amountUsd: number; recurring: boolean; firstPaidAt: Date | null }>();
  for (const inv of invoices as any[]) {
    const at = inv.paidAt ?? inv.createdAt ?? null;
    for (const li of inv.lineItems || []) {
      const name = li.itemName || li.itemType;
      const prev = byName.get(name);
      // Price the LINE, not the invoice — a multi-line invoice's total isn't
      // this item's price. A $0 line (free month, bundle-prepaid cycle) never
      // overwrites a real price already on file.
      const usd = minorToUsd(li.totalPrice || 0, li.originalCurrency || inv.paymentCurrency, table.rates);
      byName.set(name, {
        name,
        itemType: li.itemType,
        amountUsd: usd > 0 ? usd : (prev?.amountUsd ?? 0),
        recurring: !!inv.isRecurring || !!prev?.recurring,
        firstPaidAt: prev?.firstPaidAt ?? at,
      });
    }
  }
  return [...byName.values()].sort(
    (a, b) => new Date(b.firstPaidAt || 0).getTime() - new Date(a.firstPaidAt || 0).getTime(),
  );
}

/** Directs covered by a paid NC invoice right now but not active (free month
 *  only) — they count once they pay. */
export async function pendingDirects(directIds: Types.ObjectId[]): Promise<number> {
  if (!directIds.length) return 0;
  const client = await ncClientId();
  if (!client) return 0;
  const [active, covered, notCancelled] = await Promise.all([
    activeSubscribers(),
    Invoice.distinct("userId", {
      userId: { $in: directIds },
      "lineItems.itemType": "third_party_subscription",
      thirdPartyClientId: client,
      status: "paid",
      cancelledAt: { $in: [null, undefined] },
      nextDueDate: { $gt: new Date() },
    }),
    // A covering invoice can itself be un-cancelled while the chain root that
    // owns it was cancelled and replaced — require a live, non-cancelled root too.
    Invoice.distinct("userId", {
      userId: { $in: directIds },
      "lineItems.itemType": "third_party_subscription",
      thirdPartyClientId: client,
      parentInvoiceId: { $exists: false },
      cancelledAt: { $in: [null, undefined] },
    }),
  ]);
  const notCancelledSet = new Set((notCancelled as unknown[]).map(String));
  return (covered as unknown[])
    .map(String)
    .filter((id) => !active.has(id) && notCancelledSet.has(id)).length;
}

export { emptySplit };
