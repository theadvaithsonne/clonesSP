// src/routes/callBooking.ts
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { Types } from "mongoose";
import * as callService from "../services/call";
import { CallBooking } from "../models/callBooking.model";
import { CallPurchase } from "../models/callPurchase.model";
import { CallOffering } from "../models/callOffering.model";
import { User } from "../models/user.model";

const router = Router();

// Helper to check if user is founder of the org
async function isFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const membership = user.organizations?.find(
    (org) => org.organization.toString() === orgId
  );

  return membership ? hasFounderAccess(membership) : false;
}

// ==================== SLOT MANAGEMENT ====================

// Get founder's available slots for a specific call offering and date
router.get("/founder/slots", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { founderId, callOfferingId, date } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    if (!founderId || !callOfferingId || !date) {
      return res.status(400).json({
        error: "founderId, callOfferingId, and date are required",
      });
    }

    const dateObj = new Date(date as string);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const slots = await callService.getFounderAvailableSlots(
      founderId as string,
      callOfferingId as string,
      dateObj,
      orgId
    );

    res.json({ success: true, slots });
  } catch (error: any) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ==================== BOOKING MANAGEMENT ====================

// Create a booking (stakeholder picks a slot)
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const { callPurchaseId, startTime, bookingNotes } = req.body;

    if (!callPurchaseId || !startTime) {
      return res.status(400).json({
        error: "callPurchaseId and startTime are required",
      });
    }

    // Verify user owns the purchase
    const purchase = await CallPurchase.findById(callPurchaseId);
    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    if (purchase.userId.toString() !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (purchase.organizationId.toString() !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const booking = await callService.createCallBooking({
      callPurchaseId,
      startTime: new Date(startTime),
      bookingNotes,
    });

    // Populate the booking details
    const populatedBooking = await CallBooking.findById(booking._id)
      .populate("callOfferingId", "title duration coverImage")
      .populate("founderId", "name email profilePicture")
      .populate("bookerId", "name email profilePicture")
      .lean();

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: populatedBooking,
    });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get user's bookings (as booker)
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const bookings = await callService.getBookerBookings(userId, orgId);

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get founder's bookings
router.get("/founder", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const isUserFounder = await isFounder(userId, orgId);
    if (!isUserFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can view founder bookings" });
    }

    const { status, startDate, endDate } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const bookings = await callService.getFounderBookings(userId, orgId, filters);

    res.json({ success: true, bookings });
  } catch (error: any) {
    console.error("Error fetching founder bookings:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get booking details
router.get("/:bookingId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const userId = me.userId;

    if (!orgId || !userId) {
      return res.status(400).json({ error: "Organization ID required" });
    }

    const booking = await CallBooking.findById(bookingId)
      .populate("callOfferingId", "title duration coverImage intakeQuestions")
      .populate("founderId", "name email profilePicture")
      .populate("bookerId", "name email profilePicture")
      .populate("callPurchaseId", "intakeAnswers")
      .lean();

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check access
    const isUserFounder = await isFounder(userId, orgId);
    const isBooker = booking.bookerId._id.toString() === userId;
    const isCallFounder = booking.founderId._id.toString() === userId;

    if (!isUserFounder && !isBooker && !isCallFounder) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ success: true, booking });
  } catch (error: any) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Mark booking as completed (founder only)
