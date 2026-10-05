import mongoose, { Types } from "mongoose";
import {
  ItemReserveLicense,
  IItemReserveLicense,
  ItemReserveType,
  ItemReserveStatus,
} from "../models/itemReserveLicense.model";
import { User } from "../models/user.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Course } from "../models/course.model";
import { Channel } from "../models/channel.model";
import { Workshop } from "../models/workshop.model";
import { CallOffering } from "../models/callOffering.model";
import { Floor } from "../models/floor.model";
import { addUserToGarageHQ } from "./init";
import { autoJoinDefaultChannel, autoJoinMandatoryChannels } from "./channel";
import { registerForPaidWorkshop } from "./workshop";
import { refreshTypeFlags } from "./downlineTree";

/**
 * Generic reserve-license service for course / channel / workshop / call.
 *
 * Mirrors the structural pattern of UP's `reserveLicense.ts` (untouched)
 * but operates on the new `itemreservelicenses` collection and supports
 * multiple itemTypes via a per-type assignment dispatcher.
 */

// ───────────────────────────────────────────────────────────────────────
// Create — called from fulfillInvoice when a buyer purchases N seats
// ───────────────────────────────────────────────────────────────────────

export interface CreateItemReservesInput {
  buyerId: string | Types.ObjectId;
  itemType: ItemReserveType;
  itemId: string | Types.ObjectId;
  itemName: string;
  itemImage?: string;
  organizationId: string | Types.ObjectId;
  invoiceId: string | Types.ObjectId;
  invoiceNumber: string;
  paymentId: string;
  count: number;
  startSeq?: number;
  unitPrice: number;
  currency: string;
  metadata?: Record<string, any>;
}

/**
 * Bulk-create N reserve licenses. Idempotent on (paymentId, seq) — re-firing
 * the fulfillment for the same paid invoice will collide on the unique index
 * and silently skip the duplicates, matching UP's existing behaviour.
 */
export async function createItemReserves(
  input: CreateItemReservesInput
): Promise<IItemReserveLicense[]> {
  if (input.count <= 0) return [];

  const startSeq = input.startSeq ?? 0;
  const docs = Array.from({ length: input.count }, (_, i) => ({
    buyerId: new Types.ObjectId(String(input.buyerId)),
    itemType: input.itemType,
    itemId: new Types.ObjectId(String(input.itemId)),
    itemName: input.itemName,
    itemImage: input.itemImage,
    organizationId: new Types.ObjectId(String(input.organizationId)),
    invoiceId: new Types.ObjectId(String(input.invoiceId)),
    invoiceNumber: input.invoiceNumber,
    paymentId: input.paymentId,
    seq: startSeq + i,
    status: "available" as ItemReserveStatus,
    unitPrice: input.unitPrice,
    currency: input.currency,
    metadata: input.metadata,
  }));

  try {
    return await ItemReserveLicense.insertMany(docs, { ordered: false });
  } catch (err: any) {
    // E11000 on (paymentId, seq) means we've already fulfilled this invoice.
    // Return whatever survived the partial insert, plus the existing rows.
    if (err?.code === 11000 || err?.writeErrors) {
      console.warn(
        `[ItemReserves] partial duplicate on payment ${input.paymentId} — fulfillment likely retried; returning whatever existed.`
      );
      return ItemReserveLicense.find({ paymentId: input.paymentId }).sort({
        seq: 1,
      });
    }
    throw err;
  }
}

// ───────────────────────────────────────────────────────────────────────
// Read — buyer's "my reserves" list + stats
// ───────────────────────────────────────────────────────────────────────

