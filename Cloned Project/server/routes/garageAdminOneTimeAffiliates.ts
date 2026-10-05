import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import { ReserveLicense } from "../models/reserveLicense.model";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { IgniteCallModel } from "../models/igniteCall.model";
import {
  newestLiveCall,
  enrichStatuses,
  applyManualCompletion,
} from "../services/igniteCall.service";
import { ncScheduleStatuses } from "../lib/ncMeetClient";

import { Organization } from "../models/organization.model";

/**
 * GET /garage-admin/one-time-affiliates
 *
 * Powers Shorupan's "Citizens → One Time Affiliates" table (Figma frame
 * 77:3). One row per user who has paid at least once for a $25 Unilevel
 * Plus license, WHETHER OR NOT they've since become an active NetworkChain
 * subscriber — the whole point of this page is to see everyone who owns a
 * license, regardless of their subscription state.
 *
 * Columns mirror the Figma spec 1:1:
 *   Name · Upline Details · Location · Joining Date (+ first office) ·
 *   Activation Date (+ invoice #) · Reserves · Assigned · Directs ·
 *   Downline · Commercials · NetworkChain Subscriber
 *
 * Bottom-bar stats: Affiliates · Total Licenses · Active Licenses ·
 * Reserved Licenses · Total Revenue.
 *
 * Reuses the aggregation logic in `getAllUnilevelPlusLicenseHolders`
 * (controllers/garageAdmin.controller.ts) but keeps the payload lean for
 * the table view and adds pagination + a stats block.
 */
const router = Router();

