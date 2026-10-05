import { Types } from "mongoose";

import { OrganizationFile } from "../models/cabinet.model";
import { OFFICE_PLAN_IDS } from "../models/officePlan.model";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { Organization } from "../models/organization.model";
import { hasActiveOfficeSubscription } from "../services/officeSubscription";

/**
 * How much cabinet space an office gets, by plan.
 *
 * Starter is free (10% platform fee instead of a subscription), so it gets a
 * token allowance. Pro ("Founders Office") is the paid plan and gets the real
 * one. An office with no identifiable plan is treated as Starter — the larger
 * cap is never handed out on a guess.
 */
export const STARTER_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const PRO_STORAGE_BYTES = 200 * 1024 * 1024 * 1024; // 200 GB

export type OrgPlanSlug = "starter" | "pro";

export interface OrgStoragePlan {
  planSlug: OrgPlanSlug;
  isPro: boolean;
  storageLimit: number;
}

const STARTER_PLAN: OrgStoragePlan = {
  planSlug: "starter",
  isPro: false,
  storageLimit: STARTER_STORAGE_BYTES,
};

const PRO_PLAN: OrgStoragePlan = {
  planSlug: "pro",
  isPro: true,
  storageLimit: PRO_STORAGE_BYTES,
};

/**
 * Which plan a subscription is on, read from whichever signal survived.
 *
 * `populate("planId")` is the obvious one and the one that fails: a plan
 * document that was re-seeded (or never seeded in this environment) leaves the
 * ref dangling, `planId` stays an ObjectId and `plan.slug` reads as undefined.
 * Every paying Pro office then looked like a Starter one. The fixed
 * OFFICE_PLAN_IDS and the slug stamped on `metadata` at subscribe time both
 * survive that, so all three are consulted before giving up.
 *
 * Returns null when nothing identifies the plan — the caller falls back to the
 * canonical unlock check rather than guessing.
 */
function planSlugOf(subscription: any): string | null {
  const populated = subscription?.planId as any;
  if (populated && typeof populated === "object" && populated.slug) {
    return String(populated.slug);
  }

  const planId = String(
    populated?._id ?? populated ?? subscription?.planId ?? ""
  );
  for (const [slug, id] of Object.entries(OFFICE_PLAN_IDS)) {
    if (planId && planId === id) return slug;
  }

  const stamped = subscription?.metadata?.planSlug;
  return stamped ? String(stamped) : null;
}

/**
 * Whether a trial has run out. Only trials expire on their own here — see
 * `getOrgStoragePlan` for why a paid plan's billing state is not second-
 * guessed.
 */
function isExpiredTrial(subscription: any, now: Date): boolean {
  if (!subscription?.isTrial) return false;
  return !subscription.trialEndsAt || subscription.trialEndsAt <= now;
}

/**
 * Resolve the office's plan and its storage cap.
 *
 * The cap follows the office's plan OF RECORD — the newest subscription — and
 * nothing else. It deliberately does NOT re-derive whether that plan is paid
 * up: `processExpiredOfficeGrace` is the one thing that ends a Pro plan, and
 * when it fires it replaces the Pro subscription with a Starter one, at which
 * point this reads 2 GB on its own.
 *
 * That ordering matters. This used to check `currentEnd` and the grace window
 * itself, so an office whose Razorpay cycle had rolled past its end date — but
 * which the platform still treated as Pro everywhere else, badge included —
 * silently dropped to the 2 GB Starter cap in the cabinet alone. Billing state
 * belongs to the subscription service; the cabinet only asks which plan the
 * office is on.
 *
 * The exception is a trial that has run out: it was never paid, and
 * `hasActiveOfficeSubscription` already treats it as over.
 */
export async function getOrgStoragePlan(
  organizationId: string | Types.ObjectId
): Promise<OrgStoragePlan> {
  const orgId = String(organizationId);

  try {
    // GARAGE HQ parents are never locked and never billed; the Starter cap is
    // not a sensible thing to hand them.
    const org = await Organization.findById(orgId).select("parent").lean();
    if ((org as any)?.parent === true) return PRO_PLAN;

    // Newest first: an office that downgraded and re-upgraded has several, and
    // the most recent one it is identifiable on is the plan of record.
    const subscriptions = await OfficeSubscription.find({
      orgId: new Types.ObjectId(orgId),
    })
      .populate("planId")
      .sort({ createdAt: -1 });

    const now = new Date();

    for (const subscription of subscriptions) {
      const slug = planSlugOf(subscription);
      if (!slug) continue;

      // Starter is the free plan and the downgrade target — 2 GB, full stop.
      if (slug === "starter") return STARTER_PLAN;

      // Pro, or a legacy Basic office that is still on its paid plan.
      return isExpiredTrial(subscription, now) ? STARTER_PLAN : PRO_PLAN;
    }

    // No subscription at all, or none we could identify. The unlock check
    // covers the remaining ways an office stays open (parent org, test list) —
    // it also answers true for a live *Starter* subscription, which is why it
    // is consulted only after the loop above has ruled one out.
    const unlocked = await hasActiveOfficeSubscription(orgId);
    return unlocked ? PRO_PLAN : STARTER_PLAN;
  } catch (error) {
    // A subscription lookup that blows up must not hand out the bigger cap.
    console.error("[CabinetStorage] Failed to resolve org plan:", error);
    return STARTER_PLAN;
  }
}

