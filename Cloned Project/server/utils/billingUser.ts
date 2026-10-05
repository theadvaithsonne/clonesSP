/**
 * Billing-owner resolution.
 *
 * Employees don't have their own wallets — every cost they incur (chat,
 * cron, agent usage) is billed to the founder of their org. This helper
 * translates a "user who triggered the cost" into "user whose wallet
 * should be charged".
 *
 * Rules:
 *   - If the user is a founder of any org they belong to → charge
 *     themselves (founders pay for their own usage).
 *   - Otherwise (stakeholder/employee) → find the founder of their
 *     primary org and charge them.
 *   - If we can't resolve a founder for any reason (deleted user,
 *     removed from org, legacy data) → fall back to charging the
 *     original user so the system keeps functioning. We log a warning
 *     so the fallback is visible.
 *
 * `fullAccess`-elevated stakeholders are intentionally NOT treated as
 * founders here. UI/RBAC treats them as founders for gating decisions,
 * but billing should follow the real founder. A stakeholder gaining
 * admin powers shouldn't silently take over the bill.
 */
import { User } from "../models/user.model";
import { OpenClawAgent } from "../models/openclawAgent.model";

/**
 * Preferred path: caller knows the agent_id. We look up the agent's
 * org, find the founder of THAT org, and charge them. Unambiguous —
 * beats the heuristic path below which has to guess the user's
 * "primary" org when they belong to multiple.
 */
export async function resolveBillingUserIdForAgent(
  userId: string,
  agentId: string,
): Promise<string> {
  const agent = await OpenClawAgent.findOne({ agentId })
    .select("orgId")
    .lean();
  if (!agent?.orgId) {
    // Fall through to the userId-based resolver — agent might be new /
    // not mirrored locally yet.
    return resolveBillingUserId(userId);
  }

  // Caller is a founder of the agent's org → charge them.
  const callerMembership = await User.findOne({
    _id: userId,
    $or: [
      { organizations: { $elemMatch: { organization: agent.orgId, role: "founder" } } },
      { organization: agent.orgId, role: "founder" },
    ],
  })
    .select("_id")
    .lean();
  if (callerMembership) return userId;

  // Otherwise the agent's org founder pays.
  const founder = await User.findOne({
    organizations: {
      $elemMatch: { organization: agent.orgId, role: "founder" },
    },
  })
    .select("_id")
    .lean();
  if (founder?._id) return founder._id.toString();

  const legacyFounder = await User.findOne({
    organization: agent.orgId,
    role: "founder",
  })
    .select("_id")
    .lean();
  if (legacyFounder?._id) return legacyFounder._id.toString();

  console.warn(
    `[billingUser] no founder for agent ${agentId}'s org ${agent.orgId} — charging user ${userId}`,
  );
  return userId;
}

export async function resolveBillingUserId(userId: string): Promise<string> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();
  if (!user) {
    console.warn(`[billingUser] user ${userId} not found — charging them anyway`);
    return userId;
  }

  // Multi-org path: if they're a founder in any org, charge themselves.
  const memberships = (user.organizations as any[]) || [];
  const ownFounderOrg = memberships.find((m) => m?.role === "founder");
  if (ownFounderOrg) return userId;

  // Legacy single-org path: only valid if `organization` is set and the
  // (legacy) top-level role is founder.
  if (user.role === "founder" && user.organization) return userId;

  // Employee path: pick their primary org (first entry wins) and find
  // its founder. If they have multiple orgs we may pick the wrong one —
  // acceptable tradeoff until the deduct call carries orgId explicitly.
  const primaryOrgId =
    memberships[0]?.organization?.toString() || user.organization?.toString();
  if (!primaryOrgId) {
    console.warn(`[billingUser] user ${userId} has no org — charging them`);
    return userId;
  }

  const founder = await User.findOne({
    organizations: {
      $elemMatch: { organization: primaryOrgId, role: "founder" },
    },
  })
    .select("_id")
    .lean();
  if (founder?._id) return founder._id.toString();

  // Last-resort legacy fallback for orgs created before `organizations[]`.
  const legacyFounder = await User.findOne({
    organization: primaryOrgId,
    role: "founder",
  })
    .select("_id")
    .lean();
  if (legacyFounder?._id) return legacyFounder._id.toString();

  console.warn(
    `[billingUser] no founder for user ${userId}'s org ${primaryOrgId} — charging them`,
  );
  return userId;
}
