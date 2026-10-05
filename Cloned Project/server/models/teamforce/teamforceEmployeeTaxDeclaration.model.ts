import { Schema, model, Types } from "mongoose";

const HRADeclSchema = new Schema(
  {
    monthlyRentPaid: { type: Number, default: 0 },
    landlordName: { type: String, default: "", trim: true },
    landlordPan: { type: String, default: "", trim: true, uppercase: true },
    ownsHouseInCity: { type: Boolean, default: false },
  },
  { _id: false }
);

const PrevEmployerSchema = new Schema(
  {
    name: { type: String, default: "", trim: true },
    tan: { type: String, default: "", trim: true, uppercase: true },
    grossSalary: { type: Number, default: 0 },
    tdsDeducted: { type: Number, default: 0 },
    ptPaid: { type: Number, default: 0 },
    pfPaid: { type: Number, default: 0 },
  },
  { _id: false }
);

const TeamforceEmployeeTaxDeclarationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    orgId: { type: Types.ObjectId, ref: "Organization", required: true },
    fy: { type: String, required: true, trim: true }, // e.g. "2024-25"

    regime: { type: String, enum: ["OLD", "NEW"], default: "NEW" },

    // HRA — Old Regime only
    hraDeclaration: { type: HRADeclSchema, default: () => ({}) },

    // LTA — Old Regime only
    ltaClaimAmount: { type: Number, default: 0 },

    // Children allowance counts (Old Regime exemption — Sec 10(14))
    numChildren: { type: Number, default: 0, min: 0, max: 10 },

    // Chapter VI-A declared amounts (mostly Old Regime; 80CCD(2) flows in both)
    declared80C: { type: Number, default: 0 },
    declaredNpsSelf: { type: Number, default: 0 }, // 80CCD(1B)
    declared80DSelf: { type: Number, default: 0 },
    declared80DParent: { type: Number, default: 0 },
    parentSeniorCitizen: { type: Boolean, default: false },
    savingsInterest: { type: Number, default: 0 }, // 80TTA / 80TTB
    fdInterest: { type: Number, default: 0 }, // 80TTB only (age >= 60)
    declared80E: { type: Number, default: 0 },
    declared80EEA: { type: Number, default: 0 },
    declared80G: { type: Number, default: 0 },

    // Form 12B — previous employer income for mid-FY joiners
    previousEmployer: { type: PrevEmployerSchema, default: () => ({}) },

    locked: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TeamforceEmployeeTaxDeclarationSchema.index(
  { userId: 1, orgId: 1, fy: 1 },
  { unique: true }
);

export const TeamforceEmployeeTaxDeclaration = model(
  "TeamforceEmployeeTaxDeclaration",
  TeamforceEmployeeTaxDeclarationSchema
);
