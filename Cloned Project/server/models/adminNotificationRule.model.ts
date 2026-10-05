// Admin notification rules — "when X happens, mail Y".
//
// Both halves are configured rather than coded: the condition tree is
// evaluated against an event's payload, and recipients are resolved per event.
// See docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md.
//
// `conditions` and `recipients` are Mixed on purpose. They are recursive /
// discriminated-union shapes that Mongoose cannot express usefully, and
// validating them here would duplicate the zod schemas the routes already
// enforce. The route layer is the single validator; this is storage.
import mongoose, { Schema, Document, Types } from "mongoose";

/** A leaf test, or a boolean combinator over more nodes. */
export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { not: ConditionNode }
  | { field: string; op: string; value?: unknown };

/**
 * Who gets the mail. `static` is literal addresses; every other kind is
 * resolved at send time, which is what makes recipients dynamic — the rule
 * stores the relationship, not the address, so it survives a change of
 * sponsor, office owner or staff.
 */
export type RecipientSpec =
  | { type: "static"; emails: string[] }
  | { type: "relation"; relation: "sponsor" | "upline" | "officeOwner" | "subject" }
  | { type: "role"; role: string }
  | { type: "query"; filter: Record<string, unknown>; cap: number };

export interface IAdminNotificationRule extends Document {
  name: string;
  description?: string;
  enabled: boolean;
  /** Registry event name, e.g. "user.signup". Not an enum — the catalogue is
   *  extensible, so storing an unknown name is possible and simply never
   *  matches until the emitter ships. */
  event: string;
  conditions: ConditionNode;
  recipients: RecipientSpec[];
  templateId?: string;
  templateName?: string;
  templateHtml?: string;
  syncedAt?: Date;
  throttlePerHour: number;
  recipientCap: number;
  /** null = platform-wide. Present from day one so founder-scoped rules can
   *  be added later without a migration; no founder UI exists yet. */
  orgId: Types.ObjectId | null;
  createdBy?: Types.ObjectId;
  lastFiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminNotificationRuleSchema = new Schema<IAdminNotificationRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    // Created disabled, always. Saving a rule must never start sending mail —
    // an admin needs the dry run before anything reaches a real inbox.
    enabled: { type: Boolean, default: false, index: true },
    event: { type: String, required: true, trim: true, index: true },
    conditions: { type: Schema.Types.Mixed, default: () => ({ all: [] }) },
    // Mixed rather than [Mixed]: an array of a discriminated union is not
    // something Mongoose's typings express, and the array lives inside the
    // Mixed value perfectly well. The route's zod schema is the validator.
    recipients: { type: Schema.Types.Mixed, default: () => [] },
    templateId: { type: String, trim: true },
    templateName: { type: String, trim: true },
    templateHtml: { type: String },
    syncedAt: { type: Date },
    // Ceilings, not preferences. A careless query-based rule would otherwise
    // mail thousands; the server clamps regardless of what the UI submitted.
    throttlePerHour: { type: Number, default: 60, min: 1, max: 10000 },
    recipientCap: { type: Number, default: 50, min: 1, max: 5000 },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    lastFiredAt: { type: Date },
  },
  { timestamps: true },
);

// The sweep that will consume these asks "enabled rules for this event".
AdminNotificationRuleSchema.index({ event: 1, enabled: 1 });

export const AdminNotificationRule = mongoose.model<IAdminNotificationRule>(
  "AdminNotificationRule",
  AdminNotificationRuleSchema,
);
