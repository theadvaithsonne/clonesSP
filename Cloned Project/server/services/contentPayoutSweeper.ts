// src/services/contentPayoutSweeper.ts
// Hourly sweeper that turns the Content Rewards earnings flywheel.
//
// For each approved-but-not-fully-settled submission in an active campaign:
//   1. Refresh views from the platform API (respecting the existing 1h
//      rate-limit guard).
//   2. Recompute earnedAmount from the refreshed views and the campaign CPM.
//   3. If (earnedAmount - paidOutAmount) >= campaign.minPayout, payout the
//      delta atomically: debit CampaignWallet, credit ContentRewardsWallet,
//      write ContentPayout + paired audit transactions.
//
// The sweeper is the ONLY thing that moves money for content rewards now —
// the manual /:id/payout founder endpoint has been removed.
//
// Concurrency guard: an in-process flag prevents two ticks running at once
// if a sweep takes longer than its interval.

import mongoose, { Types } from "mongoose";
import { ContentSubmission } from "../models/contentSubmission.model";
import { ContentCampaign } from "../models/contentCampaign.model";
import { SocialAccount } from "../models/socialAccount.model";
import { CampaignWallet } from "../models/campaignWallet.model";
import { fetchViewsAuto } from "./viewTracking";
import { payoutFromCampaignToAffiliate } from "./campaignWallet";
import { recalcCampaignTotalViews } from "../routes/contentSubmission";

// Rate limit: do not refresh a submission whose views were fetched within
// this window. Mirrors the guard in /refresh-views.
const REFRESH_GUARD_MS = 50 * 60 * 1000; // 50 min

// Cap submissions processed per tick to avoid burning the YouTube API quota
// in one go.
const MAX_PER_TICK = 200;

let sweeping = false;

export interface SweepResult {
  scanned: number;
  refreshed: number;
  paidOut: number;
  paidOutCents: number;
  errors: number;
  skippedRateLimited: number;
  skippedBelowThreshold: number;
  campaignsExhausted: number;
}

/** Recompute earnedAmount from a submission's current (currentViews, viewsAtApproval). */
function computeEarnedCents(submission: any, ratePerThousand: number): number {
  const netViews = Math.max(0, (submission.currentViews || 0) - (submission.viewsAtApproval || 0));
  return Math.floor((netViews / 1000) * ratePerThousand);
}

/**
 * Maybe refresh views from the platform API + always recompute earnings.
 *
 * The platform API call is rate-limited per-submission via REFRESH_GUARD_MS.
 * The earnings recompute always runs — necessary for the immediate
 * post-approval payout, when viewsAtApproval has just been set (e.g. to 0
 * for "total" basis) but earnedAmount is still the schema default of 0.
 *
 * Returns true if the submission was updated (views or earnings changed).
 */
async function refreshOneSubmission(
  submission: any,
  ratePerThousand: number
): Promise<boolean> {
  const now = new Date();
  const refreshCutoff = new Date(now.getTime() - REFRESH_GUARD_MS);
  const shouldFetchViews =
    !submission.lastFetchedAt || submission.lastFetchedAt < refreshCutoff;

  let updated = false;

  if (shouldFetchViews) {
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

    // Stamp lastFetchedAt either way so a failed fetch doesn't loop the API.
    submission.lastFetchedAt = now;

    if (result.success && result.views > 0) {
      const newViews = Math.max(submission.currentViews, result.views);
      if (newViews !== submission.currentViews) {
        submission.currentViews = newViews;
        submission.viewSource = result.source as any;
        submission.lastTrackedAt = now;
        submission.viewSnapshots.push({
          views: newViews,
          timestamp: now,
          source: result.source,
        } as any);
      }
      updated = true;
    }
  }

  // Always recompute earnedAmount — covers the post-approval case where
  // viewsAtApproval was just set but earnedAmount is still 0.
  const recomputed = computeEarnedCents(submission, ratePerThousand);
  if (recomputed !== (submission.earnedAmount || 0)) {
    submission.earnedAmount = recomputed;
    updated = true;
  }

  if (updated || shouldFetchViews) {
    await submission.save();
  }
  return updated;
}

/**
 * Run one sweep. Safe to call directly (e.g. from a debug endpoint) — the
 * concurrency guard prevents overlap with the scheduled interval.
 */
