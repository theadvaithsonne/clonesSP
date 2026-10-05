import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import {
  TeamforceRecruitmentRequest,
  RECRUITMENT_STATUSES,
  EMPLOYMENT_TYPES,
  EXPERIENCE_RANGES,
  CUSTOM_FIELD_TYPES,
} from "../../models/teamforce/teamforceRecruitmentRequest.model";
import { User } from "../../models/user.model";
import {
  getAuthUser,
  getOrgIdStrict,
  hasRecruitmentAccess,
  requireRecruitmentAccess,
} from "./_helpers";

const router = Router();

const baseSchema = z.object({
  positionName: z.string().trim().min(1).max(200),
  department: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  reportingManager: z.string().trim().min(1),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("Full-Time"),
  numberOfOpenings: z.number().int().min(1).default(1),
  experienceRequired: z.enum(EXPERIENCE_RANGES),
  jobLocation: z.string().trim().min(1),
  expectedJoiningDate: z.coerce.date(),
  roleSummary: z.string().default(""),
  keyResponsibilities: z.string().default(""),
  requiredSkills: z.string().default(""),
  preferredSkills: z.string().default(""),
  approver: z.string().default(""),
  approvers: z.array(z.string().trim().min(1)).default([]),
});

// Create: status decided by `action` — "draft" or "submit" (approval_pending)
const createSchema = baseSchema.extend({
  action: z.enum(["draft", "submit"]).default("draft"),
});

// Update: all fields optional; optional explicit status override for
// workflow transitions (approve, float, close) from founder/admin.
const updateSchema = baseSchema.partial().extend({
  action: z.enum(["draft", "submit"]).optional(),
  status: z.enum(RECRUITMENT_STATUSES).optional(),
});

// ------------------------------------------------------------------
// GET /public/:id — unauthenticated fetch for the public landing page
// Returns a trimmed view (no internal fields like createdBy/approver/drafts).
// ------------------------------------------------------------------
router.get("/public/:id", async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const request = await TeamforceRecruitmentRequest.findOne({
    _id: req.params.id,
    isActive: true,
    status: "floated",
  })
    .select(
      "positionName department branch employmentType numberOfOpenings experienceRequired jobLocation expectedJoiningDate roleSummary keyResponsibilities requiredSkills preferredSkills status customFieldsPublished createdAt"
    )
    .lean();

  if (!request) return res.status(404).json({ error: "Job posting not found" });
  res.json({ request });
});

// ------------------------------------------------------------------
// GET / — paginated list
// ------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt((req.query.pageSize as string) || "10", 10))
  );
  const statusFilter = (req.query.status as string | undefined)?.trim();

  const filter: Record<string, any> = {
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  };
  if (statusFilter && (RECRUITMENT_STATUSES as readonly string[]).includes(statusFilter)) {
    filter.status = statusFilter;
  }

  const [total, requests] = await Promise.all([
    TeamforceRecruitmentRequest.countDocuments(filter),
    TeamforceRecruitmentRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  res.json({
    requests,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

// ------------------------------------------------------------------
// GET /:id — single request
// ------------------------------------------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const request = await TeamforceRecruitmentRequest.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  }).lean();

  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({ request });
});

// ------------------------------------------------------------------
// POST / — create (draft or submit)
// ------------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  const { action, ...body } = createSchema.parse(req.body);
  const me = getAuthUser(req);

  const request = await TeamforceRecruitmentRequest.create({
    orgId: new Types.ObjectId(orgId),
    createdBy: new Types.ObjectId(me.userId),
    status: action === "submit" ? "approval_pending" : "draft",
    ...body,
  });

  res.status(201).json({ request: request.toObject() });
});

