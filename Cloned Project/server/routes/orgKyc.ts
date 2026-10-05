/**
 * Founder-facing office KYC — read what the admin asked for, upload the
 * documents, submit for review.
 *
 * Mounted at /org-kyc. The admin side (setting requirements, approving,
 * verifying) is routes/garageAdminOrgKyc.ts.
 *
 * Files never pass through this server: the browser asks for a presigned PUT
 * into the private KYC bucket, uploads straight to S3, then POSTs the
 * resulting key here. See services/orgKycStorage.ts.
 */
import { Router, Request, Response } from "express";
import { Types } from "mongoose";

import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { OrgKyc } from "../models/orgKyc.model";
import {
  getOrCreateOrgKyc,
  missingRequirements,
  OrgKycError,
  requirementsSatisfied,
  serializeOrgKyc,
  syncOrgKycMirror,
} from "../services/orgKyc.service";
import {
  deleteKycObject,
  KycUploadValidationError,
  presignKycUpload,
} from "../services/orgKycStorage";

const router = Router();

function readUser(req: Request): { userId: string; orgId?: string } {
  return (req as unknown as { user: { userId: string; orgId?: string } }).user;
}

/**
 * Only a founder of the office may see or touch its KYC. Identity documents
 * are not team-visible, so this is deliberately stricter than the usual
 * "member of the org" check used elsewhere.
 */
async function requireFounderOfOrg(
  req: Request,
  res: Response,
  orgId: string
): Promise<boolean> {
  if (!Types.ObjectId.isValid(orgId)) {
    res.status(400).json({ error: "Invalid organization id" });
    return false;
  }
  const user = await User.findById(readUser(req).userId).select("organizations");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return false;
  }
  const membership = (user as any).organizations?.find(
    (m: any) => m.organization?.toString() === orgId
  );
  if (!membership || membership.role !== "founder") {
    res
      .status(403)
      .json({ error: "Only the founder of this office can manage its KYC" });
    return false;
  }
  return true;
}

/**
 * Founders see these messages, so they stay plain — but they name the step
 * that failed, because "Something went wrong" told neither the founder nor
 * us which of upload / save / submit actually broke. The real error and the
 * org go to the server log.
 */
function handleError(
  res: Response,
  err: unknown,
  where: string,
  orgId?: string
) {
  if (err instanceof OrgKycError || err instanceof KycUploadValidationError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`[org-kyc ${where}]${orgId ? ` org=${orgId}` : ""}`, err);
  return res.status(500).json({
    error: `We couldn't complete that (${where}). Please try again.`,
    code: "org_kyc_failed",
  });
}

/**
 * Status for the founder's own current office — powers the "KYC pending"
 * nudge, so it must stay cheap and never 403 (a non-founder simply has
 * nothing to do here).
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId } = readUser(req);
    if (!orgId || !Types.ObjectId.isValid(orgId)) {
      return res.json({ applicable: false });
    }
    const user = await User.findById(userId).select("organizations");
    const membership = (user as any)?.organizations?.find(
      (m: any) => m.organization?.toString() === orgId
    );
    if (!membership || membership.role !== "founder") {
      return res.json({ applicable: false });
    }
    const doc = await OrgKyc.findOne({ orgId: new Types.ObjectId(orgId) });
    if (!doc || doc.status === "not_requested" || doc.requirements.length === 0) {
      return res.json({ applicable: false });
    }
    return res.json({
      applicable: true,
      orgId,
      status: doc.status,
      reviewNote: doc.reviewNote,
      missing: missingRequirements(doc),
      requirementCount: doc.requirements.length,
    });
  } catch (err) {
    return handleError(res, err, "status check");
  }
});

router.get("/:orgId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!(await requireFounderOfOrg(req, res, orgId))) return;
    const doc = await getOrCreateOrgKyc(orgId);
    return res.json(await serializeOrgKyc(doc));
  } catch (err) {
    return handleError(res, err, "loading your documents", req.params.orgId);
  }
});

router.post(
  "/:orgId/upload-url",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      if (!(await requireFounderOfOrg(req, res, orgId))) return;

      const { requirementKey, mimeType, sizeBytes } = req.body || {};
      const doc = await getOrCreateOrgKyc(orgId);
      const requirement = doc.requirements.find(
        (r) => r.key === String(requirementKey || "")
      );
      if (!requirement) {
        return res
          .status(400)
          .json({ error: "That document isn't on this office's KYC list" });
      }
      if (requirement.kind !== "file") {
        return res
          .status(400)
          .json({ error: `${requirement.label} is a typed value, not a file` });
      }

      const out = await presignKycUpload({
        orgId,
        requirementKey: requirement.key,
        mimeType: String(mimeType || ""),
        sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined,
      });
      return res.json(out);
    } catch (err) {
      return handleError(res, err, "preparing the upload", req.params.orgId);
    }
  }
);

/**
 * Record an uploaded file or a typed answer against one requirement.
 * Re-answering a requirement REPLACES the previous answer (and deletes the
 * old object) — the reviewer should never have to guess which of three PAN
 * cards is the current one.
 */
