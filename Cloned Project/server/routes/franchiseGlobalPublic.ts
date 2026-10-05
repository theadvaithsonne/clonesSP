import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { FranchiseGlobalAssignment } from "../models/franchiseGlobalAssignment.model";
import { caseInsensitiveExact } from "../utils/territoryResolver";

/**
 * Public read-only replica of `GET /franchise-global/assignments/all`.
 *
 * The original endpoint (routes/franchiseGlobal.ts) sits behind
 * `router.use(requireAuth)` — this one deliberately does not, so external
 * pages (public catalogs, marketing splashes, etc.) can list active
 * assignments without a bearer token. Payload shape is identical.
 */
const router = Router();

/** Same shape as `assignmentPayload` in franchiseGlobal.ts. Kept inline so
 *  this route stays self-contained and safe to load without the whole
 *  franchiseGlobal module.
 *
 *  IMPORTANT: field names MUST match the model
 *  (`FranchiseGlobalAssignment`), not any invented alias. The prior version
 *  read `level` / `entityId` / `buyerEmail` / `priceUsd` etc. which don't
 *  exist on the schema, so every field except `zipCodes` came back
 *  undefined and got dropped from the JSON.
 */
function payload(a: any) {
  return {
    id: String(a._id),
    geoLevel: a.geoLevel,
    geoEntityId: a.geoEntityId,
    geoEntityName: a.geoEntityName ?? null,
    geoCountry: a.geoCountry ?? null,
    geoParentTerritory: a.geoParentTerritory ?? null,
    zipCodes: a.zipCodes ?? [],
    ownerUserId: a.ownerUserId ? String(a.ownerUserId) : null,
    ownerEmail: a.ownerEmail ?? null,
    listedByUserId: a.listedByUserId ? String(a.listedByUserId) : null,
    priceUSD: a.priceUSD,
    listedPriceUSD:
      typeof a.listedPriceUSD === "number" ? a.listedPriceUSD : null,
    status: a.status,
    acquisitionType: a.acquisitionType || "original",
    invoiceId: a.subscription?.invoiceId
      ? String(a.subscription.invoiceId)
      : null,
    subscription: {
      invoiceId: a.subscription?.invoiceId
        ? String(a.subscription.invoiceId)
        : null,
      startedAt: a.subscription?.startedAt ?? null,
      expiresAt: a.subscription?.expiresAt ?? null,
      lastPaymentInvoiceId: a.subscription?.lastPaymentInvoiceId
        ? String(a.subscription.lastPaymentInvoiceId)
        : null,
    },
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

router.get("/assignments/all", async (_req: Request, res: Response) => {
  try {
    // Includes `listed` rows so a franchise up for resale still appears
    // in the public assignments feed (matches the authed
    // /franchise-global/assignments/all behavior).
    const rows = await FranchiseGlobalAssignment.find({
      status: { $in: ["active", "paused_lapsed", "listed"] },
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ assignments: rows.map(payload) });
  } catch (err) {
    console.error("[franchise-global-public] list-all error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /franchise-global-public/marketplace  (public — no auth)
 *
 * Public browse of every `status: "listed"` global assignment. Buyer picks
 * one and calls the authed POST /franchise-global/listings/:id/claim endpoint
 * to acquire it.
 *
 * Query params:
 *   ?geoLevel=country|territory|subTerritory
 *   ?country= / ?state= / ?city=     geo filters (case-insensitive)
 *   ?limit=50 (max 200)
 *   ?cursor=<assignmentId>            cursor-based pagination
 */
router.get("/marketplace", async (req: Request, res: Response) => {
  try {
    const limit = Math.max(
      1,
      Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200),
    );
    const cursor = req.query.cursor as string | undefined;
    const country = (req.query.country as string | undefined)?.trim();
    const state = (req.query.state as string | undefined)?.trim();
    const city = (req.query.city as string | undefined)?.trim();
    const geoLevel = req.query.geoLevel as string | undefined;

    if (cursor && !Types.ObjectId.isValid(cursor)) {
      res.status(400).json({ error: "Invalid cursor" });
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
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };

    const rows = await FranchiseGlobalAssignment.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<any[]>();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      limit,
      nextCursor: hasMore ? String(items[items.length - 1]._id) : null,
      listings: items.map(payload),
    });
  } catch (err) {
    console.error("[franchise-global-public] marketplace error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
