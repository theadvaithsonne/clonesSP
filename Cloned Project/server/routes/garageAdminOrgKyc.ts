/**
 * Garage-admin side of office KYC.
 *
 *   GET    /garage-admin/org-kyc                      office list (?status, ?q)
 *   GET    /garage-admin/org-kyc/defaults             built-in requirement catalog
 *   GET    /garage-admin/org-kyc/:orgId               one office, with view URLs
 *   PUT    /garage-admin/org-kyc/:orgId/requirements  pick what this office owes
 *   POST   /garage-admin/org-kyc/:orgId/submissions/:id/decision   approve/reject one
 *   POST   /garage-admin/org-kyc/:orgId/verify        office becomes verified
 *   POST   /garage-admin/org-kyc/:orgId/reject        send it back with a note
 *
 * Page-gated as `org_kyc` (config/adminPages.ts) — its own grantable page,
 * not a corner of `organizations`: identity documents are a narrower thing to
 * hand an admin than an office listing. GET is view, every write is manage.
 */
import { Router } from "express";
import { Types } from "mongoose";

import {
  requireGarageAdminAuth,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { OrgKyc } from "../models/orgKyc.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import {
  DEFAULT_KYC_REQUIREMENTS,
  getOrCreateOrgKyc,
  missingRequirements,
  normalizeRequirements,
  OrgKycError,
  serializeOrgKyc,
  syncOrgKycMirror,
} from "../services/orgKyc.service";
import { deleteKycObject } from "../services/orgKycStorage";
import { sendOrgKycVerdictEmail } from "../services/orgKycEmail";
import { ok, fail } from "../utils/http";

const router = Router();

/**
 * A bare "Something went wrong" toast is unactionable — it names neither the
 * call that failed nor the office it failed on, which made one report of this
 * impossible to trace from the outside. The response carries the operation
 * and the error class (both safe to show an admin); the full error and the
 * orgId go to the server log.
 */
function handleError(res: any, err: unknown, where: string, orgId?: string) {
  if (err instanceof OrgKycError) {
    return res.status(err.status).json(fail(err.message));
  }
  const name = err instanceof Error ? err.name : "Error";
  console.error(
    `[garage-admin org-kyc ${where}]${orgId ? ` org=${orgId}` : ""}`,
    err
  );
  return res
    .status(500)
    .json(fail(`KYC ${where} failed (${name}) — check the API logs`, "org_kyc_failed"));
}

/** The catalog the console renders as tick-boxes. */
router.get("/org-kyc/defaults", requireGarageAdminAuth, (_req, res) => {
  return res.json(ok({ requirements: DEFAULT_KYC_REQUIREMENTS }));
});

/**
 * The console's office list.
 *
 * Driven off Organization, NOT OrgKyc — the whole point of the page is to
 * pick an office nobody has asked anything of yet, so offices with no KYC
 * record at all have to appear (as "not_requested"). Newest office first,
 * which is what "show me the offices that just got created" means.
 *
 *   ?status=  filter by KYC state, including "not_requested"
 *   ?q=       match office name or slug
 */
