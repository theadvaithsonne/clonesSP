import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { generateAffiliateId, isValidAffiliateId } from "../utils/affiliateId";
import { Types } from "mongoose";

/**
 * Ensure a user has an affiliate ID, generating one if missing
 */
export async function ensureUserHasAffiliateId(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.affiliateId) {
    return user.affiliateId;
  }

  user.affiliateId = await generateAffiliateId();
  await user.save();

  return user.affiliateId;
}

/**
 * Set the referredBy field based on user role:
 * - Founders: referred by shorupan@gmail.com
 * - Stakeholders: referred by the founder of the FIRST non-parent org they joined
 *
 * Stamps `referredBySource: "founder_default"` so a later
 * `setReferredByAffiliateId` call can UPGRADE this to a real affiliate
 * attribution. Skipped entirely if the user already has ANY referredBy
 * set — first-referrer-wins for the founder-default path (this function
 * never overwrites; the affiliate-code path is the only overrider).
 */
export async function setReferredBy(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || user.referredBy) {
    return; // Already set or user not found
  }

  // Find GARAGE HQ (parent org)
  const garageHQ = await Organization.findOne({ parent: true }).lean();
  if (!garageHQ) {
    console.error("GARAGE HQ not found, cannot set referredBy");
    return;
  }

  // Check if user is a founder of any non-parent org
  const founderMembership = user.organizations?.find(
    (m: any) =>
      m.role === "founder" &&
      m.organization.toString() !== garageHQ._id.toString()
  );

  if (founderMembership) {
    // User is a founder -> referred by Shorupan
    const shorupan = await User.findOne({ email: "shorupan@gmail.com" }).lean();
    if (shorupan?._id) {
      user.referredBy = shorupan._id;
      (user as any).referredBySource = "founder_default";
      await user.save();
      console.log(`Set referredBy for founder ${user.email} -> ${shorupan._id}`);
    }
  } else {
    // User is a stakeholder -> referred by founder of first non-parent org
    const stakeholderMemberships = user.organizations?.filter(
      (m: any) => m.organization.toString() !== garageHQ._id.toString()
    );

    if (stakeholderMemberships && stakeholderMemberships.length > 0) {
      // Sort by joinedAt to find the first org they joined
      const sortedMemberships = [...stakeholderMemberships].sort(
        (a: any, b: any) =>
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      );

      const firstOrgId = sortedMemberships[0].organization;

      // Find founder of this org
      const founder = await User.findOne({
        "organizations.organization": firstOrgId,
        "organizations.role": "founder",
      }).lean();

      if (founder?._id) {
        user.referredBy = founder._id;
        (user as any).referredBySource = "founder_default";
        await user.save();
        console.log(`Set referredBy for stakeholder ${user.email} -> ${founder._id}`);
      }
    }
  }
}

/**
 * Set the referredBy field based on an affiliate ID (for checkout links).
 *
 * Attribution priority:
 *   1. No existing referredBy         → SET to the affiliate + fire notification
 *   2. Existing = 'founder_default'   → UPGRADE to the affiliate + fire notification
 *      (someone was auto-assigned to the org's founder as a placeholder;
 *       an actual affiliate click supersedes that placeholder)
 *   3. Existing = 'affiliate'         → NO-OP (first affiliate wins; we never
 *                                       reshuffle a real attribution)
 *   4. Existing but source unset      → NO-OP (legacy row; treat as sacred)
 *
 * `orgIdHint` is only used by the notification email (to include workshop
 * links scoped to that org).
 */
