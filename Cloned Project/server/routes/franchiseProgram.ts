import { Router, Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import {
  FranchiseProgram,
  FRANCHISE_PRICE_USD,
} from "../models/franchiseProgram.model";
import {
  FranchiseTerritoryAssignment,
  FranchiseGeoLevel,
} from "../models/franchiseTerritoryAssignment.model";
import { FranchiseReassignment } from "../models/franchiseReassignment.model";
import { FranchiseOffer } from "../models/franchiseOffer.model";
import {
  createFranchiseOffer,
  acceptFranchiseOffer,
  rejectFranchiseOffer,
  cancelFranchiseOffer,
  FranchiseOfferError,
} from "../services/franchiseOffer";
import { FranchiseCountry } from "../models/franchiseCountry.model";
import { FranchiseTerritory } from "../models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../models/franchiseSubTerritory.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";
import { createInvoice } from "../services/invoice";
import { PLATFORM_ORG_ID, PLATFORM_USER_EMAIL } from "../services/commission";
import { caseInsensitiveExact } from "../utils/territoryResolver";

/**
 * Founder franchise program API (authed; no frontend).
 *
 * A founder enrolls ONE office into a franchise program ($650/yr), configures
 * per-level commission %, and sells/assigns territories (from the global geo
 * catalog) to buyers who each pay $650/yr (or a custom price ≥ $650, the
 * excess going to the founder). Commissions are distributed on sales by the
 * commission STEP 5 distributor (see services/franchiseProgramCommission.ts).
 *
 * Phase 1: no buyer→buyer reassignment/resale (Phase 2).
 */
const router = Router();

// ─── PUBLIC ROUTES (no auth) ────────────────────────────────────────────
// Registered BEFORE `router.use(requireAuth)` so they bypass the auth
// middleware. Used by pre-login catalog / marketplace browsing surfaces.
// Handler function declarations are hoisted — see bottom of file.
router.get("/marketplace", handleMarketplace);
router.get("/offices/:officeId/listings/on-sale", handleOfficeListingsOnSale);
router.get("/offices/:officeId/assignments/all", handleOfficeAssignmentsAll);
router.get("/owners", handleOwners);
// ────────────────────────────────────────────────────────────────────────

router.use(requireAuth);

const FLOOR = FRANCHISE_PRICE_USD;

// ---- helpers --------------------------------------------------------------

/** Founder-of-office guard for /offices/:officeId/* (DB-checked membership). */
async function requireOfficeFounder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as any).user as { userId: string };
  const { officeId } = req.params as { officeId: string };
  if (!officeId || !Types.ObjectId.isValid(officeId)) {
    res.status(400).json({ error: "Valid officeId required" });
    return;
  }
  try {
    const dbUser = await User.findById(user.userId)
      .select("role organization organizations")
      .lean();
    if (!dbUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    if (
      dbUser.organization?.toString() === officeId &&
      ["admin", "founder"].includes((dbUser.role as string) || "")
    ) {
      next();
      return;
    }
    const membership = (dbUser.organizations as any[] | undefined)?.find(
      (m: any) => m.organization.toString() === officeId
    );
    if (membership && hasFounderAccess(membership)) {
      next();
      return;
    }
    res.status(403).json({ error: "Only founders of this office can do this" });
  } catch (err) {
    console.error("[franchise-program] founder guard error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

function programPayload(p: any) {
  return {
    id: String(p._id),
    officeId: String(p.officeId),
    founderUserId: String(p.founderUserId),
    status: p.status,
    currency: p.currency,
    commissionConfig: p.commissionConfig,
    subscription: {
      priceUSD: p.subscription?.priceUSD ?? FLOOR,
      period: p.subscription?.period ?? "yearly",
      invoiceId: p.subscription?.invoiceId ? String(p.subscription.invoiceId) : null,
      startedAt: p.subscription?.startedAt ?? null,
      expiresAt: p.subscription?.expiresAt ?? null,
    },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function assignmentPayload(a: any) {
  return {
    id: String(a._id),
    programId: String(a.programId),
    officeId: String(a.officeId),
    geoLevel: a.geoLevel,
    geoEntityId: a.geoEntityId,
    geoEntityName: a.geoEntityName ?? null,
    geoCountry: a.geoCountry ?? null,
    geoParentTerritory: a.geoParentTerritory ?? null,
    // ownerUserId/ownerEmail are null until a buyer claims a "listed" row.
    ownerUserId: a.ownerUserId ? String(a.ownerUserId) : null,
    ownerEmail: a.ownerEmail ?? null,
    priceUSD: a.priceUSD,
    status: a.status,
    // How the current owner acquired it: "original" (direct from founder) or
    // "resale" (via a buyer→buyer reassignment).
    acquisitionType: a.acquisitionType || "original",
    acquiredReassignmentId: a.acquiredReassignmentId
      ? String(a.acquiredReassignmentId)
      : null,
    // The invoice for this assignment's subscription (the one the owner pays /
    // paid). Surfaced top-level for convenience in /my/assignments.
    invoiceId: a.subscription?.invoiceId ? String(a.subscription.invoiceId) : null,
    subscription: {
      invoiceId: a.subscription?.invoiceId ? String(a.subscription.invoiceId) : null,
      startedAt: a.subscription?.startedAt ?? null,
      expiresAt: a.subscription?.expiresAt ?? null,
    },
    pendingReassignment: a.pendingReassignment
      ? {
          status: a.pendingReassignment.status,
          newOwnerEmail: a.pendingReassignment.newOwnerEmail,
          resalePriceUSD: a.pendingReassignment.resalePriceUSD,
          resellerUserId: String(a.pendingReassignment.resellerUserId),
          invoiceId: a.pendingReassignment.invoiceId
            ? String(a.pendingReassignment.invoiceId)
            : null,
          requestedAt: a.pendingReassignment.requestedAt ?? null,
          decidedAt: a.pendingReassignment.decidedAt ?? null,
        }
      : null,
    pendingResaleOffer: a.pendingResaleOffer
      ? {
          offerId: String(a.pendingResaleOffer.offerId),
          buyerUserId: String(a.pendingResaleOffer.buyerUserId),
          buyerEmail: a.pendingResaleOffer.buyerEmail,
          agreedPriceUSD: a.pendingResaleOffer.agreedPriceUSD,
          resaleInvoiceId: String(a.pendingResaleOffer.resaleInvoiceId),
          acceptedAt: a.pendingResaleOffer.acceptedAt,
        }
      : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/** Shape a FranchiseReassignment ledger row for the history endpoints. */
function reassignmentPayload(r: any) {
  return {
    id: String(r._id),
    programId: String(r.programId),
    officeId: String(r.officeId),
    assignmentId: String(r.assignmentId),
    geoLevel: r.geoLevel,
    geoEntityId: r.geoEntityId,
    geoEntityName: r.geoEntityName ?? null,
    status: r.status, // pending_approval | approved | rejected | completed | cancelled
    resellerUserId: String(r.resellerUserId),
    resellerEmail: r.resellerEmail ?? null,
    newOwnerUserId: String(r.newOwnerUserId),
    newOwnerEmail: r.newOwnerEmail,
    resalePriceUSD: r.resalePriceUSD,
    invoiceId: r.invoiceId ? String(r.invoiceId) : null,
    requestedAt: r.requestedAt ?? null,
    decidedAt: r.decidedAt ?? null,
    completedAt: r.completedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Load the catalog entity for a (level, id) pair, returning denorm fields. */
async function loadCatalogEntity(
  level: FranchiseGeoLevel,
  id: string
): Promise<{
  name?: string;
  country?: string;
  parentTerritory?: string;
  zipCodes?: string[];
} | null> {
  if (level === "country") {
    const c = await FranchiseCountry.findById(id).lean<any>();
    return c ? { name: c.name } : null;
  }
  if (level === "territory") {
    const t = await FranchiseTerritory.findById(id).lean<any>();
    return t ? { name: t.name, country: t.country } : null;
  }
  const s = await FranchiseSubTerritory.findById(id).lean<any>();
  return s
    ? {
        name: s.name,
        country: s.country,
        parentTerritory: s.parentTerritory,
        zipCodes: Array.isArray(s.zipCodes) ? s.zipCodes : [],
      }
    : null;
}

// ===========================================================================
// Founder endpoints (require founder of :officeId)
// ===========================================================================

/** POST /franchise-program/offices/:officeId/enroll */
router.post(
  "/offices/:officeId/enroll",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId } = req.params;
      const user = (req as any).user as { userId: string };

      const office = await Organization.findById(officeId)
        .select("name")
        .lean<any>();
      if (!office) {
        res.status(404).json({ error: "Office not found" });
        return;
      }

      let program = await FranchiseProgram.findOne({ officeId });
      if (program && program.status === "active") {
        res.status(409).json({
          error: "Program already active for this office",
          program: programPayload(program),
        });
        return;
      }
      if (!program) {
        program = await FranchiseProgram.create({
          officeId: new Types.ObjectId(officeId),
          founderUserId: new Types.ObjectId(user.userId),
          status: "pending_payment",
          subscription: { priceUSD: FLOOR, period: "yearly" },
        });
      }

      // Platform-collected subscription invoice ($650/yr).
      const founder = await User.findById(user.userId)
        .select("email name")
        .lean<any>();
      const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
        .select("_id")
        .lean<any>();
      if (!platformUser) {
        res.status(500).json({ error: "Platform user not configured" });
        return;
      }

      // Optional admin/promo coupon applied at enroll time. The buyer can also
      // apply one afterward via POST /api/invoices/:id/apply-platform-coupon.
      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      const invoice = await createInvoice({
        organizationId: PLATFORM_ORG_ID,
        sellerId: String(platformUser._id),
        userId: user.userId,
        customerEmail: founder?.email || "",
        customerName: founder?.name,
        lineItems: [
          {
            itemType: "franchise_program",
            itemId: String(program._id),
            itemName: `Franchise program — ${office.name}`,
            quantity: 1,
            unitPrice: FLOOR * 100,
            originalCurrency: "USD",
          },
        ],
        itemCurrency: "USD",
        isRecurring: true,
        recurringPeriod: "yearly",
        platformCouponCode: couponCode,
        metadata: { franchiseProgramId: String(program._id), officeId },
      });

      program.subscription = {
        ...(program.subscription as any),
        invoiceId: (invoice as any)._id,
      } as any;
      await program.save();

      res.status(201).json({
        program: programPayload(program),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        // Reflects any coupon discount applied at enroll time.
        amountUSD: ((invoice as any).totalAmount ?? FLOOR * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-program] enroll error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** GET /franchise-program/offices/:officeId */
router.get(
  "/offices/:officeId",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const program = await FranchiseProgram.findOne({
        officeId: req.params.officeId,
      }).lean();
      if (!program) {
        res.status(404).json({ error: "No program for this office" });
        return;
      }
      res.json({ program: programPayload(program) });
    } catch (err: any) {
      console.error("[franchise-program] get error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** PATCH /franchise-program/offices/:officeId/commissions */
router.patch(
  "/offices/:officeId/commissions",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { country, territory, subTerritory } = req.body || {};
      const next: any = {};
      for (const [k, v] of Object.entries({ country, territory, subTerritory })) {
        if (v === undefined) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          res.status(400).json({ error: `Invalid ${k}: must be 0–100` });
          return;
        }
        next[`commissionConfig.${k}`] = n;
      }
      if (Object.keys(next).length === 0) {
        res.status(400).json({ error: "Provide at least one of country/territory/subTerritory" });
        return;
      }
      const program = await FranchiseProgram.findOneAndUpdate(
        { officeId: req.params.officeId },
        { $set: next },
        { new: true }
      );
      if (!program) {
        res.status(404).json({ error: "No program for this office" });
        return;
      }
      res.json({ program: programPayload(program) });
    } catch (err: any) {
      console.error("[franchise-program] commissions error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * Media/display fields shared across catalog levels. Falls back gracefully:
 * countries/territories carry `flag` + `region` (used as continent); only
 * sub-territories carry `continent` and `coverImageUrl`. `image` is included
 * for forward-compat (currently unset on the catalog docs → null).
 */
function geoMedia(d: any) {
  return {
    flag: d.flag ?? null,
    continent: d.continent ?? d.region ?? null,
    coverImage: d.coverImageUrl ?? d.coverImage ?? null,
    image: d.image ?? null,
  };
}

/** GET /franchise-program/offices/:officeId/catalog?country=&state= */
router.get(
  "/offices/:officeId/catalog",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const country = (req.query.country as string | undefined)?.trim();
      const state = (req.query.state as string | undefined)?.trim();

      if (!country) {
        const countries = await FranchiseCountry.find()
          .select("_id name region status flag continent coverImageUrl image")
          .sort({ name: 1 })
          .limit(300)
          .lean();
        res.json({
          level: "country",
          items: countries.map((c: any) => ({
            geoLevel: "country",
            geoEntityId: String(c._id),
            name: c.name,
            region: c.region ?? null,
            ...geoMedia(c),
          })),
        });
        return;
      }
      if (!state) {
        const territories = await FranchiseTerritory.find({
          country: caseInsensitiveExact(country),
        })
          .select("_id name country region flag continent coverImageUrl image")
          .sort({ name: 1 })
          .limit(500)
          .lean();
        res.json({
          level: "territory",
          items: territories.map((t: any) => ({
            geoLevel: "territory",
            geoEntityId: String(t._id),
            name: t.name,
            country: t.country,
            region: t.region ?? null,
            ...geoMedia(t),
          })),
        });
        return;
      }
      const subs = await FranchiseSubTerritory.find({
        country: caseInsensitiveExact(country),
        parentTerritory: caseInsensitiveExact(state),
      })
        .select(
          "_id name country parentTerritory zipCodes flag continent region coverImageUrl image"
        )
        .sort({ name: 1 })
        .limit(500)
        .lean();
      res.json({
        level: "subTerritory",
        items: subs.map((s: any) => ({
          geoLevel: "subTerritory",
          geoEntityId: String(s._id),
          name: s.name,
          country: s.country,
          parentTerritory: s.parentTerritory,
          zipCodesCount: Array.isArray(s.zipCodes) ? s.zipCodes.length : 0,
          ...geoMedia(s),
        })),
      });
    } catch (err: any) {
      console.error("[franchise-program] catalog error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** POST /franchise-program/offices/:officeId/assignments */
router.post(
  "/offices/:officeId/assignments",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId } = req.params;
      const user = (req as any).user as { userId: string };
      const { geoLevel, geoEntityId, ownerEmail, priceUSD } = req.body || {};

      if (!["country", "territory", "subTerritory"].includes(geoLevel)) {
        res.status(400).json({ error: "Invalid geoLevel" });
        return;
      }
      if (!geoEntityId || typeof geoEntityId !== "string") {
        res.status(400).json({ error: "geoEntityId required" });
        return;
      }
      const email = String(ownerEmail || "").trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: "ownerEmail required" });
        return;
      }
      const price = Number(priceUSD);
      if (!Number.isFinite(price) || price < FLOOR) {
        res.status(400).json({ error: `priceUSD must be ≥ ${FLOOR}` });
        return;
      }

      const program = await FranchiseProgram.findOne({ officeId });
      if (!program || program.status !== "active") {
        res.status(409).json({
          error: "Office program is not active — enroll & pay first",
        });
        return;
      }

      const entity = await loadCatalogEntity(geoLevel, geoEntityId);
      if (!entity) {
        res.status(404).json({ error: "Catalog entity not found" });
        return;
      }

      const owner = await User.findOne({
        email: caseInsensitiveExact(email),
      })
        .select("_id email name")
        .lean<any>();
      if (!owner) {
        res.status(404).json({ error: "No Garage user with that email" });
        return;
      }

      // One owner per geo entity per program (unique index). Overwrite in
      // place for states with no buyer investment (cancelled / withdrawn /
      // listed). Reject only if a buyer has claimed / is paying / paid /
      // subscription lapsed — those are buyer-anchored and can't be
      // silently reassigned.
      const OVERWRITABLE_STATES = new Set([
        "cancelled",
        "withdrawn",
        "listed",
      ]);
      const existing = await FranchiseTerritoryAssignment.findOne({
        programId: program._id,
        geoLevel,
        geoEntityId,
      }).lean();
      if (existing && !OVERWRITABLE_STATES.has(existing.status)) {
        res.status(409).json({
          error: "Territory already assigned in this program",
          assignment: assignmentPayload(existing),
        });
        return;
      }

      const doc = {
        programId: program._id,
        officeId: new Types.ObjectId(officeId),
        geoLevel,
        geoEntityId,
        geoEntityName: entity.name,
        geoCountry: entity.country,
        geoParentTerritory: entity.parentTerritory,
        zipCodes: entity.zipCodes,
        ownerUserId: owner._id,
        ownerEmail: email,
        priceUSD: price,
        assignedByUserId: new Types.ObjectId(user.userId),
        status: "pending_payment" as const,
      };
      const assignment = existing
        ? await FranchiseTerritoryAssignment.findByIdAndUpdate(
            existing._id,
            { $set: doc },
            { new: true }
          )
        : await FranchiseTerritoryAssignment.create(doc);

      // Optional admin/promo coupon. A franchise_territory coupon discounts only
      // the $650 platform floor (the founder's markup is untouched). The buyer
      // can also apply one later via POST /api/invoices/:id/apply-platform-coupon.
      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      // Buyer's territory subscription invoice (price ≥ $650/yr). $650 floor is
      // platform revenue; the excess is credited to the founder at fulfilment.
      const invoice = await createInvoice({
        organizationId: officeId,
        sellerId: user.userId,
        userId: String(owner._id),
        customerEmail: owner.email,
        customerName: owner.name,
        lineItems: [
          {
            itemType: "franchise_territory",
            itemId: String((assignment as any)._id),
            itemName: `Franchise territory — ${entity.name}`,
            quantity: 1,
            unitPrice: Math.round(price * 100),
            originalCurrency: "USD",
          },
        ],
        itemCurrency: "USD",
        isRecurring: true,
        recurringPeriod: "yearly",
        platformCouponCode: couponCode,
        metadata: {
          franchiseProgramId: String(program._id),
          franchiseAssignmentId: String((assignment as any)._id),
          officeId,
        },
      });

      (assignment as any).subscription = {
        ...((assignment as any).subscription || {}),
        invoiceId: (invoice as any)._id,
      };
      await (assignment as any).save();

      res.status(201).json({
        assignment: assignmentPayload(assignment),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        // Reflects any floor coupon applied at assignment time.
        amountUSD: ((invoice as any).totalAmount ?? price * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-program] assign error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-program/offices/:officeId/assignments
 *
 * Query: ?status=listed|pending_payment|active|paused_lapsed|withdrawn|cancelled
 * Multiple statuses may be passed comma-separated (e.g. ?status=listed,active).
 */
router.get(
  "/offices/:officeId/assignments",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const program = await FranchiseProgram.findOne({
        officeId: req.params.officeId,
      })
        .select("_id")
        .lean();
      if (!program) {
        res.json({ assignments: [] });
        return;
      }
      const statusParam = (req.query.status as string | undefined)?.trim();
      const validStatuses = new Set([
        "listed",
        "pending_payment",
        "active",
        "paused_lapsed",
        "withdrawn",
        "cancelled",
      ]);
      const filter: any = { programId: program._id };
      if (statusParam) {
        const wanted = statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => validStatuses.has(s));
        if (wanted.length === 1) filter.status = wanted[0];
        else if (wanted.length > 1) filter.status = { $in: wanted };
      }
      const rows = await FranchiseTerritoryAssignment.find(filter)
        .sort({ createdAt: -1 })
        .lean();
      res.json({ assignments: rows.map(assignmentPayload) });
    } catch (err: any) {
      console.error("[franchise-program] list assignments error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-program/offices/:officeId/assignments/all  (PUBLIC — no auth)
 * Registered above `router.use(requireAuth)` at the top of the file — see
 * handleOfficeAssignmentsAll below.
 *
 * Any caller who knows an officeId (buyer browsing available territories,
 * franchise owner checking siblings, pre-login catalog surface) can list
 * every assignment on the office's program.
 *
 * Full payload is exposed intentionally per founder's direction — same
 * ownerEmail / priceUSD / pendingReassignment fields as the founder
 * endpoint. If future privacy needs arise, this is the right place to
 * redact.
 */
async function handleOfficeAssignmentsAll(req: Request, res: Response) {
  try {
    const { officeId } = req.params;
    if (!officeId || !Types.ObjectId.isValid(officeId)) {
      res.status(400).json({ error: "Valid officeId required" });
      return;
    }
    const program = await FranchiseProgram.findOne({ officeId })
      .select("_id")
      .lean();
    if (!program) {
      res.json({ assignments: [] });
      return;
    }
    const rows = await FranchiseTerritoryAssignment.find({
      programId: program._id,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ assignments: rows.map(assignmentPayload) });
  } catch (err: any) {
    console.error("[franchise-program] list-all assignments error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

/**
 * GET /franchise-program/offices/:officeId/earnings-breakdown
 *
 * Per-entity earnings + customer rollup for the office's franchise program.
 * Returns one row per assignment (owner) with total earnings, txn count,
 * and unique-customer count in the requested range. Optionally expands each
 * entity with its full list of buying customers.
 *
 * Query:
 *   ?from=ISO           optional lower bound on TerritoryWalletTransaction.createdAt
 *   ?to=ISO             optional upper bound (exclusive)
 *   ?includeCustomers=1 include per-entity customers[] array (default: off)
 *
 * Auth: founder of the office only (via requireOfficeFounder). Response
 * contains buyer emails/names, so it needs founder gating — do NOT expose
 * this shape on the /assignments/all public path.
 */
router.get(
  "/offices/:officeId/earnings-breakdown",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId } = req.params;
      const includeCustomers = req.query.includeCustomers === "1"
        || req.query.includeCustomers === "true";
      const fromRaw = req.query.from as string | undefined;
      const toRaw = req.query.to as string | undefined;
      const from = fromRaw ? new Date(fromRaw) : null;
      const to = toRaw ? new Date(toRaw) : null;
      if (fromRaw && (from === null || isNaN(from.getTime()))) {
        res.status(400).json({ error: "Invalid 'from' date" });
        return;
      }
      if (toRaw && (to === null || isNaN(to.getTime()))) {
        res.status(400).json({ error: "Invalid 'to' date" });
        return;
      }

      const program = await FranchiseProgram.findOne({ officeId })
        .select("_id currency commissionConfig")
        .lean();
      if (!program) {
        res.json({
          programId: null,
          officeId,
          range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
          totals: {
            totalEarnings: 0,
            transactionCount: 0,
            uniqueCustomerCount: 0,
            currency: "USD",
          },
          entities: [],
        });
        return;
      }

      // Only assignments with an actual owner can appear in an earnings
      // breakdown. Listed / withdrawn rows (no ownerUserId yet) would surface
      // as "undefined" in the payload and confuse the display. Cancelled +
      // paused_lapsed rows CAN show historical earnings so we keep them.
      const assignments = await FranchiseTerritoryAssignment.find({
        programId: program._id,
        ownerUserId: { $ne: null },
      }).lean();

      const dateFilter: any = {};
      if (from) dateFilter.$gte = from;
      if (to) dateFilter.$lt = to;
      const baseTxFilter: any = {
        franchiseProgramId: program._id,
        type: "credit",
      };
      if (Object.keys(dateFilter).length > 0) baseTxFilter.createdAt = dateFilter;

      // 1) Per-assignment aggregation.
      const byAssignment = await TerritoryWalletTransaction.aggregate([
        { $match: baseTxFilter },
        {
          $group: {
            _id: "$franchiseAssignmentId",
            totalEarnings: { $sum: "$amount" },
            transactionCount: { $sum: 1 },
            uniqueBuyerIds: { $addToSet: "$buyerUserId" },
            latestCurrency: { $last: "$currency" },
          },
        },
      ]);
      const aggByAssignmentId = new Map<string, any>();
      for (const row of byAssignment) {
        if (!row._id) continue;
        aggByAssignmentId.set(String(row._id), row);
      }

      // 2) Per-(assignment, buyer) rollup — only if requested.
      const customersByAssignmentId = new Map<string, any[]>();
      if (includeCustomers) {
        const byBuyer = await TerritoryWalletTransaction.aggregate([
          { $match: baseTxFilter },
          {
            $group: {
              _id: {
                assignmentId: "$franchiseAssignmentId",
                buyerUserId: "$buyerUserId",
              },
              totalPaid: { $sum: "$amount" },
              transactionCount: { $sum: 1 },
              firstPurchaseAt: { $min: "$createdAt" },
              lastPurchaseAt: { $max: "$createdAt" },
            },
          },
        ]);
        // Resolve buyer emails in one round-trip.
        const buyerIds = Array.from(
          new Set(
            byBuyer
              .map((r) => r._id?.buyerUserId)
              .filter(Boolean)
              .map(String)
          )
        );
        const users = buyerIds.length
          ? await User.find({
              _id: { $in: buyerIds.map((id) => new Types.ObjectId(id)) },
            })
              .select("_id email name profilePicture")
              .lean()
          : [];
        const userById = new Map(users.map((u: any) => [String(u._id), u]));
        for (const row of byBuyer) {
          const aid = row._id?.assignmentId
            ? String(row._id.assignmentId)
            : null;
          if (!aid) continue;
          const buyerId = row._id?.buyerUserId
            ? String(row._id.buyerUserId)
            : null;
          const u: any = buyerId ? userById.get(buyerId) : null;
          const entry = {
            userId: buyerId,
            email: u?.email ?? null,
            name: u?.name ?? null,
            profilePicture: u?.profilePicture ?? null,
            totalPaid: Math.round((row.totalPaid || 0) * 10000) / 10000,
            transactionCount: row.transactionCount || 0,
            firstPurchaseAt: row.firstPurchaseAt,
            lastPurchaseAt: row.lastPurchaseAt,
          };
          const list = customersByAssignmentId.get(aid) || [];
          list.push(entry);
          customersByAssignmentId.set(aid, list);
        }
        for (const list of customersByAssignmentId.values()) {
          list.sort((a, b) => (b.totalPaid || 0) - (a.totalPaid || 0));
        }
      }

      // 3) Build per-entity rows for every assignment (even zero-earners).
      const cfg = (program.commissionConfig as any) || {
        country: 0,
        territory: 0,
        subTerritory: 0,
      };
      const entities = assignments.map((a: any) => {
        const aid = String(a._id);
        const agg = aggByAssignmentId.get(aid);
        const uniqueBuyerCount = agg?.uniqueBuyerIds
          ? agg.uniqueBuyerIds.filter(Boolean).length
          : 0;
        const row: any = {
          assignmentId: aid,
          geoLevel: a.geoLevel,
          geoEntityId: a.geoEntityId,
          geoEntityName: a.geoEntityName ?? null,
          geoCountry: a.geoCountry ?? null,
          geoParentTerritory: a.geoParentTerritory ?? null,
          owner: {
            userId: a.ownerUserId ? String(a.ownerUserId) : null,
            email: a.ownerEmail ?? null,
          },
          splitPercentage: cfg?.[a.geoLevel as FranchiseGeoLevel] ?? 0,
          totalEarnings: Math.round((agg?.totalEarnings || 0) * 10000) / 10000,
          transactionCount: agg?.transactionCount || 0,
          uniqueCustomerCount: uniqueBuyerCount,
        };
        if (includeCustomers) {
          row.customers = customersByAssignmentId.get(aid) || [];
        }
        return row;
      });

      // 4) Program-wide totals — sum from aggregation, dedupe buyers across all
      //    assignments so uniqueCustomerCount is program-scoped, not additive.
      const allBuyerIds = new Set<string>();
      let totalEarnings = 0;
      let transactionCount = 0;
      for (const row of byAssignment) {
        totalEarnings += row.totalEarnings || 0;
        transactionCount += row.transactionCount || 0;
        for (const b of row.uniqueBuyerIds || []) {
          if (b) allBuyerIds.add(String(b));
        }
      }

      // Sort entities: earners first (biggest), then unearned by geo level order.
      entities.sort((a, b) => {
        if (b.totalEarnings !== a.totalEarnings) {
          return b.totalEarnings - a.totalEarnings;
        }
        const order: Record<string, number> = {
          country: 0,
          territory: 1,
          subTerritory: 2,
        };
        return (order[a.geoLevel] ?? 9) - (order[b.geoLevel] ?? 9);
      });

      res.json({
        programId: String(program._id),
        officeId,
        range: {
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
        },
        totals: {
          totalEarnings: Math.round(totalEarnings * 10000) / 10000,
          transactionCount,
          uniqueCustomerCount: allBuyerIds.size,
          currency: program.currency || "USD",
        },
        entities,
      });
    } catch (err: any) {
      console.error("[franchise-program] earnings-breakdown error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** DELETE /franchise-program/offices/:officeId/assignments/:assignmentId */
router.delete(
  "/offices/:officeId/assignments/:assignmentId",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId, assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const program = await FranchiseProgram.findOne({ officeId })
        .select("_id")
        .lean();
      if (!program) {
        res.status(404).json({ error: "No program for this office" });
        return;
      }
      const assignment = await FranchiseTerritoryAssignment.findOneAndUpdate(
        { _id: assignmentId, programId: program._id },
        { $set: { status: "cancelled" } },
        { new: true }
      );
      if (!assignment) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }
      res.json({ assignment: assignmentPayload(assignment) });
    } catch (err: any) {
      console.error("[franchise-program] cancel assignment error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ===========================================================================
// Listing marketplace (System B) — founder lists entities for open sale;
// any authenticated buyer can browse the marketplace and claim.
// See GLOBAL_FRANCHISE_API.md's self-buy for the mirrored pattern.
// ===========================================================================

/**
 * GET /franchise-program/offices/:officeId/available-entities
 *
 * Founder browses the catalog + sees per-entity availability status in ONE
 * call. Extends /catalog by joining FranchiseTerritoryAssignment.
 *
 * Query: ?country=&state=  (same drill as /catalog)
 *
 * Each returned item includes:
 *   assignmentStatus: "listed" | "pending_payment" | "active" |
 *                     "paused_lapsed" | "withdrawn" | "cancelled" | null
 *   priceUSD:         set when listed / claimed
 *   ownerEmail:       set when claimed
 *   assignmentId:     set for any existing row
 */
router.get(
  "/offices/:officeId/available-entities",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const country = (req.query.country as string | undefined)?.trim();
      const state = (req.query.state as string | undefined)?.trim();

      const program = await FranchiseProgram.findOne({
        officeId: req.params.officeId,
      })
        .select("_id")
        .lean();
      if (!program) {
        res.status(404).json({ error: "No franchise program for this office" });
        return;
      }

      let level: FranchiseGeoLevel;
      let items: any[];

      if (!country) {
        level = "country";
        const rows = await FranchiseCountry.find()
          .select("_id name region flag continent coverImageUrl image")
          .sort({ name: 1 })
          .limit(300)
          .lean();
        items = rows.map((c: any) => ({
          geoLevel: "country" as const,
          geoEntityId: String(c._id),
          name: c.name,
          region: c.region ?? null,
          ...geoMedia(c),
        }));
      } else if (!state) {
        level = "territory";
        const rows = await FranchiseTerritory.find({
          country: caseInsensitiveExact(country),
        })
          .select("_id name country region flag continent coverImageUrl image")
          .sort({ name: 1 })
          .limit(500)
          .lean();
        items = rows.map((t: any) => ({
          geoLevel: "territory" as const,
          geoEntityId: String(t._id),
          name: t.name,
          country: t.country,
          region: t.region ?? null,
          ...geoMedia(t),
        }));
      } else {
        level = "subTerritory";
        const rows = await FranchiseSubTerritory.find({
          country: caseInsensitiveExact(country),
          parentTerritory: caseInsensitiveExact(state),
        })
          .select(
            "_id name country parentTerritory zipCodes flag continent region coverImageUrl image"
          )
          .sort({ name: 1 })
          .limit(500)
          .lean();
        items = rows.map((s: any) => ({
          geoLevel: "subTerritory" as const,
          geoEntityId: String(s._id),
          name: s.name,
          country: s.country,
          parentTerritory: s.parentTerritory,
          zipCodesCount: Array.isArray(s.zipCodes) ? s.zipCodes.length : 0,
          ...geoMedia(s),
        }));
      }

      // Overlay assignment state for THIS program.
      const geoIds = items.map((i) => String(i.geoEntityId));
      const assignments = geoIds.length
        ? await FranchiseTerritoryAssignment.find({
            programId: program._id,
            geoLevel: level,
            geoEntityId: { $in: geoIds },
          })
            .select("_id status priceUSD ownerEmail geoEntityId")
            .lean()
        : [];
      const byGeoId = new Map<string, any>(
        assignments.map((a: any) => [String(a.geoEntityId), a])
      );

      const withStatus = items.map((it) => {
        const a = byGeoId.get(String(it.geoEntityId));
        return {
          ...it,
          assignmentId: a ? String(a._id) : null,
          assignmentStatus: a ? a.status : null,
          priceUSD: a ? a.priceUSD : null,
          ownerEmail: a?.ownerEmail ?? null,
        };
      });

      res.json({ level, items: withStatus });
    } catch (err: any) {
      console.error("[franchise-program] available-entities error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * POST /franchise-program/offices/:officeId/listings
 *
 * Founder creates 1..N listings in bulk. Each item independently succeeds or
 * fails — partial success is fine. Idempotent per entity: re-listing an
 * already-listed entity updates the price. Re-listing a withdrawn/cancelled
 * entity re-opens it. Entities in pending_payment / active / paused_lapsed
 * are skipped with a per-item reason.
 *
 * Body: { items: [{ geoLevel, geoEntityId, priceUSD }] }
 */
router.post(
  "/offices/:officeId/listings",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId } = req.params;
      const user = (req as any).user as { userId: string };
      const items: Array<{
        geoLevel: string;
        geoEntityId: string;
        priceUSD: number;
      }> = Array.isArray(req.body?.items) ? req.body.items : [];
      if (items.length === 0) {
        res.status(400).json({ error: "items[] required (non-empty)" });
        return;
      }
      if (items.length > 100) {
        res.status(400).json({ error: "Max 100 items per bulk request" });
        return;
      }

      const program = await FranchiseProgram.findOne({ officeId });
      if (!program || program.status !== "active") {
        res
          .status(409)
          .json({ error: "Office program is not active — enroll & pay first" });
        return;
      }

      const created: any[] = [];
      const updated: any[] = [];
      const skipped: Array<{
        geoLevel?: string;
        geoEntityId?: string;
        reason: string;
      }> = [];

      for (const raw of items) {
        try {
          const { geoLevel, geoEntityId, priceUSD } = raw || ({} as any);
          if (!["country", "territory", "subTerritory"].includes(geoLevel)) {
            skipped.push({ geoLevel, geoEntityId, reason: "Invalid geoLevel" });
            continue;
          }
          if (!geoEntityId || typeof geoEntityId !== "string") {
            skipped.push({ geoLevel, geoEntityId, reason: "geoEntityId required" });
            continue;
          }
          const price = Number(priceUSD);
          if (!Number.isFinite(price) || price < FLOOR) {
            skipped.push({
              geoLevel,
              geoEntityId,
              reason: `priceUSD must be ≥ ${FLOOR}`,
            });
            continue;
          }
          const entity = await loadCatalogEntity(
            geoLevel as FranchiseGeoLevel,
            geoEntityId
          );
          if (!entity) {
            skipped.push({ geoLevel, geoEntityId, reason: "Catalog entity not found" });
            continue;
          }

          const existing = await FranchiseTerritoryAssignment.findOne({
            programId: program._id,
            geoLevel,
            geoEntityId,
          });

          const CLAIMED_STATES = new Set([
            "pending_payment",
            "active",
            "paused_lapsed",
          ]);
          if (existing && CLAIMED_STATES.has(existing.status)) {
            skipped.push({
              geoLevel,
              geoEntityId,
              reason: `Already ${existing.status} — cannot list until released`,
            });
            continue;
          }

          // $set fields for the assignment doc. Owner + subscription fields
          // are handled via $unset (below) so we never mix $set:null with
          // $unset on the same path (Mongo rejects that as a conflict).
          const doc: any = {
            programId: program._id,
            officeId: new Types.ObjectId(officeId),
            geoLevel,
            geoEntityId,
            geoEntityName: entity.name,
            geoCountry: entity.country,
            geoParentTerritory: entity.parentTerritory,
            zipCodes: entity.zipCodes,
            priceUSD: price,
            assignedByUserId: new Types.ObjectId(user.userId),
            status: "listed" as const,
          };

          if (existing) {
            const upd = await FranchiseTerritoryAssignment.findOneAndUpdate(
              {
                _id: existing._id,
                status: { $in: ["listed", "withdrawn", "cancelled"] },
              },
              {
                $set: doc,
                // Wipe stale owner / subscription / pendingReassignment if
                // we're re-listing a withdrawn or cancelled row.
                $unset: {
                  ownerUserId: "",
                  ownerEmail: "",
                  subscription: "",
                  pendingReassignment: "",
                },
              },
              { new: true }
            );
            if (!upd) {
              skipped.push({
                geoLevel,
                geoEntityId,
                reason: "Row changed under us — try again",
              });
              continue;
            }
            // Distinguish "was already listed with same/different price" vs
            // "moved from withdrawn/cancelled → listed".
            if (existing.status === "listed") updated.push(assignmentPayload(upd));
            else created.push(assignmentPayload(upd));
          } else {
            try {
              const fresh = await FranchiseTerritoryAssignment.create(doc);
              created.push(assignmentPayload(fresh));
            } catch (createErr: any) {
              if (createErr?.code === 11000) {
                skipped.push({
                  geoLevel,
                  geoEntityId,
                  reason: "Concurrent create — try again",
                });
                continue;
              }
              throw createErr;
            }
          }
        } catch (itemErr) {
          console.error("[franchise-program] listing item error:", itemErr);
          skipped.push({
            geoLevel: raw?.geoLevel,
            geoEntityId: raw?.geoEntityId,
            reason: "Internal error",
          });
        }
      }

      res.status(201).json({ created, updated, skipped });
    } catch (err: any) {
      console.error("[franchise-program] create listings error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * PATCH /franchise-program/listings/:assignmentId
 *
 * Update the price on a listing. Only allowed when status="listed" — existing
 * pending_payment invoices already have the price baked in and won't change.
 *
 * Body: { priceUSD: number }
 */
router.patch(
  "/listings/:assignmentId",
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const price = Number(req.body?.priceUSD);
      if (!Number.isFinite(price) || price < FLOOR) {
        res.status(400).json({ error: `priceUSD must be ≥ ${FLOOR}` });
        return;
      }

      const row = await FranchiseTerritoryAssignment.findById(assignmentId);
      if (!row) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      // Founder-of-office auth via the row's officeId.
      const dbUser = await User.findById(user.userId)
        .select("role organization organizations")
        .lean<any>();
      const officeIdStr = String(row.officeId);
      const isPrimaryFounder =
        dbUser?.organization?.toString() === officeIdStr &&
        ["admin", "founder"].includes(dbUser?.role || "");
      const membership = (dbUser?.organizations as any[] | undefined)?.find(
        (m: any) => m.organization?.toString() === officeIdStr
      );
      if (
        !isPrimaryFounder &&
        !(membership && hasFounderAccess(membership))
      ) {
        res.status(403).json({ error: "Only founders can update listings" });
        return;
      }

      // CAS — only mutate if still in "listed" state.
      const upd = await FranchiseTerritoryAssignment.findOneAndUpdate(
        { _id: assignmentId, status: "listed" },
        { $set: { priceUSD: price } },
        { new: true }
      );
      if (!upd) {
        res.status(409).json({
          error:
            "Listing is not in 'listed' state — cannot update price (create a new listing after any pending buyer resolves).",
        });
        return;
      }
      res.json({ assignment: assignmentPayload(upd) });
    } catch (err: any) {
      console.error("[franchise-program] update listing error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * DELETE /franchise-program/listings/:assignmentId
 *
 * Withdraw a listing. Only allowed when status="listed". If a buyer has
 * already claimed (pending_payment) or paid (active/paused_lapsed), returns
 * 409 — the buyer's deal is sacred. Founder must use the existing
 * DELETE /offices/:officeId/assignments/:id path for claimed rows.
 */
router.delete(
  "/listings/:assignmentId",
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const row = await FranchiseTerritoryAssignment.findById(assignmentId);
      if (!row) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      const dbUser = await User.findById(user.userId)
        .select("role organization organizations")
        .lean<any>();
      const officeIdStr = String(row.officeId);
      const isPrimaryFounder =
        dbUser?.organization?.toString() === officeIdStr &&
        ["admin", "founder"].includes(dbUser?.role || "");
      const membership = (dbUser?.organizations as any[] | undefined)?.find(
        (m: any) => m.organization?.toString() === officeIdStr
      );
      if (
        !isPrimaryFounder &&
        !(membership && hasFounderAccess(membership))
      ) {
        res.status(403).json({ error: "Only founders can withdraw listings" });
        return;
      }

      const upd = await FranchiseTerritoryAssignment.findOneAndUpdate(
        { _id: assignmentId, status: "listed" },
        { $set: { status: "withdrawn" } },
        { new: true }
      );
      if (!upd) {
        const fresh = await FranchiseTerritoryAssignment.findById(assignmentId).lean();
        res.status(409).json({
          error:
            "Cannot withdraw — listing is either already claimed by a buyer or is not in 'listed' state.",
          assignment: fresh ? assignmentPayload(fresh) : undefined,
        });
        return;
      }
      res.json({ assignment: assignmentPayload(upd) });
    } catch (err: any) {
      console.error("[franchise-program] withdraw listing error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * POST /franchise-program/listings/:assignmentId/claim
 *
 * Buyer claims a listed territory. Mirrors POST /franchise-global/self-buy
 * for the global system. Any signed-in Garage user can claim.
 *
 * State matrix:
 *   listed                       → transition to pending_payment, set owner=self, mint invoice
 *   pending_payment (self)       → idempotent retry, return existing invoice
 *   pending_payment (other user) → take-over: cancel other's invoice, reassign, mint fresh
 *   active / paused_lapsed / withdrawn / cancelled → 409
 */
router.post(
  "/listings/:assignmentId/claim",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }

      const buyer = await User.findById(me.userId)
        .select("_id email name")
        .lean<any>();
      if (!buyer) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      const buyerEmail = String(buyer.email || "").trim().toLowerCase();
      if (!buyerEmail) {
        res.status(400).json({ error: "Your account has no email — cannot mint invoice" });
        return;
      }
      const buyerIdObj = new Types.ObjectId(String(buyer._id));

      const existing = await FranchiseTerritoryAssignment.findById(assignmentId);
      if (!existing) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      // 409 — active, paused_lapsed, withdrawn, or cancelled.
      if (
        existing.status === "active" ||
        existing.status === "paused_lapsed" ||
        existing.status === "withdrawn" ||
        existing.status === "cancelled"
      ) {
        res.status(409).json({
          error: `Cannot claim — listing is ${existing.status}`,
          assignment: assignmentPayload(existing.toObject()),
        });
        return;
      }

      const program = await FranchiseProgram.findById(existing.programId).lean<any>();
      if (!program || program.status !== "active") {
        res.status(409).json({ error: "Office program is not active" });
        return;
      }

      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      // Idempotent retry — same user already pending. Return existing invoice.
      if (
        existing.status === "pending_payment" &&
        String(existing.ownerUserId) === String(buyer._id)
      ) {
        const { Invoice } = await import("../models/invoice.model");
        const currentInvoiceId = existing.subscription?.invoiceId;
        const currentInvoice = currentInvoiceId
          ? await Invoice.findById(currentInvoiceId).lean<any>()
          : null;
        if (
          currentInvoice &&
          ["draft", "pending"].includes(currentInvoice.status)
        ) {
          res.status(200).json({
            assignment: assignmentPayload(existing.toObject()),
            invoiceId: String(currentInvoice._id),
            invoiceNumber: currentInvoice.invoiceNumber,
            amountUSD:
              (currentInvoice.totalAmount ?? existing.priceUSD * 100) / 100,
            retry: true,
          });
          return;
        }
        // Fall through — mint a fresh invoice on same row.
      }

      // Take-over — pending_payment owned by another user. Cancel their
      // invoice and re-assign to this buyer.
      if (
        existing.status === "pending_payment" &&
        String(existing.ownerUserId) !== String(buyer._id)
      ) {
        const { Invoice } = await import("../models/invoice.model");
        const prevInvoiceId = existing.subscription?.invoiceId;
        if (prevInvoiceId) {
          await Invoice.updateOne(
            {
              _id: prevInvoiceId,
              status: { $in: ["draft", "pending"] },
            },
            { $set: { status: "cancelled", cancelledAt: new Date() } }
          );
        }
      }

      // CAS-guarded assignment update.
      const doc: any = {
        ownerUserId: buyerIdObj,
        ownerEmail: buyerEmail,
        status: "pending_payment" as const,
        subscription: {},
      };
      const assignment = await FranchiseTerritoryAssignment.findOneAndUpdate(
        {
          _id: existing._id,
          status: { $in: ["listed", "pending_payment"] },
        },
        { $set: doc },
        { new: true }
      );
      if (!assignment) {
        const fresh = await FranchiseTerritoryAssignment.findById(
          existing._id
        ).lean();
        res.status(409).json({
          error:
            "Listing state changed while claim was in flight — try again.",
          assignment: fresh ? assignmentPayload(fresh) : undefined,
        });
        return;
      }

      // Mint invoice — same shape as the direct-assign flow above.
      const invoice = await createInvoice({
        organizationId: String(assignment.officeId),
        sellerId: String(program.founderUserId),
        userId: String(buyer._id),
        customerEmail: buyer.email,
        customerName: buyer.name,
        lineItems: [
          {
            itemType: "franchise_territory",
            itemId: String(assignment._id),
            itemName: `Franchise territory — ${assignment.geoEntityName || assignment.geoEntityId}`,
            quantity: 1,
            unitPrice: Math.round(assignment.priceUSD * 100),
            originalCurrency: "USD",
          },
        ],
        itemCurrency: "USD",
        isRecurring: true,
        recurringPeriod: "yearly",
        platformCouponCode: couponCode,
        metadata: {
          franchiseProgramId: String(assignment.programId),
          franchiseAssignmentId: String(assignment._id),
          officeId: String(assignment.officeId),
          claimedFromListing: true,
        },
      });

      assignment.subscription = {
        ...((assignment as any).subscription || {}),
        invoiceId: (invoice as any)._id,
      };
      await assignment.save();

      // Bump invoice draft → pending immediately (parity with global self-buy).
      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: (invoice as any)._id, status: "draft" },
        { $set: { status: "pending" } }
      );

      res.status(201).json({
        assignment: assignmentPayload(assignment),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        amountUSD:
          ((invoice as any).totalAmount ?? assignment.priceUSD * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-program] claim listing error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-program/marketplace  (PUBLIC — no auth)
 * Registered above `router.use(requireAuth)` at the top of the file.
 *
 * Platform-wide browse of listings — anyone can see every `status: "listed"`
 * row across ALL programs. Buyer picks one, calls POST /listings/:id/claim
 * to buy (that endpoint IS authed).
 *
 * Query:
 *   ?country=&state=&city=       geo filters (case-insensitive)
 *   ?geoLevel=country|territory|subTerritory
 *   ?officeId=<oid>              scope to a single office's program
 *   ?limit=50 (max 200)
 *   ?cursor=<assignmentId>       for cursor-based pagination
 */
async function handleMarketplace(req: Request, res: Response) {
  return runMarketplaceQuery(req, res);
}

// Internal — shared by both handleMarketplace and handleOfficeListingsOnSale.
// Kept separate so the router-facing handlers have a strict (req, res)
// signature (Express passes `next` as 3rd arg to real route handlers).
async function runMarketplaceQuery(
  req: Request,
  res: Response,
  overrideOfficeId?: string,
) {
  try {
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
    );
    const cursor = req.query.cursor as string | undefined;
    const country = (req.query.country as string | undefined)?.trim();
    const state = (req.query.state as string | undefined)?.trim();
    const city = (req.query.city as string | undefined)?.trim();
    const geoLevel = req.query.geoLevel as string | undefined;
    const officeIdFilter =
      overrideOfficeId ||
      (req.query.officeId as string | undefined)?.trim();

    if (cursor && !Types.ObjectId.isValid(cursor)) {
      res.status(400).json({ error: "Invalid cursor" });
      return;
    }
    if (officeIdFilter && !Types.ObjectId.isValid(officeIdFilter)) {
      res.status(400).json({ error: "Invalid officeId" });
      return;
    }

    const filter: any = { status: "listed" };
    if (
      geoLevel &&
      ["country", "territory", "subTerritory"].includes(geoLevel)
    ) {
      filter.geoLevel = geoLevel;
    }
    if (country) filter.geoCountry = caseInsensitiveExact(country);
    if (state) filter.geoParentTerritory = caseInsensitiveExact(state);
    if (city) filter.geoEntityName = caseInsensitiveExact(city);
    if (officeIdFilter) filter.officeId = new Types.ObjectId(officeIdFilter);
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

    const rows = await FranchiseTerritoryAssignment.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<any[]>();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Hydrate program + office info in one round-trip each.
    const programIds = Array.from(new Set(items.map((i) => String(i.programId))));
    const officeIds = Array.from(new Set(items.map((i) => String(i.officeId))));
    const [programs, offices] = await Promise.all([
      programIds.length
        ? FranchiseProgram.find({ _id: { $in: programIds } })
            .select("_id founderUserId officeId")
            .lean<any[]>()
        : [],
      officeIds.length
        ? Organization.find({ _id: { $in: officeIds }, parent: { $ne: true } })
            .select("_id name slug icon country state city")
            .lean<any[]>()
        : [],
    ]);
    const programById = new Map<string, any>(
      programs.map((p: any) => [String(p._id), p])
    );
    const officeById = new Map<string, any>(
      offices.map((o: any) => [String(o._id), o])
    );

    // Drop any listing whose office was excluded above (parent HQ).
    const listings = items
      .filter((a: any) => officeById.has(String(a.officeId)))
      .map((a: any) => {
        const prog = programById.get(String(a.programId));
        const office = officeById.get(String(a.officeId));
        return {
          ...assignmentPayload(a),
          program: prog
            ? {
                id: String(prog._id),
                founderUserId: String(prog.founderUserId),
              }
            : null,
          office: office
            ? {
                id: String(office._id),
                name: office.name || null,
                slug: office.slug || null,
                icon: office.icon || null,
                country: office.country || null,
                state: office.state || null,
                city: office.city || null,
              }
            : null,
        };
      });

    res.json({
      limit,
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      listings,
    });
  } catch (err: any) {
    console.error("[franchise-program] marketplace error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

/**
 * GET /franchise-program/offices/:officeId/listings/on-sale  (PUBLIC — no auth)
 *
 * Per-office variant of /marketplace — same shape, scoped to one office's
 * program. Used by pre-login office-detail pages that surface available
 * territories to prospective buyers.
 *
 * Query params: same as /marketplace (country/state/city/geoLevel/limit/cursor),
 * minus `officeId` (implicit from URL).
 */
async function handleOfficeListingsOnSale(req: Request, res: Response) {
  const officeId = req.params.officeId;
  if (!officeId || !Types.ObjectId.isValid(officeId)) {
    res.status(400).json({ error: "Valid officeId required" });
    return;
  }
  // Delegate to shared internal — officeId forced via arg (avoids mutating
  // req.query which is read-only in newer Express).
  await runMarketplaceQuery(req, res, officeId);
}

/** GET /franchise-program/offices/:officeId/summary */
router.get(
  "/offices/:officeId/summary",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const program = await FranchiseProgram.findOne({
        officeId: req.params.officeId,
      }).lean();
      if (!program) {
        res.status(404).json({ error: "No program for this office" });
        return;
      }

      const [assignments, payoutAgg] = await Promise.all([
        FranchiseTerritoryAssignment.find({ programId: program._id }).lean(),
        TerritoryWalletTransaction.aggregate([
          {
            $match: {
              source: "founder_program",
              franchiseProgramId: program._id,
              type: "credit",
            },
          },
          {
            $group: {
              _id: { entityId: "$entityId", entityName: "$entityName", level: "$entityType" },
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]),
      ]);

      const totalPaidOut = payoutAgg.reduce((s, r) => s + (r.total || 0), 0);
      const statusCounts: Record<string, number> = {};
      for (const a of assignments) {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      }

      res.json({
        program: programPayload(program),
        assignments: assignments.length,
        statusCounts,
        totalPaidOut: Math.round(totalPaidOut * 100) / 100,
        byEntity: payoutAgg.map((r) => ({
          level: r._id.level,
          geoEntityId: r._id.entityId,
          geoEntityName: r._id.entityName,
          total: Math.round((r.total || 0) * 100) / 100,
          transactions: r.count,
        })),
      });
    } catch (err: any) {
      console.error("[franchise-program] summary error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ===========================================================================
// Phase 2 — reassignment / resale
// ===========================================================================

/**
 * POST /franchise-program/assignments/:assignmentId/reassign-request
 * Current owner requests to resell their territory to a new user at a resale
 * price (≥ $650). Requires founder approval before the new owner is billed.
 */
router.post(
  "/assignments/:assignmentId/reassign-request",
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      const { newOwnerEmail, resalePriceUSD } = req.body || {};

      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const email = String(newOwnerEmail || "").trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: "newOwnerEmail required" });
        return;
      }
      const price = Number(resalePriceUSD);
      if (!Number.isFinite(price) || price < FLOOR) {
        res.status(400).json({ error: `resalePriceUSD must be ≥ ${FLOOR}` });
        return;
      }

      const assignment = await FranchiseTerritoryAssignment.findById(assignmentId);
      if (!assignment) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }
      // Only the current ACTIVE owner can resell.
      if (String(assignment.ownerUserId) !== String(user.userId)) {
        res.status(403).json({ error: "Only the current owner can reassign" });
        return;
      }
      if (assignment.status !== "active") {
        res.status(409).json({ error: "Only an active territory can be reassigned" });
        return;
      }
      if (assignment.pendingReassignment?.status === "pending_approval") {
        res.status(409).json({ error: "A reassignment is already pending approval" });
        return;
      }

      const newOwner = await User.findOne({ email: caseInsensitiveExact(email) })
        .select("_id")
        .lean<any>();
      if (!newOwner) {
        res.status(404).json({ error: "No Garage user with that email" });
        return;
      }
      if (String(newOwner._id) === String(user.userId)) {
        res.status(400).json({ error: "Cannot reassign to yourself" });
        return;
      }

      const requestedAt = new Date();
      // Durable ledger row (so completed/rejected resales remain queryable).
      const ledger = await FranchiseReassignment.create({
        programId: assignment.programId,
        officeId: assignment.officeId,
        assignmentId: assignment._id,
        geoLevel: assignment.geoLevel,
        geoEntityId: assignment.geoEntityId,
        geoEntityName: assignment.geoEntityName,
        resellerUserId: new Types.ObjectId(user.userId),
        resellerEmail: assignment.ownerEmail,
        fromOwnerUserId: assignment.ownerUserId,
        fromOwnerEmail: assignment.ownerEmail,
        newOwnerUserId: newOwner._id,
        newOwnerEmail: email,
        resalePriceUSD: price,
        status: "pending_approval",
        requestedAt,
      });

      assignment.pendingReassignment = {
        status: "pending_approval",
        resellerUserId: new Types.ObjectId(user.userId),
        newOwnerUserId: newOwner._id,
        newOwnerEmail: email,
        resalePriceUSD: price,
        requestedAt,
        reassignmentId: ledger._id,
      } as any;
      await assignment.save();

      res.status(201).json({
        assignment: assignmentPayload(assignment),
        reassignmentId: String(ledger._id),
      });
    } catch (err: any) {
      console.error("[franchise-program] reassign-request error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** GET /franchise-program/offices/:officeId/reassignments (founder: pending) */
router.get(
  "/offices/:officeId/reassignments",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const program = await FranchiseProgram.findOne({
        officeId: req.params.officeId,
      })
        .select("_id")
        .lean();
      if (!program) {
        res.json({ reassignments: [] });
        return;
      }
      const rows = await FranchiseTerritoryAssignment.find({
        programId: program._id,
        "pendingReassignment.status": "pending_approval",
      })
        .sort({ "pendingReassignment.requestedAt": -1 })
        .lean();
      res.json({ reassignments: rows.map(assignmentPayload) });
    } catch (err: any) {
      console.error("[franchise-program] list reassignments error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-program/offices/:officeId/reassignments/history
 *   ?status=pending_approval|approved|rejected|completed|cancelled & limit= & cursor=
 *
 * Founder: the durable resale ledger — EVERY reassignment (any status),
 * including completed ones that no longer appear in the pending list. Newest
 * first, cursor-paginated, optional status filter.
 */
router.get(
  "/offices/:officeId/reassignments/history",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const program = await FranchiseProgram.findOne({
        officeId: req.params.officeId,
      })
        .select("_id")
        .lean();
      if (!program) {
        res.json({ reassignments: [], nextCursor: null });
        return;
      }

      const status = req.query.status as string | undefined;
      const validStatuses = [
        "pending_approval",
        "approved",
        "rejected",
        "completed",
        "cancelled",
      ];
      if (status && !validStatuses.includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
      );
      const cursor = req.query.cursor as string | undefined;

      const filter: any = { programId: program._id };
      if (status) filter.status = status;
      if (cursor) {
        if (!Types.ObjectId.isValid(cursor)) {
          res.status(400).json({ error: "Invalid cursor" });
          return;
        }
        filter._id = { $lt: new Types.ObjectId(cursor) };
      }

      const rows = await FranchiseReassignment.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean();
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        reassignments: items.map(reassignmentPayload),
        nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      });
    } catch (err: any) {
      console.error("[franchise-program] reassignment history error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * POST /franchise-program/offices/:officeId/reassignments/:assignmentId/approve
 * Founder approves a pending reassignment → bills the new owner. On payment,
 * fulfilment transfers ownership and credits the reseller's markup.
 */
router.post(
  "/offices/:officeId/reassignments/:assignmentId/approve",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId, assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const program = await FranchiseProgram.findOne({ officeId }).lean();
      if (!program) {
        res.status(404).json({ error: "No program for this office" });
        return;
      }
      const assignment = await FranchiseTerritoryAssignment.findOne({
        _id: assignmentId,
        programId: program._id,
      });
      if (!assignment) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }
      const pr = assignment.pendingReassignment as any;
      if (!pr || pr.status !== "pending_approval") {
        res.status(409).json({ error: "No pending reassignment to approve" });
        return;
      }

      const newOwner = await User.findById(pr.newOwnerUserId)
        .select("_id email name")
        .lean<any>();
      if (!newOwner) {
        res.status(404).json({ error: "New owner user no longer exists" });
        return;
      }

      // Optional admin/promo coupon applied to the resale invoice. A
      // franchise_territory coupon discounts only the $650 platform floor — the
      // reseller's markup above $650 is never reduced. The new owner can also
      // apply one later via POST /api/invoices/:id/apply-platform-coupon.
      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      // Bill the new owner the resale price (≥ $650). $650 floor → platform,
      // excess → reseller (credited at fulfilment).
      const invoice = await createInvoice({
        organizationId: officeId,
        sellerId: String(pr.resellerUserId),
        userId: String(newOwner._id),
        customerEmail: newOwner.email,
        customerName: newOwner.name,
        lineItems: [
          {
            itemType: "franchise_territory",
            itemId: String(assignment._id),
            itemName: `Franchise territory (resale) — ${assignment.geoEntityName || assignment.geoEntityId}`,
            quantity: 1,
            unitPrice: Math.round(pr.resalePriceUSD * 100),
            originalCurrency: "USD",
          },
        ],
        itemCurrency: "USD",
        isRecurring: true,
        recurringPeriod: "yearly",
        platformCouponCode: couponCode,
        metadata: {
          franchiseProgramId: String(program._id),
          franchiseAssignmentId: String(assignment._id),
          officeId,
          kind: "resale",
        },
      });

      const decidedAt = new Date();
      pr.status = "approved";
      pr.invoiceId = (invoice as any)._id;
      pr.decidedAt = decidedAt;
      assignment.pendingReassignment = pr;
      await assignment.save();

      // Advance the durable ledger row → approved (+ invoice).
      if (pr.reassignmentId) {
        await FranchiseReassignment.updateOne(
          { _id: pr.reassignmentId },
          { $set: { status: "approved", invoiceId: (invoice as any)._id, decidedAt } }
        );
      }

      res.json({
        assignment: assignmentPayload(assignment),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        // Reflects any floor coupon applied at approval time.
        amountUSD: ((invoice as any).totalAmount ?? pr.resalePriceUSD * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-program] approve reassignment error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** POST /franchise-program/offices/:officeId/reassignments/:assignmentId/reject */
router.post(
  "/offices/:officeId/reassignments/:assignmentId/reject",
  requireOfficeFounder,
  async (req: Request, res: Response) => {
    try {
      const { officeId, assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const program = await FranchiseProgram.findOne({ officeId })
        .select("_id")
        .lean();
      if (!program) {
        res.status(404).json({ error: "No program for this office" });
        return;
      }
      const assignment = await FranchiseTerritoryAssignment.findOne({
        _id: assignmentId,
        programId: program._id,
      });
      if (!assignment || assignment.pendingReassignment?.status !== "pending_approval") {
        res.status(409).json({ error: "No pending reassignment to reject" });
        return;
      }
      const rejectedReassignmentId = assignment.pendingReassignment?.reassignmentId;
      // Clear the request; the territory stays with the current owner.
      assignment.pendingReassignment = null;
      await assignment.save();

      // Advance the durable ledger row → rejected.
      if (rejectedReassignmentId) {
        await FranchiseReassignment.updateOne(
          { _id: rejectedReassignmentId },
          { $set: { status: "rejected", decidedAt: new Date() } }
        );
      }
      res.json({ assignment: assignmentPayload(assignment) });
    } catch (err: any) {
      console.error("[franchise-program] reject reassignment error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ===========================================================================
// Territory owner endpoints (authed; any user)
// ===========================================================================

/**
 * GET /franchise-program/my/reassignments?role=reseller|buyer&status=&limit=&cursor=
 *
 * The authenticated user's resale history — rows where they were the reseller
 * (sold) and/or the new owner (bought via resale). `role` filters to one side;
 * omit for both. Includes all statuses.
 */
router.get("/my/reassignments", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const uid = new Types.ObjectId(user.userId);
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
    );
    const cursor = req.query.cursor as string | undefined;

    const filter: any = {};
    if (role === "reseller") filter.resellerUserId = uid;
    else if (role === "buyer") filter.newOwnerUserId = uid;
    else filter.$or = [{ resellerUserId: uid }, { newOwnerUserId: uid }];
    if (status) filter.status = status;
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    const rows = await FranchiseReassignment.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      reassignments: items.map((r: any) => ({
        ...reassignmentPayload(r),
        // convenience: which side the caller is on for this row
        myRole: String(r.resellerUserId) === user.userId ? "reseller" : "buyer",
      })),
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error("[franchise-program] my reassignments error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/** GET /franchise-program/my/assignments */
router.get("/my/assignments", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const rows = await FranchiseTerritoryAssignment.find({
      ownerUserId: user.userId,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ assignments: rows.map(assignmentPayload) });
  } catch (err: any) {
    console.error("[franchise-program] my assignments error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ===========================================================================
// Buyer-initiated resale offers (Phase 3)
//
// Coexists with the shipped owner-initiated + founder-approved resale flow
// above. Buyer offers > current owner's price → owner (not founder) accepts →
// prorated invoice for remaining current-cycle days → on payment ownership
// transfers, sub `expiresAt` preserved, 100% of paid → seller.
// See services/franchiseOffer.ts for policy + math.
// ===========================================================================

/** Shape a FranchiseOffer row for the API. */
function offerPayload(o: any) {
  return {
    id: String(o._id),
    assignmentId: String(o.assignmentId),
    programId: String(o.programId),
    officeId: String(o.officeId),
    geoLevel: o.geoLevel,
    geoEntityId: o.geoEntityId,
    geoEntityName: o.geoEntityName ?? null,
    fromUserId: String(o.fromUserId),
    fromEmail: o.fromEmail,
    toUserId: String(o.toUserId),
    toEmail: o.toEmail,
    currentPriceUSD: o.currentPriceUSD,
    offerPriceUSD: o.offerPriceUSD,
    message: o.message ?? null,
    status: o.status,
    respondedAt: o.respondedAt ?? null,
    expiresAt: o.expiresAt,
    invoiceId: o.invoiceId ? String(o.invoiceId) : null,
    resolutionTxRefs: o.resolutionTxRefs
      ? {
          resaleInvoiceId: o.resolutionTxRefs.resaleInvoiceId
            ? String(o.resolutionTxRefs.resaleInvoiceId)
            : null,
          renewalParentInvoiceId: o.resolutionTxRefs.renewalParentInvoiceId
            ? String(o.resolutionTxRefs.renewalParentInvoiceId)
            : null,
          sellerWalletTxId: o.resolutionTxRefs.sellerWalletTxId
            ? String(o.resolutionTxRefs.sellerWalletTxId)
            : null,
        }
      : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/** Uniform error handler for the service layer. */
function sendOfferError(res: Response, err: unknown): void {
  if (err instanceof FranchiseOfferError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const anyErr = err as any;
  console.error("[franchise-program] offer route error:", anyErr);
  res.status(500).json({ error: anyErr?.message || "Internal error" });
}

/**
 * POST /franchise-program/assignments/:assignmentId/offers
 * Body: { priceUSD, message? }
 * Any authed user can submit an offer to buy an active territory.
 */
router.post(
  "/assignments/:assignmentId/offers",
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      const { priceUSD, message } = req.body || {};
      const offer = await createFranchiseOffer({
        fromUserId: user.userId,
        assignmentId,
        offerPriceUSD: Number(priceUSD),
        message: typeof message === "string" ? message : undefined,
      });
      res.status(201).json({ offer: offerPayload(offer) });
    } catch (err) {
      sendOfferError(res, err);
    }
  },
);

/**
 * GET /franchise-program/offers/outgoing?status=&limit=&cursor=
 * Buyer's own submitted offers.
 */
router.get("/offers/outgoing", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const uid = new Types.ObjectId(user.userId);
    const status = req.query.status as string | undefined;
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
    );
    const cursor = req.query.cursor as string | undefined;

    const filter: any = { fromUserId: uid };
    if (status) filter.status = status;
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    const rows = await FranchiseOffer.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      offers: items.map(offerPayload),
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error("[franchise-program] outgoing offers error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-program/offers/incoming?status=&limit=&cursor=
 * Owner's inbox — offers received on their assignments. Sorted by offer
 * price desc within status=pending, else by newest.
 */
router.get("/offers/incoming", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const uid = new Types.ObjectId(user.userId);
    const status = req.query.status as string | undefined;
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
    );
    const cursor = req.query.cursor as string | undefined;

    const filter: any = { toUserId: uid };
    if (status) filter.status = status;
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    // For the pending inbox surface a "best price" bias; for history views
    // fall back to newest-first (the cursor is _id-based).
    const sort: any =
      status === "pending"
        ? { assignmentId: 1, offerPriceUSD: -1, _id: -1 }
        : { _id: -1 };

    const rows = await FranchiseOffer.find(filter)
      .sort(sort)
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      offers: items.map(offerPayload),
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error("[franchise-program] incoming offers error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /franchise-program/offers/:offerId/accept
 * Owner accepts → auto-rejects other pending offers on same assignment,
 * mints the prorated resale invoice, locks the assignment via
 * pendingResaleOffer until the invoice pays.
 */
router.post("/offers/:offerId/accept", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const out = await acceptFranchiseOffer({
      ownerUserId: user.userId,
      offerId: req.params.offerId,
    });
    res.status(201).json({
      offer: offerPayload(out.offer),
      assignment: assignmentPayload(out.assignment),
      invoiceId: out.invoiceId,
      invoiceNumber: out.invoiceNumber,
      amountUSD: out.amountUSD,
      daysRemaining: out.daysRemaining,
      autoRejectedCount: out.autoRejectedCount,
    });
  } catch (err) {
    sendOfferError(res, err);
  }
});

/** POST /franchise-program/offers/:offerId/reject — owner explicit reject. */
router.post("/offers/:offerId/reject", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const offer = await rejectFranchiseOffer({
      ownerUserId: user.userId,
      offerId: req.params.offerId,
    });
    res.json({ offer: offerPayload(offer) });
  } catch (err) {
    sendOfferError(res, err);
  }
});

/** POST /franchise-program/offers/:offerId/cancel — buyer withdraws. */
router.post("/offers/:offerId/cancel", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const offer = await cancelFranchiseOffer({
      buyerUserId: user.userId,
      offerId: req.params.offerId,
    });
    res.json({ offer: offerPayload(offer) });
  } catch (err) {
    sendOfferError(res, err);
  }
});

/** GET /franchise-program/my/earnings?limit=&cursor= */
router.get("/my/earnings", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200)
    );
    const cursor = req.query.cursor as string | undefined;

    const filter: any = {
      userId: new Types.ObjectId(user.userId),
      source: "founder_program",
    };
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }

    const rows = await TerritoryWalletTransaction.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      earnings: items.map((r: any) => ({
        id: String(r._id),
        amount: r.amount,
        currency: r.currency,
        level: r.entityType,
        geoEntityId: r.entityId,
        geoEntityName: r.entityName,
        franchiseProgramId: r.franchiseProgramId ? String(r.franchiseProgramId) : null,
        franchiseOfficeId: r.franchiseOfficeId ? String(r.franchiseOfficeId) : null,
        relatedItemName: r.relatedItemName || null,
        relatedSaleAmount: r.relatedSaleAmount ?? null,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error("[franchise-program] my earnings error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-program/owners
 *
 * PUBLIC (no auth). Lists every founder whose office has PAID for an
 * active FranchiseProgram — the "franchise owners" set. One row per
 * founder+office pair (each office has exactly one program, so this
 * is 1:1 with active programs).
 *
 * Query params (all optional):
 *   ?limit=50 (max 200)
 *   ?cursor=<programId>          — pagination on _id descending
 *   ?country=India               — case-insensitive exact match on office.country
 *   ?state=Karnataka             — case-insensitive exact match on office.state
 *   ?city=Bengaluru              — case-insensitive exact match on office.city
 *   ?search=<name>               — case-insensitive contains on office.name
 */
async function handleOwners(req: Request, res: Response) {
  try {
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
    );
    const cursor = req.query.cursor as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const country = (req.query.country as string | undefined)?.trim();
    const state = (req.query.state as string | undefined)?.trim();
    const city = (req.query.city as string | undefined)?.trim();

    if (cursor && !Types.ObjectId.isValid(cursor)) {
      res.status(400).json({ error: "Invalid cursor" });
      return;
    }

    const programFilter: any = { status: "active" };
    if (cursor) programFilter._id = { $lt: new Types.ObjectId(cursor) };

    const programs = await FranchiseProgram.find(programFilter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select(
        "officeId founderUserId subscription commissionConfig createdAt",
      )
      .lean<any[]>();

    const hasMore = programs.length > limit;
    const items = hasMore ? programs.slice(0, limit) : programs;

    if (items.length === 0) {
      res.json({ limit, nextCursor: null, owners: [] });
      return;
    }

    // Hydrate offices + founders in one round-trip each.
    const officeIds = items.map((p: any) => p.officeId);
    const founderIds = items.map((p: any) => p.founderUserId);

    const officeFilter: any = { _id: { $in: officeIds } };
    // Never surface the parent HQ (Garage App, slug `the-network-economy`)
    // in the public franchisor-programs feed — it exists as an org solely
    // to anchor platform-wide structure, not as a franchise buyers should
    // discover. Any office with `parent: true` is dropped here; the
    // .filter(Boolean) below then removes the program row entirely.
    officeFilter.parent = { $ne: true };
    if (country) officeFilter.country = caseInsensitiveExact(country);
    if (state) officeFilter.state = caseInsensitiveExact(state);
    if (city) officeFilter.city = caseInsensitiveExact(city);
    if (search) {
      officeFilter.name = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
    }

    const [offices, founders] = await Promise.all([
      Organization.find(officeFilter)
        .select(
          "name slug icon description country state city postalCode latitude longitude parent",
        )
        .lean<any[]>(),
      User.find({ _id: { $in: founderIds } })
        .select("name email profilePicture affiliateId")
        .lean<any[]>(),
    ]);

    const officeById = new Map(offices.map((o: any) => [String(o._id), o]));
    const founderById = new Map(founders.map((u: any) => [String(u._id), u]));

    // Filter-preserving mapping — a program is only surfaced if its office
    // matched the (country/state/city/search) filters above.
    const owners = items
      .map((p: any) => {
        const o = officeById.get(String(p.officeId));
        if (!o) return null; // filtered out by office filter
        const f = founderById.get(String(p.founderUserId));
        return {
          founder: {
            userId: String(p.founderUserId),
            name: f?.name || null,
            email: f?.email || null,
            profilePicture: f?.profilePicture || null,
            affiliateId: f?.affiliateId || null,
          },
          office: {
            id: String(o._id),
            name: o.name || null,
            slug: o.slug || null,
            icon: o.icon || null,
            description: o.description || null,
            country: o.country || null,
            state: o.state || null,
            city: o.city || null,
            postalCode: o.postalCode || null,
            latitude: o.latitude ?? null,
            longitude: o.longitude ?? null,
            parentHq: o.parent === true,
          },
          program: {
            id: String(p._id),
            enrolledAt: p.createdAt || null,
            renewsAt: p.subscription?.expiresAt || null,
            commissionConfig: p.commissionConfig || null,
          },
        };
      })
      .filter(Boolean);

    res.json({
      limit,
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      owners,
    });
  } catch (err) {
    console.error("[franchise-program] owners list error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

export default router;
