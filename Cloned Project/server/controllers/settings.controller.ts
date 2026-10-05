import { Request, Response } from "express";
import { z } from "zod";
import {
  buildSettingsResponse,
  createSettings,
  getSettings,
  updateSettings,
} from "../services/settings.service";
import { fail, ok } from "../utils/http";

const dynamicEmailItemSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
});

const updateSettingsSchema = z.object({
  emailPreferences: z.record(z.string(), z.boolean()).optional(),
  officeDynamicEmails: z.array(dynamicEmailItemSchema).optional(),
  // Validated for SHAPE only — an ISO-639 code, optionally with a region — and
  // deliberately not against a list of languages. Which languages exist is the
  // client's business and changes on its release cycle, not this one's; an
  // allow-list here would mean a backend deploy for every new language.
  language: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/,
      'language must be an ISO-639 code, e.g. "en" or "pt-BR"',
    )
    .optional(),
  // Same philosophy as `language`: validated for SHAPE only (a 3-letter
  // ISO-4217 code), not against a list of currencies. Which currencies are
  // offered is the client's business.
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'currency must be an ISO-4217 code, e.g. "USD"')
    .transform((s) => s.toUpperCase())
    .optional(),
});

export async function createMySettings(req: Request, res: Response) {
  try {
    const me = (req as any).user as { userId: string; orgId?: string };
    if (!me?.orgId) {
      return res.status(400).json(fail("Organization context is required"));
    }

    const created = await createSettings(me.userId, me.orgId);
    return res.status(201).json(ok(buildSettingsResponse(created)));
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json(fail("Settings already exist for this user"));
    }
    console.error("Failed to create settings:", error);
    return res.status(500).json(fail("Failed to create settings"));
  }
}

export async function getMySettings(req: Request, res: Response) {
  try {
    const me = (req as any).user as { userId: string; orgId?: string };
    if (!me?.orgId) {
      return res.status(400).json(fail("Organization context is required"));
    }

    const settings = await getSettings(me.userId, me.orgId);
    return res.json(ok(buildSettingsResponse(settings)));
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return res.status(500).json(fail("Failed to fetch settings"));
  }
}

export async function updateMySettings(req: Request, res: Response) {
  try {
    const me = (req as any).user as { userId: string; orgId?: string };
    if (!me?.orgId) {
      return res.status(400).json(fail("Organization context is required"));
    }

    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(fail("Invalid payload: " + parsed.error.message));
    }

    const updated = await updateSettings(me.userId, me.orgId, parsed.data);
    return res.json(ok(buildSettingsResponse(updated)));
  } catch (error) {
    console.error("Failed to update settings:", error);
    return res.status(500).json(fail("Failed to update settings"));
  }
}
