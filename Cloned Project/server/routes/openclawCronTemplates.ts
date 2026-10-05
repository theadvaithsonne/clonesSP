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

// GET /openclaw-templates?user_id= — list templates (public + user's own)
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const userId = (req.query.user_id as string) || req.user.userId;
    const { status, data } = await proxyToOpenClaw(`cron-templates?user_id=${userId}`, "GET");
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawTemplates] GET / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-templates — create a new template
router.post("/", requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const { status, data } = await proxyToOpenClaw(
      `cron-templates?user_id=${userId}`,
      "POST",
      req.body
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawTemplates] POST / error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// POST /openclaw-templates/:templateId/instantiate — create a job from template
router.post("/:templateId/instantiate", requireAuth, async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    const { status, data } = await proxyToOpenClaw(
      `cron-templates/${templateId}/instantiate`,
      "POST",
      req.body
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawTemplates] POST instantiate error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// PATCH /openclaw-templates/:templateId — update a template
router.patch("/:templateId", requireAuth, async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.userId;
    const { status, data } = await proxyToOpenClaw(
      `cron-templates/${templateId}?user_id=${userId}`,
      "PATCH",
      req.body
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawTemplates] PATCH error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

// DELETE /openclaw-templates/:templateId — delete a template
router.delete("/:templateId", requireAuth, async (req: any, res: any) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.userId;
    const { status, data } = await proxyToOpenClaw(
      `cron-templates/${templateId}?user_id=${userId}`,
      "DELETE"
    );
    return res.status(status).json(data);
  } catch (err) {
    console.error("[OpenClawTemplates] DELETE error:", err);
    return res.status(502).json({ error: "OpenClaw unreachable" });
  }
});

export default router;