export async function sweepContentPayouts(): Promise<SweepResult> {
  const result: SweepResult = {
    scanned: 0,
    refreshed: 0,
    paidOut: 0,
    paidOutCents: 0,
    errors: 0,
    skippedRateLimited: 0,
    skippedBelowThreshold: 0,
    campaignsExhausted: 0,
  };

  if (sweeping) {
    console.log("[ContentPayouts] Skipping tick — previous sweep still running");
    return result;
  }
  sweeping = true;
  const startedAt = Date.now();

  try {
    // Find candidates: every approved, not-fully-settled submission. The
    // REFRESH_GUARD_MS rate-limit is enforced inside refreshOneSubmission —
    // not here — so that just-approved submissions (whose lastFetchedAt was
    // stamped seconds ago by the approval endpoint) still get earnings
    // computed and paid out on the very next tick. Sorting by lastFetchedAt
    // asc puts the freshly-approved ones at the head of the queue.
    const submissions = await ContentSubmission.find({
      status: "approved",
      isPaidOut: false,
    })
      .limit(MAX_PER_TICK)
      .sort({ lastFetchedAt: 1 });

    result.scanned = submissions.length;

    // Cache per-campaign data so we don't re-fetch the campaign + wallet
    // for each submission of the same campaign.
    const campaignCache = new Map<
      string,
      { campaign: any; wallet: any | null; exhausted: boolean }
    >();
    const campaignsToRecalc = new Set<string>();

    for (const submission of submissions) {
      try {
        const cidStr = submission.campaignId.toString();
        let cached = campaignCache.get(cidStr);
        if (!cached) {
          const [campaign, wallet] = await Promise.all([
            ContentCampaign.findById(submission.campaignId).lean(),
            CampaignWallet.findOne({
              campaignId: submission.campaignId,
            }),
          ]);
          cached = { campaign, wallet, exhausted: false };
          campaignCache.set(cidStr, cached);
        }

        if (!cached.campaign || cached.campaign.status !== "active") {
          continue;
        }
        if (!cached.wallet || cached.wallet.status !== "active") {
          continue;
        }
        if (cached.exhausted) {
          continue;
        }

        const refreshed = await refreshOneSubmission(
          submission,
          cached.campaign.ratePerThousand || 0
        );
        if (refreshed) {
          result.refreshed += 1;
          campaignsToRecalc.add(cidStr);
        }

        // Compute outstanding payout in cents.
        const pendingCents =
          (submission.earnedAmount || 0) - (submission.paidOutAmount || 0);
        if (pendingCents <= 0) {
          continue;
        }

        // Threshold guard: don't write a payout below minPayout. Earnings
        // accumulate; the next sweep will pay out once we cross.
        const minPayout = cached.campaign.minPayout || 0;
        if (pendingCents < minPayout) {
          result.skippedBelowThreshold += 1;
          continue;
        }

        // maxPayout per submission caps lifetime earnings. Cap accordingly.
        const maxPayout = cached.campaign.maxPayout || 0;
        let payoutCents = pendingCents;
        if (maxPayout > 0) {
          const headroom = maxPayout - (submission.paidOutAmount || 0);
          if (headroom <= 0) {
            // Already paid the cap — mark fully settled so we stop scanning.
            submission.isPaidOut = true;
            await submission.save();
            continue;
          }
          payoutCents = Math.min(payoutCents, headroom);
        }

        // Wallet balance cap (in cents — wallet stores float USD).
        const walletBalanceCents = Math.floor(cached.wallet.balance * 100);
        if (walletBalanceCents <= 0) {
          // Wallet drained — campaign is exhausted. Mark this submission
          // settled and stop trying to pay any submission of this campaign
          // for the remainder of the sweep.
          submission.isPaidOut = true;
          await submission.save();
          cached.exhausted = true;
          result.campaignsExhausted += 1;
          continue;
        }
        if (payoutCents > walletBalanceCents) {
          payoutCents = walletBalanceCents;
        }
        if (payoutCents <= 0) {
          continue;
        }

        // Atomic payout.
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const viewsRewarded = Math.max(
            0,
            submission.currentViews - submission.viewsAtApproval
          );
          await payoutFromCampaignToAffiliate({
            campaignId: cidStr,
            submissionId: submission._id.toString(),
            userId: submission.userId.toString(),
            orgId: submission.orgId.toString(),
            amountCents: payoutCents,
            viewsRewarded,
            description: `Content Rewards payout: ${cached.campaign.title}`,
            session,
          });
          await session.commitTransaction();

          // Reflect the wallet debit in our cache so subsequent submissions
          // in the same campaign see the right balance.
          cached.wallet.balance = Math.max(
            0,
            cached.wallet.balance - payoutCents / 100
          );
          cached.wallet.totalPaidOut += payoutCents / 100;

          result.paidOut += 1;
          result.paidOutCents += payoutCents;
        } catch (payErr) {
          await session.abortTransaction();
          result.errors += 1;
          console.error(
            `[ContentPayouts] Payout failed for submission ${submission._id}:`,
            payErr
          );
        } finally {
          session.endSession();
        }
      } catch (rowErr) {
        result.errors += 1;
        console.error(
          `[ContentPayouts] Error processing submission ${submission._id}:`,
          rowErr
        );
      }
    }

    // Recompute denormalized totalViews for any campaign we touched.
    for (const cidStr of campaignsToRecalc) {
      try {
        await recalcCampaignTotalViews(new Types.ObjectId(cidStr));
      } catch (recalcErr) {
        console.error(
          `[ContentPayouts] recalcCampaignTotalViews failed for ${cidStr}:`,
          recalcErr
        );
      }
    }

    const ms = Date.now() - startedAt;
    if (
      result.scanned > 0 ||
      result.paidOut > 0 ||
      result.errors > 0
    ) {
      console.log(
        `[ContentPayouts] swept ${result.scanned}, refreshed ${result.refreshed}, paid ${result.paidOut} ($${(
          result.paidOutCents / 100
        ).toFixed(2)}), errors ${result.errors} in ${ms}ms`
      );
    }
    return result;
  } finally {
    sweeping = false;
  }
}
