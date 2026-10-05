// src/routes/contentEngagement.ts
// Content engagement tracking API — session-summary upsert model.
//
// POST /content-engagement/ingest   → Public (no auth) — upsert session summary
// GET  /content-engagement/stats    → Auth (founder) — content-level analytics
// GET  /content-engagement/affiliate-report → Auth — affiliate performance report
//
// Design principles:
//  1. Idempotent upsert on (sessionId, contentId) — no duplicate sessions
//  2. Client sends accumulated metrics; server does findOneAndUpdate with $set/$max/$inc
//  3. Affiliate ID → User lookup cached in-memory (LRU, 5-min TTL)
//  4. Returns 202 Accepted immediately — fire-and-forget from client perspective

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import {
  ContentEngagement,
  CONTENT_TYPES,
  DEVICE_TYPES,
} from "../models/contentEngagement.model";
import { User } from "../models/user.model";
import { Post } from "../models/post.model";
import { StandaloneVideo } from "../models/standaloneVideo.model";
import { Drop } from "../models/drop.model";
import { Testimonial } from "../models/testimonial.model";
import { requireAuth, requireFounder } from "../middleware/auth";

const router = Router();

// ── "My Posts Only" content-ID resolver ─────────────────────────────
// Queries all content models to find IDs authored by the given user.
// Returns a Map of contentType → ObjectId[] for targeted filtering,
// and a flat array of all IDs for cross-type filtering.

async function getMyContentIds(
  userId: string,
  orgId: string
): Promise<{ byType: Map<string, Types.ObjectId[]>; all: Types.ObjectId[] }> {
  const userIdObj = new Types.ObjectId(userId);
  const orgIdObj = new Types.ObjectId(orgId);

  // Run all queries in parallel for speed
  const [articleIds, videoIds, dropIds, testimonialIds] = await Promise.all([
    // Articles are Posts with postType="article"
    Post.find({ authorId: userIdObj, orgId: orgIdObj, postType: "article" })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id as Types.ObjectId)),

    // Long form videos + recorded streams (both stored in StandaloneVideo)
    StandaloneVideo.find({ createdBy: userIdObj, orgId: orgIdObj })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id as Types.ObjectId)),

    // Drops (short-form videos)
    Drop.find({ authorId: userIdObj, orgId: orgIdObj })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id as Types.ObjectId)),

    // Testimonials
    Testimonial.find({ createdBy: userIdObj, organizationId: orgIdObj })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id as Types.ObjectId)),
  ]);

  const byType = new Map<string, Types.ObjectId[]>();
  byType.set("article", articleIds);
  byType.set("video", videoIds);
  byType.set("drop", dropIds);
  byType.set("recording", videoIds); // recordings share the StandaloneVideo model
  byType.set("testimonial", testimonialIds);

  const all = [...articleIds, ...videoIds, ...dropIds, ...testimonialIds];

  return { byType, all };
}

// ── Affiliate ID → User cache (LRU with TTL) ──────────────────────
// Avoids a DB lookup on every heartbeat for the same affiliate.

interface CacheEntry {
  userId: Types.ObjectId | null;
  expiresAt: number;
}

const affiliateCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 500;

