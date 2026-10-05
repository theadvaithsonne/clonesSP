import { Request, Response } from "express";
import { Types } from "mongoose";
import { ShareableLink } from "../models/shareableLink.model";
import { UserFile, OrganizationFile, FloorFile } from "../models/cabinet.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Floor } from "../models/floor.model";
import { s3Service } from "../services/s3";
import { env } from "../config/env";
import { generateShareableToken } from "../utils/shareableToken";

// 30 days in milliseconds
const LINK_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
// Default max access count
const DEFAULT_MAX_ACCESS_COUNT = 100;
// Presigned URL validity (1 hour)
const PRESIGNED_URL_EXPIRY = 3600;

/**
 * How a file's chosen access mode maps onto a link record.
 *
 * Every link, whatever its access, is `{FRONTEND_URL}/f/{token}` with an
 * identical-looking token. What differs is the record: a "public" one is
 * served by the unauthenticated `/public/f/:token` route, an "office" one is
 * gated behind `/cabinet/f/:token`, which needs a signed-in member of the
 * owning organization. Resolution reads the record, never the token.
 */
type FileAccess = "public" | "office";

/** The record-level wording for an access mode, as stored on the link. */
type AccessLevel = "public" | "restricted";

function linkTypeForAccess(access: FileAccess): "internal" | "external" {
  return access === "public" ? "external" : "internal";
}

function accessForLinkType(linkType: "internal" | "external"): FileAccess {
  return linkType === "external" ? "public" : "office";
}

function accessLevelForLinkType(
  linkType: "internal" | "external"
): AccessLevel {
  return linkType === "external" ? "public" : "restricted";
}

/**
 * Whether a link grants public access.
 *
 * `accessLevel` is the source of truth, with `linkType` as the fallback for
 * records written before that field existed.
 */
function isPublicLink(link: any): boolean {
  if (link?.accessLevel) return link.accessLevel === "public";
  return link?.linkType === "external";
}

/** The access mode stored on a file, defaulting to the private one. */
function fileAccess(file: any): FileAccess {
  return file?.sharing?.access === "public" ? "public" : "office";
}

function shareUrl(token: string): string {
  return `${env.FRONTEND_URL}/f/${token}`;
}

function linkPayload(link: any, isNew: boolean, access: FileAccess) {
  return {
    _id: link._id,
    token: link.token,
    linkType: link.linkType,
    access,
    url: shareUrl(link.token),
    expiresAt: link.expiresAt,
    accessCount: link.accessCount,
    maxAccessCount: link.maxAccessCount,
    isNew,
  };
}

/**
 * Get the file's live link of this type, minting or reviving one when there
 * isn't a usable one.
 *
 * Revived rather than re-created: `{ file, linkType }` is unique, so a link
 * that was revoked or burnt through its access count cannot simply be inserted
 * again. Reviving also rotates the token, which is what we want — a link that
 * was turned off should not come back to life at the same URL.
 */
async function getOrRefreshLink(params: {
  fileId: string;
  fileModel: "UserFile" | "OrganizationFile" | "FloorFile";
  linkType: "internal" | "external";
  ownerId: string;
  organizationId: string;
}): Promise<{ link: any; isNew: boolean }> {
  const { fileId, fileModel, linkType, ownerId, organizationId } = params;

  const existing = await ShareableLink.findOne({ file: fileId, linkType });

  const usable =
    existing &&
    existing.status === "active" &&
    existing.expiresAt > new Date() &&
    existing.accessCount < (existing.maxAccessCount ?? DEFAULT_MAX_ACCESS_COUNT);

  if (usable) {
    // Records written before `accessLevel` existed get it filled in here,
    // rather than leaving resolution to infer it forever.
    const expected = accessLevelForLinkType(linkType);
    if ((existing as any).accessLevel !== expected) {
      (existing as any).accessLevel = expected;
      await existing.save();
    }
    return { link: existing, isNew: false };
  }

  const token = generateShareableToken();
  const expiresAt = new Date(Date.now() + LINK_EXPIRY_MS);
  const accessLevel = accessLevelForLinkType(linkType);

  if (existing) {
    existing.token = token;
    existing.status = "active";
    existing.expiresAt = expiresAt;
    existing.accessCount = 0;
    existing.maxAccessCount = DEFAULT_MAX_ACCESS_COUNT;
    (existing as any).fileModel = fileModel;
    (existing as any).accessLevel = accessLevel;
    existing.organization = new Types.ObjectId(organizationId) as any;
    await existing.save();
    return { link: existing, isNew: true };
  }

  const link = await ShareableLink.create({
    token,
    linkType,
    accessLevel,
    file: fileId,
    fileModel,
    owner: ownerId,
    organization: organizationId,
    expiresAt,
    maxAccessCount: DEFAULT_MAX_ACCESS_COUNT,
  });

  return { link, isNew: true };
}

