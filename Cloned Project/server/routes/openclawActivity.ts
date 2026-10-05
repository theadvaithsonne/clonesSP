/**
 * Activity feed with per-user scoping.
 *
 * Founders see all activity for agents in their org (including
 * system-generated rows with user_id=NULL).
 * Employees see only rows whose user_id equals their own — across the
 * agents assigned to them. An agent not in their assigned set returns
 * 404.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { callOpenClaw } from "../utils/openclaw";
import { getAccessibleAgentIds } from "../utils/openclawAccess";

const router = Router();

router.get("/:agentId/activity", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const access = await getAccessibleAgentIds(req.user);
    if (!access.agentIds.has(agentId)) {
      // Don't reveal whether the agent exists — same 404 shape as a
      // genuinely missing agent.
      return res.status(404).json({ error: "Agent not found" });
    }

    const params = new URLSearchParams();
    if (typeof req.query.limit === "string") params.set("limit", req.query.limit);
    if (typeof req.query.activity_type === "string") params.set("activity_type", req.query.activity_type);
    // Date range — ISO 8601 strings forwarded untouched; OpenClawApi
    // validates them. Omitted params mean "unbounded on that end".
    if (typeof req.query.from === "string") params.set("from", req.query.from);
    if (typeof req.query.to === "string") params.set("to", req.query.to);
    // Employees: force-scope to their own user_id. Founders: no filter,
    // full org-level visibility.
    if (!access.isFounder) {
      params.set("user_id", req.user.userId);
    }

    const qs = params.toString();
    const r = await callOpenClaw(
      `/api/agents/${agentId}/activity${qs ? `?${qs}` : ""}`,
      "GET",
      { user: req.user },
    );
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error("[OpenClawActivity] GET error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

export default router;
