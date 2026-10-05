import { Response } from "express";
import { AIProviderKeyModel } from "../models/aiProviderKey.model";
import { GarageAdminRequest } from "../middleware/garageAdminAuth";
import { ok, fail } from "../utils/http";
import { z } from "zod";
import crypto from "crypto";

// Simple encryption for API keys (in production, use a proper key management service)
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

const saveKeySchema = z.object({
  providerId: z.enum(["openai", "anthropic", "replicate", "google-gemini", "garage-copilot"]),
  apiKey: z.string().min(1),
  orgId: z.string().optional(),
});

/**
 * Get all API keys for an organization
 * GET /ai-providers/keys?orgId=xxx
 */
export async function getAIProviderKeys(req: GarageAdminRequest, res: Response) {
  try {
    const orgId = req.query.orgId as string || "global";

    const keys = await AIProviderKeyModel.find({
      organizationId: orgId,
      isActive: true,
    })
      .select("providerId maskedKey createdAt updatedAt")
      .lean();

    return res.json(
      ok({
        keys: keys.map((k) => ({
          providerId: k.providerId,
          maskedKey: k.maskedKey,
          createdAt: k.createdAt,
        })),
      })
    );
  } catch (error) {
    console.error("Failed to fetch AI provider keys:", error);
    return res.status(500).json(fail("Failed to fetch API keys"));
  }
}

/**
 * Save or update an API key for a provider
 * POST /ai-providers/keys
 */
export async function saveAIProviderKey(req: GarageAdminRequest, res: Response) {
  try {
    const parsed = saveKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(fail("Invalid input: " + parsed.error.message));
    }

    const { providerId, apiKey, orgId } = parsed.data;
    const organizationId = orgId || "global";
    const adminId = req.garageAdmin!.id;

    const encryptedKey = encrypt(apiKey);
    const maskedKey = maskApiKey(apiKey);

    // Upsert - update if exists, create if not
    const result = await AIProviderKeyModel.findOneAndUpdate(
      { providerId, organizationId },
      {
        $set: {
          encryptedKey,
          maskedKey,
          updatedBy: adminId,
          isActive: true,
        },
        $setOnInsert: {
          providerId,
          organizationId,
          createdBy: adminId,
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
}

/**
 * Delete an API key for a provider
 * DELETE /ai-providers/keys/:providerId?orgId=xxx
 */
export async function deleteAIProviderKey(req: GarageAdminRequest, res: Response) {
  try {
    const { providerId } = req.params;
    const orgId = req.query.orgId as string || "global";

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
}

/**
 * Get a decrypted API key (internal use only - for making API calls)
 * This should only be called server-side, never exposed to clients
 */
export async function getDecryptedKey(
  providerId: string,
  organizationId: string = "global"
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
