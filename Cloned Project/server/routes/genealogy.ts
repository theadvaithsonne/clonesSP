// src/routes/genealogy.ts
// /affiliate/genealogy/* — the Genealogy page (Tree / Legs / Levels). Every
// route is scoped: ?root must be the caller or in the caller's downline, and any
// :memberId/:nodeId must sit under that root. Contact details only for the
// caller's own directs. See docs spec genealogy/backend-requirements.md.
import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { GenealogySnapshot, GenealogySnapshotRun } from "../models/genealogySnapshot.model";
import { previousPeriodKeyFor } from "../models/rankRun.model";
import { RANK_KEYS, RankPlan } from "../models/rankPlan.model";
import { Invoice } from "../models/invoice.model";
import { getUserRankDetail } from "../services/rankBonus/detail";
import {
  GenealogyError, resolveRoot, assertUnder, loadTree, earningsFromMember,
  ncRenewalDate, productsBought, pendingDirects,
} from "../services/genealogy/data";
import {
  TreeMember, MemberStatus, levelHistogram, monthStart, pathFromRoot,
  summarizeLegs, buildMatrix, levelBucket, legHeadOf, ancestorsOf,
} from "../services/genealogy/pure";
import { INFINITY_T1_MIN_LEGS, INFINITY_T2_MIN_LEGS } from "../services/unilevelPlusCommission";

const router = Router();
router.use(requireAuth);

type Tree = Awaited<ReturnType<typeof loadTree>>;

const caller = (req: Request) => ((req as any).user as { userId: string }).userId;
const q = (req: Request): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.query)) {
    const first = Array.isArray(v) ? v[0] : v;
    out[k] = typeof first === "string" ? first : undefined;
  }
  return out;
};
const list = (s?: string) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
const pageOf = (req: Request, max = 100) => {
  const page = Math.max(1, parseInt(q(req).page || "1", 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(q(req).limit || "50", 10) || 50));
  return { page, limit };
};

function fail(res: Response, e: unknown) {
  if (e instanceof GenealogyError) {
    return res.status(e.status).json({ success: false, error: e.code });
  }
  console.error("💥 genealogy error:", e);
  return res.status(500).json({ success: false, error: "GENEALOGY_FAILED" });
}

/** Leg number for a member: the legNumber stored on its leg head (the root's direct). */
async function legNumbers(tree: Tree): Promise<Map<string, number | null>> {
  const heads = tree.members.filter((m) => m.level === 1).map((m) => new Types.ObjectId(m.id));
  const docs = heads.length
    ? await User.find({ _id: { $in: heads } }).select("_id legNumber").lean()
    : [];
  return new Map((docs as any[]).map((d) => [String(d._id), d.legNumber ?? null]));
}

function toNode(m: TreeMember, legNo: Map<string, number | null>) {
  return {
    userId: m.id,
    name: m.name,
    handle: m.handle,
    avatar: m.avatar,
    leg: m.legHead ? legNo.get(m.legHead) ?? null : null,
    level: m.level,
    status: m.status,
    rank: m.rank && (RANK_KEYS as readonly string[]).includes(m.rank) ? m.rank : null,
    teamSize: m.teamSize,
    directs: m.directs,
    hasChildren: m.directs > 0,
    joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : null,
    volumeUsd: m.volumeUsd,
  };
}

