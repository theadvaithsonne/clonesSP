// src/routes/socialAccount.ts
// Social media account management — affiliates connect & verify their social accounts.
//
// POST   /social-accounts/connect        → Add a social account (generates verification code)
// POST   /social-accounts/:id/verify     → Trigger bio-code verification
// GET    /social-accounts                → List user's connected accounts
// DELETE /social-accounts/:id            → Remove a connected account

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { SocialAccount } from "../models/socialAccount.model";
import { SOCIAL_PLATFORMS } from "../models/contentCampaign.model";
import {
  extractUsername,
  generateVerificationCode,
  verifyBioCode,
} from "../services/viewTracking";

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// POST /social-accounts/connect
// Add a new social media account. Generates a verification code
// that the user must put in their bio.
// ═══════════════════════════════════════════════════════════════════

const ConnectSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  profileUrl: z.string().url().min(10),
});

router.post("/connect", requireAuth, async (req: Request, res: Response) => {
  const parsed = ConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid data",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const me = (req as any).user as { userId: string };
  const { platform, profileUrl } = parsed.data;

  // Currently only YouTube is supported — other platforms coming soon
  const lockedPlatforms = ["instagram", "tiktok", "twitter"];
  if (lockedPlatforms.includes(platform)) {
    return res.status(400).json({
      error: `${platform.charAt(0).toUpperCase() + platform.slice(1)} is coming soon. Only YouTube is available for now.`,
    });
  }

  // Extract username from URL
  const username = extractUsername(profileUrl, platform);
  if (!username) {
    return res.status(400).json({
      error: "Could not extract username from the profile URL. Make sure you're using a valid profile link.",
    });
  }

  try {
    // Check if already connected
    const existing = await SocialAccount.findOne({
      userId: new Types.ObjectId(me.userId),
      platform,
    });

    if (existing) {
      // If already verified, don't allow re-connect
      if (existing.isVerified) {
        return res.status(400).json({
          error: `You already have a verified ${platform} account connected. Remove it first to connect a different one.`,
          existingAccount: {
            id: existing._id,
            username: existing.username,
            isVerified: true,
          },
        });
      }

      // Update the existing unverified entry with new URL/code
      const code = generateVerificationCode();
      existing.profileUrl = profileUrl;
      existing.username = username;
      existing.verificationCode = code;
      await existing.save();

      return res.json({
        success: true,
        account: {
          id: existing._id,
          platform,
          username,
          profileUrl,
          verificationCode: code,
          isVerified: false,
        },
        instructions: `Add this code to your ${platform} bio: ${code}\nThen click verify.`,
      });
    }

    // Create new social account
    const code = generateVerificationCode();
    const account = await SocialAccount.create({
      userId: new Types.ObjectId(me.userId),
      platform,
      profileUrl,
      username,
      verificationCode: code,
      isVerified: false,
    });

    return res.status(201).json({
      success: true,
      account: {
        id: account._id,
        platform,
        username,
        profileUrl,
        verificationCode: code,
        isVerified: false,
      },
      instructions: `Add this code to your ${platform} bio: ${code}\nThen click verify.`,
    });
  } catch (err: any) {
    // Handle duplicate key race condition
    if (err.code === 11000) {
      return res.status(400).json({
        error: `You already have a ${platform} account connected.`,
      });
    }
    console.error("Error connecting social account:", err);
    return res.status(500).json({ error: "Failed to connect social account" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /social-accounts/:id/verify
// Trigger verification — checks the user's social media bio for the code.
// ═══════════════════════════════════════════════════════════════════

router.post("/:id/verify", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid account ID" });
  }

  const me = (req as any).user as { userId: string };

  try {
    const account = await SocialAccount.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(me.userId),
    });

    if (!account) {
      return res.status(404).json({ error: "Social account not found" });
    }

    if (account.isVerified) {
      return res.json({
        success: true,
        message: "Account is already verified",
        account: {
          id: account._id,
          platform: account.platform,
          username: account.username,
          isVerified: true,
          verifiedAt: account.verifiedAt,
        },
      });
    }

    // Attempt bio verification
    const result = await verifyBioCode(
      account.profileUrl,
      account.platform,
      account.verificationCode
    );

    if (result.verified) {
      account.isVerified = true;
      account.verifiedAt = new Date();
      await account.save();

      return res.json({
        success: true,
        message: "Account verified successfully! You can now remove the code from your bio.",
        account: {
          id: account._id,
          platform: account.platform,
          username: account.username,
          isVerified: true,
          verifiedAt: account.verifiedAt,
        },
      });
    }

    return res.json({
      success: false,
      error: result.error || "Verification failed. Make sure the code is in your bio and try again.",
      verificationCode: account.verificationCode,
    });
  } catch (err) {
    console.error("Error verifying social account:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /social-accounts/:id/manual-verify
// DISABLED — self-verification is no longer allowed.
// Users must verify via the bio code check.
// ═══════════════════════════════════════════════════════════════════

router.post("/:id/manual-verify", requireAuth, async (_req: Request, res: Response) => {
  return res.status(403).json({
    error: "Manual self-verification is no longer available. Please add the verification code to your bio and use the 'Verify Bio' button.",
  });
});

// ═══════════════════════════════════════════════════════════════════
// GET /social-accounts
// List user's connected social accounts.
// ═══════════════════════════════════════════════════════════════════

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const me = (req as any).user as { userId: string };

  try {
    const accounts = await SocialAccount.find({
      userId: new Types.ObjectId(me.userId),
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      accounts: accounts.map((a) => ({
        id: a._id,
        platform: a.platform,
        username: a.username,
        profileUrl: a.profileUrl,
        isVerified: a.isVerified,
        verifiedAt: a.verifiedAt,
        verificationCode: a.isVerified ? undefined : a.verificationCode,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("Error fetching social accounts:", err);
    return res.status(500).json({ error: "Failed to fetch social accounts" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// DELETE /social-accounts/:id
// Remove a connected social account.
// ═══════════════════════════════════════════════════════════════════

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid account ID" });
  }

  const me = (req as any).user as { userId: string };

  try {
    const result = await SocialAccount.findOneAndDelete({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(me.userId),
    });

    if (!result) {
      return res.status(404).json({ error: "Social account not found" });
    }

    return res.json({ success: true, message: "Social account removed" });
  } catch (err) {
    console.error("Error removing social account:", err);
    return res.status(500).json({ error: "Failed to remove social account" });
  }
});

export default router;
