import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Workshop } from "../models/workshop.model";
import { Channel } from "../models/channel.model";
import { Meet } from "../models/meet.model";
import { MeetParticipant } from "../models/meetParticipant.model";
import { Organization } from "../models/organization.model";
import { createRoom, createParticipantToken, toLivekitRoomName, getLivekitUrl, getWebinarViewerCount } from "../services/livekit";
import { getRoom } from "../services/mediasoup";
import { emitWorkshopPreviewUpdate } from "../services/socket";
import { getPreviewWatcherCount } from "../realtime/socket";
import { env } from "../config/env";

const router = Router();

/**
 * POST /workshop-preview/debug-go-live/:workshopId
 * Temporary debug endpoint — forces a workshop's Meet to status=live.
 * Remove once live-preview is working reliably.
 */
router.post("/debug-go-live/:workshopId", async (req, res) => {
  try {
    const { workshopId } = req.params;
    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshopId" });
    }
    const workshop = await Workshop.findById(workshopId).select("meetingId orgId title").lean();
    if (!workshop) return res.status(404).json({ success: false, error: "Workshop not found" });

    const now = new Date();
    const fourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    if (workshop.meetingId) {
      const updated = await Meet.findByIdAndUpdate(
        workshop.meetingId,
        { $set: { status: "live", startedAt: now, endTime: fourHours } },
        { new: true }
      );
      if (updated) {
        emitWorkshopPreviewUpdate(workshop.orgId?.toString() || "", "workshop:preview:live", { workshopId, title: workshop.title });
        return res.json({ success: true, meetId: workshop.meetingId, status: "live" });
      }
    }

    return res.status(404).json({ success: false, error: "No meetingId on workshop or Meet not found" });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * GET /workshop-preview/live
 * Get the most recently started live workshop for an organization
 * Public endpoint - no authentication required
 */
router.get("/live", async (req, res) => {
  try {
    const schema = z.object({
      orgId: z.string().refine((val) => Types.ObjectId.isValid(val), {
        message: "Invalid orgId",
      }),
    });

    const parseResult = schema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "orgId is required and must be a valid ObjectId",
      });
    }

    const { orgId } = parseResult.data;

    // Find workshops with meetingId that have a live meeting
    // Step 1: Find all workshops for this org that have a meetingId
    const workshopsWithMeeting = await Workshop.find({
      orgId: new Types.ObjectId(orgId),
      meetingId: { $exists: true, $ne: null },
      isActive: true,
    })
      .select("_id title thumbnail meetingId createdBy date startTime endTime timezone totalViews")
      .populate("createdBy", "name email profilePicture affiliateId")
      .lean();

    if (workshopsWithMeeting.length === 0) {
      return res.json({
        success: true,
        workshop: null,
      });
    }

    // Filter out workshops whose end time has passed
    const now = new Date();
    const activeWorkshops = workshopsWithMeeting.filter((w) => {
      if (!w.date || !w.endTime) return true; // If no date/time, include it

      // Parse the workshop end datetime
      const workshopDate = new Date(w.date);
      const [endHour, endMinute] = w.endTime.split(":").map(Number);

      // Create end datetime in workshop's timezone (approximate - set hours on the date)
      const endDateTime = new Date(workshopDate);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      // Add some buffer (e.g., 30 minutes after end time) to account for timezone differences
      // and meetings that run slightly over
      const bufferMs = 30 * 60 * 1000; // 30 minutes
      const endWithBuffer = new Date(endDateTime.getTime() + bufferMs);

      const isStillActive = now < endWithBuffer;

      if (!isStillActive) {
        console.log("[WorkshopPreview] Workshop excluded (past end time):", w.title, "ended at", w.endTime, "on", workshopDate.toISOString());
      }

      return isStillActive;
    });

    if (activeWorkshops.length === 0) {
      return res.json({
        success: true,
        workshop: null,
      });
    }

    // Step 2: Get all meeting IDs and find which ones are live
    // meetingId could be ObjectId or string, so convert all to ObjectId for the query
    const meetingIds = activeWorkshops
      .map((w) => w.meetingId)
      .filter((id): id is string => !!id)
      .map((id) => {
        try {
          return new Types.ObjectId(id.toString());
        } catch {
          return null;
        }
      })
      .filter((id): id is Types.ObjectId => id !== null);

    if (meetingIds.length === 0) {
      return res.json({
        success: true,
        workshop: null,
      });
    }

    // Debug: Log what we're querying
    console.log("[WorkshopPreview] Querying for live meetings with IDs:", meetingIds.map(id => id.toString()));

    const liveMeetings = await Meet.find({
      _id: { $in: meetingIds },
      status: "live",
    })
      .sort({ startedAt: -1 }) // Most recently started first
      .lean();

    console.log("[WorkshopPreview] Found live meetings:", liveMeetings.length, "out of", meetingIds.length, "total meetings");

    // Debug: Log the status of all meetings we found
    if (liveMeetings.length > 0) {
      console.log("[WorkshopPreview] Live meetings details:", liveMeetings.map(m => ({
        id: m._id.toString(),
        status: m.status,
        title: m.title,
        startedAt: m.startedAt,
        endedAt: m.endedAt
      })));
    }

    if (liveMeetings.length === 0) {
      return res.json({
        success: true,
        workshop: null,
      });
    }

    // Get the most recently started live meeting
    const latestLiveMeeting = liveMeetings[0];

    // Find the corresponding workshop
    // meetingId could be ObjectId or string depending on how it was stored
    const workshop = activeWorkshops.find(
      (w) => w.meetingId?.toString() === latestLiveMeeting._id.toString()
    );

    if (!workshop) {
      return res.json({
        success: true,
        workshop: null,
      });
    }

    // Get host info
    const host = workshop.createdBy as any;

    // Count live viewers from the LiveKit room — excludes the host and
    // preview-card audience members (identity "audience-*").
    // LiveKit state lives on the LiveKit server, so it survives backend restarts.
    const livekitRoomName = toLivekitRoomName(`webinar-${workshop._id.toString()}`);
    const hostUserId = host?._id?.toString() ?? "";
    const webinarViewers = await getWebinarViewerCount(livekitRoomName, hostUserId);
    const previewViewers = getPreviewWatcherCount(workshop._id.toString());
    const viewerCount = webinarViewers + previewViewers;

    res.json({
      success: true,
      workshop: {
        workshopId: workshop._id.toString(),
        title: workshop.title,
        thumbnail: workshop.thumbnail || null,
        hostName: host?.name || "Host",
        hostProfilePicture: host?.profilePicture || null,
        hostEmail: latestLiveMeeting.hostEmail,
        // Host's global affiliate id — for click-through attribution.
        hostAffiliateId: host?.affiliateId ?? null,
        meetId: latestLiveMeeting._id.toString(),
        agoraChannel: latestLiveMeeting.agoraChannel,
        startedAt: latestLiveMeeting.startedAt,
        viewerCount,
        // The sum's two components, split out for clients that show them
        // separately: people IN the webinar room vs. people watching the
        // preview card without joining. viewerCount stays their sum for
        // existing consumers.
        joinedCount: webinarViewers,
        watchingCount: previewViewers,
        // Cumulative watch-starts across the stream's lifetime.
        totalViews: workshop.totalViews ?? 0,
        isScreenSharing: !!latestLiveMeeting.screenSharingByUid,
        screenSharingByUid: latestLiveMeeting.screenSharingByUid || null,
        webinarType: "mediasoup" as const,
      },
    });
  } catch (error) {
    console.error("Error getting live workshop preview:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get live workshop",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshop-preview/audience-token
 * Generate a LiveKit audience token for viewing a workshop preview
 * Public endpoint - no authentication required
 */
router.post("/audience-token", async (req, res) => {
  try {
    const schema = z.object({
      workshopId: z.string().refine((val) => Types.ObjectId.isValid(val), {
        message: "Invalid workshopId",
      }),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parseResult.error.issues,
      });
    }

    const { workshopId } = parseResult.data;

    // Verify the workshop exists and has a live meeting
    const workshop = await Workshop.findById(workshopId)
      .select("meetingId isActive")
      .lean();

    if (!workshop || !workshop.isActive) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    if (!workshop.meetingId) {
      return res.status(400).json({
        success: false,
        error: "Workshop has no meeting associated",
      });
    }

    // Verify the meeting is live and channel matches
    const meeting = await Meet.findById(workshop.meetingId)
      .select("status agoraChannel")
      .lean();

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
      });
    }

    if (meeting.status !== "live") {
      return res.status(400).json({
        success: false,
        error: "Meeting is not live",
      });
    }

    // Use the same room name formula as the webinar host
    const livekitRoomName = toLivekitRoomName(`webinar-${workshopId}`);
    const room = await createRoom(livekitRoomName);
    const token = await createParticipantToken(room.name, {
      userId: `audience-${Date.now()}`,
      isOwner: false,
      canPublish: false,
    });

    console.log("[WorkshopPreview] Generating audience token:", {
      workshopId,
      room: livekitRoomName,
      serverUrl: getLivekitUrl(),
      tokenGenerated: !!token,
    });

    if (!token) {
      console.error("[WorkshopPreview] Failed to generate LiveKit participant token");
      return res.status(500).json({
        success: false,
        error: "Failed to generate token",
      });
    }

    res.json({
      success: true,
      token,
      serverUrl: getLivekitUrl(),
      roomName: room.name,
    });
  } catch (error) {
    console.error("Error generating audience token:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate audience token",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshop-preview/status/:meetId
 * Get current status of a live workshop meeting (for polling)
 * Returns viewer count and screen sharing state
 */
router.get("/status/:meetId", async (req, res) => {
  try {
    const { meetId } = req.params;

    if (!Types.ObjectId.isValid(meetId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid meetId",
      });
    }

    const meeting = await Meet.findById(meetId)
      .select("status screenSharingByUid")
      .lean();

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found",
      });
    }

    // Get current viewer count
    const viewerCount = await MeetParticipant.countDocuments({
      meetId: new Types.ObjectId(meetId),
      leftAt: null,
    });

    res.json({
      success: true,
      status: meeting.status,
      isLive: meeting.status === "live",
      viewerCount,
      isScreenSharing: !!meeting.screenSharingByUid,
      screenSharingByUid: meeting.screenSharingByUid || null,
    });
  } catch (error) {
    console.error("Error getting meeting status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get meeting status",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshop-preview/live-all
 * All currently live workshops across every organization.
 * Public — no authentication required.
 *
 * Optional ?orgId=<id> narrows the feed to one organization. Its sibling
 * GET /live answers the same question but returns only the org's most recently
 * started workshop and applies no paywall filter, so a consumer that has to
 * list everything joinable for one org — a storefront's Livestreams tab —
 * wants this instead.
 */
router.get("/live-all", async (req, res) => {
  try {
    const orgIdParam = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";
    if (orgIdParam && !Types.ObjectId.isValid(orgIdParam)) {
      return res
        .status(400)
        .json({ success: false, error: "orgId must be a valid ObjectId" });
    }

    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    const liveMeetings = await Meet.find({
      status: "live",
      $or: [{ endTime: { $gt: now } }, { startedAt: { $gte: eightHoursAgo } }],
    })
      .sort({ startedAt: -1 })
      .lean();

    if (!liveMeetings.length) return res.json({ success: true, workshops: [] });

    const liveMeetIdStrings = liveMeetings.map((m) => m._id.toString());

    const allWorkshops = await Workshop.find({
      meetingId: { $in: liveMeetIdStrings },
      isActive: true,
      ...(orgIdParam ? { orgId: new Types.ObjectId(orgIdParam) } : {}),
    })
      // isFree/price/channelIds drive the paywall filter below — they are
      // NOT serialised into the response, only used to decide inclusion.
      .select(
        "_id title description thumbnail meetingId orgId createdBy isFree price channelIds totalViews"
      )
      // affiliateId is the host's global EarnGPT referral id —
      // the public live-list consumer uses it to attribute click-
      // through joins back to the host.
      .populate("createdBy", "name email profilePicture affiliateId")
      .lean();

    // ── Paywall filter ────────────────────────────────────────────────
    // Garage TV is a public surface whose viewers tap straight through to
    // join, so only list workshops someone can actually get into for free.
    // /public/webinar/prepare-join enforces TWO independent paywalls, and
    // both have to be excluded or the viewer hits an invoice after tapping:
    //
    //   1. the workshop itself — `isFree || price <= 0` (same expression
    //      prepare-join uses to compute isFreeWorkshop)
    //   2. any PAID community linked via channelIds — prepare-join mints a
    //      *community* invoice first when the viewer has no active
    //      ChannelMembership, so a FREE workshop behind a PAID community
    //      still costs money and must not be listed either
    const freeWorkshops = allWorkshops.filter(
      (w: any) => w.isFree || (w.price || 0) <= 0
    );

    // One batched lookup for every linked channel across the whole feed —
    // a per-workshop query here would be N+1 on a hot public endpoint.
    const linkedChannelIds = [
      ...new Set(
        freeWorkshops.flatMap((w: any) =>
          Array.isArray(w.channelIds) ? w.channelIds.map(String) : []
        )
      ),
    ];
    const paidChannels = linkedChannelIds.length
      ? await Channel.find({
          _id: { $in: linkedChannelIds.map((id) => new Types.ObjectId(id)) },
          isFree: false,
          price: { $gt: 0 },
        })
          .select("_id")
          .lean()
      : [];
    const paidChannelIds = new Set(paidChannels.map((c: any) => c._id.toString()));

    const workshops = paidChannelIds.size
      ? freeWorkshops.filter(
          (w: any) =>
            !(Array.isArray(w.channelIds) ? w.channelIds : []).some((id: any) =>
              paidChannelIds.has(String(id))
            )
        )
      : freeWorkshops;

    if (!workshops.length) return res.json({ success: true, workshops: [] });

    const orgIds = [...new Set(workshops.map((w) => w.orgId.toString()))].map(
      (id) => new Types.ObjectId(id)
    );

    const [orgs, participantCounts] = await Promise.all([
      Organization.find({ _id: { $in: orgIds } }).select("_id name colored_logo white_logo").lean(),
      MeetParticipant.aggregate([
        { $match: { meetId: { $in: liveMeetings.map((m) => m._id) }, leftAt: null } },
        { $group: { _id: "$meetId", count: { $sum: 1 } } },
      ]),
    ]);

    const orgMap = new Map(orgs.map((o) => [o._id.toString(), o]));
    const viewerMap = new Map<string, number>(participantCounts.map((p) => [p._id.toString(), p.count]));
    const meetMap = new Map(liveMeetings.map((m) => [m._id.toString(), m]));

    const result = workshops.map((w) => {
      const meetId = w.meetingId ?? "";
      const meeting = meetMap.get(meetId);
      const host = w.createdBy as any;
      const org = orgMap.get(w.orgId.toString()) as any;
      // Current pinned product for this webinar, read from the in-memory
      // mediasoup room (keyed by workshop id). This is a snapshot — preview
      // clients that don't join the socket room (e.g. Garage TV reels) get the
      // live pin on their next poll. Expired pins are treated as unpinned.
      const room = getRoom(w._id.toString());
      const pin = room?.pinnedProduct ?? null;
      const pinnedProduct =
        pin && (pin.pinnedUntil == null || pin.pinnedUntil > Date.now()) ? pin : null;
      return {
        workshopId: w._id.toString(),
        pinnedProduct,
        title: w.title,
        description: w.description ?? null,
        thumbnail: w.thumbnail ?? null,
        hostName: host?.name ?? "Host",
        hostProfilePicture: host?.profilePicture ?? null,
        hostEmail: meeting?.hostEmail ?? "",
        // Host's global affiliate id — surfaced so consumers (e.g.
        // the public discover page) can append `?ref=<affiliateId>`
        // to their click-through links.
        hostAffiliateId: host?.affiliateId ?? null,
        meetId,
        agoraChannel: meeting?.agoraChannel ?? "",
        startedAt: meeting?.startedAt ?? null,
        viewerCount: viewerMap.get(meetId) ?? 0,
        // Split counters for clients that show "watching" and "joined"
        // separately. Here the participant aggregation IS the joined count;
        // preview watchers are the in-memory card audience. viewerCount is
        // untouched for existing consumers.
        joinedCount: viewerMap.get(meetId) ?? 0,
        watchingCount: getPreviewWatcherCount(w._id.toString()),
        totalViews: w.totalViews ?? 0,
        isScreenSharing: !!meeting?.screenSharingByUid,
        webinarType: "mediasoup" as const,
        // The owning org, alongside its name. Consumers that show ONE
        // organization's streams — a storefront's Livestreams tab — can then
        // tell whose row this is without matching on a display name.
        orgId: w.orgId.toString(),
        orgName: org?.name ?? "",
        // Two logo variants: colored (for light backgrounds) and white (for
        // dark backgrounds). orgLogo kept as the colored one for back-compat.
        orgLogo: org?.colored_logo ?? null,
        orgLogoColored: org?.colored_logo ?? null,
        orgLogoWhite: org?.white_logo ?? null,
        webinarLink: `${env.FRONTEND_URL}/webinar/${w._id.toString()}?public=1`,
      };
    });

    res.json({ success: true, workshops: result });
  } catch (error) {
    console.error("[WorkshopPreview/live-all]", error);
    res.status(500).json({ success: false, error: "Failed to get live workshops" });
  }
});

/**
 * GET /workshop-preview/:workshopId/pinned-product
 * The current pinned product for one webinar, read straight from the in-memory
 * mediasoup room — NO database work, so preview clients (e.g. Garage TV reels)
 * can poll it on a fast cadence to pick up pin/unpin near-instantly without
 * re-fetching the whole heavy live-all feed. Expired pins read as null.
 */
router.get("/:workshopId/pinned-product", (req, res) => {
  try {
    const { workshopId } = req.params;
    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshopId" });
    }
    const pin = getRoom(workshopId)?.pinnedProduct ?? null;
    const pinnedProduct =
      pin && (pin.pinnedUntil == null || pin.pinnedUntil > Date.now()) ? pin : null;
    res.json({ success: true, pinnedProduct });
  } catch (error) {
    console.error("[WorkshopPreview/pinned-product]", error);
    res.status(500).json({ success: false, error: "Failed to get pinned product" });
  }
});

export default router;