/** The org membership for this user, or undefined when they aren't a member. */
async function membershipFor(userId: string, organizationId: string) {
  const user = await User.findById(userId).select("organizations").lean();
  return user?.organizations?.find(
    (org: any) => org.organization?.toString() === organizationId.toString()
  );
}

/** Founders (and stakeholders a founder granted full access) may write. */
function isFounderMembership(membership: any): boolean {
  return !!membership && (membership.role === "founder" || !!membership.fullAccess);
}

/** Load a link's file from whichever collection the link points at. */
const LINK_FILE_FIELDS =
  "name originalName description mimeType size s3Key sharing organization";

async function loadLinkFile(link: any): Promise<any | null> {
  // Branched rather than picking a model into a variable: the three models have
  // different document types, and a union of them has no callable `findById`.
  if ((link.fileModel as string) === "OrganizationFile") {
    return OrganizationFile.findById(link.file).select(LINK_FILE_FIELDS).lean();
  }
  if ((link.fileModel as string) === "FloorFile") {
    return FloorFile.findById(link.file).select(LINK_FILE_FIELDS).lean();
  }
  return UserFile.findById(link.file).select(LINK_FILE_FIELDS).lean();
}

/**
 * Who shared this link, as a person's name.
 *
 * The user model carries a single `name`, not first/last, so that is what a
 * preview card gets. The email handle is the fallback for accounts created
 * before a name was collected — better than an anonymous "Someone".
 */
async function sharerNameFor(link: any): Promise<string> {
  const user = await User.findById(link.owner).select("name email").lean();
  const name = ((user as any)?.name || "").trim();
  if (name) return name;
  const handle = String((user as any)?.email || "").split("@")[0];
  return handle || "Someone";
}

/**
 * The safe half of a link: who shared it, what it is called, which office it
 * belongs to. No stream URL and no S3 key.
 *
 * Returned for restricted links too, and deliberately so — a link preview in
 * WhatsApp or Slack is generated by a crawler that will never sign in, so the
 * title has to be answerable without auth. What it exposes is a file name to
 * whoever already holds the token; the file itself stays gated.
 */
async function linkPreviewMeta(link: any) {
  const [file, org, sharedBy] = await Promise.all([
    loadLinkFile(link),
    Organization.findById(link.organization).select("name").lean(),
    sharerNameFor(link),
  ]);

  const fileName = file
    ? (file as any).name || (file as any).originalName || null
    : null;

  return {
    sharedBy,
    fileName,
    fileDescription: (file as any)?.description || null,
    mimeType: (file as any)?.mimeType || null,
    size: (file as any)?.size ?? null,
    organizationId: link.organization.toString(),
    organizationName: (org as any)?.name || "this office",
  };
}

export class ShareableLinkController {
  /**
   * Get or create a shareable link for a personal-cabinet file
   * POST /cabinet/files/:fileId/share-link
   */
  static async getOrCreateLink(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { linkType } = req.body;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      // Validate linkType
      if (!linkType || !["internal", "external"].includes(linkType)) {
        return res.status(400).json({
          success: false,
          error: 'linkType must be "internal" or "external"',
        });
      }

      // Validate fileId
      if (!fileId || !Types.ObjectId.isValid(fileId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid file ID",
        });
      }

      const orgId = (organizationId as string) || me.orgId;
      if (!orgId) {
        return res.status(400).json({
          success: false,
          error: "Organization ID required",
        });
      }