router.get("/org-kyc", requireGarageAdminAuth, async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Number(req.query.limit) || 100, 300);

    const orgFilter: Record<string, any> = { parent: { $ne: true } };
    if (q) {
      // Escaped: an office name is user input and a stray "(" would throw.
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      orgFilter.$or = [{ name: rx }, { slug: rx }];
    }
    if (status) {
      // The mirror on Organization is absent on every office created before
      // KYC existed, so "not_requested" has to match the missing field too.
      orgFilter.kycStatus =
        status === "not_requested"
          ? { $in: ["not_requested", null] }
          : status;
    }

    const orgs = await Organization.find(orgFilter)
      .select(
        "name slug icon coverPhoto description category city state country createdAt kycStatus kycVerifiedAt"
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const orgIds = orgs.map((o: any) => o._id);

    // One round trip each for the KYC records and the founders, keyed off
    // the page of offices we're actually returning.
    const [kycDocs, founders] = await Promise.all([
      OrgKyc.find({ orgId: { $in: orgIds } })
        .select("orgId status requirements submissions submittedAt verifiedAt updatedAt")
        .lean(),
      User.find({
        "organizations.role": "founder",
        "organizations.organization": { $in: orgIds },
      })
        // phone + picture ride along so the console can show who to chase
        // without a second lookup per office.
        .select("name email phone profilePicture organizations")
        .lean(),
    ]);

    const kycByOrg = new Map(
      kycDocs.map((d: any) => [d.orgId.toString(), d])
    );

    // An office can have several founders; the row shows the first and the
    // detail header shows them all.
    const foundersByOrg = new Map<string, any[]>();
    for (const f of founders as any[]) {
      for (const m of f.organizations || []) {
        if (m?.role !== "founder") continue;
        const key = String(m.organization);
        const list = foundersByOrg.get(key) || [];
        list.push({
          id: String(f._id),
          name: f.name,
          email: f.email,
          phone: f.phone,
          profilePicture: f.profilePicture,
        });
        foundersByOrg.set(key, list);
      }
    }

    return res.json(
      ok({
        items: orgs.map((org: any) => {
          const id = org._id.toString();
          const kyc = kycByOrg.get(id);
          const orgFounders = foundersByOrg.get(id) || [];
          return {
            orgId: id,
            orgName: org.name,
            orgSlug: org.slug,
            orgIcon: org.icon,
            orgCoverPhoto: org.coverPhoto,
            orgDescription: org.description,
            orgCategory: org.category,
            orgLocation:
              [org.city, org.state, org.country].filter(Boolean).join(", ") ||
              null,
            orgCreatedAt: org.createdAt,
            founder: orgFounders[0] || null,
            founders: orgFounders,
            status: kyc?.status || org.kycStatus || "not_requested",
            requirementCount: kyc?.requirements?.length || 0,
            submissionCount: kyc?.submissions?.length || 0,
            submittedAt: kyc?.submittedAt || null,
            verifiedAt: kyc?.verifiedAt || org.kycVerifiedAt || null,
            updatedAt: kyc?.updatedAt || org.createdAt,
          };
        }),
      })
    );
  } catch (err) {
    return handleError(res, err, "GET /org-kyc");
  }
});

router.get("/org-kyc/:orgId", requireGarageAdminAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json(fail("Invalid organization id"));
    }
    const org = await Organization.findById(orgId).select("name slug").lean();
    if (!org) return res.status(404).json(fail("Organization not found"));

    const doc = await getOrCreateOrgKyc(orgId);
    return res.json(
      ok({
        ...(await serializeOrgKyc(doc)),
        orgName: (org as any).name,
      })
    );
  } catch (err) {
    return handleError(res, err, "GET /org-kyc/:orgId", req.params.orgId);
  }
});

/**
 * Set (or re-set) what this office has to produce.
 *
 * Dropping a requirement also drops whatever was uploaded against it — there
 * is no reason to keep an identity document nobody asked for, and the S3
 * objects go with it.
 */
router.put(
  "/org-kyc/:orgId/requirements",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res) => {
    try {
      const { orgId } = req.params;
      if (!Types.ObjectId.isValid(orgId)) {
        return res.status(400).json(fail("Invalid organization id"));
      }
      const org = await Organization.findById(orgId).select("_id").lean();
      if (!org) return res.status(404).json(fail("Organization not found"));

      const requirements = normalizeRequirements(req.body?.requirements);
      const doc = await getOrCreateOrgKyc(orgId);
      const keptKeys = new Set(requirements.map((r) => r.key));

      const orphaned = doc.submissions.filter(
        (s) => !keptKeys.has(s.requirementKey)
      );
      doc.submissions = doc.submissions.filter((s) =>
        keptKeys.has(s.requirementKey)
      ) as typeof doc.submissions;

      doc.requirements = requirements as typeof doc.requirements;
      doc.requestedAt = doc.requestedAt || new Date();
      doc.requestedBy = new Types.ObjectId(req.garageAdmin!.id);
      // Re-issuing the list re-opens the case: a verified office whose
      // requirements changed has to answer the new ones before it's verified
      // again, and a rejected one gets a clean slate. An office that is
      // already "submitted" and still has a complete packet stays in the
      // queue rather than bouncing back to the founder for no reason.
      const stillComplete =
        doc.status === "submitted" && missingRequirements(doc).length === 0;
      if (!stillComplete) {
        doc.status = "pending";
        doc.verifiedAt = undefined;
      }
      doc.reviewNote = undefined;
      await doc.save();
      await syncOrgKycMirror(doc.orgId, doc.status);

      for (const s of orphaned) {
        if (s.s3Key) await deleteKycObject(s.s3Key);
      }

      return res.json(ok(await serializeOrgKyc(doc)));
    } catch (err) {
      return handleError(res, err, "PUT requirements", req.params.orgId);
    }
  }
);

