// uploads/roam-backend/src/routes/cabinet.ts
import { Router } from "express";
import { CabinetController, upload } from "../controllers/cabinet.controller";
import { ShareableLinkController } from "../controllers/shareableLink.controller";
import { CollaborativeDocumentController } from "../controllers/collaborativeDocument.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ==========================================
// Collaborative Documents (ONLYOFFICE) Routes
// ==========================================
router.post(
  "/documents",
  requireAuth,
  CollaborativeDocumentController.createDocument
);
router.post(
  "/documents/from-file",
  requireAuth,
  CollaborativeDocumentController.createFromFile
);
router.get(
  "/documents",
  requireAuth,
  CollaborativeDocumentController.getDocuments
);
router.get(
  "/documents/:documentId",
  requireAuth,
  CollaborativeDocumentController.getDocumentById
);
router.put(
  "/documents/:documentId",
  requireAuth,
  CollaborativeDocumentController.updateDocument
);
router.delete(
  "/documents/:documentId",
  requireAuth,
  CollaborativeDocumentController.deleteDocument
);
router.post(
  "/documents/:documentId/callback",
  CollaborativeDocumentController.onlyofficeCallback
);
// Serve document file directly (for ONLYOFFICE to fetch)
router.get(
  "/documents/:documentId/file",
  CollaborativeDocumentController.serveDocumentFile
);
router.post(
  "/documents/:documentId/collaborators",
  requireAuth,
  CollaborativeDocumentController.addCollaborator
);
router.delete(
  "/documents/:documentId/collaborators/:collaboratorId",
  requireAuth,
  CollaborativeDocumentController.removeCollaborator
);

// File operations (must come before /:id routes)
router.post(
  "/files/upload",
  requireAuth,
  upload.single("file"),
  CabinetController.uploadFile
);
router.get(
  "/files/:fileId/download",
  requireAuth,
  CabinetController.getFileDownloadUrl
);
router.get(
  "/files/:fileId/stream",
  requireAuth,
  CabinetController.streamFileDownload
);
router.get("/files/:fileId/info", requireAuth, CabinetController.getFileInfo);
router.put("/files/:fileId/rename", requireAuth, CabinetController.renameFile);
router.delete("/files/:fileId", requireAuth, CabinetController.deleteFile);

// Shareable link routes for files
router.post(
  "/files/:fileId/share-link",
  requireAuth,
  ShareableLinkController.getOrCreateLink
);
router.get(
  "/files/:fileId/share-links",
  requireAuth,
  ShareableLinkController.getLinksForFile
);
router.delete(
  "/share-link/:token",
  requireAuth,
  ShareableLinkController.revokeLink
);
router.get(
  "/f/:token",
  requireAuth,
  ShareableLinkController.accessInternalLink
);
// Joins the office an office-only link belongs to, so a visitor who just
// signed up can open the file they were sent.
router.post(
  "/f/:token/join",
  requireAuth,
  ShareableLinkController.joinOfficeViaLink
);

// Cabinet CRUD operations
router.post("/", requireAuth, CabinetController.createCabinet);
router.get("/", requireAuth, CabinetController.getCabinets);
router.get(
  "/default",
  requireAuth,
  CabinetController.getOrCreateDefaultPersonalCabinet
);
router.get("/floor", requireAuth, CabinetController.getFloorCabinets);
router.get("/search", requireAuth, CabinetController.search);

