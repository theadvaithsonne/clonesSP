import { Types } from "mongoose";
import {
  CouponAssignment,
  ICouponAssignment,
  CouponAssignmentSource,
} from "../models/couponAssignment.model";
import { PlatformCoupon } from "../models/platformCoupon.model";
import { PlatformCouponRedemption } from "../models/platformCouponRedemption.model";
import { Coupon } from "../models/coupon.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { UserNotification } from "../models/userNotification.model";
import {
  sendMail,
  EMAIL_FROM_NOTIFICATION,
  couponAssignedEmailTemplate,
  couponGiftedEmailTemplate,
} from "./mailer";

const PRODUCT_LABELS: Record<string, string> = {
  office_plan: "Office Plans",
  unilevel_plus: "Unilevel Plus",
  third_party_subscription: "Subscriptions",
  channel: "Channels",
  course: "Courses",
  workshop: "Workshops",
  product: "Products",
  service: "Services",
  call: "Calls",
};

/**
 * Where the recipient actually goes to spend the coupon.
 *
 * A coupon is redeemed by pasting the code at that product's checkout — the
 * Rewards tab only lists coupons and offers "Copy code", it cannot redeem one.
 * So "how to redeem" is useless without naming the destination, and the
 * destination differs per product: a 12-month Office coupon and a NetworkChain
 * coupon send someone to two completely different places.
 *
 * Keyed on the same `productType` as PRODUCT_LABELS above; an unmapped product
 * falls back to generic wording rather than rendering a blank step.
 */
const REDEEM_DESTINATIONS: Record<string, string> = {
  office_plan: "GaragePay → Office and start your Founders Office subscription",
  unilevel_plus: "GaragePay → Affiliate and activate Unilevel Plus",
  third_party_subscription: "GaragePay → Affiliate and activate NetworkChain",
  channel: "the community you want to join and press Subscribe",
  course: "the course you want and press Enrol",
  workshop: "the workshop you want and press Register",
  product: "the product you want and press Buy",
  service: "the service you want and press Book",
  call: "the call you want and press Book",
};

function discountLabelFor(c: {
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number;
  currency?: string;
  cycleCount?: number;
}): string {
  const sym = c.currency === "INR" ? "₹" : "$";
  // On a subscription coupon the DURATION is half the offer — "100% off" alone
  // reads as one free cycle when FOUNDERSOFFICE3 is actually twelve. Only the
  // hand-written coupon names carried this before, so a coupon named after its
  // own code said nothing about how long it lasts.
  const cycles =
    c.cycleCount && c.cycleCount > 1 ? ` · first ${c.cycleCount} cycles` : "";
  if (c.discountType === "fixed") {
    return `${sym}${(c.discountValue / 100).toFixed(2)} off${cycles}`;
  }
  const cap = c.maxDiscountAmount
    ? ` (up to ${sym}${(c.maxDiscountAmount / 100).toFixed(2)})`
    : "";
  return `${c.discountValue}% off${cap}${cycles}`;
}

export interface AssignCouponInput {
  userId: string;
  couponId: string;
  couponSource: CouponAssignmentSource;
  assignedBy: string;
  assignedByType: "garage_admin" | "founder" | "system";
  assignerOrgId?: string;
  reason?: string;
  expiresAt?: Date;
  /** Number of redemption uses this assignment carries. Defaults to 1. */
  availableUses?: number;
  /**
   * When true and the recipient already has an active assignment for this
   * coupon, ADD `availableUses` to the existing counter (rule re-fire). When
   * false (default), the existing-active path is a no-op.
   */
  mergeAvailableUses?: boolean;
}

