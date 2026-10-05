// src/routes/learnInit.ts
// Consolidated endpoint for the Learn/Courses page.
// Returns all data needed for the initial page load in a single round trip,
// eliminating multiple sequential API calls from the frontend.
//
// This is an ADDITIVE route — no existing endpoints are modified.

import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { Course } from "../models/course.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { Workshop } from "../models/workshop.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { OrganizationFile } from "../models/cabinet.model";
import { hasFounderAccess } from "../utils/accessCheck";
import { s3Service } from "../services/s3";
import { ChannelMembership } from "../models/channelMembership.model";

const router = Router();

// ── Shared helper: resolve founder status for a user in an org ──
async function resolveFounderStatus(
  userId: string,
  orgId: string
): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();

  if (!user) return false;

  // Legacy check
  if (
    user.organization?.toString() === orgId &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return true;
  }

  // Multi-org check
  if (user.organizations) {
    const membership = user.organizations.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (membership && hasFounderAccess(membership)) {
      return true;
    }
  }

  return false;
}

/**
 * GET /learn/init?orgId=...
 *
 * Lightweight consolidated endpoint that returns:
 * - isFounder: boolean
 * - courses: Course[] (summary only — sections/chapters/digitalAssets excluded)
 * - enrollments: CourseEnrollment[] (only for learners)
 *
 * Workshop/recording data is NOT included here — it is loaded lazily
 * via GET /learn/init/livestream when the user clicks the Livestream tab.
 */
router.get("/init", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    // ── 1. Single founder check ──
    const isFounder = await resolveFounderStatus(me.userId, orgId);

    // ── 2. Fetch courses — SUMMARY ONLY (exclude heavy sections/digitalAssets) ──
    const courseFilter: any = {
      organizationId: new Types.ObjectId(orgId),
    };
    if (!isFounder) {
      courseFilter.status = "published";
      const memberships = await ChannelMembership.find({
        userId: new Types.ObjectId(me.userId),
        orgId: new Types.ObjectId(orgId),
        status: "active",
      })
        .select("channelId")
        .lean();

      const userChannelIds = memberships.map((m) => m.channelId.toString());
      const boundIds = userChannelIds.map((id) => new Types.ObjectId(id));
      courseFilter.$or = [
        { channelIds: { $size: 0 } },
        { channelIds: null },
        { channelIds: { $exists: false } },
        { channelIds: { $in: boundIds } },
      ];
    }

    // Select only the fields needed for the course listing cards.
    // sections, digitalAssets, and nested chapter content are excluded —
    // they are fetched on-demand via GET /courses/:courseId when a user
    // clicks into a specific course.
    const COURSE_SUMMARY_FIELDS = [
      "title",
      "description",
      "coverImage",
      "status",
      "organizationId",
      "createdBy",
      "channelIds",
      "isPaid",
      "isFree",
      "price",
      "currency",
      "isSubscription",
      "subscriptionPeriod",
      "totalDuration",
      "totalChapters",
      "enrolledStudents",
      "rating",
      "ratingCount",
      "whatYouWillLearn",
      "requirements",
      "courseIncludes",
      "reviews",
      "createdAt",
      "updatedAt",
    ].join(" ");

    const coursesPromise = Course.find(courseFilter)
      .select(COURSE_SUMMARY_FIELDS)
      .populate("createdBy", "name email avatar")
      .sort({ createdAt: -1 })
      .lean();

    // ── 3. Fetch enrollments (only for non-founders) ──
    const enrollmentsPromise = isFounder
      ? Promise.resolve([])
      : CourseEnrollment.find({
          userId: new Types.ObjectId(me.userId),
          organizationId: new Types.ObjectId(orgId),
        })
          .populate({
            path: "courseId",
            select: "title coverImage totalChapters totalDuration createdBy",
            populate: { path: "createdBy", select: "name avatar" },
          })
          .sort({ lastAccessedAt: -1 })
          .lean();

    // ── Execute queries in parallel ──
    const [courses, enrollments] = await Promise.all([
      coursesPromise,
      enrollmentsPromise,
    ]);

    res.json({
      success: true,
      isFounder,
      courses,
      enrollments,
    });
  } catch (error) {
    console.error("[LearnInit] Error:", error);
    res.status(500).json({ error: "Failed to load learn page data" });
  }
});

/**
 * GET /learn/init/livestream?orgId=...
 *
 * Lazy-loaded endpoint for the Livestream tab. Returns completed workshops
 * with recording URLs already resolved (eliminates N+1 recording fetches).
 *
 * This is called ONLY when the user clicks the Livestream tab, avoiding
 * expensive S3 presigning operations on every page load.
 */
