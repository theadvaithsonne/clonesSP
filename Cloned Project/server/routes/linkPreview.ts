// src/routes/linkPreview.ts
// Fetch Open Graph / oEmbed metadata for a URL (used for submission previews).

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { requireUserOrGarageAdmin } from "../middleware/userOrGarageAdmin";
import { SocialAccount } from "../models/socialAccount.model";
import {
  extractPlatformPostId,
  fetchYouTubeVideoChannelId,
  resolveYouTubeChannelId,
} from "../services/viewTracking";

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// GET /link-preview/youtube-channel-check?videoUrl=...
// Auth required — verify that a YouTube video belongs to the user's
// verified YouTube channel.
// ═══════════════════════════════════════════════════════════════════

router.get("/youtube-channel-check", requireAuth, async (req: Request, res: Response) => {
  const videoUrl = req.query.videoUrl as string;
  if (!videoUrl) return res.status(400).json({ error: "videoUrl query param required" });

  const me = (req as any).user as { userId: string };

  try {
    // 1. Extract video ID
    const videoId = extractPlatformPostId(videoUrl, "youtube");
    if (!videoId) {
      return res.status(400).json({ error: "Could not extract YouTube video ID from URL" });
    }

    // 2. Fetch video's channel ID from YouTube API
    const videoResult = await fetchYouTubeVideoChannelId(videoId);
    if (!videoResult.success) {
      return res.json({
        success: false,
        matched: false,
        error: videoResult.error || "Could not fetch video info from YouTube",
      });
    }

    // 3. Look up user's verified YouTube social account
    const socialAccount = await SocialAccount.findOne({
      userId: new Types.ObjectId(me.userId),
      platform: "youtube",
      $or: [{ isVerified: true }, { oauthConnected: true }],
    });

    if (!socialAccount) {
      return res.json({
        success: true,
        matched: false,
        videoChannelId: videoResult.channelId,
        videoChannelTitle: videoResult.channelTitle,
        error: "No verified YouTube account found. Connect and verify your YouTube channel first.",
      });
    }

    // 4. Resolve user's channel ID
    let userChannelId = socialAccount.platformUserId || "";

    if (!userChannelId) {
      // Bio-verified account — resolve via YouTube API
      const resolveResult = await resolveYouTubeChannelId(
        socialAccount.profileUrl || socialAccount.username
      );
      if (resolveResult.success) {
        userChannelId = resolveResult.channelId;
        // Cache it for future lookups
        socialAccount.platformUserId = userChannelId;
        await socialAccount.save();
      }
    }

    if (!userChannelId) {
      return res.json({
        success: true,
        matched: false,
        videoChannelId: videoResult.channelId,
        videoChannelTitle: videoResult.channelTitle,
        error: "Could not resolve your YouTube channel ID. Try reconnecting your account.",
      });
    }

    // 5. Compare
    const matched = videoResult.channelId === userChannelId;

    return res.json({
      success: true,
      matched,
      videoChannelId: videoResult.channelId,
      videoChannelTitle: videoResult.channelTitle,
      userChannelId,
      username: socialAccount.username,
      ...(!matched ? { error: `This video belongs to a different channel. Your verified channel: @${socialAccount.username}` } : {}),
    });
  } catch (err: any) {
    console.error("[LinkPreview] YouTube channel check error:", err.message);
    return res.status(500).json({ error: "Failed to verify video ownership" });
  }
});

// Admins (support chats console) preview links too; the handler reads no user.
router.get("/", requireUserOrGarageAdmin, async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "url query param required" });

  try {
    // 1. Try oEmbed for known platforms
    let oembed: any = null;
    if (/youtu\.?be/i.test(url)) {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) oembed = await r.json();
    } else if (/tiktok\.com/i.test(url)) {
      const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) oembed = await r.json();
    }

    if (oembed) {
      return res.json({
        success: true,
        meta: {
          title: oembed.title || "",
          author: oembed.author_name || "",
          authorUrl: oembed.author_url || "",
          thumbnail: oembed.thumbnail_url || "",
          thumbnailWidth: oembed.thumbnail_width || 0,
          thumbnailHeight: oembed.thumbnail_height || 0,
          provider: oembed.provider_name || "",
        },
      });
    }

    // 2. Fallback: scrape OG tags from HTML
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GarageBot/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });

    if (!resp.ok) {
      return res.json({ success: true, meta: { title: url, thumbnail: "" } });
    }

    const html = await resp.text();
    const og = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
      return m ? m[1] : "";
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return res.json({
      success: true,
      meta: {
        title: og("title") || (titleMatch ? titleMatch[1].trim() : ""),
        description: og("description") || "",
        thumbnail: og("image") || "",
        author: og("site_name") || "",
        provider: "",
      },
    });
  } catch (err: any) {
    console.error("[LinkPreview] Error:", err.message);
    return res.json({ success: true, meta: { title: url, thumbnail: "" } });
  }
});

export default router;
