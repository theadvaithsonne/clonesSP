import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createMySettings,
  getMySettings,
  updateMySettings,
} from "../controllers/settings.controller";

const router = Router();

// User-scoped settings. Founder/stakeholder both can manage only their own settings.
router.post("/", requireAuth, createMySettings);
router.get("/", requireAuth, getMySettings);
router.patch("/", requireAuth, updateMySettings);

export default router;
