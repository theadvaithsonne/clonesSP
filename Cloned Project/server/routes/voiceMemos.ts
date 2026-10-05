// src/routes/voiceMemos.ts
//
// Proxies the webinar UI's voice-memo flow to NetworkChain's voice-agent
// service (contacts-backend → /voice-agent/memos). Garage doesn't host the
// transcription / OpenAI / Qdrant pipeline locally — we just forward
// authenticated requests with a service token, scoping memos to the
// caller's Garage user via a namespaced X-Service-User-Id.
//
// User-id namespace: `garage:<userId>`. Keeps Garage-recorded memos
// from ever colliding with NC-recorded memos that share the same Mongo
// userId index in the voice-memo collection.

import { Router, Request, Response } from "express";
import axios, { AxiosError } from "axios";
import multer from "multer";
import FormData from "form-data";
import { requireAuth } from "../middleware/auth";

const router = Router();

const NC_BASE_URL =
  process.env.NC_BACKEND_URL || "https://backend.networkchains.com";
const SERVICE_TOKEN = process.env.NC_VOICE_AGENT_SERVICE_TOKEN || "";
const MEMOS_PATH = "/voice-agent/memos";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // match NC's 100MB cap
});

interface AuthedUser {
  userId: string;
  email?: string;
  name?: string;
}

function getUser(req: Request): AuthedUser {
  return (req as any).user as AuthedUser;
}

function serviceHeaders(req: Request, extra: Record<string, string> = {}) {
  if (!SERVICE_TOKEN) {
    throw new Error("NC_VOICE_AGENT_SERVICE_TOKEN not configured");
  }
  const me = getUser(req);
  return {
    "X-Service-Token": SERVICE_TOKEN,
    "X-Service-User-Id": `garage:${me.userId}`,
    "X-Service-User-Email": me.email || "",
    "X-Service-User-Name": me.name || "",
    ...extra,
  };
}

/**
 * Forward an upstream error so the client sees the real status/body
 * instead of a generic 500. NC already returns sane shapes
 * ({ error, details? }), so we just relay them.
 */
function forwardAxiosError(err: unknown, res: Response, label: string) {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    if (ax.response) {
      res
        .status(ax.response.status)
        .json(ax.response.data ?? { error: `${label} failed` });
      return;
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[VoiceMemos] ${label} error:`, message);
  res.status(502).json({ error: `${label} failed: ${message}` });
}

/** POST /voice-memos — multipart upload, proxied to NC. */
router.post(
  "/",
  requireAuth,
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }

      const form = new FormData();
      form.append("audio", req.file.buffer, {
        filename: req.file.originalname || "memo.webm",
        contentType: req.file.mimetype,
      });
      const passthrough = [
        "title",
        "recorded_at",
        "meeting_context",
        "speaker_timeline",
      ] as const;
      for (const field of passthrough) {
        const value = (req.body || {})[field];
        if (typeof value === "string" && value.length > 0) {
          form.append(field, value);
        }
      }

      const upstream = await axios.post(`${NC_BASE_URL}${MEMOS_PATH}`, form, {
        headers: {
          ...serviceHeaders(req),
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120_000,
      });
      res.status(upstream.status).json(upstream.data);
    } catch (err) {
      forwardAxiosError(err, res, "Upload");
    }
  },
);

/** GET /voice-memos — list this user's memos. */
router.get("/", requireAuth, async (req, res) => {
  try {
    const upstream = await axios.get(`${NC_BASE_URL}${MEMOS_PATH}`, {
      headers: serviceHeaders(req),
      params: req.query,
      timeout: 20_000,
    });
    res.json(upstream.data);
  } catch (err) {
    forwardAxiosError(err, res, "List");
  }
});

/** GET /voice-memos/:id */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const upstream = await axios.get(
      `${NC_BASE_URL}${MEMOS_PATH}/${encodeURIComponent(req.params.id)}`,
      { headers: serviceHeaders(req), timeout: 20_000 },
    );
    res.json(upstream.data);
  } catch (err) {
    forwardAxiosError(err, res, "Get");
  }
});

/** PATCH /voice-memos/:id — rename. */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const upstream = await axios.patch(
      `${NC_BASE_URL}${MEMOS_PATH}/${encodeURIComponent(req.params.id)}`,
      req.body ?? {},
      {
        headers: { ...serviceHeaders(req), "Content-Type": "application/json" },
        timeout: 20_000,
      },
    );
    res.json(upstream.data);
  } catch (err) {
    forwardAxiosError(err, res, "Patch");
  }
});

/** DELETE /voice-memos/:id */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const upstream = await axios.delete(
      `${NC_BASE_URL}${MEMOS_PATH}/${encodeURIComponent(req.params.id)}`,
      { headers: serviceHeaders(req), timeout: 20_000 },
    );
    res.status(upstream.status).end();
  } catch (err) {
    forwardAxiosError(err, res, "Delete");
  }
});

/** POST /voice-memos/:id/reprocess */
router.post("/:id/reprocess", requireAuth, async (req, res) => {
  try {
    const upstream = await axios.post(
      `${NC_BASE_URL}${MEMOS_PATH}/${encodeURIComponent(
        req.params.id,
      )}/reprocess`,
      {},
      { headers: serviceHeaders(req), timeout: 20_000 },
    );
    res.json(upstream.data);
  } catch (err) {
    forwardAxiosError(err, res, "Reprocess");
  }
});

export default router;
