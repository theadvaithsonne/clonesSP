import { Types } from "mongoose";
import {
  PendingCouponGift,
  IPendingCouponGift,
  PendingCouponGiftStatus,
} from "../models/pendingCouponGift.model";
import { CouponAssignment } from "../models/couponAssignment.model";
import { StoreWallet } from "../models/storeWallet.model";
import { User } from "../models/user.model";
import { UserNotification } from "../models/userNotification.model";
import { transferAssignment } from "./couponAssignment";
import { transferStoreCredits } from "./wallet";
import { sendMail, EMAIL_FROM_NOTIFICATION } from "./mailer";

/**
 * Paid coupon-gift service. The free path lives in `couponAssignment.ts` and
 * is unchanged. This file owns the lifecycle for offers that require recipient
 * approval + a wallet transfer.
 */

export class PendingGiftError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "PendingGiftError";
  }
}

const TWO_DP = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────────────────────────────────────────────────────
// Create
// ───────────────────────────────────────────────────────────────────────

export interface CreatePendingGiftInput {
  fromUserId: string;
  fromAssignmentId: string;
  toEmail: string;
  priceUsd: number;
  message?: string;
  orgId: string; // sender's current org context (where the wallet transfer will land)
}

export async function createPendingGift(
  input: CreatePendingGiftInput
): Promise<IPendingCouponGift> {
  if (!Types.ObjectId.isValid(input.fromAssignmentId)) {
    throw new PendingGiftError(400, "INVALID_ASSIGNMENT", "Invalid assignment ID");
  }
  if (!Types.ObjectId.isValid(input.orgId)) {
    throw new PendingGiftError(400, "INVALID_ORG", "Invalid orgId");
  }
  const priceUsd = TWO_DP(input.priceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd < 0.01) {
    throw new PendingGiftError(
      400,
      "INVALID_PRICE",
      "Price must be at least $0.01"
    );
  }

  const source = await CouponAssignment.findById(input.fromAssignmentId);
  if (!source) {
    throw new PendingGiftError(404, "REWARD_NOT_FOUND", "Reward not found");
  }
  if (source.userId.toString() !== input.fromUserId) {
    throw new PendingGiftError(403, "NOT_OWNER", "Not your reward to sell");
  }
  if (source.status !== "active") {
    throw new PendingGiftError(
      400,
      "NOT_ACTIVE",
      `Cannot sell a reward that is ${source.status}`
    );
  }
  if (source.pendingGiftId) {
    throw new PendingGiftError(
      409,
      "ALREADY_PENDING",
      "This reward already has a pending offer. Cancel it first."
    );
  }

  // Resolve recipient by email (case-insensitive match — same shape as the
  // existing free gift endpoint).
  const normalizedEmail = input.toEmail.trim().toLowerCase();
  const recipient = await User.findOne({
    email: new RegExp(
      "^" + normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
      "i"
    ),
  })
    .select("_id email name")
    .lean();
  if (!recipient) {
    throw new PendingGiftError(
      404,
      "RECIPIENT_NOT_FOUND",
      "No Garage user with that email"
    );
  }
  if ((recipient as any)._id.toString() === input.fromUserId) {
    throw new PendingGiftError(
      400,
      "SELF_GIFT_NOT_ALLOWED",
      "You cannot sell a reward to yourself"
    );
  }

  // Recipient must have a wallet in the sender's org context with enough
  // balance NOW. The UI already filters but this is the source of truth.
  const recipientWallet = await StoreWallet.findOne({
    userId: (recipient as any)._id,
    orgId: new Types.ObjectId(input.orgId),
  }).lean();
  const recipientBalance = (recipientWallet as any)?.balance ?? 0;
  if (recipientBalance < priceUsd) {
    throw new PendingGiftError(
      400,
      "RECIPIENT_INSUFFICIENT_BALANCE",
      `Recipient's store wallet balance ($${recipientBalance.toFixed(
        2
      )}) is below the asking price ($${priceUsd.toFixed(2)}).`
    );
  }

  // Create the offer + lock the sender's assignment. The partial-unique
  // index on { fromAssignmentId, status: "pending" } guarantees we can't
  // double-lock under concurrency — the second insert collides on E11000.
  let offer: IPendingCouponGift;
  try {
    offer = await PendingCouponGift.create({
      fromUserId: new Types.ObjectId(input.fromUserId),
      toUserId: (recipient as any)._id,
      fromAssignmentId: source._id,
      couponId: source.couponId,
      couponSource: source.couponSource,
      couponCode: source.couponCode,
      orgId: new Types.ObjectId(input.orgId),
      priceUsd,
      message: input.message,
      status: "pending",
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new PendingGiftError(
        409,
        "ALREADY_PENDING",
        "This reward already has a pending offer."
      );
    }
    throw err;
  }

  source.pendingGiftId = offer._id;
  await source.save();

  // Notify recipient (best-effort).
  void notifyOfferCreated(offer).catch((err) =>
    console.error("[PendingCouponGift] notifyOfferCreated failed:", err)
  );

  return offer;
}

// ───────────────────────────────────────────────────────────────────────
// Approve
// ───────────────────────────────────────────────────────────────────────

export async function approvePendingGift(
  offerId: string,
  recipientId: string
): Promise<IPendingCouponGift> {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new PendingGiftError(400, "INVALID_OFFER", "Invalid offer ID");
  }

  const offer = await PendingCouponGift.findById(offerId);
  if (!offer) {
    throw new PendingGiftError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (offer.toUserId.toString() !== recipientId) {
    throw new PendingGiftError(
      403,
      "NOT_RECIPIENT",
      "This offer is not addressed to you"
    );
  }
  if (offer.status !== "pending") {
    throw new PendingGiftError(
      409,
      "NOT_PENDING",
      `Offer is already ${offer.status}`
    );
  }

  // Re-check wallet balance at approve-time — the recipient may have spent
  // their credits elsewhere since the offer was created.
  const wallet = await StoreWallet.findOne({
    userId: offer.toUserId,
    orgId: offer.orgId,
  }).lean();
  const balance = (wallet as any)?.balance ?? 0;
  if (balance < offer.priceUsd) {
    throw new PendingGiftError(
      400,
      "INSUFFICIENT_BALANCE",
      `Your store wallet balance ($${balance.toFixed(
        2
      )}) is below the offer price ($${offer.priceUsd.toFixed(
        2
      )}). Top up and try again.`
    );
  }

  // Re-check sender's assignment is still locked + pointing at this offer.
  const source = await CouponAssignment.findById(offer.fromAssignmentId);
  if (!source || source.status !== "active") {
    // Sender's coupon vanished between offer creation and now (shouldn't
    // happen because the lock prevents redemption). Auto-cancel the offer.
    offer.status = "cancelled";
    offer.respondedAt = new Date();
    await offer.save();
    throw new PendingGiftError(
      410,
      "SOURCE_GONE",
      "The sender's reward is no longer available."
    );
  }
  if (
    !source.pendingGiftId ||
    source.pendingGiftId.toString() !== offer._id.toString()
  ) {
    throw new PendingGiftError(
      409,
      "LOCK_DESYNC",
      "The reward's lock has drifted. Ask the sender to resend the offer."
    );
  }

  // 1. Money: recipient pays sender. transferStoreCredits is atomic and
  //    creates a paired WalletTransaction ledger on both sides.
  const credits = await transferStoreCredits(
    recipientId,
    offer.fromUserId.toString(),
    offer.orgId.toString(),
    offer.priceUsd,
    `Coupon purchase: ${offer.couponCode}`
  );

  // 2. Coupon: revoke sender's assignment, create recipient's. transferAssignment
  //    runs its own re-check and rejects if the source isn't active — but we
  //    just verified it's active and locked-to-this-offer above, so this should
  //    succeed. If it fails after the money moved, log loudly for manual
  //    reconciliation rather than attempting a refund.
  let recipientAssignment;
  try {
    // Temporarily clear the lock so transferAssignment's lock check passes.
    // The next line revokes the row anyway, so this is a one-way transition.
    source.pendingGiftId = undefined;
    await source.save();

    recipientAssignment = await transferAssignment({
      fromAssignmentId: offer.fromAssignmentId.toString(),
      fromUserId: offer.fromUserId.toString(),
      toUserId: recipientId,
      message: offer.message,
    });
  } catch (assignErr: any) {
    console.error(
      `[PendingCouponGift] CRITICAL: wallet transfer succeeded but coupon transfer failed for offer ${offer._id}. ` +
        `Sender ${offer.fromUserId} was credited $${offer.priceUsd}. Recipient ${recipientId} debited but did NOT receive the coupon. Manual reconciliation required.`,
      assignErr
    );
    // Mark the offer as approved-but-broken via status + audit fields so an
    // admin can spot it. We still throw — the recipient should know the call
    // didn't fully succeed.
    offer.status = "approved";
    offer.respondedAt = new Date();
    offer.resolutionTxRefs = {
      senderWalletTxId: credits.recipientTransaction._id,
      recipientWalletTxId: credits.senderTransaction._id,
    };
    await offer.save();
    throw new PendingGiftError(
      500,
      "COUPON_TRANSFER_FAILED",
      "Payment went through but the coupon transfer failed. Support has been alerted."
    );
  }

  offer.status = "approved";
  offer.respondedAt = new Date();
  offer.resolutionTxRefs = {
    senderWalletTxId: credits.recipientTransaction._id, // sender's side = credit
    recipientWalletTxId: credits.senderTransaction._id, // recipient's side = debit
    recipientAssignmentId: recipientAssignment._id,
  };
  await offer.save();

  void notifyOfferResolved(offer, "approved").catch((err) =>
    console.error("[PendingCouponGift] notifyOfferResolved failed:", err)
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
  newStatus: Extract<PendingCouponGiftStatus, "rejected" | "cancelled">
): Promise<IPendingCouponGift> {
  if (!Types.ObjectId.isValid(offerId)) {
    throw new PendingGiftError(400, "INVALID_OFFER", "Invalid offer ID");
  }
  const offer = await PendingCouponGift.findById(offerId);
  if (!offer) {
    throw new PendingGiftError(404, "OFFER_NOT_FOUND", "Offer not found");
  }
  if (offer[expectedField].toString() !== actorId) {
    throw new PendingGiftError(
      403,
      expectedField === "toUserId" ? "NOT_RECIPIENT" : "NOT_SENDER",
      "Not your offer"
    );
  }
  if (offer.status !== "pending") {
    throw new PendingGiftError(
      409,
      "NOT_PENDING",
      `Offer is already ${offer.status}`
    );
  }

  offer.status = newStatus;
  offer.respondedAt = new Date();
  await offer.save();

  // Unlock the sender's assignment (only if it still points at this offer —
  // defensive against drift).
  await CouponAssignment.updateOne(
    { _id: offer.fromAssignmentId, pendingGiftId: offer._id },
    { $unset: { pendingGiftId: "" } }
  );

  void notifyOfferResolved(offer, newStatus).catch((err) =>
    console.error("[PendingCouponGift] notifyOfferResolved failed:", err)
  );

  return offer;
}

export async function rejectPendingGift(
  offerId: string,
  recipientId: string
): Promise<IPendingCouponGift> {
  return resolveWithoutTransfer(offerId, recipientId, "toUserId", "rejected");
}

export async function cancelPendingGift(
  offerId: string,
  senderId: string
): Promise<IPendingCouponGift> {
  return resolveWithoutTransfer(offerId, senderId, "fromUserId", "cancelled");
}

// ───────────────────────────────────────────────────────────────────────
// Lists (sender outbox + recipient inbox)
// ───────────────────────────────────────────────────────────────────────

export async function listIncomingPending(userId: string) {
  return PendingCouponGift.find({
    toUserId: new Types.ObjectId(userId),
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function listOutgoingPending(userId: string) {
  return PendingCouponGift.find({
    fromUserId: new Types.ObjectId(userId),
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .lean();
}

// ───────────────────────────────────────────────────────────────────────
// Recipient-eligibility search (UI dropdown)
// ───────────────────────────────────────────────────────────────────────

export interface EligibilityRow {
  userId: string;
  name?: string;
  email: string;
  balance: number;
  eligible: boolean;
}

/**
 * Search candidate recipients by name/email and return their store wallet
 * balance in the sender's current org. The UI greys out rows with
 * `eligible === false`.
 *
 * Excludes the sender themselves.
 */
export async function searchRecipientEligibility(
  senderId: string,
  orgId: string,
  priceUsd: number,
  searchTerm: string,
  limit = 20
): Promise<EligibilityRow[]> {
  if (!Types.ObjectId.isValid(orgId)) {
    throw new PendingGiftError(400, "INVALID_ORG", "Invalid orgId");
  }
  const trimmed = (searchTerm || "").trim();
  if (trimmed.length < 2) return [];

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  const users = await User.find({
    _id: { $ne: new Types.ObjectId(senderId) },
    $or: [{ email: regex }, { name: regex }, { phone: regex }],
  })
    .select("_id email name profilePicture")
    .limit(limit)
    .lean();

  if (users.length === 0) return [];

  const wallets = await StoreWallet.find({
    userId: { $in: users.map((u: any) => u._id) },
    orgId: new Types.ObjectId(orgId),
  })
    .select("userId balance")
    .lean();
  const walletByUser = new Map(
    wallets.map((w: any) => [w.userId.toString(), w.balance ?? 0])
  );

  const cutoff = TWO_DP(priceUsd);
  return users.map((u: any) => {
    const balance = walletByUser.get(u._id.toString()) ?? 0;
    return {
      userId: u._id.toString(),
      name: u.name,
      email: u.email,
      balance,
      eligible: balance >= cutoff,
    };
  });
}

// ───────────────────────────────────────────────────────────────────────
// Notifications (best-effort)
// ───────────────────────────────────────────────────────────────────────

async function notifyOfferCreated(offer: IPendingCouponGift) {
  const [sender, recipient] = await Promise.all([
    User.findById(offer.fromUserId).select("name email").lean(),
    User.findById(offer.toUserId).select("name email").lean(),
  ]);
  const senderName =
    (sender as any)?.name || (sender as any)?.email || "A user";

  await UserNotification.create({
    userId: offer.toUserId,
    type: "coupon_gift",
    couponCode: offer.couponCode,
    assignmentId: offer.fromAssignmentId,
    giftFromUserId: offer.fromUserId,
    giftFromName: senderName,
    giftFromType: "user",
    giftMessage: offer.message,
  });

  if ((recipient as any)?.email) {
    const subject = `${senderName} wants to sell you a coupon for $${offer.priceUsd.toFixed(
      2
    )}`;
    const html = `
      <p>Hi ${(recipient as any).name || "there"},</p>
      <p><strong>${senderName}</strong> has offered to transfer the coupon
      <code>${offer.couponCode}</code> to you for
      <strong>$${offer.priceUsd.toFixed(2)}</strong>.</p>
      ${offer.message ? `<p>Message: "${offer.message}"</p>` : ""}
      <p>Open Garage to approve or deny.</p>
    `;
    await sendMail(
      (recipient as any).email,
      subject,
      html,
      `${senderName} wants to sell you coupon ${offer.couponCode} for $${offer.priceUsd.toFixed(2)}.`,
      EMAIL_FROM_NOTIFICATION
    );
  }
}

async function notifyOfferResolved(
  offer: IPendingCouponGift,
  outcome: PendingCouponGiftStatus
) {
  // Sender is the one who cares about the outcome (recipient already knows —
  // they took the action). Skip notifying for sender-initiated cancellation.
  if (outcome === "cancelled") return;

  const [recipient, sender] = await Promise.all([
    User.findById(offer.toUserId).select("name email").lean(),
    User.findById(offer.fromUserId).select("name email").lean(),
  ]);
  const recipientName =
    (recipient as any)?.name || (recipient as any)?.email || "The buyer";

  await UserNotification.create({
    userId: offer.fromUserId,
    type: "coupon_gift",
    couponCode: offer.couponCode,
    assignmentId: offer.fromAssignmentId,
    giftFromUserId: offer.toUserId,
    giftFromName: recipientName,
    giftFromType: "user",
    giftMessage:
      outcome === "approved"
        ? `Approved your offer — $${offer.priceUsd.toFixed(2)} credited.`
        : `Declined your offer.`,
  });

  if ((sender as any)?.email) {
    const subject =
      outcome === "approved"
        ? `${recipientName} bought your coupon for $${offer.priceUsd.toFixed(2)}`
        : `${recipientName} declined your coupon offer`;
    const body =
      outcome === "approved"
        ? `<p>${recipientName} has approved your offer. <strong>$${offer.priceUsd.toFixed(2)}</strong> has been credited to your store wallet.</p>`
        : `<p>${recipientName} declined your offer for coupon <code>${offer.couponCode}</code>. The coupon is back in your rewards.</p>`;
    await sendMail(
      (sender as any).email,
      subject,
      body,
      subject,
      EMAIL_FROM_NOTIFICATION
    );
  }
}