      // Find the file and verify ownership
      const file = await UserFile.findOne({
        _id: fileId,
        organization: orgId,
        owner: me.userId,
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          error: "File not found or you are not the owner",
        });
      }

      const { link, isNew } = await getOrRefreshLink({
        fileId,
        fileModel: "UserFile",
        linkType,
        ownerId: me.userId,
        organizationId: orgId,
      });

      return res.status(isNew ? 201 : 200).json({
        success: true,
        data: linkPayload(link, isNew, accessForLinkType(linkType)),
      });
    } catch (error) {
      console.error("Error creating shareable link:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create shareable link",
      });
    }
  }

  /**
   * Read a organization file's sharing settings and its live link.
   * GET /cabinet/organization/files/:fileId/sharing
   *
   * Any member of the office can read this — the founder UI needs it, and a
   * member seeing whether a file is public leaks nothing they can't already
   * see by opening the file.
   */
  static async getOrganizationFileSharing(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      const orgId = (organizationId as string) || me.orgId;
      if (!orgId || !Types.ObjectId.isValid(fileId)) {
        return res
          .status(400)
          .json({ success: false, error: "Organization ID and file ID required" });
      }

      const membership = await membershipFor(me.userId, orgId);
      if (!membership) {
        return res.status(403).json({
          success: false,
          error: "Access denied. You are not a member of this organization.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: orgId,
      });
      if (!file) {
        return res.status(404).json({ success: false, error: "File not found" });
      }

      const access = fileAccess(file);
      const link = await ShareableLink.findOne({
        file: fileId,
        linkType: linkTypeForAccess(access),
        status: "active",
      });

      return res.json({
        success: true,
        data: {
          fileId,
          name: (file as any).name,
          access,
          canEdit: isFounderMembership(membership),
          url: link ? shareUrl(link.token) : null,
          expiresAt: link?.expiresAt || null,
        },
      });
    } catch (error) {
      console.error("Error reading file sharing settings:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to read sharing settings" });
    }
  }

  /**
   * Change a organization file's access mode and hand back the matching link.
   * PUT /cabinet/organization/files/:fileId/sharing   { access: "public" | "office" }
   *
   * Founder-only: sharing an office's files outside it is a founder decision.
   * Flipping the mode revokes the link of the other type, so a file switched
   * back to office-only stops resolving at its old public URL.
   */
  static async updateOrganizationFileSharing(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { access } = req.body as { access?: FileAccess };
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      if (access !== "public" && access !== "office") {
        return res.status(400).json({
          success: false,
          error: 'access must be "public" or "office"',
        });
      }

      const orgId = (organizationId as string) || me.orgId;
      if (!orgId || !Types.ObjectId.isValid(fileId)) {
        return res
          .status(400)
          .json({ success: false, error: "Organization ID and file ID required" });
      }

      const membership = await membershipFor(me.userId, orgId);
      if (!isFounderMembership(membership)) {
        return res.status(403).json({
          success: false,
          error: "Access denied. Only founders can change sharing settings.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: orgId,
      });
      if (!file) {
        return res.status(404).json({ success: false, error: "File not found" });
      }

      (file as any).sharing = {
        access,
        updatedAt: new Date(),
        updatedBy: me.userId,
      };
      (file as any).isPublic = access === "public";
      await file.save();

      const linkType = linkTypeForAccess(access);

      // The other type's link must stop working — that is the whole point of
      // switching a file back to office-only.
      await ShareableLink.updateMany(
        {
          file: fileId,
          linkType: linkType === "external" ? "internal" : "external",
          status: "active",
        },
        { $set: { status: "revoked" } }
      );

      const { link, isNew } = await getOrRefreshLink({
        fileId,
        fileModel: "OrganizationFile",
        linkType,
        ownerId: me.userId,
        organizationId: orgId,
      });

      return res.json({
        success: true,
        data: linkPayload(link, isNew, access),
      });
    } catch (error) {
      console.error("Error updating file sharing settings:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to update sharing settings" });
    }
  }

  /**
   * Get or create the share link for an organization file, of whatever type
   * the file's own access mode calls for.
   * POST /cabinet/organization/files/:fileId/share-link
   *
   * The caller does not pick the type: a member copying a link gets the link
   * the founder's setting allows, not the one they asked for.
   */
  static async getOrCreateOrganizationLink(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const { organizationId } = req.query;
      const me = (req as any).user as { userId: string; orgId: string };

      const orgId = (organizationId as string) || me.orgId;
      if (!orgId || !Types.ObjectId.isValid(fileId)) {
        return res
          .status(400)
          .json({ success: false, error: "Organization ID and file ID required" });
      }

      const membership = await membershipFor(me.userId, orgId);
      if (!membership) {
        return res.status(403).json({
          success: false,
          error: "Access denied. You are not a member of this organization.",
        });
      }

      const file = await OrganizationFile.findOne({
        _id: fileId,
        organization: orgId,
      });
      if (!file) {
        return res.status(404).json({ success: false, error: "File not found" });
      }

      const access = fileAccess(file);
      const { link, isNew } = await getOrRefreshLink({
        fileId,
        fileModel: "OrganizationFile",
        linkType: linkTypeForAccess(access),
        ownerId: (file as any).owner?.toString() || me.userId,
        organizationId: orgId,
      });

      return res.status(isNew ? 201 : 200).json({
        success: true,
        data: linkPayload(link, isNew, access),
      });
    } catch (error) {
      console.error("Error creating organization share link:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create shareable link" });
    }
  }

  /**
   * Revoke a shareable link
   * DELETE /cabinet/share-link/:token
   */
  static async revokeLink(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const me = (req as any).user as { userId: string };

      const link = await ShareableLink.findOne({ token });
      if (!link) {
        return res.status(404).json({
          success: false,
          error: "Link not found",
        });
      }

      // The link's creator, or any founder of the owning office.
      const isOwner = link.owner.toString() === me.userId;
      if (!isOwner) {
        const membership = await membershipFor(
          me.userId,
          link.organization.toString()
        );
        if (!isFounderMembership(membership)) {
          return res.status(403).json({
            success: false,
            error: "Link not found or you are not the owner",
          });
        }
      }

      link.status = "revoked";
      await link.save();

      return res.json({
        success: true,
        message: "Link revoked successfully",
      });
    } catch (error) {
      console.error("Error revoking link:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to revoke link",
      });
    }
  }

  /**
   * Access a file as a signed-in user.
   * GET /cabinet/f/:token
   *
   * Handles both kinds of link: a public one resolves straight away, a
   * restricted one first checks office membership. A signed-in visitor who is
   * not a member gets a 403 carrying the office's name and
   * `code: "NOT_A_MEMBER"`, which the viewer turns into the join prompt rather
   * than a dead end.
   */
  static async accessInternalLink(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const me = (req as any).user as { userId: string };

      // No token-shape check: tokens are opaque and identical for both access
      // levels, so only the record can say what this link allows.
      const link = await ShareableLink.findOne({ token });
      if (!link) {
        return res.status(404).json({
          success: false,
          error: "Link not found",
        });
      }

      // Check if link is still valid
      const validationError = await validateAndUpdateLink(link);
      if (validationError) {
        return res.status(410).json({
          success: false,
          error: validationError,
        });
      }

      const file = await loadLinkFile(link);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: "The shared file no longer exists",
        });
      }

      // A public link needs no membership; a restricted one does.
      const membership = isPublicLink(link)
        ? true
        : await membershipFor(me.userId, link.organization.toString());

      if (!membership) {
        const org = await Organization.findById(link.organization)
          .select("name")
          .lean();
        return res.status(403).json({
          success: false,
          code: "NOT_A_MEMBER",
          error: "You must be a member of this office to open this file",
          data: {
            organizationId: link.organization.toString(),
            organizationName: (org as any)?.name || "this office",
            canJoin: true,
          },
        });
      }

      // Increment access count
      link.accessCount += 1;
      link.lastAccessedAt = new Date();
      await link.save();

      // Inline, not attachment: a shared link is view-only, so the URL has to
      // render in the viewer rather than land in the visitor's downloads.
      const viewUrl = await s3Service.getPresignedStreamUrl(
        (file as any).s3Key,
        PRESIGNED_URL_EXPIRY,
        (file as any).mimeType
      );

      return res.json({
        success: true,
        data: {
          file: {
            name: (file as any).name,
            originalName: (file as any).originalName,
            description: (file as any).description || null,
            mimeType: (file as any).mimeType,
            size: (file as any).size,
          },
          sharedBy: await sharerNameFor(link),
          organizationId: link.organization.toString(),
          access: isPublicLink(link) ? "public" : "office",
          viewOnly: true,
          viewUrl,
          // Legacy key, same inline URL — older viewers read `downloadUrl`.
          downloadUrl: viewUrl,
          expiresIn: PRESIGNED_URL_EXPIRY,
        },
      });
    } catch (error) {
      console.error("Error accessing internal link:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to access file",
      });
    }
  }

  /**
   * Join the office a shared file belongs to, then the caller re-requests the
   * file. POST /cabinet/f/:token/join  (auth required)
   *
   * This is what makes an office-only link work for someone who has just
   * signed up: they land back here with a token, get attached to the office as
   * a stakeholder, and the file opens. Only a live restricted link can do this
   * — an expired or revoked one is not an invitation, and a public one has
   * nothing to join.
   */
  static async joinOfficeViaLink(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const me = (req as any).user as { userId: string };

      const link = await ShareableLink.findOne({ token });
      if (!link) {
        return res.status(404).json({ success: false, error: "Link not found" });
      }

      if (isPublicLink(link)) {
        return res.status(400).json({
          success: false,
          error: "This link is public — there is no office to join",
        });
      }

      const validationError = await validateAndUpdateLink(link);
      if (validationError) {
        return res.status(410).json({ success: false, error: validationError });
      }

      const orgId = link.organization.toString();
      const org = await Organization.findById(orgId).select("name").lean();
      if (!org) {
        return res
          .status(404)
          .json({ success: false, error: "This office no longer exists" });
      }

      const user = await User.findById(me.userId);
      if (!user) {
        return res.status(401).json({ success: false, error: "User not found" });
      }

      const already = user.organizations?.some(
        (membership: any) => membership.organization?.toString() === orgId
      );

      if (!already) {
        // Same shape as every other join path: stakeholder, dropped on the
        // office's ground floor so the workspace has somewhere to put them.
        const firstFloor = await Floor.findOne({
          orgId: new Types.ObjectId(orgId),
        })
          .sort({ level: 1 })
          .lean();

        user.organizations = user.organizations || [];
        user.organizations.push({
          organization: new Types.ObjectId(orgId),
          role: "stakeholder",
          floorId: (firstFloor as any)?._id,
          joinedAt: new Date(),
        } as any);

        await user.save();
        console.log(
          `[ShareLink] ${user.email} joined ${(org as any).name} via share link ${token}`
        );
      }

      return res.json({
        success: true,
        data: {
          organizationId: orgId,
          organizationName: (org as any).name,
          joined: !already,
        },
      });
    } catch (error) {
      console.error("Error joining office via link:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to join this office" });
    }
  }

  /**
   * What a visitor can be told about a link before signing in.
   * GET /public/f/:token/meta  (no auth)
   *
   * Answers for both access levels: the office's name, so the gate screen can
   * say what the visitor is being asked to join, plus who shared what, so the
   * page's `generateMetadata` can title the link preview.
   *
   * This is the endpoint the server-rendered metadata reads, NOT
   * `/public/f/:token` — that one burns an access against the link's
   * `maxAccessCount`, and a link pasted into a group chat is fetched by every
   * crawler that sees it. Reading a title must not use up the link.
   */
  static async getLinkMeta(req: Request, res: Response) {
    try {
      const { token } = req.params;

      const link = await ShareableLink.findOne({ token });
      if (!link) {
        return res.status(404).json({ success: false, error: "Link not found" });
      }

      const isPublic = isPublicLink(link);
      const preview = await linkPreviewMeta(link);

      return res.json({
        success: true,
        data: {
          linkType: link.linkType,
          accessLevel: isPublic ? "public" : "restricted",
          access: isPublic ? "public" : "office",
          requiresMembership: !isPublic,
          requiresAuth: !isPublic,
          status: link.status,
          ...preview,
        },
      });
    } catch (error) {
      console.error("Error reading link meta:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to read this link" });
    }
  }

  /**
   * Resolve any share link without auth.
   * GET /public/f/:token
   *
   * Every link points here first, because the token no longer says which kind
   * it is. A public one is served; a restricted one answers 401
   * `AUTH_REQUIRED` with the office's name and nothing about the file, which
   * is the viewer's cue to sign the visitor in and retry against
   * `/cabinet/f/:token`.
   */
  static async accessExternalLink(req: Request, res: Response) {
    try {
      const { token } = req.params;

      const link = await ShareableLink.findOne({ token });
      if (!link) {
        return res.status(404).json({
          success: false,
          error: "Link not found",
        });
      }

      if (!isPublicLink(link)) {
        // Carries the preview fields so a restricted link still renders a
        // titled card in chat apps — see `linkPreviewMeta`.
        return res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          error: "Sign in to open this file",
          data: await linkPreviewMeta(link),
        });
      }

      // Check if link is still valid
      const validationError = await validateAndUpdateLink(link);
      if (validationError) {
        return res.status(410).json({
          success: false,
          error: validationError,
        });
      }

      const file = await loadLinkFile(link);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: "The shared file no longer exists",
        });
      }

      // A file switched back to office-only must stop answering here even if a
      // public token is still floating around.
      if (
        (link as any).fileModel === "OrganizationFile" &&
        fileAccess(file) !== "public"
      ) {
        return res.status(403).json({
          success: false,
          code: "OFFICE_ONLY",
          error: "This file is restricted to members of this office",
          data: await linkPreviewMeta(link),
        });
      }

      // Increment access count
      link.accessCount += 1;
      link.lastAccessedAt = new Date();
      await link.save();

      // Inline, not attachment — see the internal-link path above.
      const viewUrl = await s3Service.getPresignedStreamUrl(
        (file as any).s3Key,
        PRESIGNED_URL_EXPIRY,
        (file as any).mimeType
      );

      return res.json({
        success: true,
        data: {
          file: {
            name: (file as any).name,
            originalName: (file as any).originalName,
            description: (file as any).description || null,
            mimeType: (file as any).mimeType,
            size: (file as any).size,
          },
          // Who shared it and where from — the viewer's header reads these,
          // and `organizationId` is what decides whether a signed-in visitor
          // is offered the shortcut back into their own cabinet.
          sharedBy: await sharerNameFor(link),
          organizationId: link.organization.toString(),
          access: "public",
          viewOnly: true,
          viewUrl,
          // Legacy key, same inline URL — older viewers read `downloadUrl`.
          downloadUrl: viewUrl,
          expiresIn: PRESIGNED_URL_EXPIRY,
        },
      });
    } catch (error) {
      console.error("Error accessing external link:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to access file",
      });
    }
  }

  /**
   * Get all shareable links for a file
   * GET /cabinet/files/:fileId/share-links
   */
  static async getLinksForFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const me = (req as any).user as { userId: string };

      const links = await ShareableLink.find({
        file: fileId,
        owner: me.userId,
      })
        .select("token linkType expiresAt accessCount maxAccessCount status createdAt")
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        data: links.map((link) => ({
          _id: link._id,
          token: link.token,
          linkType: link.linkType,
          url: shareUrl(link.token),
          expiresAt: link.expiresAt,
          accessCount: link.accessCount,
          maxAccessCount: link.maxAccessCount,
          status: link.status,
          createdAt: link.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error getting links for file:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to get links",
      });
    }
  }
}

/**
 * Validate link and update status if needed
 * Returns error message if invalid, null if valid
 */
async function validateAndUpdateLink(link: any): Promise<string | null> {
  // Check if already revoked
  if (link.status === "revoked") {
    return "This link has been revoked";
  }

  // Check expiration
  if (new Date() > link.expiresAt) {
    if (link.status !== "expired") {
      link.status = "expired";
      await link.save();
    }
    return "This link has expired";
  }

  // Check access limit
  if (link.accessCount >= link.maxAccessCount) {
    if (link.status !== "limit_reached") {
      link.status = "limit_reached";
      await link.save();
    }
    return "This link has reached its access limit";
  }

  return null;
}
