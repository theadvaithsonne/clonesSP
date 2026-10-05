import { Router } from "express";
import { ShareableLinkController } from "../controllers/shareableLink.controller";

const router = Router();

// What a signed-out visitor may know about a link before signing in — used by
// the viewer to render the office gate. Declared first so "meta" is not eaten
// by the :token param.
router.get("/:token/meta", ShareableLinkController.getLinkMeta);

// Public file access via external shareable link (no auth required)
router.get("/:token", ShareableLinkController.accessExternalLink);

export default router;
