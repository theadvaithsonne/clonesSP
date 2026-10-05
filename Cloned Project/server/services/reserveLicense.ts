import mongoose, { Types } from "mongoose";
import { ReserveLicense, IReserveLicense } from "../models/reserveLicense.model";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import {
  distributeUnilevelPlusCommission,
  getUserPurchase,
} from "./unilevelPlusCommission";

// ============ Types ============

export interface CreateReserveLicensesOptions {
  userId: string;
  invoiceId: string;
  invoiceNumber: string;
  planId: string;
  planProductPrice: number;
  planCurrency: string;
  count: number;
  startSeq: number;
  /** When true (zero-pay coupon), skip commission distribution but still create licenses */
  skipCommission?: boolean;
}

// ============ Core Functions ============

/**
 * Create N reserve licenses, each triggering its own commission distribution.
 * Called from fulfillInvoice when quantity > 1 (or >0 if buyer already has UP).
 */
export async function createReserveLicenses(
  options: CreateReserveLicensesOptions
): Promise<IReserveLicense[]> {
  const licenses: IReserveLicense[] = [];

  for (let i = 0; i < options.count; i++) {
    const seq = options.startSeq + i;
    const syntheticPaymentId = `reserve_${options.invoiceId}_${seq}`;

    // Distribute commissions (unless skipped for zero-pay coupon or zero-price sale)
    let distributionId: string | undefined;
    if (!options.skipCommission && options.planProductPrice > 0) {
      try {
        const result = await distributeUnilevelPlusCommission({
          buyerId: options.userId,
          planId: options.planId,
          saleAmount: options.planProductPrice,
          currency: options.planCurrency,
          paymentId: syntheticPaymentId,
          metadata: {
            invoiceId: options.invoiceId,
            invoiceNumber: options.invoiceNumber,
            reserveSeq: seq,
            source: "reserve_license",
          },
        });
        distributionId = result?.distribution?._id?.toString();
        console.log(
          `[ReserveLicense] Commission distributed for license ${seq} (${syntheticPaymentId})`
        );
      } catch (err) {
        console.error(
          `[ReserveLicense] Commission distribution error for license ${seq}:`,
          err
        );
      }
    } else {
      console.log(
        `[ReserveLicense] Skipping commission for license ${seq} (zero-pay)`
      );
    }

    // Create the reserve license record
    const license = await ReserveLicense.create({
      userId: new Types.ObjectId(options.userId),
      invoiceId: new Types.ObjectId(options.invoiceId),
      invoiceNumber: options.invoiceNumber,
      planId: new Types.ObjectId(options.planId),
      distributionId: distributionId
        ? new Types.ObjectId(distributionId)
        : new Types.ObjectId(),
      purchasePaymentId: syntheticPaymentId,
      status: "available",
      amount: options.planProductPrice,
      currency: options.planCurrency,
    });

    licenses.push(license);
    console.log(
      `[ReserveLicense] Created reserve license ${license._id} (seq ${seq}) for user ${options.userId}`
    );
  }

  return licenses;
}

/**
 * Get paginated list of reserve licenses for a user.
 */
export async function getReserveLicenses(
  userId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ licenses: IReserveLicense[]; total: number }> {
  const query: any = { userId: new Types.ObjectId(userId) };
  if (options?.status) {
    query.status = options.status;
  }

  const [licenses, total] = await Promise.all([
    ReserveLicense.find(query)
      .populate("assignedTo", "name email profilePicture")
      .sort({ createdAt: -1 })
      .limit(options?.limit || 50)
      .skip(options?.offset || 0)
      .lean(),
    ReserveLicense.countDocuments(query),
  ]);

  return { licenses: licenses as IReserveLicense[], total };
}

/**
 * Get stats: available vs assigned counts.
 */
export async function getReserveStats(
  userId: string
): Promise<{ available: number; assigned: number; total: number }> {
  const [available, assigned] = await Promise.all([
    ReserveLicense.countDocuments({
      userId: new Types.ObjectId(userId),
      status: "available",
    }),
    ReserveLicense.countDocuments({
      userId: new Types.ObjectId(userId),
      status: "assigned",
    }),
  ]);

  return { available, assigned, total: available + assigned };
}

/**
 * Assign a reserve license to a target user.
 * Creates a UnilevelPlusPurchase for the target (unlocks their affiliate wallet).
 * NO commission distribution — that was already done at buy time.
 * Uses MongoDB transaction for atomicity.
 */
export async function assignReserveLicense(
  licenseId: string,
  ownerUserId: string,
  targetUserId: string
): Promise<{ license: IReserveLicense; purchase: any }> {
  // Pre-checks before opening transaction
  const license = await ReserveLicense.findById(licenseId);
  if (!license) {
    throw new Error("Reserve license not found");
  }
  if (license.userId.toString() !== ownerUserId) {
    throw new Error("This license doesn't belong to you");
  }
  if (license.status !== "available") {
    throw new Error(`License is already ${license.status}`);
  }

  // Check target doesn't already have UP
  const existingPurchase = await getUserPurchase(targetUserId);
  if (existingPurchase) {
    throw new Error("This user already has an active Unilevel Plus plan");
  }

  // Check target and owner aren't the same
  if (ownerUserId === targetUserId) {
    throw new Error("You cannot assign a license to yourself");
  }

  // Atomic transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create UnilevelPlusPurchase for the target user
    const purchase = await UnilevelPlusPurchase.create(
      [
        {
          userId: new Types.ObjectId(targetUserId),
          planId: license.planId,
          paymentId: `assigned_${licenseId}`,
          amount: license.amount,
          currency: license.currency,
          status: "active",
          purchasedAt: new Date(),
          metadata: {
            reserveLicenseId: licenseId,
            assignedBy: ownerUserId,
            source: "reserve_assignment",
          },
        },
      ],
      { session }
    );

    // Update the reserve license
    license.status = "assigned";
    license.assignedTo = new Types.ObjectId(targetUserId);
    license.assignedAt = new Date();
    license.purchaseId = purchase[0]._id;
    await license.save({ session });

    await session.commitTransaction();

    console.log(
      `[ReserveLicense] License ${licenseId} assigned to user ${targetUserId} by ${ownerUserId}`
    );

    return { license, purchase: purchase[0] };
  } catch (error: any) {
    await session.abortTransaction();

    // Handle duplicate key error (race condition: someone else assigned to this user)
    if (error.code === 11000) {
      throw new Error("This user already has an active Unilevel Plus plan");
    }
    throw error;
  } finally {
    session.endSession();
  }
}
