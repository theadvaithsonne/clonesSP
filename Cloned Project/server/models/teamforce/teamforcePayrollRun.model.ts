import { Schema, model, Types } from "mongoose";

export const PAYROLL_RUN_STATUSES = ["DRAFT", "APPROVED", "PAID"] as const;
export const PAYROLL_RUN_TYPES = ["FULL", "PARTIAL"] as const;

const TotalsSchema = new Schema(
  {
    grossSum: { type: Number, default: 0 },
    netSum: { type: Number, default: 0 },
    tdsSum: { type: Number, default: 0 },
    pfSum: { type: Number, default: 0 },
    ptSum: { type: Number, default: 0 },
    esiSum: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const ScopeSchema = new Schema(
  {
    departmentIds: [{ type: Types.ObjectId }],
    branchIds: [{ type: Types.ObjectId }],
    userIds: [{ type: Types.ObjectId }],
    label: { type: String, default: "" },
  },
  { _id: false }
);

const TeamforcePayrollRunSchema = new Schema(
  {
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    /** FY-relative month (1 = April … 12 = March). */
    fyMonth: { type: Number, required: true, min: 1, max: 12 },
    fyYear: { type: Number, required: true }, // calendar year of FY start (e.g. 2024 for FY 2024-25)
    /** Pay-month in calendar terms — derived but stored for queries. */
    calendarMonth: { type: Number, required: true, min: 1, max: 12 },
    calendarYear: { type: Number, required: true },

    /** FULL processes all eligible employees; PARTIAL processes a scoped subset. */
    runType: {
      type: String,
      enum: PAYROLL_RUN_TYPES,
      default: "FULL",
    },
    /** Scope definition — only populated for PARTIAL runs. */
    scope: { type: ScopeSchema, default: null },
    /** Resolved user IDs included in this run (set after creation). */
    includedUserIds: [{ type: Types.ObjectId, ref: "User" }],

    status: {
      type: String,
      enum: PAYROLL_RUN_STATUSES,
      default: "DRAFT",
      index: true,
    },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    cutoffDayUsed: { type: Number, required: true, min: 1, max: 28 },

    totals: { type: TotalsSchema, default: () => ({}) },

    createdBy: { type: Types.ObjectId, ref: "User" },
    approvedBy: { type: Types.ObjectId, ref: "User" },
    approvedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },

    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// One run per month per org — enforced at DB level.
TeamforcePayrollRunSchema.index({ orgId: 1, fyYear: 1, fyMonth: 1 }, { unique: true });

export const TeamforcePayrollRun = model(
  "TeamforcePayrollRun",
  TeamforcePayrollRunSchema
);
