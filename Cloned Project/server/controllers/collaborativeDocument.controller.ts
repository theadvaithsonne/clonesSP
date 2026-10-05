// Collaborative Document Controller for ONLYOFFICE Integration
import { Request, Response } from "express";
import {
  CollaborativeDocument,
  DocumentType,
  ICollaborativeDocument,
} from "../models/collaborativeDocument.model";
import { s3Service } from "../services/s3";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Document, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";

// ONLYOFFICE JWT Secret
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || "secret";

// Create proper blank docx file using docx library
async function createBlankDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [new Paragraph({ children: [] })],
      },
    ],
  });
  return await Packer.toBuffer(doc);
}

// Create proper blank xlsx file using exceljs library
async function createBlankXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Sheet1");
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Create proper blank pptx file using pptxgenjs library
async function createBlankPptx(): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.addSlide(); // Add one blank slide
  const data = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(data as ArrayBuffer);
}

// Old createBlankPptx - replaced
function _oldCreateBlankPptx(): Buffer {
  const minimalPptx = Buffer.from(
    "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" +
    "SwUGAAAAAAwADAD/AgAAMwoAAAAA",
    "base64"
  );
  return minimalPptx;
}

// Generate unique document key
function generateDocumentKey(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString("hex");
  return `doc_${timestamp}_${randomPart}`;
}

// Generate ONLYOFFICE JWT token for document config
function generateOnlyOfficeToken(payload: object): string {
  return jwt.sign(payload, ONLYOFFICE_JWT_SECRET, {
    expiresIn: "1h",
  });
}

// Get file extension for document type
function getFileExtension(type: DocumentType): string {
  switch (type) {
    case "word":
      return "docx";
    case "cell":
      return "xlsx";
    case "slide":
      return "pptx";
    default:
      return "docx";
  }
}

