// src/services/downlineTree.ts
// Maintenance for the denormalized downline-table fields on User
// (ancestors / depth / legNumber / directsCount / downlineCount / typeFlags).
// The authoritative (re-runnable) populate is scripts/backfill-downline-tree.ts;
// these helpers keep the fields correct incrementally after that backfill.
//
// PRECONDITION: the parent must already be backfilled (has correct `ancestors`/
// `depth`). Run the backfill once before relying on syncNewEnrollee.

import { Types } from "mongoose";
import { User } from "../models/user.model";
import { computeTypeFlags } from "./downlineTypeFlags";

/**
 * After a new user is created with `referredBy` set, populate their tree fields
 * and bump the counts of the parent (+directsCount) and every ancestor
 * (+downlineCount). Safe to call fire-and-forget; never throws into the caller.
 */
export async function syncNewEnrollee(childId: string | Types.ObjectId): Promise<void> {
  try {
    const cid = typeof childId === "string" ? new Types.ObjectId(childId) : childId;
    const child = await User.findById(cid).select("_id referredBy createdAt").lean();
    if (!child || !(child as any).referredBy) return;
    const parentId = (child as any).referredBy as Types.ObjectId;

    // A user who refers THEMSELVES (the network founder does) is a ROOT, not
    // their own child. Without this the sync makes them their own ancestor and
    // then "enrols" them under themselves — which zeroed the founder's real
    // 634 directs down to 1. scripts/backfill-downline-tree.ts and
    // services/rankBonus/qualify.ts both already carry this guard; this was
    // the one tree-walker missing it.
    if (String(parentId) === String(cid)) return;

    const parent = await User.findById(parentId).select("_id ancestors depth").lean();
    if (!parent) return;

    const ancestors = [...((parent as any).ancestors || []), parentId];
    const depth = ancestors.length;
    // Leg = signup order among the parent's directs (1-based). Count prior directs.
    const priorDirects = await User.countDocuments({
      referredBy: parentId,
      _id: { $ne: cid },
    });
    const legNumber = priorDirects + 1;
    const typeFlags = await computeTypeFlags(cid);

    // `directsCount`/`downlineCount` are deliberately NOT reset here.
    //
    // They used to be forced to 0 on the assumption that this only ever runs
    // for a brand-new user — for whom the schema default is already 0, so the
    // reset bought nothing. But the post-save hook on User exists precisely to
    // slot in EXISTING users that earlier signup paths missed, and for those
    // the reset destroys real counts. Leave them alone; the backfill script is
    // the authority for repairing them.
    await User.updateOne(
      { _id: cid },
      { $set: { ancestors, depth, legNumber, typeFlags } }
    );
    // Parent gains a direct; every ancestor (parent included) gains a descendant.
    await Promise.all([
      User.updateOne({ _id: parentId }, { $inc: { directsCount: 1 } }),
      User.updateMany({ _id: { $in: ancestors } }, { $inc: { downlineCount: 1 } }),
    ]);
  } catch (err) {
    console.error("[downlineTree] syncNewEnrollee failed (non-blocking):", err);
  }
}

/**
 * Move a user under whoever their `referredBy` now points at, undoing the
 * old parent/ancestor counts along the way. Use after `referredBy` has just
 * been rewritten (attribution upgrade from `founder_default` → real
 * affiliate). Safe to call fire-and-forget.
 *
 * Constraint: skips the re-parent when the user already has a non-empty
 * downline (downlineCount > 0). A true subtree cascade would need to
 * rewrite the `ancestors` prefix of every descendant, which is out of scope
 * here — leave those for the next backfill run and log a warning so they're
 * visible.
 */
export async function reparentUnderNewReferrer(
  userId: string | Types.ObjectId,
): Promise<void> {
  try {
    const uid = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
    const user = await User.findById(uid)
      .select("_id referredBy ancestors downlineCount")
      .lean();
    if (!user) return;
    const newParentId = (user as any).referredBy as Types.ObjectId | null;
    if (!newParentId) return;

    const oldAncestors = (((user as any).ancestors || []) as Types.ObjectId[])
      .map((a) => (a instanceof Types.ObjectId ? a : new Types.ObjectId(String(a))));
    const dCount = Number((user as any).downlineCount || 0);

    // If the user already sits under the same parent (ancestors' last === new
    // parent), nothing to move — leg/depth/counts are already correct.
    const lastOld = oldAncestors[oldAncestors.length - 1];
    if (lastOld && String(lastOld) === String(newParentId)) return;

    if (dCount > 0) {
      console.warn(
        `[downlineTree] reparent skipped for ${String(uid)}: ${dCount} descendants — run backfill-downline-tree to reconcile`,
      );
      return;
    }

    // Reverse the old side: parent loses a direct, each ancestor loses a
    // descendant. dCount is 0 here, so the delta per ancestor is just 1.
    if (oldAncestors.length > 0) {
      const oldParentId = oldAncestors[oldAncestors.length - 1];
      await Promise.all([
        User.updateOne({ _id: oldParentId }, { $inc: { directsCount: -1 } }),
        User.updateMany(
          { _id: { $in: oldAncestors } },
          { $inc: { downlineCount: -1 } },
        ),
      ]);
    }

    // Now populate under the new parent — syncNewEnrollee $sets ancestors/
    // depth/legNumber/typeFlags and $incs the new side. Safe because we
    // already reset the user's own directsCount/downlineCount to 0 below
    // (and dCount was 0 anyway, else we bailed above).
    await syncNewEnrollee(uid);
  } catch (err) {
    console.error("[downlineTree] reparentUnderNewReferrer failed (non-blocking):", err);
  }
}

/**
 * Recompute + persist `typeFlags` for one user. Call after any event that can
 * change membership state: UnilevelPlus purchase activation/refund, office
 * subscription status change, and NetworkChains-sub activation/expiry (the
 * NC-sub path lives in contacts-backend and should call the equivalent update
 * on the shared User doc). Never throws.
 */
export async function refreshTypeFlags(userId: string | Types.ObjectId): Promise<void> {
  try {
    const uid = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
    const typeFlags = await computeTypeFlags(uid);
    await User.updateOne({ _id: uid }, { $set: { typeFlags } });
  } catch (err) {
    console.error("[downlineTree] refreshTypeFlags failed (non-blocking):", err);
  }
}
