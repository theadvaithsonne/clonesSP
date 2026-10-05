import { Schema, model } from "mongoose";

/**
 * Audit row for every credit/debit on a TerritoryWallet. Each row is tagged
 * with both the entity the owner actually owns (`entityType` + `entityId`) and
 * the slice level the money originally came from (`originalSliceLevel` +
 * `relatedSplitPercentage`). When a slice cascades upward — e.g. a territory
 * owner receives an unresolved sub-territory slice — two rows land on their
 * wallet: one with originalSliceLevel="territory" (their own slice) and one
 * with originalSliceLevel="subTerritory" (the cascaded slice). Both rows
 * carry the same entityType (the level the owner actually owns).
 */
const TerritoryWalletTransactionSchema = new Schema(
  {
    territoryWalletId: {
      type: Schema.Types.ObjectId,
      ref: "TerritoryWallet",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["credit", "debit", "withdrawal"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0, // Sub-cent allowed — territory slices are stored at exact
              // percentage of the platform fee with no rounding.
    },
    currency: {
      type: String,
      default: "USD",
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: {
      type: String,
      enum: ["completed", "pending", "failed", "reversed"],
      default: "completed",
      index: true,
    },

    // What the owner actually owns
    // Which franchise layer produced this row. "global" = the original
    // Shorupan platform-fee split (default; every pre-existing row reads as
    // this). "founder_program" = a founder-run per-office franchise program
    // (carved from the seller-office's gross). The /franchise-api reads filter
    // to "global" so roam-admin's numbers are unaffected by founder programs.
    source: {
      type: String,
      enum: ["global", "founder_program"],
      default: "global",
      index: true,
    },
    // Founder-program attribution (only set when source = "founder_program").
    franchiseProgramId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseProgram",
      index: true,
    },
    franchiseAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: "FranchiseTerritoryAssignment",
    },
    franchiseOfficeId: { type: Schema.Types.ObjectId, ref: "Organization" },
    // The buyer whose location attributed this commission (founder programs
    // are buyer-location based).
    buyerUserId: { type: Schema.Types.ObjectId, ref: "User" },

    // Withdrawal rows are aggregate — the balance is a pool of many
    // entities' credits; a single withdrawal doesn't map to one entity. Only
    // credit/debit rows require entity attribution.
    entityType: {
      type: String,
      enum: ["country", "territory", "subTerritory"],
      required: function (this: any) { return this.type !== "withdrawal"; },
      index: true,
    },
    entityId: {
      type: String,
      required: function (this: any) { return this.type !== "withdrawal"; },
      index: true,
    },
    entityName: { type: String },

    // Which slice this row paid (may differ from entityType when cascading)
    originalSliceLevel: {
      type: String,
      enum: ["country", "territory", "subTerritory"],
      required: function (this: any) { return this.type !== "withdrawal"; },
    },
    relatedSplitPercentage: {
      type: Number,
      required: function (this: any) { return this.type !== "withdrawal"; },
    },

    relatedCommissionDistributionId: {
      type: Schema.Types.ObjectId,
      ref: "CommissionDistribution",
      index: true,
    },
    relatedPaymentId: { type: String },
    relatedItemType: { type: String },
    relatedItemId: { type: Schema.Types.ObjectId },
    relatedItemName: { type: String },
    relatedSaleAmount: { type: Number },
    relatedPlatformFeeAmount: { type: Number },
    relatedPlatformFeePercentage: { type: Number },
    relatedOrgId: { type: Schema.Types.ObjectId, ref: "Organization" },

    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TerritoryWalletTransactionSchema.index({ userId: 1, createdAt: -1 });
TerritoryWalletTransactionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
TerritoryWalletTransactionSchema.index({ relatedOrgId: 1, createdAt: -1 });

export const TerritoryWalletTransaction = model(
  "TerritoryWalletTransaction",
  TerritoryWalletTransactionSchema
);
