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

// GET /openclaw-integrations — list all global integrations
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const { status, data } = await proxyToOpenClaw("integrations", "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] GET / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-integrations — create a global integration
router.post("/", requireAuth, async (req: any, res: any) => {
  try {
    const { status, data } = await proxyToOpenClaw("integrations", "POST", req.body);
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] POST / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// GET /openclaw-integrations/agent/:agentId — integrations assigned to agent
router.get("/agent/:agentId", requireAuth, async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const { status, data } = await proxyToOpenClaw(`integrations/agent/${agentId}`, "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] GET agent error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// GET /openclaw-integrations/:integrationId/logs — get integration call logs
router.get("/:integrationId/logs", requireAuth, async (req: any, res: any) => {
  try {
    const { integrationId } = req.params;
    const { status, data } = await proxyToOpenClaw(`integrations/${integrationId}/logs`, "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] GET logs error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-integrations/:integrationId/assign — assign integration to agent
router.post("/:integrationId/assign", requireAuth, async (req: any, res: any) => {
  try {
    const { integrationId } = req.params;
    const { status, data } = await proxyToOpenClaw(
      `integrations/${integrationId}/assign`,
      "POST",
      req.body
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] POST assign error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// PATCH /openclaw-integrations/:integrationId — update an integration
router.patch("/:integrationId", requireAuth, async (req: any, res: any) => {
  try {
    const { integrationId } = req.params;
    const { status, data } = await proxyToOpenClaw(
      `integrations/${integrationId}`,
      "PATCH",
      req.body
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] PATCH error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// DELETE /openclaw-integrations/:integrationId — delete an integration
router.delete("/:integrationId", requireAuth, async (req: any, res: any) => {
  try {
    const { integrationId } = req.params;
    const { status, data } = await proxyToOpenClaw(`integrations/${integrationId}`, "DELETE");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawIntegrations] DELETE error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

export default router;