export async function assignCoupon(
  input: AssignCouponInput
): Promise<ICouponAssignment> {
  // Resolve coupon + code snapshot
  let couponCode = "";
  let couponOrgId: string | undefined;

  if (input.couponSource === "platform") {
    const coupon = await PlatformCoupon.findById(input.couponId).lean();
    if (!coupon) throw new Error("Coupon not found");
    couponCode = coupon.code;
    couponOrgId = coupon.orgId?.toString();
  } else {
    const coupon = await Coupon.findById(input.couponId).lean();
    if (!coupon) throw new Error("Coupon not found");
    couponCode = coupon.code;
    couponOrgId = coupon.orgId?.toString();
  }

  // Authorization: founders can only assign their org's coupons
  if (input.assignedByType === "founder") {
    if (!input.assignerOrgId) {
      throw new Error("orgId required for founder assignment");
    }
    if (!couponOrgId || couponOrgId !== input.assignerOrgId) {
      throw new Error(
        "You can only assign coupons that belong to your organization"
      );
    }
  }

  // Verify user exists
  const user = await User.findById(input.userId).select("_id").lean();
  if (!user) throw new Error("User not found");

  // Idempotent upsert with revoke-aware reactivation:
  //   - no prior row             → insert active (notify)
  //   - prior row, status=active → no-op (don't notify; already had it)
  //   - prior row, status=used   → no-op (used coupons can't be re-gifted)
  //   - prior row, status=revoked or expired → reactivate (notify again)
  const before = await CouponAssignment.findOne({
    userId: new Types.ObjectId(input.userId),
    couponId: new Types.ObjectId(input.couponId),
    couponSource: input.couponSource,
  }).lean();

  const shouldReactivate =
    !!before && (before.status === "revoked" || before.status === "expired");
  const shouldMerge =
    !!before && before.status === "active" && input.mergeAvailableUses === true;

  const usesToGrant = Math.max(1, input.availableUses ?? 1);

  let assignment: ICouponAssignment;
  if (!before) {
    // Fresh insert
    assignment = await CouponAssignment.create({
      userId: new Types.ObjectId(input.userId),
      couponId: new Types.ObjectId(input.couponId),
      couponSource: input.couponSource,
      couponCode,
      status: "active",
      assignedBy: new Types.ObjectId(input.assignedBy),
      assignedByType: input.assignedByType,
      assignerOrgId: input.assignerOrgId
        ? new Types.ObjectId(input.assignerOrgId)
        : undefined,
      reason: input.reason,
      expiresAt: input.expiresAt,
      availableUses: usesToGrant,
    });
  } else if (shouldReactivate) {
    // Re-arm a previously revoked/expired row
    const updated = await CouponAssignment.findByIdAndUpdate(
      before._id,
      {
        $set: {
          status: "active",
          assignedBy: new Types.ObjectId(input.assignedBy),
          assignedByType: input.assignedByType,
          assignerOrgId: input.assignerOrgId
            ? new Types.ObjectId(input.assignerOrgId)
            : undefined,
          reason: input.reason,
          expiresAt: input.expiresAt,
          availableUses: usesToGrant,
          // Wipe peer-transfer breadcrumbs from the prior life so this looks
          // like a fresh admin/founder assignment.
          giftedFromUserId: undefined,
          parentAssignmentId: undefined,
          giftMessage: undefined,
        },
        $unset: { revokedAt: "" },
      },
      { new: true }
    );
    assignment = updated!;
  } else if (shouldMerge) {
    // Rule re-fire on existing active assignment — top up uses
    const updated = await CouponAssignment.findByIdAndUpdate(
      before._id,
      { $inc: { availableUses: usesToGrant } },
      { new: true }
    );
    assignment = updated!;
  } else {
    // Already active (or used) — return as-is, no notification.
    assignment = (await CouponAssignment.findById(before._id))!;
  }

  // Notify when this is a fresh assignment, a reactivation, or a merge top-up
  // (recipient should know they got more uses).
  const shouldNotify =
    (!before || shouldReactivate || shouldMerge) &&
    input.couponSource === "platform";
  if (shouldNotify) {
    void notifyAssignedReward({
      assignment,
      assignedByType: input.assignedByType,
      assignerOrgId: input.assignerOrgId,
      assignerUserId: input.assignedBy,
    });
  }

  return assignment;
}

interface NotifyAssignedRewardArgs {
  assignment: ICouponAssignment;
  assignedByType: "garage_admin" | "founder" | "system";
  assignerOrgId?: string;
  assignerUserId: string;
}

async function notifyAssignedReward(args: NotifyAssignedRewardArgs) {
  try {
    const { assignment, assignedByType, assignerOrgId } = args;
    const [recipient, coupon, org] = await Promise.all([
      User.findById(assignment.userId).select("email name").lean(),
      PlatformCoupon.findById(assignment.couponId).lean(),
      assignerOrgId
        ? Organization.findById(assignerOrgId).select("name").lean()
        : Promise.resolve(null),
    ]);
    if (!recipient || !coupon || !recipient.email) return;

    const orgName = (org as any)?.name as string | undefined;
    const assignerLabel =
      assignedByType === "founder" && orgName
        ? orgName
        : assignedByType === "system"
          ? "Garage"
          : "Garage Admin";

    const couponContent = {
      code: coupon.code,
      name: coupon.name,
      discountLabel: discountLabelFor(coupon as any),
      productLabel: PRODUCT_LABELS[coupon.productType] || coupon.productType,
      validUntil: coupon.validUntil,
      redeemAt: REDEEM_DESTINATIONS[coupon.productType],
    };

    const tpl = couponAssignedEmailTemplate({
      recipientName: (recipient as any).name,
      assignerLabel,
      coupon: couponContent,
      reason: assignment.reason,
    });

    await Promise.allSettled([
      sendMail(recipient.email, tpl.subject, tpl.html, tpl.text, EMAIL_FROM_NOTIFICATION),
      UserNotification.create({
        userId: assignment.userId,
        orgId: assignerOrgId ? new Types.ObjectId(assignerOrgId) : undefined,
        type: "coupon_gift",
        couponCode: coupon.code,
        couponName: coupon.name,
        assignmentId: assignment._id,
        giftFromType: assignedByType === "founder" ? "founder" : "garage_admin",
        giftFromName: assignerLabel,
        giftOrgName: orgName,
      }),
    ]);
  } catch (err) {
    console.error("[couponAssignment] notifyAssignedReward error:", err);
  }
}