export async function setReferredByAffiliateId(
  userId: string,
  affiliateId: string,
  orgIdHint?: string | null,
): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) {
    return false;
  }

  const currentSource = (user as any).referredBySource as
    | "affiliate"
    | "founder_default"
    | undefined;

  // Guard: nothing to do if we already have a real (or legacy) attribution.
  if (user.referredBy && currentSource !== "founder_default") {
    return false;
  }

  // Find the referrer by affiliate ID
  const referrer = await User.findOne({ affiliateId }).select("_id").lean();
  if (!referrer) {
    console.log(`No user found with affiliateId: ${affiliateId}`);
    return false;
  }

  // Don't allow self-referral
  if (referrer._id.toString() === userId) {
    console.log(`Self-referral prevented for user ${userId}`);
    return false;
  }

  // If we're "upgrading" from founder_default AND the affiliate resolves
  // to the SAME user that's already there, skip — nothing to change.
  if (
    user.referredBy &&
    String(user.referredBy) === String(referrer._id)
  ) {
    // Still upgrade the source so future affiliate calls behave correctly.
    if (currentSource !== "affiliate") {
      (user as any).referredBySource = "affiliate";
      await user.save();
    }
    return true;
  }

  const wasUpgrade = !!user.referredBy && currentSource === "founder_default";
  user.referredBy = referrer._id;
  (user as any).referredBySource = "affiliate";
  await user.save();
  console.log(
    `${wasUpgrade ? "Upgraded" : "Set"} referredBy for user ${user.email} via affiliate ${affiliateId} -> ${referrer._id}`,
  );

  // Reflect the new attribution in the denormalized downline tree.
  // - Fresh set → syncNewEnrollee slots them in.
  // - Founder-default upgrade → reparent under the new referrer, undoing
  //   the old parent/ancestor counts along the way.
  // Fire-and-forget; the helpers swallow their own errors.
  try {
    const { syncNewEnrollee, reparentUnderNewReferrer } = await import(
      "./downlineTree"
    );
    if (wasUpgrade) {
      void reparentUnderNewReferrer(user._id);
    } else {
      void syncNewEnrollee(user._id);
    }
  } catch (err) {
    console.error(
      "[setReferredByAffiliateId] downline-tree sync import failed:",
      err,
    );
  }

  // Fire "you onboarded X" to the new affiliate. Dynamic import to avoid a
  // circular dependency (welcomeEmail.ts imports from this file).
  try {
    const { notifyReferrerOfNewSignup } = await import("./welcomeEmail");
    notifyReferrerOfNewSignup(userId, referrer._id.toString(), orgIdHint).catch(
      (err) =>
        console.error(
          "[setReferredByAffiliateId] Referrer notification failed:",
          err,
        ),
    );
  } catch (err) {
    console.error(
      "[setReferredByAffiliateId] Notification import failed:",
      err,
    );
  }
  return true;
}

/**
 * Returns true if `candidateReferrerId` sits somewhere in `meId`'s
 * downline tree — i.e. walking upward from candidate via `referredBy`
 * eventually reaches `meId`. Used to prevent the "change your referrer"
 * flow from creating a cycle in the affiliate graph (setting your
 * referrer to someone you referred, directly or transitively).
 *
 * Walks the candidate's upline chain with a visited-set so it's safe
 * against pre-existing cycles in the DB (which shouldn't exist but
 * aren't schema-enforced). Bounded by a hard cap of 100 hops.
 *
 * Note: also returns true when `candidateReferrerId === meId` — a user
 * setting themselves as their own referrer is trivially a cycle.
 */
export async function isInMyDownline(
  meId: string,
  candidateReferrerId: string,
): Promise<boolean> {
  const meStr = String(meId);
  if (String(candidateReferrerId) === meStr) return true;

  const visited = new Set<string>([String(candidateReferrerId)]);
  let cursor: Types.ObjectId | undefined;
  {
    const first = await User.findById(candidateReferrerId)
      .select("referredBy")
      .lean<{ referredBy?: Types.ObjectId }>();
    cursor = first?.referredBy;
  }
  let hops = 0;
  while (cursor && hops < 100) {
    const cursorStr = String(cursor);
    if (cursorStr === meStr) return true;
    if (visited.has(cursorStr)) break; // cycle in existing data — bail
    visited.add(cursorStr);
    const next = await User.findById(cursor)
      .select("referredBy")
      .lean<{ referredBy?: Types.ObjectId }>();
    cursor = next?.referredBy;
    hops += 1;
  }
  return false;
}

/**
 * Get referrer information by user ID
 */
export async function getReferrerInfo(referrerId: string | Types.ObjectId) {
  const referrer = await User.findById(referrerId)
    .select("name email profilePicture affiliateId")
    .lean();

  if (!referrer) {
    return null;
  }

  // Get referral stats
  const stats = await getAffiliateStats(referrer._id.toString());

  return {
    id: referrer._id.toString(),
    // Empty, never the word "Unknown". This feeds invite-link previews
    // ("X is inviting you to …"), and a placeholder name there reads as a
    // real person called Unknown. Callers that want a placeholder can add
    // one; callers that want to reword can only do that if we tell them
    // the truth. (The admin's sibling `newUpline` already uses `|| ""`.)
    name: referrer.name || "",
    email: referrer.email,
    profilePicture: referrer.profilePicture,
    affiliateCode: referrer.affiliateId,
    stats,
  };
}

