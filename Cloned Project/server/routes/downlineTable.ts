// src/routes/downlineTable.ts
// GET /affiliate/downline-table — server-driven data source for the Bigin-style
// 1Network → Downline table. Pagination + sort + filter run entirely in Mongo
// against the denormalized fields on User (ancestors / depth / legNumber /
// directsCount / downlineCount / typeFlags), so there is NO per-request
// $graphLookup. See the backend contract (docs 2026-07-27).
//
// View = a root user's full recursive subtree (root defaults to the caller;
// pivot via ?rootUserId). Level & leg are derived relative to that root from the
// stored ancestor path. Footer totals are for the WHOLE view (unfiltered).

import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import {
  comboWindowFor,
  comboWindowStatus,
  COMBO_WINDOW_HOURS,
  ComboWindowStatus,
} from "../services/comboWindow";

const router = Router();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ci = (s: string) => new RegExp(`^${escapeRegex(s.trim())}$`, "i");

// ── Operator filters (level / leg / country / office) ───────────────────────
// `?level=1,2&levelOp=isnt` etc. — multi-value with an operator, added for the
// mobile filter drawer (2026-08). Fully backward compatible: op defaults to
// "is", and a single "is" value takes the exact same query paths as before.
// Matching semantics mirror the clients': canonical value strings compared
// case-insensitively, and a row with NO value for the field passes the
// negative ops ("isnt", "notContains").
type FilterOp =
  | "is"
  | "isnt"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "empty"
  | "notEmpty";
const FILTER_OPS = new Set<string>([
  "is",
  "isnt",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "empty",
  "notEmpty",
]);
const parseOp = (s?: string): FilterOp =>
  s && FILTER_OPS.has(s) ? (s as FilterOp) : "is";
const parseList = (s?: string): string[] =>
  (s || "").split(",").map((x) => x.trim()).filter(Boolean);
const NEGATIVE_OPS: ReadonlySet<FilterOp> = new Set(["isnt", "notContains"]);

// ── Offer-window status filter (?windowStatus=not_started,open,expired,completed) ──
// The four states are defined in services/comboWindow.ts (Task 1) and mirrored
// per-row below as `offerWindow.status`. See the handler for the Mongo-side
// match, which is built to agree EXACTLY with the per-row computation.
const WINDOW_STATUSES: ReadonlySet<ComboWindowStatus> = new Set([
  "not_started",
  "open",
  "expired",
  "completed",
]);

/** Does one candidate value pass the operator against the selected values? */
function valueMatches(value: string, sel: string[], op: FilterOp): boolean {
  const v = value.toLowerCase();
  const ls = sel.map((s) => s.toLowerCase());
  switch (op) {
    case "is":
      return ls.includes(v);
    case "isnt":
      return !ls.includes(v);
    case "contains":
      return ls.some((s) => v.includes(s));
    case "notContains":
      return !ls.some((s) => v.includes(s));
    case "startsWith":
      return ls.some((s) => v.startsWith(s));
    case "endsWith":
      return ls.some((s) => v.endsWith(s));
    default:
      return true; // empty/notEmpty don't look at values
  }
}

/** Resolve the view root (caller or ?rootUserId) → {rootOid, rootDepth}. Sends
 *  the 400/404 itself and returns null so the caller just `if (!r) return`. */
async function resolveRoot(
  req: any,
  res: any
): Promise<{ rootOid: Types.ObjectId; rootDepth: number } | null> {
  const me = req.user as { userId: string };
  const q = req.query as Record<string, string | undefined>;
  const rootId = q.rootUserId && q.rootUserId !== "me" ? q.rootUserId : me.userId;
  if (!Types.ObjectId.isValid(rootId)) {
    res.status(400).json({ success: false, error: "Invalid rootUserId" });
    return null;
  }
  const rootOid = new Types.ObjectId(rootId);
  const root = await User.findById(rootOid).select("_id depth").lean();
  if (!root) {
    res.status(404).json({ success: false, error: "Root user not found" });
    return null;
  }
  return { rootOid, rootDepth: (root as any).depth ?? 0 };
}

/**
 * `?excludeUserId=` — hide everyone BENEATH each named person, keeping the
 * person themselves listed. Mirrors the admin One Time Affiliates filter
 * ("everyone under X except what these people brought in").
 *
 * Repeated params or one comma-separated list. A malformed id excludes nobody
 * rather than emptying or widening the table. Expressed as a condition on
 * `ancestors` instead of materialising the excluded ids: one indexed clause,
 * no matter how large the legs are.
 */
export function excludeBeneathClause(
  raw: unknown,
): Record<string, unknown> | null {
  const ids = (Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(","))
    .map((v) => v.trim())
    .filter((v) => v && Types.ObjectId.isValid(v))
    .map((v) => new Types.ObjectId(v));
  return ids.length ? { ancestors: { $nin: ids } } : null;
}

