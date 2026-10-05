import { Request, Response } from "express";
import { CoworkingSpaceBooking } from "../models/coworkingSpaceBooking.model";
import { CoworkingSpace } from "../models/coworkingSpace.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { z } from "zod";
import { ok, fail } from "../utils/http";

// Validation schemas
const createBookingSchema = z.object({
  coworkingSpaceId: z.string().min(1),
  officeTypeId: z.string().min(1),
  bookingType: z.enum(["single", "range"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  numberOfSeats: z.number().min(1),
});

const updateBookingStatusSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  statusNote: z.string().optional(),
});

// ========== FOUNDER ENDPOINTS ==========

// Create a new booking request
export async function createBookingRequest(req: Request, res: Response) {
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(fail("Invalid input: " + parsed.error.message));
    }

    const { userId, orgId } = (req as any).user;
    const { coworkingSpaceId, officeTypeId, bookingType, startDate, endDate, numberOfSeats } = parsed.data;

    // Get founder details
    const founder = await User.findById(userId).lean();
    if (!founder) {
      return res.status(404).json(fail("User not found"));
    }

    // Get organization details
    const organization = await Organization.findById(orgId).lean();
    if (!organization) {
      return res.status(404).json(fail("Organization not found"));
    }

    // Get coworking space and validate office type
    const coworkingSpace = await CoworkingSpace.findById(coworkingSpaceId).lean();
    if (!coworkingSpace) {
      return res.status(404).json(fail("Coworking space not found"));
    }

    if (!coworkingSpace.isActive) {
      return res.status(400).json(fail("This coworking space is not available for booking"));
    }

    const officeType = coworkingSpace.officeTypes.find(
      (ot: any) => ot._id.toString() === officeTypeId
    );
    if (!officeType) {
      return res.status(404).json(fail("Office type not found"));
    }

    // Calculate total amount based on days and seats
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dailyRate = officeType.pricePerSeat / 30; // Convert monthly rate to daily
    const totalAmount = Math.round(dailyRate * days * numberOfSeats);

    const booking = await CoworkingSpaceBooking.create({
      founderId: userId,
      founderName: founder.name,
      founderEmail: founder.email,
      organizationId: orgId,
      organizationName: organization.name,
      coworkingSpaceId,
      coworkingSpaceName: coworkingSpace.name,
      officeTypeId,
      officeTypeName: officeType.name,
      pricePerSeat: officeType.pricePerSeat,
      bookingType,
      startDate: start,
      endDate: end,
      numberOfSeats,
      totalAmount,
      status: "pending",
    });

    return res.status(201).json(
      ok({
        id: booking._id,
        coworkingSpaceName: booking.coworkingSpaceName,
        officeTypeName: booking.officeTypeName,
        startDate: booking.startDate,
        endDate: booking.endDate,
        numberOfSeats: booking.numberOfSeats,
        totalAmount: booking.totalAmount,
        status: booking.status,
        createdAt: booking.createdAt,
      })
    );
  } catch (error) {
    console.error("Error creating booking request:", error);
    return res.status(500).json(fail("Failed to create booking request"));
  }
}

// Get founder's own bookings
export async function getMyBookings(req: Request, res: Response) {
  try {
    const { userId, orgId } = (req as any).user;
    const { status } = req.query;

    const query: any = { founderId: userId, organizationId: orgId };
    if (status && ["pending", "approved", "rejected", "cancelled"].includes(status as string)) {
      query.status = status;
    }

    const bookings = await CoworkingSpaceBooking.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      ok(
        bookings.map((booking) => ({
          id: booking._id,
          coworkingSpaceId: booking.coworkingSpaceId,
          coworkingSpaceName: booking.coworkingSpaceName,
          officeTypeId: booking.officeTypeId,
          officeTypeName: booking.officeTypeName,
          pricePerSeat: booking.pricePerSeat,
          bookingType: booking.bookingType,
          startDate: booking.startDate,
          endDate: booking.endDate,
          numberOfSeats: booking.numberOfSeats,
          totalAmount: booking.totalAmount,
          status: booking.status,
          statusNote: booking.statusNote,
          reviewedAt: booking.reviewedAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        }))
      )
    );
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json(fail("Failed to fetch bookings"));
  }
}

// Cancel a pending booking
export async function cancelBooking(req: Request, res: Response) {
  try {
    const { userId } = (req as any).user;
    const { id } = req.params;

    const booking = await CoworkingSpaceBooking.findOne({
      _id: id,
      founderId: userId,
    });

    if (!booking) {
      return res.status(404).json(fail("Booking not found"));
    }

    if (booking.status !== "pending") {
      return res.status(400).json(fail("Only pending bookings can be cancelled"));
    }

    booking.status = "cancelled";
    await booking.save();

    return res.json(ok({ message: "Booking cancelled successfully" }));
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return res.status(500).json(fail("Failed to cancel booking"));
  }
}

