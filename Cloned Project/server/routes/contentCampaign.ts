// src/routes/contentCampaign.ts
// Content Rewards campaign management — Founder CRUD + analytics.
//
// POST   /content-campaigns              → Create campaign
// GET    /content-campaigns              → List org campaigns
// GET    /content-campaigns/:id          → Get campaign details
// PATCH  /content-campaigns/:id          → Update campaign
// DELETE /content-campaigns/:id          → Archive campaign
// GET    /content-campaigns/:id/stats    → Campaign analytics
// GET    /content-campaigns/active       → List active campaigns (any auth user)

import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose, { Types } from "mongoose";
import { requireAuth, requireFounder } from "../middleware/auth";
import {
  ContentCampaign,
  CAMPAIGN_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_CURRENCIES,
  SOCIAL_PLATFORMS,
} from "../models/contentCampaign.model";
import { ContentSubmission } from "../models/contentSubmission.model";
import { User } from "../models/user.model";
import {
  getStoreWalletBalance,
  getOrCreateStoreWallet,
} from "../services/wallet";
import {
  lockBudgetForCampaign,
  refundCampaignToFounder,
  getCampaignWalletByCampaignId,
  getCampaignWalletTransactions,
  transferCampaignToUserWallet,
} from "../services/campaignWallet";

const router = Router();

// Statuses that mean a campaign no longer needs its escrow held.
const CLOSED_STATUSES = new Set(["completed"]);

// ═══════════════════════════════════════════════════════════════════
// GET /content-campaigns/active
// Any authenticated user — list active campaigns they can participate in.
// Must come BEFORE /:id to avoid Express matching "active" as an ID.
// ═══════════════════════════════════════════════════════════════════

