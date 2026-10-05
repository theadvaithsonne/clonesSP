/**
 * Internal catalog endpoints used by NetworkChainApi to mirror Garage's
 * sellable-item catalog into Qdrant.
 *
 * IMPORTANT: this endpoint is intentionally separate from the public
 * `/public/sellable-items` route in `public.ts`. That one paginates in
 * memory across 6 collections — fine for a small storefront listing, but
 * fatal at 5K+ items. Here we use **type-round-robin cursor pagination**
 * with `(updatedAt, _id)` continuation per type: bounded memory regardless
 * of catalog size.
 *
 * Auth: `Authorization: Bearer <OPENCLAW_NC_SERVICE_SECRET>`. If the secret
 * is unset on this side, every request returns 503 — we don't want a silent
 * unauthenticated fallback for a catalog dump endpoint.
 */
import { JobPosting } from "../models/jobPosting.model";
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import mongoose, { Model } from "mongoose";

import { env } from "../config/env";
import { Product } from "../models/product.model";
import { StoreProduct } from "../models/storeProduct.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Channel } from "../models/channel.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { Organization } from "../models/organization.model";
import { CombPlan } from "../models/combPlan.model";
import { Coupon } from "../models/coupon.model";
import { OfficePlan, OFFICE_COMMISSION_STRUCTURE } from "../models/officePlan.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { enqueueCatalogChange } from "../services/catalogOutbox.service";
import type { CatalogOutboxOp } from "../models/catalogOutbox.model";
import {
  LEGACY_DIGITAL_PRODUCT_FILTER,
  orgIdsWithActiveStore,
} from "../services/catalogVisibility";

const router = Router();

const ALL_TYPES = [
  "product",
  "storeproduct",
  "course",
  "workshop",
  "channel",
  "service",
  "call",
  "office",
  "job",
] as const;
type CatalogType = (typeof ALL_TYPES)[number];

// ── Auth ────────────────────────────────────────────────────────────────

function requireServiceSecret(req: Request, res: Response, next: NextFunction) {
  const validSecrets = [
    env.OPENCLAW_NC_SERVICE_SECRET,
    env.OPENCLAW_NC_SERVICE_SECRET_PREVIOUS,
  ].filter(Boolean);

  if (validSecrets.length === 0) {
    res
      .status(503)
      .json({ error: "internal-catalog disabled — secret not configured" });
    return;
  }

  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  const token = auth.slice(7).trim();
  const tokenBuf = Buffer.from(token);

  const ok = validSecrets.some((s) => {
    const sBuf = Buffer.from(s as string);
    if (sBuf.length !== tokenBuf.length) return false;
    return crypto.timingSafeEqual(sBuf, tokenBuf);
  });

  if (!ok) {
    res.status(401).json({ error: "invalid service secret" });
    return;
  }
  next();
}

router.use(requireServiceSecret);

// ── Helpers ────────────────────────────────────────────────────────────

interface TypeCursor {
  /** epoch ms of the last yielded item for this type */
  u: number;
  /** _id of the last yielded item (string) */
  i: string;
}

interface MultiCursor {
  /** per-type cursor; missing type means "start from `since`" */
  c: Partial<Record<CatalogType, TypeCursor>>;
}

