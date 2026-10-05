// src/routes/socialOAuth.ts
// OAuth flows for social media platforms — YouTube and Instagram.
//
// GET  /social-oauth/:platform/authorize   → Redirect user to platform OAuth
// GET  /social-oauth/:platform/callback    → Handle OAuth callback, store tokens
// POST /social-oauth/:platform/disconnect  → Revoke and remove tokens

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { SocialAccount } from "../models/socialAccount.model";
import { extractUsername } from "../services/viewTracking";

const router = Router();

// ── Config helpers ──────────────────────────────────────────────────

function getConfig(platform: string) {
  switch (platform) {
    case "instagram":
      return {
        clientKey: process.env.META_APP_ID || "",
        clientSecret: process.env.META_APP_SECRET || "",
        authorizeUrl: "https://www.facebook.com/v22.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v22.0/oauth/access_token",
        scope: "instagram_business_basic,instagram_business_manage_insights",
        redirectPath: "/social-oauth/instagram/callback",
      };
    case "youtube":
      return {
        clientKey: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/youtube.readonly",
        redirectPath: "/social-oauth/youtube/callback",
      };
    default:
      return null;
  }
}

function getRedirectUri(platform: string): string {
  const base = process.env.OAUTH_REDIRECT_BASE || "http://localhost:5005";
  const config = getConfig(platform);
  return config ? `${base}${config.redirectPath}` : "";
}

// ═══════════════════════════════════════════════════════════════════
// GET /social-oauth/:platform/authorize
// Generates the OAuth URL and redirects the user to the platform.
// The userId is passed via the state parameter.
// ═══════════════════════════════════════════════════════════════════

router.get("/:platform/authorize", requireAuth, async (req: Request, res: Response) => {
  const { platform } = req.params;
  const config = getConfig(platform);
  if (!config || !config.clientKey) {
    return res.status(400).json({ error: `OAuth not configured for ${platform}` });
  }

  const me = (req as any).user as { userId: string };

  // State includes userId + random nonce (prevents CSRF)
  const state = Buffer.from(
    JSON.stringify({ userId: me.userId, nonce: crypto.randomBytes(8).toString("hex") })
  ).toString("base64url");

  const redirectUri = getRedirectUri(platform);

  let authUrl: string;

  switch (platform) {
    case "instagram":
      authUrl =
        `${config.authorizeUrl}?client_id=${config.clientKey}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(config.scope)}` +
        `&response_type=code&state=${state}`;
      break;

    case "youtube":
      authUrl =
        `${config.authorizeUrl}?client_id=${config.clientKey}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(config.scope)}` +
        `&response_type=code&access_type=offline&prompt=consent` +
        `&state=${state}`;
      break;

    default:
      return res.status(400).json({ error: `Unsupported platform: ${platform}` });
  }

  // Return the URL instead of redirecting (frontend opens in popup)
  return res.json({ success: true, authUrl });
});

// ═══════════════════════════════════════════════════════════════════
// GET /social-oauth/:platform/callback
// Handles the OAuth callback — exchanges code for tokens, stores them.
// ═══════════════════════════════════════════════════════════════════

