import { Router } from "express";
import {
  getAllCoworkingSpaces,
  getCoworkingSpaceById,
  createCoworkingSpace,
  updateCoworkingSpace,
  deleteCoworkingSpace,
  getUniqueOfficeTypes,
  getPublicCoworkingSpaces,
  getPublicCoworkingSpaceById,
} from "../controllers/coworkingSpace.controller";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
} from "../middleware/garageAdminAuth";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Public routes for founders/users (with user auth) - MUST be before /:id route
router.get("/public", requireAuth, getPublicCoworkingSpaces);
router.get("/public/:id", requireAuth, getPublicCoworkingSpaceById);

// Protected routes (all garage admins can view)
router.get("/", requireGarageAdminAuth, getAllCoworkingSpaces);
router.get("/office-types", requireGarageAdminAuth, getUniqueOfficeTypes);
router.get("/:id", requireGarageAdminAuth, getCoworkingSpaceById);

// Super admin only routes (create, update, delete)
router.post(
  "/",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  createCoworkingSpace
);
router.put(
  "/:id",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  updateCoworkingSpace
);
router.delete(
  "/:id",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  deleteCoworkingSpace
);

export default router;