function encodeCursor(c: MultiCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(s: string | undefined): MultiCursor {
  if (!s) return { c: {} };
  try {
    const buf = Buffer.from(s, "base64url");
    const obj = JSON.parse(buf.toString("utf8")) as MultiCursor;
    if (!obj || typeof obj !== "object" || !obj.c) return { c: {} };
    return obj;
  } catch {
    return { c: {} };
  }
}

interface PerTypeQuery {
  model: Model<any>;
  /** filter to apply on top of the cursor / since clauses */
  baseFilter: (includeDrafts: boolean) => Record<string, unknown>;
  /** mapper from raw doc to output `doc` */
  toDoc: (d: any) => any;
}

const TYPE_QUERIES: Record<CatalogType, PerTypeQuery> = {
  product: {
    model: Product,
    // Legacy `products` now backs DIGITAL offerings only (physical goods live in
    // `storeproducts`); physical docs left here are migration orphans that 404 on
    // garage.app/product/:id. Keep digital only in BOTH branches (status still
    // gates drafts). See catalogVisibility.
    baseFilter: (includeDrafts) =>
      includeDrafts
        ? { ...LEGACY_DIGITAL_PRODUCT_FILTER }
        : { status: "active", ...LEGACY_DIGITAL_PRODUCT_FILTER },
    toDoc: (d) => d,
  },
  // Physical/store products — owned by customer-app, mirrored read-only.
  // Only status:"active" storeproducts are purchasable on the storefront; the
  // active-store gate (org must have an active store doc) is applied at single-
  // item resolution — see GET /items/:type/:id.
  storeproduct: {
    model: StoreProduct,
    baseFilter: (includeDrafts) => (includeDrafts ? {} : { status: "active" }),
    toDoc: (d) => d,
  },
  course: {
    model: Course,
    baseFilter: (includeDrafts) =>
      includeDrafts ? {} : { status: "published" },
    toDoc: (d) => d,
  },
  workshop: {
    model: Workshop,
    baseFilter: (includeDrafts) =>
      includeDrafts ? {} : { isActive: true },
    toDoc: (d) => d,
  },
  channel: {
    model: Channel,
    baseFilter: (includeDrafts) =>
      includeDrafts ? {} : { isActive: true },
    toDoc: (d) => d,
  },
  service: {
    model: Service,
    baseFilter: (includeDrafts) =>
      includeDrafts ? {} : { status: "active" },
    toDoc: (d) => d,
  },
  call: {
    model: CallOffering,
    baseFilter: (includeDrafts) =>
      includeDrafts ? {} : { status: "published" },
    toDoc: (d) => d,
  },
  office: {
    // Organizations that aren't a parent are office HQs.
    model: Organization,
    baseFilter: () => ({ parent: { $ne: true } }),
    toDoc: (d) => d,
  },
  // Referral-reward job postings. "live" is the only status a candidate can
  // actually apply to — draft, paused, closed, filled and expired must never be
  // referred, and a posting whose reward is off or unfunded earns the affiliate
  // nothing, so it is not an offering either.
  job: {
    model: JobPosting,
    baseFilter: (includeDrafts) =>
      includeDrafts
        ? {}
        : {
            status: "live",
            // Without the public link the posting's own page 404s
            // (/public/job/:orgSlug/:jobSlug requires channels.publicLink), so
            // indexing it would mean recommending a dead end.
            "channels.publicLink": true,
            deletedAt: null,
            "reward.enabled": true,
            "reward.amount": { $gt: 0 },
          },
    toDoc: (d) => d,
  },
};

function _normalizeId(id: any): string {
  return String(id);
}

function _epochMs(d: any): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  if (typeof d === "string") {
    const t = Date.parse(d);
    return isNaN(t) ? 0 : t;
  }
  if (typeof d === "number") return d;
  return 0;
}

// Build the {updatedAt > since} OR {updatedAt = since AND _id > id} clause
function _continuationClause(
  sinceMs: number,
  cursor: TypeCursor | undefined,
): Record<string, unknown> {
  const sinceDate = new Date(sinceMs || 0);
  if (cursor && cursor.u >= sinceMs) {
    const cursorDate = new Date(cursor.u);
    let cursorObjId: any;
    try {
      cursorObjId = new mongoose.Types.ObjectId(cursor.i);
    } catch {
      // Non-ObjectId IDs (rare): fall through to a string compare.
      cursorObjId = cursor.i;
    }
    return {
      $or: [
        { updatedAt: { $gt: cursorDate } },
        { updatedAt: cursorDate, _id: { $gt: cursorObjId } },
      ],
    };
  }
  return { updatedAt: { $gte: sinceDate } };
}

// ── GET /internal/catalog/items ────────────────────────────────────────