router.get(
  "/one-time-affiliates",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

      const sortBy = String(req.query.sortBy || "");
      const sortOrder =
        String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

      // ── Filter drawer query layer ────────────────────────────────────────
      // This is the SAME endpoint the table already uses — the filters below
      // are an extra narrowing pass applied to the rows this route already
      // builds, not a separate search endpoint. Every param is optional and
      // an absent/blank/"all" value means "don't narrow on this field".
      //
      //   ?isSubscriber=yes|no|all           (alias: isNetworkChainSubscriber)
      //   ?activatedFrom=YYYY-MM-DD&activatedTo=YYYY-MM-DD
      //   ?joiningFrom=YYYY-MM-DD&joiningTo=YYYY-MM-DD
      //   ?reservesRange=0-0|1-5|6-10|11-20|21-50|51-Infinity
      //     (or ?reservesMin=&reservesMax= for an arbitrary range)
      //   ?assignedRange=…  /  ?assignedMin=&assignedMax=
      //   ?directsRange=…   /  ?directsMin=&directsMax=
      //   ?country=<case-insensitive substring>
      //   ?state=<case-insensitive substring>&city=<case-insensitive substring>
      const subscriberFilter = normalizeTriState(
        req.query.isSubscriber ?? req.query.isNetworkChainSubscriber
      );
      const activatedFrom = dayBound(req.query.activatedFrom, "start");
      const activatedTo = dayBound(req.query.activatedTo, "end");
      const joiningFrom = dayBound(req.query.joiningFrom, "start");
      const joiningTo = dayBound(req.query.joiningTo, "end");
      const reservesRange = parseRange(
        req.query.reservesRange,
        req.query.reservesMin,
        req.query.reservesMax
      );
      const assignedRange = parseRange(
        req.query.assignedRange,
        req.query.assignedMin,
        req.query.assignedMax
      );
      const directsRange = parseRange(
        req.query.directsRange,
        req.query.directsMin,
        req.query.directsMax
      );
      // Hierarchical location filter — country ▸ state/territory ▸ city.
      // Each level narrows independently, so ?state=karnataka alone works
      // without also passing a country. Both sides of the comparison go
      // through normalizeLoc, so casing and the stray whitespace in the
      // stored data ("India " vs "India") can't cause a miss.
      const countryFilter = normalizeLoc(req.query.country);
      const stateFilter = normalizeLoc(req.query.state);
      const cityFilter = normalizeLoc(req.query.city);

      // Header search (?q=) — match the affiliate person by name / email /
      // phone. Each row is keyed by the buyer's userId (purchaseAgg._id), so
      // resolve matching user ids first and narrow purchaseAgg to those below;
      // everything downstream (holderIds, stats, rows, total) narrows with it.
      const q = String(req.query.q || "").trim();
      let searchUserIds: Set<string> | null = null;
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const matches = await User.find(
          { $or: [{ name: re }, { email: re }, { phone: re }] },
          { _id: 1 }
        ).lean();
        searchUserIds = new Set(matches.map((u) => String(u._id)));
      }

      // Open View / "view as" (?rootUserId=, alias ?uplineUserId=) — narrow
      // the list to a specific user's DOWNLINE (their referral sub-tree), so
      // the admin can see the affiliates table from that person's
      // perspective. `ancestors` is the materialized, indexed upline path, so
      // everyone who has rootUserId in their ancestors is somewhere in that
      // user's downline. Combines with ?q= (both narrow purchaseAgg below).
      // The filter drawer's "Downline / Sponsor" field sends the same id.
      const rootUserId = String(
        req.query.rootUserId || req.query.uplineUserId || ""
      ).trim();
      // Tree scope for the ?rootUserId= filter:
      //   • treeScope=directs (default) → root + immediate level-1 referrals
      //   • treeScope=full → root + every generation beneath (full tree)
      // Legacy `?includeDownlineMembers=1` is accepted as an alias for
      // `full` so old bookmarked URLs keep working.
      const treeScopeParam = String(
        req.query.treeScope ?? "",
      ).trim().toLowerCase();
      const legacyFullFlag = ["1", "true", "yes"].includes(
        String(req.query.includeDownlineMembers ?? "").toLowerCase(),
      );
      const treeScope: "directs" | "full" =
        treeScopeParam === "full" || legacyFullFlag ? "full" : "directs";

      let rootDownlineIds: Set<string> | null = null;
      if (rootUserId && !Types.ObjectId.isValid(rootUserId)) {
        // A malformed id means "nobody", not "everybody" — falling through
        // would silently hand back the unscoped table.
        rootDownlineIds = new Set<string>();
      } else if (rootUserId) {
        const rootOid = new Types.ObjectId(rootUserId);
        // Strictly the people BENEATH the root — never the root themselves.
        // "Downline of X" is X's organisation, and X is not in their own
        // organisation; listing them at the top of their own downline was
        // read as a wrong row, not a convenience. (It used to be included so
        // an empty downline still rendered something; an empty downline now
        // renders an empty table, which is the truthful answer.)
        //
        // `full` scope: match on `ancestors` (materialized upline path,
        //   covers every generation) OR `referredBy` (belt-and-braces for
        //   legacy rows whose path never got synced).
        // `directs` scope: only `referredBy` — that's the level-1 gate.
        const descendantsQuery: any =
          treeScope === "full"
            ? { $or: [{ ancestors: rootOid }, { referredBy: rootOid }] }
            : { referredBy: rootOid };
        const descendants = await User.find(descendantsQuery, {
          _id: 1,
        }).lean();
        rootDownlineIds = new Set(descendants.map((u) => String(u._id)));
      }

      // Exception to the downline scope (?excludeUserId=) — "everyone under
      // Anurag, but NOT the people Shorupan brought in".
      //
      // Removes the named person's DOWNLINE — every generation beneath them
      // — but keeps the person: they are still one of the root's people and
      // belong in the root's list; it is what they recruited that is being
      // set aside. (It used to remove the person too, which read as them
      // vanishing from a list they should be on.)
      //
      // Only meaningful alongside a root: on its own it would be "everyone
      // except this leg", which the drawer does not offer, so it is ignored
      // when no root is set rather than silently changing the unscoped table.
      // Several legs can be excluded at once. Accepts a repeated param
      // (?excludeUserId=a&excludeUserId=b) or a comma-separated list, so the
      // single-value links that shipped first keep working unchanged.
      const excludeRaw = req.query.excludeUserId;
      const excludeIds = (
        Array.isArray(excludeRaw)
          ? excludeRaw.map((v) => String(v))
          : String(excludeRaw || "").split(",")
      )
        .map((s) => s.trim())
        // A malformed id excludes nobody rather than emptying or widening the
        // table: silently dropping it keeps the other, valid legs working.
        .filter((s) => s && Types.ObjectId.isValid(s))
        .map((s) => new Types.ObjectId(s));

      if (rootDownlineIds && excludeIds.length) {
        // One query for every excluded leg — every generation beneath each
        // named person. The person themselves is deliberately not matched.
        const excluded = await User.find(
          {
            $or: [
              { ancestors: { $in: excludeIds } },
              { referredBy: { $in: excludeIds } },
            ],
          },
          { _id: 1 },
        ).lean();
        for (const u of excluded) rootDownlineIds.delete(String(u._id));
      }

      // Anyone with at least one active Unilevel Plus license = affiliate.
      let purchaseAgg = await UnilevelPlusPurchase.aggregate<{
        _id: any;
        licensesPurchased: number;
        totalSpent: number;
        currency: string;
        firstPurchasedAt: Date;
      }>([
        { $match: { status: "active" } },
        {
          $group: {
            _id: "$userId",
            licensesPurchased: { $sum: 1 },
            totalSpent: { $sum: "$amount" },
            currency: { $first: "$currency" },
            firstPurchasedAt: { $min: "$purchasedAt" },
          },
        },
        // $group emits groups in hash order, which is NOT stable between
        // runs — without this the page-1 slice could differ on every
        // reload. Rows get a full deterministic sort below too; this just
        // pins the input order so nothing upstream is left to chance.
        { $sort: { _id: 1 } },
      ]);

      // Narrow to the searched affiliates before any further work.
      if (searchUserIds) {
        purchaseAgg = purchaseAgg.filter((p) =>
          searchUserIds!.has(String(p._id))
        );
      }
      // ...and to the Open View root's downline, when viewing-as.
      if (rootDownlineIds) {
        purchaseAgg = purchaseAgg.filter((p) =>
          rootDownlineIds!.has(String(p._id))
        );
      }

      // This table is LICENCE HOLDERS ONLY, scoped or not. A downline /
      // sponsor filter narrows the same population the unfiltered table
      // shows; it must not switch to a different one.
      //
      // It used to: whenever a root was set, every person in that tree got a
      // row whether or not they held a licence (`isOneTimeAffiliate: false`),
      // because "Downline of X" once showed 8 of an 89-person tree and that
      // read as broken. The result was that the same page listed only
      // licensed users until any downline filter was applied, and then
      // listed unlicensed ones too — which is what actually read as broken
      // (Sep 2026). Whole-tree browsing, licensed or not, is the NetworkChain
      // downline table's job, not this page's.
      //
      // Two flags, both from the same week:
      //   ?includeUnlicensed=1 — explicit opt-in to the old mixed rows. No
      //     caller sends it; the unscoped path is untouched either way.
      //   ?paidOnly=1 — the "Paid only" switch on the page, added when the
      //     mixed list was still the default so a downline could be shown as
      //     "who has paid". It still works, and it always wins: it can only
      //     ever narrow, never widen.
      const includeUnlicensed = ["1", "true", "yes"].includes(
        String(req.query.includeUnlicensed ?? "").toLowerCase(),
      );
      const paidOnly = ["1", "true", "yes"].includes(
        String(req.query.paidOnly ?? "").toLowerCase(),
      );
      const includeMembers = !!rootDownlineIds && includeUnlicensed && !paidOnly;

      // Every scoped id is a member-row candidate — including ids that ARE
      // in purchaseAgg. A user whose only purchases are `assigned_…` rows
      // gets dropped from the buyer rows below (they never paid $25), and
      // if we excluded all of purchaseAgg here they'd vanish from the tree
      // entirely. Which id actually gets a member row is decided after the
      // buyer rows exist, from what's really in `rows`.
      const memberCandidateIds: string[] = includeMembers
        ? [...rootDownlineIds!].sort() // deterministic, like purchaseAgg's $sort
        : [];

      // Track per-user "real spend" (excludes assigned licenses — those
      // users didn't actually pay for their seat) + reserve spend. Same
      // approach as getAllUnilevelPlusLicenseHolders in the legacy
      // controller so both pages agree on the total-revenue number.
      const realPurchaseSpendByUser = new Map<string, number>();
      const reserveSpendByUser = new Map<string, number>();

      if (purchaseAgg.length === 0 && memberCandidateIds.length === 0) {
        return res.json({
          data: [],
          stats: emptyStats(),
          locations: [],
          pagination: { total: 0, limit, offset },
        });
      }

      // Everyone who gets a row. The per-user aggregations below all key
      // off this, so non-buyer rows get accurate reserves/directs/downline
      // rather than zeros.
      const purchaserIdSet = new Set(purchaseAgg.map((p) => String(p._id)));
      const holderIds = [
        ...purchaseAgg.map((p) => p._id),
        ...memberCandidateIds
          .filter((id) => !purchaserIdSet.has(id))
          .map((id) => new Types.ObjectId(id)),
      ];

      // Individual purchase docs — track REAL purchase spend (exclude
      // assignments where paymentId starts with "assigned_", those users
      // didn't pay for their seat).
      const purchaseDocs = await UnilevelPlusPurchase.find(
        { userId: { $in: holderIds }, status: "active" },
        { userId: 1, amount: 1, paymentId: 1 }
      ).lean();
      for (const doc of purchaseDocs) {
        if ((doc.paymentId || "").startsWith("assigned_")) continue;
        const key = String(doc.userId);
        realPurchaseSpendByUser.set(
          key,
          (realPurchaseSpendByUser.get(key) || 0) + (doc.amount || 0)
        );
      }

      // Reserves aggregate (by status) — powers Reserves + Assigned columns.
      const reserveAgg = await ReserveLicense.aggregate<{
        _id: { userId: any; status: string };
        count: number;
      }>([
        { $match: { userId: { $in: holderIds } } },
        {
          $group: {
            _id: { userId: "$userId", status: "$status" },
            count: { $sum: 1 },
          },
        },
      ]);

      // Individual reserve docs — track reserve spend per user.
      const reserveDocs = await ReserveLicense.find(
        { userId: { $in: holderIds } },
        { userId: 1, amount: 1 }
      ).lean();
      for (const doc of reserveDocs) {
        const key = String(doc.userId);
        reserveSpendByUser.set(
          key,
          (reserveSpendByUser.get(key) || 0) + (doc.amount || 0)
        );
      }
      const reserveByUser = new Map<
        string,
        { available: number; assigned: number; expired: number }
      >();
      for (const row of reserveAgg) {
        const key = String(row._id.userId);
        const entry = reserveByUser.get(key) || {
          available: 0,
          assigned: 0,
          expired: 0,
        };
        if (row._id.status === "available") entry.available = row.count;
        else if (row._id.status === "assigned") entry.assigned = row.count;
        else if (row._id.status === "expired") entry.expired = row.count;
        reserveByUser.set(key, entry);
      }

      // Directs per holder (users referred by them).
      const directsAgg = await User.aggregate<{
        _id: any;
        totalDirects: number;
      }>([
        { $match: { referredBy: { $in: holderIds } } },
        {
          $group: {
            _id: "$referredBy",
            totalDirects: { $sum: 1 },
          },
        },
      ]);
      const directsByHolder = new Map<string, number>();
      for (const row of directsAgg) {
        directsByHolder.set(String(row._id), row.totalDirects);
      }

      // Downline per holder — the WHOLE sub-tree, direct + indirect, not
      // just the people they personally referred. `ancestors` is the
      // materialized upline path, so a user carries every ancestor above
      // them; counting docs per ancestor gives each holder their full
      // recursive downline in one pass. Same source the NetworkChain
      // downline table reads (routes/downlineTable.ts), so the two agree.
      //
      // This column used to ship a hardcoded 0 — next to an accurate
      // Directs count that made the table look like it only ever knew
      // about direct referrals.
      const downlineAgg = await User.aggregate<{ _id: any; total: number }>([
        { $match: { ancestors: { $in: holderIds } } },
        { $unwind: "$ancestors" },
        // Re-match after unwind: a descendant carries ancestors we don't
        // care about too, and each must only count toward holders.
        { $match: { ancestors: { $in: holderIds } } },
        { $group: { _id: "$ancestors", total: { $sum: 1 } } },
      ]);
      const downlineByHolder = new Map<string, number>();
      for (const row of downlineAgg) {
        downlineByHolder.set(String(row._id), row.total);
      }

      // ── NVC chat ───────────────────────────────────────────────────────
      //
      // MARKED BY HAND, not derived. The NVC chat happens off-platform, so
      // there is no message record to compute from — an admin ticks it once
      // the chat exists ("where can i mark that his NVC chat has been
      // created"). Stored on the User as nvcChatCreatedAt, so it travels with
      // the person the same way the support-agent assignment does.
      //
      // This previously tried to infer the answer from message history. That
      // could only ever be a guess about a conversation the platform never
      // sees, and it silently disagreed with what the admin actually knew.
      // Users (with populated upline).
      const users = await User.find({ _id: { $in: holderIds } })
        .populate("organizations.organization", "name icon")
        .populate("referredBy", "name email phone profilePicture country")
        .select(
          "name email phone profilePicture organizations createdAt country city state referredBy downlineCount directsCount assignedSupportAgentId assignedSupportAgentAt nvcChatCreatedAt"
        )
        .lean();
      const usersById = new Map<string, any>();
      for (const u of users) usersById.set(String(u._id), u);

      // Support agents assigned to these affiliates. The assignment lives on
      // the USER (assignedSupportAgentId), not on any list-specific document,
      // so it is inherently shared with the NetworkChain Subs table — assign
      // in either place and both reflect it. One batch lookup, same shape the
      // NC Subs and Companies tables use.
      const agentIds = new Set<string>();
      for (const u of users) {
        if ((u as any).assignedSupportAgentId)
          agentIds.add(String((u as any).assignedSupportAgentId));
      }

      // ── Ignite call ────────────────────────────────────────────────────────
      // The link is ours; the live status belongs to NetworkChains. Both are
      // batched for the page, and the status lookup is fail-soft: if
      // NetworkChains is unreachable the column falls back to the stored
      // snapshot rather than failing the whole table.
      //
      // This must run BEFORE agentDocs/agentsById are resolved below — it
      // folds Ignite-call admins into the same agentIds set the Assigned To
      // column already builds, so agentsById.get(ignite.adminId) resolves.
      const affiliateIds = users.map((u: any) => String(u._id));
      const igniteCalls = await IgniteCallModel.find({
        userId: { $in: affiliateIds },
        detachedAt: null,
      })
        .sort({ scheduledAt: -1 })
        .lean();

      const callsByUser = new Map<string, any[]>();
      for (const c of igniteCalls) {
        const key = String(c.userId);
        const list = callsByUser.get(key);
        if (list) list.push(c);
        else callsByUser.set(key, [c]);
      }

      const liveByUser = new Map<string, any>();
      for (const [uid, list] of callsByUser) {
        const live = newestLiveCall(list);
        if (live) liveByUser.set(uid, live);
      }

      const statusById = await enrichStatuses(
        [...liveByUser.values()].map((c) => c.ncScheduleId),
        async (batch) => (await ncScheduleStatuses(batch)).statuses,
      );

      // Ignite-call agents also need a name — fold them into the same lookup
      // the Assigned To column already builds.
      for (const c of liveByUser.values()) agentIds.add(String(c.adminId));

      const agentDocs = agentIds.size
        ? await GarageAdminModel.find({
            _id: { $in: [...agentIds].map((id) => new Types.ObjectId(id)) },
          })
            .select("name email profilePicture role")
            .lean()
        : [];
      const agentsById = new Map(agentDocs.map((a) => [String(a._id), a]));

      // Paid Unilevel-Plus invoices — powers Activation Date (invoice #) +
      // Commercials column.
      const paidInvoices = await Invoice.find(
        {
          userId: { $in: holderIds },
          status: "paid",
          "lineItems.itemType": "unilevel_plus",
        },
        {
          userId: 1,
          invoiceNumber: 1,
          totalAmount: 1,
          itemCurrency: 1,
          paymentCurrency: 1,
          paymentMethodCategory: 1,
          paymentPlatform: 1,
          paymentMode: 1,
          metadata: 1,
          paidAt: 1,
        }
      )
        .sort({ paidAt: 1 })
        .lean();
      const invoicesByUser = new Map<string, any[]>();
      const walletOrgIds = new Set<string>();
      for (const inv of paidInvoices) {
        const key = String(inv.userId);
        const arr = invoicesByUser.get(key) || [];
        arr.push(inv);
        invoicesByUser.set(key, arr);
        const oId = inv.metadata?.walletOrgId || inv.organizationId;
        if (oId) walletOrgIds.add(String(oId));
      }

      // Resolve store/org names for store_wallet payments
      const walletOrgs = walletOrgIds.size > 0
        ? await Organization.find(
            { _id: { $in: Array.from(walletOrgIds) } },
            { name: 1, icon: 1 }
          ).lean()
        : [];
      const orgNameById = new Map<string, string>();
      for (const o of walletOrgs) {
        if (o.name) orgNameById.set(String(o._id), o.name);
      }

      // NetworkChain-subscriber flag — any parent recurring third-party
      // subscription invoice that isn't cancelled = "Yes".
      const ncSubHolders = await Invoice.find(
        {
          userId: { $in: holderIds },
          isRecurring: true,
          parentInvoiceId: { $exists: false },
          "lineItems.itemType": "third_party_subscription",
          cancelledAt: { $exists: false },
          $or: [
            { "metadata.kind": { $exists: false } },
            { "metadata.kind": { $ne: "topup" } },
          ],
        },
        { userId: 1 }
      ).lean();
      const ncSubscribers = new Set(
        ncSubHolders.map((i: any) => String(i.userId))
      );

      // Build the row payload.
      let rows = purchaseAgg
        .map((p) => {
          const userKey = String(p._id);
          const u = usersById.get(userKey);
          if (!u) return null;
          // Assignees ARE listed. They hold a real, active $25 licence — it
          // was handed to them out of someone else's reserve pool instead of
          // bought. This previously dropped them (`if (realSpend <= 0) return
          // null`) under the rule "only $25 purchased people should come";
          // that was reversed deliberately, because a licence holder missing
          // from the licence-holder list reads as data loss.
          //
          // They are still distinguishable, and the money stays honest:
          //   - `licenseSource` says which kind of holder this is
          //   - `totalCommercialsUsd` is their REAL spend, so an assignee
          //     shows $0.00 rather than a phantom $25
          //   - `stats.totalRevenue` sums realPurchaseSpendByUser, which
          //     already skips `assigned_` rows — so listing them cannot
          //     inflate revenue
          const realSpend = realPurchaseSpendByUser.get(userKey) || 0;
          const licenseSource: "purchased" | "assigned" =
            realSpend > 0 ? "purchased" : "assigned";
          const reserve = reserveByUser.get(userKey) || {
            available: 0,
            assigned: 0,
            expired: 0,
          };
          const uplineDoc = u.referredBy as any;
          const invs = invoicesByUser.get(userKey) || [];
          const firstInv = invs[0];
          const firstOrg = (u.organizations || [])
            .map((o: any) => o?.organization)
            .find((org: any) => org && org._id);

          const firstInvOrgId =
            firstInv?.metadata?.walletOrgId || firstInv?.organizationId;
          const storeName = firstInvOrgId
            ? orgNameById.get(String(firstInvOrgId)) || null
            : null;

          const agent = (u as any)?.assignedSupportAgentId
            ? agentsById.get(String((u as any).assignedSupportAgentId))
            : undefined;

          const ignite = liveByUser.get(userKey);
          const igniteAdmin = ignite ? agentsById.get(String(ignite.adminId)) : null;
          const igniteStatus = ignite ? statusById.get(ignite.ncScheduleId) : null;

          return {
            _id: userKey,
            user: userSummary(u),
            upline: userSummary(uplineDoc),
            location: userLocation(u),
            // The affiliate's user id — the Assign/Change action targets this.
            userId: userKey,
            assignedTo: agent
              ? {
                  id: String((agent as any)._id),
                  name: (agent as any).name || null,
                  email: (agent as any).email || null,
                  profilePicture: (agent as any).profilePicture || null,
                  role: (agent as any).role || null,
                  assignedAt: (u as any).assignedSupportAgentAt || null,
                }
              : null,
            joining: {
              date: u.createdAt,
              firstOffice: firstOrg
                ? {
                    id: String(firstOrg._id),
                    name: firstOrg.name || null,
                    icon: firstOrg.icon || null,
                  }
                : null,
            },
            activation: {
              date: p.firstPurchasedAt,
              invoiceNumber: firstInv?.invoiceNumber || null,
              paymentMethod:
                firstInv?.paymentMethodCategory ||
                (licenseSource === "assigned" ? "assigned" : null),
              paymentPlatform:
                firstInv?.paymentPlatform ||
                (licenseSource === "assigned" ? "reserve_pool" : null),
              paymentCurrency:
                firstInv?.paymentCurrency || firstInv?.itemCurrency || null,
              paymentMode: firstInv?.paymentMode || null,
              storeName: storeName || null,
              cryptoCoin:
                firstInv?.metadata?.coin ||
                firstInv?.metadata?.cryptoCoin ||
                null,
              cryptoChain:
                firstInv?.metadata?.chain ||
                firstInv?.metadata?.cryptoChain ||
                null,
            },
            reserves: reserve.available,
            assigned: reserve.assigned,
            directs: directsByHolder.get(userKey) || 0,
            // Full recursive tree beneath this affiliate — direct AND
            // indirect, every generation. Always >= directs.
            //
            // The aggregation over `ancestors` is authoritative; the
            // denormalized User.downlineCount is only a fallback for a
            // holder whose descendants' paths haven't been synced, which
            // would otherwise read 0. Run `npm run backfill:downline-tree`
            // to repair those paths at the source.
            downline:
              downlineByHolder.get(userKey) || (u.downlineCount as number) || 0,
            commercials: invs.map((inv: any) => {
              const invOrgId = inv.metadata?.walletOrgId || inv.organizationId;
              return {
                amount: (inv.totalAmount ?? 0) / 100,
                currency: inv.paymentCurrency || inv.itemCurrency || "USD",
                invoiceNumber: inv.invoiceNumber,
                paidAt: inv.paidAt,
                paymentMethod: inv.paymentMethodCategory || null,
                paymentPlatform: inv.paymentPlatform || null,
                storeName: invOrgId ? orgNameById.get(String(invOrgId)) || null : null,
              };
            }),
            // Authoritative sum of what this user actually paid for
            // UnilevelPlus (base seat + any reserves they bought). Sourced
            // from UnilevelPlusPurchase — the source of truth — so it's
            // always ≥ $25 for anyone in this list. FE should render this
            // number in the "Commercials" column rather than summing the
            // invoice-derived `commercials` array (which can be empty for
            // legacy purchases with no matching unilevel_plus invoice
            // line item).
            totalCommercialsUsd: realSpend,
            currency: p.currency || "USD",
            isNetworkChainSubscriber: ncSubscribers.has(userKey),
            hasNvcChat: !!(u as any)?.nvcChatCreatedAt,
            // How they came by the seat: "purchased" = paid the $25 themselves,
            // "assigned" = received it from someone's reserve pool. Both are
            // licence holders and both are listed; this is what lets the table
            // label them and lets a founder filter one from the other.
            licenseSource,
            // Holds an active $25 licence. True for purchasers AND assignees;
            // the whole-tree member rows appended below are the false ones.
            isOneTimeAffiliate: true,
            igniteCall: ignite
              ? {
                  id: String(ignite._id),
                  adminId: String(ignite.adminId),
                  admin: igniteAdmin
                    ? {
                        name: igniteAdmin.name ?? null,
                        email: igniteAdmin.email ?? null,
                        profilePicture: igniteAdmin.profilePicture ?? null,
                      }
                    : null,
                  ncScheduleId: ignite.ncScheduleId,
                  ncRoomId: ignite.ncRoomId,
                  title: ignite.title,
                  scheduledAt: ignite.scheduledAt,
                  // Fall back to the snapshot when NetworkChains did not
                  // answer: a linked call is at least "scheduled".
                  // A manual "mark as completed" wins over whatever
                // NetworkChains derives — and over the snapshot fallback.
                status: applyManualCompletion(
                  igniteStatus?.status ?? "scheduled",
                  ignite.manuallyCompletedAt,
                ),
                manuallyCompletedAt: ignite.manuallyCompletedAt ?? null,
                  startedAt: igniteStatus?.startedAt ?? null,
                  endedAt: igniteStatus?.endedAt ?? null,
                  historyCount: (callsByUser.get(userKey) ?? []).length,
                }
              : null,
            _sort: {
              licensesPurchased: p.licensesPurchased,
              totalSpent: p.totalSpent,
              firstPurchasedAt: p.firstPurchasedAt,
              directs: directsByHolder.get(userKey) || 0,
            },
          };
        })
        .filter(Boolean) as any[];

      // Whole-tree mode: append a row for every scoped member who ISN'T a
      // buyer, so the recursive organisation is fully enumerable — Punith ▸
      // Jagadeesh ▸ Jagadeesh's downline ▸ theirs ▸ … all the way down.
      //
      // Same row shape as above so the table, sorting, CSV export and the
      // location facets need no special-casing; the money fields are simply
      // empty, and `isOneTimeAffiliate: false` lets the FE mark them.
      if (includeMembers) {
        // Whoever already has a licence-holder row is done; everyone else in
        // the scope gets a member row. Still derived from `rows` rather than
        // purchaseAgg: assignees now get a licence-holder row above, so
        // deriving from `rows` is what stops them being duplicated here.
        const rowedIds = new Set(rows.map((r) => String(r._id)));
        for (const userKey of memberCandidateIds) {
          if (rowedIds.has(userKey)) continue;
          const u = usersById.get(userKey);
          if (!u) continue;
          const reserve = reserveByUser.get(userKey) || {
            available: 0,
            assigned: 0,
            expired: 0,
          };
          const firstOrg = (u.organizations || [])
            .map((o: any) => o?.organization)
            .find((org: any) => org && org._id);

          rows.push({
            _id: userKey,
            user: userSummary(u),
            upline: userSummary(u.referredBy as any),
            location: userLocation(u),
            joining: {
              date: u.createdAt,
              firstOffice: firstOrg
                ? {
                    id: String(firstOrg._id),
                    name: firstOrg.name || null,
                    icon: firstOrg.icon || null,
                  }
                : null,
            },
            // Never activated a $25 licence — null, not a fake date, so the
            // FE renders an em-dash and date filters correctly exclude them.
            activation: {
              date: null,
              invoiceNumber: null,
              paymentMethod: null,
              paymentPlatform: null,
              paymentCurrency: null,
              paymentMode: null,
              storeName: null,
              cryptoCoin: null,
              cryptoChain: null,
            },
            reserves: reserve.available,
            assigned: reserve.assigned,
            directs: directsByHolder.get(userKey) || 0,
            downline:
              downlineByHolder.get(userKey) || (u.downlineCount as number) || 0,
            commercials: [],
            totalCommercialsUsd: 0,
            currency: "USD",
            isNetworkChainSubscriber: ncSubscribers.has(userKey),
            hasNvcChat: !!(u as any)?.nvcChatCreatedAt,
            // No licence at all — neither bought nor assigned. Distinct from
            // an assignee, who holds one they didn't pay for.
            licenseSource: "none" as const,
            isOneTimeAffiliate: false,
            _sort: {
              licensesPurchased: 0,
              totalSpent: 0,
              firstPurchasedAt: null,
              directs: directsByHolder.get(userKey) || 0,
            },
          });
        }
      }

      // Apply the filter-drawer narrowing BEFORE stats are computed, so the
      // bottom-bar totals describe exactly what the table is showing.
      rows = rows.filter((r) => {
        if (subscriberFilter === "yes" && r.isNetworkChainSubscriber !== true)
          return false;
        if (subscriberFilter === "no" && r.isNetworkChainSubscriber !== false)
          return false;

        const activatedAt = timeOf(r.activation?.date);
        if (activatedFrom !== null) {
          if (activatedAt === null || activatedAt < activatedFrom) return false;
        }
        if (activatedTo !== null) {
          if (activatedAt === null || activatedAt > activatedTo) return false;
        }

        const joinedAt = timeOf(r.joining?.date);
        if (joiningFrom !== null) {
          if (joinedAt === null || joinedAt < joiningFrom) return false;
        }
        if (joiningTo !== null) {
          if (joinedAt === null || joinedAt > joiningTo) return false;
        }

        if (!matchesBucket(r.reserves, reservesRange)) return false;
        if (!matchesBucket(r.assigned, assignedRange)) return false;
        if (!matchesBucket(r.directs, directsRange)) return false;

        return true;
      });

      // Location facets for the filter drawer's country ▸ state ▸ city
      // pickers: the distinct triples that actually exist at this scope.
      //
      // The drawer used to make the admin TYPE a state/city, which doesn't
      // work against real data — 23 affiliates are in "Bengaluru" and 1 in
      // "Bangalore", so guessing the spelling returns almost nothing. Serving
      // the real values means every option is guaranteed to match, and the
      // FE can auto-fill a city's state/country from its triple.
      //
      // Computed BEFORE the location filter is applied so selecting a city
      // doesn't collapse the very list it was selected from; it DOES respect
      // ?q=, ?rootUserId= and the other filters, so the options always
      // describe the current scope.
      const locations = buildLocationFacets(rows);

      // Location filter — exact match on the trimmed, case-folded value
      // rather than a substring. Substring silently over-matched: the data
      // holds both "India" and "British Indian Ocean Territory", and
      // "british indian ocean territory".includes("india") is true, so
      // filtering to India swept in the wrong country's affiliates.
      // Trimming still folds the dirty "India " / "United States  " variants
      // onto their clean spellings.
      if (countryFilter || stateFilter || cityFilter) {
        rows = rows.filter((r) => {
          if (countryFilter && normalizeLoc(r.location?.country) !== countryFilter)
            return false;
          if (stateFilter && normalizeLoc(r.location?.state) !== stateFilter)
            return false;
          if (cityFilter && normalizeLoc(r.location?.city) !== cityFilter)
            return false;
          return true;
        });
      }

      // Sort the flattened rows in memory. Column-id → sort key map — every
      // sortable column in the table needs an entry here or clicking its
      // header silently does nothing.
      const SORTABLE: Record<string, string> = {
        name: "name",
        upline: "upline",
        location: "location",
        joining: "createdAt",
        activation: "firstPurchasedAt",
        reserves: "reserves",
        assigned: "assigned",
        directs: "directs",
        downline: "downline",
        commercials: "totalCommercialsUsd",
        isNetworkChainSubscriber: "isNetworkChainSubscriber",
        hasNvcChat: "hasNvcChat",
      };
      const sortField = SORTABLE[sortBy];
      // ALWAYS sort, even with no ?sortBy — an unsorted array here inherits
      // the aggregation's ordering and the offset/limit slice below would
      // hand back different rows on every reload. With no explicit column
      // the default is newest activation first. `_id` is the final
      // tie-breaker so equal values can never swap between requests.
      rows.sort((a, b) => {
        if (sortField) {
          const cmp = compareValues(
            pickSortValue(a, sortField),
            pickSortValue(b, sortField)
          );
          if (cmp !== 0) return cmp * sortOrder;
        } else {
          const cmp = compareValues(
            pickSortValue(a, "firstPurchasedAt"),
            pickSortValue(b, "firstPurchasedAt")
          );
          if (cmp !== 0) return -cmp;
        }
        return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
      });

      // Stats scoped to the FILTERED rows — now including assignees, who hold
      // a licence without having paid. Numbers come from the source-of-truth
      // aggregations, not the row payload:
      //   - Total Licenses    = UnilevelPlusPurchase count across kept users.
      //     Counts assigned seats too: they are licences in circulation, which
      //     is what this number means.
      //   - Active Licenses   = totalLicenses − reservedLicenses
      //   - Reserved Licenses = sum of ReserveLicense.available for kept users
      //   - Total Revenue     = real purchase spend + reserve spend. Sourced
      //     from realPurchaseSpendByUser, which skips `assigned_` rows, so an
      //     assignee contributes $0 and cannot inflate revenue.
      const keptUserIds = new Set(rows.map((r) => String(r._id)));
      const keptPurchaseAgg = purchaseAgg.filter((p) =>
        keptUserIds.has(String(p._id)),
      );
      const licensesPurchasedTotal = keptPurchaseAgg.reduce(
        (n, p) => n + p.licensesPurchased,
        0
      );
      const reservedLicensesTotal = keptPurchaseAgg.reduce((n, p) => {
        const r = reserveByUser.get(String(p._id));
        return n + (r?.available || 0);
      }, 0);
      let realPurchaseSpendTotal = 0;
      realPurchaseSpendByUser.forEach((v, k) => {
        if (keptUserIds.has(k)) realPurchaseSpendTotal += v;
      });
      let reserveSpendTotal = 0;
      reserveSpendByUser.forEach((v, k) => {
        if (keptUserIds.has(k)) reserveSpendTotal += v;
      });
      const stats = {
        // `affiliates` = everyone holding an active $25 licence, purchased or
        // assigned. In whole-tree mode the scoped members who hold no licence
        // are still excluded, so the pair reads "8 affiliates of 89 members".
        // Revenue is counted separately and only from real spend, so an
        // assignee raises this count without claiming revenue that
        // doesn't exist.
        affiliates: rows.filter((r) => r.isOneTimeAffiliate).length,
        members: rows.length,
        totalLicenses: licensesPurchasedTotal,
        activeLicenses: Math.max(0, licensesPurchasedTotal - reservedLicensesTotal),
        reservedLicenses: reservedLicensesTotal,
        totalRevenue: realPurchaseSpendTotal + reserveSpendTotal,
      };

      const total = rows.length;
      const paged = rows.slice(offset, offset + limit).map((r) => {
        const { _sort, ...rest } = r;
        return rest;
      });

      /**
       * Which stored instruments each row's user has, for the table chips.
       *
       * Enriched AFTER paging, in one query over just the visible rows —
       * `rows` here can be the whole tree, so doing this during row assembly
       * would mean a paymentProfile read per member to render at most 50.
       *
       * A UPI mandate only counts when it is `active` and unexpired: a revoked
       * or pending row is not something an admin can charge, and a chip that
       * says otherwise is worse than no chip.
       */
      const pagedUserIds = paged
        .map((r: any) => r.userId)
        .filter(Boolean)
        .map((id: any) => new Types.ObjectId(String(id)));
      if (pagedUserIds.length) {
        const profiles = await User.find({ _id: { $in: pagedUserIds } })
          .select("paymentProfile.stripe.methods paymentProfile.razorpay.tokens")
          .lean();
        const now = new Date();
        const byUser = new Map<string, { cards: number; upiAutopay: boolean }>();
        for (const u of profiles as any[]) {
          const cards = (u?.paymentProfile?.stripe?.methods || []).length;
          const upiAutopay = ((u?.paymentProfile?.razorpay?.tokens || []) as any[]).some(
            (t) =>
              t?.method === "upi" &&
              t?.mandateStatus === "active" &&
              (!t.mandateExpiresAt || new Date(t.mandateExpiresAt) > now),
          );
          byUser.set(String(u._id), { cards, upiAutopay });
        }
        for (const r of paged as any[]) {
          const hit = r.userId ? byUser.get(String(r.userId)) : undefined;
          r.savedInstruments = {
            cards: hit?.cards ?? 0,
            upiAutopay: hit?.upiAutopay ?? false,
          };
        }
      }

      return res.json({
        data: paged,
        stats,
        // Options for the filter drawer's location pickers — see
        // buildLocationFacets. Not affected by the location filter itself.
        locations,
        pagination: { total, limit, offset },
      });
    } catch (err) {
      console.error("[garage-admin/one-time-affiliates] error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

/* ── helpers ── */

function userSummary(u: any) {
  if (!u) return null;
  return {
    _id: String(u._id),
    name: u.name || null,
    email: u.email || null,
    phone: u.phone || null,
    profilePicture: u.profilePicture || null,
    country: u.country || null,
  };
}

/**
 * Fold a location value to its comparable form: trimmed, internal runs of
 * whitespace collapsed, lower-cased. Applied to BOTH the query param and the
 * stored value so the two can be compared exactly.
 */
function normalizeLoc(value: any): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Distinct country ▸ state ▸ city triples present in `rows`, with a row
 * count each. Grouped case/whitespace-insensitively; the label kept is the
 * first spelling seen, trimmed. Rows with no location at all are skipped.
 *
 * The FE uses this both to populate the pickers and to auto-fill a city's
 * parent state/country — the triple already carries them.
 */
function buildLocationFacets(rows: any[]) {
  const byKey = new Map<
    string,
    { country: string; state: string; city: string; count: number }
  >();
  for (const r of rows) {
    const country = String(r.location?.country ?? "").replace(/\s+/g, " ").trim();
    const state = String(r.location?.state ?? "").replace(/\s+/g, " ").trim();
    const city = String(r.location?.city ?? "").replace(/\s+/g, " ").trim();
    if (!country && !state && !city) continue;
    const key = `${country.toLowerCase()}|${state.toLowerCase()}|${city.toLowerCase()}`;
    const hit = byKey.get(key);
    if (hit) hit.count++;
    else byKey.set(key, { country, state, city, count: 1 });
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.country.localeCompare(b.country) ||
      a.state.localeCompare(b.state) ||
      a.city.localeCompare(b.city)
  );
}

function userLocation(u: any) {
  if (!u) return null;
  return {
    city: u.city || null,
    state: u.state || null,
    country: u.country || null,
  };
}

function pickSortValue(row: any, field: string): any {
  switch (field) {
    case "name":
      return String(row.user?.name || row.user?.email || "").toLowerCase();
    case "upline":
      return String(row.upline?.name || row.upline?.email || "").toLowerCase();
    case "location":
      return [row.location?.country, row.location?.state, row.location?.city]
        .filter(Boolean)
        .join(", ")
        .toLowerCase();
    case "createdAt":
      return timeOf(row.joining?.date) ?? 0;
    case "firstPurchasedAt":
      return timeOf(row.activation?.date) ?? 0;
    case "reserves":
      return row.reserves;
    case "assigned":
      return row.assigned;
    case "directs":
      return row.directs;
    case "downline":
      return row.downline;
    case "totalCommercialsUsd":
      return row.totalCommercialsUsd || 0;
    case "isNetworkChainSubscriber":
      return row.isNetworkChainSubscriber ? 1 : 0;
    case "hasNvcChat":
      return row.hasNvcChat ? 1 : 0;
    default:
      return 0;
  }
}

/** Ascending comparison that works for both the string and number sort keys
 *  above. Blank strings sort last regardless of direction is NOT wanted here
 *  (the caller flips the sign for desc), so blanks simply compare as "". */
function compareValues(a: any, b: any): number {
  if (typeof a === "string" || typeof b === "string") {
    return String(a ?? "").localeCompare(String(b ?? ""));
  }
  const an = Number(a) || 0;
  const bn = Number(b) || 0;
  return an === bn ? 0 : an < bn ? -1 : 1;
}

/** Milliseconds for a date-ish value, or null when it's missing/unparseable. */
function timeOf(value: any): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** "yes" | "no" | null — anything else ("all", "", undefined) means no filter. */
function normalizeTriState(raw: any): "yes" | "no" | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "yes" || v === "true") return "yes";
  if (v === "no" || v === "false") return "no";
  return null;
}

