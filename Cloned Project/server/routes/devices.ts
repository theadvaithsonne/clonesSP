// src/routes/devices.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { DeviceToken } from "../models/deviceToken.model";
import { VoIPToken } from "../models/voipToken.model";
import { FCMToken } from "../models/fcmToken.model";
import {
  broadcastMobileUserJoined,
  broadcastUserGoneIfUnreachable,
} from "../services/socket";

const router = Router();

// Register or update push token
router.post("/push-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string().min(1, "Push token is required"),
      platform: z.enum(["ios", "android", "web"]),
      deviceId: z.string().optional(),
      appVersion: z.string().optional(),
      // Registering app. Omitted by garage-chat builds (legacy default);
      // NetworkChains sends "networkchain" so chat pushes skip its tokens
      // while wallet money pushes still reach it.
      app: z.enum(["garage-chat", "networkchain"]).optional(),
      // Push features the build supports — see DeviceToken.features.
      features: z.array(z.string().max(40)).max(10).optional(),
    });

    const { token, platform, deviceId, appVersion, app, features } =
      schema.parse(req.body);
    const userId = (req as AuthRequest).user.userId;

    // Upsert: update if token exists, create if not
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        ...(app ? { app } : {}),
        // Always written, never merged: an install that stops sending a
        // feature (its JS rolled back to an update that predates it) must stop
        // getting pushes shaped for it, or it would receive data-only chat
        // pushes it cannot display.
        features: features ?? [],
        isActive: true,
        lastUsedAt: new Date(),
        failedAttempts: 0,
        lastFailedAt: null,
      },
      { upsert: true, new: true }
    );

    console.log(`[PUSH] Registered token for user ${userId} (${platform})`);

    res.json({
      success: true,
      tokenId: deviceToken._id,
      message: "Push token registered successfully",
    });

    // Announce the user as reachable on mobile so the web online list shows
    // their Mobile card. Skipped automatically if they already have a live
    // socket. Only fires for ios/android — web push tokens shouldn't trigger
    // the "Mobile" status. NetworkChains tokens don't count either: the
    // Mobile card means "knockable/callable in garage-chat", and chat pushes
    // never target networkchain tokens.
    if ((platform === "ios" || platform === "android") && app !== "networkchain") {
      broadcastMobileUserJoined(userId).catch(() => {});
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("[PUSH] Error registering token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate specific push token (logout from specific device)
router.delete(
  "/push-token",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        token: z.string().min(1, "Push token is required"),
      });

      const { token } = schema.parse(req.body);
      const userId = (req as AuthRequest).user.userId;

      await DeviceToken.findOneAndUpdate({ token, userId }, { isActive: false });

      console.log(`[PUSH] Deactivated token for user ${userId}`);

      res.json({ success: true, message: "Push token deactivated" });

      // If this was their last mobile token and they have no live socket,
      // remove their Mobile card from the workspace list.
      broadcastUserGoneIfUnreachable(userId).catch(() => {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.issues });
      }
      console.error("[PUSH] Error deactivating token:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Deactivate ALL tokens for user (full logout from all devices)
router.delete(
  "/push-tokens/all",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user.userId;

      const result = await DeviceToken.updateMany(
        { userId },
        { isActive: false }
      );

      console.log(
        `[PUSH] Deactivated ${result.modifiedCount} tokens for user ${userId}`
      );

      res.json({
        success: true,
        deactivatedCount: result.modifiedCount,
      });

      broadcastUserGoneIfUnreachable(userId).catch(() => {});
    } catch (error) {
      console.error("[PUSH] Error deactivating tokens:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ============================================
// VoIP Token Routes (iOS CallKit)
// ============================================

// Register or update VoIP token (iOS only)
router.post("/voip-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string().min(1, "VoIP token is required"),
      platform: z.literal("ios").optional().default("ios"),
      deviceId: z.string().optional(),
      appVersion: z.string().optional(),
      // Omitted by garage-chat builds; NetworkChains sends "networkchain" so
      // its calls ring on its own bundle's VoIP topic.
      app: z.enum(["garage-chat", "networkchain"]).optional(),
    });

    const { token, platform, deviceId, appVersion, app } = schema.parse(req.body);
    const userId = (req as AuthRequest).user.userId;

    // Validate VoIP token format (should be hex string)
    if (!/^[a-fA-F0-9]+$/.test(token)) {
      return res.status(400).json({
        error: "Invalid VoIP token format",
        message: "VoIP token must be a hexadecimal string",
      });
    }

    // Upsert: update if token exists, create if not
    const voipToken = await VoIPToken.findOneAndUpdate(
      { token },
      {
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        app,
        isActive: true,
        lastUsedAt: new Date(),
        failedAttempts: 0,
        lastFailedAt: null,
      },
      { upsert: true, new: true }
    );

    console.log(`[VOIP] Registered VoIP token for user ${userId}`);

    res.json({
      success: true,
      tokenId: voipToken._id,
      message: "VoIP token registered successfully",
    });

    // VoIP tokens are iOS-only, so this is always a mobile device.
    broadcastMobileUserJoined(userId).catch(() => {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("[VOIP] Error registering VoIP token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate VoIP token
router.delete(
  "/voip-token",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        token: z.string().min(1, "VoIP token is required"),
      });

      const { token } = schema.parse(req.body);
      const userId = (req as AuthRequest).user.userId;

      await VoIPToken.findOneAndUpdate({ token, userId }, { isActive: false });

      console.log(`[VOIP] Deactivated VoIP token for user ${userId}`);

      res.json({ success: true, message: "VoIP token deactivated" });

      broadcastUserGoneIfUnreachable(userId).catch(() => {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.issues });
      }
      console.error("[VOIP] Error deactivating VoIP token:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Deactivate ALL VoIP tokens for user
router.delete(
  "/voip-tokens/all",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user.userId;

      const result = await VoIPToken.updateMany(
        { userId },
        { isActive: false }
      );

      console.log(
        `[VOIP] Deactivated ${result.modifiedCount} VoIP tokens for user ${userId}`
      );

      res.json({
        success: true,
        deactivatedCount: result.modifiedCount,
      });

      broadcastUserGoneIfUnreachable(userId).catch(() => {});
    } catch (error) {
      console.error("[VOIP] Error deactivating VoIP tokens:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ============================================
// FCM Token Routes (Android direct FCM for knocks)
// ============================================

// Register or update FCM device token (Android only)
router.post("/fcm-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string().min(1, "FCM token is required"),
      platform: z.literal("android").optional().default("android"),
      deviceId: z.string().optional(),
      appVersion: z.string().optional(),
    });

    const { token, platform, deviceId, appVersion } = schema.parse(req.body);
    const userId = (req as AuthRequest).user.userId;

    const fcmToken = await FCMToken.findOneAndUpdate(
      { token },
      {
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
        failedAttempts: 0,
        lastFailedAt: null,
      },
      { upsert: true, new: true }
    );

    console.log(`[FCM] Registered FCM token for user ${userId} (${platform})`);

    res.json({
      success: true,
      tokenId: fcmToken._id,
      message: "FCM token registered successfully",
    });

    // FCM tokens come from Android devices, so this is always a mobile-reachable
    // user — announce the Mobile card.
    broadcastMobileUserJoined(userId).catch(() => {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation error", details: error.issues });
    }
    console.error("[FCM] Error registering FCM token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Deactivate FCM token
router.delete(
  "/fcm-token",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        token: z.string().min(1, "FCM token is required"),
      });

      const { token } = schema.parse(req.body);
      const userId = (req as AuthRequest).user.userId;

      await FCMToken.findOneAndUpdate({ token, userId }, { isActive: false });

      console.log(`[FCM] Deactivated FCM token for user ${userId}`);

      res.json({ success: true, message: "FCM token deactivated" });

      broadcastUserGoneIfUnreachable(userId).catch(() => {});
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation error", details: error.issues });
      }
      console.error("[FCM] Error deactivating FCM token:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Deactivate ALL FCM tokens for user
router.delete(
  "/fcm-tokens/all",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user.userId;

      const result = await FCMToken.updateMany(
        { userId },
        { isActive: false }
      );

      console.log(
        `[FCM] Deactivated ${result.modifiedCount} FCM tokens for user ${userId}`
      );

      res.json({ success: true, deactivatedCount: result.modifiedCount });

      broadcastUserGoneIfUnreachable(userId).catch(() => {});
    } catch (error) {
      console.error("[FCM] Error deactivating FCM tokens:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
