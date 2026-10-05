import mongoose, { Schema, Document } from "mongoose";

export interface IDynamicEmailItem {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface ISettings extends Document {
  userId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  emailPreferences: Map<string, boolean>;
  officeDynamicEmails: IDynamicEmailItem[];
  /** UI language, as an ISO-639 code ("en"). Optional: every settings document
   *  written before this existed has none, and a client that never sends one
   *  must keep working exactly as it did. */
  language?: string;
  /** Display currency, as an ISO-4217 code ("USD"). Optional; the client owns
   *  the allow-list of which currencies are selectable. */
  currency?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DynamicEmailItemSchema = new Schema<IDynamicEmailItem>(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Short by design — an ISO-639 code, optionally with a region ("pt-BR").
    // Bounded so a client bug cannot write an essay into a settings row.
    language: { type: String, trim: true, maxlength: 10 },
    // ISO-4217 code, e.g. "USD"; optional; the client owns the allow-list.
    currency: { type: String },
    emailPreferences: {
      type: Map,
      of: Boolean,
      default: {},
    },
    officeDynamicEmails: {
      type: [DynamicEmailItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

SettingsSchema.index({ userId: 1, orgId: 1 }, { unique: true });

export const Settings =
  mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);
