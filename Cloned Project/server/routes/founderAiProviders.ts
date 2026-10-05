import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { AIProviderKeyModel } from "../models/aiProviderKey.model";
import { User } from "../models/user.model";
import { ok, fail } from "../utils/http";
import { z } from "zod";
import crypto from "crypto";
import { Types } from "mongoose";

const router = Router();

// Encryption for API keys
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || "default-encryption-key-change-in-prod";

function encrypt(text: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  const algorithm = "aes-256-cbc";
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 4) + "*".repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

// Check if user is a founder for the given org
async function isFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user) return false;

  return user.organizations?.some(
    (org: any) => org.organization.toString() === orgId && hasFounderAccess(org)
  ) || false;
}

// Check if user is a member (founder or stakeholder) of the org
async function isMember(userId: string, orgId: string): Promise<{ isMember: boolean; role: string | null; fullAccess?: boolean }> {
  const user = await User.findById(userId).lean();
  if (!user) return { isMember: false, role: null };

  const membership = user.organizations?.find(
    (org: any) => org.organization.toString() === orgId
  );

  if (!membership) return { isMember: false, role: null };
  return { isMember: true, role: membership.role, fullAccess: (membership as any).fullAccess };
}

const saveKeySchema = z.object({
  providerId: z.enum(["openai", "anthropic", "replicate", "google-gemini", "garage-copilot"]),
  apiKey: z.string().min(1),
});

/**
 * Get AI provider status for the organization
 * GET /founder-ai-providers/keys?orgId=xxx
 *
 * Returns different data based on user role:
 * - Founders: Get full key details (masked)
 * - Stakeholders: Get only whether keys are available (no key details)
 */
router.get("/keys", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json(fail("Organization ID is required"));
    }

    // Check if user is a member of the organization
    const memberCheck = await isMember(me.userId, orgId);
    if (!memberCheck.isMember) {
      return res.status(403).json(fail("You are not a member of this organization"));
    }

    const keys = await AIProviderKeyModel.find({
      organizationId: orgId,
      isActive: true,
    })
      .select("providerId maskedKey createdAt updatedAt")
      .lean();

    const isUserFounder = hasFounderAccess(memberCheck);

    // For founders: return full key details (masked)
    // For stakeholders: return only whether keys are available
    if (isUserFounder) {
      return res.json(
        ok({
          role: "founder",
          keys: keys.map((k) => ({
            providerId: k.providerId,
            maskedKey: k.maskedKey,
            createdAt: k.createdAt,
          })),
        })
      );
    } else {
      // Stakeholder: return only provider IDs (no key details)
      return res.json(
        ok({
          role: "stakeholder",
          hasKeys: keys.length > 0,
          availableProviders: keys.map((k) => k.providerId),
          keys: keys.map((k) => ({
            providerId: k.providerId,
            maskedKey: "****", // Don't show masked key to stakeholders
            createdAt: k.createdAt,
          })),
        })
      );
    }
  } catch (error) {
    console.error("Failed to fetch AI provider keys:", error);
    return res.status(500).json(fail("Failed to fetch API keys"));
  }
});

/**
 * Save or update an API key for a provider
 * POST /founder-ai-providers/keys?orgId=xxx
 */
router.post("/keys", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json(fail("Organization ID is required"));
    }

    // Check if user is a founder
    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json(fail("Only founders can manage AI provider keys"));
    }

    const parsed = saveKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(fail("Invalid input: " + parsed.error.message));
    }

    const { providerId, apiKey } = parsed.data;

    const encryptedKey = encrypt(apiKey);
    const maskedKey = maskApiKey(apiKey);

    // Upsert - update if exists, create if not
    const result = await AIProviderKeyModel.findOneAndUpdate(
      { providerId, organizationId: orgId },
      {
        $set: {
          encryptedKey,
          maskedKey,
          updatedBy: new Types.ObjectId(me.userId),
          isActive: true,
        },
        $setOnInsert: {
          providerId,
          organizationId: orgId,
          createdBy: new Types.ObjectId(me.userId),
        },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json(
      ok({
        providerId: result.providerId,
        maskedKey: result.maskedKey,
        message: "API key saved successfully",
      })
    );
  } catch (error) {
    console.error("Failed to save AI provider key:", error);
    return res.status(500).json(fail("Failed to save API key"));
  }
});

/**
 * Delete an API key for a provider
 * DELETE /founder-ai-providers/keys/:providerId?orgId=xxx
 */
router.delete("/keys/:providerId", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };
    const { providerId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json(fail("Organization ID is required"));
    }

    // Check if user is a founder
    if (!(await isFounder(me.userId, orgId))) {
      return res.status(403).json(fail("Only founders can manage AI provider keys"));
    }

    const result = await AIProviderKeyModel.findOneAndDelete({
      providerId,
      organizationId: orgId,
    });

    if (!result) {
      return res.status(404).json(fail("API key not found"));
    }

    return res.json(ok({ message: "API key deleted successfully" }));
  } catch (error) {
    console.error("Failed to delete AI provider key:", error);
    return res.status(500).json(fail("Failed to delete API key"));
  }
});

/**
 * Get a decrypted API key (internal use only)
 * This is exported for use by other services (like Betty)
 */
export async function getOrgApiKey(
  providerId: string,
  organizationId: string
): Promise<string | null> {
  try {
    const key = await AIProviderKeyModel.findOne({
      providerId,
      organizationId,
      isActive: true,
    }).lean();

    if (!key) return null;

    return decrypt(key.encryptedKey);
  } catch (error) {
    console.error("Failed to decrypt API key:", error);
    return null;
  }
}

export default router;
