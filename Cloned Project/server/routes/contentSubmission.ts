// src/routes/contentSubmission.ts
// Content Rewards submission management.
//
// POST   /content-submissions                          → Submit a post URL
// GET    /content-submissions                          → List user's submissions
// GET    /content-submissions/earnings                 → User's earnings summary
// GET    /content-submissions/campaign/:campaignId     → Founder: list campaign submissions
// GET    /content-submissions/:id/live-views           → Founder: live view count for review screen
// PATCH  /content-submissions/:id/review               → Founder: approve/reject
//
// Payouts are no longer triggered manually. They run via the hourly
// contentPayoutSweeper, which debits the CampaignWallet and credits the
// affiliate's NC Wallet atomically inside one Mongo transaction.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requireFounder } from "../middleware/auth";
import { ContentSubmission } from "../models/contentSubmission.model";
import { ContentCampaign } from "../models/contentCampaign.model";
import { SocialAccount } from "../models/socialAccount.model";
import { detectPlatform, extractPlatformPostId, fetchViewsAuto, extractUsernameFromPostUrl, fetchYouTubeVideoChannelId, resolveYouTubeChannelId } from "../services/viewTracking";
import { sweepContentPayouts } from "../services/contentPayoutSweeper";

const router = Router();

// ── Helper: recalculate campaign totalViews from all approved submissions ──
// Exported so the payout sweeper can re-use it after a bulk view refresh.
export async function recalcCampaignTotalViews(campaignId: Types.ObjectId) {
  const [result] = await ContentSubmission.aggregate([
    { $match: { campaignId, status: "approved", viewSource: "oauth_api" } },
    {
      $group: {
        _id: null,
        total: { $sum: { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] } },
      },
    },
  ]);
  await ContentCampaign.updateOne(
    { _id: campaignId },
    { $set: { totalViews: result?.total || 0 } }
  );
}

// ═══════════════════════════════════════════════════════════════════
// POST /content-submissions
// Auth required — submit a social media post for a campaign.
// ═══════════════════════════════════════════════════════════════════

