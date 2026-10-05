// src/services/viewTracking.ts
// View tracking service for Content Rewards.
// Uses YouTube Data API v3 for view counts. Instagram support coming soon.
// All scraping and TikTok/Twitter code has been removed.

/**
 * Platform-specific URL parsing utilities
 */

// ── Instagram ───────────────────────────────────────────────────────
// URL formats:
//   https://www.instagram.com/reel/ABC123/
//   https://www.instagram.com/p/ABC123/

function extractInstagramId(url: string): string | null {
  const m = url.match(/instagram\.com\/(reel|p)\/([\w-]+)/);
  return m ? m[2] : null;
}

// ── YouTube ─────────────────────────────────────────────────────────
// URL formats:
//   https://www.youtube.com/watch?v=abc123
//   https://youtu.be/abc123
//   https://www.youtube.com/shorts/abc123

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Detect platform from a post URL
 */
export function detectPlatform(url: string): string | null {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtu\.?be/i.test(url)) return "youtube";
  return null;
}

/**
 * Extract username from a social media profile URL
 */
export function extractUsername(url: string, platform: string): string {
  switch (platform) {
    case "instagram": {
      const m = url.match(/instagram\.com\/([\w.-]+)/);
      return m ? m[1] : "";
    }
    case "youtube": {
      // Handle @username, /c/channel, /channel/id
      const m = url.match(/youtube\.com\/(?:@|c\/|channel\/)([\w.-]+)/);
      return m ? m[1] : "";
    }
    default:
      return "";
  }
}

/**
 * Validate that a post URL belongs to the correct platform
 */
export function validatePostUrl(url: string, platform: string): boolean {
  const detected = detectPlatform(url);
  return detected === platform;
}

/**
 * Extract the username from a content post URL.
 * Used to verify that a submitted post belongs to the user's verified account.
 * Returns empty string if username can't be extracted (e.g. YouTube video URLs).
 */
export function extractUsernameFromPostUrl(url: string, platform: string): string {
  switch (platform) {
    case "instagram": {
      // Instagram post URLs (instagram.com/p/xxx, /reel/xxx) don't include username
      // We can't extract from post URLs — skip validation for IG
      return "";
    }
    case "youtube":
      // YouTube video URLs don't contain channel names — skip validation
      return "";
    default:
      return "";
  }
}

/**
 * Generate a random verification code for social account bio verification
 */
export function generateVerificationCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "garage_vfy_";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Verify that a social media profile bio contains the verification code.
 * Currently only YouTube is supported — scrapes the channel page for the code.
 *
 * Instagram verification is not available yet (platform blocks scraping).
 */
