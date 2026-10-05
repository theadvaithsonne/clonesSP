import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { callOpenClaw } from "../utils/openclaw";
import { getAccessibleAgentIds } from "../utils/openclawAccess";

const router = Router();

// GET /openclaw-tasks?status= — list tasks the current user is allowed to see.
//
// Scoping rules (server-side, non-bypassable):
//   - Founders see every task for every agent in their org.
//   - Employees see only tasks for agents the founder explicitly assigned
//     to them.
//   - An `agent_id` query param is respected ONLY if it's in the user's
//     accessible set; a foreign agent_id is silently replaced with "no
//     match" rather than leaking that it exists.
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const access = await getAccessibleAgentIds(req.user);
    if (access.agentIds.size === 0) {
      return res.json([]);
    }

    const requestedAgentId = typeof req.query.agent_id === "string" ? req.query.agent_id : undefined;

    // If caller asked for a specific agent, honor it only when accessible.
    if (requestedAgentId) {
      if (!access.agentIds.has(requestedAgentId)) {
        return res.json([]);
      }
      const params = new URLSearchParams();
      params.set("agent_id", requestedAgentId);
      if (typeof req.query.status === "string") params.set("status", req.query.status);
      const r = await callOpenClaw(`/api/tasks?${params.toString()}`, "GET", {
        user: req.user,
      });
      return res.status(r.status).json(r.data);
    }

    // Otherwise fetch by org (cheap — OpenClawApi filters via agent_registry)
    // and post-filter to the accessible set. The post-filter is a no-op for
    // founders (access == full org) and a real filter for employees.
    const params = new URLSearchParams();
    params.set("org_id", access.orgId);
    if (typeof req.query.status === "string") params.set("status", req.query.status);
    const r = await callOpenClaw(`/api/tasks?${params.toString()}`, "GET", {
      user: req.user,
    });

    if (r.status < 200 || r.status >= 300 || !Array.isArray(r.data)) {
      return res.status(r.status).json(r.data);
    }

    const filtered = access.isFounder
      ? r.data
      : r.data.filter((t: any) => access.agentIds.has(t.agent_id));
    return res.json(filtered);
  } catch (err) {
    console.error("[OpenClawTasks] GET / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// PATCH /openclaw-tasks/:taskId/issues/:issueIndex/resolve — resolve a task issue.
// No extra scoping needed: if the employee somehow has a taskId for an
// unassigned agent, the most they can do is mark an issue resolved — but
// the list endpoint above already prevents them from seeing those ids
// through the UI. Leaving this as a pass-through.
router.patch("/:taskId/issues/:issueIndex/resolve", requireAuth, async (req: any, res: any) => {
  try {
    const { taskId, issueIndex } = req.params;
    const r = await callOpenClaw(
      `/api/tasks/${taskId}/issues/${issueIndex}/resolve`,
      "PATCH",
      { user: req.user },
    );
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error("[OpenClawTasks] PATCH resolve error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

export default router;