router.get("/items", async (req: Request, res: Response) => {
  try {
    const limit = Math.max(
      1,
      Math.min(parseInt(String(req.query.limit ?? "500"), 10) || 500, 2000),
    );
    const sinceParam = String(req.query.since ?? "");
    let sinceMs = 0;
    if (sinceParam) {
      const parsed = Date.parse(sinceParam);
      if (!isNaN(parsed)) {
        sinceMs = parsed;
      } else {
        const asNum = parseInt(sinceParam, 10);
        if (!isNaN(asNum)) sinceMs = asNum;
      }
    }

    const includeDrafts = String(req.query.include_drafts ?? "") === "1";

    const typesParam = String(req.query.types ?? "").trim();
    const types: CatalogType[] = (typesParam
      ? typesParam.split(",").map((s) => s.trim())
      : Array.from(ALL_TYPES)
    ).filter((t): t is CatalogType =>
      (ALL_TYPES as readonly string[]).includes(t),
    );

    const incoming = decodeCursor(req.query.cursor as string | undefined);

    // Per-type query: pull `limit` rows starting from each type's continuation
    // point. Then merge-sort by (updatedAt, _id) and slice the first `limit`.
    const perTypePromises = types.map(async (t) => {
      const q = TYPE_QUERIES[t];
      const cont = _continuationClause(sinceMs, incoming.c[t]);
      const filter = { ...q.baseFilter(includeDrafts), ...cont };
      let rows = (await q.model
        .find(filter)
        .sort({ updatedAt: 1, _id: 1 })
        .limit(limit)
        .lean()) as any[];
      // Storeproducts is a foreign-authored collection; if customer-app
      // doesn't set `updatedAt`, the cursor continuation breaks. Fall
      // back to the ObjectId timestamp so the merge-sort + cursor
      // pagination still work for it. Cheap no-op for types that
      // already populate updatedAt.
      if (t === "storeproduct") {
        rows = rows.map((r) => {
          if (!r.updatedAt && r._id?.getTimestamp) {
            r.updatedAt = r._id.getTimestamp();
          }
          return r;
        });
      }
      return { type: t, rows };
    });

    const perType = await Promise.all(perTypePromises);

    // Merge: flat array with `{type, doc, _sortKey}`
    interface MergeItem {
      type: CatalogType;
      doc: any;
      sortMs: number;
    }
    const merged: MergeItem[] = [];
    for (const { type, rows } of perType) {
      for (const r of rows) {
        merged.push({ type, doc: r, sortMs: _epochMs(r.updatedAt) });
      }
    }
    merged.sort((a, b) => {
      if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
      return _normalizeId(a.doc._id).localeCompare(_normalizeId(b.doc._id));
    });

    const sliced = merged.slice(0, limit);

    // Build outgoing cursor: take the last seen (updatedAt, _id) per type that
    // appeared in the slice; for types that didn't surface any rows in the
    // slice, keep the incoming cursor (or omit if it was already empty).
    const outgoing: MultiCursor = {
      c: { ...incoming.c },
    };
    for (const item of sliced) {
      outgoing.c[item.type] = {
        u: item.sortMs,
        i: _normalizeId(item.doc._id),
      };
    }

    // hasMore: any per-type query returned exactly `limit` rows (could mean
    // there are more in that bucket); otherwise we're done.
    const hasMore =
      sliced.length === limit &&
      perType.some((pt) => pt.rows.length === limit);

    // Bulk-load CombPlan flags for the sliced items so the indexer can
    // gate `fits_sell` on commission availability without N+1 lookups.
    const planFlags = await _loadCombPlanFlags(
      sliced
        .filter((m) => m.type !== "office")
        .map((m) => ({ itemType: m.type, itemId: _normalizeId(m.doc._id) })),
    );

    // Resolve the selling org's name + slug once (batched) so each doc carries
    // a denormalized "Sold By" identity for the catalog index. Docs only store
    // an org *id*; the display name/slug live on the Organization.
    const orgIdentities = await _loadOrgIdentities(
      sliced.map((m) => _resolveOrgId(m.type, m.doc)),
    );

    const items = sliced.map((m) => {
      const id = _normalizeId(m.doc._id);
      const planKey = `${m.type}:${id}`;
      const orgId = _resolveOrgId(m.type, m.doc);
      return {
        type: m.type,
        id,
        orgId,
        updatedAt: m.doc.updatedAt instanceof Date
          ? m.doc.updatedAt.toISOString()
          : m.doc.updatedAt,
        deletedAt: null,
        doc: {
          ...m.doc,
          _hasCombPlan: planFlags.has(planKey),
          // Offices earn via the global office-referral structure (not a per-item
          // CombPlan), so surface the L1% here for consumers that value offices.
          ...(m.type === "office"
            ? { _officeLevel1Pct: OFFICE_COMMISSION_STRUCTURE.level1Percentage }
            : {}),
          ..._orgIdentityFields(m.type, m.doc, orgId, orgIdentities),
        },
      };
    });

    res.json({
      items,
      hasMore,
      nextCursor: hasMore ? encodeCursor(outgoing) : null,
    });
  } catch (err: any) {
    console.error("[internal-catalog] /items error", err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

function _resolveOrgId(type: CatalogType, doc: any): string | null {
  if (type === "office") return _normalizeId(doc._id);
  if (doc.organizationId) return _normalizeId(doc.organizationId);
  if (doc.orgId) return _normalizeId(doc.orgId);
  if (doc.storeId) return _normalizeId(doc.storeId);
  return null;
}

/** Batch-load `{ name, slug }` for the given org ids (deduped, nulls dropped). */
async function _loadOrgIdentities(
  orgIds: (string | null)[],
): Promise<Map<string, { name?: string; slug?: string }>> {
  const out = new Map<string, { name?: string; slug?: string }>();
  const uniq = [...new Set(orgIds.filter((x): x is string => !!x))];
  if (uniq.length === 0) return out;
  const orgs = (await Organization.find(
    { _id: { $in: uniq } },
    { name: 1, slug: 1 },
  ).lean()) as any[];
  for (const o of orgs) {
    out.set(_normalizeId(o._id), {
      name: o.name || undefined,
      slug: o.slug || undefined,
    });
  }
  return out;
}

/** Denormalized seller identity injected into each item's `doc` — the catalog
 *  index reads `orgSlug` / `orgName` from here for the "Sold By" field. For
 *  offices the item IS the organization, so its own name/slug apply. */
function _orgIdentityFields(
  type: CatalogType,
  doc: any,
  orgId: string | null,
  identities: Map<string, { name?: string; slug?: string }>,
): { orgSlug: string | null; orgName: string | null } {
  const ident =
    type === "office"
      ? { name: doc.name, slug: doc.slug }
      : orgId
        ? identities.get(orgId)
        : undefined;
  return {
    orgSlug: doc.orgSlug ?? ident?.slug ?? null,
    orgName: doc.orgName ?? ident?.name ?? null,
  };
}

/**
 * Bulk lookup: returns a Set of `${itemType}:${itemId}` strings for items
 * that have an active CombPlan. NC's payload builder reads this off
 * `doc._hasCombPlan` to gate `fits_sell` — items with no commission plan
 * are excluded from the "Sell" pitch flow.
 */
async function _loadCombPlanFlags(
  refs: Array<{ itemType: string; itemId: string }>,
): Promise<Set<string>> {
  const out = new Set<string>();
  if (refs.length === 0) return out;
  const orFilters = refs
    .filter((r) => mongoose.Types.ObjectId.isValid(r.itemId))
    .map((r) => ({
      itemType: r.itemType,
      itemId: new mongoose.Types.ObjectId(r.itemId),
    }));
  if (orFilters.length === 0) return out;
  const rows = await CombPlan.find(
    { isActive: true, $or: orFilters },
    { itemType: 1, itemId: 1 },
  ).lean();
  for (const r of rows) {
    out.add(`${r.itemType}:${_normalizeId(r.itemId)}`);
  }
  return out;
}

/**
 * Bulk lookup: returns `${itemType}:${itemId}` → level-1 commission percentage
 * (the direct-referrer share) for items with an active CombPlan. Items with no
 * plan / no level-1 entry are simply absent from the map. Drives the EarnGPT
 * product picker's "L1 earn" line + commission ranking.
 */
async function _loadLevel1Pct(
  refs: Array<{ itemType: string; itemId: string }>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (refs.length === 0) return out;
  // Store products carry their comb plan under itemType "product" (keyed by the
  // storeproduct _id) — the convention checkout uses when distributing
  // commission (see invoice.ts ecommerce_item path). Normalize for the query,
  // then key results back to the ORIGINAL itemType the caller sent.
  const normType = (t: string) => (t === "storeproduct" ? "product" : t);
  const valid = refs.filter((r) => mongoose.Types.ObjectId.isValid(r.itemId));
  if (valid.length === 0) return out;
  const rows = await CombPlan.find(
    {
      isActive: true,
      $or: valid.map((r) => ({
        itemType: normType(r.itemType),
        itemId: new mongoose.Types.ObjectId(r.itemId),
      })),
    },
    { itemType: 1, itemId: 1, levels: 1 },
  ).lean();
  const planByKey = new Map<string, number>();
  for (const r of rows) {
    const l1 = Array.isArray(r.levels)
      ? r.levels.find((l: any) => l?.level === 1)
      : undefined;
    if (l1 && typeof l1.percentage === "number") {
      planByKey.set(`${r.itemType}:${_normalizeId(r.itemId)}`, l1.percentage);
    }
  }
  for (const r of valid) {
    const pct = planByKey.get(`${normType(r.itemType)}:${r.itemId}`);
    if (typeof pct === "number") out.set(`${r.itemType}:${r.itemId}`, pct);
  }
  return out;
}

// ── GET /internal/catalog/items/:type/:id ──────────────────────────────

router.get("/items/:type/:id", async (req: Request, res: Response) => {
  const { type, id } = req.params;
  if (!(ALL_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: "invalid type" });
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const q = TYPE_QUERIES[type as CatalogType];
  const includeDrafts = String(req.query.include_drafts ?? "") === "1";
  try {
    // Apply the same visibility gate the bulk feed uses, so an archived / draft /
    // physical-legacy-orphan item resolves as 404 here too — otherwise EarnGPT
    // could enrich (and recommend) an item that 404s on garage.app even after
    // it's been dropped from the search index.
    const doc = (await q.model
      .findOne({ _id: id, ...q.baseFilter(includeDrafts) })
      .lean()) as any;
    if (!doc) {
      res.status(404).json({ error: "not found" });
      return;
    }
    // Storeproducts additionally render only when their org has an active store.
    if (type === "storeproduct" && !includeDrafts) {
      const spOrgId = _resolveOrgId(type as CatalogType, doc);
      const liveOrgs = await orgIdsWithActiveStore(spOrgId ? [spOrgId] : []);
      if (!spOrgId || !liveOrgs.has(String(spOrgId))) {
        res.status(404).json({ error: "not found" });
        return;
      }
    }
    const planFlags =
      type !== "office"
        ? await _loadCombPlanFlags([{ itemType: type, itemId: id }])
        : new Set<string>();
    const orgId = _resolveOrgId(type as CatalogType, doc);
    const orgIdentities = await _loadOrgIdentities([orgId]);
    res.json({
      item: {
        type,
        id: _normalizeId(doc._id),
        orgId,
        updatedAt:
          doc.updatedAt instanceof Date
            ? doc.updatedAt.toISOString()
            : doc.updatedAt,
        doc: {
          ...doc,
          _hasCombPlan: planFlags.has(`${type}:${id}`),
          ..._orgIdentityFields(type as CatalogType, doc, orgId, orgIdentities),
        },
      },
    });
  } catch (err: any) {
    console.error(`[internal-catalog] /items/${type}/${id} error`, err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

// ── POST /internal/catalog/comb-plan-l1 ────────────────────────────────
// Batch level-1 (direct-referrer) commission % for a list of catalog items.
// Body: { items: [{ itemType, itemId }, ...] }  (cap 250)
// Resp: { commissions: [{ itemType, itemId, level1Pct }] }  (null if no plan)
router.post("/comb-plan-l1", async (req: Request, res: Response) => {
  try {
    const raw = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = raw
      .filter(
        (it: any) =>
          it &&
          typeof it.itemType === "string" &&
          typeof it.itemId === "string",
      )
      .slice(0, 250)
      .map((it: any) => ({ itemType: it.itemType, itemId: it.itemId }));

    const pctMap = await _loadLevel1Pct(items);
    const commissions = items.map((it: { itemType: string; itemId: string }) => ({
      itemType: it.itemType,
      itemId: it.itemId,
      level1Pct: pctMap.get(`${it.itemType}:${it.itemId}`) ?? null,
    }));
    res.json({ commissions });
  } catch (err: any) {
    console.error("[internal-catalog] /comb-plan-l1 error", err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

// ── GET /internal/catalog/count ────────────────────────────────────────

router.get("/count", async (req: Request, res: Response) => {
  try {
    const typesParam = String(req.query.types ?? "").trim();
    const types: CatalogType[] = (typesParam
      ? typesParam.split(",").map((s) => s.trim())
      : Array.from(ALL_TYPES)
    ).filter((t): t is CatalogType =>
      (ALL_TYPES as readonly string[]).includes(t),
    );

    const includeDrafts = String(req.query.include_drafts ?? "") === "1";

    const counts: Record<string, number> = {};
    let total = 0;
    for (const t of types) {
      const q = TYPE_QUERIES[t];
      const n = await q.model.countDocuments(q.baseFilter(includeDrafts));
      counts[t] = n;
      total += n;
    }
    res.json({ counts, total });
  } catch (err: any) {
    console.error("[internal-catalog] /count error", err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

// ── Notify (external authors → outbox) ───────────────────────────────────
//
// Store products are authored in an external storefront backend, so their
// create/update/delete never passes through this service's Mongoose hooks.
// The storefront calls this endpoint as a side-effect of every mutation,
// which drops the change onto the same CatalogOutbox the 7 hooked types use
// — so it flows through dispatcher → NC webhook → Qdrant exactly like the
// rest. Generic over itemType so any future external author can use it.
//
// Auth: same bearer service secret as the rest of this router (router.use
// above). Body: { itemType, itemId, op }.
interface NotifyEntry {
  itemType: CatalogType;
  itemId: string;
  op: CatalogOutboxOp;
}

/** Validate one notify entry. Returns a typed entry or an error string. */
function validateNotifyEntry(raw: unknown): NotifyEntry | string {
  const { itemType, itemId, op } = (raw ?? {}) as {
    itemType?: string;
    itemId?: string;
    op?: string;
  };
  if (!itemType || !(ALL_TYPES as readonly string[]).includes(itemType)) {
    return `invalid itemType: ${itemType}`;
  }
  if (!itemId || typeof itemId !== "string") {
    return "missing itemId";
  }
  if (op !== "upsert" && op !== "delete") {
    return `invalid op: ${op} (expected upsert|delete)`;
  }
  return { itemType: itemType as CatalogType, itemId, op };
}

router.post("/notify", async (req: Request, res: Response) => {
  try {
    const entry = validateNotifyEntry(req.body);
    if (typeof entry === "string") {
      res.status(400).json({ error: entry });
      return;
    }
    await enqueueCatalogChange(entry.itemType, entry.itemId, entry.op);
    res.status(202).json({ ok: true, ...entry });
  } catch (err: any) {
    console.error("[internal-catalog] /notify error", err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

// ── Batch notify (bulk imports / bulk edits) ─────────────────────────────
//
// One call for many changes, so a bulk import doesn't fan out into N HTTP
// round-trips. Body: { items: [{ itemType, itemId, op }, ...] }. Each entry
// is validated independently; valid ones are enqueued, invalid ones are
// reported back without failing the whole batch. Capped at MAX_BATCH to
// keep a single request bounded — chunk larger imports client-side.
const MAX_NOTIFY_BATCH = 500;

router.post("/notify/batch", async (req: Request, res: Response) => {
  try {
    const items = (req.body?.items ?? null) as unknown;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "body must be { items: [...] }" });
      return;
    }
    if (items.length === 0) {
      res.status(400).json({ error: "items is empty" });
      return;
    }
    if (items.length > MAX_NOTIFY_BATCH) {
      res
        .status(400)
        .json({ error: `too many items (max ${MAX_NOTIFY_BATCH})` });
      return;
    }

    const accepted: NotifyEntry[] = [];
    const rejected: { index: number; error: string }[] = [];
    items.forEach((raw, index) => {
      const entry = validateNotifyEntry(raw);
      if (typeof entry === "string") rejected.push({ index, error: entry });
      else accepted.push(entry);
    });

    // Enqueue accepted entries. enqueueCatalogChange swallows its own
    // errors (logs + lets the reconciler catch up), so settle-all is fine.
    await Promise.allSettled(
      accepted.map((e) => enqueueCatalogChange(e.itemType, e.itemId, e.op)),
    );

    res.status(202).json({
      ok: true,
      enqueued: accepted.length,
      rejected,
    });
  } catch (err: any) {
    console.error("[internal-catalog] /notify/batch error", err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

// ── GET /internal/catalog/coupons ──────────────────────────────────────────
// Active coupons ("offers") + the item(s) each is attached to. Consumed by the
// contacts-backend admin "Offerings" page, where every active coupon surfaces as
// its own "Offer" row alongside the product it discounts. A coupon is ALWAYS tied
// to product(s) via `applicableTo` (types) + `specificItemIds` (exact items).
router.get("/coupons", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const coupons = await Coupon.find({
      status: "active",
      validFrom: { $lte: now },
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: null },
        { validUntil: { $gte: now } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();

    // Resolve linked item names for every specificItemId across the coupons, in a
    // few batched queries (ids don't carry their type, so probe each model).
    const allIds = Array.from(
      new Set(
        coupons.flatMap((c) =>
          (c.specificItemIds || []).map((id: any) => String(id)),
        ),
      ),
    ).map((s) => {
      try {
        return new mongoose.Types.ObjectId(s);
      } catch {
        return s;
      }
    });

    const nameById = new Map<string, { name: string; itemType: string }>();
    if (allIds.length > 0) {
      const probes: Array<[string, Model<any>]> = [
        ["product", Product],
        ["course", Course],
        ["workshop", Workshop],
        ["channel", Channel],
        ["office_plan", OfficePlan],
        ["office_addon", OfficeAddon],
      ];
      await Promise.all(
        probes.map(async ([itemType, model]) => {
          const docs = await model
            .find({ _id: { $in: allIds } })
            .select({ name: 1, title: 1 })
            .lean();
          for (const d of docs as any[]) {
            nameById.set(String(d._id), {
              name: d.name || d.title || String(d._id),
              itemType,
            });
          }
        }),
      );
    }

    // Resolve org names for org-scoped coupons (so the UI can say which HQ an
    // offer belongs to when it isn't tied to one specific item).
    const couponOrgIds = Array.from(
      new Set(
        coupons.filter((c: any) => c.orgId).map((c: any) => String(c.orgId)),
      ),
    );
    const couponOrgNames = await _loadOrgIdentities(couponOrgIds);

    const out = coupons.map((c: any) => ({
      _id: String(c._id),
      code: c.code,
      name: c.name,
      description: c.description ?? null,
      discountValue: c.discountValue,
      maxDiscountAmount: c.maxDiscountAmount ?? null,
      scope: c.scope,
      orgId: c.orgId ? String(c.orgId) : null,
      orgName: c.orgId ? couponOrgNames.get(String(c.orgId))?.name ?? null : null,
      applicableTo: c.applicableTo || [],
      validFrom: c.validFrom,
      validUntil: c.validUntil ?? null,
      currentUsageCount: c.currentUsageCount ?? 0,
      maxUsageCount: c.maxUsageCount ?? null,
      minOrderAmount: c.minOrderAmount ?? null,
      // The concrete item(s) this offer is attached to (resolved names where the
      // id matched a live item; unresolved ids are still returned by id).
      linkedItems: (c.specificItemIds || []).map((id: any) => {
        const key = String(id);
        const hit = nameById.get(key);
        return {
          itemId: key,
          itemType: hit?.itemType ?? null,
          name: hit?.name ?? null,
        };
      }),
    }));

    res.json({ coupons: out });
  } catch (err: any) {
    console.error("[internal-catalog] /coupons error", err);
    res.status(500).json({ error: err?.message || "internal error" });
  }
});

export default router;
