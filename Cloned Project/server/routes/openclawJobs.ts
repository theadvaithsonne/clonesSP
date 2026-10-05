import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { callOpenClaw } from "../utils/openclaw";
import { getAccessibleAgentIds } from "../utils/openclawAccess";

const router = Router();

async function proxyToOpenClaw(
  path: string,
  method: string,
  body?: any,
  user?: any,
): Promise<{ status: number; data: any }> {
  return callOpenClaw(`/api/${path}`, method, { body, user });
}

// GET /openclaw-jobs — list cron jobs the current user can see.
//
// Same scoping model as tasks: founders see every job for their org;
// employees see only jobs whose agent_id is in their assigned set.
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const access = await getAccessibleAgentIds(req.user);
    if (access.agentIds.size === 0) {
      return res.json([]);
    }

    const params = new URLSearchParams();
    params.set("org_id", access.orgId);
    // Pass-through filters that OpenClawApi already understands.
    if (typeof req.query.agent_id === "string") {
      // Honor agent_id only when it's in the accessible set.
      if (!access.agentIds.has(req.query.agent_id)) {
        return res.json([]);
      }
      params.set("agent_id", req.query.agent_id);
    }
    if (typeof req.query.user_id === "string") params.set("user_id", req.query.user_id);
    if (typeof req.query.session_id === "string") params.set("session_id", req.query.session_id);

    const r = await callOpenClaw(`/api/crons?${params.toString()}`, "GET", {
      user: req.user,
    });

    if (r.status < 200 || r.status >= 300 || !Array.isArray(r.data)) {
      return res.status(r.status).json(r.data);
    }

    const filtered = access.isFounder
      ? r.data
      : r.data.filter((j: any) => access.agentIds.has(j.agent_id));
    return res.json(filtered);
  } catch (err) {
    console.error("[OpenClawJobs] GET / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// GET /openclaw-jobs/:jobId/detail — job run history
router.get("/:jobId/detail", requireAuth, async (req: any, res: any) => {
  try {
    const { jobId } = req.params;
    const { status, data } = await proxyToOpenClaw(`crons/${jobId}/detail`, "GET", undefined, req.user);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawJobs] GET detail error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-jobs/:jobId/trigger — manually trigger a job
router.post("/:jobId/trigger", requireAuth, async (req: any, res: any) => {
  try {
    const { jobId } = req.params;
    const { status, data } = await proxyToOpenClaw(`crons/${jobId}/trigger`, "POST", undefined, req.user);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawJobs] POST trigger error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// PATCH /openclaw-jobs/:jobId — toggle enabled / update job
router.patch("/:jobId", requireAuth, async (req: any, res: any) => {
  try {
    const { jobId } = req.params;
    const { status, data } = await proxyToOpenClaw(`crons/${jobId}`, "PATCH", req.body, req.user);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawJobs] PATCH error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// DELETE /openclaw-jobs/:jobId — delete a job
router.delete("/:jobId", requireAuth, async (req: any, res: any) => {
  try {
    const { jobId } = req.params;
    const { status, data } = await proxyToOpenClaw(`crons/${jobId}`, "DELETE", undefined, req.user);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawJobs] DELETE error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

export default router;
