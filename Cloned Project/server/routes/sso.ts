import { Router, Request, Response } from "express";
import crypto from "crypto";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { signJwt, verifyJwt } from "../services/jwt";
import { User } from "../models/user.model";

const router = Router();

// In-memory one-time-use token tracking
const usedTokens = new Map<string, number>(); // jti -> expiry timestamp

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of usedTokens) {
    if (expiry < now) usedTokens.delete(jti);
  }
}, 5 * 60 * 1000);

/**
 * POST /sso/exchange-token
 * Authenticated - Garage frontend calls this to generate a one-time exchange token for iframe SSO
 */
router.post("/exchange-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { targetApp } = req.body;

    if (!targetApp) {
      return res.status(400).json({ error: "targetApp is required" });
    }

    const jti = crypto.randomUUID();

    const exchangeToken = signJwt(
      {
        purpose: "sso_exchange",
        jti,
        targetApp,
        garageUserId: user.userId,
        orgId: user.orgId,
        role: user.role,
      },
      { expiresIn: 60 } // 60 seconds
    );

    // Track for one-time use (store expiry as 5 min from now for cleanup buffer)
    usedTokens.set(jti, Date.now() + 5 * 60 * 1000);

    return res.json({ exchangeToken });
  } catch (error) {
    console.error("[SSO] exchange-token error:", error);
    return res.status(500).json({ error: "Failed to generate exchange token" });
  }
});

/**
 * POST /sso/validate-token
 * Unauthenticated - called by garage-backend server-to-server to validate an exchange token
 */
router.post("/validate-token", async (req: Request, res: Response) => {
  try {
    const { exchangeToken } = req.body;

    if (!exchangeToken) {
      return res.status(400).json({ valid: false, error: "exchangeToken is required" });
    }

    // Verify JWT signature and expiry
    let payload: any;
    try {
      payload = verifyJwt(exchangeToken);
    } catch {
      return res.status(401).json({ valid: false, error: "Invalid or expired token" });
    }

    // Check purpose
    if (payload.purpose !== "sso_exchange") {
      return res.status(401).json({ valid: false, error: "Invalid token purpose" });
    }

    // Enforce one-time use
    if (!usedTokens.has(payload.jti)) {
      return res.status(401).json({ valid: false, error: "Token already used or unknown" });
    }
    usedTokens.delete(payload.jti); // Mark as used

    // Look up user
    const user = await User.findById(payload.garageUserId).select("email name").lean();
    if (!user) {
      return res.status(404).json({ valid: false, error: "User not found" });
    }

    return res.json({
      valid: true,
      user: {
        garageUserId: payload.garageUserId,
        email: user.email,
        name: user.name,
        orgId: payload.orgId,
        role: payload.role,
      },
    });
  } catch (error) {
    console.error("[SSO] validate-token error:", error);
    return res.status(500).json({ valid: false, error: "Validation failed" });
  }
});

/**
 * POST /sso/validate-jwt
 * Unauthenticated - called by garage-backend server-to-server to validate a regular Garage JWT
 * (Used for standalone login flow: Thoughts frontend authenticates via Garage OTP, gets a Garage JWT)
 */
router.post("/validate-jwt", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ valid: false, error: "token is required" });
    }

    // Verify JWT signature and expiry
    let payload: any;
    try {
      payload = verifyJwt(token);
    } catch {
      return res.status(401).json({ valid: false, error: "Invalid or expired token" });
    }

    // Look up user
    const userId = payload.userId;
    if (!userId) {
      return res.status(401).json({ valid: false, error: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("email name").lean();
    if (!user) {
      return res.status(404).json({ valid: false, error: "User not found" });
    }

    return res.json({
      valid: true,
      user: {
        garageUserId: userId,
        email: user.email,
        name: user.name,
        orgId: payload.orgId,
        role: payload.role,
      },
    });
  } catch (error) {
    console.error("[SSO] validate-jwt error:", error);
    return res.status(500).json({ valid: false, error: "Validation failed" });
  }
});

export default router;
