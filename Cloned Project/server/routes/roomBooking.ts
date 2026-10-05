import { Router } from "express";
import { RoomBooking } from "../models/roomBooking.model";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";

const router = Router();

// Validation schemas
const createBookingSchema = z.object({
  // Optional for back-compat: old single-room UI didn't send it.
  // Multi-room clients always include it; conflict-detection scopes
  // per-room when present, falling back to org-wide otherwise.
  conferenceRoomId: z.string().optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  invitedUserIds: z.array(z.string()).min(1, "At least one member is required"),
});

const updateBookingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  invitedUserIds: z.array(z.string()).min(1).optional(),
});

/**
 * POST /room-bookings
 * Create a new room booking with conflict detection
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const orgId = req.query.orgId as string;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const validation = createBookingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { conferenceRoomId, title, description, startTime, endTime, invitedUserIds } = validation.data;

    if (conferenceRoomId && !Types.ObjectId.isValid(conferenceRoomId)) {
      return res.status(400).json({ error: "Invalid conferenceRoomId" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    if (start < new Date()) {
      return res.status(400).json({ error: "Start time must be in the future" });
    }

    // Conflict detection — when a conferenceRoomId is provided we scope
    // to that specific room (two rooms can be booked at the same time
    // by definition; the legacy "everything competes" behavior would
    // have been wrong for multi-room). Without a roomId we keep the
    // legacy org-wide behavior for back-compat.
    const conflictQuery: any = {
      status: "active",
      startTime: { $lt: end },
      endTime: { $gt: start },
    };
    if (conferenceRoomId) {
      conflictQuery.conferenceRoomId = new Types.ObjectId(conferenceRoomId);
    } else {
      conflictQuery.orgId = new Types.ObjectId(orgId);
    }
    const conflict = await RoomBooking.findOne(conflictQuery)
      .populate("creatorId", "name email")
      .lean();

    if (conflict) {
      return res.status(409).json({
        error: "Time slot conflicts with an existing booking",
        conflictingBooking: {
          _id: conflict._id,
          title: conflict.title,
          startTime: conflict.startTime,
          endTime: conflict.endTime,
          creator: conflict.creatorId,
        },
      });
    }

    // Ensure creator is included in invitedUserIds
    const invitedSet = new Set(invitedUserIds);
    invitedSet.add(me.userId);
    const invitedObjectIds = Array.from(invitedSet).map((id) => new Types.ObjectId(id));

    const booking = await RoomBooking.create({
      orgId: new Types.ObjectId(orgId),
      conferenceRoomId: conferenceRoomId
        ? new Types.ObjectId(conferenceRoomId)
        : undefined,
      creatorId: new Types.ObjectId(me.userId),
      title,
      description,
      startTime: start,
      endTime: end,
      invitedUserIds: invitedObjectIds,
    });

    await booking.populate([
      { path: "creatorId", select: "name email profilePicture" },
      { path: "invitedUserIds", select: "name email profilePicture" },
    ]);

    // Emit socket event to all org workspace members
    const io = getSocketInstance();
    if (io) {
      io.to("workspace").emit("room-booking:created", {
        booking,
        orgId,
      });
      console.log(`[RoomBooking] Booking created and broadcasted to workspace`);
    }

    return res.status(201).json({ booking });
  } catch (error: any) {
    console.error("Error creating room booking:", error);
    return res.status(500).json({ error: "Failed to create booking", details: error.message });
  }
});

/**
 * GET /room-bookings
 * List bookings for org (active + upcoming)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    const conferenceRoomId = req.query.conferenceRoomId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }
    if (conferenceRoomId && !Types.ObjectId.isValid(conferenceRoomId)) {
      return res.status(400).json({ error: "Invalid conferenceRoomId" });
    }

    const query: any = {
      orgId: new Types.ObjectId(orgId),
      status: "active",
    };
    if (conferenceRoomId) {
      query.conferenceRoomId = new Types.ObjectId(conferenceRoomId);
    }

    // Default: only show bookings that haven't ended yet
    if (startDate || endDate) {
      if (startDate) query.startTime = { ...query.startTime, $gte: new Date(startDate) };
      if (endDate) query.endTime = { ...query.endTime, $lte: new Date(endDate) };
    } else {
      query.endTime = { $gte: new Date() };
    }

    const bookings = await RoomBooking.find(query)
      .populate("creatorId", "name email profilePicture")
      .populate("invitedUserIds", "name email profilePicture")
      .sort({ startTime: 1 })
      .lean();

    return res.json({ bookings });
  } catch (error: any) {
    console.error("Error fetching room bookings:", error);
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

/**
 * GET /room-bookings/current
 * Get the currently active booking for the org's meeting room
 */
