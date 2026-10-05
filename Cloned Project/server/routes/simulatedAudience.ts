// Simulated audience — fabricated attendees and chat shown alongside the real
// ones, for LIVE webinars as well as evergreen.
//
// Host-facing and founder-guarded, same shape as evergreen.ts. Generation is
// AI-assisted but never automatic: the model proposes people and lines, the
// host reviews and edits them, and nothing appears in a room until they
// explicitly enable it.
//
// The timeline anchor is `manualStartedAt` on the session override — when the
// host ACTUALLY went live, not the scheduled time — so `atSec` offsets mean
// "this many seconds into the session".
import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth";
import { Workshop } from "../models/workshop.model";
import { isUserFounder } from "../services/review";
import { getOrgApiKey } from "./founderAiProviders";
import { DEFAULT_GEMINI_KEY } from "./betty";

const router = Router();

const MAX_PEOPLE = 200;
const MAX_CHAT = 500;

/** Founder-of-this-workshop guard, same as evergreen.ts. */
async function loadOwnedWorkshop(req: Request, res: Response) {
  const me = (req as any).user as { userId: string };
  const { workshopId } = req.params;
  if (!Types.ObjectId.isValid(workshopId)) {
    res.status(400).json({ success: false, error: "Invalid workshop id" });
    return null;
  }
  const workshop: any = await Workshop.findById(workshopId);
  if (!workshop) {
    res.status(404).json({ success: false, error: "Workshop not found" });
    return null;
  }
  const isFounder = await isUserFounder(me.userId, String(workshop.orgId));
  if (!isFounder) {
    res.status(403).json({ success: false, error: "Only founders can configure this webinar" });
    return null;
  }
  return workshop;
}

type Provider = { provider: "google-gemini" | "openai" | "anthropic"; apiKey: string };

/**
 * The platform's own Gemini credentials — the same ones betty.ts and
 * askCabinet.ts use, which are known to work. Deliberately NOT
 * `process.env.GEMINI_API_KEY`: that variable holds a different key that the
 * API rejects, which is what made generation fail with a 502.
 */
const PLATFORM_PROVIDER: Provider = { provider: "google-gemini", apiKey: DEFAULT_GEMINI_KEY };

/**
 * The office's own AI key if it has one, else the platform key — the same
 * precedence betty.ts uses, so an office that has configured a provider gets
 * billed to it rather than to us. Always resolves: the platform key is the
 * floor, so generation can never fail merely for want of a provider.
 */
async function resolveProvider(orgId: string): Promise<Provider> {
  for (const provider of ["google-gemini", "openai", "anthropic"] as const) {
    const apiKey = await getOrgApiKey(provider, orgId);
    if (apiKey) return { provider, apiKey };
  }
  return PLATFORM_PROVIDER;
}

/** One prompt, one JSON answer — no tools, no conversation. */
async function completeJson(
  p: { provider: string; apiKey: string },
  prompt: string
): Promise<string> {
  if (p.provider === "openai") {
    const openai = new OpenAI({ apiKey: p.apiKey });
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    return r.choices[0]?.message?.content || "";
  }
  if (p.provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: p.apiKey });
    const r = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });
    const block = r.content[0];
    return block?.type === "text" ? block.text : "";
  }
  const genAI = new GoogleGenerativeAI(p.apiKey);
  // gemini-2.5-flash-lite: the model askCabinet.ts and cabinet.controller.ts
  // already run against this key. "gemini-2.0-flash" was a guess and is not
  // one of the models this project has proven.
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });
  const r = await model.generateContent(prompt);
  return r.response.text();
}

/** Models still wrap JSON in prose or fences often enough to be worth this. */
function parseJsonLoose(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The model did not return usable JSON");
  }
}

// ── GET /simulated-audience/:workshopId ───────────────────────────────────
router.get("/:workshopId", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;
    return res.json({
      success: true,
      simulatedAudience: workshop.simulatedAudience || {
        enabled: false,
        people: [],
        chat: [],
        viewers: { enabled: false, peak: 0 },
      },
      // Context for the generate form, so the host doesn't retype what the
      // webinar already knows about itself.
      webinar: {
        title: workshop.title,
        description: workshop.description,
        learningPoints: workshop.learningPoints || [],
      },
    });
  } catch (error) {
    console.error("[SimulatedAudience] get error:", error);
    return res.status(500).json({ success: false, error: "Failed to load" });
  }
});

// ── PATCH /simulated-audience/:workshopId ─────────────────────────────────
// The host's edits are authoritative. Generation only ever proposes.
router.patch("/:workshopId", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const body = z
      .object({
        enabled: z.boolean().optional(),
        people: z.array(z.object({ name: z.string().min(1).max(80) })).max(MAX_PEOPLE).optional(),
        chat: z
          .array(
            z.object({
              atSec: z.number().min(0),
              name: z.string().min(1).max(80),
              message: z.string().min(1).max(500),
            })
          )
          .max(MAX_CHAT)
          .optional(),
        viewers: z
          .object({ enabled: z.boolean(), peak: z.number().min(0).max(100000).optional() })
          .optional(),
      })
      .parse(req.body);

    const current = workshop.simulatedAudience || {};
    if (body.enabled === true) {
      const people = body.people ?? current.people ?? [];
      const chat = body.chat ?? current.chat ?? [];
      if (!people.length && !chat.length) {
        return res.status(400).json({
          success: false,
          error: "Add some people or chat lines before turning this on",
        });
      }
    }

    workshop.simulatedAudience = {
      ...(current.toObject?.() || current),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.people ? { people: body.people } : {}),
      // Kept sorted so the room can reveal them by walking forward.
      ...(body.chat ? { chat: [...body.chat].sort((a, b) => a.atSec - b.atSec) } : {}),
      ...(body.viewers ? { viewers: body.viewers } : {}),
    };
    await workshop.save();

    return res.json({ success: true, simulatedAudience: workshop.simulatedAudience });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
    }
    console.error("[SimulatedAudience] patch error:", error);
    return res.status(500).json({ success: false, error: "Failed to save" });
  }
});