router.get("/active", requireAuth, async (req: Request, res: Response) => {
  const me = (req as any).user as { userId: string; orgId: string };
  const orgId = (req.query.orgId as string) || me.orgId;

  try {
    const campaigns = await ContentCampaign.find({
      orgId: new Types.ObjectId(orgId),
      status: "active",
    })
      .sort({ createdAt: -1 })
      .populate("founderId", "name email profilePicture")
      .lean();

    // For each campaign, check if user has already submitted
    const campaignIds = campaigns.map((c) => c._id);
    const userSubmissions = await ContentSubmission.find({
      campaignId: { $in: campaignIds },
      userId: new Types.ObjectId(me.userId),
    })
      .select("campaignId status")
      .lean();

    const submissionMap = new Map<string, any[]>();
    for (const sub of userSubmissions) {
      const key = sub.campaignId.toString();
      if (!submissionMap.has(key)) submissionMap.set(key, []);
      submissionMap.get(key)!.push(sub);
    }

    const enriched = campaigns.map((c) => ({
      ...c,
      budgetRemaining: c.budget - c.budgetSpent,
      userSubmissions: submissionMap.get(c._id.toString()) || [],
    }));

    return res.json({ success: true, campaigns: enriched });
  } catch (err) {
    console.error("Error fetching active campaigns:", err);
    return res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /content-campaigns/:id/join
// Any auth user — join a campaign as a participant.
// ═══════════════════════════════════════════════════════════════════

router.post("/:id/join", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const me = (req as any).user as { userId: string };

  try {
    const campaign = await ContentCampaign.findById(id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.status !== "active") return res.status(400).json({ error: "Campaign is not active" });

    const userId = new Types.ObjectId(me.userId);

    // Prevent founder from joining their own campaign
    if (campaign.founderId.toString() === me.userId) {
      return res.status(403).json({
        error: "You cannot join your own campaign. Only affiliates can participate.",
      });
    }

    // Check if already joined
    if (campaign.participants.some((p) => p.toString() === me.userId)) {
      return res.json({ success: true, message: "Already joined", joined: true });
    }

    // Add participant
    await ContentCampaign.updateOne(
      { _id: new Types.ObjectId(id) },
      { $addToSet: { participants: userId }, $inc: { totalParticipants: 1 } }
    );

    return res.json({ success: true, message: "Joined campaign", joined: true });
  } catch (err) {
    console.error("Error joining campaign:", err);
    return res.status(500).json({ error: "Failed to join campaign" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /content-campaigns/:id/leave
// Any auth user — leave a campaign.
// ═══════════════════════════════════════════════════════════════════

router.post("/:id/leave", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const me = (req as any).user as { userId: string };

  try {
    await ContentCampaign.updateOne(
      { _id: new Types.ObjectId(id) },
      { $pull: { participants: new Types.ObjectId(me.userId) }, $inc: { totalParticipants: -1 } }
    );

    return res.json({ success: true, message: "Left campaign" });
  } catch (err) {
    console.error("Error leaving campaign:", err);
    return res.status(500).json({ error: "Failed to leave campaign" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /content-campaigns
// Founder only — create a new campaign.
// ═══════════════════════════════════════════════════════════════════

const CreateCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  thumbnailUrl: z.string().url().max(2000).optional().or(z.literal("")),
  campaignType: z.enum(CAMPAIGN_TYPES).default("ugc"),
  budget: z.number().min(100), // Min $1 (100 cents)
  ratePerThousand: z.number().min(1), // Min $0.01/1K views
  minPayout: z.number().min(0).default(0),
  maxPayout: z.number().min(0).default(0),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1).default(["youtube"]),
  requirements: z
    .object({
      minDuration: z.number().min(0).default(0),
      maxDuration: z.number().min(0).default(0),
      hashtags: z.array(z.string()).default([]),
      mentions: z.array(z.string()).default([]),
      guidelines: z.string().max(5000).default(""),
    })
    .default({
      minDuration: 0,
      maxDuration: 0,
      hashtags: [],
      mentions: [],
      guidelines: "",
    }),
  assets: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(["video", "image", "document"]).default("video"),
        description: z.string().max(500).default(""),
      })
    )
    .default([]),
  resourceLinks: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().min(1).max(200),
        type: z.enum(["drive", "dropbox", "notion", "video", "other"]).default("other"),
      })
    )
    .default([]),
  autoApprove: z.boolean().default(false),
  currency: z.enum(CAMPAIGN_CURRENCIES).default("USD"),
  status: z.enum(CAMPAIGN_STATUSES).default("draft"),
});

router.post("/", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid campaign data",
      details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const me = (req as any).user as { userId: string; orgId: string };
  const data = parsed.data;

  // Pre-check: founder's StoreWallet must hold at least the requested budget.
  // Budget is in cents; StoreWallet balance is float USD. Convert before compare.
  await getOrCreateStoreWallet(me.userId, me.orgId);
  const balanceInfo = await getStoreWalletBalance(me.userId, me.orgId);
  const availableUsd = balanceInfo?.balance ?? 0;
  const requiredUsd = data.budget / 100;

  if (availableUsd < requiredUsd) {
    return res.status(402).json({
      error: "Insufficient store wallet balance",
      message: `You need $${requiredUsd.toFixed(2)} in your Store Wallet to fund this campaign. Available: $${availableUsd.toFixed(2)}.`,
      requiredUsd,
      availableUsd,
    });
  }

  // Atomic: create campaign + lock budget in escrow.
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const created = await ContentCampaign.create(
      [
        {
          ...data,
          orgId: new Types.ObjectId(me.orgId),
          founderId: new Types.ObjectId(me.userId),
        },
      ],
      { session }
    );
    const campaign = created[0];

    const { campaignWallet } = await lockBudgetForCampaign({
      campaignId: campaign._id.toString(),
      founderId: me.userId,
      orgId: me.orgId,
      amountCents: data.budget,
      description: `Campaign budget lock: ${campaign.title}`,
      session,
    });

    campaign.campaignWalletId = campaignWallet._id;
    campaign.lockedAmount = data.budget;
    await campaign.save({ session });

    await session.commitTransaction();
    return res.status(201).json({ success: true, campaign });
  } catch (err: any) {
    await session.abortTransaction();
    console.error("Error creating campaign:", err);
    if (err?.message?.includes("Insufficient")) {
      return res.status(402).json({ error: err.message });
    }
    return res.status(500).json({ error: "Failed to create campaign" });
  } finally {
    session.endSession();
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-campaigns
// Founder only — list all campaigns for the org.
// ═══════════════════════════════════════════════════════════════════

router.get("/", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const me = (req as any).user as { userId: string; orgId: string };
  const { status } = req.query;

  try {
    const filter: any = { orgId: new Types.ObjectId(me.orgId) };
    if (status && CAMPAIGN_STATUSES.includes(status as any)) {
      filter.status = status;
    }

    const campaigns = await ContentCampaign.find(filter)
      .sort({ createdAt: -1 })
      .populate("founderId", "name email profilePicture")
      .lean();

    // Enrich with budget remaining
    const enriched = campaigns.map((c) => ({
      ...c,
      budgetRemaining: c.budget - c.budgetSpent,
    }));

    return res.json({ success: true, campaigns: enriched });
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    return res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-campaigns/:id
// Any auth user — get campaign details.
// ═══════════════════════════════════════════════════════════════════

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  try {
    const campaign = await ContentCampaign.findById(id)
      .populate("founderId", "name email profilePicture")
      .lean();

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    return res.json({
      success: true,
      campaign: {
        ...campaign,
        budgetRemaining: campaign.budget - campaign.budgetSpent,
      },
    });
  } catch (err) {
    console.error("Error fetching campaign:", err);
    return res.status(500).json({ error: "Failed to fetch campaign" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /content-campaigns/:id
// Founder only — update campaign fields.
// ═══════════════════════════════════════════════════════════════════

const UpdateCampaignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url().max(2000).optional().or(z.literal("")),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  budget: z.number().min(100).optional(),
  ratePerThousand: z.number().min(1).optional(),
  minPayout: z.number().min(0).optional(),
  maxPayout: z.number().min(0).optional(),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).min(1).optional(),
  requirements: z
    .object({
      minDuration: z.number().min(0).optional(),
      maxDuration: z.number().min(0).optional(),
      hashtags: z.array(z.string()).optional(),
      mentions: z.array(z.string()).optional(),
      guidelines: z.string().max(5000).optional(),
    })
    .optional(),
  autoApprove: z.boolean().optional(),
  currency: z.enum(CAMPAIGN_CURRENCIES).optional(),
  resourceLinks: z
    .array(
      z.object({
        url: z.string().url(),
        label: z.string().min(1).max(200),
        type: z.enum(["drive", "dropbox", "notion", "video", "other"]).default("other"),
      })
    )
    .optional(),
});

router.patch("/:id", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const parsed = UpdateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid update data",
      details: parsed.error.issues,
    });
  }

  const me = (req as any).user as { userId: string; orgId: string };

  // Need the existing campaign to know if status is transitioning to "completed",
  // and to validate budget changes against budgetSpent.
  const existing = await ContentCampaign.findOne({
    _id: new Types.ObjectId(id),
    orgId: new Types.ObjectId(me.orgId),
  });
  if (!existing) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  // Reject lowering budget below what's already been spent.
  if (
    typeof parsed.data.budget === "number" &&
    parsed.data.budget < existing.budgetSpent
  ) {
    return res.status(400).json({
      error: `Cannot reduce budget below already-spent amount ($${(existing.budgetSpent / 100).toFixed(2)}).`,
    });
  }

  const transitioningToClosed =
    parsed.data.status &&
    CLOSED_STATUSES.has(parsed.data.status) &&
    !CLOSED_STATUSES.has(existing.status);

  // Block close if there are pending submissions that haven't been reviewed.
  if (transitioningToClosed) {
    const pendingCount = await ContentSubmission.countDocuments({
      campaignId: existing._id,
      status: "pending",
    });
    if (pendingCount > 0) {
      return res.status(400).json({
        error: `Cannot close campaign with ${pendingCount} pending submission(s). Approve or reject them first.`,
      });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const campaign = await ContentCampaign.findOneAndUpdate(
      { _id: new Types.ObjectId(id), orgId: new Types.ObjectId(me.orgId) },
      { $set: parsed.data },
      { new: true, session }
    );
    if (!campaign) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (transitioningToClosed) {
      await refundCampaignToFounder({
        campaignId: campaign._id.toString(),
        description: `Campaign closed: ${campaign.title}`,
        session,
      });
      // Mark all approved submissions as fully settled.
      await ContentSubmission.updateMany(
        { campaignId: campaign._id, status: "approved" },
        { $set: { isPaidOut: true } },
        { session }
      );
    }

    await session.commitTransaction();
    return res.json({ success: true, campaign });
  } catch (err) {
    await session.abortTransaction();
    console.error("Error updating campaign:", err);
    return res.status(500).json({ error: "Failed to update campaign" });
  } finally {
    session.endSession();
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /content-campaigns/:id
// Founder only — archive (soft-delete) a campaign.
// ═══════════════════════════════════════════════════════════════════

router.delete("/:id", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const me = (req as any).user as { userId: string; orgId: string };

  // Block close if pending submissions remain — same rule as PATCH transition.
  const pendingCount = await ContentSubmission.countDocuments({
    campaignId: new Types.ObjectId(id),
    status: "pending",
  });
  if (pendingCount > 0) {
    return res.status(400).json({
      error: `Cannot close campaign with ${pendingCount} pending submission(s). Approve or reject them first.`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const campaign = await ContentCampaign.findOneAndUpdate(
      { _id: new Types.ObjectId(id), orgId: new Types.ObjectId(me.orgId) },
      { $set: { status: "completed" } },
      { new: true, session }
    );
    if (!campaign) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Campaign not found" });
    }

    const refund = await refundCampaignToFounder({
      campaignId: campaign._id.toString(),
      description: `Campaign archived: ${campaign.title}`,
      session,
    });

    await ContentSubmission.updateMany(
      { campaignId: campaign._id, status: "approved" },
      { $set: { isPaidOut: true } },
      { session }
    );

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Campaign archived",
      refundedUsd: refund?.refundedUsd ?? 0,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Error archiving campaign:", err);
    return res.status(500).json({ error: "Failed to archive campaign" });
  } finally {
    session.endSession();
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-campaigns/:id/stats
// Founder only — campaign-level analytics.
// ═══════════════════════════════════════════════════════════════════

router.get("/:id/stats", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const me = (req as any).user as { userId: string; orgId: string };

  try {
    const campaignId = new Types.ObjectId(id);

    // Campaign details
    const campaign = await ContentCampaign.findOne({
      _id: campaignId,
      orgId: new Types.ObjectId(me.orgId),
    }).lean();

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Submission stats
    const [submissionStats] = await ContentSubmission.aggregate([
      { $match: { campaignId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          totalViews: {
            $sum: {
              $cond: [
                { $eq: ["$viewSource", "oauth_api"] },
                { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] },
                0,
              ],
            },
          },
          totalEarned: { $sum: "$earnedAmount" },
        },
      },
    ]);

    // Top performers
    const topPerformers = await ContentSubmission.aggregate([
      { $match: { campaignId, status: "approved", viewSource: "oauth_api" } },
      {
        $project: {
          userId: 1,
          platform: 1,
          postUrl: 1,
          netViews: { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] },
          earnedAmount: 1,
          createdAt: 1,
        },
      },
      { $sort: { netViews: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, email: 1, profilePicture: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]);

    // Platform breakdown
    const platformBreakdown = await ContentSubmission.aggregate([
      { $match: { campaignId, status: "approved", viewSource: "oauth_api" } },
      {
        $group: {
          _id: "$platform",
          count: { $sum: 1 },
          totalViews: { $sum: { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] } },
          totalEarned: { $sum: "$earnedAmount" },
        },
      },
      { $sort: { totalViews: -1 } },
    ]);

    return res.json({
      success: true,
      campaign,
      stats: submissionStats || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalViews: 0,
        totalEarned: 0,
      },
      topPerformers,
      platformBreakdown,
    });
  } catch (err) {
    console.error("Error fetching campaign stats:", err);
    return res.status(500).json({ error: "Failed to fetch campaign stats" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-campaigns/:id/wallet
// Founder only — escrow wallet status (locked / paid / refunded / remaining).
// ═══════════════════════════════════════════════════════════════════

router.get("/:id/wallet", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const me = (req as any).user as { userId: string; orgId: string };

  try {
    // Scope check: campaign must belong to caller's org.
    const campaign = await ContentCampaign.findOne({
      _id: new Types.ObjectId(id),
      orgId: new Types.ObjectId(me.orgId),
    })
      .select("title status")
      .lean();
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const wallet = await getCampaignWalletByCampaignId(id);
    if (!wallet) {
      return res.json({
        success: true,
        wallet: {
          balance: 0,
          totalLocked: 0,
          totalPaidOut: 0,
          totalRefunded: 0,
          status: "missing",
          currency: "USD",
        },
      });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 100);
    const offset = parseInt((req.query.offset as string) || "0", 10);
    const { transactions, total } = await getCampaignWalletTransactions(id, {
      limit,
      offset,
    });

    return res.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalLocked: wallet.totalLocked,
        totalPaidOut: wallet.totalPaidOut,
        totalRefunded: wallet.totalRefunded,
        status: wallet.status,
        currency: wallet.currency,
        lastTransactionAt: wallet.lastTransactionAt,
      },
      transactions,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("Error fetching campaign wallet:", err);
    return res.status(500).json({ error: "Failed to fetch campaign wallet" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /content-campaigns/:id/wallet/transfer
// Founder-of-this-campaign only — move escrow funds to a target user's
// native Store or Affiliate wallet. The campaign wallet is a shared pool,
// so ownership is enforced (requireFounder + founderId match) to prevent
// any user draining a campaign that isn't theirs.
// ═══════════════════════════════════════════════════════════════════

const CampaignTransferSchema = z.object({
  targetUserId: z.string().min(1),
  destination: z.enum(["store", "affiliate"]),
  amountCents: z.number().int().positive(),
  note: z.string().max(1000).optional(),
});

router.post("/:id/wallet/transfer", requireAuth, requireFounder, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const parsed = CampaignTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid transfer data", details: parsed.error.issues });
  }
  const { targetUserId, destination, amountCents, note } = parsed.data;
  if (!Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ error: "Invalid target user ID" });
  }

  const me = (req as any).user as { userId: string; orgId: string };

  try {
    // Ownership: campaign must be in caller's org AND caller must be its founder.
    const campaign = await ContentCampaign.findOne({
      _id: new Types.ObjectId(id),
      orgId: new Types.ObjectId(me.orgId),
    })
      .select("founderId title")
      .lean();
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    if (campaign.founderId.toString() !== me.userId) {
      return res.status(403).json({ error: "Only the campaign founder can transfer its funds" });
    }

    const target = await User.findById(targetUserId).select("name").lean();
    if (!target) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await transferCampaignToUserWallet({
        campaignId: id,
        targetUserId,
        destination,
        amountCents,
        description: `Transfer to ${(target as any).name || "user"}'s ${destination} wallet`,
        note,
        actorUserId: me.userId,
        session,
      });
      await session.commitTransaction();

      return res.json({
        success: true,
        transfer: {
          destination,
          targetUserId,
          amountCents,
          amountUsd: amountCents / 100,
          campaignWalletBalanceAfter: result.campaignWallet.balance,
          destinationBalanceAfter: result.destinationWallet.balance,
          campaignTransactionId: result.campaignTransaction._id,
          walletTransactionId: result.walletTransaction._id,
        },
      });
    } catch (err: any) {
      await session.abortTransaction();
      const msg = err?.message || "Failed to transfer from campaign wallet";
      const status =
        /Insufficient|closed|currency|greater than 0/.test(msg) ? 400 :
        /not found/.test(msg) ? 404 : 500;
      return res.status(status).json({ error: msg });
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error("Error transferring from campaign wallet:", err);
    return res.status(500).json({ error: "Failed to transfer from campaign wallet" });
  }
});

export default router;
