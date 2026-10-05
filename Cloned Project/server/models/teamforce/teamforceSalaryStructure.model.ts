import { Schema, model, Types } from "mongoose";

export const COMPONENT_CODES = [
  // Earnings
  "BASIC",
  "DA",
  "HRA",
  "LTA",
  "SPECIAL",
  "CHILDREN_EDU",
  "CHILDREN_HOSTEL",
  "UNIFORM",
  "MEDICAL_REIMB",
  "TELEPHONE_REIMB",
  "BONUS",
  "OVERTIME",
  "LEAVE_ENCASH",
  "PF_EMPLOYER",
  "NPS_EMPLOYER",
  "GRATUITY_PROVISION",
  // Deductions
  "PF_EMPLOYEE",
  "ESI_EMPLOYEE",
  "PT",
  "TDS",
  "LOAN_EMI",
  "ADVANCE_RECOVERY",
  // Catch-all
  "CUSTOM",
] as const;

export const TAXABILITY_TYPES = [
  "FULLY_TAXABLE",
  "EXEMPT_FORMULA",
  "EXEMPT_FIXED",
  "EXEMPT_FULL",
  "DEDUCTION_STATUTORY",
  "DEDUCTION_VOLUNTARY",
  "REIMBURSEMENT",
] as const;

export const CALC_TYPES = [
  "flat",
  "percentBasic",
  "percentBasicPlusDA",
  "percentCTC",
  "percentGross",
] as const;

export const TAX_REGIMES = ["old", "new"] as const;

export type ComponentCode = (typeof COMPONENT_CODES)[number];
export type TaxabilityType = (typeof TAXABILITY_TYPES)[number];
export type CalcType = (typeof CALC_TYPES)[number];
export type TaxRegime = (typeof TAX_REGIMES)[number];

const ComponentSchema = new Schema(
  {
    componentCode: {
      type: String,
      enum: COMPONENT_CODES,
      required: true,
      default: "CUSTOM",
    },
    componentName: { type: String, required: true, trim: true },
    taxabilityType: {
      type: String,
      enum: TAXABILITY_TYPES,
      required: true,
    },
    calculationType: { type: String, enum: CALC_TYPES, default: "flat" },
    value: { type: Number, default: 0 },
  },
  { _id: false }
);

const TeamforceSalaryStructureSchema = new Schema(
  {
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    earnings: { type: [ComponentSchema], default: [] },
    deductions: { type: [ComponentSchema], default: [] },
    taxRegime: { type: String, enum: TAX_REGIMES, default: "new" },
    autoTds: { type: Boolean, default: true },
    estimatedAnnualTds: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforceSalaryStructureSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const TeamforceSalaryStructure = model(
  "TeamforceSalaryStructure",
  TeamforceSalaryStructureSchema
);

export interface DefaultComponent {
  componentCode: ComponentCode;
  componentName: string;
  taxabilityType: TaxabilityType;
  calculationType: CalcType;
  value: number;
}

export function buildDefaultSalaryStructureComponents(): {
  earnings: DefaultComponent[];
  deductions: DefaultComponent[];
} {
  return {
    earnings: [
      {
        componentCode: "BASIC",
        componentName: "Basic Salary",
        taxabilityType: "FULLY_TAXABLE",
        calculationType: "percentCTC",
        value: 40,
      },
      {
        componentCode: "HRA",
        componentName: "House Rent Allowance",
        taxabilityType: "EXEMPT_FORMULA",
        calculationType: "percentBasic",
        value: 40,
      },
      {
        componentCode: "SPECIAL",
        componentName: "Special Allowance",
        taxabilityType: "FULLY_TAXABLE",
        calculationType: "flat",
        value: 0,
      },
    ],
    deductions: [
      {
        componentCode: "PF_EMPLOYEE",
        componentName: "PF (Employee)",
        taxabilityType: "DEDUCTION_STATUTORY",
        calculationType: "percentBasicPlusDA",
        value: 12,
      },
      {
        componentCode: "PT",
        componentName: "Professional Tax",
        taxabilityType: "DEDUCTION_STATUTORY",
        calculationType: "flat",
        value: 200,
      },
    ],
  };
}