// ── POST /simulated-audience/:workshopId/generate ─────────────────────────
// Proposes people + a timed chat script from the webinar's own details plus
// whatever the host adds. Returns them for review; saves NOTHING.
router.post("/:workshopId/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const input = z
      .object({
        topic: z.string().max(2000).optional(),
        audience: z.string().max(500).optional(),
        tone: z.string().max(200).optional(),
        region: z.string().max(200).optional(),
        peopleCount: z.number().min(1).max(MAX_PEOPLE).default(25),
        messageCount: z.number().min(1).max(MAX_CHAT).default(40),
        durationMin: z.number().min(1).max(600).default(60),
      })
      .parse(req.body ?? {});

    const provider = await resolveProvider(String(workshop.orgId));

    const topic =
      input.topic ||
      [workshop.title, workshop.description, ...(workshop.learningPoints || [])]
        .filter(Boolean)
        .join("\n")
        .slice(0, 2000);

    const prompt = `You are scripting a realistic audience for a live webinar chat.

WEBINAR
${topic || "(no details given)"}

AUDIENCE: ${input.audience || "general attendees interested in the topic"}
TONE: ${input.tone || "casual, warm, informal"}
NAMES SHOULD SUIT: ${input.region || "a mixed international audience"}
SESSION LENGTH: ${input.durationMin} minutes

Produce EXACTLY this JSON:
{
  "people": [{ "name": "First L." }],
  "chat": [{ "atSec": 0, "name": "First L.", "message": "..." }]
}

RULES
- ${input.peopleCount} people, ${input.messageCount} chat messages.
- Every chat "name" MUST be one of the "people" names.
- "atSec" is seconds from the start of the session, between 0 and ${input.durationMin * 60}.
  Spread them unevenly and realistically: a cluster of greetings in the first
  two minutes, then a natural scatter, with a few near the end.
- Messages are SHORT — chat length, under 120 characters, lowercase-ish, typos
  occasionally, emoji sparingly. Not marketing copy.
- Mix: greetings, where people are joining from, reactions, genuine questions
  about the topic, agreement, a couple of practical questions.
- NEVER invent prices, discounts, earnings figures, guarantees, testimonials of
  results, or anything that reads as a promise from the host.
- No links, no phone numbers, no email addresses, no @mentions of real people.
- Return JSON only.`;

    // An office's stored key can be expired, revoked or out of quota — that
    // used to surface as a bare 502 with the host having no way to act on it.
    // Fall back to the platform key once rather than failing the request.
    let used = provider;
    let raw: string;
    try {
      raw = await completeJson(provider, prompt);
    } catch (err) {
      if (provider.apiKey === PLATFORM_PROVIDER.apiKey) throw err;
      console.warn(
        `[SimulatedAudience] org provider ${provider.provider} failed, retrying on platform key:`,
        err instanceof Error ? err.message : err
      );
      used = PLATFORM_PROVIDER;
      raw = await completeJson(PLATFORM_PROVIDER, prompt);
    }
    const parsed = parseJsonLoose(raw);

    // Re-validate the model's output — it is untrusted, and a bad `atSec` or an
    // over-long message would be persisted straight into a room otherwise.
    const shape = z.object({
      people: z.array(z.object({ name: z.string().min(1).max(80) })).max(MAX_PEOPLE),
      chat: z
        .array(
          z.object({
            atSec: z.number().min(0),
            name: z.string().min(1).max(80),
            message: z.string().min(1).max(500),
          })
        )
        .max(MAX_CHAT),
    });
    const out = shape.parse({
      people: (parsed.people || []).map((p: any) => ({ name: String(p?.name ?? "").trim() })).filter((p: any) => p.name),
      chat: (parsed.chat || [])
        .map((c: any) => ({
          atSec: Math.max(0, Math.round(Number(c?.atSec) || 0)),
          name: String(c?.name ?? "").trim(),
          message: String(c?.message ?? "").trim().slice(0, 500),
        }))
        .filter((c: any) => c.name && c.message),
    });

    // Drop any line attributed to someone not in the roster — the model does
    // this occasionally and it would show a name the People list never lists.
    const roster = new Set(out.people.map((p) => p.name));
    const chat = out.chat.filter((c) => roster.has(c.name)).sort((a, b) => a.atSec - b.atSec);

    return res.json({
      success: true,
      provider: used.provider,
      people: out.people,
      chat,
      dropped: out.chat.length - chat.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
    }
    console.error("[SimulatedAudience] generate error:", error);
    return res.status(502).json({
      success: false,
      error: error instanceof Error ? error.message : "Generation failed",
    });
  }
});

export default router;