type SortKey =
  | "name"
  | "level"
  | "joinedAt"
  | "directs"
  | "downline"
  | "location"
  | "type"
  | "leg"
  | "qualified"
  | "levels"
  | "qualifiedLegs";
// Viewer-relative keys (leg/qualified/levels/qualifiedLegs) aren't stored
// columns — they're computed per-row and sorted before pagination (below).
type ComputedSortKey = "leg" | "qualified" | "levels" | "qualifiedLegs";
const SORT_FIELD: Record<Exclude<SortKey, ComputedSortKey>, Record<string, 1 | -1>> = {
  name: {},
  level: {},
  joinedAt: {},
  directs: {},
  downline: {},
  location: {},
  type: {},
};
// Map a sort key to the concrete stored field(s). `leg` is viewer-relative and
// not a stored column, so it is sorted per-page after assembly (documented).
function sortSpec(sortBy: SortKey, dir: 1 | -1): Record<string, 1 | -1> {
  switch (sortBy) {
    case "name":
      return { name: dir };
    case "level":
      return { depth: dir };
    case "joinedAt":
      return { createdAt: dir };
    case "directs":
      return { directsCount: dir };
    case "downline":
      return { downlineCount: dir };
    case "location":
      return { country: dir, state: dir, city: dir };
    case "type":
      return {
        "typeFlags.founderSub": dir,
        "typeFlags.networkChainsSub": dir,
        "typeFlags.oneNetworkActivated": dir,
      };
    default:
      return { createdAt: -1 };
  }
}

const TYPE_KEYS = ["oneNetworkActivated", "networkChainsSub", "founderSub"] as const;