/**
 * Get referrer info by affiliate ID (for backward compatibility with invite links)
 */
export async function getReferrerInfoByAffiliateId(affiliateId: string) {
  const referrer = await User.findOne({ affiliateId })
    .select("_id name email profilePicture affiliateId")
    .lean();

  if (!referrer) {
    return null;
  }

  return getReferrerInfo(referrer._id.toString());
}

/**
 * The sponsor card for an invite/register link: who referred me, and nothing
 * else. No email — a code out of a public URL must not hand a stranger's
 * address to whoever pastes it.
 *
 * Deliberately not `getReferrerInfoByAffiliateId` with fields dropped: the
 * point is to skip `getAffiliateStats`, whose 50-deep `$graphLookup` walks the
 * whole downline. This is hit by every referred user's first app launch, where
 * the only thing on screen is "<name> invited you".
 */
export async function getSponsorCardByAffiliateId(affiliateId: string) {
  // The code arrives from a link the user pasted or the store handed back, so
  // it is untrusted — check the shape before it reaches Mongo.
  if (!isValidAffiliateId(affiliateId)) {
    return null;
  }

  const referrer = await User.findOne({ affiliateId })
    .select("_id name profilePicture affiliateId")
    .lean();

  if (!referrer) {
    return null;
  }

  return {
    id: referrer._id.toString(),
    // Same rule as getReferrerInfo: empty, never the word "Unknown".
    name: referrer.name || "",
    profilePicture: referrer.profilePicture,
    affiliateCode: referrer.affiliateId,
  };
}

/**
 * Get affiliate statistics for a user
 */
export async function getAffiliateStats(userId: string) {
  const userObjectId = new Types.ObjectId(userId);

  // Direct referrals (immediate children)
  const directReferrals = await User.countDocuments({ referredBy: userObjectId });

  // Active direct referrals (users who have verified their email)
  const activeReferrals = await User.countDocuments({
    referredBy: userObjectId,
    isVerified: true,
  });

  // Total network size (all descendants) + max depth, in a single graph traversal
  const agg = await User.aggregate([
    { $match: { _id: userObjectId } },
    {
      $graphLookup: {
        from: "users",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "referredBy",
        as: "descendants",
        maxDepth: 50,
        depthField: "depth", // 0-based: direct children = 0
      },
    },
    {
      $project: {
        totalDescendants: { $size: "$descendants" },
        maxDepth: { $max: "$descendants.depth" },
      },
    },
  ]);
  const totalReferrals = Number(agg[0]?.totalDescendants ?? 0);
  // $max over the $graphLookup depthField yields a BSON Long; coerce to a JS
  // number so `+ 1` adds (e.g. 20) instead of string-concatenating ("191").
  const networkDepth = totalReferrals > 0 ? Number(agg[0]?.maxDepth ?? 0) + 1 : 0;

  // Lifetime earnings from the affiliate wallet (USD)
  const wallet = await AffiliateWallet.findOne({ userId: userObjectId })
    .select("totalEarnings")
    .lean();
  const lifetimeEarnings = (wallet as any)?.totalEarnings || 0;

  return {
    totalReferrals, // all descendants
    directReferrals, // immediate children
    activeReferrals,
    networkDepth,
    lifetimeEarnings,
    monthlyEarnings: lifetimeEarnings, // back-compat alias for older consumers
  };
}

/**
 * Count all descendants of a user using $graphLookup (single DB operation)
 */
export async function countAllDescendants(userId: string): Promise<number> {
  const result = await User.aggregate([
    { $match: { _id: new Types.ObjectId(userId) } },
    {
      $graphLookup: {
        from: "users",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "referredBy",
        as: "descendants",
        maxDepth: 50,
      },
    },
    { $project: { totalDescendants: { $size: "$descendants" } } },
  ]);

  return result.length > 0 ? result[0].totalDescendants : 0;
}