// Get MIME type for document type
function getMimeType(type: DocumentType): string {
  switch (type) {
    case "word":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "cell":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "slide":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
}

export class CollaborativeDocumentController {
  /**
   * Create a new collaborative document
   */
  static async createDocument(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const organizationId = req.query.organizationId as string;
      const { title, type, cabinetId } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      if (!title || !type) {
        return res.status(400).json({
          success: false,
          error: "Title and type are required",
        });
      }

      if (!["word", "cell", "slide"].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid document type. Must be 'word', 'cell', or 'slide'",
        });
      }

      // Generate unique document key and file path
      const documentKey = generateDocumentKey();
      const extension = getFileExtension(type);
      const mimeType = getMimeType(type);
      const fileName = `${documentKey}.${extension}`;
      const filePath = `documents/${organizationId}/${userId}/${fileName}`;

      // Create blank template based on document type
      let blankTemplate: Buffer;
      switch (type as DocumentType) {
        case "word":
          blankTemplate = await createBlankDocx();
          break;
        case "cell":
          blankTemplate = await createBlankXlsx();
          break;
        case "slide":
          blankTemplate = await createBlankPptx();
          break;
        default:
          blankTemplate = await createBlankDocx();
      }

      // Upload blank template to S3
      await s3Service.uploadFile(filePath, blankTemplate, mimeType, {
        documentKey,
        type,
        createdBy: userId,
      });

      // Create document record
      const document = new CollaborativeDocument({
        title,
        type,
        organization: organizationId,
        cabinet: cabinetId || undefined,
        createdBy: userId,
        collaborators: [],
        fileKey: documentKey,
        filePath,
        version: 1,
        size: blankTemplate.length,
        mimeType,
      });

      await document.save();

      // Populate creator info
      await document.populate("createdBy", "name email profilePicture");

      return res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      console.error("Error creating document:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create document",
      });
    }
  }

  /**
   * Create collaborative document from existing uploaded file
   */
  static async createFromFile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const organizationId = req.query.organizationId as string;
      const { fileId, title, type } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      if (!fileId || !title || !type) {
        return res.status(400).json({
          success: false,
          error: "fileId, title, and type are required",
        });
      }

      if (!["word", "cell", "slide"].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid document type. Must be 'word', 'cell', or 'slide'",
        });
      }

      // Import UserFile model dynamically to avoid circular dependencies
      const { UserFile } = await import("../models/cabinet.model");

      // Find the existing file
      const existingFile = await UserFile.findOne({
        _id: fileId,
        organization: organizationId,
      });

      if (!existingFile) {
        return res.status(404).json({
          success: false,
          error: "File not found",
        });
      }

      // Get the file content from S3
      const fileBuffer = await s3Service.getFile(existingFile.s3Key);

      // Generate unique document key and file path
      const documentKey = generateDocumentKey();
      const extension = getFileExtension(type);
      const mimeType = getMimeType(type);
      const fileName = `${documentKey}.${extension}`;
      const filePath = `documents/${organizationId}/${userId}/${fileName}`;

      // Upload the file to the collaborative documents location
      await s3Service.uploadFile(filePath, fileBuffer, mimeType, {
        documentKey,
        type,
        createdBy: userId,
        sourceFileId: fileId,
      });

      // Create document record
      const document = new CollaborativeDocument({
        title: title || existingFile.name?.replace(/\.[^/.]+$/, "") || "Untitled",
        type,
        organization: organizationId,
        cabinet: existingFile.cabinet || undefined,
        createdBy: userId,
        collaborators: [],
        fileKey: documentKey,
        filePath,
        version: 1,
        size: fileBuffer.length,
        mimeType,
      });

      await document.save();

      // Populate creator info
      await document.populate("createdBy", "name email profilePicture");

      return res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      console.error("Error creating document from file:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create document from file",
      });
    }
  }

  /**
   * Get all documents for an organization
   */
  static async getDocuments(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const organizationId = req.query.organizationId as string;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      // Get documents where user is creator or collaborator
      const documents = await CollaborativeDocument.find({
        organization: organizationId,
        $or: [{ createdBy: userId }, { collaborators: userId }],
      })
        .populate("createdBy", "name email profilePicture")
        .populate("collaborators", "name email profilePicture")
        .sort({ updatedAt: -1 });

      return res.status(200).json({
        success: true,
        data: documents,
      });
    } catch (error) {
      console.error("Error getting documents:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get documents",
      });
    }
  }

  /**
   * Get a single document by ID
   */
  static async getDocumentById(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const user = (req as any).user;
      const { documentId } = req.params;
      const organizationId = req.query.organizationId as string;
      const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      const document = await CollaborativeDocument.findOne({
        _id: documentId,
        organization: organizationId,
        $or: [{ createdBy: userId }, { collaborators: userId }],
      })
        .populate("createdBy", "name email profilePicture")
        .populate("collaborators", "name email profilePicture");

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found or access denied",
        });
      }

      // Use backend proxy URL for ONLYOFFICE to fetch (works better with Docker)
      const fileUrl = `${backendUrl}/cabinet/documents/${documentId}/file`;

      // Build the callback URL
      const callbackUrl = `${backendUrl}/cabinet/documents/${documentId}/callback?organizationId=${organizationId}`;

      // Build the ONLYOFFICE editor config payload
      // IMPORTANT: Key must be unique per editing session. ONLYOFFICE caches by key,
      // so we append version + timestamp to ensure a fresh key.
      const sessionTimestamp = Math.floor(Date.now() / 1000); // Unix timestamp
      const documentKey = `${document.fileKey}_v${document.version}_t${sessionTimestamp}`;

      console.log(`[ONLYOFFICE] Document: ${document.title}`);
      console.log(`[ONLYOFFICE] Generated key: ${documentKey}`);
      console.log(`[ONLYOFFICE] File URL: ${fileUrl}`);
      console.log(`[ONLYOFFICE] Callback URL: ${callbackUrl}`);

      const editorConfig = {
        document: {
          fileType: getFileExtension(document.type),
          key: documentKey,
          title: document.title,
          url: fileUrl,
          permissions: {
            edit: true,
            download: true,
            print: true,
            comment: true,
            review: true,
            chat: true,
          },
        },
        editorConfig: {
          callbackUrl: callbackUrl,
          user: {
            id: userId,
            name: user?.name || "User",
          },
          mode: "edit",
          lang: "en",
          customization: {
            autosave: true,
            forcesave: true,
            comments: true,
            logo: {
              image: "",
              imageEmbedded: "",
              visible: false,
            },
          },
        },
      };

      // Generate JWT token for ONLYOFFICE
      const token = generateOnlyOfficeToken(editorConfig);

      return res.status(200).json({
        success: true,
        data: {
          ...document.toObject(),
          fileUrl,
          documentKey: documentKey,
          callbackUrl,
          token,
          editorConfig,
        },
      });
    } catch (error) {
      console.error("Error getting document:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get document",
      });
    }
  }

  /**
   * Update document (rename, add collaborators, etc.)
   */
  static async updateDocument(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { documentId } = req.params;
      const organizationId = req.query.organizationId as string;
      const { title, collaborators } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      const document = await CollaborativeDocument.findOne({
        _id: documentId,
        organization: organizationId,
        createdBy: userId, // Only creator can update
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found or access denied",
        });
      }

      if (title) {
        document.title = title;
      }

      if (collaborators) {
        document.collaborators = collaborators;
      }

      await document.save();

      await document.populate("createdBy", "name email profilePicture");
      await document.populate("collaborators", "name email profilePicture");

      return res.status(200).json({
        success: true,
        data: document,
      });
    } catch (error) {
      console.error("Error updating document:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to update document",
      });
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { documentId } = req.params;
      const organizationId = req.query.organizationId as string;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      const document = await CollaborativeDocument.findOne({
        _id: documentId,
        organization: organizationId,
        createdBy: userId, // Only creator can delete
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found or access denied",
        });
      }

      // Delete file from S3
      try {
        await s3Service.deleteFile(document.filePath);
      } catch (error) {
        console.error("Error deleting file from S3:", error);
        // Continue with document deletion even if S3 fails
      }

      await CollaborativeDocument.deleteOne({ _id: documentId });

      return res.status(200).json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to delete document",
      });
    }
  }

  /**
   * Serve document file directly (for ONLYOFFICE to fetch)
   * No auth required - ONLYOFFICE server needs to fetch this
   */
  static async serveDocumentFile(req: Request, res: Response) {
    const timestamp = new Date().toISOString();
    const { documentId } = req.params;

    console.log(`\n---------- FILE SERVE REQUEST ----------`);
    console.log(`[${timestamp}] Document: ${documentId}`);
    console.log(`[${timestamp}] Request IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`[${timestamp}] User-Agent: ${req.headers['user-agent']}`);

    try {
      const document = await CollaborativeDocument.findById(documentId);

      if (!document) {
        console.error(`[${timestamp}] ERROR: Document not found: ${documentId}`);
        console.log(`---------- FILE SERVE END (404) ----------\n`);
        return res.status(404).json({
          success: false,
          error: "Document not found",
        });
      }

      console.log(`[${timestamp}] Document found: ${document.title}`);
      console.log(`[${timestamp}] File path: ${document.filePath}`);

      // Get file from S3
      const fetchStartTime = Date.now();
      const fileBuffer = await s3Service.getFile(document.filePath);
      const fetchDuration = Date.now() - fetchStartTime;

      console.log(`[${timestamp}] S3 fetch completed in ${fetchDuration}ms`);
      console.log(`[${timestamp}] File size: ${fileBuffer.length} bytes`);

      // Set appropriate headers
      res.setHeader("Content-Type", document.mimeType);
      res.setHeader("Content-Length", fileBuffer.length);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${document.title}.${getFileExtension(document.type)}"`
      );

      console.log(`[${timestamp}] SUCCESS: Serving file`);
      console.log(`---------- FILE SERVE END (200) ----------\n`);

      // Send the file
      return res.send(fileBuffer);
    } catch (error: any) {
      console.error(`[${timestamp}] ERROR serving file:`, error.message || error);
      console.error(`[${timestamp}] Stack:`, error.stack);
      console.log(`---------- FILE SERVE END (500) ----------\n`);
      return res.status(500).json({
        success: false,
        error: "Failed to serve document file",
      });
    }
  }

  /**
   * ONLYOFFICE callback handler
   * This is called by ONLYOFFICE Document Server when document is saved
   */
  static async onlyofficeCallback(req: Request, res: Response) {
    const timestamp = new Date().toISOString();
    const { documentId } = req.params;
    const organizationId = req.query.organizationId as string;

    console.log(`\n========== ONLYOFFICE CALLBACK START ==========`);
    console.log(`[${timestamp}] Document: ${documentId}`);
    console.log(`[${timestamp}] Organization: ${organizationId}`);
    console.log(`[${timestamp}] Request IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`[${timestamp}] Headers:`, JSON.stringify({
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : 'none',
      'user-agent': req.headers['user-agent'],
    }));
    console.log(`[${timestamp}] Raw Body:`, JSON.stringify(req.body));

    try {
      // Verify JWT token from ONLYOFFICE (if present in Authorization header or body)
      let payload = req.body;
      const authHeader = req.headers.authorization;
      let jwtVerified = false;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, ONLYOFFICE_JWT_SECRET) as any;
          payload = decoded.payload || decoded;
          jwtVerified = true;
          console.log(`[${timestamp}] JWT from header verified successfully`);
        } catch (jwtError: any) {
          console.error(`[${timestamp}] JWT header verification failed:`, jwtError.message);
        }
      } else if (req.body.token) {
        try {
          const decoded = jwt.verify(req.body.token, ONLYOFFICE_JWT_SECRET) as any;
          payload = decoded.payload || decoded;
          jwtVerified = true;
          console.log(`[${timestamp}] JWT from body verified successfully`);
        } catch (jwtError: any) {
          console.error(`[${timestamp}] JWT body verification failed:`, jwtError.message);
        }
      } else {
        console.log(`[${timestamp}] No JWT token provided, using raw body`);
      }

      const { status, url, key, users, actions } = payload;

      // Status code meanings
      const statusMeanings: { [key: number]: string } = {
        0: "No document with the key identifier",
        1: "Document is being edited",
        2: "Document is ready for saving",
        3: "Document saving error",
        4: "Document is closed with no changes",
        6: "Document is being edited, current state saved (forcesave)",
        7: "Error occurred while force saving",
      };

      console.log(`[${timestamp}] Parsed callback data:`);
      console.log(`  - Status: ${status} (${statusMeanings[status] || 'Unknown'})`);
      console.log(`  - Key: ${key}`);
      console.log(`  - Users: ${JSON.stringify(users)}`);
      console.log(`  - Actions: ${JSON.stringify(actions)}`);
      console.log(`  - URL: ${url || 'none'}`);
      console.log(`  - JWT Verified: ${jwtVerified}`);

      if (status === 2 || status === 6) {
        // Document is ready for saving
        console.log(`[${timestamp}] Status ${status}: Starting document save process...`);

        const document = await CollaborativeDocument.findById(documentId);

        if (!document) {
          console.error(`[${timestamp}] ERROR: Document not found in database: ${documentId}`);
          console.log(`========== ONLYOFFICE CALLBACK END (error: 0 - doc not found) ==========\n`);
          return res.json({ error: 0 });
        }

        console.log(`[${timestamp}] Document found: ${document.title} (${document.type})`);
        console.log(`[${timestamp}] Current version: ${document.version}`);
        console.log(`[${timestamp}] File path: ${document.filePath}`);

        try {
          // Download the updated document from ONLYOFFICE with timeout
          console.log(`[${timestamp}] Fetching document from ONLYOFFICE URL: ${url}`);
          const fetchStartTime = Date.now();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': '*/*',
            },
          });
          clearTimeout(timeoutId);

          const fetchDuration = Date.now() - fetchStartTime;
          console.log(`[${timestamp}] Fetch completed in ${fetchDuration}ms`);
          console.log(`[${timestamp}] Response status: ${response.status} ${response.statusText}`);
          console.log(`[${timestamp}] Response headers:`, JSON.stringify({
            'content-type': response.headers.get('content-type'),
            'content-length': response.headers.get('content-length'),
          }));

          if (!response.ok) {
            console.error(`[${timestamp}] ERROR: Failed to fetch document - ${response.status} ${response.statusText}`);
            console.log(`========== ONLYOFFICE CALLBACK END (error: 1 - fetch failed) ==========\n`);
            return res.json({ error: 1 });
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          console.log(`[${timestamp}] Document buffer received: ${buffer.length} bytes`);

          if (buffer.length === 0) {
            console.error(`[${timestamp}] ERROR: Received empty document from ONLYOFFICE`);
            console.log(`========== ONLYOFFICE CALLBACK END (error: 1 - empty doc) ==========\n`);
            return res.json({ error: 1 });
          }

          // Upload to S3
          console.log(`[${timestamp}] Uploading to S3: ${document.filePath}`);
          const uploadStartTime = Date.now();

          await s3Service.uploadFile(
            document.filePath,
            buffer,
            document.mimeType,
            {
              documentKey: document.fileKey,
              version: (document.version + 1).toString(),
            }
          );

          const uploadDuration = Date.now() - uploadStartTime;
          console.log(`[${timestamp}] S3 upload completed in ${uploadDuration}ms`);

          // Update document record
          const oldVersion = document.version;
          document.version += 1;
          document.size = buffer.length;
          if (users && users.length > 0) {
            document.lastModifiedBy = users[0];
          }
          await document.save();

          console.log(`[${timestamp}] SUCCESS: Document saved!`);
          console.log(`  - Version: ${oldVersion} -> ${document.version}`);
          console.log(`  - Size: ${buffer.length} bytes`);
          console.log(`  - Modified by: ${users?.[0] || 'unknown'}`);
          console.log(`========== ONLYOFFICE CALLBACK END (success) ==========\n`);
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.error(`[${timestamp}] ERROR: Timeout (30s) fetching document from ONLYOFFICE`);
          } else {
            console.error(`[${timestamp}] ERROR: ${error.message || error}`);
            console.error(`[${timestamp}] Stack:`, error.stack);
          }
          console.log(`========== ONLYOFFICE CALLBACK END (error: 1) ==========\n`);
          return res.json({ error: 1 });
        }
      } else {
        console.log(`[${timestamp}] Status ${status}: No save action needed`);
        console.log(`========== ONLYOFFICE CALLBACK END (no action) ==========\n`);
      }

      // ONLYOFFICE expects { error: 0 } for success
      return res.json({ error: 0 });
    } catch (error: any) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] CRITICAL ERROR in callback:`, error.message || error);
      console.error(`[${timestamp}] Stack:`, error.stack);
      console.log(`========== ONLYOFFICE CALLBACK END (critical error) ==========\n`);
      return res.json({ error: 1 });
    }
  }

  /**
   * Add collaborator to document
   */
  static async addCollaborator(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { documentId } = req.params;
      const organizationId = req.query.organizationId as string;
      const { collaboratorId } = req.body;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      if (!collaboratorId) {
        return res.status(400).json({
          success: false,
          error: "Collaborator ID is required",
        });
      }

      const document = await CollaborativeDocument.findOne({
        _id: documentId,
        organization: organizationId,
        createdBy: userId,
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found or access denied",
        });
      }

      // Check if already a collaborator (use toString() for ObjectId comparison)
      if (document.collaborators.some((id: any) => id.toString() === collaboratorId.toString())) {
        return res.status(400).json({
          success: false,
          error: "User is already a collaborator",
        });
      }

      document.collaborators.push(collaboratorId);
      await document.save();

      await document.populate("collaborators", "name email profilePicture");

      return res.status(200).json({
        success: true,
        data: document,
      });
    } catch (error) {
      console.error("Error adding collaborator:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to add collaborator",
      });
    }
  }

  /**
   * Remove collaborator from document
   */
  static async removeCollaborator(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { documentId, collaboratorId } = req.params;
      const organizationId = req.query.organizationId as string;

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID is required",
        });
      }

      const document = await CollaborativeDocument.findOne({
        _id: documentId,
        organization: organizationId,
        createdBy: userId,
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Document not found or access denied",
        });
      }

      document.collaborators = document.collaborators.filter(
        (c) => c.toString() !== collaboratorId
      );
      await document.save();

      await document.populate("collaborators", "name email profilePicture");

      return res.status(200).json({
        success: true,
        data: document,
      });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to remove collaborator",
      });
    }
  }
}
