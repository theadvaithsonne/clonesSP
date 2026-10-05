/**
 * RBAC helpers for OpenClaw agent access.
 *
 * One source of truth for "which agent_ids can this user see?" so every
 * list endpoint (tasks, jobs, …) applies the same rule and they can't
 * drift out of sync.
 *
 *   Founder of org  →  every active agent in the org
 *   Employee        →  only agents that include their userId in assignedUserIds
 *
 * Soft-deleted agents (deletedAt != null) are excluded in both cases.
 */
import { Types } from "mongoose";
import { OpenClawAgent } from "../models/openclawAgent.model";
import type { AuthUser } from "../middleware/auth";

export interface AgentAccess {
  /** The set of agent_ids this user can see within their current org. */
  agentIds: Set<string>;
  /** The org this scoping is evaluated against (from the user's JWT). */
  orgId: string;
  /** True if the user is a founder of that org — they see everything. */
  isFounder: boolean;
}

export async function getAccessibleAgentIds(user: AuthUser): Promise<AgentAccess> {
  const isFounder = user.role === "founder";
  const orgId = user.orgId;
  if (!orgId) {
    return { agentIds: new Set(), orgId: "", isFounder };
  }

  const filter: Record<string, unknown> = { orgId, deletedAt: null };
  if (!isFounder) {
    filter.assignedUserIds = new Types.ObjectId(user.userId);
  }

  const rows = await OpenClawAgent.find(filter).select("agentId").lean();
  return {
    agentIds: new Set(rows.map((r: any) => r.agentId as string)),
    orgId,
    isFounder,
  };
}