/**
 * Get the affiliate network (referral tree) for a user.
 *
 * Fast path (default): one indexed query on `ancestors: userId` returns
 * the caller's entire downline at every level. Uses the pre-computed
 * `directsCount` / `downlineCount` on each User doc so we don't have to
 * walk the subtree twice. Powered by the downline-tree denormalization
 * maintained in services/downlineTree.ts + scripts/backfill-downline-tree.ts.
 *
 * Safety net: if the caller's direct-referral count via `referredBy` is
 * higher than the direct-referral count we found via `ancestors` (i.e.
 * some direct children were signed up before the backfill ran and haven't
 * been synced yet), we fall back to the legacy full-scan walk below so the
 * user still sees a correct tree. After running backfill-downline-tree in
 * prod this fallback stops triggering.
 */
export async function getAffiliateNetwork(userId: string, maxDepth = 10) {
  const uidObj = new Types.ObjectId(userId);

  const [descendants, referredByDirectCount] = await Promise.all([
    User.find({ ancestors: uidObj })
      .select(
        "_id name email profilePicture affiliateId isVerified createdAt organizations referredBy directsCount downlineCount",
      )
      .lean(),
    User.countDocuments({ referredBy: uidObj }),
  ]);

  const directsInFastPath = descendants.filter(
    (u) => String((u as any).referredBy) === userId,
  ).length;

  if (directsInFastPath < referredByDirectCount) {
    console.warn(
      `[AFFILIATE] Fast path stale for ${userId} (ancestors=${directsInFastPath}, referredBy=${referredByDirectCount}) — falling back to legacy walk`,
    );
    return getAffiliateNetworkLegacy(userId, maxDepth);
  }

  const childrenMap = new Map<string, typeof descendants>();
  for (const u of descendants) {
    const parentId = String((u as any).referredBy);
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(u);
  }

  const buildTree = (parentUserId: string, depth: number): any[] => {
    if (depth >= maxDepth) return [];
    const kids = childrenMap.get(parentUserId) || [];
    return kids.map((k) => {
      const isFounder = ((k as any).organizations || []).some(
        (m: any) => m.role === "founder",
      );
      const children =
        depth + 1 < maxDepth ? buildTree(k._id.toString(), depth + 1) : [];
      return {
        id: k._id.toString(),
        name: (k as any).name || "Unknown",
        email: (k as any).email,
        avatar: (k as any).profilePicture || "",
        affiliateId: (k as any).affiliateId,
        joinedAt: (k as any).createdAt,
        level: depth + 1,
        status: (k as any).isVerified ? "active" : "inactive",
        userType: isFounder ? "admin" : "customer",
        totalReferrals: Number((k as any).downlineCount || 0),
        directReferrals: Number((k as any).directsCount || 0),
        children,
      };
    });
  };

  return buildTree(userId, 0);
}

/**
 * Legacy full-scan tree walk. Kept as a safety net for users signed up
 * before scripts/backfill-downline-tree.ts populated their ancestors[].
 * Do not call directly — getAffiliateNetwork picks it up automatically
 * when the fast-path result under-reports.
 */
async function getAffiliateNetworkLegacy(userId: string, maxDepth = 10) {
  const allReferrals = await User.find({ referredBy: { $exists: true, $ne: null } })
    .select("_id name email profilePicture affiliateId isVerified createdAt organizations referredBy")
    .lean();

  const childrenMap = new Map<string, typeof allReferrals>();
  for (const user of allReferrals) {
    const parentId = (user.referredBy as Types.ObjectId).toString();
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(user);
  }

  const countTotalDescendants = (node: any): number => {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((sum: number, child: any) => {
      return sum + 1 + countTotalDescendants(child);
    }, 0);
  };

  const buildTree = (parentUserId: string, depth: number): any[] => {
    if (depth >= maxDepth) return [];

    const referrals = childrenMap.get(parentUserId) || [];

    return referrals.map((referral) => {
      const children = depth + 1 < maxDepth
        ? buildTree(referral._id.toString(), depth + 1)
        : [];

      const isFounder = (referral as any).organizations?.some(
        (m: any) => m.role === "founder"
      );

      const node = {
        id: referral._id.toString(),
        name: referral.name || "Unknown",
        email: referral.email,
        avatar: referral.profilePicture || "",
        affiliateId: referral.affiliateId,
        joinedAt: referral.createdAt,
        level: depth + 1,
        status: referral.isVerified ? "active" : "inactive",
        userType: isFounder ? "admin" : "customer",
        totalReferrals: 0,
        directReferrals: children.length,
        children,
      };

      node.totalReferrals = countTotalDescendants(node);

      return node;
    });
  };

  return buildTree(userId, 0);
}