export async function verifyBioCode(
  profileUrl: string,
  platform: string,
  code: string
): Promise<{ verified: boolean; error?: string }> {
  // Instagram blocks server-side scraping — verification not available
  if (platform === "instagram") {
    console.warn(`[ViewTracking] Instagram verification not available (platform blocks scraping)`);
    return {
      verified: false,
      error: "Instagram verification is not available yet. This platform is coming soon.",
    };
  }

  // For YouTube — scrape the channel/about page for the EXACT code
  if (platform === "youtube") {
    try {
      const urlsToTry = [profileUrl];
      if (!profileUrl.includes("/about")) {
        urlsToTry.push(profileUrl.replace(/\/?$/, "/about"));
      }

      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exactPattern = new RegExp(`(?<![a-z0-9])${escapedCode}(?![a-z0-9])`, "i");

      for (const url of urlsToTry) {
        console.log(`[ViewTracking] Scraping YouTube profile for bio code: ${url}`);

        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(15000),
          redirect: "follow",
        });

        if (!resp.ok) {
          console.warn(`[ViewTracking] YouTube returned ${resp.status} for ${url}`);
          continue;
        }

        const html = await resp.text();

        if (exactPattern.test(html)) {
          console.log(`[ViewTracking] ✅ YouTube bio code found (exact match) in: ${url}`);
          return { verified: true };
        }
      }

      console.warn(`[ViewTracking] ❌ YouTube bio code "${code}" not found in: ${profileUrl}`);
      return {
        verified: false,
        error: "Verification code not found in your YouTube channel description. Add the EXACT code to your channel's About section and try again.",
      };
    } catch (err: any) {
      console.error(`[ViewTracking] YouTube scrape error: ${err.message}`);
      return {
        verified: false,
        error: `Could not access your YouTube profile. Please try again in a moment. (${err.message})`,
      };
    }
  }

  return {
    verified: false,
    error: `Verification is not supported for ${platform}.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// API-based view fetching
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract the platform-specific post/video ID from a URL.
 * Used for API lookups.
 */
export function extractPlatformPostId(url: string, platform: string): string {
  switch (platform) {
    case "youtube":
      return extractYouTubeId(url) || "";
    case "instagram":
      return extractInstagramId(url) || "";
    default:
      return "";
  }
}

/**
 * Fetch YouTube views via Data API v3 (API key only — no OAuth needed).
 * Works for ANY public video.
 */
export async function fetchYouTubeViewsViaAPI(
  videoId: string
): Promise<{ views: number; success: boolean; error?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { views: 0, success: false, error: "YOUTUBE_API_KEY not configured" };
  }

  try {
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) {
      return { views: 0, success: false, error: `YouTube API returned ${resp.status}` };
    }

    const data = await resp.json();
    const stats = data?.items?.[0]?.statistics;
    if (stats?.viewCount !== undefined) {
      const views = parseInt(stats.viewCount, 10);
      console.log(`[ViewTracking] ✅ YouTube API viewCount: ${views}`);
      return { views, success: true };
    }

    return { views: 0, success: false, error: "Video not found or private" };
  } catch (err: any) {
    return { views: 0, success: false, error: `YouTube API error: ${err.message}` };
  }
}

/**
 * Fetch the channel ID that owns a YouTube video.
 * Uses YouTube Data API v3 `videos?part=snippet`.
 */
export async function fetchYouTubeVideoChannelId(
  videoId: string
): Promise<{ channelId: string; channelTitle: string; success: boolean; error?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { channelId: "", channelTitle: "", success: false, error: "YOUTUBE_API_KEY not configured" };
  }

  try {
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) {
      return { channelId: "", channelTitle: "", success: false, error: `YouTube API returned ${resp.status}` };
    }

    const data = await resp.json();
    const snippet = data?.items?.[0]?.snippet;
    if (snippet?.channelId) {
      console.log(`[ViewTracking] ✅ Video ${videoId} belongs to channel: ${snippet.channelId} (${snippet.channelTitle})`);
      return { channelId: snippet.channelId, channelTitle: snippet.channelTitle || "", success: true };
    }

    return { channelId: "", channelTitle: "", success: false, error: "Video not found or private" };
  } catch (err: any) {
    return { channelId: "", channelTitle: "", success: false, error: `YouTube API error: ${err.message}` };
  }
}

/**
 * Resolve a YouTube handle (e.g. "@yourchannel") or profile URL to its canonical channel ID.
 * Tries the `forHandle` param first, then falls back to `forUsername`.
 */
export async function resolveYouTubeChannelId(
  handleOrUrl: string
): Promise<{ channelId: string; success: boolean; error?: string }> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { channelId: "", success: false, error: "YOUTUBE_API_KEY not configured" };
  }

  // Extract handle from URL or raw string
  let handle = handleOrUrl.trim();
  // From URL: youtube.com/@handle or youtube.com/c/handle or youtube.com/channel/UCXXX
  const channelIdMatch = handle.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelIdMatch) {
    // Already a channel ID — return directly
    return { channelId: channelIdMatch[1], success: true };
  }

  const handleMatch = handle.match(/youtube\.com\/(?:@|c\/)?([\w.-]+)/);
  if (handleMatch) handle = handleMatch[1];
  handle = handle.replace(/^@/, "");

  if (!handle) {
    return { channelId: "", success: false, error: "Could not extract handle from URL" };
  }

  try {
    // Try forHandle first (modern @handles)
    let resp = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (resp.ok) {
      const data = await resp.json();
      if (data?.items?.[0]?.id) {
        console.log(`[ViewTracking] ✅ Resolved @${handle} → ${data.items[0].id}`);
        return { channelId: data.items[0].id, success: true };
      }
    }

    // Fallback: try forUsername (legacy usernames)
    resp = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${handle}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (resp.ok) {
      const data = await resp.json();
      if (data?.items?.[0]?.id) {
        console.log(`[ViewTracking] ✅ Resolved username ${handle} → ${data.items[0].id}`);
        return { channelId: data.items[0].id, success: true };
      }
    }

    return { channelId: "", success: false, error: `Could not resolve YouTube channel for "@${handle}"` };
  } catch (err: any) {
    return { channelId: "", success: false, error: `YouTube API error: ${err.message}` };
  }
}

/**
 * Master function: fetch views using the best available method.
 * Currently only YouTube is supported via API key.
 * Instagram API support coming soon.
 */
export async function fetchViewsAuto(
  postUrl: string,
  platform: string,
  _accessToken?: string | null,
  _platformUserId?: string | null
): Promise<{ views: number; success: boolean; source: string; error?: string }> {
  const postId = extractPlatformPostId(postUrl, platform);

  // YouTube: use Data API v3 (API key based — no OAuth needed)
  if (platform === "youtube" && postId) {
    const result = await fetchYouTubeViewsViaAPI(postId);
    if (result.success) return { ...result, source: "oauth_api" };
  }

  // Instagram: API support coming soon
  if (platform === "instagram") {
    return { views: 0, success: false, source: "manual", error: "Instagram view tracking is coming soon." };
  }

  return { views: 0, success: false, source: "manual", error: "Platform not supported for automatic view tracking." };
}