router.get("/current", requireAuth, async (req, res) => {
  try {
    const orgId = req.query.orgId as string;
    const conferenceRoomId = req.query.conferenceRoomId as string | undefined;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }
    if (conferenceRoomId && !Types.ObjectId.isValid(conferenceRoomId)) {
      return res.status(400).json({ error: "Invalid conferenceRoomId" });
    }

    const now = new Date();

    // When a roomId is supplied scope to that specific room, otherwise
    // fall back to the legacy org-wide query path.
    const baseQuery: any = {
      status: "active",
      startTime: { $lte: now },
      endTime: { $gte: now },
    };
    if (conferenceRoomId) {
      baseQuery.conferenceRoomId = new Types.ObjectId(conferenceRoomId);
    } else {
      baseQuery.orgId = new Types.ObjectId(orgId);
    }

    const booking = await RoomBooking.findOne(baseQuery)
      .populate("creatorId", "name email profilePicture")
      .populate("invitedUserIds", "name email profilePicture")
      .lean();

    return res.json({ booking: booking || null });
  } catch (error: any) {
    console.error("Error fetching current room booking:", error);
    return res.status(500).json({ error: "Failed to fetch current booking" });
  }
});

/**
 * PATCH /room-bookings/:id
 * Update a booking (creator only)
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const orgId = req.query.orgId as string;
    const bookingId = req.params.id;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const booking = await RoomBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.creatorId.toString() !== me.userId) {
      return res.status(403).json({ error: "Only the creator can update this booking" });
    }

    if (booking.status !== "active") {
      return res.status(400).json({ error: "Only active bookings can be updated" });
    }

    const validation = updateBookingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const updates = validation.data;

    // If times are being changed, re-run conflict detection
    const newStart = updates.startTime ? new Date(updates.startTime) : booking.startTime;
    const newEnd = updates.endTime ? new Date(updates.endTime) : booking.endTime;

    if (newEnd <= newStart) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    if (updates.startTime || updates.endTime) {
      const conflict = await RoomBooking.findOne({
        _id: { $ne: booking._id },
        orgId: new Types.ObjectId(orgId),
        status: "active",
        startTime: { $lt: newEnd },
        endTime: { $gt: newStart },
      }).lean();

      if (conflict) {
        return res.status(409).json({
          error: "Updated time slot conflicts with an existing booking",
        });
      }
    }

    // Apply updates
    if (updates.title) booking.title = updates.title;
    if (updates.description !== undefined) booking.description = updates.description;
    if (updates.startTime) booking.startTime = newStart;
    if (updates.endTime) booking.endTime = newEnd;
    if (updates.invitedUserIds) {
      const invitedSet = new Set(updates.invitedUserIds);
      invitedSet.add(me.userId);
      booking.invitedUserIds = Array.from(invitedSet).map((id) => new Types.ObjectId(id));
    }

    await booking.save();
    await booking.populate([
      { path: "creatorId", select: "name email profilePicture" },
      { path: "invitedUserIds", select: "name email profilePicture" },
    ]);

    const io = getSocketInstance();
    if (io) {
      io.to("workspace").emit("room-booking:updated", { booking, orgId });
    }

    return res.json({ booking });
  } catch (error: any) {
    console.error("Error updating room booking:", error);
    return res.status(500).json({ error: "Failed to update booking" });
  }
});

/**
 * PATCH /room-bookings/:id/cancel
 * Cancel a booking (creator only)
 */
router.patch("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user;
    const orgId = req.query.orgId as string;
    const bookingId = req.params.id;

    if (!orgId) {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const booking = await RoomBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.creatorId.toString() !== me.userId) {
      return res.status(403).json({ error: "Only the creator can cancel this booking" });
    }

    if (booking.status !== "active") {
      return res.status(400).json({ error: "Only active bookings can be cancelled" });
    }

    booking.status = "cancelled";
    await booking.save();

    const io = getSocketInstance();
    if (io) {
      io.to("workspace").emit("room-booking:cancelled", { bookingId, orgId });
    }

    return res.json({ message: "Booking cancelled", booking });
  } catch (error: any) {
    console.error("Error cancelling room booking:", error);
    return res.status(500).json({ error: "Failed to cancel booking" });
  }
});

export default router;
