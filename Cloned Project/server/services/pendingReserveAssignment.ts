import { Types } from "mongoose";
import {
  PendingReserveAssignment,
  IPendingReserveAssignment,
  PendingReserveAssignmentStatus,
} from "../models/pendingReserveAssignment.model";
import { ItemReserveLicense } from "../models/itemReserveLicense.model";
import { StoreWallet } from "../models/storeWallet.model";
import { User } from "../models/user.model";
import { UserNotification } from "../models/userNotification.model";
import { assignItemReserve } from "./itemReserveLicense";
import { transferStoreCreditsBetweenOrgs } from "./wallet";
import { sendMail, EMAIL_FROM_NOTIFICATION } from "./mailer";

/**
 * Paid reserve-assignment service. Mirrors `pendingCouponGift.ts` but:
 *  - Operates on `ItemReserveLicense` instead of `CouponAssignment`.
 *  - Uses the parent license's `pendingAssignmentId` field as the lock.
 *  - On approve, the recipient picks WHICH of their office Store wallets to
 *    debit from (cross-org). The sender is always credited in the org that
 *    was current when the offer was created.
 *  - On approve, delegates artifact creation to the existing
 *    `assignItemReserve()` dispatcher chain — no per-type code lives here.
 *
 * Free assigns (no price) bypass this file entirely.
 */

export class PendingReserveError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "PendingReserveError";
  }
}

const TWO_DP = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────────────────────────────────────────────────────
// Create
// ───────────────────────────────────────────────────────────────────────

export interface CreatePendingReserveInput {
  fromUserId: string;
  fromLicenseId: string;
  toEmail?: string;
  toUserId?: string;
  priceUsd: number;
  message?: string;
  orgId: string; // sender's current org — credit destination on approve
}

