import { Types } from "mongoose";
import {
  FranchiseOffer,
  IFranchiseOffer,
} from "../models/franchiseOffer.model";
import {
  FranchiseTerritoryAssignment,
  IFranchiseTerritoryAssignment,
} from "../models/franchiseTerritoryAssignment.model";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { UserNotification } from "../models/userNotification.model";
import { FRANCHISE_PRICE_USD } from "../models/franchiseProgram.model";
import { createInvoice } from "./invoice";

/**
 * Buyer-initiated resale offer service. Mirrors `pendingCouponGift.ts` shape:
 *   create → accept → mint invoice → transfer on payment (in invoice.ts fulfilment).
 *
 * Coexists with the shipped owner-initiated + founder-approved resale flow
 * (`FranchiseReassignment`) — this service never touches that path.
 *
 * Money math + policy live in the plan file `analyse-whole-campaign-flow-*.md`.
 */

export class FranchiseOfferError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "FranchiseOfferError";
  }
}

// ── Policy constants ────────────────────────────────────────────────────

/** Pending offers auto-expire after this many days. */
export const OFFER_TTL_DAYS = 7;
/** Block offers when the subscription is expiring within this window (days). */
export const LAST_DAYS_GATE = 3;
/** Reused platform floor — offers must be at or above this. */
export const OFFER_FLOOR_USD = FRANCHISE_PRICE_USD;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

// ── Math helpers ────────────────────────────────────────────────────────

/**
 * Days remaining from `now` until the subscription's `expiresAt`, rounded UP
 * (ceil) so a partial-day sliver still counts as one day of use. Never
 * negative.
 */
export function daysRemainingUntil(expiresAt: Date, now: Date = new Date()): number {
  const ms = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / MS_PER_DAY));
}

/**
 * Prorated resale amount in CENTS for the current billing cycle.
 *   resaleCents = round(offerPriceUSD * 100 * daysRemaining / 365)
 * Uses `Math.round` (half-up). Worked example in the plan.
 */
export function computeProratedCents(
  offerPriceUSD: number,
  daysRemaining: number,
): number {
  const raw = offerPriceUSD * 100 * daysRemaining / DAYS_PER_YEAR;
  return Math.round(raw);
}

// ── Gates ───────────────────────────────────────────────────────────────

interface GateCheckOptions {
  assignment: IFranchiseTerritoryAssignment;
  buyerUserId: string;
  offerPriceUSD: number;
  now: Date;
}

/**
 * All the eligibility rules a POST /offers submission (and re-checked at
 * accept time) must pass. Throws `FranchiseOfferError` on the first failure.
 */
async function assertOfferAllowed(opts: GateCheckOptions): Promise<void> {
  const { assignment, buyerUserId, offerPriceUSD, now } = opts;

  // Ownership sanity + self-offer guard.
  if (!assignment.ownerUserId) {
    throw new FranchiseOfferError(
      400,
      "ASSIGNMENT_NOT_ACTIVE",
      "Assignment has no owner",
    );
  }
  if (String(assignment.ownerUserId) === String(buyerUserId)) {
    throw new FranchiseOfferError(
      400,
      "SELF_OFFER",
      "You already own this territory",
    );
  }

  // Status gate — only active territories can receive offers.
  if (assignment.status !== "active") {
    throw new FranchiseOfferError(
      409,
      "ASSIGNMENT_NOT_ACTIVE",
      `Assignment status is '${assignment.status}', not 'active'`,
    );
  }

  // Existing accepted offer locking the assignment.
  if (assignment.pendingResaleOffer) {
    throw new FranchiseOfferError(
      409,
      "ASSIGNMENT_LOCKED",
      "Owner has accepted another offer awaiting payment; try again later",
    );
  }

  // Price floor + must-beat-current.
  if (offerPriceUSD < OFFER_FLOOR_USD) {
    throw new FranchiseOfferError(
      400,
      "PRICE_TOO_LOW",
      `Offer must be at least $${OFFER_FLOOR_USD}`,
    );
  }
  if (offerPriceUSD <= assignment.priceUSD) {
    throw new FranchiseOfferError(
      400,
      "PRICE_TOO_LOW",
      `Offer must exceed current owner's price ($${assignment.priceUSD})`,
    );
  }

  // Last-N-days gate: refuse if the sub is about to expire.
  const e = assignment.subscription?.expiresAt;
  if (!e) {
    throw new FranchiseOfferError(
      409,
      "ASSIGNMENT_NOT_ACTIVE",
      "Assignment has no active subscription window",
    );
  }
  const remaining = daysRemainingUntil(e, now);
  if (remaining < LAST_DAYS_GATE) {
    throw new FranchiseOfferError(
      409,
      "SUB_EXPIRING_SOON",
      `Cannot offer within ${LAST_DAYS_GATE} days of renewal (only ${remaining} day(s) left)`,
    );
  }

  // Overdue invoice on THIS assignment. The recurring engine pre-mints
  // the next-cycle child with `status: draft` and `expiresAt = cycleDue
  // + 7 days` — that pre-mint is normal and its `expiresAt` is in the
  // future, so it does NOT trip this gate. Only invoices whose payment
  // grace window has already elapsed (`expiresAt < now`) count as
  // "unpaid / overdue". Invoices with no `expiresAt` at all are ignored
  // (we can't judge them safely).
  const overdueInvoice = await Invoice.findOne({
    "metadata.franchiseAssignmentId": String(assignment._id),
    status: { $in: ["pending", "draft"] },
    expiresAt: { $exists: true, $ne: null, $lt: now },
  })
    .select("_id status expiresAt")
    .lean();
  if (overdueInvoice) {
    throw new FranchiseOfferError(
      409,
      "SELLER_INVOICE_PENDING",
      "Owner has an overdue invoice on this territory; try again after it settles",
    );
  }
}

