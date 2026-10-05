import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRunAt(epochMs: number): string {
  return new Date(epochMs).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

interface PipelineTask {
  name: string;
  description?: string;
  status: "success" | "error" | "pending";
  error?: string | null;
}

function buildReport(payload: {
  jobId: string;
  agentId: string;
  runAtMs: number;
  durationMs?: number;
  summary?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  pipeline_result?: { tasks?: PipelineTask[] };
}): string {
  const {
    jobId,
    agentId,
    runAtMs,
    durationMs,
    summary,
    usage,
    pipeline_result,
  } = payload;

  // Pipeline tasks section
  let tasksSection: string;
  const tasks = pipeline_result?.tasks;
  if (tasks && tasks.length > 0) {
    tasksSection = tasks
      .map((t) => {
        const icon = t.status === "success" ? "✅" : t.status === "error" ? "❌" : "⏳";
        const detail =
          t.status === "error" && t.error ? ` — ${t.error}` : "";
        return `  • ${t.name}: ${icon} ${t.status.charAt(0).toUpperCase() + t.status.slice(1)}${detail}`;
      })
      .join("\n");
  } else {
    tasksSection = "No pipeline data received";
  }

  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  return [
    "---",
    `🤖 Agent: ${agentId}`,
    `🕐 Cron Job Report`,
    `Job ID: ${jobId}`,
    `Ran at: ${formatRunAt(runAtMs)}`,
    durationMs !== undefined ? `Duration: ${formatDuration(durationMs)}` : null,
    "",
    "📋 Summary",
    summary?.trim() || "No summary provided",
    "",
    "✅ Pipeline Tasks",
    tasksSection,
    "",
    "⚡ Token Usage",
    `Input: ${inputTokens} | Output: ${outputTokens}`,
    "---",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

// ---------------------------------------------------------------------------
// POST /cron-result
// ---------------------------------------------------------------------------

router.post("/cron-result", async (req: Request, res: Response) => {
  try {
    // Step 1a — Validate shared secret
    const incomingSecret = req.headers["x-webhook-secret"];
    const expectedSecret = process.env.CRON_WEBHOOK_SECRET;

    if (!expectedSecret || incomingSecret !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Step 1b — Parse and validate required fields
    const {
      jobId,
      userId,
      sessionId,
      agentId,
      runAtMs,
      durationMs,
      summary,
      usage,
      pipeline_result,
    } = req.body;

    const required = { jobId, userId, sessionId, agentId, runAtMs };
    const missing = Object.entries(required)
      .filter(([, v]) => v === undefined || v === null || v === "")
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({ error: "Missing required fields", missing });
    }

    // Log at INFO level
    console.info("[cron-webhook] Received", {
      jobId,
      userId,
      sessionId,
      agentId,
      runAtMs,
      durationMs,
    });

    // Step 2 — Build the human-readable Markdown report
    const report = buildReport({
      jobId,
      agentId,
      runAtMs,
      durationMs,
      summary,
      usage,
      pipeline_result,
    });

    // Step 3 — Forward to Garage chat
    const garageUrl =
      process.env.GARAGE_CHAT_INTERNAL_URL ||
      "http://localhost:4000/internal/chat/message";

    let chatDelivered = false;
    try {
      await axios.post(
        garageUrl,
        {
          userId,
          sessionId,
          agentId,
          message: report,
          type: "system",
          source: "cron-webhook",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GARAGE_INTERNAL_API_KEY || ""}`,
          },
          timeout: 10_000,
        }
      );
      chatDelivered = true;
    } catch (chatErr: any) {
      console.error(
        "[cron-webhook] Failed to deliver report to Garage chat",
        {
          jobId,
          sessionId,
          garageUrl,
          status: chatErr?.response?.status,
          data: chatErr?.response?.data,
          message: chatErr?.message,
        }
      );
    }

    // Step 4 — Always return 200 to OpenClaw
    return res.status(200).json({
      received: true,
      jobId,
      userId,
      sessionId,
      agentId,
      chatDelivered,
    });
  } catch (err: any) {
    console.error("[cron-webhook] Unhandled error", err?.stack || err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