export async function createPendingReserveAssignment(
  input: CreatePendingReserveInput
): Promise<IPendingReserveAssignment> {
  if (!Types.ObjectId.isValid(input.fromLicenseId)) {
    throw new PendingReserveError(
      400,
      "INVALID_LICENSE",
      "Invalid license ID"
    );
  }
  if (!Types.ObjectId.isValid(input.orgId)) {
    throw new PendingReserveError(400, "INVALID_ORG", "Invalid orgId");
  }
  if (!input.toEmail && !input.toUserId) {
    throw new PendingReserveError(
      400,
      "MISSING_RECIPIENT",
      "Provide either email or userId"
    );
  }

  const priceUsd = TWO_DP(input.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd < 0.01) {
    throw new PendingReserveError(
      400,
      "INVALID_PRICE",
      "Price must be at least $0.01"
    );
  }

  const license = await ItemReserveLicense.findById(input.fromLicenseId);
  if (!license) {
    throw new PendingReserveError(
      404,
      "LICENSE_NOT_FOUND",
      "Reserve not found"
    );
  }
  if (license.buyerId.toString() !== input.fromUserId) {
    throw new PendingReserveError(
      403,
      "NOT_OWNER",
      "Not your reserve to sell"
    );
  }
  if (license.status !== "available") {
    throw new PendingReserveError(
      400,
      "NOT_AVAILABLE",
      `Cannot sell a reserve that is ${license.status}`
    );
  }
  if (license.pendingAssignmentId) {
    throw new PendingReserveError(
      409,
      "ALREADY_PENDING",
      "This reserve already has a pending offer. Cancel it first."
    );
  }

  // Resolve recipient (userId takes precedence)
  let recipient;
  if (input.toUserId) {
    if (!Types.ObjectId.isValid(input.toUserId)) {
      throw new PendingReserveError(400, "INVALID_USER_ID", "Invalid userId");
    }
    recipient = await User.findById(input.toUserId)
      .select("_id email name")
      .lean();
  } else {
    const normalizedEmail = input.toEmail!.trim().toLowerCase();
    recipient = await User.findOne({
      email: new RegExp(
        "^" + normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
        "i"
      ),
    })
      .select("_id email name")
      .lean();
  }
  if (!recipient) {
    throw new PendingReserveError(
      404,
      "RECIPIENT_NOT_FOUND",
      "Recipient must be an existing Garage user. Ask them to sign up first."
    );
  }
  if ((recipient as any)._id.toString() === input.fromUserId) {
    throw new PendingReserveError(
      400,
      "SELF_ASSIGN_NOT_ALLOWED",
      "You cannot sell a reserve to yourself"
    );
  }

  // Create the offer + lock the license. The partial-unique index on
  // { fromLicenseId, status: "pending" } guarantees no concurrent double-lock.
  let offer: IPendingReserveAssignment;
  try {
    offer = await PendingReserveAssignment.create({
      fromUserId: new Types.ObjectId(input.fromUserId),
      toUserId: (recipient as any)._id,
      fromLicenseId: license._id,
      itemType: license.itemType,
      itemId: license.itemId,
      itemName: license.itemName,
      itemImage: license.itemImage,
      unitPrice: license.unitPrice,
      orgId: new Types.ObjectId(input.orgId),
      priceUsd,
      currency: license.currency || "USD",
      message: input.message,
      status: "pending",
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new PendingReserveError(
        409,
        "ALREADY_PENDING",
        "This reserve already has a pending offer."
      );
    }
    throw err;
  }

  license.pendingAssignmentId = offer._id;
  await license.save();

  // Notify recipient (best-effort).
  void notifyOfferCreated(offer).catch((err) =>
    console.error("[PendingReserveAssignment] notifyOfferCreated failed:", err)
  );

  return offer;
}

// ───────────────────────────────────────────────────────────────────────
// Approve (recipient picks which Store wallet to pay from)
// ───────────────────────────────────────────────────────────────────────

export async function approvePendingReserveAssignment(
  offerId: string,
  recipientId: string,
  sourceOrgId: string
): Promise<IPendingReserveAssignment> {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new PendingReserveError(400, "INVALID_OFFER", "Invalid offer ID");
  }
  if (!Types.ObjectId.isValid(sourceOrgId)) {
    throw new PendingReserveError(
      400,
      "INVALID_SOURCE_ORG",
      "Invalid source organization"
    );
  }

  const offer = await PendingReserveAssignment.findById(offerId);
  if (!offer) {
    throw new PendingReserveError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (offer.toUserId.toString() !== recipientId) {
    throw new PendingReserveError(
      403,
      "NOT_RECIPIENT",
      "This offer is not addressed to you"
    );
  }
  if (offer.status !== "pending") {
    throw new PendingReserveError(
      409,
      "NOT_PENDING",
      `Offer is already ${offer.status}`
    );
  }

  // Verify recipient belongs to the chosen org (and has a wallet with enough
  // balance there) — the service is the source of truth, not the picker UI.
  const me = await User.findById(recipientId)
    .select("organizations")
    .lean();
  const isMember = (me as any)?.organizations?.some(
    (m: any) => m.organization.toString() === sourceOrgId
  );
  if (!isMember) {
    throw new PendingReserveError(
      400,
      "NOT_ORG_MEMBER",
      "You are not a member of the selected organization"
    );
  }
  const wallet = await StoreWallet.findOne({
    userId: new Types.ObjectId(recipientId),
    orgId: new Types.ObjectId(sourceOrgId),
  }).lean();
  const balance = (wallet as any)?.balance ?? 0;
  if (balance < offer.priceUsd) {
    throw new PendingReserveError(
      400,
      "INSUFFICIENT_BALANCE",
      `That wallet's balance ($${balance.toFixed(
        2
      )}) is below the offer price ($${offer.priceUsd.toFixed(
        2
      )}). Pick another wallet or top up.`
    );
  }

  // Re-check the license is still locked to this offer (defensive against
  // drift — auto-cancel if the lock has been removed externally).
  const license = await ItemReserveLicense.findById(offer.fromLicenseId);
  if (!license || license.status !== "available") {
    offer.status = "cancelled";
    offer.respondedAt = new Date();
    await offer.save();
    throw new PendingReserveError(
      410,
      "SOURCE_GONE",
      "The sender's reserve is no longer available."
    );
  }
  if (
    !license.pendingAssignmentId ||
    license.pendingAssignmentId.toString() !== offer._id.toString()
  ) {
    throw new PendingReserveError(
      409,
      "LOCK_DESYNC",
      "The reserve's lock has drifted. Ask the sender to resend the offer."
    );
  }

  // 1. Money — recipient (offer.toUserId) pays sender (offer.fromUserId).
  // `transferStoreCreditsBetweenOrgs` is atomic and writes linked debit/credit
  // WalletTransaction rows. NOTE the arg naming: first user = debited,
  // second user = credited; this matches the wallet-service convention.
  const credits = await transferStoreCreditsBetweenOrgs(
    recipientId, // debited (the payer)
    offer.fromUserId.toString(), // credited (the seller)
    sourceOrgId, // payer's chosen org
    offer.orgId.toString(), // seller's current-org at offer creation
    offer.priceUsd,
    `Reserve assign: ${offer.itemName}`
  );

  // 2. License — clear the lock, then run the existing per-type dispatcher.
  // Temporarily unset pendingAssignmentId so `assignItemReserve`'s guard
  // passes; the dispatcher flips status to "assigned" immediately after.
  let assignResult;
  try {
    license.pendingAssignmentId = undefined;
    await license.save();

    assignResult = await assignItemReserve(
      offer.fromLicenseId.toString(),
      offer.fromUserId.toString(),
      { userId: recipientId }
    );
  } catch (dispatcherErr: any) {
    console.error(
      `[PendingReserveAssignment] CRITICAL: wallet transfer succeeded but ` +
        `reserve dispatcher failed for offer ${offer._id}. Sender ` +
        `${offer.fromUserId} was credited $${offer.priceUsd}. Recipient ` +
        `${recipientId} debited but did NOT receive the artifact. Manual ` +
        `reconciliation required.`,
      dispatcherErr
    );
    offer.status = "approved";
    offer.respondedAt = new Date();
    offer.resolutionTxRefs = {
      // sender's side of the transfer = the CREDIT row
      senderWalletTxId: credits.recipientTransaction._id,
      // recipient's side of the transfer = the DEBIT row
      recipientWalletTxId: credits.senderTransaction._id,
    };
    await offer.save();
    throw new PendingReserveError(
      500,
      "DISPATCH_FAILED",
      "Payment went through but the reserve transfer failed. Support has been alerted."
    );
  }

  offer.status = "approved";
  offer.respondedAt = new Date();
  offer.resolutionTxRefs = {
    senderWalletTxId: credits.recipientTransaction._id,
    recipientWalletTxId: credits.senderTransaction._id,
    assignedArtifactRef: {
      type: assignResult.artifactType,
      id: new Types.ObjectId(assignResult.artifactId),
    },
  };
  await offer.save();

  void notifyOfferResolved(offer, "approved").catch((err) =>
    console.error(
      "[PendingReserveAssignment] notifyOfferResolved failed:",
      err
    )
  );

  return offer;
}

// ───────────────────────────────────────────────────────────────────────
// Reject (recipient) / Cancel (sender)
// ───────────────────────────────────────────────────────────────────────

async function resolveWithoutTransfer(
  offerId: string,
  actorId: string,
  expectedField: "toUserId" | "fromUserId",
  newStatus: Extract<
    PendingReserveAssignmentStatus,
    "rejected" | "cancelled"
  >
): Promise<IPendingReserveAssignment> {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new PendingReserveError(400, "INVALID_OFFER", "Invalid offer ID");
  }
  const offer = await PendingReserveAssignment.findById(offerId);
  if (!offer) {
    throw new PendingReserveError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (offer[expectedField].toString() !== actorId) {
    throw new PendingReserveError(
      403,
      expectedField === "toUserId" ? "NOT_RECIPIENT" : "NOT_SENDER",
      "Not your offer"
    );
  }
  if (offer.status !== "pending") {
    throw new PendingReserveError(
      409,
      "NOT_PENDING",
      `Offer is already ${offer.status}`
    );
  }

  offer.status = newStatus;
  offer.respondedAt = new Date();
  await offer.save();

  // Unlock the license — only if it still points at this offer (defensive
  // against drift).
  await ItemReserveLicense.updateOne(
    { _id: offer.fromLicenseId, pendingAssignmentId: offer._id },
    { $unset: { pendingAssignmentId: "" } }
  );

  void notifyOfferResolved(offer, newStatus).catch((err) =>
    console.error(
      "[PendingReserveAssignment] notifyOfferResolved failed:",
      err
    )
  );

  return offer;
}

export async function rejectPendingReserveAssignment(
  offerId: string,
  recipientId: string
): Promise<IPendingReserveAssignment> {
  return resolveWithoutTransfer(offerId, recipientId, "toUserId", "rejected");
}

export async function cancelPendingReserveAssignment(
  offerId: string,
  senderId: string
): Promise<IPendingReserveAssignment> {
  return resolveWithoutTransfer(offerId, senderId, "fromUserId", "cancelled");
}

// ───────────────────────────────────────────────────────────────────────
// Lists (sender outbox + recipient inbox)
// ───────────────────────────────────────────────────────────────────────

export async function listIncomingPendingReserves(userId: string) {
  return PendingReserveAssignment.find({
    toUserId: new Types.ObjectId(userId),
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .populate("fromUserId", "name email profilePicture")
    .populate("orgId", "name")
    .lean();
}

export async function listOutgoingPendingReserves(userId: string) {
  return PendingReserveAssignment.find({
    fromUserId: new Types.ObjectId(userId),
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .populate("toUserId", "name email profilePicture")
    .populate("orgId", "name")
    .lean();
}

// ───────────────────────────────────────────────────────────────────────
// Notifications (best-effort)
// ───────────────────────────────────────────────────────────────────────

async function notifyOfferCreated(offer: IPendingReserveAssignment) {
  const [sender, recipient] = await Promise.all([
    User.findById(offer.fromUserId).select("name email profilePicture").lean(),
    User.findById(offer.toUserId).select("name email").lean(),
  ]);
  const senderName =
    (sender as any)?.name || (sender as any)?.email || "A user";

  await UserNotification.create({
    userId: offer.toUserId,
    type: "reserve_offer",
    reserveOfferId: offer._id,
    reserveItemType: offer.itemType,
    reserveItemName: offer.itemName,
    reservePriceUsd: offer.priceUsd,
    giftFromUserId: offer.fromUserId,
    giftFromName: senderName,
    giftFromPicture: (sender as any)?.profilePicture,
    giftFromType: "user",
    giftMessage: offer.message,
  });

  if ((recipient as any)?.email) {
    const subject = `${senderName} wants to sell you a reserve for $${offer.priceUsd.toFixed(
      2
    )}`;
    const html = `
      <p>Hi ${(recipient as any).name || "there"},</p>
      <p><strong>${senderName}</strong> has offered to transfer the reserve
      <strong>${offer.itemName}</strong> (${offer.itemType}) to you for
      <strong>$${offer.priceUsd.toFixed(2)}</strong>.</p>
      ${offer.message ? `<p>Message: "${offer.message}"</p>` : ""}
      <p>Open Garage to approve or deny — you'll pick which of your office
      wallets to pay from.</p>
    `;
    await sendMail(
      (recipient as any).email,
      subject,
      html,
      `${senderName} wants to sell you reserve ${offer.itemName} for $${offer.priceUsd.toFixed(2)}.`,
      EMAIL_FROM_NOTIFICATION
    );
  }
}

async function notifyOfferResolved(
  offer: IPendingReserveAssignment,
  outcome: PendingReserveAssignmentStatus
) {
  // Sender cancellation is initiated by the sender — they already know.
  if (outcome === "cancelled") return;

  const [recipient, sender] = await Promise.all([
    User.findById(offer.toUserId).select("name email profilePicture").lean(),
    User.findById(offer.fromUserId).select("name email").lean(),
  ]);
  const recipientName =
    (recipient as any)?.name || (recipient as any)?.email || "The buyer";

  await UserNotification.create({
    userId: offer.fromUserId,
    type: "reserve_offer",
    reserveOfferId: offer._id,
    reserveItemType: offer.itemType,
    reserveItemName: offer.itemName,
    reservePriceUsd: offer.priceUsd,
    giftFromUserId: offer.toUserId,
    giftFromName: recipientName,
    giftFromPicture: (recipient as any)?.profilePicture,
    giftFromType: "user",
    giftMessage:
      outcome === "approved"
        ? `Approved your offer — $${offer.priceUsd.toFixed(2)} credited.`
        : `Declined your offer.`,
  });

  if ((sender as any)?.email) {
    const subject =
      outcome === "approved"
        ? `${recipientName} bought your reserve for $${offer.priceUsd.toFixed(2)}`
        : `${recipientName} declined your reserve offer`;
    const body =
      outcome === "approved"
        ? `<p>${recipientName} has approved your offer. <strong>$${offer.priceUsd.toFixed(2)}</strong> has been credited to your store wallet.</p>`
        : `<p>${recipientName} declined your offer for reserve <strong>${offer.itemName}</strong>. The reserve is back in your inventory.</p>`;
    await sendMail(
      (sender as any).email,
      subject,
      body,
      subject,
      EMAIL_FROM_NOTIFICATION
    );
  }
}
