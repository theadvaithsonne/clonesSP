import { Router } from "express";
import { Event } from "../models/event.model";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";
import { generatePublicJoinCode } from "../utils/guestToken";
import { sendEventGuestInvitation, sendEventCancellationEmail } from "../services/mailer";
import { User } from "../models/user.model";
import { EventGuest } from "../models/eventGuest.model";

const router = Router();

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  invitedUserIds: z.array(z.string()).optional().default([]),
  guestEmails: z.array(z.string().email()).optional().default([]),
  isRepeating: z.boolean().optional().default(false)
}).refine(
  (data) => data.invitedUserIds.length > 0 || data.guestEmails.length > 0,
  { message: "At least one internal user or guest email is required" }
);

const listEventsSchema = z.object({
  orgId: z.string(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

/**
 * POST /events
 * Create a new event with multiple invitees
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    // Validate request body
    const validation = createEventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { title, description, startTime, endTime, invitedUserIds, guestEmails, isRepeating } = validation.data;

    // Validate times
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    if (start < new Date()) {
      return res.status(400).json({ error: "Start time must be in the future" });
    }

    // Convert string IDs to ObjectIds
    const invitedObjectIds = invitedUserIds.map(id => new Types.ObjectId(id));

    // Generate public join code for the event (like Google Meet)
    const publicJoinCode = generatePublicJoinCode();

    // Store guest emails without individual tokens (we use public join code now)
    const guestInvitations = guestEmails.map(email => ({
      email: email.toLowerCase().trim(),
      status: 'pending' as const
    }));

    // Create the event
    const newEvent = await Event.create({
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId),
      title,
      description,
      startTime: start,
      endTime: end,
      invitedUserIds: invitedObjectIds,
      guestInvitations,
      publicJoinCode,
      videoCallInfo: {
        agoraChannel: '', // Will be set when first user joins
        createdAt: new Date()
      },
      status: 'scheduled',
      isRepeating
    });

    // Populate creator and invitees
    await newEvent.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'invitedUserIds', select: 'name email profilePicture' }
    ]);

    // Send email invitations to guests with the public join link
    if (guestEmails.length > 0) {
      const creator = newEvent.creatorId as any;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const publicJoinLink = `${frontendUrl}/guest/event-join?code=${newEvent.publicJoinCode}`;

      for (const invitation of newEvent.guestInvitations) {
        try {
          await sendEventGuestInvitation(
            invitation.email,
            {
              title: newEvent.title,
              description: newEvent.description || '',
              startTime: newEvent.startTime,
              endTime: newEvent.endTime,
              creatorName: creator.name
            },
            publicJoinLink // Same link for all guests
          );
          console.log(`[Events API] Sent invitation email to ${invitation.email}`);
        } catch (emailError) {
          console.error(`[Events API] Failed to send invitation to ${invitation.email}:`, emailError);
          // Continue even if email fails
        }
      }
    }

    // Emit socket event to all invited users and creator for real-time updates
    const io = getSocketInstance();
    if (io) {
      const notifyUserIds = [...invitedUserIds, me.userId];

      notifyUserIds.forEach((userId) => {
        const userRoom = `user:${userId.toString()}`;
        io.to(userRoom).emit("event:created", {
          event: newEvent,
          orgId: orgId
        });
        console.log(`[Events API] Emitted event:created to room: ${userRoom}`);
      });

      console.log(`[Events API] Event created and notified ${notifyUserIds.length} users`);
    }

    return res.status(201).json({ event: newEvent });
  } catch (error: any) {
    console.error("Error creating event:", error);
    return res.status(500).json({ error: "Failed to create event", details: error.message });
  }
});

/**
 * GET /events
 * List all events for the current user (created by them or invited to)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const orgId = req.query.orgId as string;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    console.log("[Events API] GET /events - userId:", me.userId, "orgId:", orgId);

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    // Build query
    const query: any = {
      orgId: new Types.ObjectId(orgId),
      $or: [
        { creatorId: new Types.ObjectId(me.userId) },
        { invitedUserIds: new Types.ObjectId(me.userId) }
      ],
      status: { $in: ['scheduled', 'completed'] }
    };

    console.log("[Events API] Query:", JSON.stringify(query));

    // Add date range filter if provided
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) {
        query.startTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startTime.$lte = new Date(endDate);
      }
    }

    const events = await Event.find(query)
      .populate('creatorId', 'name email profilePicture')
      .populate('invitedUserIds', 'name email profilePicture')
      .sort({ startTime: 1 });

    // Auto-generate publicJoinCode for events that don't have one (backward compatibility)
    for (const event of events) {
      if (!event.publicJoinCode) {
        event.publicJoinCode = generatePublicJoinCode();
        await event.save();
        console.log(`[Events API] Generated publicJoinCode for event ${event._id}: ${event.publicJoinCode}`);
      }
    }

    // Convert to lean objects for response
    const eventsData = events.map(e => e.toObject());

    console.log("[Events API] Found events:", eventsData.length);

    return res.json({ events: eventsData });
  } catch (error: any) {
    console.error("Error fetching events:", error);
    return res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * GET /events/active
 * Get currently active events (started but not ended yet)
 */
router.get("/active", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const now = new Date();

    const events = await Event.find({
      orgId: new Types.ObjectId(orgId),
      $or: [
        { creatorId: new Types.ObjectId(me.userId) },
        { invitedUserIds: new Types.ObjectId(me.userId) }
      ],
      status: 'scheduled',
      startTime: { $lte: now },
      endTime: { $gte: now }
    })
      .populate('creatorId', 'name email profilePicture')
      .populate('invitedUserIds', 'name email profilePicture')
      .sort({ startTime: 1 })
      .lean();

    return res.json({ events });
  } catch (error: any) {
    console.error("Error fetching active events:", error);
    return res.status(500).json({ error: "Failed to fetch active events" });
  }
});

/**
 * GET /events/:eventId
 * Get details of a specific event
 */
router.get("/:eventId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      $or: [
        { creatorId: new Types.ObjectId(me.userId) },
        { invitedUserIds: new Types.ObjectId(me.userId) }
      ]
    })
      .populate('creatorId', 'name email profilePicture')
      .populate('invitedUserIds', 'name email profilePicture')
      .lean();

    if (!event) {
      return res.status(404).json({ error: "Event not found or access denied" });
    }

    return res.json({ event });
  } catch (error: any) {
    console.error("Error fetching event:", error);
    return res.status(500).json({ error: "Failed to fetch event" });
  }
});

