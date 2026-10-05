import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { callOpenClaw } from "../utils/openclaw";

const router = Router();

async function proxyToOpenClaw(
  path: string,
  method: string,
  body?: any
): Promise<{ status: number; data: any }> {
  return callOpenClaw(`/api/${path}`, method, { body });
}

// GET /openclaw-contexts — list all global contexts
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const { status, data } = await proxyToOpenClaw("contexts", "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] GET / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-contexts — create a global context
router.post("/", requireAuth, async (req: any, res: any) => {
  try {
    const { status, data } = await proxyToOpenClaw("contexts", "POST", req.body);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] POST / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// GET /openclaw-contexts/agent/:agentId — get contexts assigned to agent
router.get("/agent/:agentId", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const { status, data } = await proxyToOpenClaw(`contexts/agent/${agentId}`, "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] GET agent error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-contexts/assign — assign context to agent
router.post("/assign", requireAuth, async (req: any, res: any) => {
  try {
    const { status, data } = await proxyToOpenClaw("contexts/assign", "POST", req.body);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] POST assign error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// DELETE /openclaw-contexts/unassign/:agentId/:contextId — unassign context from agent
router.delete("/unassign/:agentId/:contextId", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId, contextId } = req.params;
    const { status, data } = await proxyToOpenClaw(
      `contexts/unassign/${agentId}/${contextId}`,
      "DELETE"
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] DELETE unassign error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// GET /openclaw-contexts/:contextId — get a specific context
router.get("/:contextId", requireAuth, async (req: any, res: any) => {
  try {
    const { contextId } = req.params;
    const qs = req.query.agent_id ? `?agent_id=${req.query.agent_id}` : "";
    const { status, data } = await proxyToOpenClaw(`contexts/${contextId}${qs}`, "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] GET :contextId error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// GET /openclaw-contexts/:contextId/content?agent_id= — get context content
router.get("/:contextId/content", requireAuth, async (req: any, res: any) => {
  try {
    const { contextId } = req.params;
    const qs = req.query.agent_id ? `?agent_id=${req.query.agent_id}` : "";
    const { status, data } = await proxyToOpenClaw(`contexts/${contextId}/content${qs}`, "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] GET content error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// PATCH /openclaw-contexts/:contextId — update a context
router.patch("/:contextId", requireAuth, async (req: any, res: any) => {
  try {
    const { contextId } = req.params;
    const { status, data } = await proxyToOpenClaw(`contexts/${contextId}`, "PATCH", req.body);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] PATCH error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// DELETE /openclaw-contexts/:contextId — delete a context
router.delete("/:contextId", requireAuth, async (req: any, res: any) => {
  try {
    const { contextId } = req.params;
    const { status, data } = await proxyToOpenClaw(`contexts/${contextId}`, "DELETE");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawContexts] DELETE error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

export default router;
