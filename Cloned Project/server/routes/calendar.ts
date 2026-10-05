import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Availability } from "../models/availability.model";
import { Booking } from "../models/booking.model";
import { User } from "../models/user.model";
import { Event } from "../models/event.model";
import { CallBooking } from "../models/callBooking.model";
import { Types } from "mongoose";

const router = Router();

// Get/Set Availability for a specific organization
router.route("/availability")
  .get(requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

    let availabilities = await Availability.find({ userId: me.userId, orgId }).lean();

    // If no availability exists, create default weekday 9-5 availability
    if (availabilities.length === 0) {
      const defaultAvailability = [1, 2, 3, 4, 5].map(dayOfWeek => ({
        userId: me.userId,
        orgId,
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:00",
        enabled: true,
      }));

      // Also add disabled weekend availability
      defaultAvailability.push(
        { userId: me.userId, orgId, dayOfWeek: 0, startTime: "09:00", endTime: "17:00", enabled: false },
        { userId: me.userId, orgId, dayOfWeek: 6, startTime: "09:00", endTime: "17:00", enabled: false }
      );

      try {
        // Use insertMany with ordered: false to handle race conditions gracefully
        await Availability.insertMany(defaultAvailability, { ordered: false });
      } catch (error: any) {
        // Ignore duplicate key errors (E11000) - they mean availabilities were already created
        if (error.code !== 11000) {
          throw error; // Re-throw if it's not a duplicate key error
        }
      }

      availabilities = await Availability.find({ userId: me.userId, orgId }).lean();
    }

    res.json({ availabilities });
  })
  .post(requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

    const schema = z.array(z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      enabled: z.boolean(),
    }));
    const availabilities = schema.parse(req.body);

    const ops = availabilities.map(a => ({
      updateOne: {
        filter: { userId: me.userId, orgId, dayOfWeek: a.dayOfWeek },
        update: { $set: { startTime: a.startTime, endTime: a.endTime, enabled: a.enabled, orgId, userId: me.userId } },
        upsert: true,
      }
    }));
    if (ops.length) {
      await Availability.bulkWrite(ops);
    }
    res.json({ success: true });
  });

// Get available slots for a user on a specific date within a specific org
router.get("/:userId/slots", requireAuth, async (req, res) => {
  const { userId } = req.params;
  const { date, orgId } = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    orgId: z.string(),
  }).parse(req.query);

  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getUTCDay();

  // Check if user has any availability set up for this org
  const hasAnyAvailability = await Availability.exists({ userId, orgId });

  const availability = await Availability.findOne({ userId, orgId, dayOfWeek, enabled: true }).lean();
  if (!availability) {
    return res.json({ availableSlots: [], hasAvailability: !!hasAnyAvailability });
  }

  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const existingBookings = await Booking.find({
    orgId,
    bookedWithId: userId,
    startTime: { $gte: startOfDay, $lte: endOfDay },
    status: 'confirmed'
  }).lean();

  const [startHour, startMinute] = availability.startTime.split(':').map(Number);
  const [endHour, endMinute] = availability.endTime.split(':').map(Number);

  const slots = [];
  const slotDuration = 30; // 30 minutes
  let currentSlot = new Date(startOfDay);
  currentSlot.setUTCHours(startHour, startMinute);

  const endSlot = new Date(startOfDay);
  endSlot.setUTCHours(endHour, endMinute);

  // Get current time to filter out past slots when booking for today
  const now = new Date();

  while (currentSlot < endSlot) {
    const slotEnd = new Date(currentSlot.getTime() + slotDuration * 60 * 1000);
    if(slotEnd > endSlot) break;

    // Skip past time slots
    if (currentSlot <= now) {
      currentSlot = slotEnd;
      continue;
    }

    const isBooked = existingBookings.some(booking =>
      (currentSlot >= booking.startTime && currentSlot < booking.endTime) ||
      (slotEnd > booking.startTime && slotEnd <= booking.endTime)
    );

    if (!isBooked) {
      slots.push(new Date(currentSlot));
    }
    currentSlot = slotEnd;
  }

  res.json({ availableSlots: slots, hasAvailability: true });
});

// Get My Bookings for a specific org
router.get("/bookings", requireAuth, async (req, res) => {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
    if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

    const bookings = await Booking.find({
      orgId,
      $or: [{ bookerId: me.userId }, { bookedWithId: me.userId }],
      status: 'confirmed',
      startTime: { $gte: new Date() }
    })
    .populate('bookerId', 'name email')
    .populate('bookedWithId', 'name email')
    .sort({ startTime: 1 })
    .lean();
    
    res.json({ bookings });
});

// Create a booking in a specific org
router.post("/bookings", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  const schema = z.object({
    bookedWithId: z.string(),
    startTime: z.string().datetime(),
    title: z.string().min(1)
  });
  const { bookedWithId, startTime, title } = schema.parse(req.body);
  const slotDuration = 30; // 30 minutes
  
  const newBooking = await Booking.create({
    orgId,
    bookerId: me.userId,
    bookedWithId,
    startTime: new Date(startTime),
    endTime: new Date(new Date(startTime).getTime() + slotDuration * 60 * 1000),
    title,
  });
  
  res.status(201).json({ booking: newBooking });
});