export interface OrgStorageUsage {
  photos: number;
  videos: number;
  documents: number;
  totalUsed: number;
}

/**
 * Bytes the office cabinet currently holds, split the way the storage banner
 * renders it. Summed in Mongo so a large cabinet does not stream every file
 * document into the API process.
 */
export async function getOrgStorageUsage(
  organizationId: string | Types.ObjectId
): Promise<OrgStorageUsage> {
  const rows = await OrganizationFile.aggregate<{
    _id: "photos" | "videos" | "documents";
    bytes: number;
  }>([
    { $match: { organization: new Types.ObjectId(String(organizationId)) } },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              {
                case: {
                  $regexMatch: { input: "$mimeType", regex: /^image\// },
                },
                then: "photos",
              },
              {
                case: {
                  $regexMatch: { input: "$mimeType", regex: /^video\// },
                },
                then: "videos",
              },
            ],
            default: "documents",
          },
        },
        bytes: { $sum: { $ifNull: ["$size", 0] } },
      },
    },
  ]);

  const usage: OrgStorageUsage = {
    photos: 0,
    videos: 0,
    documents: 0,
    totalUsed: 0,
  };

  for (const row of rows) {
    usage[row._id] = row.bytes || 0;
  }
  usage.totalUsed = usage.photos + usage.videos + usage.documents;

  return usage;
}

export interface OrgStorageDetails extends OrgStorageUsage {
  storageLimit: number;
  planSlug: OrgPlanSlug;
  isPro: boolean;
}

/** The `storageDetails` block every organization cabinet response returns. */
export async function getOrgStorageDetails(
  organizationId: string | Types.ObjectId
): Promise<OrgStorageDetails> {
  const [usage, plan] = await Promise.all([
    getOrgStorageUsage(organizationId),
    getOrgStoragePlan(organizationId),
  ]);

  return {
    ...usage,
    storageLimit: plan.storageLimit,
    planSlug: plan.planSlug,
    isPro: plan.isPro,
  };
}

function formatBytes(bytes: number): string {
  const GB = 1024 * 1024 * 1024;
  const MB = 1024 * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes % GB === 0 ? 0 : 1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

export interface QuotaCheck {
  allowed: boolean;
  message?: string;
  storageLimit: number;
  totalUsed: number;
  remaining: number;
  planSlug: OrgPlanSlug;
}

/**
 * Whether `incomingBytes` still fits inside the office's plan allowance.
 *
 * Called BEFORE the S3 put, so a rejected upload leaves no orphaned object
 * behind.
 */
export async function checkOrgUploadQuota(
  organizationId: string | Types.ObjectId,
  incomingBytes: number
): Promise<QuotaCheck> {
  const [usage, plan] = await Promise.all([
    getOrgStorageUsage(organizationId),
    getOrgStoragePlan(organizationId),
  ]);

  const remaining = Math.max(0, plan.storageLimit - usage.totalUsed);
  const allowed = usage.totalUsed + (incomingBytes || 0) <= plan.storageLimit;

  if (allowed) {
    return {
      allowed,
      storageLimit: plan.storageLimit,
      totalUsed: usage.totalUsed,
      remaining,
      planSlug: plan.planSlug,
    };
  }

  const planName = plan.isPro ? "Founders Office" : "Starter";
  const upgradeHint = plan.isPro
    ? "Delete some files to free up space."
    : "Upgrade to the Founders Office plan for 200 GB, or delete some files to free up space.";

  return {
    allowed: false,
    message:
      `Storage limit reached. Your ${planName} plan includes ` +
      `${formatBytes(plan.storageLimit)} and ${formatBytes(usage.totalUsed)} is already used — ` +
      `this ${formatBytes(incomingBytes || 0)} file needs more than the ${formatBytes(remaining)} left. ` +
      upgradeHint,
    storageLimit: plan.storageLimit,
    totalUsed: usage.totalUsed,
    remaining,
    planSlug: plan.planSlug,
  };
}