// ── Create ──────────────────────────────────────────────────────────────

export interface CreateFranchiseOfferInput {
  fromUserId: string;
  assignmentId: string;
  offerPriceUSD: number;
  message?: string;
}

export async function createFranchiseOffer(
  input: CreateFranchiseOfferInput,
): Promise<IFranchiseOffer> {
  if (!Types.ObjectId.isValid(input.assignmentId)) {
    throw new FranchiseOfferError(400, "INVALID_ASSIGNMENT", "Invalid assignmentId");
  }
  const price = Number(input.offerPriceUSD);
  if (!Number.isFinite(price) || price <= 0) {
    throw new FranchiseOfferError(400, "INVALID_PRICE", "Invalid offer price");
  }

  const assignment = await FranchiseTerritoryAssignment.findById(
    input.assignmentId,
  );
  if (!assignment) {
    throw new FranchiseOfferError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  }

  const now = new Date();
  await assertOfferAllowed({
    assignment,
    buyerUserId: input.fromUserId,
    offerPriceUSD: price,
    now,
  });

  const [buyer, owner] = await Promise.all([
    User.findById(input.fromUserId)
      .select("_id email name profilePicture")
      .lean<any>(),
    User.findById(assignment.ownerUserId).select("_id email").lean<any>(),
  ]);
  if (!buyer) {
    throw new FranchiseOfferError(404, "USER_NOT_FOUND", "Buyer user not found");
  }
  if (!owner) {
    throw new FranchiseOfferError(404, "USER_NOT_FOUND", "Owner user not found");
  }

  const expiresAt = new Date(now.getTime() + OFFER_TTL_DAYS * MS_PER_DAY);

  try {
    const offer = await FranchiseOffer.create({
      assignmentId: assignment._id,
      programId: assignment.programId,
      officeId: assignment.officeId,
      geoLevel: assignment.geoLevel,
      geoEntityId: assignment.geoEntityId,
      geoEntityName: assignment.geoEntityName,
      fromUserId: new Types.ObjectId(input.fromUserId),
      fromEmail: (buyer.email || "").toLowerCase(),
      toUserId: assignment.ownerUserId,
      toEmail: (owner.email || assignment.ownerEmail || "").toLowerCase(),
      currentPriceUSD: assignment.priceUSD,
      offerPriceUSD: price,
      message: input.message?.trim() || undefined,
      status: "pending",
      expiresAt,
    });
    notifyOwnerOfferCreated(offer, buyer).catch((err) =>
      console.error("[franchise-offer] notify created failed:", err),
    );
    return offer;
  } catch (err: any) {
    if (err?.code === 11000) {
      // Partial-unique {assignmentId, fromUserId} where status='pending' —
      // buyer already has a live offer on this assignment.
      throw new FranchiseOfferError(
        409,
        "DUPLICATE_OFFER",
        "You already have a pending offer on this territory",
      );
    }
    throw err;
  }
}

// ── Accept (owner) ──────────────────────────────────────────────────────

export interface AcceptFranchiseOfferOutput {
  offer: IFranchiseOffer;
  assignment: IFranchiseTerritoryAssignment;
  invoiceId: string;
  invoiceNumber: string;
  amountUSD: number;
  daysRemaining: number;
  autoRejectedCount: number;
}

