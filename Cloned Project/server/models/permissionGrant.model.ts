import { Schema, model } from "mongoose";
import { RBAC_MODULES } from "../config/rbacModules";

/**
 * Module-RBAC grant queue AND permanent audit trail — one collection, both jobs.
 *
 * A founder granting a module does NOT hand over access. It writes a row here
 * with action:"grant", status:"pending" and a 24h expiry. The member must
 * accept before `user.organizations[].modulePermissions[module]` flips to true.
 * Untouched for 24h, the offer dies.
 *
 * Revoking is not symmetric — nobody accepts losing access. A revoke applies
 * to the membership immediately and lands here as action:"revoke",
 * status:"applied" purely so the audit trail is complete.
 *
 * Rows are never deleted (hence no TTL index) — expiry flips a status so the
 * history of who granted what, and whether it was taken up, survives.
 */
const PermissionGrantSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // The member the permission is for.
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: RBAC_MODULES as unknown as string[],
      required: true,
    },
    action: {
      type: String,
      enum: ["grant", "revoke"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending", // grant awaiting the member's response
        "accepted", // member accepted; permission is live
        "declined", // member said no
        "expired", // 24h elapsed with no response
        "cancelled", // founder withdrew the offer before a response
        "applied", // revokes only — took effect immediately
      ],
      required: true,
    },
    // The founder who performed the action.
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Grants only. Null on revokes, which never wait for anything.
    expiresAt: { type: Date },
    // When the member accepted/declined, or when the sweeper expired it.
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

// At most one live offer per (org, member, module). Scoped to pending so the
// accepted/expired/revoke history never collides with it.
PermissionGrantSchema.index(
  { orgId: 1, userId: 1, module: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

// Founder-facing audit log: GET /rbac/grants?orgId=&status=
PermissionGrantSchema.index({ orgId: 1, status: 1, createdAt: -1 });

// Member-facing inbox: GET /rbac/my-grants
PermissionGrantSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Powers the expiry sweeper — filters on
// { action: "grant", status: "pending", expiresAt: { $lt: now } }.
PermissionGrantSchema.index({ status: 1, expiresAt: 1 });

export const PermissionGrant = model("PermissionGrant", PermissionGrantSchema);
