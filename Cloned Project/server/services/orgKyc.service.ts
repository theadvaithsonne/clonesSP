/**
 * Shared KYC logic between the garage-admin console and the founder-facing
 * routes: the built-in requirement catalog, requirement normalisation, and the
 * serializer that mints fresh presigned view URLs.
 */
import { Types } from "mongoose";

import {
  IOrgKyc,
  IOrgKycRequirement,
  OrgKyc,
  OrgKycStatus,
} from "../models/orgKyc.model";
import { Organization } from "../models/organization.model";
import { presignKycView, isKycStorageConfigured } from "./orgKycStorage";

/**
 * The options the console offers out of the box. An admin ticks the ones this
 * office has to produce and can add any number of custom fields on top.
 */
export const DEFAULT_KYC_REQUIREMENTS: IOrgKycRequirement[] = [
  {
    key: "pan_card",
    label: "PAN Card",
    kind: "file",
    description: "Scan or photo of the company/proprietor PAN card",
    required: true,
    custom: false,
  },
  {
    key: "business_address_proof",
    label: "Business Address Proof",
    kind: "file",
    description: "Utility bill, rent agreement or ownership document",
    required: true,
    custom: false,
  },
  {
    key: "government_id",
    label: "Government ID",
    kind: "file",
    description: "Aadhaar, passport, driving licence or voter ID of the founder",
    required: true,
    custom: false,
  },
  {
    key: "gst_number",
    label: "GST Number",
    kind: "text",
    description: "15-character GSTIN",
    required: true,
    custom: false,
  },
];

/** Slug a custom label into a stable key. */
export function slugifyRequirementKey(label: string): string {
  return String(label || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export class OrgKycError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgKycError";
    this.status = status;
  }
}

/**
 * Accept whatever the console sent and return a clean requirement list.
 * Duplicate keys collapse (last wins), empty labels are dropped, and a custom
 * entry whose label slugs to nothing falls back to a positional key so it
 * can still be answered.
 */
export function normalizeRequirements(raw: unknown): IOrgKycRequirement[] {
  if (!Array.isArray(raw)) {
    throw new OrgKycError("requirements must be an array");
  }
  const out = new Map<string, IOrgKycRequirement>();
  raw.forEach((item: any, index: number) => {
    const label = String(item?.label || "").trim();
    if (!label) return;
    const builtIn = DEFAULT_KYC_REQUIREMENTS.find(
      (d) => d.key === String(item?.key || "")
    );
    const key =
      String(item?.key || "").trim() ||
      slugifyRequirementKey(label) ||
      `custom_${index + 1}`;
    out.set(key, {
      key,
      label: label.slice(0, 120),
      kind: item?.kind === "text" ? "text" : "file",
      description:
        typeof item?.description === "string"
          ? item.description.trim().slice(0, 300)
          : builtIn?.description,
      required: item?.required === false ? false : true,
      custom: builtIn ? false : true,
    });
  });
  if (out.size === 0) {
    throw new OrgKycError("Pick at least one document for this office");
  }
  if (out.size > 25) {
    throw new OrgKycError("That's more than 25 requirements — trim the list");
  }
  return Array.from(out.values());
}

/** Load the office's record, creating an empty one on first touch. */
export async function getOrCreateOrgKyc(orgId: string): Promise<IOrgKyc> {
  if (!Types.ObjectId.isValid(orgId)) {
    throw new OrgKycError("Invalid organization id", 400);
  }
  const existing = await OrgKyc.findOne({ orgId: new Types.ObjectId(orgId) });
  if (existing) return existing;
  return OrgKyc.create({
    orgId: new Types.ObjectId(orgId),
    status: "not_requested",
    requirements: [],
    submissions: [],
  });
}

/**
 * Every REQUIRED requirement has at least one submission that isn't rejected.
 * Optional requirements never hold up a submission.
 */
export function requirementsSatisfied(doc: IOrgKyc): boolean {
  const required = doc.requirements.filter((r) => r.required);
  if (required.length === 0) return doc.submissions.length > 0;
  return required.every((req) =>
    doc.submissions.some(
      (s) => s.requirementKey === req.key && s.status !== "rejected"
    )
  );
}

/** Which required requirements are still missing an answer. */
export function missingRequirements(doc: IOrgKyc): string[] {
  return doc.requirements
    .filter(
      (req) =>
        req.required &&
        !doc.submissions.some(
          (s) => s.requirementKey === req.key && s.status !== "rejected"
        )
    )
    .map((req) => req.label);
}

/**
 * Mirror the status onto the Organization so office listings and the founder's
 * own session can show a verified badge without a second collection read.
 * Best-effort: a failure here must not fail the KYC write that triggered it.
 */
export async function syncOrgKycMirror(
  orgId: Types.ObjectId | string,
  status: OrgKycStatus,
  verifiedAt?: Date | null
): Promise<void> {
  try {
    await Organization.updateOne(
      { _id: orgId },
      {
        $set: {
          kycStatus: status,
          kycVerifiedAt: status === "verified" ? verifiedAt ?? new Date() : null,
        },
      }
    );
  } catch (err) {
    console.warn("[orgKyc] failed to mirror status onto Organization", err);
  }
}

export interface SerializedOrgKyc {
  orgId: string;
  status: OrgKycStatus;
  storageConfigured: boolean;
  requirements: IOrgKycRequirement[];
  submissions: {
    id: string;
    requirementKey: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    textValue?: string;
    status: string;
    reviewNote?: string;
    uploadedAt: Date;
    /** Short-lived presigned GET. Absent when the caller can't view files. */
    viewUrl?: string;
  }[];
  reviewNote?: string;
  missing: string[];
  requestedAt?: Date | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  verifiedAt?: Date | null;
  updatedAt?: Date;
}

/**
 * @param withViewUrls mint presigned view URLs for uploaded files. Both the
 * reviewing admin and the founder who uploaded them get these — nobody else
 * ever reaches this serializer.
 */
export async function serializeOrgKyc(
  doc: IOrgKyc,
  withViewUrls = true
): Promise<SerializedOrgKyc> {
  const submissions = await Promise.all(
    doc.submissions.map(async (s) => {
      let viewUrl: string | undefined;
      if (withViewUrls && s.s3Key && isKycStorageConfigured()) {
        try {
          viewUrl = await presignKycView(s.s3Key, s.filename);
        } catch (err) {
          console.warn("[orgKyc] could not presign view for", s.s3Key, err);
        }
      }
      return {
        id: s._id.toString(),
        requirementKey: s.requirementKey,
        filename: s.filename,
        mimeType: s.mimeType,
        size: s.size,
        textValue: s.textValue,
        status: s.status,
        reviewNote: s.reviewNote,
        uploadedAt: s.uploadedAt,
        viewUrl,
      };
    })
  );

  return {
    orgId: doc.orgId.toString(),
    status: doc.status,
    storageConfigured: isKycStorageConfigured(),
    requirements: doc.requirements,
    submissions,
    reviewNote: doc.reviewNote,
    missing: missingRequirements(doc),
    requestedAt: doc.requestedAt ?? null,
    submittedAt: doc.submittedAt ?? null,
    reviewedAt: doc.reviewedAt ?? null,
    verifiedAt: doc.verifiedAt ?? null,
    updatedAt: doc.updatedAt,
  };
}
