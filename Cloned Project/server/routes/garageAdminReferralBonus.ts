/**
 * Garage-admin control for the global signup referral bonus.
 *
 * Every referred signup that completes a profile pays this amount twice — once
 * to the referrer, once to the new user — straight out of the platform store
 * wallet. There is no per-payout approval step, so this endpoint is the only
 * gate. Super-admin only, and every change records who made it.
 */
import { Router, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { ReferralBonusConfig } from "../models/referralBonusConfig.model";
import { ReferralBonusPayout } from "../models/referralBonusPayout.model";
import { StoreWallet } from "../models/storeWallet.model";
import { User } from "../models/user.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";

const router = Router();
router.use(requireGarageAdminAuth, requireGarageSuperAdmin);

/** Current config + what it's costing + whether the platform can fund it. */
router.get("/", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const config: any =
      (await ReferralBonusConfig.findOne({ key: "global" }).lean()) || {
        key: "global",
        amountUsd: 0,
        isActive: false,
      };

    const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
      .select("_id")
      .lean();
    const platformWallet: any = platformUser
      ? // Pinned to USD: unpinned, this reads the BTC sibling and reports a
        // funding runway from a wallet the payout never touches.
        await StoreWallet.findOne({
          userId: platformUser._id,
          orgId: new Types.ObjectId(PLATFORM_ORG_ID),
          currency: "USD",
        }).lean()
      : null;

    const [payoutCount, totals] = await Promise.all([
      ReferralBonusPayout.countDocuments({}),
      ReferralBonusPayout.aggregate([
        { $group: { _id: null, total: { $sum: "$totalDebitedUsd" } } },
      ]),
    ]);

    const balance = platformWallet?.balance ?? 0;
    const perSignup = (config.amountUsd || 0) * 2;

    res.json({
      success: true,
      config: {
        amountUsd: config.amountUsd,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        updatedByEmail: config.updatedByEmail,
      },
      funding: {
        platformStoreWalletBalance: balance,
        costPerReferredSignup: perSignup,
        // How many more payouts the wallet can cover at the current amount.
        // The number that actually matters when deciding to raise the bonus.
        remainingPayouts:
          perSignup > 0 ? Math.floor(balance / perSignup) : null,
      },
      stats: {
        totalPayouts: payoutCount,
        totalPaidUsd: Math.round((totals[0]?.total || 0) * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error("[referral-bonus] GET failed:", error);
    res.status(500).json({ success: false, error: "Failed to load config" });
  }
});

/** Set the amount and/or turn it on or off. */
router.put("/", async (req: GarageAdminRequest, res: Response) => {
  try {
    const schema = z.object({
      // Paid to EACH side, so the true cost per signup is double this.
      amountUsd: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    if (body.amountUsd === undefined && body.isActive === undefined) {
      return res
        .status(400)
        .json({ success: false, error: "Nothing to update" });
    }

    // Turning it on with no amount would silently pay nothing and look broken.
    // The amount being activated is the one in this request if present, else
    // whatever is already stored — a bare { isActive: true } must be checked
    // against the stored value, not waved through.
    if (body.isActive === true) {
      const effectiveAmount =
        body.amountUsd !== undefined
          ? body.amountUsd
          : ((await ReferralBonusConfig.findOne({ key: "global" })
              .select("amountUsd")
              .lean()) as any)?.amountUsd ?? 0;
      if (effectiveAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Set an amount greater than 0 before activating",
        });
      }
    }

    const update: any = {
      updatedBy: req.garageAdmin?.id
        ? new Types.ObjectId(req.garageAdmin.id)
        : undefined,
      updatedByEmail: req.garageAdmin?.email,
    };
    if (body.amountUsd !== undefined) update.amountUsd = body.amountUsd;
    if (body.isActive !== undefined) update.isActive = body.isActive;

    const config: any = await ReferralBonusConfig.findOneAndUpdate(
      { key: "global" },
      { $set: update, $setOnInsert: { key: "global" } },
      { new: true, upsert: true }
    );

    console.log(
      `[referral-bonus] ${req.garageAdmin?.email} set amount=$${config.amountUsd} active=${config.isActive}`
    );

    res.json({
      success: true,
      config: {
        amountUsd: config.amountUsd,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        updatedByEmail: config.updatedByEmail,
      },
    });
  } catch (error: any) {
    if (error?.issues) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid body", details: error.issues });
    }
    console.error("[referral-bonus] PUT failed:", error);
    res.status(500).json({ success: false, error: "Failed to update config" });
  }
});

/** Recent payouts — the audit trail for "who got paid what". */
router.get("/payouts", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const payouts = await ReferralBonusPayout.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("refereeUserId", "email name")
      .populate("referrerUserId", "email name")
      .lean();
    res.json({ success: true, payouts });
  } catch (error: any) {
    console.error("[referral-bonus] payouts failed:", error);
    res.status(500).json({ success: false, error: "Failed to load payouts" });
  }
});

export default router;
