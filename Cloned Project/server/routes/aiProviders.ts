import { Router } from "express";
import {
  getAIProviderKeys,
  saveAIProviderKey,
  deleteAIProviderKey,
} from "../controllers/aiProviderKey.controller";
import { requireGarageAdminAuth } from "../middleware/garageAdminAuth";

const router = Router();

// All routes require garage admin authentication
router.get("/keys", requireGarageAdminAuth, getAIProviderKeys);
router.post("/keys", requireGarageAdminAuth, saveAIProviderKey);
router.delete("/keys/:providerId", requireGarageAdminAuth, deleteAIProviderKey);

export default router;