/**
 * GET /events/:eventId/guests
 * Get guests who have joined an event (for video call participant display)
 */
router.get("/:eventId/guests", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Verify the user has access to this event
    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      $or: [
        { creatorId: new Types.ObjectId(me.userId) },
        { invitedUserIds: new Types.ObjectId(me.userId) }
      ]
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or access denied" });
    }

    // Get guests who have joined
    const guests = await EventGuest.find({
      eventId: new Types.ObjectId(eventId),
      leftAt: null // Only active guests
    }).select('displayName email joinedAt').lean();

    return res.json({
      success: true,
      guests: guests.map(guest => ({
        name: guest.displayName,
        email: guest.email,
        joinedAt: guest.joinedAt
      }))
    });
  } catch (error: any) {
    console.error("Error fetching event guests:", error);
    return res.status(500).json({ error: "Failed to fetch event guests" });
  }
});

// Validation schema for updating events
const updateEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isRepeating: z.boolean().optional()
});

/**
 * PATCH /events/:eventId
 * Update an event (only creator can update)
 */
router.patch("/:eventId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Validate request body
    const validation = updateEventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const updates = validation.data;

    // Find the event (only creator can update)
    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId)
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or you don't have permission to update it" });
    }

    // Validate times if both are provided or if one changes
    if (updates.startTime || updates.endTime) {
      const newStart = updates.startTime ? new Date(updates.startTime) : event.startTime;
      const newEnd = updates.endTime ? new Date(updates.endTime) : event.endTime;

      if (newEnd <= newStart) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      if (updates.startTime) event.startTime = newStart;
      if (updates.endTime) event.endTime = newEnd;
    }

    // Update other fields
    if (updates.title !== undefined) event.title = updates.title;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.isRepeating !== undefined) event.isRepeating = updates.isRepeating;

    await event.save();

    // Populate and return
    await event.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'invitedUserIds', select: 'name email profilePicture' }
    ]);

    return res.json({ event });
  } catch (error: any) {
    console.error("Error updating event:", error);
    return res.status(500).json({ error: "Failed to update event" });
  }
});

/**
 * PATCH /events/:eventId/start
 * Start an event (make it live) - only creator can start
 * This allows the host to start the meeting at any time, making it joinable for all participants
 */