router.post(
  "/:orgId/submissions",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      if (!(await requireFounderOfOrg(req, res, orgId))) return;

      const { requirementKey, s3Key, filename, mimeType, size, textValue } =
        req.body || {};
      const doc = await getOrCreateOrgKyc(orgId);
      const requirement = doc.requirements.find(
        (r) => r.key === String(requirementKey || "")
      );
      if (!requirement) {
        return res
          .status(400)
          .json({ error: "That document isn't on this office's KYC list" });
      }

      if (requirement.kind === "file") {
        if (typeof s3Key !== "string" || !s3Key.startsWith(`org-kyc/${orgId}/`)) {
          return res.status(400).json({ error: "Invalid upload reference" });
        }
      } else if (
        typeof textValue !== "string" ||
        !textValue.trim()
      ) {
        return res
          .status(400)
          .json({ error: `Enter a value for ${requirement.label}` });
      }

      // Drop any earlier answer for this requirement.
      const superseded = doc.submissions.filter(
        (s) => s.requirementKey === requirement.key
      );
      doc.submissions = doc.submissions.filter(
        (s) => s.requirementKey !== requirement.key
      ) as typeof doc.submissions;

      doc.submissions.push({
        requirementKey: requirement.key,
        s3Key: requirement.kind === "file" ? s3Key : undefined,
        filename:
          requirement.kind === "file" && typeof filename === "string"
            ? filename.slice(0, 200)
            : undefined,
        mimeType:
          requirement.kind === "file" && typeof mimeType === "string"
            ? mimeType
            : undefined,
        size: requirement.kind === "file" && typeof size === "number" ? size : undefined,
        textValue:
          requirement.kind === "text" ? String(textValue).trim().slice(0, 200) : undefined,
        uploadedBy: new Types.ObjectId(readUser(req).userId),
        uploadedAt: new Date(),
        status: "pending",
      } as any);

      // A fresh answer after a rejection puts the office back in "pending"
      // rather than leaving it stuck on the admin's earlier verdict.
      //
      // `reviewNote` deliberately SURVIVES this. A rejection usually names
      // more than one problem, and wiping the reviewer's note the moment the
      // first replacement lands would delete the instructions for the rest.
      // It is cleared on /submit, when the packet goes back for review.
      if (doc.status === "rejected") {
        doc.status = "pending";
      }
      await doc.save();
      await syncOrgKycMirror(doc.orgId, doc.status);

      // Only clean up S3 once the replacement is safely persisted.
      for (const old of superseded) {
        if (old.s3Key) await deleteKycObject(old.s3Key);
      }

      return res.json(await serializeOrgKyc(doc));
    } catch (err) {
      return handleError(res, err, "saving that document", req.params.orgId);
    }
  }
);

router.delete(
  "/:orgId/submissions/:submissionId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { orgId, submissionId } = req.params;
      if (!(await requireFounderOfOrg(req, res, orgId))) return;

      const doc = await getOrCreateOrgKyc(orgId);
      if (doc.status === "verified") {
        return res
          .status(400)
          .json({ error: "This office is already verified" });
      }
      const target = doc.submissions.find(
        (s) => s._id.toString() === submissionId
      );
      if (!target) return res.status(404).json({ error: "Not found" });

      doc.submissions = doc.submissions.filter(
        (s) => s._id.toString() !== submissionId
      ) as typeof doc.submissions;
      // Removing an answer means the office no longer has a complete packet.
      if (doc.status === "submitted") doc.status = "pending";
      await doc.save();
      await syncOrgKycMirror(doc.orgId, doc.status);
      if (target.s3Key) await deleteKycObject(target.s3Key);

      return res.json(await serializeOrgKyc(doc));
    } catch (err) {
      return handleError(res, err, "removing that document", req.params.orgId);
    }
  }
);

/** Hand the packet to the reviewer. Refuses while anything required is blank. */
router.post("/:orgId/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!(await requireFounderOfOrg(req, res, orgId))) return;

    const doc = await getOrCreateOrgKyc(orgId);
    if (doc.status === "verified") {
      return res.status(400).json({ error: "This office is already verified" });
    }
    if (!doc.requirements.length) {
      return res
        .status(400)
        .json({ error: "No documents have been requested for this office" });
    }
    if (!requirementsSatisfied(doc)) {
      return res.status(400).json({
        error: `Still missing: ${missingRequirements(doc).join(", ")}`,
      });
    }

    doc.status = "submitted";
    doc.submittedAt = new Date();
    doc.reviewNote = undefined;
    await doc.save();
    await syncOrgKycMirror(doc.orgId, doc.status);

    return res.json(await serializeOrgKyc(doc));
  } catch (err) {
    return handleError(res, err, "submitting for verification", req.params.orgId);
  }
});

export default router;