// ------------------------------------------------------------------
// PATCH /:id — edit request (also handles status transitions)
// ------------------------------------------------------------------
router.patch("/:id", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const { action, status, ...body } = updateSchema.parse(req.body);

  // Zod v4 applies `.default()` values for absent keys in `.partial()` schemas,
  // so only include fields the caller explicitly sent to avoid overwriting
  // existing data on status-only patches (approve, reject, float, close).
  const sentKeys = new Set(Object.keys(req.body));
  const update: Record<string, any> = {};
  for (const [key, val] of Object.entries(body)) {
    if (sentKeys.has(key)) update[key] = val;
  }
  if (action === "submit") update.status = "approval_pending";
  else if (action === "draft") update.status = "draft";
  else if (status) update.status = status;

  // Approve-gating: when a caller is flipping the status to "approved",
  // restrict that action to the named approver(s) on the request. If the
  // approver list is empty, anyone with recruitment access may approve.
  if (update.status === "approved") {
    const existing = await TeamforceRecruitmentRequest.findOne({
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    })
      .select("approvers approver")
      .lean();
    if (!existing)
      return res.status(404).json({ error: "Request not found" });

    const allowedNames = [
      ...(existing.approvers || []),
      ...(existing.approver ? [existing.approver] : []),
    ]
      .map((s) => (s || "").trim())
      .filter(Boolean);

    if (allowedNames.length > 0) {
      const me = getAuthUser(req);
      const meUser = await User.findById(me.userId).select("name").lean();
      const myName = (meUser?.name || "").trim();
      if (!myName || !allowedNames.includes(myName)) {
        return res.status(403).json({
          error:
            "Only the designated approver(s) can approve this request",
        });
      }
    }
  }

  const request = await TeamforceRecruitmentRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    },
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!request) return res.status(404).json({ error: "Request not found" });
  res.json({ request });
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

  const updated = await TeamforceRecruitmentRequest.findOneAndUpdate(
    { _id: req.params.id, orgId: new Types.ObjectId(orgId) },
    { $set: { isActive: false } }
  );
  if (!updated) return res.status(404).json({ error: "Request not found" });
  res.json({ ok: true });
});

// ------------------------------------------------------------------
// Application Form Builder — custom fields (draft + published)
// ------------------------------------------------------------------
const customFieldSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  type: z.enum(CUSTOM_FIELD_TYPES),
  required: z.boolean().optional(),
});

const draftFormSchema = z.object({
  customFields: z.array(customFieldSchema).default([]),
});

// GET /:id/form — both draft + published field lists
router.get("/:id/form", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const request = await TeamforceRecruitmentRequest.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .select("customFieldsDraft customFieldsPublished")
    .lean();

  if (!request) return res.status(404).json({ error: "Request not found" });

  res.json({
    customFieldsDraft: request.customFieldsDraft || [],
    customFieldsPublished: request.customFieldsPublished || [],
  });
});

// PUT /:id/form/draft — save the working draft
router.put("/:id/form/draft", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const { customFields } = draftFormSchema.parse(req.body);

  const ids = new Set<string>();
  for (const f of customFields) {
    if (ids.has(f.id))
      return res.status(400).json({ error: "Duplicate custom field id" });
    ids.add(f.id);
  }

  const request = await TeamforceRecruitmentRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    },
    { $set: { customFieldsDraft: customFields } },
    { new: true, runValidators: true }
  )
    .select("customFieldsDraft customFieldsPublished")
    .lean();

  if (!request) return res.status(404).json({ error: "Request not found" });

  res.json({
    customFieldsDraft: request.customFieldsDraft || [],
    customFieldsPublished: request.customFieldsPublished || [],
  });
});

// POST /:id/form/publish — copy draft → published
router.post("/:id/form/publish", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  if (!(await requireRecruitmentAccess(req, res))) return;

  if (!Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ error: "Invalid id" });

  const existing = await TeamforceRecruitmentRequest.findOne({
    _id: req.params.id,
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .select("customFieldsDraft")
    .lean();

  if (!existing) return res.status(404).json({ error: "Request not found" });

  const request = await TeamforceRecruitmentRequest.findOneAndUpdate(
    {
      _id: req.params.id,
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    },
    { $set: { customFieldsPublished: existing.customFieldsDraft || [] } },
    { new: true, runValidators: true }
  )
    .select("customFieldsDraft customFieldsPublished")
    .lean();

  if (!request) return res.status(404).json({ error: "Request not found" });

  res.json({
    customFieldsDraft: request.customFieldsDraft || [],
    customFieldsPublished: request.customFieldsPublished || [],
  });
});

// ------------------------------------------------------------------
// GET /meta/access — tells frontend if current user can see Recruitment menu
// ------------------------------------------------------------------
router.get("/meta/access", requireAuth, async (req, res) => {
  const orgId = getOrgIdStrict(req, res);
  if (!orgId) return;
  const canAccess = await hasRecruitmentAccess(req);
  res.json({ canAccess });
});

export default router;
