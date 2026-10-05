// uploads/roam-backend/src/controllers/cabinet.controller.ts
import { Request, Response } from "express";
import { escapeRegex } from "../utils/userSearchClauses";
import {
  UserCabinet,
  FloorCabinet,
  OrganizationCabinet,
  UserFile,
  FloorFile,
  OrganizationFile,
  Cabinet,
  File,
} from "../models/cabinet.model";
import { Floor } from "../models/floor.model";
import { User } from "../models/user.model";
import { SharedItem, SharedAccessLog } from "../models/sharing.model";
import { CollaborativeDocument } from "../models/collaborativeDocument.model";
import { s3Service } from "../services/s3";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { compressVideo } from "../utils/videoCompression";
import {
  checkOrgUploadQuota,
  getOrgStorageDetails,
} from "../utils/cabinetStorage";
import {
  applyFileRename,
  buildContentDisposition,
  downloadNameFor,
} from "../utils/fileNaming";
import { promises as fsPromises } from "fs";
import os from "os";
import pathModule from "path";

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // Increase max upload size to support long recordings (e.g., > 10 minutes)
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, can be restricted later
    cb(null, true);
  },
});

export class CabinetController {
  /**
   * Helper function to get organization-specific floorId for a user
   */
  private static async getUserFloorIdForOrg(
    userId: string,
    organizationId: string
  ): Promise<string | null> {
    const user = await User.findById(userId);
    if (!user) return null;

    const membership = user.organizations?.find(
      (org) => org.organization.toString() === organizationId
    );

    return membership?.floorId?.toString() || null;
  }

