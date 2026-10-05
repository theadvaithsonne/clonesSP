import { Schema, model, Document } from "mongoose";

/**
 * Read-only mirror of `franchise_territorymasters` (state-level entity in the
 * franchise hierarchy). Owned by the franchise app at roam-admin-prod.
 * Documents use string _ids.
 */

export interface IFranchiseTerritory extends Document {
  _id: string;
  externalKey?: string;
  id?: string;
  country?: string;
  name?: string;
  region?: string;
  status?: "available" | "taken" | "resale" | "auction" | string;
  ownerEmail?: string | null;
  parentId?: string;
  hasSubTerritories?: boolean;
  subTerritoryIds?: string[];
}

const FranchiseTerritorySchema = new Schema<IFranchiseTerritory>(
  {
    _id: { type: String },
    externalKey: String,
    id: String,
    country: { type: String, index: true },
    name: { type: String, index: true },
    region: String,
    status: { type: String, index: true },
    ownerEmail: String,
    parentId: String,
    hasSubTerritories: Boolean,
    subTerritoryIds: [String],
  },
  {
    collection: "franchise_territorymasters",
    strict: false,
    timestamps: false,
    _id: false,
  }
);

FranchiseTerritorySchema.index({ country: 1, name: 1 });
FranchiseTerritorySchema.index({ country: 1, status: 1 });

export const FranchiseTerritory = model<IFranchiseTerritory>(
  "FranchiseTerritory",
  FranchiseTerritorySchema
);
