import { Router, Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { FranchiseCountry } from "../models/franchiseCountry.model";
import { FranchiseTerritory } from "../models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../models/franchiseSubTerritory.model";
import {
  FranchiseGlobalAssignment,
  FranchiseGlobalGeoLevel,
} from "../models/franchiseGlobalAssignment.model";
import { FRANCHISE_PRICE_USD } from "../models/franchiseProgram.model";
import { createInvoice } from "../services/invoice";
import { PLATFORM_ORG_ID, PLATFORM_USER_EMAIL } from "../services/commission";
import { caseInsensitiveExact } from "../utils/territoryResolver";
import { FranchiseGlobalOfferError } from "../services/franchiseGlobalOffer";

/**
 * Global-catalog franchise API (System A).
 *
 * A platform admin (Shorupan) assigns/sells a global geo entity (country /
 * territory / sub-territory) to a Garage user via the Garage invoice engine.
 * Buyer pays $650/yr floor (custom ≥ $650 supported). Ownership lives in the
 * Garage-side `FranchiseGlobalAssignment` collection; the roam-admin catalog
 * is left untouched (read-only contract preserved).
 *
 * Mirrors `routes/franchiseProgram.ts` (System B) minus program/office context.
 * Resale endpoints are Phase 2 — deferred from this ship.
 */

const router = Router();
router.use(requireAuth);

const FLOOR = FRANCHISE_PRICE_USD;

// ---- Auth ------------------------------------------------------------------

/**
 * Only the platform founder (shorupan@gmail.com) can assign/manage global
 * franchise entities. This is deliberately narrower than System B's office-
 * founder gate — the global catalog is platform property.
 */
async function requirePlatformFounder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as any).user as { userId: string };
  try {
    const dbUser = await User.findById(user.userId).select("email").lean<any>();
    if (!dbUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const email = String(dbUser.email || "").toLowerCase();
    if (email === PLATFORM_USER_EMAIL.toLowerCase()) {
      next();
      return;
    }
    res
      .status(403)
      .json({ error: "Only the platform founder can perform this action" });
  } catch (err) {
    console.error("[franchise-global] auth guard error:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

// ---- Helpers ---------------------------------------------------------------

/**
 * Load global catalog entity for a (level, id) pair.
 *
 * Catalog rows are supposed to have String `_id`s (roam-admin's convention
 * mirrored by our Mongoose schemas), but some admin tools have written
 * rows with ObjectId `_id`s instead. `findById` follows the schema and
 * casts to String, so an ObjectId-stored row silently 404s.
 *
 * `loadOne` retries with an ObjectId variant when the string lookup misses
 * and the id happens to be a valid 24-char hex — dropping the raw-driver
 * query in as a fallback catches the mismatched rows without changing the
 * schema. Fixing the write path (so new rows land as Strings) is a
 * separate cleanup.
 */
async function loadOne<T = any>(
  model: any,
  collectionName: string,
  id: string,
): Promise<T | null> {
  const stringHit = await model.findById(id).lean();
  if (stringHit) return stringHit as T;
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  try {
    const coll = mongoose.connection.db?.collection(collectionName);
    if (!coll) return null;
    const oidHit = await coll.findOne({
      _id: new Types.ObjectId(id) as any,
    });
    return (oidHit as unknown as T) || null;
  } catch {
    return null;
  }
}

interface CatalogEntity {
  name?: string;
  country?: string;
  parentTerritory?: string;
  zipCodes?: string[];
  // Media fields present on the roam-admin catalog docs (`strict: false` on
  // our Mongoose schemas means they pass through). Countries + territories
  // expose `region` as the continent proxy; sub-territories have an explicit
  // `continent` field. See franchiseProgram.ts:398-405 for the same pattern.
  flag?: string | null;
  continent?: string | null;
  coverImage?: string | null;
  image?: string | null;
}

function pickMedia(d: any): Pick<
  CatalogEntity,
  "flag" | "continent" | "coverImage" | "image"
> {
  return {
    flag: d?.flag ?? null,
    continent: d?.continent ?? d?.region ?? null,
    coverImage: d?.coverImageUrl ?? d?.coverImage ?? null,
    image: d?.image ?? null,
  };
}

async function loadCatalogEntity(
  level: FranchiseGlobalGeoLevel,
  id: string
): Promise<CatalogEntity | null> {
  if (level === "country") {
    const c = await loadOne<any>(FranchiseCountry, "franchise_countries", id);
    return c ? { name: c.name, ...pickMedia(c) } : null;
  }
  if (level === "territory") {
    const t = await loadOne<any>(
      FranchiseTerritory,
      "franchise_territorymasters",
      id,
    );
    return t ? { name: t.name, country: t.country, ...pickMedia(t) } : null;
  }
  const s = await loadOne<any>(
    FranchiseSubTerritory,
    "franchise_sub_territories",
    id,
  );
  return s
    ? {
        name: s.name,
        country: s.country,
        parentTerritory: s.parentTerritory,
        zipCodes: Array.isArray(s.zipCodes) ? s.zipCodes : [],
        ...pickMedia(s),
      }
    : null;
}

function assignmentPayload(a: any) {
  return {
    id: String(a._id),
    geoLevel: a.geoLevel,
    geoEntityId: a.geoEntityId,
    geoEntityName: a.geoEntityName ?? null,
    geoCountry: a.geoCountry ?? null,
    geoParentTerritory: a.geoParentTerritory ?? null,
    ownerUserId: a.ownerUserId ? String(a.ownerUserId) : null,
    ownerEmail: a.ownerEmail ?? null,
    listedByUserId: a.listedByUserId ? String(a.listedByUserId) : null,
    // Historical purchase price (what the current owner paid). Never
    // overwritten by re-listing.
    priceUSD: a.priceUSD,
    // Resale ask when the row is listed for sale. Undefined otherwise.
    listedPriceUSD:
      typeof a.listedPriceUSD === "number" ? a.listedPriceUSD : null,
    status: a.status,
    acquisitionType: a.acquisitionType || "original",
    acquiredReassignmentId: a.acquiredReassignmentId
      ? String(a.acquiredReassignmentId)
      : null,
    invoiceId: a.subscription?.invoiceId ? String(a.subscription.invoiceId) : null,
    subscription: {
      invoiceId: a.subscription?.invoiceId
        ? String(a.subscription.invoiceId)
        : null,
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
    pendingDirectedSale: a.pendingDirectedSale
      ? {
          buyerUserId: String(a.pendingDirectedSale.buyerUserId),
          buyerEmail: a.pendingDirectedSale.buyerEmail,
          priceUSD: a.pendingDirectedSale.priceUSD,
          invoiceId: String(a.pendingDirectedSale.invoiceId),
          sentAt: a.pendingDirectedSale.sentAt,
        }
      : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// ===========================================================================
// Endpoints
// ===========================================================================

/**
 * POST /franchise-global/assignments
 *
 * Platform admin assigns a global entity to a buyer email. Creates a
 * FranchiseGlobalAssignment (pending_payment) + mints a $650/yr invoice.
 * Fulfilment flips the assignment to `active`.
 *
 * Body: { geoLevel, geoEntityId, ownerEmail, priceUSD?, couponCode? }
 */
router.post(
  "/assignments",
  requirePlatformFounder,
  async (req: Request, res: Response) => {
    try {
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
      const price = priceUSD != null ? Number(priceUSD) : FLOOR;
      if (!Number.isFinite(price) || price < FLOOR) {
        res.status(400).json({ error: `priceUSD must be ≥ ${FLOOR}` });
        return;
      }

      const entity = await loadCatalogEntity(
        geoLevel as FranchiseGlobalGeoLevel,
        geoEntityId
      );
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

      // One owner per geo entity (unique index). Reject if an active/pending
      // Garage assignment already exists.
      const existing = await FranchiseGlobalAssignment.findOne({
        geoLevel,
        geoEntityId,
      }).lean();
      if (existing && existing.status !== "cancelled") {
        res.status(409).json({
          error: "Entity already assigned",
          assignment: assignmentPayload(existing),
        });
        return;
      }

      const doc = {
        geoLevel,
        geoEntityId,
        geoEntityName: entity.name,
        geoCountry: entity.country,
        geoParentTerritory: entity.parentTerritory,
        zipCodes: entity.zipCodes,
        ownerUserId: owner._id,
        ownerEmail: email,
        priceUSD: price,
        soldByUserId: new Types.ObjectId(user.userId),
        status: "pending_payment" as const,
      };
      const assignment = existing
        ? await FranchiseGlobalAssignment.findByIdAndUpdate(
            existing._id,
            { $set: doc },
            { new: true }
          )
        : await FranchiseGlobalAssignment.create(doc);

      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      // Buyer's yearly invoice. $650 floor is platform revenue. Any excess is
      // credited to Shorupan too (no founder middleman for global sales).
      // Invoice organizationId = PLATFORM_ORG_ID; sellerId = platform user.
      const platformUser = await User.findOne({
        email: PLATFORM_USER_EMAIL,
      })
        .select("_id")
        .lean<any>();
      if (!platformUser) {
        res.status(500).json({ error: "Platform user not found" });
        return;
      }

      const invoice = await createInvoice({
        organizationId: PLATFORM_ORG_ID,
        sellerId: String(platformUser._id),
        userId: String(owner._id),
        customerEmail: owner.email,
        customerName: owner.name,
        lineItems: [
          {
            itemType: "franchise_global",
            itemId: String((assignment as any)._id),
            itemName: `Franchise (global) — ${entity.name}`,
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
          franchiseGlobalAssignmentId: String((assignment as any)._id),
          geoLevel,
          geoEntityId,
        },
      });

      (assignment as any).subscription = {
        ...((assignment as any).subscription || {}),
        invoiceId: (invoice as any)._id,
      };
      await (assignment as any).save();

      // Promote invoice draft → pending immediately. Franchise invoices are
      // USD-only and don't need the currency-selection step that `draft` is
      // for; both statuses are payable via /invoice/{id}, and if the buyer
      // later picks a payment method the standard flow re-sets to draft
      // then re-promotes. Bumping here avoids the "why is it draft" question
      // for admins who inspect the invoice immediately after assignment.
      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: (invoice as any)._id, status: "draft" },
        { $set: { status: "pending" } }
      );

      res.status(201).json({
        assignment: assignmentPayload(assignment),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        amountUSD: ((invoice as any).totalAmount ?? price * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-global] assign error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * POST /franchise-global/self-buy
 *
 * Self-serve buy — any authenticated Garage user picks an unclaimed global
 * entity and mints their own invoice. Mirrors the admin `POST /assignments`
 * handler minus the ownerEmail param (buyer = self) and priceUSD param
 * (locked to $650 floor; custom pricing stays admin-only).
 *
 * State matrix on the target entity:
 *   - none / cancelled     → create/upsert with self as owner, mint invoice
 *   - pending_payment SELF → idempotent retry: return existing invoice
 *   - pending_payment OTHER→ take-over: cancel other's invoice, reassign,
 *                             mint fresh invoice for self
 *   - paused_lapsed / active → 409 (existing owner has priority)
 *
 * Body: { geoLevel, geoEntityId, couponCode? }
 */
router.post(
  "/self-buy",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { geoLevel, geoEntityId } = req.body || {};

      if (!["country", "territory", "subTerritory"].includes(geoLevel)) {
        res.status(400).json({ error: "Invalid geoLevel" });
        return;
      }
      if (!geoEntityId || typeof geoEntityId !== "string") {
        res.status(400).json({ error: "geoEntityId required" });
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

      const entity = await loadCatalogEntity(
        geoLevel as FranchiseGlobalGeoLevel,
        geoEntityId
      );
      if (!entity) {
        res.status(404).json({ error: "Catalog entity not found" });
        return;
      }

      const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
        .select("_id")
        .lean<any>();
      if (!platformUser) {
        res.status(500).json({ error: "Platform user not found" });
        return;
      }

      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      const price = FLOOR;
      const buyerIdObj = new Types.ObjectId(String(buyer._id));

      const existing = await FranchiseGlobalAssignment.findOne({
        geoLevel,
        geoEntityId,
      });

      // 409 — active or paused_lapsed. Someone owns it (or is in renewal
      // grace window). Self-serve buyers can't take over paid owners.
      if (
        existing &&
        (existing.status === "active" || existing.status === "paused_lapsed")
      ) {
        res.status(409).json({
          error: "Entity is already owned",
          assignment: assignmentPayload(existing.toObject()),
        });
        return;
      }

      // Idempotent retry — same user has a pending_payment already. Return
      // the existing invoice link so they can complete payment. If the
      // linked invoice was cancelled or is missing, fall through to mint
      // a fresh one on the same assignment row.
      if (
        existing &&
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
              (currentInvoice.totalAmount ?? price * 100) / 100,
            retry: true,
          });
          return;
        }
        // Fall through to mint a fresh invoice below (existing row reused).
      }

      // Take-over — pending_payment belongs to someone else. Cancel their
      // invoice and re-assign the entity to this buyer. First-come, first-
      // served has zero UX teeth without this (buyers who abandon leave
      // the entity locked forever).
      if (
        existing &&
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
        // Fall through to the shared upsert path below with new owner.
      }

      const doc: any = {
        geoLevel,
        geoEntityId,
        geoEntityName: entity.name,
        geoCountry: entity.country,
        geoParentTerritory: entity.parentTerritory,
        zipCodes: entity.zipCodes,
        ownerUserId: buyerIdObj,
        ownerEmail: buyerEmail,
        priceUSD: price,
        soldByUserId: buyerIdObj, // self-attribution
        status: "pending_payment" as const,
        // Wipe stale subscription linkage so we re-populate below.
        subscription: {},
      };
      // CAS guard: only update if the row is still in a claimable state
      // (pending_payment or cancelled). If it flipped to active/paused_lapsed
      // between our earlier read and this write — e.g. the previous owner's
      // payment webhook fulfilled milliseconds ago — we must NOT overwrite
      // their ownership. Bail out with 409.
      // The CREATE branch is protected by the unique {geoLevel, geoEntityId}
      // index; catch E11000 to surface a clean 409 instead of a 500.
      let assignment: any = null;
      if (existing) {
        assignment = await FranchiseGlobalAssignment.findOneAndUpdate(
          {
            _id: existing._id,
            status: { $in: ["pending_payment", "cancelled"] },
          },
          { $set: doc },
          { new: true }
        );
        if (!assignment) {
          const fresh = await FranchiseGlobalAssignment.findById(
            existing._id
          ).lean();
          res.status(409).json({
            error:
              "Entity was just claimed by another buyer — try again with the current state.",
            assignment: fresh ? assignmentPayload(fresh) : undefined,
          });
          return;
        }
      } else {
        try {
          assignment = await FranchiseGlobalAssignment.create(doc);
        } catch (createErr: any) {
          if (createErr?.code === 11000) {
            const fresh = await FranchiseGlobalAssignment.findOne({
              geoLevel,
              geoEntityId,
            }).lean();
            res.status(409).json({
              error:
                "Entity was just claimed by another buyer — try again with the current state.",
              assignment: fresh ? assignmentPayload(fresh) : undefined,
            });
            return;
          }
          throw createErr;
        }
      }

      const invoice = await createInvoice({
        organizationId: PLATFORM_ORG_ID,
        sellerId: String(platformUser._id),
        userId: String(buyer._id),
        customerEmail: buyer.email,
        customerName: buyer.name,
        lineItems: [
          {
            itemType: "franchise_global",
            itemId: String((assignment as any)._id),
            itemName: `Franchise (global) — ${entity.name}`,
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
          franchiseGlobalAssignmentId: String((assignment as any)._id),
          geoLevel,
          geoEntityId,
          selfBuy: true,
        },
      });

      (assignment as any).subscription = {
        ...((assignment as any).subscription || {}),
        invoiceId: (invoice as any)._id,
      };
      await (assignment as any).save();

      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: (invoice as any)._id, status: "draft" },
        { $set: { status: "pending" } }
      );

      res.status(201).json({
        assignment: assignmentPayload(assignment),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        amountUSD: ((invoice as any).totalAmount ?? price * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-global] self-buy error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-global/assignments
 *
 * Platform admin lists ALL Garage-side global assignments (any status).
 */
router.get(
  "/assignments",
  requirePlatformFounder,
  async (_req: Request, res: Response) => {
    try {
      const rows = await FranchiseGlobalAssignment.find({})
        .sort({ createdAt: -1 })
        .lean();
      res.json({ assignments: rows.map(assignmentPayload) });
    } catch (err) {
      console.error("[franchise-global] list error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/**
 * GET /franchise-global/assignments/all
 *
 * Public listing (any signed-in Garage user) of active global assignments.
 * Same payload shape as the founder-only listing above; purpose: any
 * authed user browsing the global catalog can see who owns what.
 */
router.get("/assignments/all", async (_req: Request, res: Response) => {
  try {
    // Includes `listed` rows too — a re-listed franchise is still an
    // "active" asset in the system (just up for resale). Excluding it
    // made re-listings disappear from the public assignments feed.
    const rows = await FranchiseGlobalAssignment.find({
      status: { $in: ["active", "paused_lapsed", "listed"] },
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ assignments: rows.map(assignmentPayload) });
  } catch (err) {
    console.error("[franchise-global] list-all error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/** GET /franchise-global/assignments/:assignmentId */
router.get(
  "/assignments/:assignmentId",
  async (req: Request, res: Response) => {
    try {
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const row = await FranchiseGlobalAssignment.findById(
        assignmentId
      ).lean();
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ assignment: assignmentPayload(row) });
    } catch (err) {
      console.error("[franchise-global] get error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

/** DELETE /franchise-global/assignments/:assignmentId */
router.delete(
  "/assignments/:assignmentId",
  requirePlatformFounder,
  async (req: Request, res: Response) => {
    try {
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const updated = await FranchiseGlobalAssignment.findByIdAndUpdate(
        assignmentId,
        { $set: { status: "cancelled" } },
        { new: true }
      );
      if (!updated) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      // Clear the catalog ownerEmail so external consumers stop showing
      // the cancelled owner. Best-effort — cancel succeeds even if sync
      // fails (see franchiseCatalogSync.ts).
      try {
        const { syncCatalogOwner } = await import(
          "../services/franchiseCatalogSync"
        );
        await syncCatalogOwner(
          updated.geoLevel as any,
          String(updated.geoEntityId),
          null
        );
      } catch (syncErr) {
        console.error(
          `[franchise-global] catalog sync failed on cancel of ${assignmentId}:`,
          syncErr
        );
      }
      res.json({ assignment: assignmentPayload(updated) });
    } catch (err) {
      console.error("[franchise-global] cancel error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ===========================================================================
// Buyer-initiated resale offers (Phase 3, System A mirror of System B)
//
// The owner-initiated + admin-approved resale flow (`/assignments/:id/
// reassign-request` + `/reassignments/:id/approve`) remains 501-stubbed
// below. This block is the buyer-initiated flow: any authed user can
// approach the current owner of an active global assignment with an offer
// above the owner's price; the owner (not the platform admin) accepts;
// prorated invoice is minted for the buyer; on payment ownership transfers,
// `expiresAt` preserved, 100% credited to seller at PLATFORM_ORG_ID.
// See services/franchiseGlobalOffer.ts.
// ===========================================================================

/** Shape a FranchiseGlobalOffer row for the API. */
function globalOfferPayload(o: any) {
  return {
    id: String(o._id),
    assignmentId: String(o.assignmentId),
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

function sendGlobalOfferError(res: Response, err: unknown): void {
  if (err instanceof FranchiseGlobalOfferError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const anyErr = err as any;
  console.error("[franchise-global] offer route error:", anyErr);
  res.status(500).json({ error: anyErr?.message || "Internal error" });
}

/**
 * POST /franchise-global/assignments/:assignmentId/offers
 * Body: { priceUSD, message? }
 * Any authed user can submit an offer to buy an active global assignment.
 */
router.post(
  "/assignments/:assignmentId/offers",
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      const { priceUSD, message } = req.body || {};
      const { createFranchiseGlobalOffer } = await import(
        "../services/franchiseGlobalOffer"
      );
      const offer = await createFranchiseGlobalOffer({
        fromUserId: user.userId,
        assignmentId,
        offerPriceUSD: Number(priceUSD),
        message: typeof message === "string" ? message : undefined,
      });
      res.status(201).json({ offer: globalOfferPayload(offer) });
    } catch (err) {
      sendGlobalOfferError(res, err);
    }
  },
);

/** GET /franchise-global/offers/outgoing */
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

    const { FranchiseGlobalOffer } = await import(
      "../models/franchiseGlobalOffer.model"
    );
    const filter: any = { fromUserId: uid };
    if (status) filter.status = status;
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }
    const rows = await FranchiseGlobalOffer.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      offers: items.map(globalOfferPayload),
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error("[franchise-global] outgoing offers error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/** GET /franchise-global/offers/incoming */
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

    const { FranchiseGlobalOffer } = await import(
      "../models/franchiseGlobalOffer.model"
    );
    const filter: any = { toUserId: uid };
    if (status) filter.status = status;
    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }
    const sort: any =
      status === "pending"
        ? { assignmentId: 1, offerPriceUSD: -1, _id: -1 }
        : { _id: -1 };
    const rows = await FranchiseGlobalOffer.find(filter)
      .sort(sort)
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      offers: items.map(globalOfferPayload),
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
    });
  } catch (err: any) {
    console.error("[franchise-global] incoming offers error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/** POST /franchise-global/offers/:offerId/accept */
router.post("/offers/:offerId/accept", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const { acceptFranchiseGlobalOffer } = await import(
      "../services/franchiseGlobalOffer"
    );
    const out = await acceptFranchiseGlobalOffer({
      ownerUserId: user.userId,
      offerId: req.params.offerId,
    });
    res.status(201).json({
      offer: globalOfferPayload(out.offer),
      assignment: assignmentPayload(out.assignment),
      invoiceId: out.invoiceId,
      invoiceNumber: out.invoiceNumber,
      amountUSD: out.amountUSD,
      daysRemaining: out.daysRemaining,
      autoRejectedCount: out.autoRejectedCount,
    });
  } catch (err) {
    sendGlobalOfferError(res, err);
  }
});

/** POST /franchise-global/offers/:offerId/reject */
router.post("/offers/:offerId/reject", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const { rejectFranchiseGlobalOffer } = await import(
      "../services/franchiseGlobalOffer"
    );
    const offer = await rejectFranchiseGlobalOffer({
      ownerUserId: user.userId,
      offerId: req.params.offerId,
    });
    res.json({ offer: globalOfferPayload(offer) });
  } catch (err) {
    sendGlobalOfferError(res, err);
  }
});

/** POST /franchise-global/offers/:offerId/cancel */
router.post("/offers/:offerId/cancel", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const { cancelFranchiseGlobalOffer } = await import(
      "../services/franchiseGlobalOffer"
    );
    const offer = await cancelFranchiseGlobalOffer({
      buyerUserId: user.userId,
      offerId: req.params.offerId,
    });
    res.json({ offer: globalOfferPayload(offer) });
  } catch (err) {
    sendGlobalOfferError(res, err);
  }
});

// ===========================================================================
// Marketplace listings (System A mirror of System B's founder listings)
//
// Two-track authorization on POST /listings:
//   - FRESH listing (row missing OR in listed/withdrawn/cancelled with no
//     current owner): only the platform admin (Shorupan) can create.
//   - OWNER RESALE (row currently `active` and req.user IS the owner): the
//     owner can re-list their own assignment for resale at a chosen price.
//
// On claim + payment the fulfillment handler (services/invoice.ts,
// case "franchise_global") splits: $650 platform floor → Shorupan, excess
// → `listedByUserId`. If the lister IS Shorupan, both credits still route
// to the platform wallet — net zero change vs today's 100%-to-platform path,
// just split into two auditable ledger rows.
// ===========================================================================

/**
 * POST /franchise-global/listings
 *
 * Body: { items: [{ geoLevel, geoEntityId, priceUSD }] }  (max 100)
 */
router.post("/listings", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const dbUser = await User.findById(user.userId).select("email").lean<any>();
    if (!dbUser) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    const isPlatformAdmin =
      String(dbUser.email || "").toLowerCase() ===
      PLATFORM_USER_EMAIL.toLowerCase();
    const userIdObj = new Types.ObjectId(user.userId);

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
          geoLevel as FranchiseGlobalGeoLevel,
          geoEntityId,
        );
        if (!entity) {
          skipped.push({ geoLevel, geoEntityId, reason: "Catalog entity not found" });
          continue;
        }

        const existing = await FranchiseGlobalAssignment.findOne({
          geoLevel,
          geoEntityId,
        });

        // Owner resale — row is currently active AND caller owns it.
        if (
          existing &&
          existing.status === "active" &&
          existing.ownerUserId &&
          String(existing.ownerUserId) === user.userId
        ) {
          const upd = await FranchiseGlobalAssignment.findOneAndUpdate(
            {
              _id: existing._id,
              status: "active",
              ownerUserId: userIdObj,
            },
            {
              $set: {
                status: "listed",
                // NEW resale asking price → separate field, DOESN'T
                // overwrite the owner's historical `priceUSD` (what they
                // paid to acquire the entity).
                listedPriceUSD: price,
                listedByUserId: userIdObj,
              },
              // Wipe owner + any pending sub-docs so the fulfillment
              // handler sees a fresh listing at claim time.
              //
              // subscription + priceUSD are DELIBERATELY PRESERVED —
              // they're the lister's purchase history (invoiceId,
              // startedAt, lastPaymentInvoiceId, expiresAt, original
              // price paid). /my/assignments reads these to show
              // "Purchased Details" on the card. Fulfillment on a future
              // claim copies listedPriceUSD → priceUSD so the new owner
              // gets their own history.
              $unset: {
                ownerUserId: "",
                ownerEmail: "",
                pendingReassignment: "",
                pendingResaleOffer: "",
              },
            },
            { new: true },
          );
          if (!upd) {
            skipped.push({
              geoLevel,
              geoEntityId,
              reason: "Row changed under us — try again",
            });
            continue;
          }
          updated.push(assignmentPayload(upd));
          continue;
        }

        // Owner resale attempted but caller is NOT the owner.
        if (
          existing &&
          existing.status === "active" &&
          existing.ownerUserId &&
          String(existing.ownerUserId) !== user.userId
        ) {
          skipped.push({
            geoLevel,
            geoEntityId,
            reason: "Only the current owner (or platform admin) can list this",
          });
          continue;
        }

        // Anything else (fresh listing / re-listing a listed/withdrawn/
        // cancelled row / no row yet) is platform-admin-only.
        if (!isPlatformAdmin) {
          skipped.push({
            geoLevel,
            geoEntityId,
            reason: "Only platform admin can create fresh listings",
          });
          continue;
        }

        // Skip rows that are already committed (pending_payment / paused_lapsed
        // — active is handled above via the owner-resale branch).
        const CLAIMED_STATES = new Set(["pending_payment", "paused_lapsed"]);
        if (existing && CLAIMED_STATES.has(existing.status)) {
          skipped.push({
            geoLevel,
            geoEntityId,
            reason: `Already ${existing.status} — cannot list until released`,
          });
          continue;
        }

        // Fresh admin listing. `priceUSD` is required on the schema so
        // we bootstrap it to the listing price for a truly-fresh row (no
        // historical purchase exists), but the semantic source of truth
        // for the resale ask is `listedPriceUSD` — that's what the claim
        // handler reads. On a claim + payment, fulfillment copies
        // listedPriceUSD → priceUSD, giving the new owner their own
        // history.
        const doc: any = {
          geoLevel,
          geoEntityId,
          geoEntityName: entity.name,
          geoCountry: entity.country,
          geoParentTerritory: entity.parentTerritory,
          zipCodes: entity.zipCodes,
          priceUSD: price,
          listedPriceUSD: price,
          listedByUserId: userIdObj,
          status: "listed" as const,
        };

        if (existing) {
          const upd = await FranchiseGlobalAssignment.findOneAndUpdate(
            {
              _id: existing._id,
              status: { $in: ["listed", "withdrawn", "cancelled"] },
            },
            {
              $set: doc,
              $unset: {
                ownerUserId: "",
                ownerEmail: "",
                subscription: "",
                pendingReassignment: "",
                pendingResaleOffer: "",
              },
            },
            { new: true },
          );
          if (!upd) {
            skipped.push({
              geoLevel,
              geoEntityId,
              reason: "Row changed under us — try again",
            });
            continue;
          }
          if (existing.status === "listed") updated.push(assignmentPayload(upd));
          else created.push(assignmentPayload(upd));
        } else {
          try {
            const fresh = await FranchiseGlobalAssignment.create(doc);
            created.push(assignmentPayload(fresh.toObject()));
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
        console.error("[franchise-global] listing item error:", itemErr);
        skipped.push({
          geoLevel: raw?.geoLevel,
          geoEntityId: raw?.geoEntityId,
          reason: "Internal error",
        });
      }
    }

    res.status(201).json({ created, updated, skipped });
  } catch (err: any) {
    console.error("[franchise-global] create listings error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * PATCH /franchise-global/listings/:assignmentId
 * Body: { priceUSD }. Lister or platform admin only. CAS on status=listed.
 */
router.patch("/listings/:assignmentId", async (req: Request, res: Response) => {
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

    const row = await FranchiseGlobalAssignment.findById(assignmentId);
    if (!row) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const dbUser = await User.findById(user.userId).select("email").lean<any>();
    const isPlatformAdmin =
      String(dbUser?.email || "").toLowerCase() ===
      PLATFORM_USER_EMAIL.toLowerCase();
    const isLister =
      row.listedByUserId && String(row.listedByUserId) === user.userId;
    if (!isPlatformAdmin && !isLister) {
      res.status(403).json({ error: "Only the lister can update this listing" });
      return;
    }

    const upd = await FranchiseGlobalAssignment.findOneAndUpdate(
      { _id: assignmentId, status: "listed" },
      // Updates the resale ask price only. `priceUSD` (owner's historical
      // purchase price) is left untouched so /my/assignments purchase
      // details stay correct on owner-listed rows.
      { $set: { listedPriceUSD: price } },
      { new: true },
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
    console.error("[franchise-global] update listing error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * DELETE /franchise-global/listings/:assignmentId
 * Withdraw. Lister or platform admin only. CAS on status=listed.
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
      const row = await FranchiseGlobalAssignment.findById(assignmentId);
      if (!row) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }
      const dbUser = await User.findById(user.userId).select("email").lean<any>();
      const isPlatformAdmin =
        String(dbUser?.email || "").toLowerCase() ===
        PLATFORM_USER_EMAIL.toLowerCase();
      const isLister =
        row.listedByUserId && String(row.listedByUserId) === user.userId;
      if (!isPlatformAdmin && !isLister) {
        res
          .status(403)
          .json({ error: "Only the lister can withdraw this listing" });
        return;
      }
      const upd = await FranchiseGlobalAssignment.findOneAndUpdate(
        { _id: assignmentId, status: "listed" },
        { $set: { status: "withdrawn" } },
        { new: true },
      );
      if (!upd) {
        const fresh = await FranchiseGlobalAssignment.findById(
          assignmentId,
        ).lean();
        res.status(409).json({
          error:
            "Cannot withdraw — listing is either already claimed by a buyer or is not in 'listed' state.",
          assignment: fresh ? assignmentPayload(fresh) : undefined,
        });
        return;
      }
      res.json({ assignment: assignmentPayload(upd) });
    } catch (err: any) {
      console.error("[franchise-global] withdraw listing error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * POST /franchise-global/listings/:assignmentId/claim
 *
 * Buyer claims a listed global entity. Mirrors System B's claim handler.
 * State matrix:
 *   listed                          → transition to pending_payment, mint invoice
 *   pending_payment (self)          → idempotent retry, return existing invoice
 *   pending_payment (other user)    → take-over: cancel other's invoice, reassign
 *   active/paused_lapsed/withdrawn/cancelled → 409
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
        res.status(400).json({
          error: "Your account has no email — cannot mint invoice",
        });
        return;
      }
      const buyerIdObj = new Types.ObjectId(String(buyer._id));

      const existing = await FranchiseGlobalAssignment.findById(assignmentId);
      if (!existing) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

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

      // Owner has already sent this specific listing to a targeted buyer
      // via directed-sale. Public claim path must yield until that invoice
      // is paid, cancelled, or expires — mirrors the pendingResaleOffer
      // lock used in the buyer-offer flow.
      if (existing.pendingDirectedSale) {
        res.status(409).json({
          error:
            "This listing is currently being sold to a specific buyer. Try again later.",
          pendingBuyerEmail: existing.pendingDirectedSale.buyerEmail,
        });
        return;
      }

      const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
        .select("_id")
        .lean<any>();
      if (!platformUser) {
        res.status(500).json({ error: "Platform user not found" });
        return;
      }

      const couponCode =
        typeof req.body?.couponCode === "string" && req.body.couponCode.trim()
          ? req.body.couponCode.trim()
          : undefined;

      // Idempotent retry — same user has pending_payment already.
      if (
        existing.status === "pending_payment" &&
        existing.ownerUserId &&
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
          // Prefer listedPriceUSD (the resale ask) when the row is
          // pending from a listing; fall back to priceUSD for legacy rows.
          const askPrice =
            existing.listedPriceUSD ?? existing.priceUSD;
          res.status(200).json({
            assignment: assignmentPayload(existing.toObject()),
            invoiceId: String(currentInvoice._id),
            invoiceNumber: currentInvoice.invoiceNumber,
            amountUSD: (currentInvoice.totalAmount ?? askPrice * 100) / 100,
            retry: true,
          });
          return;
        }
        // Fall through — mint a fresh invoice on same row.
      }

      // Take-over — pending_payment owned by another user. Cancel and reassign.
      if (
        existing.status === "pending_payment" &&
        existing.ownerUserId &&
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
            { $set: { status: "cancelled", cancelledAt: new Date() } },
          );
        }
      }

      // CAS-guarded transition.
      const assignment = await FranchiseGlobalAssignment.findOneAndUpdate(
        {
          _id: existing._id,
          status: { $in: ["listed", "pending_payment"] },
        },
        {
          $set: {
            ownerUserId: buyerIdObj,
            ownerEmail: buyerEmail,
            status: "pending_payment",
            subscription: {},
          },
        },
        { new: true },
      );
      if (!assignment) {
        const fresh = await FranchiseGlobalAssignment.findById(
          existing._id,
        ).lean();
        res.status(409).json({
          error:
            "Listing state changed while claim was in flight — try again.",
          assignment: fresh ? assignmentPayload(fresh) : undefined,
        });
        return;
      }

      // The resale ask is listedPriceUSD (set by the lister); priceUSD is
      // now historical (last owner's paid amount). Fulfillment on paid
      // will copy listedPriceUSD → priceUSD.
      const askPrice = assignment.listedPriceUSD ?? assignment.priceUSD;

      const invoice = await createInvoice({
        organizationId: PLATFORM_ORG_ID,
        sellerId: String(platformUser._id),
        userId: String(buyer._id),
        customerEmail: buyer.email,
        customerName: buyer.name,
        lineItems: [
          {
            itemType: "franchise_global",
            itemId: String(assignment._id),
            itemName: `Franchise (global) — ${assignment.geoEntityName || assignment.geoEntityId}`,
            quantity: 1,
            unitPrice: Math.round(askPrice * 100),
            originalCurrency: "USD",
          },
        ],
        itemCurrency: "USD",
        isRecurring: true,
        recurringPeriod: "yearly",
        platformCouponCode: couponCode,
        metadata: {
          franchiseGlobalAssignmentId: String(assignment._id),
          geoLevel: assignment.geoLevel,
          geoEntityId: assignment.geoEntityId,
          claimedFromListing: true,
        },
      });

      (assignment as any).subscription = {
        ...((assignment as any).subscription || {}),
        invoiceId: (invoice as any)._id,
      };
      await (assignment as any).save();

      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: (invoice as any)._id, status: "draft" },
        { $set: { status: "pending" } },
      );

      res.status(201).json({
        assignment: assignmentPayload(assignment),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        amountUSD: ((invoice as any).totalAmount ?? askPrice * 100) / 100,
      });
    } catch (err: any) {
      console.error("[franchise-global] claim listing error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

// ===========================================================================
// My Franchises dashboard — owner-scoped card list + per-entity drilldowns
// + owner-initiated directed-sale flow (invoice minted for a specific email,
// no admin approval; ownership transfers on payment). Reuses the marketplace-
// listing money split ($650 → Shorupan, excess → seller) via the fulfillment
// branch in services/invoice.ts::case "franchise_global".
// ===========================================================================

/** Compact invoice hydration for card-shape blocks. */
function invoiceCardBlock(inv: any | null) {
  if (!inv) return null;
  return {
    invoiceId: String(inv._id),
    invoiceNumber: inv.invoiceNumber,
    amountUSD:
      typeof inv.totalAmount === "number" ? inv.totalAmount / 100 : null,
    itemCurrency: inv.itemCurrency ?? "USD",
    status: inv.status,
    paidAt: inv.paidAt ?? null,
    createdAt: inv.createdAt,
    // For unpaid children the child's own deadline lives on `expiresAt`
    // (nextDueDate is the cycle AFTER this one — cron-chain artifact),
    // so surface both and let the FE pick.
    dueOn: inv.expiresAt ?? inv.nextDueDate ?? null,
    recurringPaymentNumber: inv.recurringPaymentNumber ?? null,
  };
}

/**
 * GET /franchise-global/my/assignments
 *
 * Card-shape list of every global franchise entity currently owned by the
 * caller (status ∈ {active, paused_lapsed}). Each row is hydrated with
 * catalog media (flag/continent/coverImage) + purchase-invoice and last-
 * renewal-invoice details for the "Purchased Details" and "Last Renewal"
 * blocks on the FE card.
 */
router.get("/my/assignments", async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const uid = new Types.ObjectId(me.userId);

    // Include rows the owner has re-listed for resale. When an owner lists
    // an entity via POST /franchise-global/listings, the assignment
    // transitions active → listed AND ownerUserId is $unset (per the
    // marketplace-listing flow). Matching on ownerUserId alone would drop
    // the row from the owner's "My Franchises" view. Add listedByUserId
    // + status:"listed" to keep those visible.
    const rows = await FranchiseGlobalAssignment.find({
      $or: [
        { ownerUserId: uid, status: { $in: ["active", "paused_lapsed"] } },
        { listedByUserId: uid, status: "listed" },
      ],
    })
      .sort({ createdAt: -1 })
      .lean<any[]>();

    const { Invoice } = await import("../models/invoice.model");

    // Collect all invoice ids to hydrate in one round-trip.
    const invoiceIds = new Set<string>();
    for (const r of rows) {
      const pid = r.subscription?.invoiceId;
      const lid = r.subscription?.lastPaymentInvoiceId;
      if (pid) invoiceIds.add(String(pid));
      if (lid) invoiceIds.add(String(lid));
    }
    const invoiceById = new Map<string, any>();
    if (invoiceIds.size) {
      const invs = await Invoice.find({
        _id: { $in: Array.from(invoiceIds).map((s) => new Types.ObjectId(s)) },
      })
        .select(
          "_id invoiceNumber totalAmount itemCurrency status paidAt createdAt expiresAt nextDueDate recurringPaymentNumber",
        )
        .lean<any[]>();
      for (const i of invs) invoiceById.set(String(i._id), i);
    }

    // Pending renewal per assignment: earliest unpaid recurring child sitting
    // under the assignment's subscription parent. The renewal cron mints a
    // draft child a cycle before it's due; we surface it so the owner can pay
    // ahead of the deadline instead of waiting for the row to lapse.
    // Falls back to any franchise_global invoice keyed on the assignment id
    // when the row has no `subscription.invoiceId` set (rare, but keeps
    // legacy backfilled rows honest).
    const parentInvoiceIds: Types.ObjectId[] = [];
    const assignmentIdStrings: string[] = [];
    for (const r of rows) {
      const pid = r.subscription?.invoiceId;
      if (pid) parentInvoiceIds.push(new Types.ObjectId(String(pid)));
      assignmentIdStrings.push(String(r._id));
    }
    const pendingByParent = new Map<string, any>();
    const pendingByAssignment = new Map<string, any>();
    if (parentInvoiceIds.length || assignmentIdStrings.length) {
      const unpaidStatuses = ["draft", "pending", "unpaid"];
      const [byParent, byAssignment] = await Promise.all([
        parentInvoiceIds.length
          ? Invoice.find({
              parentInvoiceId: { $in: parentInvoiceIds },
              status: { $in: unpaidStatuses },
              cancelledAt: { $in: [null, undefined] },
            })
              .sort({ recurringPaymentNumber: 1, createdAt: 1 })
              .select(
                "_id invoiceNumber totalAmount itemCurrency status paidAt createdAt expiresAt nextDueDate recurringPaymentNumber parentInvoiceId lineItems",
              )
              .lean<any[]>()
          : Promise.resolve([]),
        assignmentIdStrings.length
          ? Invoice.find({
              "lineItems.itemType": "franchise_global",
              "lineItems.itemId": { $in: assignmentIdStrings },
              status: { $in: unpaidStatuses },
              cancelledAt: { $in: [null, undefined] },
            })
              .sort({ recurringPaymentNumber: 1, createdAt: 1 })
              .select(
                "_id invoiceNumber totalAmount itemCurrency status paidAt createdAt expiresAt nextDueDate recurringPaymentNumber parentInvoiceId lineItems",
              )
              .lean<any[]>()
          : Promise.resolve([]),
      ]);
      for (const inv of byParent) {
        const key = String(inv.parentInvoiceId);
        if (!pendingByParent.has(key)) pendingByParent.set(key, inv);
      }
      for (const inv of byAssignment) {
        const line = (inv.lineItems || []).find(
          (l: any) => l?.itemType === "franchise_global",
        );
        const key = line?.itemId ? String(line.itemId) : null;
        if (key && !pendingByAssignment.has(key)) {
          pendingByAssignment.set(key, inv);
        }
      }
    }

    // Hydrate catalog media per row (bounded by row count — the concurrency
    // is small; a per-user list rarely exceeds a few dozen entities).
    const items = await Promise.all(
      rows.map(async (a) => {
        const media = await loadCatalogEntity(
          a.geoLevel as FranchiseGlobalGeoLevel,
          a.geoEntityId,
        );
        const purchaseInv = a.subscription?.invoiceId
          ? invoiceById.get(String(a.subscription.invoiceId))
          : null;
        const lastRenewalInv = a.subscription?.lastPaymentInvoiceId
          ? invoiceById.get(String(a.subscription.lastPaymentInvoiceId))
          : purchaseInv;
        const pendingInv =
          (a.subscription?.invoiceId
            ? pendingByParent.get(String(a.subscription.invoiceId))
            : null) || pendingByAssignment.get(String(a._id)) || null;
        return {
          ...assignmentPayload(a),
          media: {
            flag: media?.flag ?? null,
            continent: media?.continent ?? null,
            coverImage: media?.coverImage ?? null,
            image: media?.image ?? null,
          },
          purchase: {
            date: purchaseInv?.paidAt ?? a.createdAt,
            from: a.acquisitionType === "original" ? "Garage" : "Resale",
            ...invoiceCardBlock(purchaseInv),
          },
          lastRenewal: invoiceCardBlock(lastRenewalInv),
          // Draft / pending renewal invoice already minted by the cron —
          // the "pay ahead" affordance for the owner. Null when no unpaid
          // child exists (nothing due yet, or already fully paid up).
          pendingRenewal: invoiceCardBlock(pendingInv),
          renewsOn: a.subscription?.expiresAt ?? null,
        };
      }),
    );

    res.json({ assignments: items });
  } catch (err) {
    console.error("[franchise-global] my/assignments error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-global/assignments/:assignmentId/invoices
 *
 * Full paper trail — every invoice ever tied to this assignment, regardless
 * of payer (owner sees prior owners' resale invoices too). Only the current
 * owner can call.
 */
router.get(
  "/assignments/:assignmentId/invoices",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const assignment = await FranchiseGlobalAssignment.findById(
        assignmentId,
      ).lean();
      if (!assignment) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      // Same lifecycle rule as /offers: listed rows have ownerUserId $unset
      // and the effective owner is `listedByUserId` (the person who put it
      // up for sale). Without this, a lister 403s on their own franchise.
      const effectiveOwnerId =
        assignment.status === "listed"
          ? assignment.listedByUserId
          : assignment.ownerUserId;
      if (
        !effectiveOwnerId ||
        String(effectiveOwnerId) !== me.userId
      ) {
        res
          .status(403)
          .json({ error: "Only the current owner can view invoice history" });
        return;
      }

      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
      );
      const cursor = req.query.cursor as string | undefined;
      if (cursor && !Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }

      const { Invoice } = await import("../models/invoice.model");
      const filter: any = {
        "lineItems.itemType": "franchise_global",
        "lineItems.itemId": assignmentId,
      };
      if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

      const rows = await Invoice.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .select(
          "_id invoiceNumber status totalAmount itemCurrency paymentCurrency paidAt createdAt isRecurring recurringPeriod recurringPaymentNumber parentInvoiceId userId customerEmail metadata",
        )
        .lean<any[]>();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        limit,
        nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
        invoices: items.map((i) => ({
          id: String(i._id),
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          totalAmount: i.totalAmount,
          amountUSD:
            typeof i.totalAmount === "number" ? i.totalAmount / 100 : null,
          itemCurrency: i.itemCurrency,
          paymentCurrency: i.paymentCurrency ?? null,
          paidAt: i.paidAt ?? null,
          createdAt: i.createdAt,
          isRecurring: !!i.isRecurring,
          recurringPeriod: i.recurringPeriod ?? null,
          recurringPaymentNumber: i.recurringPaymentNumber ?? null,
          parentInvoiceId: i.parentInvoiceId ? String(i.parentInvoiceId) : null,
          payerUserId: i.userId ? String(i.userId) : null,
          payerEmail: i.customerEmail ?? null,
          kind: (i.metadata as any)?.kind ?? null,
        })),
      });
    } catch (err) {
      console.error("[franchise-global] assignment invoices error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * GET /franchise-global/assignments/:assignmentId/offers
 *
 * Owner's inbox scoped to one assignment. Reuses globalOfferPayload().
 */
router.get(
  "/assignments/:assignmentId/offers",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const assignment = await FranchiseGlobalAssignment.findById(
        assignmentId,
      ).lean();
      if (!assignment) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      // Ownership identity depends on lifecycle stage:
      //   - status: "listed" — owner-resale flow $unset ownerUserId when the
      //     assignment went up for sale. The lister (`listedByUserId`) is the
      //     effective owner for inbox purposes.
      //   - anything else — the current owner (`ownerUserId`).
      // Prior version only checked ownerUserId, so listed rows 403'd their
      // own lister.
      const effectiveOwnerId =
        assignment.status === "listed"
          ? assignment.listedByUserId
          : assignment.ownerUserId;
      if (
        !effectiveOwnerId ||
        String(effectiveOwnerId) !== me.userId
      ) {
        res.status(403).json({ error: "Only the current owner can view offers" });
        return;
      }

      const status = req.query.status as string | undefined;
      const limit = Math.max(
        1,
        Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
      );
      const cursor = req.query.cursor as string | undefined;
      if (cursor && !Types.ObjectId.isValid(cursor)) {
        res.status(400).json({ error: "Invalid cursor" });
        return;
      }

      const { FranchiseGlobalOffer } = await import(
        "../models/franchiseGlobalOffer.model"
      );
      const filter: any = {
        assignmentId: new Types.ObjectId(assignmentId),
        toUserId: new Types.ObjectId(me.userId),
      };
      if (status) filter.status = status;
      if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

      const rows = await FranchiseGlobalOffer.find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean<any[]>();
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      res.json({
        limit,
        nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
        offers: items.map(globalOfferPayload),
      });
    } catch (err) {
      console.error("[franchise-global] assignment offers error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * POST /franchise-global/assignments/:assignmentId/directed-sale
 *
 * Owner sends a targeted sale offer to a specific email. Mints an invoice
 * for the buyer; on payment, ownership transfers, floor $650 → Shorupan,
 * excess → seller. No admin approval step.
 *
 * Body: { buyerEmail, priceUSD }  (priceUSD ≥ 650)
 */
router.post(
  "/assignments/:assignmentId/directed-sale",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }

      const buyerEmail = String(req.body?.buyerEmail || "")
        .trim()
        .toLowerCase();
      if (!buyerEmail) {
        res.status(400).json({ error: "buyerEmail required" });
        return;
      }

      const assignment = await FranchiseGlobalAssignment.findById(assignmentId);
      if (!assignment) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      // Effective owner: on listed rows the owner-resale flow $unset
      // ownerUserId and moved control to listedByUserId. Both identities
      // are legitimate initiators of a directed sale for their own row.
      const effectiveOwnerId =
        assignment.status === "listed"
          ? assignment.listedByUserId
          : assignment.ownerUserId;
      if (
        !effectiveOwnerId ||
        String(effectiveOwnerId) !== me.userId
      ) {
        res
          .status(403)
          .json({ error: "Only the current owner can initiate a directed sale" });
        return;
      }

      // Allow directed sale from either an active row (standard) or a
      // publicly-listed row (owner short-circuits the marketplace and
      // targets a specific buyer instead). Everything else — pending
      // payment, paused, withdrawn, cancelled — stays blocked.
      if (assignment.status !== "active" && assignment.status !== "listed") {
        res.status(409).json({
          error: `Cannot start a directed sale on a ${assignment.status} assignment`,
        });
        return;
      }

      // Price precedence:
      //   1. Explicit body.priceUSD (owner overrides for this specific buyer)
      //   2. listedPriceUSD (the configured resale ask)
      //   3. priceUSD (the last historical purchase price)
      // Any of these must be ≥ FLOOR ($650). Empty body → auto-fill from
      // configured price so the FE can send just {buyerEmail} for a
      // listed row.
      const rawPrice =
        req.body?.priceUSD !== undefined && req.body?.priceUSD !== null
          ? Number(req.body.priceUSD)
          : typeof (assignment as any).listedPriceUSD === "number"
            ? (assignment as any).listedPriceUSD
            : typeof assignment.priceUSD === "number"
              ? assignment.priceUSD
              : NaN;
      if (!Number.isFinite(rawPrice) || rawPrice < FLOOR) {
        res.status(400).json({
          error: `priceUSD must be ≥ ${FLOOR}`,
          configuredPriceUSD:
            (assignment as any).listedPriceUSD ?? assignment.priceUSD ?? null,
        });
        return;
      }
      const price = rawPrice;
      if (assignment.pendingDirectedSale) {
        res.status(409).json({
          error: "A directed sale is already pending on this assignment",
          existing: {
            buyerEmail: assignment.pendingDirectedSale.buyerEmail,
            invoiceId: String(assignment.pendingDirectedSale.invoiceId),
            priceUSD: assignment.pendingDirectedSale.priceUSD,
          },
        });
        return;
      }
      if (assignment.pendingResaleOffer) {
        res.status(409).json({
          error:
            "A buyer-initiated resale offer is already pending on this assignment",
          existing: {
            offerId: String(assignment.pendingResaleOffer.offerId),
            resaleInvoiceId: String(
              assignment.pendingResaleOffer.resaleInvoiceId,
            ),
          },
        });
        return;
      }

      const buyer = await User.findOne({ email: caseInsensitiveExact(buyerEmail) })
        .select("_id email name")
        .lean<any>();
      if (!buyer) {
        res.status(404).json({ error: "No Garage user with that email" });
        return;
      }
      if (String(buyer._id) === me.userId) {
        res
          .status(400)
          .json({ error: "Cannot start a directed sale to yourself" });
        return;
      }

      const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
        .select("_id")
        .lean<any>();
      if (!platformUser) {
        res.status(500).json({ error: "Platform user not found" });
        return;
      }

      const invoice = await createInvoice({
        organizationId: PLATFORM_ORG_ID,
        sellerId: String(platformUser._id),
        userId: String(buyer._id),
        customerEmail: buyer.email,
        customerName: buyer.name,
        lineItems: [
          {
            itemType: "franchise_global",
            itemId: String(assignment._id),
            itemName: `Franchise (global) — ${assignment.geoEntityName || assignment.geoEntityId}`,
            quantity: 1,
            unitPrice: Math.round(price * 100),
            originalCurrency: "USD",
          },
        ],
        itemCurrency: "USD",
        isRecurring: true,
        recurringPeriod: "yearly",
        metadata: {
          franchiseGlobalAssignmentId: String(assignment._id),
          directedSaleFromOwnerId: me.userId,
          kind: "directed_sale",
        },
      });

      assignment.pendingDirectedSale = {
        buyerUserId: new Types.ObjectId(String(buyer._id)),
        buyerEmail: String(buyer.email).toLowerCase(),
        priceUSD: price,
        invoiceId: (invoice as any)._id,
        sentAt: new Date(),
      } as any;
      await assignment.save();

      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: (invoice as any)._id, status: "draft" },
        { $set: { status: "pending" } },
      );

      res.status(201).json({
        assignment: assignmentPayload(assignment.toObject()),
        invoiceId: String((invoice as any)._id),
        invoiceNumber: (invoice as any).invoiceNumber,
        amountUSD: ((invoice as any).totalAmount ?? price * 100) / 100,
        buyerEmail: buyer.email,
      });
    } catch (err) {
      console.error("[franchise-global] directed-sale create error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * DELETE /franchise-global/assignments/:assignmentId/directed-sale
 *
 * Owner cancels a pending directed-sale before the buyer pays. Cancels the
 * minted invoice + clears the sub-doc.
 */
router.delete(
  "/assignments/:assignmentId/directed-sale",
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { assignmentId } = req.params;
      if (!Types.ObjectId.isValid(assignmentId)) {
        res.status(400).json({ error: "Invalid assignmentId" });
        return;
      }
      const assignment = await FranchiseGlobalAssignment.findById(assignmentId);
      if (!assignment) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      // Effective owner: listed rows have ownerUserId $unset — the lister
      // (`listedByUserId`) is the caller who initiated the directed sale
      // in the first place, so they're the one allowed to withdraw it.
      const effectiveOwnerId =
        assignment.status === "listed"
          ? assignment.listedByUserId
          : assignment.ownerUserId;
      if (
        !effectiveOwnerId ||
        String(effectiveOwnerId) !== me.userId
      ) {
        res.status(403).json({
          error: "Only the current owner can cancel a directed sale",
        });
        return;
      }
      if (!assignment.pendingDirectedSale) {
        res.status(409).json({ error: "No pending directed sale to cancel" });
        return;
      }

      const invoiceId = assignment.pendingDirectedSale.invoiceId;
      const { Invoice } = await import("../models/invoice.model");
      await Invoice.updateOne(
        { _id: invoiceId, status: { $in: ["draft", "pending"] } },
        { $set: { status: "cancelled", cancelledAt: new Date() } },
      );

      const upd = await FranchiseGlobalAssignment.findOneAndUpdate(
        {
          _id: assignmentId,
          "pendingDirectedSale.invoiceId": invoiceId,
        },
        { $set: { pendingDirectedSale: null } },
        { new: true },
      );
      if (!upd) {
        res.status(409).json({
          error:
            "Directed sale changed under us — refresh and try again.",
        });
        return;
      }

      res.json({ assignment: assignmentPayload(upd.toObject()) });
    } catch (err) {
      console.error("[franchise-global] directed-sale cancel error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  },
);

/**
 * Buyer→buyer OWNER-INITIATED resale — Phase 2. Placeholder shape kept so
 * callers see 501 (Not Implemented) rather than 404. The buyer-initiated
 * flow above (`/offers/*`) is the current supported path.
 */
router.post("/assignments/:id/reassign-request", (_req, res) => {
  res
    .status(501)
    .json({ error: "Resale (reassign) not yet implemented for global system" });
});
router.post("/reassignments/:id/approve", (_req, res) => {
  res
    .status(501)
    .json({ error: "Resale approve not yet implemented for global system" });
});

export default router;
