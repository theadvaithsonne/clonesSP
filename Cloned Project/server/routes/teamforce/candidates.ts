import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { s3Service } from "../../services/s3";
import {
  TeamforceCandidate,
  CANDIDATE_STAGES,
} from "../../models/teamforce/teamforceCandidate.model";
import { TeamforceRecruitmentRequest } from "../../models/teamforce/teamforceRecruitmentRequest.model";
import {
  getAuthUser,
  getOrgIdStrict,
  requireRecruitmentAccess,
} from "./_helpers";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const applySchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  mobileNumber: z.string().trim().min(1).max(40),
  email: z.string().trim().email(),
  yearsOfExperience: z.coerce.number().min(0).default(0),
  experienceDetails: z.string().default(""),
  currentCtc: z.string().default(""),
  expectedCtc: z.string().default(""),
  noticePeriod: z.string().default(""),
});

// ------------------------------------------------------------------
// POST /:requestId/apply — submit application (multipart: resume + fields)
// Auth required; any signed-in user can apply.
// ------------------------------------------------------------------
const RESUME_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

router.post(
  "/:requestId/apply",
  requireAuth,
  upload.any(),
  async (req, res) => {
    const orgId = getOrgIdStrict(req, res);
    if (!orgId) return;

    if (!Types.ObjectId.isValid(req.params.requestId))
      return res.status(400).json({ error: "Invalid request id" });

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const resumeFile = files.find((f) => f.fieldname === "resume");

    if (!resumeFile)
      return res.status(400).json({ error: "Resume file is required (PDF/DOC/DOCX)" });
    if (!RESUME_MIMES.includes(resumeFile.mimetype))
      return res.status(400).json({ error: "Resume must be PDF, DOC, or DOCX" });

    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid form data", details: parsed.error.flatten() });

    const request = await TeamforceRecruitmentRequest.findOne({
      _id: req.params.requestId,
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    }).lean();
    if (!request) return res.status(404).json({ error: "Job posting not found" });
    if (request.status !== "floated")
      return res.status(403).json({ error: "This job is not currently accepting applications" });

    const me = getAuthUser(req);

    // Resume upload to S3
    const resumeKey = s3Service.generateFileKey(
      me.userId,
      orgId,
      `resume_${resumeFile.originalname}`
    );
    await s3Service.uploadFile(resumeKey, resumeFile.buffer, resumeFile.mimetype, {
      originalName: resumeFile.originalname,
      applicantEmail: parsed.data.email,
      recruitmentRequestId: String(request._id),
      uploadedAt: new Date().toISOString(),
    });

    // Custom field values — snapshot from published fields at application time
    const published = (request.customFieldsPublished || []) as Array<{
      id: string;
      label: string;
      type: "text" | "number" | "upload";
      required?: boolean;
    }>;

    const customFieldValues: Array<Record<string, any>> = [];
    for (const f of published) {
      const bodyKey = `customField_${f.id}`;
      if (f.type === "upload") {
        const file = files.find((x) => x.fieldname === bodyKey);
        if (!file) {
          customFieldValues.push({
            fieldId: f.id,
            label: f.label,
            type: f.type,
            value: "",
          });
          continue;
        }
        const safeName = `custom_${f.id}_${file.originalname}`;
        const key = s3Service.generateFileKey(me.userId, orgId, safeName);
        await s3Service.uploadFile(key, file.buffer, file.mimetype, {
          originalName: file.originalname,
          applicantEmail: parsed.data.email,
          recruitmentRequestId: String(request._id),
          customFieldId: f.id,
          uploadedAt: new Date().toISOString(),
        });
        customFieldValues.push({
          fieldId: f.id,
          label: f.label,
          type: f.type,
          value: file.originalname,
          fileKey: key,
          fileName: file.originalname,
          fileContentType: file.mimetype,
          fileSize: file.size,
        });
      } else {
        const raw = req.body?.[bodyKey];
        const value = typeof raw === "string" ? raw.trim() : "";
        customFieldValues.push({
          fieldId: f.id,
          label: f.label,
          type: f.type,
          value,
        });
      }
    }

    const candidate = await TeamforceCandidate.create({
      orgId: new Types.ObjectId(orgId),
      recruitmentRequestId: request._id,
      positionName: request.positionName,
      department: request.department,
      jobLocation: request.jobLocation,
      ...parsed.data,
      resumeKey,
      resumeFileName: resumeFile.originalname,
      resumeContentType: resumeFile.mimetype,
      resumeSize: resumeFile.size,
      customFieldValues,
    });

    res.status(201).json({ candidate: candidate.toObject() });
  }
);