router.patch(
  "/:bookingId/complete",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const me = (req as any).user as { userId: string; organizationId: string };
      const orgId = (req.query.orgId as string) || me.organizationId;
      const userId = me.userId;

      if (!orgId || !userId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      // Verify user is the founder for this booking
      const existingBooking = await CallBooking.findById(bookingId);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (existingBooking.founderId.toString() !== userId) {
        return res
          .status(403)
          .json({ error: "Only the call founder can complete the booking" });
      }

      const { founderNotes } = req.body;

      const booking = await callService.completeCallBooking(
        bookingId,
        userId,
        founderNotes
      );

      res.json({
        success: true,
        message: "Booking marked as completed",
        booking,
      });
    } catch (error: any) {
      console.error("Error completing booking:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

// Cancel booking
router.patch(
  "/:bookingId/cancel",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const me = (req as any).user as { userId: string; organizationId: string };
      const orgId = (req.query.orgId as string) || me.organizationId;
      const userId = me.userId;

      if (!orgId || !userId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      // Verify user has access to cancel
      const existingBooking = await CallBooking.findById(bookingId);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const isUserFounder = await isFounder(userId, orgId);
      const isBooker = existingBooking.bookerId.toString() === userId;
      const isCallFounder = existingBooking.founderId.toString() === userId;

      if (!isUserFounder && !isBooker && !isCallFounder) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { reason } = req.body;

      const booking = await callService.cancelCallBooking(
        bookingId,
        userId,
        reason
      );

      res.json({
        success: true,
        message: "Booking cancelled",
        booking,
      });
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

// Reschedule booking
router.patch(
  "/:bookingId/reschedule",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const me = (req as any).user as { userId: string; organizationId: string };
      const orgId = (req.query.orgId as string) || me.organizationId;
      const userId = me.userId;

      if (!orgId || !userId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { newStartTime } = req.body;

      if (!newStartTime) {
        return res.status(400).json({ error: "newStartTime is required" });
      }

      // Verify user has access to reschedule
      const existingBooking = await CallBooking.findById(bookingId);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const isBooker = existingBooking.bookerId.toString() === userId;
      const isCallFounder = existingBooking.founderId.toString() === userId;

      if (!isBooker && !isCallFounder) {
        return res.status(403).json({
          error: "Only the booker or call founder can reschedule",
        });
      }

      const booking = await callService.rescheduleCallBooking(
        bookingId,
        new Date(newStartTime)
      );

      res.json({
        success: true,
        message: "Booking rescheduled",
        booking,
      });
    } catch (error: any) {
      console.error("Error rescheduling booking:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

// Rate a completed booking (booker only)
router.post(
  "/:bookingId/rate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const me = (req as any).user as { userId: string; organizationId: string };
      const orgId = (req.query.orgId as string) || me.organizationId;
      const userId = me.userId;

      if (!orgId || !userId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const { rating, review } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      // Verify user is the booker
      const existingBooking = await CallBooking.findById(bookingId);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (existingBooking.bookerId.toString() !== userId) {
        return res
          .status(403)
          .json({ error: "Only the booker can rate the call" });
      }

      const booking = await callService.rateCallBooking(
        bookingId,
        rating,
        review
      );

      res.json({
        success: true,
        message: "Rating submitted",
        booking,
      });
    } catch (error: any) {
      console.error("Error rating booking:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

// Mark booking as no-show (founder only)
router.patch(
  "/:bookingId/no-show",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { bookingId } = req.params;
      const me = (req as any).user as { userId: string; organizationId: string };
      const orgId = (req.query.orgId as string) || me.organizationId;
      const userId = me.userId;

      if (!orgId || !userId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      // Verify user is the founder for this booking
      const existingBooking = await CallBooking.findById(bookingId);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (existingBooking.founderId.toString() !== userId) {
        return res
          .status(403)
          .json({ error: "Only the call founder can mark as no-show" });
      }

      if (existingBooking.status !== "scheduled") {
        return res
          .status(400)
          .json({ error: "Only scheduled bookings can be marked as no-show" });
      }

      existingBooking.status = "no_show";
      await existingBooking.save();

      // Update purchase stats - count as used since the slot was held
      await CallPurchase.findByIdAndUpdate(existingBooking.callPurchaseId, {
        $inc: { quantityUsed: 1, quantityScheduled: -1 },
      });

      // Update call offering stats
      await CallOffering.findByIdAndUpdate(existingBooking.callOfferingId, {
        $inc: { totalUsed: 1 },
      });

      res.json({
        success: true,
        message: "Booking marked as no-show",
        booking: existingBooking,
      });
    } catch (error: any) {
      console.error("Error marking no-show:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

export default router;