/**
 * Start/end-of-day epoch ms for a `YYYY-MM-DD` (or ISO) query param.
 * `end` bounds are inclusive of 23:59:59.999 so `?activatedTo=2026-01-31`
 * includes everything that happened ON the 31st.
 */
function dayBound(raw: any, edge: "start" | "end"): number | null {
  const day = String(raw ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(
    `${day}T${edge === "end" ? "23:59:59.999" : "00:00:00.000"}Z`
  );
  return Number.isNaN(t) ? null : t;
}

/**
 * Parse a numeric filter into inclusive `{ min, max }` bounds, from either a
 * bucket string ("0-0", "1-5", "21-50", "51-Infinity") or explicit
 * min/max params. Returns null when nothing was requested.
 */
function parseRange(
  bucketRaw: any,
  minRaw: any,
  maxRaw: any
): { min: number; max: number } | null {
  const bucket = String(bucketRaw ?? "").trim();
  if (bucket && bucket.toLowerCase() !== "all") {
    const [loStr, hiStr = ""] = bucket.split("-");
    const lo = Number(loStr);
    if (Number.isFinite(lo)) {
      const hiTrimmed = hiStr.trim();
      const hi =
        hiTrimmed === "" || /^inf(inity)?$/i.test(hiTrimmed)
          ? Infinity
          : Number(hiTrimmed);
      return { min: lo, max: Number.isFinite(hi) ? hi : Infinity };
    }
  }

  const min = Number(String(minRaw ?? "").trim());
  const max = Number(String(maxRaw ?? "").trim());
  const hasMin = String(minRaw ?? "").trim() !== "" && Number.isFinite(min);
  const hasMax = String(maxRaw ?? "").trim() !== "" && Number.isFinite(max);
  if (!hasMin && !hasMax) return null;
  return { min: hasMin ? min : -Infinity, max: hasMax ? max : Infinity };
}

/** Inclusive bounds check; a null range means "no filter requested". */
function matchesBucket(
  value: number,
  range: { min: number; max: number } | null
): boolean {
  if (!range) return true;
  const n = Number(value) || 0;
  return n >= range.min && n <= range.max;
}

function emptyStats() {
  return {
    affiliates: 0,
    members: 0,
    totalLicenses: 0,
    activeLicenses: 0,
    reservedLicenses: 0,
    totalRevenue: 0,
  };
}

/**
 * POST /garage-admin/users/:userId/nvc-chat   body: { created: boolean }
 *
 * Mark (or unmark) that an NVC chat has been created with this person.
 *
 * Deliberately a MANUAL flag. The chat happens off-platform, so there is no
 * message record to infer it from — the admin who made the chat records it.
 * Stored on the User, so every admin table listing that person shows the same
 * answer, exactly like the support-agent assignment beside it.
 *
 * Access: manage on One Time Affiliates OR NetworkChain Subs — the two tables
 * that surface this toggle (enforced by the mount-level gate's multi-page rule
 * in config/adminPages). It is deliberately NOT super-admin only: the NVCs
 * doing the outreach are the ones who know the chat exists, and forcing every
 * tick through the super admin would make the column go stale.
 */
router.post(
  "/users/:userId/nvc-chat",
  requireGarageAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!Types.ObjectId.isValid(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid user id" });
      }
      const created = req.body?.created !== false;

      const user = await User.findById(userId).select("_id").lean();
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const actingAdminId = (req as any).garageAdmin?.garageAdminId;

      if (!created) {
        await User.updateOne(
          { _id: userId },
          { $unset: { nvcChatCreatedAt: 1, nvcChatCreatedBy: 1 } },
        );
        return res.json({
          success: true,
          data: { userId, hasNvcChat: false, nvcChatCreatedAt: null },
        });
      }

      const now = new Date();
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            nvcChatCreatedAt: now,
            ...(actingAdminId && Types.ObjectId.isValid(String(actingAdminId))
              ? { nvcChatCreatedBy: new Types.ObjectId(String(actingAdminId)) }
              : {}),
          },
        },
      );
      return res.json({
        success: true,
        data: { userId, hasNvcChat: true, nvcChatCreatedAt: now },
      });
    } catch (err) {
      console.error("[garage-admin/users/:userId/nvc-chat] error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to update NVC chat" });
    }
  },
);

export default router;