router.get("/init/livestream", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    if (!orgId) {
      return res.status(400).json({ error: "orgId is required" });
    }

    // ── 1. Founder check ──
    const isFounder = await resolveFounderStatus(me.userId, orgId);

    // ── 2. Fetch workshops ──
    // For founders: all workshops; for learners: accessible workshops
    let workshopFilter: any = {
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    };

    if (!isFounder) {
      // Get user's subscribed channels
      const memberships = await ChannelMembership.find({
        userId: new Types.ObjectId(me.userId),
        orgId: new Types.ObjectId(orgId),
        status: "active",
      })
        .select("channelId")
        .lean();

      const subscribedChannelIds = memberships.map((m) => m.channelId);
      workshopFilter.$or = [
        { channelIds: { $size: 0 } },
        { channelIds: { $in: subscribedChannelIds } },
      ];
    }

    const workshops = await Workshop.find(workshopFilter)
      .populate("channelIds", "title")
      .populate("createdBy", "name email profilePicture")
      .sort({ date: -1 })
      .lean();

    // ── 3. Batch fetch ALL recordings for ALL workshops in ONE query ──
    const workshopIds = workshops.map((w) => w._id);
    const allRecordingFiles =
      workshopIds.length > 0
        ? await OrganizationFile.find({
            "metadata.workshopId": { $in: workshopIds.map(String) },
            "metadata.recordingSource": {
              $in: [
                "webinar-mediasoup",
                "webinar-mediasoup-server",
                "webinar-livekit",
              ],
            },
            status: "ready",
          })
            .sort({ createdAt: -1 })
            .lean()
        : [];

    // Group recordings by workshopId
    const recordingsByWorkshop = new Map<string, any[]>();
    for (const file of allRecordingFiles) {
      const wid = (file.metadata as any)?.workshopId;
      if (!wid) continue;
      if (!recordingsByWorkshop.has(wid)) {
        recordingsByWorkshop.set(wid, []);
      }
      recordingsByWorkshop.get(wid)!.push(file);
    }

    // ── 4. Generate presigned URLs in parallel for all recordings ──
    const recordingCards: any[] = [];

    // Flatten workshop+recording pairs and presign in parallel
    const presignTasks: Array<{
      workshop: any;
      file: any;
    }> = [];

    for (const workshop of workshops) {
      const files = recordingsByWorkshop.get(workshop._id.toString()) || [];
      for (const file of files) {
        presignTasks.push({ workshop, file });
      }
    }

    // Process presigning in batches of 20 to avoid overwhelming S3
    const BATCH_SIZE = 20;
    for (let i = 0; i < presignTasks.length; i += BATCH_SIZE) {
      const batch = presignTasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ workshop, file }) => {
          let streamUrl = "";
          let downloadUrl = "";
          try {
            const isManifest =
              file.mimeType === "application/x-webinar-manifest";
            if (!isManifest) {
              streamUrl = await s3Service.getPresignedStreamUrl(
                file.s3Key,
                3600,
                file.mimeType || "video/mp4"
              );
            }
            downloadUrl = await s3Service.getPresignedDownloadUrl(
              file.s3Key,
              3600,
              file.name
            );
          } catch {
            // Skip files where S3 presigning fails
          }

          // Per-recording founder overrides — set via PATCH
          // /webinar/:workshopId/recordings/:recordingId. When present they
          // replace the workshop-level title/description/thumbnail on the
          // card so founders can curate each recording individually.
          const meta = (file.metadata as any) || {};
          const displayTitle: string | undefined = meta.displayTitle;
          const displayDescription: string | undefined = meta.displayDescription;
          const displayThumbnail: string | undefined = meta.displayThumbnail;

          return {
            ...workshop,
            _id: `${workshop._id}__${file._id}`,
            date: file.createdAt || workshop.date,
            _workshopId: workshop._id.toString(),
            _recordingFileId: String(file._id),
            _recordingUrl: streamUrl || downloadUrl,
            _recordingName: file.name,
            _displayTitle: displayTitle || "",
            _displayDescription: displayDescription || "",
            _displayThumbnail: displayThumbnail || "",
            // Override the visible fields so the existing UI picks them up
            // without needing to know about the override mechanism.
            title: displayTitle || workshop.title,
            description: displayDescription || workshop.description,
            thumbnail: displayThumbnail || workshop.thumbnail,
          };
        })
      );
      recordingCards.push(...results);
    }

    // Sort by recording date desc
    recordingCards.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // ── 5. Enrich workshops with registration info ──
    const workshopIdsForRegs = workshops.map((w) => w._id);
    const [registrationCounts, userRegistrations] = await Promise.all([
      WorkshopRegistration.aggregate([
        {
          $match: {
            workshopId: { $in: workshopIdsForRegs },
            status: { $ne: "cancelled" },
          },
        },
        { $group: { _id: "$workshopId", count: { $sum: 1 } } },
      ]),
      WorkshopRegistration.find({
        workshopId: { $in: workshopIdsForRegs },
        userId: new Types.ObjectId(me.userId),
        status: { $ne: "cancelled" },
      }).lean(),
    ]);

    const countMap = new Map(
      registrationCounts.map((r: any) => [r._id.toString(), r.count])
    );
    const userRegMap = new Map(
      userRegistrations.map((r) => [
        r.workshopId.toString(),
        { isRegistered: true, hasPaid: r.hasPaid },
      ])
    );

    // Enrich completed workshop recording cards with registration info
    const enrichedRecordingCards = recordingCards.map((card) => ({
      ...card,
      registeredParticipantsCount: countMap.get(card._workshopId) || 0,
      isRegistered:
        userRegMap.get(card._workshopId)?.isRegistered || false,
      hasPaid: userRegMap.get(card._workshopId)?.hasPaid || false,
    }));

    res.json({
      success: true,
      completedWorkshops: enrichedRecordingCards,
    });
  } catch (error) {
    console.error("[LearnInit:Livestream] Error:", error);
    res.status(500).json({ error: "Failed to load livestream data" });
  }
});

export default router;
