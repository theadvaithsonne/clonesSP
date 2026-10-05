import { FranchiseProgram } from "../models/franchiseProgram.model";
import { FranchiseTerritoryAssignment } from "../models/franchiseTerritoryAssignment.model";
import { FranchiseGlobalAssignment } from "../models/franchiseGlobalAssignment.model";

/**
 * Daily sweep: pause franchise subscriptions whose yearly window has lapsed.
 *
 *   - Active program past expiry → "suspended" (the office's program stops
 *     paying out entirely).
 *   - Active (System B) assignment past expiry → "paused_lapsed" (that
 *     territory owner stops earning; the slice reverts to the founder).
 *     The slot is kept, so a renewal payment flips it back to "active" (see
 *     fulfillInvoice).
 *   - Active (System A) global assignment past expiry → "paused_lapsed" —
 *     same semantics. The commission distributor treats a lapsed Garage
 *     assignment as "no owner" and cascades the slice UP; there is NO
 *     fallback to the catalog's ownerEmail (once Garage owns the record,
 *     Garage owns the lifecycle).
 *
 * Idempotent — re-running changes nothing once everything past-due is paused.
 * Returns the counts paused. Called from the recurring-invoice cron.
 */
export async function expireFranchiseSubscriptions(): Promise<{
  programsSuspended: number;
  assignmentsPaused: number;
  globalAssignmentsPaused: number;
}> {
  const now = new Date();

  const [programs, assignments, globalAssignments] = await Promise.all([
    FranchiseProgram.updateMany(
      {
        status: "active",
        "subscription.expiresAt": { $exists: true, $ne: null, $lt: now },
      },
      { $set: { status: "suspended" } }
    ),
    FranchiseTerritoryAssignment.updateMany(
      {
        status: "active",
        "subscription.expiresAt": { $exists: true, $ne: null, $lt: now },
      },
      { $set: { status: "paused_lapsed" } }
    ),
    FranchiseGlobalAssignment.updateMany(
      {
        status: "active",
        "subscription.expiresAt": { $exists: true, $ne: null, $lt: now },
      },
      { $set: { status: "paused_lapsed" } }
    ),
  ]);

  return {
    programsSuspended: programs.modifiedCount ?? 0,
    assignmentsPaused: assignments.modifiedCount ?? 0,
    globalAssignmentsPaused: globalAssignments.modifiedCount ?? 0,
  };
}