/** Approve or reject a single document without settling the whole office. */
router.post(
  "/org-kyc/:orgId/submissions/:submissionId/decision",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res) => {
    try {
      const { orgId, submissionId } = req.params;
      const decision = String(req.body?.status || "");
      if (decision !== "approved" && decision !== "rejected") {
        return res.status(400).json(fail("status must be approved or rejected"));
      }
      const doc = await getOrCreateOrgKyc(orgId);
      const target = doc.submissions.find(
        (s) => s._id.toString() === submissionId
      );
      if (!target) return res.status(404).json(fail("Submission not found"));

      target.status = decision;
      target.reviewNote =
        typeof req.body?.note === "string"
          ? req.body.note.trim().slice(0, 500)
          : undefined;
      target.reviewedAt = new Date();
      target.reviewedBy = new Types.ObjectId(req.garageAdmin!.id);
      await doc.save();

      return res.json(ok(await serializeOrgKyc(doc)));
    } catch (err) {
      return handleError(res, err, "POST decision", req.params.orgId);
    }
  }
);

/**
 * Verify the office. Refuses while a required document is missing, so
 * "verified" can't be handed out over an empty packet by a stray click.
 */
router.post(
  "/org-kyc/:orgId/verify",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res) => {
    try {
      const { orgId } = req.params;
      const doc = await getOrCreateOrgKyc(orgId);
      if (!doc.requirements.length) {
        return res
          .status(400)
          .json(fail("Set this office's KYC requirements first"));
      }
      const missing = missingRequirements(doc);
      if (missing.length) {
        return res
          .status(400)
          .json(fail(`Still missing: ${missing.join(", ")}`));
      }

      const now = new Date();
      doc.submissions.forEach((s) => {
        if (s.status === "pending") {
          s.status = "approved";
          s.reviewedAt = now;
          s.reviewedBy = new Types.ObjectId(req.garageAdmin!.id);
        }
      });
      doc.status = "verified";
      doc.verifiedAt = now;
      doc.reviewedAt = now;
      doc.reviewedBy = new Types.ObjectId(req.garageAdmin!.id);
      doc.reviewNote =
        typeof req.body?.note === "string"
          ? req.body.note.trim().slice(0, 500)
          : undefined;
      await doc.save();
      await syncOrgKycMirror(doc.orgId, "verified", now);

      console.log(
        `[org-kyc] ${req.garageAdmin!.email} verified office ${orgId}`
      );

      // Not awaited: the verdict is already saved, and a mail outage must
      // not turn a successful verification into a 500 for the admin.
      void sendOrgKycVerdictEmail({ orgId, verdict: "verified" });

      return res.json(ok(await serializeOrgKyc(doc)));
    } catch (err) {
      return handleError(res, err, "POST verify", req.params.orgId);
    }
  }
);

/** Send the packet back. The note is what the founder sees on the nudge. */
router.post(
  "/org-kyc/:orgId/reject",
  requireGarageAdminAuth,
  async (req: GarageAdminRequest, res) => {
    try {
      const { orgId } = req.params;
      const note = String(req.body?.note || "").trim();
      if (!note) {
        return res
          .status(400)
          .json(fail("Tell the founder what needs fixing"));
      }
      const doc = await getOrCreateOrgKyc(orgId);
      doc.status = "rejected";
      doc.reviewNote = note.slice(0, 500);
      doc.reviewedAt = new Date();
      doc.reviewedBy = new Types.ObjectId(req.garageAdmin!.id);
      doc.verifiedAt = undefined;
      await doc.save();
      await syncOrgKycMirror(doc.orgId, "rejected");

      // Carry the per-document rejections into the email — "fix your KYC"
      // without naming the file is a round trip nobody needs.
      const perDocument = doc.submissions
        .filter((s) => s.status === "rejected")
        .map((s) => ({
          label:
            doc.requirements.find((r) => r.key === s.requirementKey)?.label ||
            s.requirementKey,
          note: s.reviewNote,
        }));

      void sendOrgKycVerdictEmail({
        orgId,
        verdict: "rejected",
        note: doc.reviewNote,
        perDocument,
      });

      return res.json(ok(await serializeOrgKyc(doc)));
    } catch (err) {
      return handleError(res, err, "POST reject", req.params.orgId);
    }
  }
);

export default router;