const SubmitSchema = z.object({
  campaignId: z.string().min(1),
  postUrl: z.string().url().min(10),
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = SubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid submission data",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const me = (req as any).user as { userId: string; orgId: string };
  const { campaignId, postUrl } = parsed.data;

  if (!Types.ObjectId.isValid(campaignId)) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  try {
    // 1. Validate campaign exists and is active
    const campaign = await ContentCampaign.findById(campaignId).lean();
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    if (campaign.status !== "active") {
      return res.status(400).json({ error: "Campaign is not active" });
    }
    if (campaign.budgetSpent >= campaign.budget) {
      return res.status(400).json({ error: "Campaign budget has been exhausted" });
    }

    // 2. Prevent founder from submitting to their own campaign
    if (campaign.founderId.toString() === me.userId) {
      return res.status(403).json({
        error: "You cannot submit content to your own campaign. Only affiliates can submit.",
      });
    }

    // 2. Detect platform from post URL
    const platform = detectPlatform(postUrl);
    if (!platform) {
      return res.status(400).json({
        error: "Could not detect platform from URL. Supported: YouTube, Instagram",
      });
    }

    // 3. Check platform is allowed by campaign
    if (!campaign.platforms.includes(platform as any)) {
      return res.status(400).json({
        error: `Platform "${platform}" is not allowed for this campaign. Allowed: ${campaign.platforms.join(", ")}`,
      });
    }

    // 4. Require a verified (or OAuth-connected) social account for this platform
    const socialAccount = await SocialAccount.findOne({
      userId: new Types.ObjectId(me.userId),
      platform,
      $or: [{ isVerified: true }, { oauthConnected: true }],
    });

    if (!socialAccount) {
      return res.status(400).json({
        error: `You must have a verified ${platform.charAt(0).toUpperCase() + platform.slice(1)} account before submitting content. Go to the Social Accounts tab to connect and verify your account.`,
      });
    }

    // 4b. Cross-check: verify the post URL belongs to the user's verified account
    const postUsername = extractUsernameFromPostUrl(postUrl, platform);
    if (postUsername && socialAccount.username) {
      const accountUsername = socialAccount.username.toLowerCase().replace(/^@/, "");
      if (postUsername !== accountUsername) {
        return res.status(400).json({
          error: `This post doesn't match your verified ${platform.charAt(0).toUpperCase() + platform.slice(1)} account (@${socialAccount.username}). You can only submit content from your own verified account.`,
        });
      }
    }

    // 4c. YouTube channel ownership verification via API
    if (platform === "youtube") {
      const videoId = extractPlatformPostId(postUrl, "youtube");
      if (videoId) {
        const videoChannelResult = await fetchYouTubeVideoChannelId(videoId);
        if (videoChannelResult.success) {
          // Resolve user's channel ID
          let userChannelId = socialAccount.platformUserId || "";
          if (!userChannelId) {
            const resolveResult = await resolveYouTubeChannelId(
              socialAccount.profileUrl || socialAccount.username
            );
            if (resolveResult.success) {
              userChannelId = resolveResult.channelId;
              // Cache for future lookups
              socialAccount.platformUserId = userChannelId;
              await (socialAccount as any).save();
            }
          }
          if (userChannelId && videoChannelResult.channelId !== userChannelId) {
            return res.status(400).json({
              error: `This video belongs to a different YouTube channel. You can only submit videos from your verified channel (@${socialAccount.username}).`,
            });
          }
        }
        // If API call failed, we still allow (graceful degradation) — the founder can review
      }
    }

    // 5. Extract platform post ID for API lookups
    const platformPostId = extractPlatformPostId(postUrl, platform);

    // 6. Create submission
    const submission = await ContentSubmission.create({
      campaignId: new Types.ObjectId(campaignId),
      userId: new Types.ObjectId(me.userId),
      socialAccountId: socialAccount._id,
      orgId: campaign.orgId,
      postUrl,
      platform,
      platformPostId,
      status: campaign.autoApprove ? "approved" : "pending",
      viewsAtApproval: 0,
      currentViews: 0,
    });

    // 6. Update campaign counters
    await ContentCampaign.updateOne(
      { _id: new Types.ObjectId(campaignId) },
      {
        $inc: {
          totalSubmissions: 1,
          ...(campaign.autoApprove ? { approvedSubmissions: 1 } : {}),
        },
      }
    );

    // 7. If auto-approved, try to fetch initial view count via API
    if (campaign.autoApprove) {
      // Look up affiliate's OAuth token for API-based fetch
      const oauthAccount = await SocialAccount.findOne({
        userId: new Types.ObjectId(me.userId),
        platform,
        oauthConnected: true,
      });
      const viewResult = await fetchViewsAuto(
        postUrl,
        platform,
        oauthAccount?.accessToken,
        oauthAccount?.platformUserId
      );
      if (viewResult.success && viewResult.views > 0) {
        submission.viewsAtApproval = viewResult.views;
        submission.currentViews = viewResult.views;
        submission.viewSource = viewResult.source as any;
        submission.lastTrackedAt = new Date();
        submission.lastFetchedAt = new Date();
        submission.viewSnapshots.push({
          views: viewResult.views,
          timestamp: new Date(),
          source: viewResult.source,
        } as any);
        await submission.save();
      } else {
        // API fetch failed at approval — set baseline to 0 so all future views count
        submission.viewsAtApproval = 0;
        submission.currentViews = 0;
        await submission.save();
      }
    }

    return res.status(201).json({
      success: true,
      submission: {
        id: submission._id,
        campaignId,
        postUrl,
        platform,
        status: submission.status,
        message: campaign.autoApprove
          ? "Submission auto-approved! Views are being tracked."
          : "Submission received. Awaiting founder review.",
      },
    });
  } catch (err: any) {
    // Duplicate submission
    if (err.code === 11000) {
      return res.status(400).json({
        error: "This post URL has already been submitted for this campaign.",
      });
    }
    console.error("Error creating submission:", err);
    return res.status(500).json({ error: "Failed to submit content" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-submissions
// Auth required — list user's own submissions.
// ═══════════════════════════════════════════════════════════════════

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const me = (req as any).user as { userId: string };
  const { status, campaignId } = req.query;

  try {
    const filter: any = { userId: new Types.ObjectId(me.userId) };
    if (status) filter.status = status;
    if (campaignId && Types.ObjectId.isValid(campaignId as string)) {
      filter.campaignId = new Types.ObjectId(campaignId as string);
    }

    const submissions = await ContentSubmission.find(filter)
      .sort({ createdAt: -1 })
      .populate("campaignId", "title ratePerThousand platforms currency")
      .lean();

    // Calculate net views for each
    const enriched = submissions.map((s) => ({
      ...s,
      netViews: Math.max(0, s.currentViews - s.viewsAtApproval),
      earnedDisplay: (s.earnedAmount / 100).toFixed(2),
    }));

    return res.json({ success: true, submissions: enriched });
  } catch (err) {
    console.error("Error fetching submissions:", err);
    return res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-submissions/earnings
// Auth required — user's total earnings summary.
// ═══════════════════════════════════════════════════════════════════

router.get("/earnings", requireAuth, async (req: Request, res: Response) => {
  const me = (req as any).user as { userId: string };
  const { campaignId } = req.query;

  try {
    // Base match filter — optionally scoped to a single campaign
    const baseMatch: any = { userId: new Types.ObjectId(me.userId), status: "approved", viewSource: "oauth_api" };
    if (campaignId && Types.ObjectId.isValid(campaignId as string)) {
      baseMatch.campaignId = new Types.ObjectId(campaignId as string);
    }

    const [summary] = await ContentSubmission.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          totalViews: {
            $sum: { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] },
          },
          totalEarned: { $sum: "$earnedAmount" },
          totalPaidOut: { $sum: "$paidOutAmount" },
        },
      },
    ]);

    // Per-campaign breakdown
    const byCampaign = await ContentSubmission.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$campaignId",
          submissions: { $sum: 1 },
          totalViews: {
            $sum: { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] },
          },
          totalEarned: { $sum: "$earnedAmount" },
        },
      },
      {
        $lookup: {
          from: "contentcampaigns",
          localField: "_id",
          foreignField: "_id",
          as: "campaign",
          pipeline: [{ $project: { title: 1, ratePerThousand: 1 } }],
        },
      },
      { $unwind: { path: "$campaign", preserveNullAndEmptyArrays: true } },
      { $sort: { totalEarned: -1 } },
    ]);

    // Per-platform breakdown
    const byPlatform = await ContentSubmission.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$platform",
          submissions: { $sum: 1 },
          totalViews: {
            $sum: { $max: [{ $subtract: ["$currentViews", "$viewsAtApproval"] }, 0] },
          },
          totalEarned: { $sum: "$earnedAmount" },
        },
      },
      { $sort: { totalViews: -1 } },
    ]);

    return res.json({
      success: true,
      summary: summary || {
        totalSubmissions: 0,
        totalViews: 0,
        totalEarned: 0,
        totalPaidOut: 0,
      },
      byCampaign,
      byPlatform,
    });
  } catch (err) {
    console.error("Error fetching earnings:", err);
    return res.status(500).json({ error: "Failed to fetch earnings" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-submissions/campaign/:campaignId
// Founder only — list all submissions for a campaign.
// ═══════════════════════════════════════════════════════════════════

router.get(
  "/campaign/:campaignId",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    if (!Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    const { status } = req.query;

    try {
      const filter: any = { campaignId: new Types.ObjectId(campaignId) };
      if (status) filter.status = status;

      const submissions = await ContentSubmission.find(filter)
        .sort({ createdAt: -1 })
        .populate("userId", "name email profilePicture affiliateId")
        .populate("socialAccountId", "platform username profileUrl")
        .lean();

      const enriched = submissions.map((s) => ({
        ...s,
        netViews: Math.max(0, s.currentViews - s.viewsAtApproval),
        earnedDisplay: (s.earnedAmount / 100).toFixed(2),
      }));

      return res.json({ success: true, submissions: enriched });
    } catch (err) {
      console.error("Error fetching campaign submissions:", err);
      return res.status(500).json({ error: "Failed to fetch submissions" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// GET /content-submissions/:id/live-views
// Founder only — fetch current view count from the platform API for a
// pending submission, so the review UI can show the founder exactly how
// many lifetime views exist and what the "Total" payout basis would cost
// if they approve on it.
//
// Not rate-limited like /refresh-views — this is a one-shot human-driven
// fetch from the review screen, scoped to one submission. We still guard
// it with a per-call try/catch so YouTube being down doesn't break the
// approval flow.
// ═══════════════════════════════════════════════════════════════════

router.get(
  "/:id/live-views",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid submission ID" });
    }

    const me = (req as any).user as { userId: string };

    try {
      const submission = await ContentSubmission.findById(id).lean();
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Founder must own the campaign to fetch its submissions' live views.
      const campaign = await ContentCampaign.findById(submission.campaignId).lean();
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (campaign.founderId.toString() !== me.userId) {
        return res.status(403).json({ error: "Not your campaign" });
      }

      const socialAccount = await SocialAccount.findOne({
        userId: submission.userId,
        platform: submission.platform,
        oauthConnected: true,
      });

      const result = await fetchViewsAuto(
        submission.postUrl,
        submission.platform,
        socialAccount?.accessToken,
        socialAccount?.platformUserId
      );

      return res.json({
        success: result.success,
        views: result.success ? result.views : 0,
        source: result.source,
        error: result.success ? undefined : result.error,
      });
    } catch (err: any) {
      console.error("Error fetching live views:", err);
      return res.status(500).json({ error: "Failed to fetch live views" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// PATCH /content-submissions/:id/review
// Founder only — approve or reject a submission.
// ═══════════════════════════════════════════════════════════════════

const ReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
  // Founder chooses how the affiliate earns:
  //   "net"   (default) → only views accrued after approval count.
  //   "total"           → every view ever counts, including pre-approval.
  // Ignored when action is "reject".
  payoutBasis: z.enum(["total", "net"]).optional(),
});

router.patch(
  "/:id/review",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid submission ID" });
    }

    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid review data" });
    }

    const me = (req as any).user as { userId: string };
    const { action, reason, payoutBasis } = parsed.data;

    try {
      const submission = await ContentSubmission.findById(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      if (submission.status !== "pending") {
        return res.status(400).json({
          error: `Submission is already ${submission.status}`,
        });
      }

      if (action === "approve") {
        const basis: "total" | "net" = payoutBasis ?? "net";
        submission.status = "approved";
        submission.reviewedBy = new Types.ObjectId(me.userId);
        submission.reviewedAt = new Date();
        submission.payoutBasis = basis;

        // Try to capture initial view count as baseline via API
        const oauthAccount = await SocialAccount.findOne({
          userId: submission.userId,
          platform: submission.platform,
          oauthConnected: true,
        });
        const viewResult = await fetchViewsAuto(
          submission.postUrl,
          submission.platform,
          oauthAccount?.accessToken,
          oauthAccount?.platformUserId
        );
        if (viewResult.success && viewResult.views > 0) {
          // Baseline depends on basis:
          //   "net"   → only views past the current count earn (skip lifetime views).
          //   "total" → every view earns, including the pre-approval backlog.
          submission.viewsAtApproval = basis === "total" ? 0 : viewResult.views;
          submission.currentViews = viewResult.views;
          submission.viewSource = viewResult.source as any;
          submission.lastTrackedAt = new Date();
          submission.lastFetchedAt = new Date();
          submission.viewSnapshots.push({
            views: viewResult.views,
            timestamp: new Date(),
            source: viewResult.source,
          } as any);
        } else {
          // API fetch failed — baseline 0 works for both bases (no API data to subtract).
          submission.viewsAtApproval = 0;
          submission.currentViews = 0;
        }

        await submission.save();

        // Update campaign counters
        await ContentCampaign.updateOne(
          { _id: submission.campaignId },
          { $inc: { approvedSubmissions: 1 } }
        );

        // Trigger an immediate payout sweep so the founder & affiliate
        // see the payout reflected within seconds instead of waiting for
        // the next hourly tick. Fire-and-forget — failures are logged by
        // the sweeper itself and the next scheduled tick will retry.
        sweepContentPayouts().catch((err) =>
          console.error("[ContentPayouts] post-approval sweep failed:", err)
        );
      } else {
        submission.status = "rejected";
        submission.reviewedBy = new Types.ObjectId(me.userId);
        submission.reviewedAt = new Date();
        submission.rejectionReason = reason || "";
        await submission.save();
      }

      return res.json({
        success: true,
        message: `Submission ${action}d`,
        submission: {
          id: submission._id,
          status: submission.status,
          reviewedAt: submission.reviewedAt,
        },
      });
    } catch (err) {
      console.error("Error reviewing submission:", err);
      return res.status(500).json({ error: "Failed to review submission" });
    }
  }
);

// Manual view update route has been removed.
// Views are now tracked exclusively via platform APIs (YouTube Data API).

// Manual /payout route has been removed.
// Payouts run via the hourly contentPayoutSweeper, which atomically debits
// the CampaignWallet and credits the affiliate's ContentRewardsWallet.

// ═══════════════════════════════════════════════════════════════════
// POST /content-submissions/:id/refresh-views
// On-demand: refresh views for a single submission via platform API.
// Auth required — both founders and affiliates can trigger.
// ═══════════════════════════════════════════════════════════════════

router.post("/:id/refresh-views", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid submission ID" });
  }

  try {
    const submission = await ContentSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Only refresh approved submissions
    if (submission.status !== "approved") {
      return res.status(400).json({ error: "Can only refresh views for approved submissions" });
    }

    // Rate limit: don't re-fetch if last fetch was < 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (submission.lastFetchedAt && submission.lastFetchedAt > oneHourAgo) {
      return res.json({
        success: true,
        cached: true,
        views: submission.currentViews,
        viewSource: submission.viewSource,
        message: "Views were fetched recently. Try again later.",
      });
    }

    // Get the affiliate's OAuth token for this platform
    const socialAccount = await SocialAccount.findOne({
      userId: submission.userId,
      platform: submission.platform,
      oauthConnected: true,
    });

    const result = await fetchViewsAuto(
      submission.postUrl,
      submission.platform,
      socialAccount?.accessToken,
      socialAccount?.platformUserId
    );

    if (result.success && result.views > 0) {
      // Take the higher value between current DB views and API views
      const newViews = Math.max(submission.currentViews, result.views);
      // Safety: viewsAtApproval should never exceed currentViews
      const safeBaseline = Math.min(submission.viewsAtApproval, newViews);
      const netViews = Math.max(0, newViews - safeBaseline);

      // Calculate earnings based on campaign CPM
      const campaign = await ContentCampaign.findById(submission.campaignId).lean();
      const ratePerThousand = campaign?.ratePerThousand || 0;
      const earnedAmount = Math.floor((netViews / 1000) * ratePerThousand);

      submission.currentViews = newViews;
      submission.earnedAmount = earnedAmount;
      submission.viewSource = result.source as any;
      submission.lastFetchedAt = new Date();
      submission.lastTrackedAt = new Date();
      submission.viewSnapshots.push({
        views: newViews,
        timestamp: new Date(),
        source: result.source,
      } as any);

      await submission.save();

      // Recalculate campaign totalViews from all approved API-tracked submissions
      await recalcCampaignTotalViews(submission.campaignId);

      return res.json({
        success: true,
        views: newViews,
        netViews,
        earnedAmount,
        viewSource: result.source,
      });
    }

    // Update lastFetchedAt even if fetch failed (to prevent hammering)
    submission.lastFetchedAt = new Date();
    await submission.save();

    return res.json({
      success: false,
      views: submission.currentViews,
      viewSource: submission.viewSource,
      error: result.error || "Could not fetch views from platform API.",
    });
  } catch (err) {
    console.error("Error refreshing views:", err);
    return res.status(500).json({ error: "Failed to refresh views" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /content-submissions/campaign/:campaignId/refresh-views
// Bulk refresh: refresh views for all approved submissions in a campaign.
// Founder only.
// ═══════════════════════════════════════════════════════════════════

router.post(
  "/campaign/:campaignId/refresh-views",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    if (!Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    try {
      const submissions = await ContentSubmission.find({
        campaignId: new Types.ObjectId(campaignId),
        status: "approved",
        isPaidOut: false,
      });

      if (submissions.length === 0) {
        return res.json({ success: true, updated: 0, message: "No approved submissions to refresh" });
      }

      const campaign = await ContentCampaign.findById(campaignId).lean();
      const ratePerThousand = campaign?.ratePerThousand || 0;

      let updated = 0;
      const results: any[] = [];

      for (const sub of submissions) {
        // Skip if fetched recently
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (sub.lastFetchedAt && sub.lastFetchedAt > oneHourAgo) {
          results.push({ id: sub._id, cached: true, views: sub.currentViews });
          continue;
        }

        const socialAccount = await SocialAccount.findOne({
          userId: sub.userId,
          platform: sub.platform,
          oauthConnected: true,
        });

        const result = await fetchViewsAuto(
          sub.postUrl,
          sub.platform,
          socialAccount?.accessToken,
          socialAccount?.platformUserId
        );

        if (result.success && result.views > 0) {
          const newViews = Math.max(sub.currentViews, result.views);
          // Safety: viewsAtApproval should never exceed currentViews
          const safeBaseline = Math.min(sub.viewsAtApproval, newViews);
          const netViews = Math.max(0, newViews - safeBaseline);
          const earnedAmount = Math.floor((netViews / 1000) * ratePerThousand);

          sub.currentViews = newViews;
          sub.earnedAmount = earnedAmount;
          sub.viewSource = result.source as any;
          sub.lastFetchedAt = new Date();
          sub.lastTrackedAt = new Date();
          await sub.save();
          updated++;
          results.push({ id: sub._id, views: newViews, source: result.source });
        } else {
          sub.lastFetchedAt = new Date();
          await sub.save();
          results.push({ id: sub._id, views: sub.currentViews, error: result.error });
        }
      }

      // Recalculate campaign totalViews from all approved API-tracked submissions
      await recalcCampaignTotalViews(new Types.ObjectId(campaignId));

      return res.json({ success: true, updated, total: submissions.length, results });
    } catch (err) {
      console.error("Error bulk refreshing views:", err);
      return res.status(500).json({ error: "Failed to refresh views" });
    }
  }
);

export default router;