  /**
   * Upload a recording to a dedicated 'Recordings' folder in the Organization Cabinet.
   */
  static async uploadRecordingToOrganizationCabinet(
    req: Request,
    res: Response
  ) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };
      const file = req.file;
      const { spaceId, meetingTitle } = req.body; // Pass this from frontend

      if (!file || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "File and organization ID are required",
        });
      }

      // Membership, not founder: this endpoint is not a founder gesture but
      // the tail of a workspace recording, and any member can record a session
      // they took part in. The founder-only rule covers the cabinet's own
      // upload surfaces (files + folders), which are guarded separately.
      const recorder = await User.findById(me.userId).select("organizations");
      const recorderMembership = recorder?.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );
      if (!recorderMembership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      // 1. Find or create the root Organization Cabinet
      let orgCabinet = await OrganizationCabinet.findOne({
        organization: organizationId,
        isRoot: true,
      });

      if (!orgCabinet) {
        orgCabinet = new OrganizationCabinet({
          name: "Organization Cabinet",
          description: "Shared cabinet for all organization members",
          owner: me.userId,
          organization: organizationId as string,
          path: "/organization",
          isRoot: true,
        });
        await orgCabinet.save();
      }

      // 2. Find or create the "Recordings" sub-cabinet
      const recordingsFolderName = "Recordings";
      let recordingsCabinet = await OrganizationCabinet.findOne({
        organization: organizationId,
        name: recordingsFolderName,
        parentCabinet: orgCabinet._id,
      });

      if (!recordingsCabinet) {
        recordingsCabinet = new OrganizationCabinet({
          name: recordingsFolderName,
          description: "Meeting and workspace recordings",
          owner: me.userId,
          organization: organizationId as string,
          parentCabinet: orgCabinet._id,
          path: `${orgCabinet.path}/${recordingsFolderName}`,
          isRoot: false,
        });
        await recordingsCabinet.save();
      }

      // 3. Compress video if it's a video file
      const { buffer: finalBuffer, mimeType: finalMimeType } = await compressVideo(
        file.buffer,
        file.mimetype
      );
      
      // 4. Upload file to S3 (use compressed version if available)
      const extension = finalMimeType.includes("webm") ? "webm" : "mp4";
      const friendlyName = `${
        meetingTitle || spaceId || "meeting"
      }_${new Date().toISOString()}.${extension}`;
      const s3Key = s3Service.generateFileKey(
        me.userId,
        organizationId as string,
        friendlyName
      );

      // Quota is measured on the compressed size — that is what actually
      // lands in S3 — and checked before the put so nothing is orphaned.
      const quota = await checkOrgUploadQuota(
        organizationId as string,
        finalBuffer.length
      );
      if (!quota.allowed) {
        return res.status(413).json({
          success: false,
          message: quota.message,
          error: "STORAGE_LIMIT_REACHED",
          data: {
            storageLimit: quota.storageLimit,
            totalUsed: quota.totalUsed,
            remaining: quota.remaining,
            planSlug: quota.planSlug,
          },
        });
      }

      await s3Service.uploadFile(s3Key, finalBuffer, finalMimeType, {
        originalName: friendlyName,
        uploadedBy: me.userId,
        cabinetId: recordingsCabinet._id.toString(),
        organizationId: organizationId as string,
        spaceId: spaceId || "unknown",
      });

      // 5. Create file record in the database
      const fileRecord = new OrganizationFile({
        name: friendlyName,
        originalName: friendlyName,
        owner: me.userId,
        organization: organizationId as string,
        cabinet: recordingsCabinet._id,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET || "",
        s3Region: process.env.AWS_S3_REGION || "",
        mimeType: finalMimeType,
        size: finalBuffer.length,
        extension: extension,
        path: `${recordingsCabinet.path}/${friendlyName}`,
        status: "processing", // will be set to "ready" once transcription completes
      });
      await fileRecord.save();

      // Respond immediately — transcription runs in the background
      res.status(201).json({
        success: true,
        message: "Recording uploaded successfully to Organization Cabinet",
        data: fileRecord,
      });

      // Fire-and-forget background transcription
      CabinetController._runTranscription(fileRecord).catch((err) => {
        console.error("Background transcription failed for", fileRecord._id, err);
        OrganizationFile.findByIdAndUpdate(fileRecord._id, { status: "error" }).catch(() => {});
      });
    } catch (error) {
      console.error("Upload recording error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during recording upload",
      });
    }
  }

  /**
   * Create a new cabinet/folder
   */
  static async createCabinet(req: Request, res: Response) {
    try {
      const { name, description, parentCabinetId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!name || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Name and organization ID are required",
        });
      }

      // Build path
      let path = `/${name}`;
      if (parentCabinetId) {
        const parentCabinet = await Cabinet.findById(parentCabinetId);
        if (!parentCabinet) {
          return res.status(404).json({
            success: false,
            message: "Parent cabinet not found",
          });
        }
        path = `${parentCabinet.path}/${name}`;
      }

      // Check if cabinet with same name already exists in the same location
      const existingCabinet = await UserCabinet.findOne({
        owner: me.userId,
        organization: organizationId,
        path,
      });

      if (existingCabinet) {
        return res.status(409).json({
          success: false,
          message: "A cabinet with this name already exists in this location",
        });
      }

      const cabinet = new UserCabinet({
        name,
        description,
        owner: me.userId,
        organization: organizationId as string,
        parentCabinet: parentCabinetId || null,
        path,
        isRoot: !parentCabinetId,
        isDefault: false,
      });

      await cabinet.save();

      res.status(201).json({
        success: true,
        message: "Cabinet created successfully",
        data: cabinet,
      });
    } catch (error) {
      console.error("Create cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get all cabinets for a user (USER CABINETS ONLY)
   */
  static async getCabinets(req: Request, res: Response) {
    try {
      const me = (req as any).user as { userId: string; orgId: string };
      const { organizationId, parentCabinetId } = req.query;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const query: any = {
        owner: me.userId,
        organization: organizationId,
      };

      if (parentCabinetId) {
        query.parentCabinet = parentCabinetId;
      } else {
        query.parentCabinet = null; // Root cabinets
      }

      const cabinets = await UserCabinet.find({
        ...query,
        isDefault: { $ne: true }, // Exclude default cabinets from regular list
      }).sort({ name: 1 });

      res.json({
        success: true,
        data: cabinets,
      });
    } catch (error) {
      console.error("Get cabinets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get or create default personal cabinet
   */
  static async getOrCreateDefaultPersonalCabinet(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if default personal cabinet exists
      let defaultCabinet = await UserCabinet.findOne({
        owner: me.userId,
        organization: organizationId,
        isDefault: true,
      });

      // If cabinet doesn't exist, create it
      if (!defaultCabinet) {
        defaultCabinet = new UserCabinet({
          name: "My Files",
          description: "Default personal cabinet for your files",
          owner: me.userId,
          organization: organizationId as string,
          parentCabinet: null,
          path: "/My Files",
          isRoot: true,
          isDefault: true,
        });

        await defaultCabinet.save();
      }

      // Get files in this cabinet
      const files = await UserFile.find({
        cabinet: defaultCabinet._id,
        organization: organizationId,
        owner: me.userId,
      }).sort({ name: 1 });

      res.json({
        success: true,
        data: {
          cabinet: defaultCabinet,
          files,
        },
      });
    } catch (error) {
      console.error("Get or create default personal cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get all floor cabinets accessible to the user
   */
  static async getFloorCabinets(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Get user details to check role
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user is founder or stakeholder
      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (
        !membership ||
        (membership.role !== "founder" && membership.role !== "stakeholder")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. Only founders and stakeholders can access floor cabinets.",
        });
      }

      const query: any = {
        organization: organizationId,
        floorId: { $exists: true },
      };

      // If user is stakeholder, only show their assigned floor
      if (membership.role === "stakeholder") {
        const userFloorId = await CabinetController.getUserFloorIdForOrg(
          me.userId,
          organizationId as string
        );
        if (userFloorId) {
          query.floorId = userFloorId;
        }
      }

      const floorCabinets = await FloorCabinet.find(query)
        .populate("floorId", "name level")
        .sort({ name: 1 });

      res.json({
        success: true,
        data: floorCabinets,
      });
    } catch (error) {
      console.error("Get floor cabinets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get cabinet by ID with its contents
   */
  static async getCabinetById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const cabinet = await Cabinet.findOne({
        _id: id,
        organization: organizationId,
        $or: [{ owner: me.userId }, { floorId: { $exists: true } }],
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // For floor cabinets, check user permissions
      if ((cabinet as any).floorId !== undefined) {
        const user = await User.findById(me.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        const membership = user.organizations?.find(
          (org) => org.organization.toString() === organizationId
        );

        if (
          !membership ||
          (membership.role !== "founder" && membership.role !== "stakeholder")
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. Only founders and stakeholders can access floor cabinets.",
          });
        }

        // Check if user is founder (can access all) or stakeholder assigned to this floor
        if (
          membership.role === "stakeholder" &&
          (cabinet as any).floorId !== undefined
        ) {
          const userFloorId = await CabinetController.getUserFloorIdForOrg(
            me.userId,
            organizationId as string
          );
          if (userFloorId !== (cabinet as any).floorId?.toString()) {
            return res.status(403).json({
              success: false,
              message:
                "Access denied. You can only access your assigned floor cabinet.",
            });
          }
        }
      }

      // Get sub-cabinets
      const subCabinetsQuery: any = {
        parentCabinet: id,
        organization: organizationId,
      };

      // For user cabinets, filter by owner
      if ((cabinet as any).floorId === undefined) {
        subCabinetsQuery.owner = me.userId;
      }

      const subCabinets = await Cabinet.find(subCabinetsQuery).sort({
        name: 1,
      });

      // Get files in this cabinet
      const filesQuery: any = {
        cabinet: id,
        organization: organizationId,
      };

      // For user cabinets, filter by owner
      if ((cabinet as any).floorId === undefined) {
        filesQuery.owner = me.userId;
      }

      const files = await File.find(filesQuery).sort({ name: 1 });

      // If floor cabinet, attach floor details for client breadcrumbing
      let floorInfo: any = undefined;
      if ((cabinet as any).floorId) {
        const fl = await Floor.findOne({
          _id: (cabinet as any).floorId,
          orgId: organizationId,
        })
          .select("_id name level")
          .lean();
        if (fl) {
          floorInfo = { id: fl._id, name: fl.name, level: fl.level };
        }
      }

      res.json({
        success: true,
        data: {
          cabinet,
          subCabinets,
          files,
          floor: floorInfo,
        },
      });
    } catch (error) {
      console.error("Get cabinet by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update cabinet
   */
  static async updateCabinet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const cabinet = await Cabinet.findOne({
        _id: id,
        organization: organizationId,
        $or: [{ owner: me.userId }, { floorId: { $exists: true } }],
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // For floor cabinets, check user permissions
      if ((cabinet as any).floorId !== undefined) {
        const user = await User.findById(me.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        const membership = user.organizations?.find(
          (org) => org.organization.toString() === organizationId
        );

        if (
          !membership ||
          (membership.role !== "founder" && membership.role !== "stakeholder")
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. Only founders and stakeholders can update floor cabinets.",
          });
        }

        // Check if user is founder (can update all) or stakeholder assigned to this floor
        if (membership.role === "stakeholder") {
          const userFloorId = await CabinetController.getUserFloorIdForOrg(
            me.userId,
            organizationId as string
          );
          if (userFloorId !== (cabinet as any).floorId?.toString()) {
            return res.status(403).json({
              success: false,
              message:
                "Access denied. You can only update your assigned floor cabinet.",
            });
          }
        }
      }

      if (name) {
        // Check if name change would conflict
        const parentPath = cabinet.parentCabinet
          ? (await Cabinet.findById(cabinet.parentCabinet))?.path || ""
          : "";
        const newPath = parentPath ? `${parentPath}/${name}` : `/${name}`;

        const existingCabinet = await Cabinet.findOne({
          organization: organizationId,
          path: newPath,
          _id: { $ne: id },
          $or: [{ owner: me.userId }, { floorId: { $exists: true } }],
        });

        if (existingCabinet) {
          return res.status(409).json({
            success: false,
            message: "A cabinet with this name already exists in this location",
          });
        }

        cabinet.name = name;
        cabinet.path = newPath;
      }

      if (description !== undefined) {
        cabinet.description = description;
      }

      await cabinet.save();

      res.json({
        success: true,
        message: "Cabinet updated successfully",
        data: cabinet,
      });
    } catch (error) {
      console.error("Update cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Rename cabinet
   */
  static async renameCabinet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Cabinet name is required",
        });
      }

      const cabinet = await Cabinet.findOne({
        _id: id,
        organization: organizationId,
        $or: [{ owner: me.userId }, { floorId: { $exists: true } }],
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // For floor cabinets, check user permissions
      if ((cabinet as any).floorId !== undefined) {
        const user = await User.findById(me.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        const membership = user.organizations?.find(
          (org) => org.organization.toString() === organizationId
        );

        if (
          !membership ||
          (membership.role !== "founder" && membership.role !== "stakeholder")
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. Only founders and stakeholders can rename floor cabinets.",
          });
        }

        // Check if user is founder (can update all) or stakeholder assigned to this floor
        if (membership.role === "stakeholder") {
          const userFloorId = await CabinetController.getUserFloorIdForOrg(
            me.userId,
            organizationId as string
          );
          if (userFloorId !== (cabinet as any).floorId?.toString()) {
            return res.status(403).json({
              success: false,
              message:
                "Access denied. You can only rename your assigned floor cabinet.",
            });
          }
        }
      }

      // Validate cabinet name
      const trimmedName = name.trim();
      if (trimmedName.includes("/") || trimmedName.includes("\\")) {
        return res.status(400).json({
          success: false,
          message: "Cabinet name cannot contain slashes",
        });
      }

      // Check if name change would conflict
      const parentPath = cabinet.parentCabinet
        ? (await Cabinet.findById(cabinet.parentCabinet))?.path || ""
        : "";
      const newPath = parentPath ? `${parentPath}/${trimmedName}` : `/${trimmedName}`;

      const existingCabinet = await Cabinet.findOne({
        organization: organizationId,
        path: newPath,
        _id: { $ne: id },
        $or: [{ owner: me.userId }, { floorId: { $exists: true } }],
      });

      if (existingCabinet) {
        return res.status(409).json({
          success: false,
          message: "A cabinet with this name already exists in this location",
        });
      }

      cabinet.name = trimmedName;
      cabinet.path = newPath;
      await cabinet.save();

      res.json({
        success: true,
        message: "Cabinet renamed successfully",
        data: cabinet,
      });
    } catch (error) {
      console.error("Rename cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Delete cabinet with cascade deletion
   */
  static async deleteCabinet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const cabinet = await Cabinet.findOne({
        _id: id,
        organization: organizationId,
        $or: [{ owner: me.userId }, { floorId: { $exists: true } }],
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // For floor cabinets, check user permissions
      if ((cabinet as any).floorId !== undefined) {
        const user = await User.findById(me.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        const membership = user.organizations?.find(
          (org) => org.organization.toString() === organizationId
        );

        if (
          !membership ||
          (membership.role !== "founder" && membership.role !== "stakeholder")
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. Only founders and stakeholders can delete floor cabinets.",
          });
        }

        // Check if user is founder (can delete all) or stakeholder assigned to this floor
        if (membership.role === "stakeholder") {
          const userFloorId = await CabinetController.getUserFloorIdForOrg(
            me.userId,
            organizationId as string
          );
          if (userFloorId !== (cabinet as any).floorId?.toString()) {
            return res.status(403).json({
              success: false,
              message:
                "Access denied. You can only delete your assigned floor cabinet.",
            });
          }
        }
      }

      // Recursive function to delete cabinet and all its contents
      const deleteCabinetRecursive = async (cabinetId: string) => {
        // Get all sub-cabinets
        const subCabinetsQuery: any = {
          parentCabinet: cabinetId,
          organization: organizationId,
        };

        // For user cabinets, filter by owner
        if ((cabinet as any).floorId === undefined) {
          subCabinetsQuery.owner = me.userId;
        }

        const subCabinets = await Cabinet.find(subCabinetsQuery);

        // Get all files in this cabinet
        const filesQuery: any = {
          cabinet: cabinetId,
          organization: organizationId,
        };

        // For user cabinets, filter by owner
        if ((cabinet as any).floorId === undefined) {
          filesQuery.owner = me.userId;
        }

        const files = await File.find(filesQuery);

        // Delete all files in this cabinet
        for (const file of files) {
          try {
            // Delete from S3
            await s3Service.deleteFile(file.s3Key);
            // Delete from database
            await File.findByIdAndDelete(file._id);
          } catch (error) {
            console.error(`Error deleting file ${file._id}:`, error);
          }
        }

        // Recursively delete all sub-cabinets
        for (const subCabinet of subCabinets) {
          await deleteCabinetRecursive(subCabinet._id.toString());
        }

        // Finally delete the cabinet itself
        await Cabinet.findByIdAndDelete(cabinetId);
      };

      await deleteCabinetRecursive(id);

      res.json({
        success: true,
        message: "Cabinet and all its contents deleted successfully",
      });
    } catch (error) {
      console.error("Delete cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Upload file to cabinet
   */
  static async uploadFile(req: Request, res: Response) {
    try {
      const { cabinetId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };
      const file = req.file;

      if (!file || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "File and organization ID are required",
        });
      }

      let targetCabinetId = cabinetId;

      // If no cabinetId provided, create or get default personal cabinet
      if (!targetCabinetId) {
        const defaultCabinet = await UserCabinet.findOne({
          owner: me.userId,
          organization: organizationId,
          isDefault: true,
        });

        if (defaultCabinet) {
          targetCabinetId = defaultCabinet._id.toString();
        } else {
          // Create default personal cabinet
          const newCabinet = new UserCabinet({
            name: "My Files",
            description: "Default personal cabinet for your files",
            owner: me.userId,
            organization: organizationId as string,
            parentCabinet: null,
            path: "/My Files",
            isRoot: true,
            isDefault: true,
          });

          await newCabinet.save();
          targetCabinetId = newCabinet._id.toString();
        }
      }

      // Verify cabinet exists and user owns it
      const cabinet = await UserCabinet.findOne({
        _id: targetCabinetId,
        owner: me.userId,
        organization: organizationId as string,
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // Generate S3 key
      const s3Key = s3Service.generateFileKey(
        me.userId,
        organizationId as string,
        file.originalname
      );

      // Upload to S3
      await s3Service.uploadFile(s3Key, file.buffer, file.mimetype, {
        originalName: file.originalname,
        uploadedBy: me.userId,
        cabinetId: targetCabinetId,
      });

      // Get file extension
      const extension = file.originalname.split(".").pop() || "";

      // Create file record in database
      const fileRecord = new UserFile({
        name: file.originalname,
        originalName: file.originalname,
        owner: me.userId,
        organization: organizationId as string,
        cabinet: targetCabinetId,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET || "",
        s3Region: process.env.AWS_S3_REGION || "",
        mimeType: file.mimetype,
        size: file.size,
        extension,
        path: `${cabinet.path}/${file.originalname}`,
        status: "uploaded",
      });

      await fileRecord.save();

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: fileRecord,
      });
    } catch (error) {
      console.error("Upload file error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get file download URL
   */
  static async getFileDownloadUrl(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const file = await UserFile.findOne({
        _id: fileId,
        organization: organizationId,
        owner: me.userId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Generate public URL (never expires)
      const downloadUrl = s3Service.getPublicUrl(file.s3Key);

      res.json({
        success: true,
        data: {
          downloadUrl,
          fileName: downloadNameFor(file),
          fileSize: file.size,
        },
      });
    } catch (error) {
      console.error("Get download URL error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Stream file for download (proxy to avoid CORS)
   */
  static async streamFileDownload(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const file = await UserFile.findOne({
        _id: fileId,
        organization: organizationId,
        owner: me.userId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Get file from S3
      const fileBuffer = await s3Service.getFile(file.s3Key);

      res.setHeader("Content-Type", file.mimeType);
      res.setHeader(
        "Content-Disposition",
        buildContentDisposition(downloadNameFor(file))
      );
      res.setHeader("Content-Length", file.size);

      res.send(fileBuffer);
    } catch (error) {
      console.error("Stream download error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const file = await UserFile.findOne({
        _id: fileId,
        organization: organizationId,
        owner: me.userId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Delete from S3
      await s3Service.deleteFile(file.s3Key);

      // Delete from database
      await UserFile.findByIdAndDelete(fileId);

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Rename file
   */
  static async renameFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { name } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "File name is required",
        });
      }

      const file = await UserFile.findOne({
        _id: fileId,
        organization: organizationId,
        owner: me.userId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Validate file name
      const trimmedName = name.trim();
      if (trimmedName.includes("/") || trimmedName.includes("\\")) {
        return res.status(400).json({
          success: false,
          message: "File name cannot contain slashes",
        });
      }

      // Check if a file with the same name already exists in the same cabinet
      const existingFile = await UserFile.findOne({
        cabinet: file.cabinet,
        name: trimmedName,
        organization: organizationId,
        owner: me.userId,
        _id: { $ne: fileId },
      });

      if (existingFile) {
        return res.status(409).json({
          success: false,
          message: "A file with this name already exists in this folder",
        });
      }

      // Keeps name, originalName, extension and path in sync — downloads read
      // originalName, so renaming only `name` saved the old file name.
      applyFileRename(file, trimmedName);
      await file.save();

      res.json({
        success: true,
        message: "File renamed successfully",
        data: file,
      });
    } catch (error) {
      console.error("Rename file error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get file info
   */
  static async getFileInfo(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const file = await UserFile.findOne({
        _id: fileId,
        organization: organizationId,
        owner: me.userId,
      }).populate("cabinet", "name path");

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      res.json({
        success: true,
        data: file,
      });
    } catch (error) {
      console.error("Get file info error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Search files and cabinets
   */
  static async search(req: Request, res: Response) {
    try {
      const { q, organizationId, type } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!q || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Search query and organization ID are required",
        });
      }

      const searchRegex = new RegExp(q as string, "i");
      const results: any = {
        cabinets: [],
        files: [],
      };

      if (!type || type === "cabinet") {
        // Search user cabinets
        const userCabinets = await UserCabinet.find({
          organization: organizationId,
          owner: me.userId,
          isDefault: { $ne: true }, // Exclude default cabinets from search
          $or: [{ name: searchRegex }, { description: searchRegex }],
        }).limit(10);

        results.cabinets = userCabinets;
      }

      if (!type || type === "file") {
        const filesQuery: any = {
          organization: organizationId,
          $or: [
            { name: searchRegex },
            { originalName: searchRegex },
            { description: searchRegex },
            { tags: { $in: [searchRegex] } },
          ],
        };

        // For user files, filter by owner
        const userFiles = await UserFile.find({
          ...filesQuery,
          owner: me.userId,
        })
          .populate("cabinet", "name path")
          .limit(20);

        results.files = userFiles;
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get or create floor cabinet
   */
  static async getOrCreateFloorCabinet(req: Request, res: Response) {
    try {
      const { floorId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!floorId || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Floor ID and organization ID are required",
        });
      }

      // Get user details to check role
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user is founder or stakeholder
      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (
        !membership ||
        (membership.role !== "founder" && membership.role !== "stakeholder")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. Only founders and stakeholders can access floor cabinets.",
        });
      }

      // Get floor details
      const floor = await Floor.findOne({
        _id: floorId,
        orgId: organizationId,
      });

      if (!floor) {
        return res.status(404).json({
          success: false,
          message: "Floor not found",
        });
      }

      // Check if user is founder (can access all) or stakeholder assigned to this floor
      if (membership.role === "stakeholder") {
        const userFloorId = await CabinetController.getUserFloorIdForOrg(
          me.userId,
          organizationId as string
        );
        if (userFloorId !== floorId) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. You can only access your assigned floor cabinet.",
          });
        }
      }

      // Check if floor cabinet already exists - use findOneAndUpdate with upsert to prevent duplicates
      let floorCabinet = await FloorCabinet.findOneAndUpdate(
        {
          floorId: floorId,
          organization: organizationId,
        },
        {
          $setOnInsert: {
            name: `${floor.name} Cabinet`,
            description: `Shared cabinet for ${floor.name}`,
            owner: me.userId, // Creator becomes the initial owner
            organization: organizationId as string,
            floorId: floorId,
            path: `/floor-${floorId}`,
            isRoot: true,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      // Get sub-cabinets
      const subCabinets = await FloorCabinet.find({
        parentCabinet: floorCabinet._id,
        organization: organizationId,
      }).sort({ name: 1 });

      // Get files in this cabinet
      const files = await FloorFile.find({
        cabinet: floorCabinet._id,
        organization: organizationId,
      }).sort({ name: 1 });

      res.json({
        success: true,
        data: {
          cabinet: floorCabinet,
          subCabinets,
          files,
          floor: {
            id: floor._id,
            name: floor.name,
            level: floor.level,
          },
        },
      });
    } catch (error) {
      console.error("Get or create floor cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Create sub-cabinet in floor cabinet
   */
  static async createFloorSubCabinet(req: Request, res: Response) {
    try {
      const { floorId } = req.params;
      const { name, description, parentCabinetId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!name || !floorId || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Name, floor ID, and organization ID are required",
        });
      }

      // Get user details to check role
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user is founder or stakeholder
      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (
        !membership ||
        (membership.role !== "founder" && membership.role !== "stakeholder")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. Only founders and stakeholders can create floor cabinets.",
        });
      }

      // Check if user is founder (can access all) or stakeholder assigned to this floor
      if (membership.role === "stakeholder") {
        const userFloorId = await CabinetController.getUserFloorIdForOrg(
          me.userId,
          organizationId as string
        );
        if (userFloorId !== floorId) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. You can only create cabinets in your assigned floor.",
          });
        }
      }

      // Get floor cabinet
      const floorCabinet = await FloorCabinet.findOne({
        floorId: floorId,
        organization: organizationId,
      });

      if (!floorCabinet) {
        return res.status(404).json({
          success: false,
          message: "Floor cabinet not found",
        });
      }

      // Build path
      let path = `${floorCabinet.path}/${name}`;
      if (parentCabinetId) {
        const parentCabinet = await FloorCabinet.findOne({
          _id: parentCabinetId,
          floorId: floorId,
          organization: organizationId,
        });
        if (!parentCabinet) {
          return res.status(404).json({
            success: false,
            message: "Parent cabinet not found",
          });
        }
        path = `${parentCabinet.path}/${name}`;
      }

      // Check if cabinet with same name already exists in the same location
      const existingCabinet = await FloorCabinet.findOne({
        floorId: floorId,
        organization: organizationId,
        path,
      });

      if (existingCabinet) {
        return res.status(409).json({
          success: false,
          message: "A cabinet with this name already exists in this location",
        });
      }

      const cabinet = new FloorCabinet({
        name,
        description,
        owner: me.userId,
        organization: organizationId as string,
        parentCabinet: parentCabinetId || floorCabinet._id,
        floorId: floorId,
        path,
        isRoot: false,
      });

      await cabinet.save();

      res.status(201).json({
        success: true,
        message: "Floor sub-cabinet created successfully",
        data: cabinet,
      });
    } catch (error) {
      console.error("Create floor sub-cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Upload file to floor cabinet
   */
  static async uploadFileToFloorCabinet(req: Request, res: Response) {
    try {
      const { floorId } = req.params;
      const { cabinetId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };
      const file = req.file;

      if (!file || !cabinetId || !floorId || !organizationId) {
        return res.status(400).json({
          success: false,
          message:
            "File, cabinet ID, floor ID, and organization ID are required",
        });
      }

      // Get user details to check role
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user is founder or stakeholder
      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (
        !membership ||
        (membership.role !== "founder" && membership.role !== "stakeholder")
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. Only founders and stakeholders can upload to floor cabinets.",
        });
      }

      // Check if user is founder (can access all) or stakeholder assigned to this floor
      if (membership.role === "stakeholder") {
        const userFloorId = await CabinetController.getUserFloorIdForOrg(
          me.userId,
          organizationId as string
        );
        if (userFloorId !== floorId) {
          return res.status(403).json({
            success: false,
            message:
              "Access denied. You can only upload to your assigned floor cabinet.",
          });
        }
      }

      // Verify cabinet exists and belongs to the floor
      const cabinet = await FloorCabinet.findOne({
        _id: cabinetId,
        floorId: floorId,
        organization: organizationId as string,
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Floor cabinet not found",
        });
      }

      // Generate S3 key
      const s3Key = s3Service.generateFileKey(
        me.userId,
        organizationId as string,
        file.originalname
      );

      // Upload to S3
      await s3Service.uploadFile(s3Key, file.buffer, file.mimetype, {
        originalName: file.originalname,
        uploadedBy: me.userId,
        cabinetId: cabinetId,
        floorId: floorId,
      });

      // Get file extension
      const extension = file.originalname.split(".").pop() || "";

      // Create file record in database
      const fileRecord = new FloorFile({
        name: file.originalname,
        originalName: file.originalname,
        owner: me.userId,
        organization: organizationId as string,
        cabinet: cabinetId,
        floorId: floorId,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET || "",
        s3Region: process.env.AWS_S3_REGION || "",
        mimeType: file.mimetype,
        size: file.size,
        extension,
        path: `${cabinet.path}/${file.originalname}`,
        status: "uploaded",
      });

      await fileRecord.save();

      res.status(201).json({
        success: true,
        message: "File uploaded to floor cabinet successfully",
        data: fileRecord,
      });
    } catch (error) {
      console.error("Upload file to floor cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Run cabinet data migration
   */
  static async runMigration(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Import and run migration
      const { migrateCabinetData } = await import(
        "../scripts/migrate-cabinets"
      );
      const result = await migrateCabinetData();

      if (result.success) {
        res.json({
          success: true,
          message: "Migration completed successfully",
          data: {
            migratedCabinets: result.migratedCabinets,
            migratedFiles: result.migratedFiles,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Migration failed",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Run migration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Clean up duplicate floor cabinets
   */
  static async cleanupDuplicateFloorCabinets(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Find all floor cabinets grouped by floorId
      const floorCabinets = await Cabinet.find({
        organization: organizationId,
        floorId: { $exists: true },
      });

      const groupedCabinets = floorCabinets.reduce((acc: any, cabinet) => {
        const key = `${(cabinet as any).floorId}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(cabinet);
        return acc;
      }, {});

      let duplicatesRemoved = 0;
      const duplicateIds: string[] = [];

      // For each floor, keep the first cabinet and remove the rest
      for (const floorId in groupedCabinets) {
        const cabinets = groupedCabinets[floorId];
        if (cabinets.length > 1) {
          // Sort by creation date, keep the oldest one
          cabinets.sort(
            (a: any, b: any) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          // Keep the first one, mark the rest for deletion
          const toKeep = cabinets[0];
          const toDelete = cabinets.slice(1);

          for (const cabinet of toDelete) {
            // Move files from duplicate cabinet to the kept cabinet
            await File.updateMany(
              { cabinet: cabinet._id },
              { cabinet: toKeep._id }
            );

            // Move sub-cabinets from duplicate cabinet to the kept cabinet
            await Cabinet.updateMany(
              { parentCabinet: cabinet._id },
              { parentCabinet: toKeep._id }
            );

            // Delete the duplicate cabinet
            await Cabinet.findByIdAndDelete(cabinet._id);
            duplicateIds.push(cabinet._id.toString());
            duplicatesRemoved++;
          }
        }
      }

      res.json({
        success: true,
        message: `Cleaned up ${duplicatesRemoved} duplicate floor cabinets`,
        data: {
          duplicatesRemoved,
          duplicateIds,
          remainingCabinets: floorCabinets.length - duplicatesRemoved,
        },
      });
    } catch (error) {
      console.error("Cleanup duplicate floor cabinets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Utility method to clean up orphaned files
   */
  static async cleanupOrphanedFiles(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Find files that reference non-existent cabinets
      const files = await File.find({
        organization: organizationId,
      }).populate("cabinet");

      const orphanedFiles = files.filter((file: any) => !file.cabinet);

      if (orphanedFiles.length > 0) {
        // Delete orphaned files from S3 and database
        for (const file of orphanedFiles) {
          try {
            await s3Service.deleteFile(file.s3Key);
            await File.findByIdAndDelete(file._id);
          } catch (error) {
            console.error(
              `Error cleaning up orphaned file ${file._id}:`,
              error
            );
          }
        }
      }

      res.json({
        success: true,
        message: `Cleaned up ${orphanedFiles.length} orphaned files`,
        data: { orphanedCount: orphanedFiles.length },
      });
    } catch (error) {
      console.error("Cleanup orphaned files error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get all files for a user across all cabinets (for debugging)
   */
  static async getAllUserFiles(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Get user files
      const userFiles = await File.find({
        owner: me.userId,
        organization: organizationId,
      }).populate("cabinet", "name path floorId");

      // Get floor files (if user has permission)
      const user = await User.findById(me.userId);
      let floorFiles: any[] = [];

      if (user) {
        const membership = user.organizations?.find(
          (org) => org.organization.toString() === organizationId
        );

        if (
          membership &&
          (membership.role === "founder" || membership.role === "stakeholder")
        ) {
          const floorFilesQuery: any = {
            organization: organizationId,
            cabinet: { $exists: true },
          };

          const allFloorFiles = await FloorFile.find(floorFilesQuery).populate(
            "cabinet",
            "name path floorId"
          );

          // Filter floor files based on user permissions
          const userFloorId = await CabinetController.getUserFloorIdForOrg(
            me.userId,
            organizationId as string
          );
          floorFiles = allFloorFiles.filter((file: any) => {
            const cabinet = file.cabinet;
            if ((cabinet as any).floorId !== undefined) {
              if (membership.role === "founder") {
                return true; // Founders can see all floor files
              } else if (membership.role === "stakeholder") {
                return userFloorId === (cabinet as any).floorId?.toString();
              }
            }
            return false;
          });
        }
      }

      res.json({
        success: true,
        data: {
          userFiles,
          floorFiles,
          totalFiles: userFiles.length + floorFiles.length,
        },
      });
    } catch (error) {
      console.error("Get all user files error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ========== ORGANIZATION CABINET METHODS ==========

  /**
   * Get or create organization cabinet
   */
  static async getOrCreateOrganizationCabinet(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      // First, try to find existing organization cabinet
      let organizationCabinet = await OrganizationCabinet.findOne({
        organization: organizationId,
      });

      console.log(
        "🔍 Looking for organization cabinet for org:",
        organizationId
      );
      console.log("📁 Found existing cabinet:", !!organizationCabinet);

      // If no cabinet exists, create one
      if (!organizationCabinet) {
        try {
          console.log(
            "🆕 Creating new organization cabinet for org:",
            organizationId
          );
          organizationCabinet = new OrganizationCabinet({
            name: "Organization Cabinet",
            description: "Shared cabinet for all organization members",
            owner: me.userId, // Creator becomes the initial owner
            organization: organizationId as string,
            path: "/organization",
            isRoot: true,
          });

          await organizationCabinet.save();
          console.log(
            "✅ Successfully created new organization cabinet:",
            organizationCabinet._id
          );
        } catch (createError) {
          console.error("❌ Error creating organization cabinet:", createError);
          return res.status(500).json({
            success: false,
            message: "Failed to create organization cabinet",
            error:
              createError instanceof Error
                ? createError.message
                : "Unknown error",
          });
        }
      } else {
        console.log(
          "📂 Using existing organization cabinet:",
          organizationCabinet._id
        );
      }

      // Get sub-cabinets
      const subCabinets = await OrganizationCabinet.find({
        parentCabinet: organizationCabinet._id,
        organization: organizationId,
      }).sort({ name: 1 });

      // Get files in this cabinet
      console.log("🔍 Looking for files in cabinet:", organizationCabinet._id);
      const files = await OrganizationFile.find({
        cabinet: organizationCabinet._id,
        organization: organizationId,
      }).sort({ name: 1 });

      console.log("📄 Found files:", files.length);
      files.forEach((file) => {
        console.log("📄 File:", file.name, "in cabinet:", file.cabinet);
      });

      // Storage for the whole organization, capped by the office's plan
      // (2 GB on Starter, 200 GB on Pro).
      const storageDetails = await getOrgStorageDetails(
        organizationId as string
      );

      res.json({
        success: true,
        data: {
          cabinet: organizationCabinet,
          subCabinets,
          files,
          storageDetails,
        },
      });
    } catch (error) {
      console.error("❌ Get or create organization cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Create sub-cabinet in organization cabinet
   */
  static async createOrganizationSubCabinet(req: Request, res: Response) {
    try {
      const { name, description, parentCabinetId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!name || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Name and organization ID are required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      if (membership.role !== "founder") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only founders can create folders in the organization cabinet.",
        });
      }

      // Get organization cabinet
      const organizationCabinet = await OrganizationCabinet.findOne({
        organization: organizationId,
      });

      if (!organizationCabinet) {
        return res.status(404).json({
          success: false,
          message: "Organization cabinet not found",
        });
      }

      // Build path
      let path = `${organizationCabinet.path}/${name}`;
      if (parentCabinetId) {
        const parentCabinet = await OrganizationCabinet.findOne({
          _id: parentCabinetId,
          organization: organizationId,
        });
        if (!parentCabinet) {
          return res.status(404).json({
            success: false,
            message: "Parent cabinet not found",
          });
        }
        path = `${parentCabinet.path}/${name}`;
      }

      // Check if cabinet with same name already exists in the same location
      const existingCabinet = await OrganizationCabinet.findOne({
        organization: organizationId,
        path,
      });

      if (existingCabinet) {
        return res.status(409).json({
          success: false,
          message: "A cabinet with this name already exists in this location",
        });
      }

      const cabinet = new OrganizationCabinet({
        name,
        description,
        owner: me.userId,
        organization: organizationId as string,
        parentCabinet: parentCabinetId || organizationCabinet._id,
        path,
        isRoot: false,
      });

      await cabinet.save();

      res.status(201).json({
        success: true,
        message: "Organization sub-cabinet created successfully",
        data: cabinet,
      });
    } catch (error) {
      console.error("Create organization sub-cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Upload file to organization cabinet
   */
  static async uploadFileToOrganizationCabinet(req: Request, res: Response) {
    try {
      const { cabinetId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };
      const file = req.file;

      if (!file || !cabinetId || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "File, cabinet ID, and organization ID are required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      if (membership.role !== "founder") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only founders can upload files to the organization cabinet.",
        });
      }

      console.log("🔍 Upload file to organization cabinet - Debug info:");
      console.log("📁 Cabinet ID:", cabinetId);
      console.log("🏢 Organization ID:", organizationId);
      console.log("📄 File:", file?.originalname, file?.size, file?.mimetype);
      console.log("👤 User ID:", me.userId);

      // Verify cabinet exists and belongs to the organization
      const cabinet = await OrganizationCabinet.findOne({
        _id: cabinetId,
        organization: organizationId as string,
      });

      console.log("📂 Found cabinet:", !!cabinet);
      if (cabinet) {
        console.log("📂 Cabinet details:", cabinet.name, cabinet._id);
      }

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Organization cabinet not found",
        });
      }

      // Plan quota is checked before the S3 put, so a rejected upload never
      // leaves an orphaned object behind.
      const quota = await checkOrgUploadQuota(
        organizationId as string,
        file.size
      );
      if (!quota.allowed) {
        return res.status(413).json({
          success: false,
          message: quota.message,
          error: "STORAGE_LIMIT_REACHED",
          data: {
            storageLimit: quota.storageLimit,
            totalUsed: quota.totalUsed,
            remaining: quota.remaining,
            planSlug: quota.planSlug,
          },
        });
      }

      // Generate S3 key
      const s3Key = s3Service.generateFileKey(
        me.userId,
        organizationId as string,
        file.originalname
      );

      // Upload to S3
      await s3Service.uploadFile(s3Key, file.buffer, file.mimetype, {
        originalName: file.originalname,
        uploadedBy: me.userId,
        cabinetId: cabinetId,
        organizationId: organizationId as string,
      });

      // Get file extension
      const extension = file.originalname.split(".").pop() || "";

      // Create file record in database
      const fileRecord = new OrganizationFile({
        name: file.originalname,
        originalName: file.originalname,
        owner: me.userId,
        organization: organizationId as string,
        cabinet: cabinetId,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET || "",
        s3Region: process.env.AWS_S3_REGION || "",
        mimeType: file.mimetype,
        size: file.size,
        extension,
        path: `${cabinet.path}/${file.originalname}`,
        status: "uploaded",
      });

      console.log(
        "💾 Saving file record:",
        fileRecord.name,
        "to cabinet:",
        fileRecord.cabinet
      );
      await fileRecord.save();
      console.log("✅ File record saved successfully:", fileRecord._id);

      res.status(201).json({
        success: true,
        message: "File uploaded to organization cabinet successfully",
        data: fileRecord,
      });
    } catch (error) {
      console.error("Upload file to organization cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get organization cabinet by ID with its contents
   */
  static async getOrganizationCabinetById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      const cabinet = await OrganizationCabinet.findOne({
        _id: id,
        organization: organizationId,
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Organization cabinet not found",
        });
      }

      // Get sub-cabinets
      const subCabinets = await OrganizationCabinet.find({
        parentCabinet: id,
        organization: organizationId,
      }).sort({ name: 1 });

      // Get files in this cabinet
      const files = await OrganizationFile.find({
        cabinet: id,
        organization: organizationId,
      }).sort({ name: 1 });

      // Storage for the whole organization, capped by the office's plan
      // (2 GB on Starter, 200 GB on Pro).
      const storageDetails = await getOrgStorageDetails(
        organizationId as string
      );

      res.json({
        success: true,
        data: {
          cabinet,
          subCabinets,
          files,
          storageDetails,
        },
      });
    } catch (error) {
      console.error("Get organization cabinet by ID error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Delete organization file
   */
  static async deleteOrganizationFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      if (membership.role !== "founder") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only founders can delete files from the organization cabinet.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: organizationId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Delete from S3
      await s3Service.deleteFile(file.s3Key);

      // Delete from database
      await OrganizationFile.findByIdAndDelete(fileId);

      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      console.error("Delete organization file error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Rename organization file
   */
  static async renameOrganizationFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { name } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "File name is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      if (membership.role !== "founder") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only founders can rename files in the organization cabinet.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: organizationId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Validate file name
      const trimmedName = name.trim();
      if (trimmedName.includes("/") || trimmedName.includes("\\")) {
        return res.status(400).json({
          success: false,
          message: "File name cannot contain slashes",
        });
      }

      // Check if a file with the same name already exists in the same cabinet
      const existingFile = await OrganizationFile.findOne({
        cabinet: file.cabinet,
        name: trimmedName,
        organization: organizationId,
        _id: { $ne: fileId },
      });

      if (existingFile) {
        return res.status(409).json({
          success: false,
          message: "A file with this name already exists in this folder",
        });
      }

      // Keeps name, originalName, extension and path in sync — downloads read
      // originalName, so renaming only `name` saved the old file name.
      applyFileRename(file, trimmedName);
      await file.save();

      res.json({
        success: true,
        message: "File renamed successfully",
        data: file,
      });
    } catch (error) {
      console.error("Rename organization file error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Rename organization cabinet
   */
  static async renameOrganizationCabinet(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Cabinet name is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      if (membership.role !== "founder") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only founders can rename cabinets in the organization cabinet.",
        });
      }

      const cabinet = await OrganizationCabinet.findOne({
        _id: id,
        organization: organizationId,
      });

      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // Validate cabinet name
      const trimmedName = name.trim();
      if (trimmedName.includes("/") || trimmedName.includes("\\")) {
        return res.status(400).json({
          success: false,
          message: "Cabinet name cannot contain slashes",
        });
      }

      // Check if name change would conflict
      const parentPath = cabinet.parentCabinet
        ? (await OrganizationCabinet.findById(cabinet.parentCabinet))?.path || ""
        : "";
      const newPath = parentPath ? `${parentPath}/${trimmedName}` : `/${trimmedName}`;

      const existingCabinet = await OrganizationCabinet.findOne({
        organization: organizationId,
        path: newPath,
        _id: { $ne: id },
      });

      if (existingCabinet) {
        return res.status(409).json({
          success: false,
          message: "A cabinet with this name already exists in this location",
        });
      }

      cabinet.name = trimmedName;
      cabinet.path = newPath;
      await cabinet.save();

      res.json({
        success: true,
        message: "Cabinet renamed successfully",
        data: cabinet,
      });
    } catch (error) {
      console.error("Rename organization cabinet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get organization file download URL
   */
  static async getOrganizationFileDownloadUrl(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: organizationId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Generate public URL (never expires)
      const downloadUrl = s3Service.getPublicUrl(file.s3Key);

      res.json({
        success: true,
        data: {
          downloadUrl,
          fileName: downloadNameFor(file),
          fileSize: file.size,
        },
      });
    } catch (error) {
      console.error("Get organization file download URL error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Stream organization file for download (proxy to avoid CORS)
   */
  static async streamOrganizationFileDownload(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: organizationId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Get file from S3
      const fileBuffer = await s3Service.getFile(file.s3Key);

      res.setHeader("Content-Type", file.mimeType);
      res.setHeader(
        "Content-Disposition",
        buildContentDisposition(downloadNameFor(file))
      );
      res.setHeader("Content-Length", file.size);

      res.send(fileBuffer);
    } catch (error) {
      console.error("Stream organization file download error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // ========== PERSONAL CABINET SHARING METHODS ==========

  /**
   * Share a personal cabinet file or folder with another user
   */
  static async sharePersonalItem(req: Request, res: Response) {
    try {
      const { itemId, itemType, sharedWithUserId } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!itemId || !itemType || !sharedWithUserId || !organizationId) {
        return res.status(400).json({
          success: false,
          message:
            "Item ID, item type, shared with user ID, and organization ID are required",
        });
      }

      if (!["file", "cabinet"].includes(itemType)) {
        return res.status(400).json({
          success: false,
          message: "Item type must be 'file' or 'cabinet'",
        });
      }

      // Check if user is a member of the organization
      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const membership = user.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You are not a member of this organization.",
        });
      }

      // Check if the shared-with user exists and is in the same organization
      const sharedWithUser = await User.findById(sharedWithUserId);
      if (!sharedWithUser) {
        return res.status(404).json({
          success: false,
          message: "User to share with not found",
        });
      }

      const sharedWithMembership = sharedWithUser.organizations?.find(
        (org) => org.organization.toString() === organizationId
      );

      if (!sharedWithMembership) {
        return res.status(403).json({
          success: false,
          message: "User is not a member of this organization",
        });
      }

      // Verify the item exists and belongs to the current user
      let item;
      if (itemType === "file") {
        item = await UserFile.findOne({
          _id: itemId,
          owner: me.userId,
          organization: organizationId,
        });
      } else {
        item = await UserCabinet.findOne({
          _id: itemId,
          owner: me.userId,
          organization: organizationId,
        });
      }

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Item not found or you don't have permission to share it",
        });
      }

      // Check if already shared with this user
      const existingShare = await SharedItem.findOne({
        itemId,
        itemType,
        sharedWith: sharedWithUserId,
        owner: me.userId,
        organization: organizationId,
      });

      if (existingShare) {
        return res.status(409).json({
          success: false,
          message: "This item is already shared with this user",
        });
      }

      // Create the share with view+download permissions and auto-accept
      const sharedItem = new SharedItem({
        itemId,
        itemType,
        owner: me.userId,
        sharedWith: sharedWithUserId,
        organization: organizationId as string,
        permissions: {
          canView: true,
          canDownload: true,
          canEdit: false,
          canDelete: false,
        },
        status: "accepted",
        respondedAt: new Date(),
      });

      await sharedItem.save();

      res.status(201).json({
        success: true,
        message: "Item shared successfully",
        data: sharedItem,
      });
    } catch (error) {
      console.error("Share personal item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get items shared with the current user
   */
  static async getSharedWithMe(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Get all items shared with the current user
      const sharedItems = await SharedItem.find({
        sharedWith: me.userId,
        organization: organizationId,
        status: { $in: ["pending", "accepted"] },
      })
        .populate("owner", "name email profilePicture")
        .populate("sharedWith", "name email profilePicture")
        .sort({ createdAt: -1 });

      // Get the actual items (files/cabinets) and their details
      const itemsWithDetails = await Promise.all(
        sharedItems.map(async (sharedItem) => {
          let item;
          if (sharedItem.itemType === "file") {
            item = await UserFile.findById(sharedItem.itemId).populate(
              "cabinet",
              "name path"
            );
          } else {
            item = await UserCabinet.findById(sharedItem.itemId);
          }

          return {
            ...sharedItem.toObject(),
            item,
          };
        })
      );

      // Also get collaborative documents where user is a collaborator (but not creator)
      const collaborativeDocuments = await CollaborativeDocument.find({
        organization: organizationId,
        collaborators: me.userId,
        createdBy: { $ne: me.userId }, // Not created by the current user
      })
        .populate("createdBy", "name email profilePicture")
        .populate("collaborators", "name email profilePicture")
        .sort({ updatedAt: -1 });

      // Convert collaborative documents to shared item format
      const collaborativeDocsAsSharedItems = collaborativeDocuments.map((doc) => ({
        _id: doc._id,
        itemId: doc._id,
        itemType: "document",
        documentType: doc.type,
        owner: doc.createdBy,
        sharedWith: me.userId,
        organization: organizationId,
        status: "accepted",
        permissions: {
          canView: true,
          canEdit: true,
          canDownload: true,
        },
        message: null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        item: {
          _id: doc._id,
          title: doc.title,
          type: doc.type,
          fileKey: doc.fileKey,
          filePath: doc.filePath,
          mimeType: doc.mimeType,
          size: doc.size,
          createdBy: doc.createdBy,
          collaborators: doc.collaborators,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
      }));

      // Combine both types of shared items
      const allSharedItems = [...itemsWithDetails, ...collaborativeDocsAsSharedItems];

      res.json({
        success: true,
        data: allSharedItems,
      });
    } catch (error) {
      console.error("Get shared with me error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get items shared by the current user
   */
  static async getSharedByMe(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Get all items shared by the current user
      const sharedItems = await SharedItem.find({
        owner: me.userId,
        organization: organizationId,
      })
        .populate("owner", "name email profilePicture")
        .populate("sharedWith", "name email profilePicture")
        .sort({ createdAt: -1 });

      // Get the actual items (files/cabinets) and their details
      const itemsWithDetails = await Promise.all(
        sharedItems.map(async (sharedItem) => {
          let item;
          if (sharedItem.itemType === "file") {
            item = await UserFile.findById(sharedItem.itemId).populate(
              "cabinet",
              "name path"
            );
          } else {
            item = await UserCabinet.findById(sharedItem.itemId);
          }

          return {
            ...sharedItem.toObject(),
            item,
          };
        })
      );

      res.json({
        success: true,
        data: itemsWithDetails,
      });
    } catch (error) {
      console.error("Get shared by me error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Update sharing permissions or status
   */
  static async updateShare(req: Request, res: Response) {
    try {
      const { shareId } = req.params;
      const { permissions, status, message } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const sharedItem = await SharedItem.findOne({
        _id: shareId,
        organization: organizationId,
        $or: [{ owner: me.userId }, { sharedWith: me.userId }],
      });

      if (!sharedItem) {
        return res.status(404).json({
          success: false,
          message: "Shared item not found",
        });
      }

      // Only the owner can update permissions, only the recipient can update status
      if (sharedItem.owner.toString() === me.userId) {
        // Owner updating permissions
        if (permissions) {
          sharedItem.permissions = {
            ...sharedItem.permissions,
            ...permissions,
          };
        }
        if (message !== undefined) {
          sharedItem.message = message;
        }
      } else if (sharedItem.sharedWith.toString() === me.userId) {
        // Recipient updating status
        if (status && ["accepted", "declined"].includes(status)) {
          sharedItem.status = status;
          sharedItem.respondedAt = new Date();
        }
      }

      await sharedItem.save();

      res.json({
        success: true,
        message: "Share updated successfully",
        data: sharedItem,
      });
    } catch (error) {
      console.error("Update share error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Revoke a share (only owner can do this)
   */
  static async revokeShare(req: Request, res: Response) {
    try {
      const { shareId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      const sharedItem = await SharedItem.findOne({
        _id: shareId,
        owner: me.userId,
        organization: organizationId,
      });

      if (!sharedItem) {
        return res.status(404).json({
          success: false,
          message:
            "Shared item not found or you don't have permission to revoke it",
        });
      }

      sharedItem.status = "revoked";
      await sharedItem.save();

      res.json({
        success: true,
        message: "Share revoked successfully",
      });
    } catch (error) {
      console.error("Revoke share error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get shared file download URL (for files shared with the user)
   */
  static async getSharedFileDownloadUrl(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if the file is shared with the current user
      const sharedItem = await SharedItem.findOne({
        itemId: fileId,
        itemType: "file",
        sharedWith: me.userId,
        organization: organizationId,
        status: { $in: ["pending", "accepted"] },
      });

      if (!sharedItem) {
        return res.status(404).json({
          success: false,
          message: "File not found or not shared with you",
        });
      }

      if (!sharedItem.permissions?.canDownload) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to download this file",
        });
      }

      const file = await UserFile.findById(fileId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Log the access
      await SharedAccessLog.create({
        sharedItem: sharedItem._id,
        accessedBy: me.userId,
        action: "download",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Generate public URL (never expires)
      const downloadUrl = s3Service.getPublicUrl(file.s3Key);

      res.json({
        success: true,
        data: {
          downloadUrl,
          fileName: downloadNameFor(file),
          fileSize: file.size,
        },
      });
    } catch (error) {
      console.error("Get shared file download URL error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Stream shared file for download (proxy to avoid CORS)
   */
  static async streamSharedFileDownload(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if the file is shared with the current user
      const sharedItem = await SharedItem.findOne({
        itemId: fileId,
        itemType: "file",
        sharedWith: me.userId,
        organization: organizationId,
        status: { $in: ["pending", "accepted"] },
      });

      if (!sharedItem) {
        return res.status(404).json({
          success: false,
          message: "File not found or not shared with you",
        });
      }

      if (!sharedItem.permissions?.canDownload) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to download this file",
        });
      }

      const file = await UserFile.findById(fileId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // Log the access
      await SharedAccessLog.create({
        sharedItem: sharedItem._id,
        accessedBy: me.userId,
        action: "download",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Get file from S3
      const fileBuffer = await s3Service.getFile(file.s3Key);

      res.setHeader("Content-Type", file.mimeType);
      res.setHeader(
        "Content-Disposition",
        buildContentDisposition(downloadNameFor(file))
      );
      res.setHeader("Content-Length", file.size);

      res.send(fileBuffer);
    } catch (error) {
      console.error("Stream shared file download error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get shared cabinet contents (for cabinets shared with the user)
   */
  static async getSharedCabinetContents(req: Request, res: Response) {
    try {
      const { cabinetId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Check if the cabinet is shared with the current user
      const sharedItem = await SharedItem.findOne({
        itemId: cabinetId,
        itemType: "cabinet",
        sharedWith: me.userId,
        organization: organizationId,
        status: { $in: ["pending", "accepted"] },
      });

      if (!sharedItem) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found or not shared with you",
        });
      }

      const cabinet = await UserCabinet.findById(cabinetId);
      if (!cabinet) {
        return res.status(404).json({
          success: false,
          message: "Cabinet not found",
        });
      }

      // Log the access
      await SharedAccessLog.create({
        sharedItem: sharedItem._id,
        accessedBy: me.userId,
        action: "view",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Get sub-cabinets (only if user has view permission)
      let subCabinets: any[] = [];
      if (sharedItem.permissions?.canView) {
        subCabinets = await UserCabinet.find({
          parentCabinet: cabinetId,
          organization: organizationId,
          owner: cabinet.owner, // Only show cabinets owned by the same user
        }).sort({ name: 1 });
      }

      // Get files (only if user has view permission)
      let files: any[] = [];
      if (sharedItem.permissions?.canView) {
        files = await UserFile.find({
          cabinet: cabinetId,
          organization: organizationId,
          owner: cabinet.owner, // Only show files owned by the same user
        }).sort({ name: 1 });
      }

      res.json({
        success: true,
        data: {
          cabinet,
          subCabinets,
          files,
          shareInfo: {
            permissions: sharedItem.permissions,
            sharedBy: sharedItem.owner,
            message: sharedItem.message,
            sharedAt: sharedItem.createdAt,
          },
        },
      });
    } catch (error) {
      console.error("Get shared cabinet contents error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get users by email for sharing (organization members only)
   */
  static async getUsersByEmail(req: Request, res: Response) {
    try {
      const { email } = req.query;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!email || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Email and organization ID are required",
        });
      }

      // Find users by email OR phone who are members of the same organization.
      // `email` is user input going into a RegExp — every other search site in
      // the codebase escapes it; this one did not, so "(" threw and ".*"
      // returned the whole org.
      // `req.query` values are string | ParsedQs | arrays — coerce before use.
      const rx = new RegExp(escapeRegex(String(email)), "i");
      const users = await User.find({
        $or: [{ email: rx }, { phone: rx }],
        "organizations.organization": organizationId,
        _id: { $ne: me.userId }, // Exclude current user
      })
        .select("_id name email")
        .limit(10);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Get users by email error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get existing shares for a specific item
   */
  static async getItemShares(req: Request, res: Response) {
    try {
      const { itemId, itemType } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!itemId || !itemType || !organizationId) {
        return res.status(400).json({
          success: false,
          message: "Item ID, item type, and organization ID are required",
        });
      }

      // Get all shares for this item by the current user
      const shares = await SharedItem.find({
        itemId,
        itemType,
        owner: me.userId,
        organization: organizationId,
      })
        .populate("sharedWith", "name email profilePicture")
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: shares,
      });
    } catch (error) {
      console.error("Get item shares error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Get all organization members for sharing
   */
  static async getOrganizationMembers(req: Request, res: Response) {
    try {
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Find all users who are members of the same organization
      const users = await User.find({
        "organizations.organization": organizationId,
        _id: { $ne: me.userId }, // Exclude current user
      })
        .select("_id name email profilePicture")
        .sort({ name: 1 });

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Get organization members error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  /**
   * Private helper: runs the full Gemini transcription pipeline on a saved OrganizationFile record.
   * Fetches video from S3, uploads to Gemini File API, polls for ACTIVE state, generates
   * transcript + summary + action items, persists to metadata, updates status.
   */
  private static async _runTranscription(fileRecord: any): Promise<void> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const { GoogleAIFileManager } = await import("@google/generative-ai/server");

    const apiKey = "AIzaSyBaf2cDGdxE8f9omgSO_JQU6tM7DoQ0lUQ";
    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    // 1. Fetch video buffer from S3
    const s3Object = await s3Service.getFile(fileRecord.s3Key);
    const chunks: Buffer[] = [];
    for await (const chunk of s3Object as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const videoBuffer = Buffer.concat(chunks);

    // 2. Write to temp file
    const safeName = (fileRecord.name as string).replace(/[^a-zA-Z0-9_.-]/g, "-");
    const tmpPath = pathModule.join(os.tmpdir(), `transcribe-${Date.now()}-${safeName}`);
    await fsPromises.writeFile(tmpPath, videoBuffer);

    // 3. Upload to Gemini File API
    let uploaded: any;
    try {
      uploaded = await fileManager.uploadFile(tmpPath, {
        mimeType: fileRecord.mimeType,
        displayName: fileRecord.name,
      });
    } finally {
      fsPromises.unlink(tmpPath).catch(() => {});
    }

    const uploadedName: string = uploaded?.file?.name || uploaded?.name;
    if (!uploadedName) throw new Error("Gemini file upload failed — no file name returned");

    // 4. Poll until ACTIVE (up to 90s for larger recordings)
    const maxWaitMs = 90_000;
    const intervalMs = 1000;
    const start = Date.now();
    let fileMeta: any = null;
    while (Date.now() - start < maxWaitMs) {
      fileMeta = await fileManager.getFile(uploadedName).catch(() => null);
      if (fileMeta?.state === "ACTIVE") break;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    if (!fileMeta || fileMeta.state !== "ACTIVE") {
      throw new Error("Gemini file did not become ACTIVE within 90s");
    }

    // 5. Ask Gemini for transcript + summary + action items
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const prompt = `You are a professional meeting assistant. Carefully analyze this meeting recording and provide:
1. TRANSCRIPTION: A complete timestamped transcript of all spoken audio. Format each line as [HH:MM:SS] text. If multiple speakers can be distinguished, prefix with "Speaker A:", "Speaker B:", etc.
2. SUMMARY: A concise meeting summary — 3 to 5 bullet points covering the key discussion topics and decisions.
3. ACTION_ITEMS: A list of concrete action items or decisions made in the meeting. If none, return an empty array.

Respond ONLY with valid JSON in exactly this shape (no markdown, no code fences, no extra keys):
{"transcription":"...","summary":["..."],"actionItems":["..."]}`;

    const geminiResponse = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              // @ts-ignore
              fileData: {
                fileUri: fileMeta?.uri || uploaded?.file?.uri || uploaded?.uri,
                mimeType: fileRecord.mimeType,
              },
            },
          ],
        },
      ],
    });

    // 6. Parse response
    let rawText = geminiResponse.response.text().trim();
    rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: { transcription: string; summary: string[]; actionItems: string[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { transcription: rawText, summary: [], actionItems: [] };
    }

    // 7. Persist to metadata and mark ready
    fileRecord.metadata = {
      ...(fileRecord.metadata || {}),
      transcription: {
        ...parsed,
        generatedAt: new Date().toISOString(),
        model: "gemini-2.5-flash-lite",
      },
    };
    fileRecord.status = "ready";
    await fileRecord.save();
  }

  /**
   * GET /cabinet/organization/files/:fileId/transcribe
   * Returns cached transcription if available.
   * If still processing, returns 202. If not started, fires it synchronously and returns result.
   */
  static async transcribeOrganizationRecording(req: Request, res: Response) {
    const { fileId } = req.params;
    const me = (req as any).user as { userId: string; orgId: string };

    try {
      const fileRecord = await OrganizationFile.findOne({
        _id: fileId,
        organization: me.orgId,
      });

      if (!fileRecord) {
        return res.status(404).json({ success: false, message: "Recording not found" });
      }

      if (!fileRecord.mimeType.startsWith("video/")) {
        return res.status(400).json({ success: false, message: "File is not a video" });
      }

      // Return cached transcription if already done
      if (fileRecord.metadata?.transcription) {
        return res.json({ success: true, data: fileRecord.metadata.transcription });
      }

      // Still being processed in the background
      if (fileRecord.status === "processing") {
        return res.status(202).json({ success: false, message: "Transcription is still processing. Please check back shortly." });
      }

      // Not started yet (e.g. manually uploaded file) — run synchronously
      fileRecord.status = "processing";
      await fileRecord.save();
      try {
        await CabinetController._runTranscription(fileRecord);
        return res.json({ success: true, data: fileRecord.metadata.transcription });
      } catch (err) {
        fileRecord.status = "error";
        await fileRecord.save();
        throw err;
      }
    } catch (error) {
      console.error("Transcribe recording error:", error);
      return res.status(500).json({ success: false, message: "Internal server error during transcription" });
    }
  }
}

export { upload };
