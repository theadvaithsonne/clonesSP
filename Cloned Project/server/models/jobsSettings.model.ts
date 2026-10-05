// src/models/jobsSettings.model.ts
//
// Per-office settings for Garage Jobs: the careers page, candidate email
// templates, rejection reasons, reusable application forms, the default hiring
// pipeline and data-retention rules. One document per org, created lazily.
//
// Saved forms and the default pipeline reuse the posting's page / stage shapes;
// they are stored as plain objects and validated by the route's zod schemas so
// the two definitions cannot drift apart.

import { Schema, model, Document, Types } from "mongoose";

export const EMAIL_TEMPLATE_KINDS = [
  "application_received",
  "moved_to_interview",
  "interview_invite",
  "rejection",
  "offer",
  "custom",
] as const;
export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export interface IJobsEmailTemplate {
  id: string;
  name: string;
  kind: EmailTemplateKind;
  subject: string;
  body: string;
}

export interface IJobsSavedForm {
  id: string;
  name: string;
  pages: any[];
  createdAt: Date;
}

export interface IJobsSettings extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  careersPage: {
    coverImage?: string;
    headline?: string;
    about?: string;
    culturePhotos: string[];
    perks: string[];
    showRewards: boolean;
  };
  emailTemplates: IJobsEmailTemplate[];
  rejectionReasons: { id: string; label: string }[];
  savedForms: IJobsSavedForm[];
  defaultPipeline: { stages: any[] };
  privacy: {
    retentionMonths: number;
    allowDeletionRequests: boolean;
    consentAddition: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<IJobsEmailTemplate>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 120 },
    kind: { type: String, enum: EMAIL_TEMPLATE_KINDS, default: "custom" },
    subject: { type: String, default: "", maxlength: 300 },
    body: { type: String, default: "", maxlength: 20000 },
  },
  { _id: false }
);

const JobsSettingsSchema = new Schema<IJobsSettings>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    careersPage: {
      coverImage: { type: String },
      headline: { type: String, maxlength: 200 },
      about: { type: String, maxlength: 4000 },
      culturePhotos: { type: [String], default: [] },
      perks: { type: [String], default: [] },
      showRewards: { type: Boolean, default: false },
    },
    emailTemplates: { type: [TemplateSchema], default: [] },
    rejectionReasons: {
      type: [
        new Schema(
          { id: { type: String, required: true }, label: { type: String, required: true } },
          { _id: false }
        ),
      ],
      default: [],
    },
    savedForms: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            name: { type: String, required: true, maxlength: 120 },
            pages: { type: [Schema.Types.Mixed], default: [] },
            createdAt: { type: Date, default: () => new Date() },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    defaultPipeline: {
      stages: { type: [Schema.Types.Mixed], default: [] },
    },
    privacy: {
      retentionMonths: { type: Number, default: 12, min: 1, max: 120 },
      allowDeletionRequests: { type: Boolean, default: true },
      consentAddition: { type: String, default: "", maxlength: 4000 },
    },
  },
  { timestamps: true }
);

export const JobsSettings = model<IJobsSettings>("JobsSettings", JobsSettingsSchema);
