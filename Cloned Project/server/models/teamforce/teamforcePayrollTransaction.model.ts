import { Schema, model, Types } from "mongoose";

const ResolvedComponentSchema = new Schema(
  {
    componentCode: { type: String, required: true },
    componentName: { type: String, required: true },
    taxabilityType: { type: String, required: true },
    calculationType: { type: String, required: true },
    value: { type: Number, default: 0 }, // configured value (% or flat)
    amount: { type: Number, default: 0 }, // resolved monthly rupees (post-proration)
  },
  { _id: false }
);

const AttendanceBreakdownSchema = new Schema(
  {
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    windowCalendarDays: { type: Number, default: 0 },
    daysEmployeeInWindow: { type: Number, default: 0 },
    daysPresentInWindow: { type: Number, default: 0 },
    paidLeaveDaysInWindow: { type: Number, default: 0 },
    lopDaysInWindow: { type: Number, default: 0 },
    scheduledOffDaysInWindow: { type: Number, default: 0 },
    attendanceFactor: { type: Number, default: 0 },
    lopDaysApplied: { type: Number, default: 0 },
    deferredLopApplied: { type: Number, default: 0 },
    isJoiningMonth: { type: Boolean, default: false },
    inGraceWindow: { type: Boolean, default: false },
    graceTailDays: { type: Number, default: 0 },
    graceTailLopDays: { type: Number, default: 0 },
    graceTailFactor: { type: Number, default: 0 },
    deferredLopForNextCycle: { type: Number, default: 0 },
  },
  { _id: false }
);

const ChapterVIASchema = new Schema(
  {
    sec80C: { type: Number, default: 0 },
    sec80CCD1B: { type: Number, default: 0 },
    sec80CCD2: { type: Number, default: 0 },
    sec80D: { type: Number, default: 0 },
    sec80TTAorTTB: { type: Number, default: 0 },
    sec80E: { type: Number, default: 0 },
    sec80EEA: { type: Number, default: 0 },
    sec80G: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const TeamforcePayrollTransactionSchema = new Schema(
  {
    runId: {
      type: Types.ObjectId,
      ref: "TeamforcePayrollRun",
      required: true,
      index: true,
    },
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },

    // Snapshot (so the transaction is self-contained even if profile/structure
    // changes later)
    salaryStructureId: {
      type: Types.ObjectId,
      ref: "TeamforceSalaryStructure",
    },
    monthlyCtcAnchor: { type: Number, default: 0 },
    earnings: { type: [ResolvedComponentSchema], default: [] },
    deductions: { type: [ResolvedComponentSchema], default: [] },

    // Attendance
    attendance: { type: AttendanceBreakdownSchema, required: true },

    // Section 192 outputs
    regimeUsed: { type: String, enum: ["OLD", "NEW"], required: true },
    projectedAnnualGross: { type: Number, default: 0 },
    totalExemptions: { type: Number, default: 0 },
    standardDeduction: { type: Number, default: 0 },
    chapterVIA: { type: ChapterVIASchema, default: () => ({}) },
    netTaxableIncome: { type: Number, default: 0 },
    annualTaxLiability: { type: Number, default: 0 },
    monthlyTDS: { type: Number, default: 0 },
    overDeducted: { type: Boolean, default: false },

    // Statutory monthly amounts
    pfEmployee: { type: Number, default: 0 },
    pfEmployer: { type: Number, default: 0 },
    esiEmployee: { type: Number, default: 0 },
    esiEmployer: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },

    // Final pay
    grossSalary: { type: Number, default: 0 },
    joiningPartialPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },

    // Per-employee notes & warnings (engine + resolver)
    warnings: { type: [String], default: [] },
    overrideNotes: { type: String, default: "" },
    overriddenBy: { type: Types.ObjectId, ref: "User" },
    overriddenAt: { type: Date },
  },
  { timestamps: true }
);

TeamforcePayrollTransactionSchema.index({ runId: 1, userId: 1 }, { unique: true });

export const TeamforcePayrollTransaction = model(
  "TeamforcePayrollTransaction",
  TeamforcePayrollTransactionSchema
);