/**
 * Peer-to-peer transfer: revoke the sender's assignment and create a fresh
 * active assignment for the recipient. One license = one assignment row.
 */
export async function transferAssignment(input: {
  fromAssignmentId: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
}): Promise<ICouponAssignment> {
  if (input.fromUserId === input.toUserId) {
    throw new Error("You cannot gift a coupon to yourself");
  }

  const source = await CouponAssignment.findById(input.fromAssignmentId);
  if (!source) throw new Error("Reward not found");
  if (source.userId.toString() !== input.fromUserId) {
    throw new Error("Not your reward to gift");
  }
  if (source.status !== "active") {
    throw new Error(`Cannot gift a reward that is ${source.status}`);
  }
  if (source.pendingGiftId) {
    throw new Error(
      "This reward has a pending paid-gift offer. Cancel it before gifting elsewhere."
    );
  }

  const recipient = await User.findById(input.toUserId).select("_id email name").lean();
  if (!recipient) throw new Error("Recipient user not found");

  const sender = await User.findById(input.fromUserId).select("name email").lean();
  const senderName = (sender as any)?.name || (sender as any)?.email || "A friend";

  // Revoke source first
  source.status = "revoked";
  source.revokedAt = new Date();
  await source.save();

  // Upsert into recipient row (handles the case where recipient previously
  // had an assignment for this coupon — overwrite to active with new lineage)
  const recipientAssignment = await CouponAssignment.findOneAndUpdate(
    {
      userId: new Types.ObjectId(input.toUserId),
      couponId: source.couponId,
      couponSource: source.couponSource,
    },
    {
      $set: {
        userId: new Types.ObjectId(input.toUserId),
        couponId: source.couponId,
        couponSource: source.couponSource,
        couponCode: source.couponCode,
        status: "active",
        assignedBy: new Types.ObjectId(input.fromUserId),
        assignedByType: "user",
        giftedFromUserId: new Types.ObjectId(input.fromUserId),
        parentAssignmentId: source._id,
        giftMessage: input.message,
        assignerOrgId: source.assignerOrgId,
        reason: undefined,
        expiresAt: source.expiresAt,
        redemptionRef: undefined,
        redeemedAt: undefined,
        revokedAt: undefined,
      },
    },
    { upsert: true, new: true }
  );

  // Fire notification + email (best-effort)
  if (source.couponSource === "platform") {
    void notifyGiftedReward({
      assignment: recipientAssignment,
      senderName,
      message: input.message,
    });
  }

  return recipientAssignment;
}

interface NotifyGiftedRewardArgs {
  assignment: ICouponAssignment;
  senderName: string;
  message?: string;
}

async function notifyGiftedReward(args: NotifyGiftedRewardArgs) {
  try {
    const { assignment, senderName, message } = args;
    const [recipient, coupon] = await Promise.all([
      User.findById(assignment.userId).select("email name").lean(),
      PlatformCoupon.findById(assignment.couponId).lean(),
    ]);
    if (!recipient || !coupon || !recipient.email) return;

    const couponContent = {
      code: coupon.code,
      name: coupon.name,
      discountLabel: discountLabelFor(coupon as any),
      productLabel: PRODUCT_LABELS[coupon.productType] || coupon.productType,
      validUntil: coupon.validUntil,
      redeemAt: REDEEM_DESTINATIONS[coupon.productType],
    };

    const tpl = couponGiftedEmailTemplate({
      recipientName: (recipient as any).name,
      senderName,
      coupon: couponContent,
      giftMessage: message,
    });

    await Promise.allSettled([
      sendMail(recipient.email, tpl.subject, tpl.html, tpl.text, EMAIL_FROM_NOTIFICATION),
      UserNotification.create({
        userId: assignment.userId,
        type: "coupon_gift",
        couponCode: coupon.code,
        couponName: coupon.name,
        assignmentId: assignment._id,
        giftFromUserId: assignment.giftedFromUserId,
        giftFromType: "user",
        giftFromName: senderName,
        giftMessage: message,
      }),
    ]);
  } catch (err) {
    console.error("[couponAssignment] notifyGiftedReward error:", err);
  }
}