router.get("/:platform/callback", async (req: Request, res: Response) => {
  const { platform } = req.params;
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.send(callbackHTML("error", `OAuth denied: ${oauthError}`));
  }

  if (!code || !state) {
    return res.send(callbackHTML("error", "Missing code or state parameter"));
  }

  const config = getConfig(platform);
  if (!config) {
    return res.send(callbackHTML("error", `Unsupported platform: ${platform}`));
  }

  // Decode state to get userId
  let userId: string;
  try {
    const parsed = JSON.parse(Buffer.from(state as string, "base64url").toString());
    userId = parsed.userId;
  } catch {
    return res.send(callbackHTML("error", "Invalid state parameter"));
  }

  const redirectUri = getRedirectUri(platform);

  try {
    // Exchange code for tokens
    let tokenData: any;

    if (platform === "instagram") {
      // Step 1: Exchange code for short-lived token
      const resp = await fetch(config.tokenUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      // Use GET with query params for FB Graph
      const tokenUrl = `${config.tokenUrl}?client_id=${config.clientKey}&client_secret=${config.clientSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      const tokenResp = await fetch(tokenUrl);
      tokenData = await tokenResp.json();

      // Step 2: Exchange for long-lived token
      if (tokenData.access_token) {
        const longUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.clientKey}&client_secret=${config.clientSecret}&fb_exchange_token=${tokenData.access_token}`;
        const longResp = await fetch(longUrl);
        const longData = await longResp.json();
        if (longData.access_token) {
          tokenData.access_token = longData.access_token;
          tokenData.expires_in = longData.expires_in || 5184000; // 60 days default
        }
      }

    } else if (platform === "youtube") {
      const resp = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientKey,
          client_secret: config.clientSecret,
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      tokenData = await resp.json();
    }

    if (!tokenData?.access_token) {
      console.error(`[SocialOAuth] Token exchange failed for ${platform}:`, tokenData);
      return res.send(callbackHTML("error", "Failed to get access token from platform"));
    }

    // Get platform user info
    let platformUserId = "";
    let username = "";
    let profileUrl = "";

    if (platform === "instagram") {
      // Get Instagram Business account via FB user → pages → IG
      const meResp = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?access_token=${tokenData.access_token}`
      );
      const meData = await meResp.json();
      const page = meData?.data?.[0];
      if (page) {
        const igResp = await fetch(
          `https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account&access_token=${tokenData.access_token}`
        );
        const igData = await igResp.json();
        const igId = igData?.instagram_business_account?.id;
        if (igId) {
          platformUserId = igId;
          const igUserResp = await fetch(
            `https://graph.instagram.com/v22.0/${igId}?fields=username&access_token=${tokenData.access_token}`
          );
          const igUserData = await igUserResp.json();
          username = igUserData?.username || "";
          profileUrl = username ? `https://www.instagram.com/${username}` : "";
        }
      }

    } else if (platform === "youtube") {
      // Get YouTube channel info
      const channelResp = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const channelData = await channelResp.json();
      const channel = channelData?.items?.[0];
      if (channel) {
        platformUserId = channel.id;
        username = channel.snippet?.title || channel.snippet?.customUrl || "";
        profileUrl = `https://www.youtube.com/channel/${channel.id}`;
      }
    }

    // Calculate token expiry
    const expiresIn = tokenData.expires_in || 86400; // Default 24h
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Upsert social account
    await SocialAccount.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        platform,
      },
      {
        $set: {
          profileUrl: profileUrl || `https://${platform}.com`,
          username: username || platformUserId,
          oauthConnected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          tokenExpiresAt,
          platformUserId,
          isVerified: true,
          verifiedAt: new Date(),
        },
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          platform,
          verificationCode: "",
        },
      },
      { upsert: true, new: true }
    );

    console.log(`[SocialOAuth] ✅ ${platform} connected for user ${userId} (@${username})`);
    return res.send(callbackHTML("success", `${platform} connected successfully!`));

  } catch (err: any) {
    console.error(`[SocialOAuth] Error in ${platform} callback:`, err);
    return res.send(callbackHTML("error", `Connection failed: ${err.message}`));
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /social-oauth/:platform/disconnect
// Remove OAuth tokens for a platform.
// ═══════════════════════════════════════════════════════════════════

router.post("/:platform/disconnect", requireAuth, async (req: Request, res: Response) => {
  const { platform } = req.params;
  const me = (req as any).user as { userId: string };

  try {
    await SocialAccount.findOneAndUpdate(
      { userId: new Types.ObjectId(me.userId), platform },
      {
        $set: {
          oauthConnected: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          platformUserId: null,
        },
      }
    );
    return res.json({ success: true, message: `${platform} disconnected` });
  } catch (err) {
    console.error(`Error disconnecting ${platform}:`, err);
    return res.status(500).json({ error: "Failed to disconnect" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /social-oauth/:platform/refresh
// Refresh an expired access token.
// ═══════════════════════════════════════════════════════════════════

router.post("/:platform/refresh", requireAuth, async (req: Request, res: Response) => {
  const { platform } = req.params;
  const me = (req as any).user as { userId: string };

  const account = await SocialAccount.findOne({
    userId: new Types.ObjectId(me.userId),
    platform,
    oauthConnected: true,
  });

  if (!account || !account.refreshToken) {
    return res.status(400).json({ error: "No refresh token available. Please reconnect." });
  }

  const config = getConfig(platform);
  if (!config) {
    return res.status(400).json({ error: `Unsupported platform: ${platform}` });
  }

  try {
    let tokenData: any;

    if (platform === "youtube") {
      const resp = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientKey,
          client_secret: config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
        }),
      });
      tokenData = await resp.json();
    }

    if (tokenData?.access_token) {
      account.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) account.refreshToken = tokenData.refresh_token;
      account.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);
      await account.save();

      return res.json({ success: true, message: "Token refreshed" });
    }

    return res.status(400).json({ error: "Token refresh failed. Please reconnect." });
  } catch (err: any) {
    console.error(`Error refreshing ${platform} token:`, err);
    return res.status(500).json({ error: "Token refresh failed" });
  }
});

// ── Callback HTML helper (closes popup, notifies parent window) ──

function callbackHTML(status: "success" | "error", message: string): string {
  return `<!DOCTYPE html><html><body>
    <p>${message}</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "social-oauth-callback", status: "${status}", message: "${message}" }, "*");
        setTimeout(() => window.close(), 1500);
      }
    </script>
  </body></html>`;
}

export default router;