router.get("/downline-table", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };
    const q = req.query as Record<string, string | undefined>;

    const rootId = q.rootUserId && q.rootUserId !== "me" ? q.rootUserId : me.userId;
    if (!Types.ObjectId.isValid(rootId)) {
      return res.status(400).json({ success: false, error: "Invalid rootUserId" });
    }
    const rootOid = new Types.ObjectId(rootId);
    const root = await User.findById(rootOid)
      .select("_id depth directsCount downlineCount")
      .lean();
    if (!root) return res.status(404).json({ success: false, error: "Root user not found" });
    const rootDepth = (root as any).depth ?? 0;

    // Single `now` for the whole request — the offer-window computation
    // (row-level `offerWindow` below AND the `windowStatus` Mongo match) must
    // agree on the same instant, or a filtered page could return a row whose
    // own `offerWindow.status` disagrees with the requested filter.
    const now = new Date();

    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(q.limit || "50", 10) || 50));
    const COMPUTED_KEYS = new Set<string>([
      "leg",
      "qualified",
      "levels",
      "qualifiedLegs",
    ]);
    const sortBy =
      (q.sortBy as SortKey) in SORT_FIELD || COMPUTED_KEYS.has(q.sortBy as string)
        ? (q.sortBy as SortKey)
        : "joinedAt";
    const dir: 1 | -1 = q.sortOrder === "asc" ? 1 : -1;
    const qualifiedOnly = q.qualifiedOnly === "true" || q.qualifiedOnly === "1";
    const windowStatusFilters = Array.from(
      new Set(
        parseList(q.windowStatus).filter((s): s is ComboWindowStatus =>
          WINDOW_STATUSES.has(s as ComboWindowStatus),
        ),
      ),
    );

    // ── Load the caller's directs + qualified-rank map ─────────────────
    // "Qualified" = a caller-direct who themselves have an active $25
    // UnilevelPlusPurchase. Rank = 1..K in chronological purchase order.
    // Every row inherits its leg-root's qualified rank (null if the leg
    // root hasn't activated).
    const directsAll = (await User.find({ referredBy: rootOid })
      .select("_id legNumber")
      .lean()) as Array<{ _id: Types.ObjectId; legNumber?: number | null }>;
    const directsAllIds = directsAll.map((d) => d._id);
    const activatedDirects = directsAllIds.length
      ? ((await UnilevelPlusPurchase.find({
          userId: { $in: directsAllIds },
          status: "active",
        })
          .sort({ purchasedAt: 1, createdAt: 1 })
          .select("userId")
          .lean()) as Array<{ userId: Types.ObjectId }>)
      : [];
    const qualifiedRankByDirect = new Map<string, number>();
    activatedDirects.forEach((p, i) => {
      qualifiedRankByDirect.set(String(p.userId), i + 1);
    });
    const qualifiedDirectOids = activatedDirects.map((p) => p.userId);

    // ── Per-row subtree stats (computed over the WHOLE subtree, looked up per
    //    row): `levels` = how many levels deep THAT member's downline goes
    //    (maxDepth of their subtree − their depth); `qualifiedLegs` = count of
    //    THAT member's directs who have an active UnilevelPlus (their own
    //    qualified legs). Both are viewer-relative, so they're also sortable via
    //    the compute-then-paginate path below.
    const [depthAgg, qLegAgg] = await Promise.all([
      User.aggregate([
        { $match: { ancestors: rootOid } },
        { $unwind: "$ancestors" },
        { $group: { _id: "$ancestors", maxDepth: { $max: "$depth" } } },
      ]),
      User.aggregate([
        { $match: { ancestors: rootOid } },
        {
          $lookup: {
            from: UnilevelPlusPurchase.collection.name,
            let: { uid: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$userId", "$$uid"] },
                      { $eq: ["$status", "active"] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "_up",
          },
        },
        { $match: { "_up.0": { $exists: true } } },
        { $group: { _id: "$referredBy", count: { $sum: 1 } } },
      ]),
    ]);
    const maxDepthByMember = new Map<string, number>(
      (depthAgg as any[]).map((r) => [String(r._id), r.maxDepth]),
    );
    const qualifiedLegsByMember = new Map<string, number>(
      (qLegAgg as any[]).map((r) => [String(r._id), r.count]),
    );
    const levelsOf = (memberId: any, depth: number): number =>
      Math.max(0, (maxDepthByMember.get(String(memberId)) ?? depth) - depth);
    const qualifiedLegsOf = (memberId: any): number =>
      qualifiedLegsByMember.get(String(memberId)) ?? 0;

    // ── Build the Mongo match over the root's subtree ──────────────────────
    const and: Record<string, unknown>[] = [{ ancestors: rootOid }];
    const excludeClause = excludeBeneathClause(req.query.excludeUserId);
    if (excludeClause) and.push(excludeClause);

    if (qualifiedOnly) {
      // Restrict to rows in a qualified leg — either the leg root itself
      // OR anyone whose ancestor chain contains a qualified direct.
      if (qualifiedDirectOids.length === 0) {
        and.push({ _id: { $exists: false } });
      } else {
        and.push({
          $or: [
            { _id: { $in: qualifiedDirectOids } },
            { ancestors: { $in: qualifiedDirectOids } },
          ],
        });
      }
    }

    // Level. Every member has one, so "empty" matches nothing and "notEmpty"
    // is a no-op. Single "is" keeps the original stored-column equality; the
    // richer forms JS-match the subtree's distinct levels, then filter by the
    // resulting depth set (an empty set correctly matches nothing).
    const levelVals = parseList(q.level);
    const levelOp = parseOp(q.levelOp);
    if (levelOp === "empty") {
      and.push({ _id: { $exists: false } });
    } else if (levelOp !== "notEmpty" && levelVals.length) {
      if (levelOp === "is" && levelVals.length === 1) {
        const lvl = parseInt(levelVals[0], 10);
        if (!Number.isNaN(lvl)) and.push({ depth: rootDepth + lvl });
      } else {
        const depths = (await User.distinct("depth", { ancestors: rootOid })) as number[];
        const matched = depths.filter((d) =>
          valueMatches(String(d - rootDepth), levelVals, levelOp),
        );
        and.push({ depth: { $in: matched } });
      }
    }

    // Leg N = the root's Nth direct (by signup order) and everyone beneath
    // them. Every subtree row sits in exactly one leg, so "empty" matches
    // nothing — EXCEPT rows whose leg root has no legNumber (leg unknown),
    // which also pass the negative ops, matching the clients' semantics.
    // Reuses directsAll (loaded above for the qualified map).
    const legVals = parseList(q.leg);
    const legOp = parseOp(q.legOp);
    if (legOp !== "notEmpty" && (legOp === "empty" || legVals.length)) {
      const matchedDirects = directsAll
        .filter((d) =>
          d.legNumber == null
            ? legOp === "empty" || NEGATIVE_OPS.has(legOp)
            : legOp !== "empty" && valueMatches(String(d.legNumber), legVals, legOp),
        )
        .map((d) => d._id);
      if (!matchedDirects.length) {
        // No matching leg → empty result but still return footer below.
        and.push({ _id: { $exists: false } });
      } else {
        and.push({
          $or: [{ _id: { $in: matchedDirects } }, { ancestors: { $in: matchedDirects } }],
        });
      }
    }

    if (q.city) and.push({ city: ci(q.city) });
    if (q.state) and.push({ state: ci(q.state) });

    // Country. Members without one pass the negative ops (client parity).
    const countryVals = parseList(q.country);
    const countryOp = parseOp(q.countryOp);
    if (countryOp === "empty") {
      and.push({ $or: [{ country: null }, { country: "" }] });
    } else if (countryOp === "notEmpty") {
      and.push({ country: { $nin: [null, ""] } });
    } else if (countryVals.length) {
      if (countryOp === "is" && countryVals.length === 1) {
        and.push({ country: ci(countryVals[0]) });
      } else {
        const countries = (await User.distinct("country", {
          ancestors: rootOid,
          country: { $nin: [null, ""] },
        })) as string[];
        const matched = countries.filter((c) => valueMatches(c, countryVals, countryOp));
        const or: Record<string, unknown>[] = [{ country: { $in: matched } }];
        if (NEGATIVE_OPS.has(countryOp)) or.push({ country: null }, { country: "" });
        and.push({ $or: or });
      }
    }

    if (q.joinedFrom || q.joinedTo) {
      const range: Record<string, Date> = {};
      if (q.joinedFrom) range.$gte = new Date(q.joinedFrom);
      if (q.joinedTo) range.$lte = new Date(q.joinedTo);
      and.push({ createdAt: range });
    }

    if (q.type) {
      const wanted = q.type.split(",").map((s) => s.trim()).filter(Boolean);
      const or: Record<string, unknown>[] = [];
      for (const t of wanted) {
        if (t === "shopper") {
          or.push({
            "typeFlags.oneNetworkActivated": { $ne: true },
            "typeFlags.networkChainsSub": { $ne: true },
            "typeFlags.founderSub": { $ne: true },
          });
        } else if ((TYPE_KEYS as readonly string[]).includes(t)) {
          or.push({ [`typeFlags.${t}`]: true });
        }
      }
      if (or.length) and.push({ $or: or });
    }

    // Office. Values are orgIds, so the substring ops degenerate to membership
    // tests (a full ObjectId only "contains" an equal one) — $in/$nin covers
    // every op. $nin on the array field means "holds NONE of these", and rows
    // with no offices pass it, both matching the clients' semantics.
    const officeVals = parseList(q.office).filter((v) => Types.ObjectId.isValid(v));
    const officeOp = parseOp(q.officeOp);
    if (officeOp === "empty") {
      and.push({ "organizations.0": { $exists: false } });
    } else if (officeOp === "notEmpty") {
      and.push({ "organizations.0": { $exists: true } });
    } else if (officeVals.length) {
      const oids = officeVals.map((v) => new Types.ObjectId(v));
      and.push({
        "organizations.organization": NEGATIVE_OPS.has(officeOp)
          ? { $nin: oids }
          : { $in: oids },
      });
    }

    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search.trim()), "i");
      and.push({ $or: [{ name: rx }, { email: rx }, { phone: rx }] });
    }

    // ── windowStatus filter (?windowStatus=not_started,open,expired,completed) ──
    // Appended to `and` so it composes with every other filter above. The
    // date predicates here and the completed-set below MUST agree with the
    // per-row `comboWindowStatus` computed in the row assembly (same `now`,
    // same cutoff, same completed-set definition) — see the comments inline.
    if (windowStatusFilters.length) {
      const cutoff = new Date(now.getTime() - COMBO_WINDOW_HOURS * 60 * 60 * 1000);

      // "completed" (and excluding completed rows from open/expired) needs
      // the actual completed-user-id set. Only resolved when a windowStatus
      // filter that needs it is active — this never runs on the default
      // (no-filter) hot path. Scoped to the same subtree restriction the
      // query already applies ({ancestors: rootOid}); cost is one extra
      // aggregation over that subtree (bounded by subtree size, same shape
      // as the qualifiedLegs aggregation above), acceptable for v1 since it
      // is gated behind an explicit filter.
      let completedIds: Types.ObjectId[] = [];
      if (
        windowStatusFilters.includes("completed") ||
        windowStatusFilters.includes("open") ||
        windowStatusFilters.includes("expired")
      ) {
        const upInSubtree = (await User.aggregate([
          { $match: { ancestors: rootOid } },
          {
            $lookup: {
              from: UnilevelPlusPurchase.collection.name,
              let: { uid: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$userId", "$$uid"] },
                        { $eq: ["$status", "active"] },
                      ],
                    },
                  },
                },
                { $project: { _id: 0, purchasedAt: 1 } },
                { $limit: 1 },
              ],
              as: "_up",
            },
          },
          { $match: { "_up.0": { $exists: true } } },
          {
            $project: {
              _id: 1,
              profileCompletedAt: 1,
              offerExpiresAtOverride: 1,
              purchasedAt: { $arrayElemAt: ["$_up.purchasedAt", 0] },
            },
          },
        ])) as Array<{
          _id: Types.ObjectId;
          profileCompletedAt?: Date | null;
          offerExpiresAtOverride?: Date | null;
          purchasedAt?: Date;
        }>;
        // Same predicate as comboWindowStatus's "completed" branch
        // (purchasedAt <= effective expiry), computed via the SAME
        // comboWindowFor + the SAME `now` used for the row-level status —
        // this is what guarantees the filter can never disagree with a
        // row's own `offerWindow.status`.
        completedIds = upInSubtree
          .filter((u) => {
            const w = comboWindowFor(
              {
                profileCompletedAt: u.profileCompletedAt,
                offerExpiresAtOverride: u.offerExpiresAtOverride,
              },
              now,
            );
            return (
              !!u.purchasedAt &&
              !!w.expiresAt &&
              new Date(u.purchasedAt).getTime() <= w.expiresAt.getTime()
            );
          })
          .map((u) => u._id);
      }

      const or: Record<string, unknown>[] = [];
      for (const state of windowStatusFilters) {
        if (state === "not_started") {
          // Window never started: no profileCompletedAt AND no admin/upline
          // override — an override alone can start the window (comboWindowFor
          // synthesizes `startsAt` when only the override is set), so both
          // must be absent for comboWindowStatus to return "not_started".
          or.push({
            $and: [
              {
                $or: [
                  { profileCompletedAt: null },
                  { profileCompletedAt: { $exists: false } },
                ],
              },
              {
                $or: [
                  { offerExpiresAtOverride: null },
                  { offerExpiresAtOverride: { $exists: false } },
                ],
              },
            ],
          });
        } else if (state === "open") {
          // Effective expiry (max of natural + override) is still in the
          // future, and not already counted as "completed".
          or.push({
            _id: { $nin: completedIds },
            $or: [
              { profileCompletedAt: { $gt: cutoff } },
              { offerExpiresAtOverride: { $gt: now } },
            ],
          });
        } else if (state === "expired") {
          // Window started (one of the two fields is set) but neither the
          // natural nor the override expiry is still in the future, and not
          // "completed".
          or.push({
            _id: { $nin: completedIds },
            $or: [
              { profileCompletedAt: { $ne: null } },
              { offerExpiresAtOverride: { $ne: null } },
            ],
            $nor: [
              { profileCompletedAt: { $gt: cutoff } },
              { offerExpiresAtOverride: { $gt: now } },
            ],
          });
        } else if (state === "completed") {
          or.push({ _id: { $in: completedIds } });
        }
      }
      and.push(or.length === 1 ? or[0] : { $or: or });
    }

    const match = and.length === 1 ? and[0] : { $and: and };

    // ── Query: page rows, filtered count, level histogram (all indexed) ─────
    // NB: filter facets (level/leg/location/type/office counts) live in the
    // companion /downline-table/facets endpoint so this hot path (hit on every
    // page/sort/filter) never pays for aggregations the drawer only needs once.
    // `leg` + `qualified` are viewer-relative (computed from each row's ancestor
    // chain), not stored columns, so Mongo can't sort by them. For those keys we
    // compute the value for the WHOLE filtered subtree, sort, THEN paginate —
    // otherwise the values jump across page boundaries. Every other key sorts +
    // paginates in Mongo as before.
    const rootKey = String(rootOid);
    const legMap = new Map<string, number | null>(
      directsAll.map((d) => [String(d._id), d.legNumber ?? null]),
    );
    const PAGE_SELECT =
      "_id name email phone profilePicture createdAt city state country " +
      "ancestors depth legNumber directsCount downlineCount organizations referredBy typeFlags " +
      "profileCompletedAt offerExpiresAtOverride offerExtendedAt offerExtendedByUserId";
    // The root's direct-child on this row's path (or the row itself if it IS a
    // direct) — the key both `leg` and `qualified` are looked up by.
    const legAncestorOf = (ancestors: any[] | undefined, selfId: any): string => {
      const ancStr = (ancestors || []).map((a) => String(a));
      const ri = ancStr.indexOf(rootKey);
      return ri >= 0 && ancStr[ri + 1] ? ancStr[ri + 1] : String(selfId);
    };

    let total: number;
    let rows: any[];

    if (COMPUTED_KEYS.has(sortBy)) {
      // Compute the (viewer-relative) key over the whole filtered subtree, sort,
      // THEN paginate — a per-page sort would make values jump across pages.
      const lite = (await User.find(match)
        .select("_id ancestors createdAt depth")
        .lean()) as Array<{
        _id: Types.ObjectId;
        ancestors?: any[];
        createdAt?: Date;
        depth?: number;
      }>;
      total = lite.length;

      const keyed = lite.map((r) => {
        const legAnc = legAncestorOf(r.ancestors, r._id);
        const depth = r.depth ?? 0;
        return {
          id: r._id,
          createdAt: r.createdAt,
          leg: legMap.has(legAnc) ? legMap.get(legAnc)! : null,
          qualified: qualifiedRankByDirect.get(legAnc) ?? null,
          levels: levelsOf(r._id, depth),
          qualifiedLegs: qualifiedLegsOf(r._id),
        };
      });
      // Newest-first tie-break, matching the default row order.
      const tie = (a?: Date, b?: Date) =>
        new Date(b || 0).getTime() - new Date(a || 0).getTime();
      keyed.sort((a, b) => {
        if (sortBy === "leg") {
          const d = ((a.leg ?? 0) - (b.leg ?? 0)) * dir;
          return d !== 0 ? d : tie(a.createdAt, b.createdAt);
        }
        if (sortBy === "levels") {
          const d = (a.levels - b.levels) * dir;
          return d !== 0 ? d : tie(a.createdAt, b.createdAt);
        }
        if (sortBy === "qualifiedLegs") {
          const d = (a.qualifiedLegs - b.qualifiedLegs) * dir;
          return d !== 0 ? d : tie(a.createdAt, b.createdAt);
        }
        // qualified: nulls always fall to the end, regardless of direction.
        const av = a.qualified;
        const bv = b.qualified;
        if (av == null && bv == null) return tie(a.createdAt, b.createdAt);
        if (av == null) return 1;
        if (bv == null) return -1;
        const d = (av - bv) * dir;
        return d !== 0 ? d : tie(a.createdAt, b.createdAt);
      });

      const pageIds = keyed
        .slice((page - 1) * limit, page * limit)
        .map((x) => x.id);
      const docs = pageIds.length
        ? ((await User.find({ _id: { $in: pageIds } })
            .select(PAGE_SELECT)
            .lean()) as any[])
        : [];
      const byId = new Map(docs.map((d) => [String(d._id), d]));
      rows = pageIds.map((id) => byId.get(String(id))).filter(Boolean);
    } else {
      const [t, rowsRaw] = await Promise.all([
        User.countDocuments(match),
        User.find(match)
          .sort(sortSpec(sortBy, dir))
          .skip((page - 1) * limit)
          .limit(limit)
          .select(PAGE_SELECT)
          .lean(),
      ]);
      total = t;
      rows = rowsRaw as any[];
    }

    // Batch-resolve offices + uplines for the returned page only.
    const orgIds = new Set<string>();
    const uplineIds = new Set<string>();
    for (const r of rows) {
      for (const m of r.organizations || []) if (m.organization) orgIds.add(String(m.organization));
      if (r.referredBy) uplineIds.add(String(r.referredBy));
    }
    // UP purchases for the page's offer-window status. Mirrors
    // garageAdmin.controller.ts ~1735-1740 (same `status: "active"` filter,
    // same select). `userId` is unique on UnilevelPlusPurchase, so there is
    // at most one purchase per user — "first vs last" doesn't apply.
    const pageUserIds = rows.map((r) => r._id);
    const [orgs, uplines, upPurchases] = await Promise.all([
      orgIds.size
        ? Organization.find({ _id: { $in: [...orgIds].map((x) => new Types.ObjectId(x)) } })
            .select("_id name icon slug store.slug")
            .lean()
        : Promise.resolve([]),
      uplineIds.size
        ? User.find({ _id: { $in: [...uplineIds].map((x) => new Types.ObjectId(x)) } })
            .select("_id name email phone profilePicture country")
            .lean()
        : Promise.resolve([]),
      pageUserIds.length
        ? UnilevelPlusPurchase.find({ userId: { $in: pageUserIds }, status: "active" })
            .select("userId purchasedAt")
            .lean<Array<{ userId: any; purchasedAt: Date }>>()
        : Promise.resolve([] as Array<{ userId: any; purchasedAt: Date }>),
    ]);
    const orgMap = new Map((orgs as any[]).map((o) => [String(o._id), o]));
    const uplineMap = new Map((uplines as any[]).map((u) => [String(u._id), u]));
    const upByUserId = new Map<string, Date>();
    for (const p of upPurchases as any[]) upByUserId.set(String(p.userId), p.purchasedAt);

    const assembled = rows.map((r) => {
      // Leg: legNumber of the ancestor that is the root's direct child on this
      // member's path (or the member itself when it IS a direct of the root).
      const ancStr = (r.ancestors || []).map((a: any) => String(a));
      const ri = ancStr.indexOf(rootKey);
      const legAncestorId = ri >= 0 && ancStr[ri + 1] ? ancStr[ri + 1] : String(r._id);
      const leg = legMap.has(legAncestorId) ? legMap.get(legAncestorId)! : null;
      // Qualified rank of THIS row's leg root among the caller's activated
      // directs (null when the leg root hasn't purchased UnilevelPlus).
      // Every row in a qualified leg inherits the same rank.
      const qualified = qualifiedRankByDirect.get(legAncestorId) ?? null;

      const offices = (r.organizations || []).map((m: any) => {
        const org = orgMap.get(String(m.organization)) as any;
        return {
          orgId: String(m.organization),
          name: org?.name || "Unknown",
          icon: org?.icon || "",
          slug: org?.slug || org?.store?.slug || "",
          role: m.role,
          guest: m.guest === true,
          joinedAt: m.joinedAt,
        };
      });
      const firstOffice = offices.length
        ? [...offices].sort(
            (a, b) => new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime()
          )[0]
        : null;

      const up = r.referredBy ? (uplineMap.get(String(r.referredBy)) as any) : null;
      const tf = r.typeFlags || {};
      const type = TYPE_KEYS.filter((k) => tf[k]);

      // Offer window (see services/comboWindow.ts, Task 1). Uses the SAME
      // `now` as the windowStatus Mongo match above, so a filtered page's
      // rows always agree with the requested filter.
      const w = comboWindowFor(
        {
          profileCompletedAt: r.profileCompletedAt,
          offerExpiresAtOverride: r.offerExpiresAtOverride,
        },
        now,
      );
      const offerWindow = {
        status: comboWindowStatus(w, { upPurchasedAt: upByUserId.get(String(r._id)) }),
        startsAt: w.startsAt ? w.startsAt.toISOString() : null,
        expiresAt: w.expiresAt ? w.expiresAt.toISOString() : null,
        secondsRemaining: w.secondsRemaining,
        extendedByUpline: !!r.offerExtendedByUserId,
      };

      return {
        userId: String(r._id),
        name: r.name || "Unknown",
        email: r.email || "",
        phone: r.phone || "",
        avatar: r.profilePicture || "",
        leg,
        qualified,
        level: (r.depth ?? 0) - rootDepth,
        // Per-row subtree stats (Image-62 columns): levels deep + qualified legs.
        levels: levelsOf(r._id, r.depth ?? 0),
        qualifiedLegs: qualifiedLegsOf(r._id),
        joinedAt: r.createdAt,
        firstOffice,
        offices,
        upline: up
          ? {
              userId: String(up._id),
              name: up.name || "Unknown",
              email: up.email || "",
              phone: up.phone || "",
              avatar: up.profilePicture || "",
              // The upline's OWN country. Previously absent, which forced the
              // table to fall back to the ROW member's country — so the same
              // upline rendered a different flag on every row.
              country: up.country || null,
            }
          : null,
        location: { city: r.city || null, state: r.state || null, country: r.country || null },
        type, // [] = Shopper
        directs: r.directsCount ?? 0,
        downline: r.downlineCount ?? 0,
        rank1: r.rank1 ?? null,
        rank2: r.rank2 ?? null,
        offerWindow,
      };
    });

    // leg/qualified are ordered before pagination (see the query above), so no
    // post-assembly sort is needed — the page is already in the right order.

    return res.json({
      success: true,
      data: {
        root: { userId: rootKey, depth: rootDepth },
        rows: assembled,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
        footer: {
          totalDownline: (root as any).downlineCount ?? 0,
          totalDirects: (root as any).directsCount ?? 0,
          totalLegs: (root as any).directsCount ?? 0,
          totalQualifiedLegs: qualifiedRankByDirect.size,
        },
      },
    });
  } catch (error) {
    console.error("💥 downline-table error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to load downline table", details: (error as Error).message });
  }
});

