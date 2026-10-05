import { Router } from "express";
import { Meet } from "../models/meet.model";
import { MeetParticipant } from "../models/meetParticipant.model";
import { z } from "zod";
import { Types } from "mongoose";
import { generateMeetJoinCode, generateMeetAgoraChannel } from "../utils/meetCode";
import { createRoom, getLivekitUrl } from "../services/livekit";
import { env } from "../config/env";

const router = Router();

// Validation schema for creating a meet
const createMeetSchema = z.object({
  hostEmail: z.string().email("Valid host email is required"),
  orgId: z.string().min(1, "Organization ID is required"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime("Valid start time is required"),
  endTime: z.string().datetime("Valid end time is required")
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "End time must be after start time" }
);

/**
 * POST /meet/create
 * Create a new meet and return the join link
 * This is an open API - no authentication required
 * The host will verify via OTP when they join
 */
router.post("/create", async (req, res) => {
  try {
    // Validate request body
    const validation = createMeetSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.issues[0].message
      });
    }

    const { hostEmail, orgId, title, description, startTime, endTime } = validation.data;

    // Validate org ID format
    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid organization ID format"
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Generate unique join code
    const joinCode = generateMeetJoinCode();
    const roomName = generateMeetAgoraChannel(joinCode);

    // Create LiveKit room for the meeting
    const room = await createRoom(roomName);

    // Create the meet
    const newMeet = await Meet.create({
      orgId: new Types.ObjectId(orgId),
      hostEmail: hostEmail.toLowerCase().trim(),
      title: title.trim(),
      description: description?.trim(),
      startTime: start,
      endTime: end,
      joinCode,
      agoraChannel: roomName,
      status: 'scheduled',
      isHostVerified: false
    });

    // Generate the join link
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const joinLink = `${frontendUrl}/meet/join?code=${joinCode}`;

    console.log(`[Meet API] Created meet ${newMeet._id} with joinCode: ${joinCode}, LiveKit room: ${room.name}`);

    return res.status(201).json({
      success: true,
      data: {
        meetId: newMeet._id.toString(),
        joinCode,
        joinLink,
        roomName,
        livekitServerUrl: getLivekitUrl(),
        title: newMeet.title,
        description: newMeet.description,
        startTime: newMeet.startTime,
        endTime: newMeet.endTime,
        hostEmail: newMeet.hostEmail
      }
    });
  } catch (error: any) {
    console.error("[Meet API] Error creating meet:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create meeting",
      details: error.message
    });
  }
});

/**
 * GET /meet/list
 * List all meets for an organization
 * Query params: orgId, status (optional), startDate (optional), endDate (optional)
 */
router.get("/list", async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "orgId query parameter is required"
      });
    }

    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid organization ID format"
      });
    }

    // Build query
    const query: any = {
      orgId: new Types.ObjectId(orgId)
    };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) {
        query.startTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startTime.$lte = new Date(endDate);
      }
    }

    const meets = await Meet.find(query)
      .sort({ startTime: -1 })
      .lean();

    // Generate join links for each meet
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const meetsWithLinks = meets.map(meet => ({
      ...meet,
      joinLink: `${frontendUrl}/meet/join?code=${meet.joinCode}`
    }));

    return res.json({
      success: true,
      data: meetsWithLinks
    });
  } catch (error: any) {
    console.error("[Meet API] Error listing meets:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to list meetings"
    });
  }
});

/**
 * GET /meet/:meetId
 * Get details of a specific meet
 */
router.get("/:meetId", async (req, res) => {
  try {
    const { meetId } = req.params;

    if (!Types.ObjectId.isValid(meetId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid meet ID"
      });
    }

    const meet = await Meet.findById(meetId).lean();

    if (!meet) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found"
      });
    }

    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3000';

    return res.json({
      success: true,
      data: {
        ...meet,
        joinLink: `${frontendUrl}/meet/join?code=${meet.joinCode}`
      }
    });
  } catch (error: any) {
    console.error("[Meet API] Error fetching meet:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch meeting"
    });
  }
});

/**
 * GET /meet/:meetId/participants
 * Get participants of a meet
 */
router.get("/:meetId/participants", async (req, res) => {
  try {
    const { meetId } = req.params;

    if (!Types.ObjectId.isValid(meetId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid meet ID"
      });
    }

    const participants = await MeetParticipant.find({
      meetId: new Types.ObjectId(meetId),
      leftAt: null // Only active participants
    }).lean();

    return res.json({
      success: true,
      data: participants
    });
  } catch (error: any) {
    console.error("[Meet API] Error fetching participants:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch participants"
    });
  }
});

/**
 * PATCH /meet/:meetId/cancel
 * Cancel a meet
 */
router.patch("/:meetId/cancel", async (req, res) => {
  try {
    const { meetId } = req.params;

    if (!Types.ObjectId.isValid(meetId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid meet ID"
      });
    }

    const meet = await Meet.findByIdAndUpdate(
      meetId,
      { status: 'cancelled' },
      { new: true }
    );

    if (!meet) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found"
      });
    }

    return res.json({
      success: true,
      message: "Meeting cancelled successfully",
      data: meet
    });
  } catch (error: any) {
    console.error("[Meet API] Error cancelling meet:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to cancel meeting"
    });
  }
});

export default router;