router.patch("/:eventId/start", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Find the event (only creator can start)
    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId),
      status: 'scheduled'
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or you don't have permission to start it" });
    }

    if (event.isLive) {
      return res.status(400).json({ error: "Event is already live" });
    }

    // Mark the event as live
    event.isLive = true;
    event.liveStartedAt = new Date();
    await event.save();

    // Populate and return
    await event.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'invitedUserIds', select: 'name email profilePicture' }
    ]);

    // Emit socket event to all invited users for real-time updates
    const io = getSocketInstance();
    if (io) {
      const invitedIds = event.invitedUserIds.map((u: any) => u._id?.toString() || u.toString());
      const notifyUserIds = [...invitedIds, me.userId];

      notifyUserIds.forEach((userId) => {
        const userRoom = `user:${userId.toString()}`;
        io.to(userRoom).emit("event:started", {
          eventId: event._id.toString(),
          event: event,
          orgId: orgId
        });
        console.log(`[Events API] Emitted event:started to room: ${userRoom}`);
      });

      console.log(`[Events API] Event ${eventId} started by ${me.userId}, notified ${notifyUserIds.length} users`);
    }

    return res.json({ event, message: "Event is now live" });
  } catch (error: any) {
    console.error("Error starting event:", error);
    return res.status(500).json({ error: "Failed to start event" });
  }
});

/**
 * PATCH /events/:eventId/end
 * End an event (stop it from being live) - only creator can end
 */
router.patch("/:eventId/end", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    // Find the event (only creator can end)
    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId)
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or you don't have permission to end it" });
    }

    if (!event.isLive) {
      return res.status(400).json({ error: "Event is not live" });
    }

    // Mark the event as not live
    event.isLive = false;
    event.status = 'completed';
    await event.save();

    // Populate and return
    await event.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'invitedUserIds', select: 'name email profilePicture' }
    ]);

    // Emit socket event to all invited users for real-time updates
    const io = getSocketInstance();
    if (io) {
      const invitedIds = event.invitedUserIds.map((u: any) => u._id?.toString() || u.toString());
      const notifyUserIds = [...invitedIds, me.userId];

      notifyUserIds.forEach((userId) => {
        const userRoom = `user:${userId.toString()}`;
        io.to(userRoom).emit("event:ended", {
          eventId: event._id.toString(),
          event: event,
          orgId: orgId
        });
        console.log(`[Events API] Emitted event:ended to room: ${userRoom}`);
      });

      console.log(`[Events API] Event ${eventId} ended by ${me.userId}, notified ${notifyUserIds.length} users`);
    }

    return res.json({ event, message: "Event has ended" });
  } catch (error: any) {
    console.error("Error ending event:", error);
    return res.status(500).json({ error: "Failed to end event" });
  }
});

/**
 * PATCH /events/:eventId/members
 * Update event members (add/remove team members and guests)
 * Only creator can update members
 */