export async function getItemReserves(
  buyerId: string,
  opts: {
    itemType?: ItemReserveType;
    status?: ItemReserveStatus;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ licenses: IItemReserveLicense[]; total: number }> {
  const filter: any = { buyerId: new Types.ObjectId(buyerId) };
  if (opts.itemType) filter.itemType = opts.itemType;
  if (opts.status) filter.status = opts.status;

  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const offset = Math.max(0, opts.offset ?? 0);

  const [licenses, total] = await Promise.all([
    ItemReserveLicense.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("assignedTo", "email name")
      .lean(),
    ItemReserveLicense.countDocuments(filter),
  ]);

  return { licenses: licenses as unknown as IItemReserveLicense[], total };
}

export async function getItemReserveStats(buyerId: string): Promise<{
  total: number;
  available: number;
  assigned: number;
  expired: number;
  byItemType: Record<string, { available: number; assigned: number; total: number }>;
}> {
  const rows = await ItemReserveLicense.aggregate([
    { $match: { buyerId: new Types.ObjectId(buyerId) } },
    {
      $group: {
        _id: { itemType: "$itemType", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  const out = {
    total: 0,
    available: 0,
    assigned: 0,
    expired: 0,
    byItemType: {} as Record<
      string,
      { available: number; assigned: number; total: number }
    >,
  };
  for (const r of rows) {
    const itemType = r._id.itemType as string;
    const status = r._id.status as string;
    const count = r.count as number;
    out.total += count;
    if (status in out) (out as any)[status] += count;
    if (!out.byItemType[itemType]) {
      out.byItemType[itemType] = { available: 0, assigned: 0, total: 0 };
    }
    out.byItemType[itemType].total += count;
    if (status === "available") out.byItemType[itemType].available += count;
    if (status === "assigned") out.byItemType[itemType].assigned += count;
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────
// Assign — buyer grants a reserve to another Garage user
// ───────────────────────────────────────────────────────────────────────

export class ItemReserveError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ItemReserveError";
  }
}

export interface AssignResult {
  license: IItemReserveLicense;
  recipient: { _id: string; email: string; name?: string };
  artifactType: string;
  artifactId: string;
}

/**
 * Assign one reserve to a recipient. The recipient is looked up by email or
 * userId (whichever the caller provides). On success, the reserve flips to
 * status="assigned" and the appropriate downstream artifact is created for
 * the recipient.
 */
export async function assignItemReserve(
  licenseId: string,
  buyerId: string,
  recipient: { email?: string; userId?: string }
): Promise<AssignResult> {
  if (!Types.ObjectId.isValid(licenseId)) {
    throw new ItemReserveError(400, "INVALID_LICENSE_ID", "Invalid licenseId");
  }
  if (!recipient.email && !recipient.userId) {
    throw new ItemReserveError(
      400,
      "MISSING_RECIPIENT",
      "Provide either email or userId"
    );
  }

  // Load + verify
  const license = await ItemReserveLicense.findById(licenseId);
  if (!license) {
    throw new ItemReserveError(404, "LICENSE_NOT_FOUND", "License not found");
  }
  if (String(license.buyerId) !== String(buyerId)) {
    throw new ItemReserveError(
      403,
      "NOT_OWNER",
      "You do not own this reserve license"
    );
  }
  if (license.status !== "available") {
    throw new ItemReserveError(
      400,
      "NOT_AVAILABLE",
      `License is ${license.status}, cannot assign`
    );
  }
  // Locked by a live paid offer — the recipient must approve (or the sender
  // must cancel) before this reserve can move again.
  if (license.pendingAssignmentId) {
    throw new ItemReserveError(
      409,
      "ALREADY_PENDING",
      "This reserve has a pending paid offer. Cancel it first."
    );
  }

  // Resolve recipient
  let recipientUser;
  if (recipient.userId) {
    if (!Types.ObjectId.isValid(recipient.userId)) {
      throw new ItemReserveError(400, "INVALID_USER_ID", "Invalid userId");
    }
    recipientUser = await User.findById(recipient.userId)
      .select("_id email name")
      .lean();
  } else {
    recipientUser = await User.findOne({
      email: new RegExp(
        "^" + recipient.email!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
        "i"
      ),
    })
      .select("_id email name")
      .lean();
  }
  if (!recipientUser) {
    throw new ItemReserveError(
      404,
      "RECIPIENT_NOT_FOUND",
      "Recipient must be an existing Garage user. Ask them to sign up first."
    );
  }

  // Dispatch to per-type fulfillment
  const dispatcher = ASSIGN_DISPATCH[license.itemType];
  if (!dispatcher) {
    throw new ItemReserveError(
      500,
      "UNSUPPORTED_TYPE",
      `No assign dispatcher for itemType "${license.itemType}"`
    );
  }
  const artifact = await dispatcher(license, recipientUser._id);

  // Flip the reserve atomically. If another concurrent caller already
  // assigned this row, $match-by-available fails and we report it.
  const updated = await ItemReserveLicense.findOneAndUpdate(
    { _id: license._id, status: "available" },
    {
      $set: {
        status: "assigned",
        assignedTo: recipientUser._id,
        assignedAt: new Date(),
        assignedArtifactRef: artifact,
      },
    },
    { new: true }
  );
  if (!updated) {
    // Race: the row got assigned between our load and update. The downstream
    // artifact we created might be a duplicate — log loudly so an admin can
    // reconcile if needed (most per-type fulfillers are idempotent though).
    console.warn(
      `[ItemReserves] race on assign for ${license._id} — artifact ${artifact.type}/${artifact.id} may need reconciliation`
    );
    throw new ItemReserveError(
      409,
      "ASSIGN_RACE",
      "License was assigned by another request. Refresh and try again."
    );
  }

  // Recompute the recipient's membership sub-states. The direct-purchase path
  // does this (routes/unilevel-plus.ts:1382) but assignment never did, so
  // someone who RECEIVED a $25 licence kept typeFlags.oneNetworkActivated
  // false despite holding an active UnilevelPlusPurchase. They then showed up
  // in the admin prospecting list as an un-activated prospect, read as "not
  // 1Network Activated" in the downline table's Type column, and were skipped
  // by the franchise affiliate query that gates on the flag.
  //
  // Covers every itemType, not just unilevel_plus: computeTypeFlags derives
  // all three flags (oneNetworkActivated / networkChainsSub / founderSub), so
  // a refresh after any assignment is correct.
  //
  // Fire-and-forget, matching the purchase path — this is display state, and
  // it must never fail an assignment that has already committed.
  void refreshTypeFlags(String(recipientUser._id)).catch((err) =>
    console.error(
      `[ItemReserves] refreshTypeFlags failed for ${recipientUser._id}:`,
      err?.message ?? err,
    ),
  );

  return {
    license: updated,
    recipient: {
      _id: String(recipientUser._id),
      email: recipientUser.email || "",
      name: recipientUser.name || undefined,
    },
    artifactType: artifact.type,
    artifactId: String(artifact.id),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Per-type assign fulfillers
// ───────────────────────────────────────────────────────────────────────

type AssignArtifact = {
  type:
    | "courseEnrollment"
    | "channelMembership"
    | "workshopRegistration"
    | "callPurchase"
    | "productOrder";
  id: Types.ObjectId;
};

const ASSIGN_DISPATCH: Record<
  ItemReserveType,
  (
    license: IItemReserveLicense,
    recipientId: Types.ObjectId
  ) => Promise<AssignArtifact>
> = {
  course: assignCourse,
  channel: assignChannel,
  workshop: assignWorkshop,
  call: assignCall,
  product: assignProduct,
};

// ───────────────────────────────────────────────────────────────────────
// Shared "buyer parity" — replicate the side effects a direct purchase
// would have triggered for the recipient.
//
// A direct purchase via course/channel/workshop/call checkout routes does
// MORE than create the access artifact:
//   (1) pushes the buyer into the seller's org as a guest stakeholder on
//       the first floor,
//   (2) adds them to GARAGE HQ,
//   (3) subscribes them to the item's bundled channelIds[].
//
// Without these, a recipient of an assigned reserve gets the bare artifact
// (CourseEnrollment / ChannelMembership / WorkshopRegistration / CallPurchase)
// but the item never surfaces in their dashboard or org context — for
// workshops in particular, getUserAccessibleWorkshops() filters by channel
// subscriptions, so a registration without a channel membership is invisible.
//
// What we deliberately DO NOT replicate from the direct-purchase path:
//   - Affiliate `referredBy` / `referredByAffiliateId` (those belong to the
//     buyer's chain, not the recipient's).
//   - Welcome email (recipient is already a Garage user — spec rejects
//     unknown emails up at assignItemReserve).
//   - Commission distribution (already fired at the buyer's payment).
//   - Invoice creation (the original invoice is the source).
// ───────────────────────────────────────────────────────────────────────

async function ensureRecipientParity(
  recipientId: Types.ObjectId,
  sellerOrgId: Types.ObjectId,
  channelIds: Types.ObjectId[]
): Promise<void> {
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new ItemReserveError(
      404,
      "RECIPIENT_VANISHED",
      "Recipient user not found"
    );
  }

  // (1) Seller-org membership
  const sellerOrgIdStr = String(sellerOrgId);
  const isMember = recipient.organizations?.some(
    (m: any) => m.organization.toString() === sellerOrgIdStr
  );
  if (!isMember) {
    const firstFloor = await Floor.findOne({ orgId: sellerOrgId })
      .sort({ level: 1 })
      .lean();
    recipient.organizations = recipient.organizations || [];
    recipient.organizations.push({
      organization: sellerOrgId,
      role: "stakeholder",
      guest: true,
      floorId: firstFloor?._id || undefined,
      joinedAt: new Date(),
    } as any);
    await recipient.save();
  }

  // (2) HQ membership — idempotent in init.ts
  await addUserToGarageHQ(String(recipientId));

  // (3) Bundled channel subscriptions
  for (const channelId of channelIds) {
    await ChannelMembership.findOneAndUpdate(
      { userId: recipientId, channelId, orgId: sellerOrgId },
      {
        $setOnInsert: {
          userId: recipientId,
          channelId,
          orgId: sellerOrgId,
          status: "active",
          role: "member",
          joinedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }
}

async function assignCourse(
  license: IItemReserveLicense,
  recipientId: Types.ObjectId
): Promise<AssignArtifact> {
  const course = await Course.findById(license.itemId)
    .select("channelIds organizationId")
    .lean();
  const sellerOrgId =
    (course?.organizationId as Types.ObjectId) || license.organizationId;
  const channelIds = (course?.channelIds || []) as Types.ObjectId[];

  await ensureRecipientParity(recipientId, sellerOrgId, channelIds);

  // Idempotent: if the recipient is already enrolled, link to existing.
  const existing = await CourseEnrollment.findOne({
    courseId: license.itemId,
    userId: recipientId,
  });
  if (existing) {
    return { type: "courseEnrollment", id: existing._id };
  }
  const enrollment = await CourseEnrollment.create({
    courseId: license.itemId,
    userId: recipientId,
    organizationId: sellerOrgId,
    status: "enrolled",
    enrolledAt: new Date(),
    isPaid: true,
    amountPaid: license.unitPrice,
    currency: license.currency,
    paymentId: `reserve_${license._id}`,
    paymentStatus: "completed",
  });
  return { type: "courseEnrollment", id: enrollment._id };
}

async function assignChannel(
  license: IItemReserveLicense,
  recipientId: Types.ObjectId
): Promise<AssignArtifact> {
  const sellerOrgId = license.organizationId;

  // For a channel-type reserve, the assigned channel itself IS the bundle —
  // ensureRecipientParity will upsert the ChannelMembership we need.
  await ensureRecipientParity(recipientId, sellerOrgId, [
    license.itemId as Types.ObjectId,
  ]);

  // Direct buyer also gets auto-joined to the seller-org's default community.
  try {
    await autoJoinDefaultChannel(String(recipientId), String(sellerOrgId));
    await autoJoinMandatoryChannels(String(recipientId), String(sellerOrgId));
  } catch (err) {
    // Default-join is a nice-to-have; never fail the assign over it.
    console.warn(
      `[ItemReserves] autoJoinDefaultChannel failed for ${recipientId} in org ${sellerOrgId}:`,
      err
    );
  }

  const membership = await ChannelMembership.findOne({
    userId: recipientId,
    channelId: license.itemId,
    orgId: sellerOrgId,
  });
  if (!membership) {
    throw new ItemReserveError(
      500,
      "MEMBERSHIP_MISSING",
      "ChannelMembership not found after upsert"
    );
  }
  // The audit link from membership → reserve license lives on the reserve's
  // `assignedArtifactRef`. ChannelMembership has no paymentId field.
  return { type: "channelMembership", id: membership._id };
}

async function assignWorkshop(
  license: IItemReserveLicense,
  recipientId: Types.ObjectId
): Promise<AssignArtifact> {
  const workshop = await Workshop.findById(license.itemId)
    .select("channelIds orgId")
    .lean();
  const sellerOrgId =
    (workshop?.orgId as Types.ObjectId) || license.organizationId;
  const channelIds = (workshop?.channelIds || []) as Types.ObjectId[];

  await ensureRecipientParity(recipientId, sellerOrgId, channelIds);

  // Use the established service helper — it creates `WorkshopRegistration`,
  // which is what `hasSessionAccess()` reads to gate workshop attendance.
  // The function returns `success: false, message: "Already registered..."`
  // when there's already a non-cancelled registration; that's an idempotent
  // success for us, not a failure.
  const result = await registerForPaidWorkshop(
    String(recipientId),
    String(license.itemId),
    String(sellerOrgId),
    {
      paymentId: `reserve_${license._id}`,
      orderId: license.invoiceNumber,
      amount: license.unitPrice,
      currency: license.currency,
    }
  );
  if (
    !result.success &&
    !/already registered/i.test(result.message || "")
  ) {
    throw new ItemReserveError(
      500,
      "WORKSHOP_REGISTER_FAILED",
      result.message || "Failed to register recipient for workshop"
    );
  }

  const registration = await WorkshopRegistration.findOne({
    workshopId: license.itemId,
    userId: recipientId,
  });
  if (!registration) {
    throw new ItemReserveError(
      500,
      "WORKSHOP_REGISTRATION_MISSING",
      "WorkshopRegistration not found after register call"
    );
  }
  return { type: "workshopRegistration", id: registration._id };
}

async function assignCall(
  license: IItemReserveLicense,
  recipientId: Types.ObjectId
): Promise<AssignArtifact> {
  const callOffering = await CallOffering.findById(license.itemId)
    .select("channelIds organizationId")
    .lean();
  const sellerOrgId =
    (callOffering?.organizationId as Types.ObjectId) || license.organizationId;
  const channelIds = (callOffering?.channelIds || []) as Types.ObjectId[];

  await ensureRecipientParity(recipientId, sellerOrgId, channelIds);

  // One reserve = one call credit. The reserve's atomic available→assigned
  // flip upstream guarantees this dispatcher runs at most once per license,
  // so the absence of dedupe in purchaseCalls() is fine here.
  const { purchaseCalls } = await import("./call");
  const purchase = await purchaseCalls({
    callOfferingId: license.itemId.toString(),
    userId: recipientId.toString(),
    organizationId: String(sellerOrgId),
    quantity: 1,
    isPaid: true,
    totalAmount: license.unitPrice,
    currency: license.currency,
    paymentId: `reserve_${license._id}`,
    paymentStatus: "completed",
  } as any);
  return { type: "callPurchase", id: purchase._id };
}

async function assignProduct(
  license: IItemReserveLicense,
  recipientId: Types.ObjectId
): Promise<AssignArtifact> {
  const { Product } = await import("../models/product.model");
  const product = await Product.findById(license.itemId)
    .select("channelIds organizationId")
    .lean();
  const sellerOrgId =
    ((product as any)?.organizationId as Types.ObjectId) || license.organizationId;
  const channelIds = ((product as any)?.channelIds || []) as Types.ObjectId[];

  await ensureRecipientParity(recipientId, sellerOrgId, channelIds);

  // One reserve = one unit of the product. Create a paid ProductOrder for the
  // recipient via the shared service (handles totals, inventory, requiresShipping).
  // A physical product's order is created without a shipping address — the
  // recipient/seller capture it through the normal order flow afterwards.
  const { createOrder, updatePaymentStatus } = await import("./product");
  const paymentId = `reserve_${license._id}`;
  const order = await createOrder({
    organizationId: String(sellerOrgId),
    userId: recipientId.toString(),
    items: [{ productId: license.itemId.toString(), quantity: 1 }],
    paymentMethod: "reserve",
    paymentId,
  });
  await updatePaymentStatus(order._id.toString(), String(sellerOrgId), "paid", paymentId);
  return { type: "productOrder", id: order._id };
}