async function resolveAffiliateUserId(
  affiliateId: string
): Promise<Types.ObjectId | null> {
  // Check cache first
  const cached = affiliateCache.get(affiliateId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId;
  }

  // DB lookup
  try {
    const user = await User.findOne({ affiliateId })
      .select("_id")
      .lean();
    const userId = user ? (user._id as Types.ObjectId) : null;

    // Evict oldest if cache is full
    if (affiliateCache.size >= CACHE_MAX_SIZE) {
      const firstKey = affiliateCache.keys().next().value;
      if (firstKey) affiliateCache.delete(firstKey);
    }

    affiliateCache.set(affiliateId, {
      userId,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return userId;
  } catch (err) {
    console.error("Failed to resolve affiliate:", affiliateId, err);
    return null;
  }
}

// ── Zod Schemas ────────────────────────────────────────────────────

const InteractionsSchema = z
  .object({
    plays: z.number().int().min(0).default(0),
    pauses: z.number().int().min(0).default(0),
    seeks: z.number().int().min(0).default(0),
    replays: z.number().int().min(0).default(0),
    mutes: z.number().int().min(0).default(0),
    unmutes: z.number().int().min(0).default(0),
    fullscreens: z.number().int().min(0).default(0),
    linkClicks: z.number().int().min(0).default(0),
  })
  .partial()
  .default({});

const WatchedRangeSchema = z.tuple([z.number().min(0), z.number().min(0)]);

const IngestPayloadSchema = z.object({
  // Required identity
  sessionId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "sessionId must be alphanumeric with _ or -"),
  contentId: z.string().min(1),
  contentType: z.enum(CONTENT_TYPES),
  orgId: z.string().min(1),

  // Affiliate attribution (optional)
  affiliateId: z.string().nullish().default(null),

  // Viewer identity (at least one recommended)
  userId: z.string().nullish().default(null),
  guestId: z.string().nullish().default(null),

  // Accumulated metrics — video/recording/drop
  totalWatchTime: z.number().min(0).default(0),
  watchedRanges: z.array(WatchedRangeSchema).default([]),
  completionPercent: z.number().min(0).max(100).default(0),
  maxPlaybackRate: z.number().min(0.25).max(4).default(1),

  // Accumulated metrics — article
  totalReadTime: z.number().min(0).default(0),
  scrollDepthMax: z.number().min(0).max(100).default(0),

  // Interaction counts
  interactions: InteractionsSchema,

  // Context
  deviceType: z.enum(DEVICE_TYPES).default("unknown"),
  userAgent: z.string().max(500).default(""),
  referrerUrl: z.string().max(2000).default(""),
  contentTitle: z.string().max(300).default(""),

  // Lifecycle
  isComplete: z.boolean().default(false),
});

type IngestPayload = z.infer<typeof IngestPayloadSchema>;

// ── Rate Limiter (in-memory, per sessionId) ────────────────────────
// Max 20 requests per minute per session to prevent abuse.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodic cleanup of expired rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════
// POST /content-engagement/ingest
// Public — no authentication required.
// Upserts a session summary document. Idempotent on (sessionId, contentId).
// ═══════════════════════════════════════════════════════════════════

router.post("/ingest", async (req: Request, res: Response) => {
  // 1. Validate payload
  const parsed = IngestPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid payload",
      details: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const data: IngestPayload = parsed.data;

  // 2. Rate limit check
  if (!checkRateLimit(data.sessionId)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // 3. Validate ObjectId strings
  if (!Types.ObjectId.isValid(data.contentId)) {
    return res.status(400).json({ error: "Invalid contentId" });
  }
  if (!Types.ObjectId.isValid(data.orgId)) {
    return res.status(400).json({ error: "Invalid orgId" });
  }
  if (data.userId && !Types.ObjectId.isValid(data.userId)) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  try {
    // 4. Resolve affiliate
    let affiliateUserId: Types.ObjectId | null = null;
    if (data.affiliateId) {
      affiliateUserId = await resolveAffiliateUserId(data.affiliateId);
    }

    // 5. Build the upsert operation
    const contentIdObj = new Types.ObjectId(data.contentId);
    const orgIdObj = new Types.ObjectId(data.orgId);
    const userIdObj = data.userId
      ? new Types.ObjectId(data.userId)
      : null;

    const now = new Date();

    await ContentEngagement.findOneAndUpdate(
      // Filter: find existing session for this content
      {
        sessionId: data.sessionId,
        contentId: contentIdObj,
      },
      {
        // $set: always overwrite with latest accumulated values
        $set: {
          totalWatchTime: data.totalWatchTime,
          watchedRanges: data.watchedRanges,
          completionPercent: data.completionPercent,
          totalReadTime: data.totalReadTime,
          isComplete: data.isComplete,
          lastUpdate: now,
          // Update interactions with latest counts
          "interactions.plays": data.interactions.plays ?? 0,
          "interactions.pauses": data.interactions.pauses ?? 0,
          "interactions.seeks": data.interactions.seeks ?? 0,
          "interactions.replays": data.interactions.replays ?? 0,
          "interactions.mutes": data.interactions.mutes ?? 0,
          "interactions.unmutes": data.interactions.unmutes ?? 0,
          "interactions.fullscreens": data.interactions.fullscreens ?? 0,
          "interactions.linkClicks": data.interactions.linkClicks ?? 0,
        },
        // $max: only update if new value is higher
        $max: {
          scrollDepthMax: data.scrollDepthMax,
          maxPlaybackRate: data.maxPlaybackRate,
        },
        // $inc: count heartbeats
        $inc: {
          heartbeatCount: 1,
        },
        // $setOnInsert: set these fields only when creating a new document
        $setOnInsert: {
          orgId: orgIdObj,
          contentType: data.contentType,
          affiliateId: data.affiliateId || null,
          affiliateUserId,
          userId: userIdObj,
          guestId: data.guestId || null,
          deviceType: data.deviceType,
          userAgent: data.userAgent,
          referrerUrl: data.referrerUrl,
          contentTitle: data.contentTitle,
          sessionStart: now,
        },
      },
      {
        upsert: true,
        new: false, // Don't return the doc — we don't need it
      }
    );

    // 6. Return immediately
    return res.status(202).json({ accepted: true });
  } catch (err: any) {
    // Handle duplicate key race condition gracefully
    if (err.code === 11000) {
      // Upsert race — another request already created this session.
      // This is fine — the next heartbeat will update it.
      return res.status(202).json({ accepted: true });
    }
    console.error("Content engagement ingest error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /content-engagement/stats/:contentType/:contentId
// Auth required (founder). Returns aggregated engagement stats for a
// specific piece of content.
// ═══════════════════════════════════════════════════════════════════

router.get(
  "/stats/:contentType/:contentId",
  requireAuth,
  requireFounder,
  async (req: Request, res: Response) => {
    const me = (req as any).user as { userId: string; orgId: string };
    const { contentType, contentId } = req.params;

    // Validate params
    if (!CONTENT_TYPES.includes(contentType as any)) {
      return res.status(400).json({ error: "Invalid content type" });
    }
    if (!Types.ObjectId.isValid(contentId)) {
      return res.status(400).json({ error: "Invalid content ID" });
    }

    // Optional date range
    const { from, to } = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(req.query);

    try {
      const contentIdObj = new Types.ObjectId(contentId);
      const orgIdObj = new Types.ObjectId(me.orgId);

      // Date filter
      const dateFilter: any = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      const matchStage: any = {
        orgId: orgIdObj,
        contentId: contentIdObj,
        contentType,
      };
      if (hasDateFilter) matchStage.sessionStart = dateFilter;

      const [stats] = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            avgWatchTime: { $avg: "$totalWatchTime" },
            avgReadTime: { $avg: "$totalReadTime" },
            avgCompletionPercent: { $avg: "$completionPercent" },
            avgScrollDepth: { $avg: "$scrollDepthMax" },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
            totalPlays: { $sum: "$interactions.plays" },
            totalPauses: { $sum: "$interactions.pauses" },
            totalSeeks: { $sum: "$interactions.seeks" },
            totalReplays: { $sum: "$interactions.replays" },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
            avgWatchTime: { $round: ["$avgWatchTime", 1] },
            avgReadTime: { $round: ["$avgReadTime", 1] },
            avgCompletionPercent: { $round: ["$avgCompletionPercent", 1] },
            avgScrollDepth: { $round: ["$avgScrollDepth", 1] },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            completedCount: 1,
            completionRate: {
              $cond: [
                { $gt: ["$totalSessions", 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$completedCount", "$totalSessions"] },
                        100,
                      ],
                    },
                    1,
                  ],
                },
                0,
              ],
            },
            interactions: {
              plays: "$totalPlays",
              pauses: "$totalPauses",
              seeks: "$totalSeeks",
              replays: "$totalReplays",
            },
          },
        },
      ]);

      // Top affiliates for this content
      const topAffiliates = await ContentEngagement.aggregate([
        {
          $match: {
            ...matchStage,
            affiliateId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$affiliateId",
            affiliateUserId: { $first: "$affiliateUserId" },
            sessions: { $sum: 1 },
            avgWatchTime: { $avg: "$totalWatchTime" },
            avgReadTime: { $avg: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "affiliateUserId",
            foreignField: "_id",
            as: "user",
            pipeline: [{ $project: { name: 1, email: 1, profilePicture: 1 } }],
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $sort: { sessions: -1 } },
        { $limit: 20 },
        {
          $project: {
            affiliateId: "$_id",
            _id: 0,
            name: { $ifNull: ["$user.name", "Unknown"] },
            email: "$user.email",
            profilePicture: "$user.profilePicture",
            sessions: 1,
            avgWatchTime: { $round: ["$avgWatchTime", 1] },
            avgReadTime: { $round: ["$avgReadTime", 1] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
          },
        },
      ]);

      return res.json({
        success: true,
        contentId,
        contentType,
        stats: stats || {
          totalSessions: 0,
          uniqueViewers: 0,
          avgWatchTime: 0,
          avgReadTime: 0,
          avgCompletionPercent: 0,
          avgScrollDepth: 0,
          totalWatchTime: 0,
          totalReadTime: 0,
          completedCount: 0,
          completionRate: 0,
          interactions: { plays: 0, pauses: 0, seeks: 0, replays: 0 },
        },
        topAffiliates,
      });
    } catch (err) {
      console.error("Content engagement stats error:", err);
      return res.status(500).json({ error: "Failed to fetch stats" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// GET /content-engagement/affiliate-report
// Auth required. Returns engagement stats attributed to a specific
// affiliate across all content types in the org.
//
// Query params:
//   affiliateId (required) — the affiliate's referral code
//   from/to (optional) — date range
// ═══════════════════════════════════════════════════════════════════

router.get(
  "/affiliate-report",
  requireAuth,
  async (req: Request, res: Response) => {
    const me = (req as any).user as { userId: string; orgId: string };

    const params = z
      .object({
        affiliateId: z.string().min(1),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .safeParse(req.query);

    if (!params.success) {
      return res.status(400).json({
        error: "Invalid parameters",
        details: params.error.issues,
      });
    }

    const { affiliateId, from, to } = params.data;

    try {
      const orgIdObj = new Types.ObjectId(me.orgId);

      const dateFilter: any = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to);
      const hasDateFilter = Object.keys(dateFilter).length > 0;

      const matchStage: any = {
        orgId: orgIdObj,
        affiliateId,
      };
      if (hasDateFilter) matchStage.sessionStart = dateFilter;

      // Overall summary
      const [summary] = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
          },
        },
      ]);

      // Breakdown by content type
      const byContentType = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$contentType",
            sessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
          },
        },
        {
          $project: {
            contentType: "$_id",
            _id: 0,
            sessions: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
          },
        },
        { $sort: { sessions: -1 } },
      ]);

      // Top performing content pieces
      const topContent = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { contentId: "$contentId", contentType: "$contentType" },
            contentTitle: { $first: "$contentTitle" },
            sessions: { $sum: 1 },
            avgWatchTime: { $avg: "$totalWatchTime" },
            avgReadTime: { $avg: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
          },
        },
        { $sort: { sessions: -1 } },
        { $limit: 20 },
        {
          $project: {
            contentId: "$_id.contentId",
            contentType: "$_id.contentType",
            _id: 0,
            contentTitle: 1,
            sessions: 1,
            avgWatchTime: { $round: ["$avgWatchTime", 1] },
            avgReadTime: { $round: ["$avgReadTime", 1] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
          },
        },
      ]);

      return res.json({
        success: true,
        affiliateId,
        summary: summary || {
          totalSessions: 0,
          uniqueViewers: 0,
          totalWatchTime: 0,
          totalReadTime: 0,
          avgCompletion: 0,
          completedCount: 0,
        },
        byContentType,
        topContent,
      });
    } catch (err) {
      console.error("Affiliate report error:", err);
      return res.status(500).json({ error: "Failed to fetch affiliate report" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// GET /content-engagement/overview
// Auth required (any org member). Returns a high-level engagement
// overview across all content types for the user's organization.
// ═══════════════════════════════════════════════════════════════════

router.get(
  "/overview",
  requireAuth,
  async (req: Request, res: Response) => {
    const me = (req as any).user as { userId: string; orgId: string };

    const params = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        myPostsOnly: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);

    try {
      const orgIdObj = new Types.ObjectId(me.orgId);
      const matchStage: any = { orgId: orgIdObj };

      // "My Posts Only" filter: restrict to content created by the current user
      if (params.myPostsOnly === "true") {
        const myContent = await getMyContentIds(me.userId, me.orgId);
        matchStage.contentId = { $in: myContent.all };
      }

      if (params.from || params.to) {
        matchStage.sessionStart = {};
        if (params.from) matchStage.sessionStart.$gte = new Date(params.from);
        if (params.to) matchStage.sessionStart.$lte = new Date(params.to);
      }

      // Breakdown by content type
      const byType = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$contentType",
            totalSessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
            affiliateDriven: {
              $sum: {
                $cond: [{ $ne: ["$affiliateId", null] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            contentType: "$_id",
            _id: 0,
            totalSessions: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
            affiliateDriven: 1,
          },
        },
        { $sort: { totalSessions: -1 } },
      ]);

      // Top affiliates across all content
      const topAffiliates = await ContentEngagement.aggregate([
        {
          $match: {
            ...matchStage,
            affiliateId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$affiliateId",
            affiliateUserId: { $first: "$affiliateUserId" },
            totalSessions: { $sum: 1 },
            contentTypes: { $addToSet: "$contentType" },
            avgCompletion: { $avg: "$completionPercent" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "affiliateUserId",
            foreignField: "_id",
            as: "user",
            pipeline: [{ $project: { name: 1, email: 1, profilePicture: 1 } }],
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $sort: { totalSessions: -1 } },
        { $limit: 10 },
        {
          $project: {
            affiliateId: "$_id",
            _id: 0,
            name: { $ifNull: ["$user.name", "Unknown"] },
            email: "$user.email",
            profilePicture: "$user.profilePicture",
            totalSessions: 1,
            contentTypes: 1,
            avgCompletion: { $round: ["$avgCompletion", 1] },
          },
        },
      ]);

      // Top performing content across all types (top 10)
      const topContent = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { contentId: "$contentId", contentType: "$contentType" },
            contentTitle: { $first: "$contentTitle" },
            totalSessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
            affiliateDriven: {
              $sum: {
                $cond: [{ $ne: ["$affiliateId", null] }, 1, 0],
              },
            },
          },
        },
        { $sort: { totalSessions: -1 } },
        { $limit: 10 },
        {
          $project: {
            contentId: "$_id.contentId",
            contentType: "$_id.contentType",
            _id: 0,
            contentTitle: 1,
            totalSessions: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
            affiliateDriven: 1,
          },
        },
      ]);

      return res.json({
        success: true,
        byType,
        topAffiliates,
        topContent,
      });
    } catch (err) {
      console.error("Engagement overview error:", err);
      return res.status(500).json({ error: "Failed to fetch overview" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// GET /content-engagement/leaderboard/:contentType
// Auth required (any org member). Returns a ranked list of individual
// content items of a given type, with per-item aggregate stats.
//
// Query params:
//   from/to (optional) — date range filter
//   limit (optional, default 50, max 100) — number of items to return
//   sortBy (optional) — field to sort by: totalSessions | totalWatchTime |
//                        avgCompletion | uniqueViewers (default: totalSessions)
// ═══════════════════════════════════════════════════════════════════

router.get(
  "/leaderboard/:contentType",
  requireAuth,
  async (req: Request, res: Response) => {
    const me = (req as any).user as { userId: string; orgId: string };
    const { contentType } = req.params;

    if (!CONTENT_TYPES.includes(contentType as any)) {
      return res.status(400).json({ error: "Invalid content type" });
    }

    const params = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        sortBy: z
          .enum(["totalSessions", "totalWatchTime", "avgCompletion", "uniqueViewers"])
          .default("totalSessions"),
        myPostsOnly: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);

    try {
      const orgIdObj = new Types.ObjectId(me.orgId);
      const matchStage: any = { orgId: orgIdObj, contentType };

      // "My Posts Only" filter: restrict to content created by the current user
      if (params.myPostsOnly === "true") {
        const myContent = await getMyContentIds(me.userId, me.orgId);
        const typeIds = myContent.byType.get(contentType) || [];
        matchStage.contentId = { $in: typeIds };
      }

      if (params.from || params.to) {
        matchStage.sessionStart = {};
        if (params.from) matchStage.sessionStart.$gte = new Date(params.from);
        if (params.to) matchStage.sessionStart.$lte = new Date(params.to);
      }

      // Per-item leaderboard
      const sortField = params.sortBy === "uniqueViewers"
        ? "uniqueViewersCount"
        : params.sortBy;

      const items = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$contentId",
            contentTitle: { $first: "$contentTitle" },
            totalSessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
            affiliateDriven: {
              $sum: {
                $cond: [{ $ne: ["$affiliateId", null] }, 1, 0],
              },
            },
            devices: { $push: "$deviceType" },
            lastActivity: { $max: "$lastUpdate" },
          },
        },
        {
          $project: {
            contentId: "$_id",
            _id: 0,
            contentTitle: 1,
            totalSessions: 1,
            uniqueViewersCount: { $size: "$uniqueViewers" },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            avgWatchTime: {
              $round: [
                { $divide: ["$totalWatchTime", { $max: ["$totalSessions", 1] }] },
                1,
              ],
            },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            avgReadTime: {
              $round: [
                { $divide: ["$totalReadTime", { $max: ["$totalSessions", 1] }] },
                1,
              ],
            },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
            affiliateDriven: 1,
            affiliatePercent: {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$affiliateDriven", { $max: ["$totalSessions", 1] }] },
                    100,
                  ],
                },
                1,
              ],
            },
            topDevice: {
              $arrayElemAt: [
                {
                  $map: {
                    input: {
                      $sortArray: {
                        input: {
                          $objectToArray: {
                            $arrayToObject: {
                              $map: {
                                input: { $setUnion: ["$devices"] },
                                as: "d",
                                in: {
                                  k: "$$d",
                                  v: {
                                    $size: {
                                      $filter: {
                                        input: "$devices",
                                        cond: { $eq: ["$$this", "$$d"] },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        sortBy: { v: -1 },
                      },
                    },
                    as: "entry",
                    in: "$$entry.k",
                  },
                },
                0,
              ],
            },
            lastActivity: 1,
          },
        },
        { $sort: { [sortField]: -1 } },
        { $limit: params.limit },
      ]);

      // Also compute the aggregate for this content type
      const [aggregated] = await ContentEngagement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            uniqueViewers: {
              $addToSet: {
                $ifNull: ["$userId", { $ifNull: ["$guestId", "$sessionId"] }],
              },
            },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
            avgCompletion: { $avg: "$completionPercent" },
            completedCount: {
              $sum: { $cond: ["$isComplete", 1, 0] },
            },
            affiliateDriven: {
              $sum: {
                $cond: [{ $ne: ["$affiliateId", null] }, 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            uniqueViewers: { $size: "$uniqueViewers" },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
            avgCompletion: { $round: ["$avgCompletion", 1] },
            completedCount: 1,
            affiliateDriven: 1,
          },
        },
      ]);

      // Top affiliates for this content type
      const topAffiliates = await ContentEngagement.aggregate([
        {
          $match: {
            ...matchStage,
            affiliateId: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$affiliateId",
            affiliateUserId: { $first: "$affiliateUserId" },
            sessions: { $sum: 1 },
            avgCompletion: { $avg: "$completionPercent" },
            totalWatchTime: { $sum: "$totalWatchTime" },
            totalReadTime: { $sum: "$totalReadTime" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "affiliateUserId",
            foreignField: "_id",
            as: "user",
            pipeline: [{ $project: { name: 1, email: 1, profilePicture: 1 } }],
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $sort: { sessions: -1 } },
        { $limit: 10 },
        {
          $project: {
            affiliateId: "$_id",
            _id: 0,
            name: { $ifNull: ["$user.name", "Unknown"] },
            email: "$user.email",
            profilePicture: "$user.profilePicture",
            sessions: 1,
            avgCompletion: { $round: ["$avgCompletion", 1] },
            totalWatchTime: { $round: ["$totalWatchTime", 0] },
            totalReadTime: { $round: ["$totalReadTime", 0] },
          },
        },
      ]);

      return res.json({
        success: true,
        contentType,
        items,
        aggregated: aggregated || {
          totalSessions: 0,
          uniqueViewers: 0,
          totalWatchTime: 0,
          totalReadTime: 0,
          avgCompletion: 0,
          completedCount: 0,
          affiliateDriven: 0,
        },
        topAffiliates,
      });
    } catch (err) {
      console.error("Leaderboard error:", err);
      return res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  }
);

export default router;