export async function revokeAssignment(
  assignmentId: string,
  revokedByUserId: string,
  revokedByType: "garage_admin" | "founder" | "system",
  revokerOrgId?: string
): Promise<ICouponAssignment | null> {
  const assignment = await CouponAssignment.findById(assignmentId);
  if (!assignment) return null;

  // Founders can only revoke assignments for their org's coupons
  if (revokedByType === "founder") {
    if (
      !revokerOrgId ||
      !assignment.assignerOrgId ||
      assignment.assignerOrgId.toString() !== revokerOrgId
    ) {
      throw new Error("Not authorized to revoke this assignment");
    }
  }

  if (assignment.status === "used") {
    throw new Error("Cannot revoke a coupon that has already been used");
  }
  if (assignment.status === "revoked") return assignment;

  assignment.status = "revoked";
  assignment.revokedAt = new Date();
  await assignment.save();

  // Note: we don't track revokedBy for brevity; can be added if needed
  void revokedByUserId;
  return assignment;
}

export async function listAssignmentsForUser(
  userId: string,
  options: { status?: string } = {}
): Promise<ICouponAssignment[]> {
  const query: any = { userId: new Types.ObjectId(userId) };
  if (options.status) query.status = options.status;
  return CouponAssignment.find(query).sort({ createdAt: -1 });
}

export async function listAssignmentsForCoupon(
  couponId: string,
  couponSource: CouponAssignmentSource
): Promise<ICouponAssignment[]> {
  return CouponAssignment.find({
    couponId: new Types.ObjectId(couponId),
    couponSource,
  })
    .sort({ createdAt: -1 })
    .populate("userId", "email name profilePicture");
}

/**
 * Decrement an active assignment's `availableUses` when the user redeems the
 * coupon. Only flips status to `"used"` when the counter hits 0. For legacy
 * single-use assignments (availableUses defaults to 1), the first redemption
 * still flips status to "used" — same behavior as before.
 *
 * Always stamps `redemptionRef` + `redeemedAt` to the most recent redemption.
 */
export async function markAssignmentUsed(
  userId: string,
  couponId: string,
  couponSource: CouponAssignmentSource,
  redemptionRef?: string
): Promise<void> {
  const assignment = await CouponAssignment.findOne({
    userId: new Types.ObjectId(userId),
    couponId: new Types.ObjectId(couponId),
    couponSource,
    status: "active",
  });
  if (!assignment) return;

  // Locked by an outstanding paid-gift offer — refuse to spend it from
  // under the recipient. Sender must resolve (cancel/approve/reject) first.
  if (assignment.pendingGiftId) {
    throw new Error(
      "This reward is locked while a paid-gift offer is pending. Cancel or resolve the offer first."
    );
  }

  // Treat undefined as 1 for backwards-compat with assignments created before
  // the availableUses field existed.
  const current = typeof assignment.availableUses === "number"
    ? assignment.availableUses
    : 1;
  const next = Math.max(0, current - 1);

  assignment.availableUses = next;
  assignment.redeemedAt = new Date();
  if (redemptionRef) {
    assignment.redemptionRef = new Types.ObjectId(redemptionRef);
  }
  if (next === 0) {
    assignment.status = "used";
  }
  await assignment.save();
}

/**
 * Called when a user tries to validate/apply a coupon. Returns true only if
 * the user has an active assignment OR the coupon is a legacy "open" code
 * anyone can use (if the caller wants to enforce assignment-only mode, they
 * should check this function's return value before allowing redemption).
 *
 * For this release we use assignment as a PULL-based visibility filter — any
 * assigned user sees the coupon in their Rewards tab, and the existing
 * validation path still allows users to manually enter codes if they know
 * them (via checkout). Assignment is *discovery*, not enforcement.
 */
export async function hasActiveAssignment(
  userId: string,
  couponId: string,
  couponSource: CouponAssignmentSource
): Promise<boolean> {
  const exists = await CouponAssignment.exists({
    userId: new Types.ObjectId(userId),
    couponId: new Types.ObjectId(couponId),
    couponSource,
    status: "active",
  });
  return !!exists;
}

// Re-export for convenience
export { PlatformCouponRedemption };
