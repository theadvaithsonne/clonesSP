import { Router } from "express";
import {
  createBookingRequest,
  getMyBookings,
  cancelBooking,
  getAllBookingRequests,
  getBookingRequestById,
  updateBookingStatus,
  getBookingStats,
} from "../controllers/coworkingSpaceBooking.controller";
import { requireAuth } from "../middleware/auth";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";

const router = Router();

// ========== FOUNDER ROUTES (requireAuth) ==========
// Create a new booking request
router.post("/request", requireAuth, createBookingRequest);

// Get my bookings (founder's own bookings)
router.get("/my-bookings", requireAuth, getMyBookings);

// Cancel a pending booking
router.patch("/:id/cancel", requireAuth, cancelBooking);

// ========== GARAGE ADMIN ROUTES ==========
// Get all booking requests
router.get("/admin/requests", requireGarageAdminAuth, getAllBookingRequests);

// Get booking statistics
router.get("/admin/stats", requireGarageAdminAuth, getBookingStats);

// Get booking by ID
router.get("/admin/requests/:id", requireGarageAdminAuth, getBookingRequestById);

// Approve or reject a booking
router.patch("/admin/requests/:id/status", requireGarageAdminAuth, updateBookingStatus);

export default router;
