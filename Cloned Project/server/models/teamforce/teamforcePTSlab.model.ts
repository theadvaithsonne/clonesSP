import { Schema, model } from "mongoose";

const TeamforcePTSlabSchema = new Schema(
  {
    state: { type: String, required: true, trim: true },
    grossFrom: { type: Number, required: true, default: 0 },
    grossTo: { type: Number, default: null },
    monthlyPT: { type: Number, required: true, default: 0 },
    monthOverride: { type: Number, default: null, min: 1, max: 12 },
    effectiveDate: { type: Date, required: true, default: () => new Date() },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamforcePTSlabSchema.index({ state: 1, effectiveDate: -1 });

export const TeamforcePTSlab = model(
  "TeamforcePTSlab",
  TeamforcePTSlabSchema
);

export const SEED_PT_SLABS: Array<{
  state: string;
  grossFrom: number;
  grossTo: number | null;
  monthlyPT: number;
  monthOverride: number | null;
}> = [
  // Maharashtra (Feb has the ₹300 override row for gross > ₹10,000)
  { state: "Maharashtra", grossFrom: 0, grossTo: 7500, monthlyPT: 0, monthOverride: null },
  { state: "Maharashtra", grossFrom: 7501, grossTo: 10000, monthlyPT: 175, monthOverride: null },
  { state: "Maharashtra", grossFrom: 10001, grossTo: null, monthlyPT: 200, monthOverride: null },
  { state: "Maharashtra", grossFrom: 10001, grossTo: null, monthlyPT: 300, monthOverride: 2 },
  // Karnataka
  { state: "Karnataka", grossFrom: 0, grossTo: 14999, monthlyPT: 0, monthOverride: null },
  { state: "Karnataka", grossFrom: 15000, grossTo: null, monthlyPT: 200, monthOverride: null },
  // Tamil Nadu
  { state: "Tamil Nadu", grossFrom: 0, grossTo: 21000, monthlyPT: 0, monthOverride: null },
  { state: "Tamil Nadu", grossFrom: 21001, grossTo: 30000, monthlyPT: 135, monthOverride: null },
  { state: "Tamil Nadu", grossFrom: 30001, grossTo: 45000, monthlyPT: 315, monthOverride: null },
  { state: "Tamil Nadu", grossFrom: 45001, grossTo: 60000, monthlyPT: 690, monthOverride: null },
  { state: "Tamil Nadu", grossFrom: 60001, grossTo: 75000, monthlyPT: 1025, monthOverride: null },
  { state: "Tamil Nadu", grossFrom: 75001, grossTo: null, monthlyPT: 1250, monthOverride: null },
  // Telangana
  { state: "Telangana", grossFrom: 0, grossTo: 14999, monthlyPT: 0, monthOverride: null },
  { state: "Telangana", grossFrom: 15000, grossTo: 19999, monthlyPT: 150, monthOverride: null },
  { state: "Telangana", grossFrom: 20000, grossTo: null, monthlyPT: 200, monthOverride: null },
  // Gujarat
  { state: "Gujarat", grossFrom: 0, grossTo: 5999, monthlyPT: 0, monthOverride: null },
  { state: "Gujarat", grossFrom: 6000, grossTo: 8999, monthlyPT: 80, monthOverride: null },
  { state: "Gujarat", grossFrom: 9000, grossTo: 11999, monthlyPT: 150, monthOverride: null },
  { state: "Gujarat", grossFrom: 12000, grossTo: null, monthlyPT: 200, monthOverride: null },
  // Zero-PT states (single catch-all row each)
  { state: "Delhi", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Haryana", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Rajasthan", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Uttar Pradesh", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Madhya Pradesh", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Bihar", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Punjab", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
  { state: "Chandigarh", grossFrom: 0, grossTo: null, monthlyPT: 0, monthOverride: null },
];

export const PT_STATES = Array.from(new Set(SEED_PT_SLABS.map((s) => s.state))).sort();