// Organization-specific cabinet routes (MUST come before /:id routes)
router.get(
  "/organization",
  requireAuth,
  CabinetController.getOrCreateOrganizationCabinet
);
router.post(
  "/organization/sub-cabinet",
  requireAuth,
  CabinetController.createOrganizationSubCabinet
);
router.post(
  "/organization/files/upload",
  requireAuth,
  upload.single("file"),
  CabinetController.uploadFileToOrganizationCabinet
);
router.post(
  "/organization/recordings/upload",
  requireAuth,
  upload.single("recording"),
  CabinetController.uploadRecordingToOrganizationCabinet
);
router.get(
  "/organization/:id",
  requireAuth,
  CabinetController.getOrganizationCabinetById
);
router.post(
  "/organization/files/:fileId/transcribe",
  requireAuth,
  CabinetController.transcribeOrganizationRecording
);
// Per-file sharing settings (public vs office-only) and the link they mint
router.get(
  "/organization/files/:fileId/sharing",
  requireAuth,
  ShareableLinkController.getOrganizationFileSharing
);
router.put(
  "/organization/files/:fileId/sharing",
  requireAuth,
  ShareableLinkController.updateOrganizationFileSharing
);
router.post(
  "/organization/files/:fileId/share-link",
  requireAuth,
  ShareableLinkController.getOrCreateOrganizationLink
);
router.get(
  "/organization/files/:fileId/download",
  requireAuth,
  CabinetController.getOrganizationFileDownloadUrl
);
router.get(
  "/organization/files/:fileId/stream",
  requireAuth,
  CabinetController.streamOrganizationFileDownload
);
router.put(
  "/organization/files/:fileId/rename",
  requireAuth,
  CabinetController.renameOrganizationFile
);
router.delete(
  "/organization/files/:fileId",
  requireAuth,
  CabinetController.deleteOrganizationFile
);
router.put(
  "/organization/:id/rename",
  requireAuth,
  CabinetController.renameOrganizationCabinet
);

// Floor-specific cabinet routes (MUST come before /:id routes)
router.get(
  "/floor/:floorId",
  requireAuth,
  CabinetController.getOrCreateFloorCabinet
);
router.post(
  "/floor/:floorId/sub-cabinet",
  requireAuth,
  CabinetController.createFloorSubCabinet
);
router.post(
  "/floor/:floorId/files/upload",
  requireAuth,
  upload.single("file"),
  CabinetController.uploadFileToFloorCabinet
);

// Generic cabinet routes (MUST come last)
router.get("/:id", requireAuth, CabinetController.getCabinetById);
router.put("/:id", requireAuth, CabinetController.updateCabinet);
router.put("/:id/rename", requireAuth, CabinetController.renameCabinet);
router.delete("/:id", requireAuth, CabinetController.deleteCabinet);

// Utility routes
router.get("/files/all", requireAuth, CabinetController.getAllUserFiles);
router.post(
  "/files/cleanup",
  requireAuth,
  CabinetController.cleanupOrphanedFiles
);
router.post(
  "/floor/cleanup-duplicates",
  requireAuth,
  CabinetController.cleanupDuplicateFloorCabinets
);
router.post("/migrate", requireAuth, CabinetController.runMigration);

// Personal cabinet sharing routes
router.post("/share", requireAuth, CabinetController.sharePersonalItem);
router.get(
  "/share/:itemId/:itemType",
  requireAuth,
  CabinetController.getItemShares
);
router.get("/shared/with-me", requireAuth, CabinetController.getSharedWithMe);
router.get("/shared/by-me", requireAuth, CabinetController.getSharedByMe);
router.put("/share/:shareId", requireAuth, CabinetController.updateShare);
router.delete("/share/:shareId", requireAuth, CabinetController.revokeShare);
router.get(
  "/shared/files/:fileId/download",
  requireAuth,
  CabinetController.getSharedFileDownloadUrl
);
router.get(
  "/shared/files/:fileId/stream",
  requireAuth,
  CabinetController.streamSharedFileDownload
);
router.get(
  "/shared/cabinets/:cabinetId",
  requireAuth,
  CabinetController.getSharedCabinetContents
);

// Utility route for sharing
router.get("/users/search", requireAuth, CabinetController.getUsersByEmail);
router.get(
  "/users/members",
  requireAuth,
  CabinetController.getOrganizationMembers
);

export default router;