export async function acceptFranchiseOffer(input: {
  ownerUserId: string;
  offerId: string;
}): Promise<AcceptFranchiseOfferOutput> {
  if (!Types.ObjectId.isValid(input.offerId)) {
    throw new FranchiseOfferError(400, "INVALID_OFFER", "Invalid offerId");
  }

  const now = new Date();
  const offer = await FranchiseOffer.findById(input.offerId);
  if (!offer) {
    throw new FranchiseOfferError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (offer.status !== "pending") {
    throw new FranchiseOfferError(
      409,
      "OFFER_NOT_PENDING",
      `Offer is '${offer.status}', not 'pending'`,
    );
  }
  if (offer.expiresAt.getTime() < now.getTime()) {
    // Lazy-mark it here so the caller sees a clean error; the sweeper would
    // eventually flip it too.
    offer.status = "expired";
    offer.respondedAt = now;
    await offer.save();
    throw new FranchiseOfferError(409, "OFFER_EXPIRED", "Offer has expired");
  }
  if (String(offer.toUserId) !== String(input.ownerUserId)) {
    throw new FranchiseOfferError(
      403,
      "NOT_OWNER",
      "Only the current owner can accept this offer",
    );
  }

  const assignment = await FranchiseTerritoryAssignment.findById(
    offer.assignmentId,
  );
  if (!assignment) {
    throw new FranchiseOfferError(
      404,
      "ASSIGNMENT_NOT_FOUND",
      "Assignment vanished",
    );
  }
  if (String(assignment.ownerUserId) !== String(input.ownerUserId)) {
    throw new FranchiseOfferError(
      403,
      "NOT_OWNER",
      "You no longer own this assignment",
    );
  }

  // Re-run all gates — state could have shifted between submit and accept.
  await assertOfferAllowed({
    assignment,
    buyerUserId: String(offer.fromUserId),
    offerPriceUSD: offer.offerPriceUSD,
    now,
  });

  const preservedExpiresAt = assignment.subscription!.expiresAt!;
  const daysRemaining = daysRemainingUntil(preservedExpiresAt, now);
  const resaleCents = computeProratedCents(offer.offerPriceUSD, daysRemaining);
  if (resaleCents <= 0) {
    throw new FranchiseOfferError(
      409,
      "SUB_EXPIRING_SOON",
      "Prorated amount is zero — subscription too close to expiry",
    );
  }

  const buyer = await User.findById(offer.fromUserId)
    .select("_id email name")
    .lean<any>();
  if (!buyer) {
    throw new FranchiseOfferError(404, "USER_NOT_FOUND", "Buyer user not found");
  }

  // Mint the prorated resale invoice. Non-recurring — the follow-up
  // recurring parent for future annual cycles at the NEW price is created
  // in the invoice.ts fulfilment branch when this one is paid.
  const invoice = await createInvoice({
    organizationId: String(assignment.officeId),
    sellerId: String(assignment.ownerUserId),
    userId: String(buyer._id),
    customerEmail: buyer.email,
    customerName: buyer.name,
    lineItems: [
      {
        itemType: "franchise_territory",
        itemId: String(assignment._id),
        itemName: `Franchise territory (buyer resale, prorated) — ${assignment.geoEntityName || assignment.geoEntityId}`,
        quantity: 1,
        unitPrice: resaleCents,
        originalCurrency: "USD",
      },
    ],
    itemCurrency: "USD",
    isRecurring: false,
    metadata: {
      franchiseProgramId: String(assignment.programId),
      franchiseAssignmentId: String(assignment._id),
      franchiseOfferId: String(offer._id),
      officeId: String(assignment.officeId),
      kind: "buyer_resale",
      agreedFullPriceUSD: offer.offerPriceUSD,
      preservedExpiresAt: preservedExpiresAt.toISOString(),
      sellerUserId: String(assignment.ownerUserId),
      buyerUserId: String(buyer._id),
      daysRemainingAtAccept: daysRemaining,
    },
  } as any);

  // Bump draft → pending immediately (mirrors other franchise flows).
  await Invoice.updateOne(
    { _id: (invoice as any)._id, status: "draft" },
    { $set: { status: "pending" } },
  );

  // CAS-lock the assignment. Race: two concurrent accepts on DIFFERENT offers
  // (same owner) — only one wins the lock.
  const lockRes = await FranchiseTerritoryAssignment.updateOne(
    {
      _id: assignment._id,
      status: "active",
      ownerUserId: assignment.ownerUserId,
      $or: [
        { pendingResaleOffer: { $exists: false } },
        { pendingResaleOffer: null },
      ],
    },
    {
      $set: {
        pendingResaleOffer: {
          offerId: offer._id,
          buyerUserId: buyer._id,
          buyerEmail: (buyer.email || "").toLowerCase(),
          agreedPriceUSD: offer.offerPriceUSD,
          resaleInvoiceId: (invoice as any)._id,
          acceptedAt: now,
        },
      },
    },
  );
  if (lockRes.modifiedCount !== 1) {
    // Lost the race — cancel the invoice we just minted; leave offer pending.
    await Invoice.updateOne(
      { _id: (invoice as any)._id },
      { $set: { status: "cancelled", cancelledAt: now } },
    );
    throw new FranchiseOfferError(
      409,
      "ASSIGNMENT_LOCKED",
      "Another offer was accepted first",
    );
  }

  // Flip offer → accepted.
  offer.status = "accepted";
  offer.respondedAt = now;
  offer.invoiceId = (invoice as any)._id;
  offer.resolutionTxRefs = {
    ...(offer.resolutionTxRefs || {}),
    resaleInvoiceId: (invoice as any)._id,
  };
  await offer.save();

  // Auto-reject all other pending offers on the same assignment.
  const others = await FranchiseOffer.find({
    assignmentId: assignment._id,
    status: "pending",
    _id: { $ne: offer._id },
  }).select("_id fromUserId geoEntityName offerPriceUSD");
  if (others.length > 0) {
    await FranchiseOffer.updateMany(
      {
        assignmentId: assignment._id,
        status: "pending",
        _id: { $ne: offer._id },
      },
      { $set: { status: "auto_rejected", respondedAt: now } },
    );
    for (const o of others) {
      notifyBuyerOfferResolved(o, "auto_rejected").catch((err) =>
        console.error(
          "[franchise-offer] notify auto_rejected failed:",
          err,
        ),
      );
    }
  }

  // Notifications: winner + audit to owner.
  notifyBuyerOfferResolved(offer, "accepted", (invoice as any)._id).catch(
    (err) => console.error("[franchise-offer] notify accepted failed:", err),
  );

  return {
    offer,
    assignment,
    invoiceId: String((invoice as any)._id),
    invoiceNumber: (invoice as any).invoiceNumber,
    amountUSD: resaleCents / 100,
    daysRemaining,
    autoRejectedCount: others.length,
  };
}

// ── Reject (owner) ──────────────────────────────────────────────────────

export async function rejectFranchiseOffer(input: {
  ownerUserId: string;
  offerId: string;
}): Promise<IFranchiseOffer> {
  if (!Types.ObjectId.isValid(input.offerId)) {
    throw new FranchiseOfferError(400, "INVALID_OFFER", "Invalid offerId");
  }
  const offer = await FranchiseOffer.findById(input.offerId);
  if (!offer) {
    throw new FranchiseOfferError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (String(offer.toUserId) !== String(input.ownerUserId)) {
    throw new FranchiseOfferError(
      403,
      "NOT_OWNER",
      "Only the current owner can reject this offer",
    );
  }
  if (offer.status !== "pending") {
    throw new FranchiseOfferError(
      409,
      "OFFER_NOT_PENDING",
      `Offer is '${offer.status}', not 'pending'`,
    );
  }
  offer.status = "rejected";
  offer.respondedAt = new Date();
  await offer.save();
  notifyBuyerOfferResolved(offer, "rejected").catch((err) =>
    console.error("[franchise-offer] notify rejected failed:", err),
  );
  return offer;
}

// ── Cancel (buyer) ──────────────────────────────────────────────────────

export async function cancelFranchiseOffer(input: {
  buyerUserId: string;
  offerId: string;
}): Promise<IFranchiseOffer> {
  if (!Types.ObjectId.isValid(input.offerId)) {
    throw new FranchiseOfferError(400, "INVALID_OFFER", "Invalid offerId");
  }
  const offer = await FranchiseOffer.findById(input.offerId);
  if (!offer) {
    throw new FranchiseOfferError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (String(offer.fromUserId) !== String(input.buyerUserId)) {
    throw new FranchiseOfferError(
      403,
      "NOT_BUYER",
      "Only the offer's buyer can cancel it",
    );
  }
  if (offer.status !== "pending") {
    throw new FranchiseOfferError(
      409,
      "OFFER_NOT_PENDING",
      `Offer is '${offer.status}', not 'pending'`,
    );
  }
  offer.status = "cancelled";
  offer.respondedAt = new Date();
  await offer.save();
  notifyOwnerOfferCancelled(offer).catch((err) =>
    console.error("[franchise-offer] notify cancelled failed:", err),
  );
  return offer;
}

// ── Sweeper ─────────────────────────────────────────────────────────────

/**
 * Flip pending offers past their `expiresAt` to `status: 'expired'`. Fires
 * notifications to buyer + owner. Called from the recurring-invoice cron.
 */
export async function expireStalePendingOffers(): Promise<{
  expired: number;
}> {
  const now = new Date();
  const stale = await FranchiseOffer.find({
    status: "pending",
    expiresAt: { $lt: now },
  }).limit(500);

  if (stale.length === 0) return { expired: 0 };

  const ids = stale.map((o) => o._id);
  await FranchiseOffer.updateMany(
    { _id: { $in: ids }, status: "pending" },
    { $set: { status: "expired", respondedAt: now } },
  );

  for (const o of stale) {
    notifyBuyerOfferResolved(o, "expired").catch((err) =>
      console.error("[franchise-offer] notify expired (buyer) failed:", err),
    );
    notifyOwnerOfferExpired(o).catch((err) =>
      console.error("[franchise-offer] notify expired (owner) failed:", err),
    );
  }

  return { expired: stale.length };
}

// ── Notifications ───────────────────────────────────────────────────────

async function notifyOwnerOfferCreated(
  offer: IFranchiseOffer,
  buyer: any,
): Promise<void> {
  await UserNotification.create({
    userId: offer.toUserId,
    orgId: offer.officeId,
    type: "franchise_offer",
    franchiseOfferId: offer._id,
    franchiseAssignmentId: offer.assignmentId,
    franchiseTerritoryName: offer.geoEntityName || offer.geoEntityId,
    franchiseOfferPriceUsd: offer.offerPriceUSD,
    franchiseOfferEvent: "created",
    giftFromUserId: offer.fromUserId,
    giftFromName: buyer?.name || offer.fromEmail,
    giftFromPicture: buyer?.profilePicture,
    giftFromType: "user",
    giftMessage: offer.message,
  });
}

async function notifyOwnerOfferCancelled(offer: IFranchiseOffer): Promise<void> {
  await UserNotification.create({
    userId: offer.toUserId,
    orgId: offer.officeId,
    type: "franchise_offer",
    franchiseOfferId: offer._id,
    franchiseAssignmentId: offer.assignmentId,
    franchiseTerritoryName: offer.geoEntityName || offer.geoEntityId,
    franchiseOfferPriceUsd: offer.offerPriceUSD,
    franchiseOfferEvent: "cancelled",
    giftFromUserId: offer.fromUserId,
    giftFromName: offer.fromEmail,
    giftFromType: "user",
  });
}

async function notifyOwnerOfferExpired(offer: IFranchiseOffer): Promise<void> {
  await UserNotification.create({
    userId: offer.toUserId,
    orgId: offer.officeId,
    type: "franchise_offer",
    franchiseOfferId: offer._id,
    franchiseAssignmentId: offer.assignmentId,
    franchiseTerritoryName: offer.geoEntityName || offer.geoEntityId,
    franchiseOfferPriceUsd: offer.offerPriceUSD,
    franchiseOfferEvent: "expired",
    giftFromUserId: offer.fromUserId,
    giftFromName: offer.fromEmail,
    giftFromType: "user",
  });
}

async function notifyBuyerOfferResolved(
  offer: Pick<
    IFranchiseOffer,
    | "_id"
    | "assignmentId"
    | "officeId"
    | "fromUserId"
    | "geoEntityName"
    | "geoEntityId"
    | "offerPriceUSD"
  >,
  event: "accepted" | "rejected" | "auto_rejected" | "expired",
  invoiceId?: Types.ObjectId,
): Promise<void> {
  await UserNotification.create({
    userId: offer.fromUserId,
    orgId: offer.officeId,
    type: "franchise_offer",
    franchiseOfferId: offer._id,
    franchiseAssignmentId: offer.assignmentId,
    franchiseTerritoryName: offer.geoEntityName || offer.geoEntityId,
    franchiseOfferPriceUsd: offer.offerPriceUSD,
    franchiseOfferEvent: event,
    franchiseInvoiceId: invoiceId,
  });
}