router.patch("/:eventId/members", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    const {
      addUserIds = [],
      removeUserIds = [],
      addGuestEmails = [],
      removeGuestEmails = []
    } = req.body;

    // Find the event (only creator can update members)
    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId),
      status: 'scheduled'
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or you don't have permission to update it" });
    }

    // Get creator info for emails
    const creator = await User.findById(me.userId).select('name email');
    const creatorName = creator?.name || creator?.email || 'Event Organizer';

    const io = getSocketInstance();
    const removedUserIds: string[] = [];
    const addedUserIds: string[] = [];

    // Remove team members
    if (removeUserIds.length > 0) {
      const removeObjectIds = removeUserIds.map((id: string) => new Types.ObjectId(id));
      event.invitedUserIds = event.invitedUserIds.filter(
        (userId) => !removeObjectIds.some((removeId: Types.ObjectId) => removeId.equals(userId))
      );
      removedUserIds.push(...removeUserIds);
    }

    // Add new team members
    if (addUserIds.length > 0) {
      const existingIds = event.invitedUserIds.map(id => id.toString());
      const newUserIds = addUserIds.filter((id: string) => !existingIds.includes(id));
      event.invitedUserIds.push(...newUserIds.map((id: string) => new Types.ObjectId(id)));
      addedUserIds.push(...newUserIds);
    }

    // Remove guests and send cancellation emails
    if (removeGuestEmails.length > 0) {
      const removedGuests = event.guestInvitations.filter(
        (guest) => removeGuestEmails.includes(guest.email.toLowerCase())
      );

      // Send cancellation emails to removed guests
      for (const guest of removedGuests) {
        try {
          await sendEventCancellationEmail(guest.email, {
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            creatorName
          });
          console.log(`[Events API] Sent cancellation email to ${guest.email}`);
        } catch (emailError) {
          console.error(`[Events API] Failed to send cancellation email to ${guest.email}:`, emailError);
        }
      }

      // Remove guests from the event
      event.guestInvitations = event.guestInvitations.filter(
        (guest) => !removeGuestEmails.includes(guest.email.toLowerCase())
      );
    }

    // Add new guests and send invitation emails with public join link
    if (addGuestEmails.length > 0) {
      const existingEmails = event.guestInvitations.map(g => g.email.toLowerCase());
      const newGuestEmails = addGuestEmails
        .map((e: string) => e.toLowerCase().trim())
        .filter((e: string) => !existingEmails.includes(e));

      // Use public join link (same for all guests)
      const publicJoinLink = `${process.env.FRONTEND_URL}/guest/event-join?code=${event.publicJoinCode}`;

      for (const email of newGuestEmails) {
        event.guestInvitations.push({
          email,
          status: 'pending'
        });

        // Send invitation email with public join link
        try {
          await sendEventGuestInvitation(email, {
            title: event.title,
            description: event.description || '',
            startTime: event.startTime,
            endTime: event.endTime,
            creatorName
          }, publicJoinLink);
          console.log(`[Events API] Sent invitation email to new guest ${email}`);
        } catch (emailError) {
          console.error(`[Events API] Failed to send invitation email to ${email}:`, emailError);
        }
      }
    }

    await event.save();

    // Populate and return
    await event.populate([
      { path: 'creatorId', select: 'name email profilePicture' },
      { path: 'invitedUserIds', select: 'name email profilePicture' }
    ]);

    // Emit socket events
    if (io) {
      // Notify removed team members
      for (const userId of removedUserIds) {
        const userRoom = `user:${userId}`;
        io.to(userRoom).emit("event:member-removed", {
          eventId: event._id.toString(),
          userId,
          orgId
        });
        console.log(`[Events API] Emitted event:member-removed to ${userRoom}`);
      }

      // Notify added team members about the new event
      for (const userId of addedUserIds) {
        const userRoom = `user:${userId}`;
        io.to(userRoom).emit("event:created", {
          event: event,
          orgId
        });
        console.log(`[Events API] Emitted event:created to new member ${userRoom}`);
      }

      // Notify all current members about the update
      const currentMemberIds = event.invitedUserIds.map((u: any) => u._id?.toString() || u.toString());
      const notifyIds = [...currentMemberIds, me.userId];

      for (const userId of notifyIds) {
        const userRoom = `user:${userId}`;
        io.to(userRoom).emit("event:members-updated", {
          eventId: event._id.toString(),
          event: event,
          orgId
        });
      }

      console.log(`[Events API] Event ${eventId} members updated by ${me.userId}`);
    }

    return res.json({
      event,
      message: "Event members updated successfully",
      changes: {
        addedUsers: addedUserIds.length,
        removedUsers: removedUserIds.length,
        addedGuests: addGuestEmails.length,
        removedGuests: removeGuestEmails.length
      }
    });
  } catch (error: any) {
    console.error("Error updating event members:", error);
    return res.status(500).json({ error: "Failed to update event members" });
  }
});

/**
 * PATCH /events/:eventId/cancel
 * Cancel an event (only creator can cancel)
 */
router.patch("/:eventId/cancel", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    const event = await Event.findOne({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId),
      status: 'scheduled'
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or you don't have permission to cancel it" });
    }

    event.status = 'cancelled';
    await event.save();

    return res.json({ message: "Event cancelled successfully", event });
  } catch (error: any) {
    console.error("Error cancelling event:", error);
    return res.status(500).json({ error: "Failed to cancel event" });
  }
});

/**
 * DELETE /events/:eventId
 * Delete an event (only creator can delete)
 */
router.delete("/:eventId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const { eventId } = req.params;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID" });
    }

    const event = await Event.findOneAndDelete({
      _id: new Types.ObjectId(eventId),
      orgId: new Types.ObjectId(orgId),
      creatorId: new Types.ObjectId(me.userId)
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found or you don't have permission to delete it" });
    }

    return res.json({ message: "Event deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting event:", error);
    return res.status(500).json({ error: "Failed to delete event" });
  }
});


export default router;