// ── GET /affiliate/downline-table/facets ────────────────────────────────────
// Value+count lists that back each filter dropdown (Level / Legs / Location /
// Type / Offices). Called ONCE when the filter drawer opens — kept off the hot
// table path. Every facet is one indexed aggregation over the root's subtree
// ({ancestors: rootOid}); no $graphLookup. Rank has no data yet; Joining Date is
// a range (no value list) — neither is returned here.
router.get("/downline-table/facets", requireAuth, async (req, res) => {
  try {
    const r = await resolveRoot(req, res);
    if (!r) return;
    const { rootOid, rootDepth } = r;
    // Facet counts must be filtered the same way the table is, or the drawer
    // offers a value that returns nothing once applied.
    const excluded = excludeBeneathClause(req.query.excludeUserId);
    const inSubtree: Record<string, unknown> = excluded
      ? { ancestors: { $eq: rootOid, ...(excluded.ancestors as object) } }
      : { ancestors: rootOid };

    const [levelsAgg, directs, countryAgg, stateAgg, cityAgg, typeAgg, officeAgg, total] =
      await Promise.all([
        User.aggregate([
          { $match: inSubtree },
          { $group: { _id: "$depth", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        // Legs = the root's directs; each leg's size = that direct's subtree + itself.
        User.find({ referredBy: rootOid })
          .select("_id legNumber name profilePicture downlineCount depth")
          .sort({ legNumber: 1 })
          .lean(),
        User.aggregate([
          { $match: { ...inSubtree, country: { $nin: [null, ""] } } },
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        User.aggregate([
          { $match: { ...inSubtree, state: { $nin: [null, ""] } } },
          { $group: { _id: "$state", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        User.aggregate([
          { $match: { ...inSubtree, city: { $nin: [null, ""] } } },
          { $group: { _id: "$city", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        User.aggregate([
          { $match: inSubtree },
          {
            $group: {
              _id: null,
              oneNetworkActivated: {
                $sum: { $cond: [{ $eq: ["$typeFlags.oneNetworkActivated", true] }, 1, 0] },
              },
              networkChainsSub: {
                $sum: { $cond: [{ $eq: ["$typeFlags.networkChainsSub", true] }, 1, 0] },
              },
              founderSub: {
                $sum: { $cond: [{ $eq: ["$typeFlags.founderSub", true] }, 1, 0] },
              },
              shopper: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$typeFlags.oneNetworkActivated", true] },
                        { $ne: ["$typeFlags.networkChainsSub", true] },
                        { $ne: ["$typeFlags.founderSub", true] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
        User.aggregate([
          { $match: inSubtree },
          { $unwind: "$organizations" },
          { $group: { _id: "$organizations.organization", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        User.countDocuments(inSubtree),
      ]);

    const officeIds = (officeAgg as any[]).map((o) => o._id).filter(Boolean);
    const orgs = officeIds.length
      ? await Organization.find({ _id: { $in: officeIds } })
          .select("_id name icon slug store.slug")
          .lean()
      : [];
    const orgMap = new Map((orgs as any[]).map((o) => [String(o._id), o]));
    const t = (typeAgg as any[])[0] || {};

    // ── Per-leg qualified rank + subtree-depth (levels) ───────────────
    // Qualified rank of each direct = position among the caller's directs
    // that have an active $25 UnilevelPlusPurchase, ordered by purchasedAt
    // ascending. Same semantics as the row-level `qualified` field on
    // /downline-table.
    // Levels = max depth reached inside this leg's subtree − the direct's
    // own depth. 0 when the direct has no downstream members.
    const directIds = (directs as any[]).map((d) => d._id);
    const [activatedDirects, legDepthAgg] = await Promise.all([
      directIds.length
        ? UnilevelPlusPurchase.find({
            userId: { $in: directIds },
            status: "active",
          })
            .sort({ purchasedAt: 1, createdAt: 1 })
            .select("userId")
            .lean<Array<{ userId: Types.ObjectId }>>()
        : Promise.resolve([] as Array<{ userId: Types.ObjectId }>),
      directIds.length
        ? User.aggregate([
            { $match: { ancestors: { $in: directIds } } },
            {
              $addFields: {
                legRoot: {
                  $arrayElemAt: [
                    { $setIntersection: ["$ancestors", directIds] },
                    0,
                  ],
                },
              },
            },
            { $group: { _id: "$legRoot", maxDepth: { $max: "$depth" } } },
          ])
        : Promise.resolve([] as Array<{ _id: Types.ObjectId; maxDepth: number }>),
    ]);
    const qualifiedRankByDirect = new Map<string, number>();
    activatedDirects.forEach((p, i) => {
      qualifiedRankByDirect.set(String(p.userId), i + 1);
    });
    const maxDepthByLeg = new Map<string, number>(
      (legDepthAgg as any[]).map((r) => [String(r._id), r.maxDepth]),
    );

    return res.json({
      success: true,
      data: {
        root: { userId: String(rootOid), depth: rootDepth },
        total, // "All X" row count
        levels: (levelsAgg as any[]).map((h) => ({
          level: (h._id ?? 0) - rootDepth,
          userCount: h.count,
        })),
        legs: (directs as any[]).map((d) => {
          const directDepth = d.depth ?? rootDepth + 1;
          const maxDepth = maxDepthByLeg.get(String(d._id)) ?? directDepth;
          return {
            leg: d.legNumber ?? null,
            name: d.name || "Unknown",
            avatar: d.profilePicture || "",
            userCount: (d.downlineCount ?? 0) + 1,
            // Qualified rank of this direct among the caller's activated
            // directs (null when this direct hasn't purchased UnilevelPlus).
            qualified: qualifiedRankByDirect.get(String(d._id)) ?? null,
            // Depth of this leg's downstream chain, relative to the direct.
            // 0 → no downstream members (the leg is just the direct).
            levels: Math.max(0, maxDepth - directDepth),
          };
        }),
        location: {
          countries: (countryAgg as any[]).map((x) => ({ value: x._id, userCount: x.count })),
          states: (stateAgg as any[]).map((x) => ({ value: x._id, userCount: x.count })),
          cities: (cityAgg as any[]).map((x) => ({ value: x._id, userCount: x.count })),
        },
        type: [
          { value: "shopper", userCount: t.shopper ?? 0 },
          { value: "oneNetworkActivated", userCount: t.oneNetworkActivated ?? 0 },
          { value: "networkChainsSub", userCount: t.networkChainsSub ?? 0 },
          { value: "founderSub", userCount: t.founderSub ?? 0 },
        ],
        offices: (officeAgg as any[]).map((o) => {
          const org = orgMap.get(String(o._id)) as any;
          return {
            orgId: String(o._id),
            name: org?.name || "Unknown",
            icon: org?.icon || "",
            slug: org?.slug || org?.store?.slug || "",
            userCount: o.count,
          };
        }),
        // Aggregate counts across the caller's directs.
        totals: {
          totalLegs: (directs as any[]).length,
          totalQualifiedLegs: qualifiedRankByDirect.size,
        },
      },
    });
  } catch (error) {
    console.error("💥 downline-table facets error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to load filter facets", details: (error as Error).message });
  }
});

export default router;