// ========== GARAGE ADMIN ENDPOINTS ==========

// Get all booking requests (for admin dashboard)
export async function getAllBookingRequests(req: Request, res: Response) {
  try {
    const { status, coworkingSpaceId } = req.query;

    const query: any = {};
    if (status && ["pending", "approved", "rejected", "cancelled"].includes(status as string)) {
      query.status = status;
    }
    if (coworkingSpaceId) {
      query.coworkingSpaceId = coworkingSpaceId;
    }

    const bookings = await CoworkingSpaceBooking.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      ok(
        bookings.map((booking) => ({
          id: booking._id,
          founderId: booking.founderId,
          founderName: booking.founderName,
          founderEmail: booking.founderEmail,
          organizationId: booking.organizationId,
          organizationName: booking.organizationName,
          coworkingSpaceId: booking.coworkingSpaceId,
          coworkingSpaceName: booking.coworkingSpaceName,
          officeTypeId: booking.officeTypeId,
          officeTypeName: booking.officeTypeName,
          pricePerSeat: booking.pricePerSeat,
          bookingType: booking.bookingType,
          startDate: booking.startDate,
          endDate: booking.endDate,
          numberOfSeats: booking.numberOfSeats,
          totalAmount: booking.totalAmount,
          status: booking.status,
          statusNote: booking.statusNote,
          reviewedBy: booking.reviewedBy,
          reviewedAt: booking.reviewedAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        }))
      )
    );
  } catch (error) {
    console.error("Error fetching booking requests:", error);
    return res.status(500).json(fail("Failed to fetch booking requests"));
  }
}

// Get booking request by ID
export async function getBookingRequestById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const booking = await CoworkingSpaceBooking.findById(id)
      .populate("reviewedBy", "name email")
      .lean();

    if (!booking) {
      return res.status(404).json(fail("Booking not found"));
    }

    return res.json(
      ok({
        id: booking._id,
        founderId: booking.founderId,
        founderName: booking.founderName,
        founderEmail: booking.founderEmail,
        organizationId: booking.organizationId,
        organizationName: booking.organizationName,
        coworkingSpaceId: booking.coworkingSpaceId,
        coworkingSpaceName: booking.coworkingSpaceName,
        officeTypeId: booking.officeTypeId,
        officeTypeName: booking.officeTypeName,
        pricePerSeat: booking.pricePerSeat,
        bookingType: booking.bookingType,
        startDate: booking.startDate,
        endDate: booking.endDate,
        numberOfSeats: booking.numberOfSeats,
        totalAmount: booking.totalAmount,
        status: booking.status,
        statusNote: booking.statusNote,
        reviewedBy: booking.reviewedBy,
        reviewedAt: booking.reviewedAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      })
    );
  } catch (error) {
    console.error("Error fetching booking:", error);
    return res.status(500).json(fail("Failed to fetch booking"));
  }
}

// Approve or reject a booking request
export async function updateBookingStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parsed = updateBookingStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json(fail("Invalid input"));
    }

    const currentAdmin = (req as any).garageAdmin;
    const { status, statusNote } = parsed.data;

    const booking = await CoworkingSpaceBooking.findById(id);

    if (!booking) {
      return res.status(404).json(fail("Booking not found"));
    }

    if (booking.status !== "pending") {
      return res.status(400).json(fail("Only pending bookings can be updated"));
    }

    booking.status = status;
    booking.statusNote = statusNote;
    booking.reviewedBy = currentAdmin.id;
    booking.reviewedAt = new Date();

    await booking.save();

    return res.json(
      ok({
        id: booking._id,
        status: booking.status,
        statusNote: booking.statusNote,
        reviewedAt: booking.reviewedAt,
        message: `Booking ${status} successfully`,
      })
    );
  } catch (error) {
    console.error("Error updating booking status:", error);
    return res.status(500).json(fail("Failed to update booking status"));
  }
}

// Get booking statistics for admin dashboard
export async function getBookingStats(req: Request, res: Response) {
  try {
    const stats = await CoworkingSpaceBooking.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const result = {
      pending: { count: 0, totalAmount: 0 },
      approved: { count: 0, totalAmount: 0 },
      rejected: { count: 0, totalAmount: 0 },
      cancelled: { count: 0, totalAmount: 0 },
    };

    stats.forEach((stat) => {
      if (stat._id in result) {
        result[stat._id as keyof typeof result] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        };
      }
    });

    const total = Object.values(result).reduce(
      (acc, curr) => ({
        count: acc.count + curr.count,
        totalAmount: acc.totalAmount + curr.totalAmount,
      }),
      { count: 0, totalAmount: 0 }
    );

    return res.json(ok({ ...result, total }));
  } catch (error) {
    console.error("Error fetching booking stats:", error);
    return res.status(500).json(fail("Failed to fetch booking statistics"));
  }
}