// ── GET /summary ────────────────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  try {
    const meId = caller(req);
    const { rootOid } = await resolveRoot(meId, q(req).root);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const team = tree.members.filter((m) => m.level >= 1);
    const since = monthStart(new Date());
    const isSelf = tree.root.id === meId;

    // Root's position relative to the CALLER (null when the caller IS the root).
    let fromCaller: { leg: number | null; level: number } | null = null;
    if (!isSelf) {
      const docs = await User.find({ _id: { $in: [rootOid, new Types.ObjectId(meId)] } })
        .select("_id ancestors depth")
        .lean();
      const rootDoc = (docs as any[]).find((d) => String(d._id) === String(rootOid));
      const callerDoc = (docs as any[]).find((d) => String(d._id) === meId);
      if (rootDoc && callerDoc) {
        const level = (rootDoc.depth ?? 0) - (callerDoc.depth ?? 0);
        const headId = legHeadOf(rootDoc.ancestors, meId, String(rootOid));
        let leg: number | null = null;
        if (headId) {
          const headDoc = await User.findById(headId).select("legNumber").lean();
          leg = (headDoc as any)?.legNumber ?? null;
        }
        fromCaller = { leg, level };
      }
    }

    const prev = previousPeriodKeyFor(new Date());
    const hasPrev = await GenealogySnapshotRun.exists({ periodKey: prev, status: "completed" });
    const activeDelta = hasPrev
      ? team.filter((m) => m.nc === "active").length -
        (await GenealogySnapshot.countDocuments({
          periodKey: prev,
          nc: "active",
          userId: { $in: team.map((m) => new Types.ObjectId(m.id)) },
        }))
      : null;

    const hist = levelHistogram(team);
    const legSizes = new Map<string, number>();
    for (const m of team) {
      if (m.legHead) legSizes.set(m.legHead, (legSizes.get(m.legHead) || 0) + 1);
    }
    const legs = team
      .filter((m) => m.level === 1)
      .map((h) => ({
        leg: legNo.get(h.id) ?? null,
        userId: h.id,
        name: h.name,
        avatar: h.avatar,
        size: legSizes.get(h.id) || 0,
      }))
      .sort((a, b) => (a.leg ?? 1e9) - (b.leg ?? 1e9));

    return res.json({
      success: true,
      data: {
        root: toNode(tree.root, legNo),
        isSelf,
        fromCaller,
        totalTeam: team.length,
        directs: legs.length,
        deepestLevel: team.reduce((d, m) => Math.max(d, m.level), 0),
        activeNow: team.filter((m) => m.nc === "active").length,
        activeDelta,
        qualified: team.filter((m) => m.qualified).length,
        newThisMonth: team.filter((m) => m.joinedAt && new Date(m.joinedAt) >= since).length,
        levels: hist.map((people, i) => ({ level: i + 1, people })).filter((l) => l.people > 0),
        legs,
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /children/:nodeId ───────────────────────────────────────────────────
router.get("/children/:nodeId", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const nodeOid = await assertUnder(rootOid, req.params.nodeId);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const { page, limit } = pageOf(req);
    const nodeId = String(nodeOid);
    const kids = tree.members.filter((m) => m.parentId === nodeId && m.id !== nodeId);
    // Sibling order = legNumber (set at enrol/reparent time — can differ from
    // signup order), null last, then joinedAt ascending.
    const siblingLegNo = kids.length
      ? new Map(
          ((await User.find({ _id: { $in: kids.map((k) => new Types.ObjectId(k.id)) } })
            .select("_id legNumber")
            .lean()) as any[]).map((d) => [String(d._id), d.legNumber ?? null]),
        )
      : new Map<string, number | null>();
    kids.sort((a, b) => {
      const la = siblingLegNo.get(a.id) ?? null;
      const lb = siblingLegNo.get(b.id) ?? null;
      if (la == null && lb == null) return new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime();
      if (la == null) return 1;
      if (lb == null) return -1;
      return la - lb || new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime();
    });
    const slice = kids.slice((page - 1) * limit, page * limit);
    return res.json({
      success: true,
      data: {
        nodeId,
        children: slice.map((m) => toNode(m, legNo)),
        pagination: { page, limit, total: kids.length, hasMore: page * limit < kids.length },
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /path/:memberId ─────────────────────────────────────────────────────
router.get("/path/:memberId", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const mOid = await assertUnder(rootOid, req.params.memberId);
    const [tree, doc] = await Promise.all([
      loadTree(rootOid),
      User.findById(mOid).select("ancestors").lean(),
    ]);
    const legNo = await legNumbers(tree);
    const ids = pathFromRoot((doc as any)?.ancestors, String(rootOid), String(mOid)) || [];
    return res.json({
      success: true,
      data: { path: ids.map((id) => tree.byId.get(id)).filter(Boolean).map((m) => toNode(m!, legNo)) },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /search ─────────────────────────────────────────────────────────────
const STATUSES = new Set<MemberStatus>(["active", "qualified", "lapsed", "inactive"]);
const MATCH_ID_CAP = 5000;

router.get("/search", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const qs = q(req);
    const text = (qs.q || "").trim().toLowerCase();
    const statuses = list(qs.status).filter((s) => STATUSES.has(s as MemberStatus));
    const ranks = list(qs.rank).filter((r) => r === "unranked" || (RANK_KEYS as readonly string[]).includes(r));
    const legs = list(qs.leg).map(Number).filter((n) => Number.isFinite(n));
    const products = list(qs.product).filter((p) => p === "one_network" || p === "networkchains");
    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
    const parseDate = (s?: string) => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const from = parseDate(qs.joinedFrom);
    let to = parseDate(qs.joinedTo);
    const toExclusive = !!(to && qs.joinedTo && DATE_ONLY.test(qs.joinedTo));
    if (toExclusive) to = new Date(to!.getTime() + 24 * 60 * 60 * 1000);
    const activeOnly = qs.activeOnly === "1" || qs.activeOnly === "true";

    const hits = tree.members.filter((m) => {
      if (m.level < 1) return false;
      if (text && !m.name.toLowerCase().includes(text) && !(m.handle || "").toLowerCase().includes(text))
        return false;
      if (statuses.length && !statuses.includes(m.status)) return false;
      if (activeOnly && m.status !== "active" && m.status !== "qualified") return false;
      if (ranks.length && !ranks.includes(m.rank ?? "unranked")) return false;
      if (legs.length && !legs.includes(legNo.get(m.legHead || "") ?? -1)) return false;
      if (
        products.length &&
        !products.some((p) => (p === "one_network" && m.qualified) || (p === "networkchains" && m.nc !== "never"))
      )
        return false;
      if (from && (!m.joinedAt || new Date(m.joinedAt) < from)) return false;
      if (to) {
        const at = m.joinedAt ? new Date(m.joinedAt) : null;
        if (!at) return false;
        if (toExclusive ? at >= to : at > to) return false;
      }
      return true;
    });

    // Deterministic order: shallowest first, then name.
    hits.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const { page, limit } = pageOf(req);
    const slice = hits.slice((page - 1) * limit, page * limit);
    const ancestorsById = new Map(
      ((await User.find({ _id: { $in: slice.map((m) => new Types.ObjectId(m.id)) } })
        .select("_id ancestors")
        .lean()) as any[]).map((d) => [String(d._id), d.ancestors]),
    );
    // The ancestors are of the SHOWN matches, not of every hit: past the cap the
    // client can only draw what it was given, and a chain to a match it never
    // received would hang off nothing.
    const shown = hits.slice(0, MATCH_ID_CAP);
    return res.json({
      success: true,
      data: {
        total: hits.length,
        matchIds: shown.map((m) => m.id),
        // Lets the tree prune a filtered view to `matchIds ∪ matchAncestorIds`
        // instead of dimming everything else — see ancestorsOf().
        matchAncestorIds: ancestorsOf(shown, tree.members),
        truncated: hits.length > MATCH_ID_CAP,
        matches: slice.map((m) => ({
          ...toNode(m, legNo),
          path: pathFromRoot(ancestorsById.get(m.id), String(rootOid), m.id) || [],
        })),
        pagination: { page, limit, total: hits.length, hasMore: page * limit < hits.length },
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /member/:memberId ───────────────────────────────────────────────────
router.get("/member/:memberId", async (req, res) => {
  try {
    const me = caller(req);
    const { rootOid } = await resolveRoot(me, q(req).root);
    const mOid = await assertUnder(rootOid, req.params.memberId);
    const [tree, doc] = await Promise.all([
      loadTree(rootOid),
      User.findById(mOid).select("_id email phone referredBy ancestors depth").lean(),
    ]);
    const legNo = await legNumbers(tree);
    const m = tree.byId.get(String(mOid));
    if (!m || !doc) throw new GenealogyError(404, "MEMBER_NOT_FOUND");
    const d = doc as any;

    const [deepest, renewal, products, earnings] = await Promise.all([
      User.findOne({ ancestors: mOid }).sort({ depth: -1 }).select("depth").lean(),
      ncRenewalDate(mOid),
      productsBought(mOid),
      earningsFromMember(new Types.ObjectId(me), mOid),
    ]);
    const chainIds = pathFromRoot(d.ancestors, String(rootOid), String(mOid)) || [];
    const isMyDirect = d.referredBy && String(d.referredBy) === me;

    return res.json({
      success: true,
      data: {
        node: toNode(m, legNo),
        contact: isMyDirect ? { email: d.email || null, phone: d.phone || null } : null,
        position: { leg: toNode(m, legNo).leg, level: m.level },
        chain: chainIds.map((id) => ({ userId: id, name: tree.byId.get(id)?.name || "Unknown" })),
        stats: {
          joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : null,
          directs: m.directs,
          teamSize: m.teamSize,
          deepestUnder: deepest ? Math.max(0, ((deepest as any).depth ?? 0) - (d.depth ?? 0)) : 0,
        },
        oneNetwork: { qualified: m.qualified },
        networkChains: {
          status: m.nc,
          renewalDate: m.nc === "active" && renewal ? new Date(renewal).toISOString() : null,
        },
        products: products.map((p) => ({
          ...p,
          firstPaidAt: p.firstPaidAt ? new Date(p.firstPaidAt).toISOString() : null,
        })),
        personalVolumeUsd: m.volumeUsd,
        earnings,
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /legs ───────────────────────────────────────────────────────────────
router.get("/legs", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const heads = tree.members
      .filter((m) => m.level === 1)
      .sort((a, b) => (legNo.get(a.id) ?? 1e9) - (legNo.get(b.id) ?? 1e9));
    const totalTeam = tree.members.filter((m) => m.level >= 1).length;
    const summaries = summarizeLegs(tree.members, heads.map((h) => h.id));

    const plan = await RankPlan.findOne({ isActive: true }).lean();
    const [detail, pending] = await Promise.all([
      plan
        ? getUserRankDetail(String(rootOid), (plan as any).thirdPartyClientId)
        : Promise.resolve(null),
      pendingDirects(heads.map((h) => new Types.ObjectId(h.id))),
    ]);
    const bronzeTier = (plan as any)?.tiers?.find((t: any) => t.key === "Bronze");
    const now = new Date();
    const periodEndsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    return res.json({
      success: true,
      data: {
        totalTeam,
        legs: summaries.map((s, i) => ({
          head: toNode(heads[i], legNo),
          size: s.size,
          share: totalTeam ? s.size / totalTeam : 0,
          active: s.active,
          qualified: s.qualified,
          depth: s.depth,
          histogram: s.histogram,
          volumeUsd: s.volumeUsd,
          levelBonus: heads[i].qualified,
          highestRank:
            s.highestRank && (RANK_KEYS as readonly string[]).includes(s.highestRank.rank)
              ? s.highestRank
              : null,
        })),
        rank: {
          current:
            tree.root.rank && (RANK_KEYS as readonly string[]).includes(tree.root.rank)
              ? tree.root.rank
              : null,
          next: detail?.nextRank ?? null,
          activeDirects: detail?.activeDirects ?? heads.filter((h) => h.nc === "active").length,
          requiredActiveDirects: bronzeTier?.requiredActiveDirects ?? null,
          pendingDirects: pending,
          legsWithRank: heads.map((h) => ({
            leg: legNo.get(h.id) ?? null,
            userId: h.id,
            topRank: detail?.legs.find((l) => l.legHead.id === h.id)?.topRank ?? null,
          })),
          periodEndsAt: periodEndsAt.toISOString(),
          infinity: {
            qualifiedDirects: heads.filter((h) => h.qualified).length,
            t1Min: INFINITY_T1_MIN_LEGS,
            t2Min: INFINITY_T2_MIN_LEGS,
          },
        },
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /legs/:legHeadId/members ────────────────────────────────────────────
router.get("/legs/:legHeadId/members", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const headOid = await assertUnder(rootOid, req.params.legHeadId);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const head = tree.byId.get(String(headOid));
    if (!head || head.level !== 1) throw new GenealogyError(400, "NOT_A_LEG_HEAD");
    const limit = Math.min(20, Math.max(1, parseInt(q(req).limit || "5", 10) || 5));
    const rest = tree.members
      .filter((m) => m.legHead === head.id && m.id !== head.id)
      .sort((a, b) => b.teamSize - a.teamSize || a.level - b.level)
      .slice(0, limit - 1);
    return res.json({ success: true, data: { members: [head, ...rest].map((m) => toNode(m, legNo)) } });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /matrix ─────────────────────────────────────────────────────────────
router.get("/matrix", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const heads = tree.members
      .filter((m) => m.level === 1)
      .sort((a, b) => (legNo.get(a.id) ?? 1e9) - (legNo.get(b.id) ?? 1e9));
    const mx = buildMatrix(tree.members, heads.map((h) => h.id));
    return res.json({
      success: true,
      data: {
        legs: heads.map((h) => ({
          leg: legNo.get(h.id) ?? null,
          userId: h.id,
          name: h.name,
          avatar: h.avatar,
          levelBonus: h.qualified,
        })),
        ...mx,
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /level/:n/members ───────────────────────────────────────────────────
router.get("/level/:n/members", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const n = parseInt(req.params.n, 10);
    if (!Number.isFinite(n) || n < 1 || n > 16) throw new GenealogyError(400, "INVALID_LEVEL");
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const legRaw = q(req).leg ? parseInt(q(req).leg!, 10) : NaN;
    const leg = Number.isFinite(legRaw) ? legRaw : null;
    const inLevel = tree.members.filter(
      (m) =>
        m.level >= 1 &&
        levelBucket(m.level) === n &&
        (leg == null || (m.legHead && legNo.get(m.legHead) === leg)),
    );
    inLevel.sort((a, b) => new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime());
    const { page, limit } = pageOf(req);
    const slice = inLevel.slice((page - 1) * limit, page * limit);
    const counts = slice.length
      ? await Invoice.aggregate([
          {
            $match: {
              userId: { $in: slice.map((m) => new Types.ObjectId(m.id)) },
              status: "paid",
              // Wallet top-ups aren't products.
              "lineItems.itemType": { $nin: ["store_wallet_topup", "auction_wallet_topup"] },
              "metadata.kind": { $ne: "topup" },
            },
          },
          { $unwind: "$lineItems" },
          { $group: { _id: { u: "$userId", n: { $ifNull: ["$lineItems.itemName", "$lineItems.itemType"] } } } },
          { $group: { _id: "$_id.u", count: { $sum: 1 } } },
        ])
      : [];
    const countBy = new Map((counts as any[]).map((c) => [String(c._id), c.count]));
    return res.json({
      success: true,
      data: {
        level: n,
        people: inLevel.length,
        active: inLevel.filter((m) => m.nc === "active").length,
        rows: slice.map((m) => {
          const sp = m.parentId ? tree.byId.get(m.parentId) : null;
          return {
            ...toNode(m, legNo),
            sponsor: sp ? { userId: sp.id, name: sp.name } : null,
            productsCount: countBy.get(m.id) || 0,
          };
        }),
        pagination: { page, limit, total: inLevel.length, hasMore: page * limit < inLevel.length },
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

// ── GET /lite ───────────────────────────────────────────────────────────────
router.get("/lite", async (req, res) => {
  try {
    const { rootOid } = await resolveRoot(caller(req), q(req).root);
    const tree = await loadTree(rootOid);
    const legNo = await legNumbers(tree);
    const max = Math.min(10000, Math.max(1, parseInt(q(req).max || "3000", 10) || 3000));
    const ordered = [...tree.members].sort((a, b) => a.level - b.level);
    const slice = ordered.slice(0, max);
    return res.json({
      success: true,
      data: {
        nodes: slice.map((m) => ({
          id: m.id,
          parentId: m.parentId,
          leg: m.legHead ? legNo.get(m.legHead) ?? null : null,
          level: m.level,
          status: m.status,
        })),
        total: ordered.length,
        truncated: ordered.length > max,
      },
    });
  } catch (e) {
    return fail(res, e);
  }
});

export default router;