// ------------------------------------------------------------------
// POST /public/:requestId/apply — unauthenticated submission from the
// public landing page. Mirrors /apply but uses the job posting's orgId
// and a synthetic "public" user prefix for the S3 key.
// ------------------------------------------------------------------
router.post(
  "/public/:requestId/apply",
  upload.any(),
  async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.requestId))
      return res.status(400).json({ error: "Invalid request id" });

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const resumeFile = files.find((f) => f.fieldname === "resume");

    if (!resumeFile)
      return res.status(400).json({ error: "Resume file is required (PDF/DOC/DOCX)" });
    if (!RESUME_MIMES.includes(resumeFile.mimetype))
      return res.status(400).json({ error: "Resume must be PDF, DOC, or DOCX" });

    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid form data", details: parsed.error.flatten() });

    const request = await TeamforceRecruitmentRequest.findOne({
      _id: req.params.requestId,
      isActive: true,
    }).lean();
    if (!request) return res.status(404).json({ error: "Job posting not found" });
    if (request.status !== "floated")
      return res.status(403).json({ error: "This job is not currently accepting applications" });

    const orgId = String(request.orgId);

    const resumeKey = s3Service.generateFileKey(
      "public",
      orgId,
      `resume_${resumeFile.originalname}`
    );
    await s3Service.uploadFile(resumeKey, resumeFile.buffer, resumeFile.mimetype, {
      originalName: resumeFile.originalname,
      applicantEmail: parsed.data.email,
      recruitmentRequestId: String(request._id),
      uploadedAt: new Date().toISOString(),
      source: "public",
    });

    const published = (request.customFieldsPublished || []) as Array<{
      id: string;
      label: string;
      type: "text" | "number" | "upload";
      required?: boolean;
    }>;

    const customFieldValues: Array<Record<string, any>> = [];
    for (const f of published) {
      const bodyKey = `customField_${f.id}`;
      if (f.type === "upload") {
        const file = files.find((x) => x.fieldname === bodyKey);
        if (!file) {
          customFieldValues.push({
            fieldId: f.id,
            label: f.label,
            type: f.type,
            value: "",
          });
          continue;
        }
        const safeName = `custom_${f.id}_${file.originalname}`;
        const key = s3Service.generateFileKey("public", orgId, safeName);
        await s3Service.uploadFile(key, file.buffer, file.mimetype, {
          originalName: file.originalname,
          applicantEmail: parsed.data.email,
          recruitmentRequestId: String(request._id),
          customFieldId: f.id,
          uploadedAt: new Date().toISOString(),
          source: "public",
        });
        customFieldValues.push({
          fieldId: f.id,
          label: f.label,
          type: f.type,
          value: file.originalname,
          fileKey: key,
          fileName: file.originalname,
          fileContentType: file.mimetype,
          fileSize: file.size,
        });
      } else {
        const raw = req.body?.[bodyKey];
        const value = typeof raw === "string" ? raw.trim() : "";
        customFieldValues.push({
          fieldId: f.id,
          label: f.label,
          type: f.type,
          value,
        });
      }
    }

    const candidate = await TeamforceCandidate.create({
      orgId: new Types.ObjectId(orgId),
      recruitmentRequestId: request._id,
      positionName: request.positionName,
      department: request.department,
      jobLocation: request.jobLocation,
      ...parsed.data,
      resumeKey,
      resumeFileName: resumeFile.originalname,
      resumeContentType: resumeFile.mimetype,
      resumeSize: resumeFile.size,
      customFieldValues,
    });

    res.status(201).json({ candidate: candidate.toObject() });
  }
);

// ------------------------------------------------------------------
// GET / — list candidates (paginated, optional requestId/stage filter)
// ------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((req.query.pageSize as string) || "20", 10))
  );
  const requestId = (req.query.requestId as string | undefined)?.trim();
  const stage = (req.query.stage as string | undefined)?.trim();

  const filter: Record<string, any> = {
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  };
  if (requestId && Types.ObjectId.isValid(requestId)) {
    filter.recruitmentRequestId = new Types.ObjectId(requestId);
  }
  if (stage && (CANDIDATE_STAGES as readonly string[]).includes(stage)) {
    filter.stage = stage;
  }

  const [total, candidates] = await Promise.all([
    TeamforceCandidate.countDocuments(filter),
    TeamforceCandidate.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  res.json({
    candidates,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

// ------------------------------------------------------------------
// GET /:id/resume — presigned download URL (1 hour)
// ------------------------------------------------------------------
router.get("/:id/resume", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const candidate = await TeamforceCandidate.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  }).lean();

  if (!candidate) return res.status(404).json({ error: "Candidate not found" });

  const url = await s3Service.getPresignedDownloadUrl(candidate.resumeKey, 3600);
  res.json({
    url,
    fileName: candidate.resumeFileName,
    contentType: candidate.resumeContentType,
    size: candidate.resumeSize,
  });
});

// ------------------------------------------------------------------
// GET /:id/custom-file/:fieldId — presigned download URL for a custom-upload
// field's answer file.
// ------------------------------------------------------------------
router.get("/:id/custom-file/:fieldId", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const candidate = await TeamforceCandidate.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .select("customFieldValues")
    .lean();

  if (!candidate) return res.status(404).json({ error: "Candidate not found" });

  const entry = (candidate.customFieldValues || []).find(
    (v: any) => v.fieldId === req.params.fieldId
  );
  if (!entry || entry.type !== "upload" || !entry.fileKey)
    return res.status(404).json({ error: "File not found" });

  const url = await s3Service.getPresignedDownloadUrl(entry.fileKey, 3600);
  res.json({
    url,
    fileName: entry.fileName,
    contentType: entry.fileContentType,
    size: entry.fileSize,
  });
});

// ------------------------------------------------------------------
// PATCH /:id — update stage/notes
// ------------------------------------------------------------------
const patchSchema = z.object({
  stage: z.enum(CANDIDATE_STAGES).optional(),
  notes: z.string().optional(),
});

router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const patch = patchSchema.parse(req.body);

  const candidate = await TeamforceCandidate.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId), isActive: true },
    { $set: patch },
    { new: true }
  ).lean();

  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  res.json({ candidate });
});

// ------------------------------------------------------------------
// DELETE /:id — soft delete
// ------------------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const updated = await TeamforceCandidate.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );
  if (!updated) return res.status(404).json({ error: "Candidate not found" });
  res.json({ ok: true });
});

export default router;