// Cancel a booking in a specific org
router.patch("/bookings/:bookingId/cancel", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { orgId } = z.object({ orgId: z.string() }).parse(req.query);
  if (!orgId) return res.status(400).json({ error: "Organization ID is required" });

  const { bookingId } = req.params;

  const booking = await Booking.findOne({ _id: bookingId, orgId });

  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }

  // Only the person who booked or the person who was booked with can cancel
  if (booking.bookerId.toString() !== me.userId && booking.bookedWithId.toString() !== me.userId) {
    return res.status(403).json({ error: "You are not authorized to cancel this booking" });
  }

  booking.status = 'cancelled';
  await booking.save();

  res.json({ success: true, message: "Booking cancelled successfully" });
});

// ==================== UNIFIED CALENDAR ====================

/**
 * GET /calendar/unified
 * Get unified calendar view combining events and call bookings
 */
router.get("/unified", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId, startDate, endDate } = z.object({
      orgId: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).parse(req.query);

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID is required" });
    }

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const items: any[] = [];

    // 1. Fetch Events (where user is creator or invited)
    const eventQuery: any = {
      orgId: new Types.ObjectId(orgId),
      status: { $ne: "cancelled" },
      $or: [
        { creatorId: new Types.ObjectId(me.userId) },
        { invitedUserIds: new Types.ObjectId(me.userId) },
      ],
    };

    if (Object.keys(dateFilter).length > 0) {
      eventQuery.startTime = dateFilter;
    }

    const events = await Event.find(eventQuery)
      .populate("creatorId", "name email profilePicture")
      .sort({ startTime: 1 })
      .lean();

    for (const event of events) {
      items.push({
        _id: event._id.toString(),
        type: "event",
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        status: event.status,
        isLive: event.isLive,
        metadata: {
          creatorId: event.creatorId,
          invitedCount: event.invitedUserIds?.length || 0,
          isRepeating: event.isRepeating,
          publicJoinCode: event.publicJoinCode,
        },
      });
    }

    // 2. Fetch Call Bookings (where user is founder or booker)
    const callBookingQuery: any = {
      organizationId: new Types.ObjectId(orgId),
      status: { $ne: "cancelled" },
      $or: [
        { founderId: new Types.ObjectId(me.userId) },
        { bookerId: new Types.ObjectId(me.userId) },
      ],
    };

    if (Object.keys(dateFilter).length > 0) {
      callBookingQuery.startTime = dateFilter;
    }

    const callBookings = await CallBooking.find(callBookingQuery)
      .populate("callOfferingId", "title duration coverImage")
      .populate("founderId", "name email profilePicture")
      .populate("bookerId", "name email profilePicture")
      .sort({ startTime: 1 })
      .lean();

    for (const booking of callBookings) {
      const callOffering = booking.callOfferingId as any;
      const founder = booking.founderId as any;
      const booker = booking.bookerId as any;

      const isUserFounder = booking.founderId._id.toString() === me.userId;

      items.push({
        _id: booking._id.toString(),
        type: "call_booking",
        title: callOffering?.title || "1:1 Call",
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        metadata: {
          callOfferingId: callOffering?._id,
          callOfferingTitle: callOffering?.title,
          duration: callOffering?.duration,
          coverImage: callOffering?.coverImage,
          founder: isUserFounder ? null : founder,
          booker: isUserFounder ? booker : null,
          isUserFounder,
          rating: booking.rating,
          review: booking.review,
        },
      });
    }

    // 3. Fetch regular Bookings (existing booking system)
    const bookingQuery: any = {
      orgId: new Types.ObjectId(orgId),
      status: "confirmed",
      $or: [
        { bookerId: new Types.ObjectId(me.userId) },
        { bookedWithId: new Types.ObjectId(me.userId) },
      ],
    };

    if (Object.keys(dateFilter).length > 0) {
      bookingQuery.startTime = dateFilter;
    }

    const bookings = await Booking.find(bookingQuery)
      .populate("bookerId", "name email profilePicture")
      .populate("bookedWithId", "name email profilePicture")
      .sort({ startTime: 1 })
      .lean();

    for (const booking of bookings) {
      const booker = booking.bookerId as any;
      const bookedWith = booking.bookedWithId as any;
      const isUserBooker = booking.bookerId.toString() === me.userId;

      items.push({
        _id: booking._id.toString(),
        type: "booking",
        title: booking.title,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        metadata: {
          booker: isUserBooker ? null : booker,
          bookedWith: isUserBooker ? bookedWith : null,
          isUserBooker,
        },
      });
    }

    // Sort all items by startTime
    items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    res.json({
      success: true,
      items,
      counts: {
        events: events.length,
        callBookings: callBookings.length,
        bookings: bookings.length,
        total: items.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching unified calendar:", error);
    res.status(500).json({ error: error.message || "Failed to fetch calendar" });
  }
});

export default router;