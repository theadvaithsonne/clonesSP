import { Schema, model, Types } from "mongoose";

export const BREAK_SCOPE_TYPES = [
  "Universal",
  "By Department",
  "By Designation",
] as const;

const PayrollImpactSchema = new Schema(
  {
    deductHalfDay: { type: Boolean, default: false },
    deductHourly: {
      enabled: { type: Boolean, default: false },
      ofBasic: { type: Boolean, default: false },
      ofCtc: { type: Boolean, default: false },
    },
    fixedAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const TeamforceBreakSettingsSchema = new Schema(
  {
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    activateBreaks: { type: Boolean, default: false },
    scopeType: {
      type: String,
      enum: BREAK_SCOPE_TYPES,
      default: "Universal",
    },
    scopeTargets: { type: [String], default: [] },
    breakMinutesPerDay: { type: Number, default: 60 },
    breachAffectsPayroll: { type: Boolean, default: false },
    maxBreachMinutesAllowed: { type: Number, default: 0 },
    maxBreachesAllowed: { type: Number, default: 0 },
    payrollImpact: { type: PayrollImpactSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// A policy name must be unique within its organization.
TeamforceBreakSettingsSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const TeamforceBreakSettings = model(
  "TeamforceBreakSettings",
  TeamforceBreakSettingsSchema
);
