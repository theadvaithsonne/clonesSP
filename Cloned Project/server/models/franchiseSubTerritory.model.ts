import { Schema, model, Document } from "mongoose";

/**
 * Read-only mirror of `franchise_sub_territories` (city-level entity in the
 * franchise hierarchy). Owned by the franchise app at roam-admin-prod.
 *
 * `zipCodes` is the lookup array used by the territory resolver to map a
 * Garage office's postalCode to a specific sub-territory.
 */

export interface IFranchiseSubTerritory extends Document {
  _id: string;
  externalKey?: string;
  id?: string;
  country?: string;
  parentTerritory?: string;
  name?: string;
  region?: string;
  status?: "available" | "taken" | "resale" | "auction" | string;
  ownerEmail?: string | null;
  parentId?: string;
  parentTerritoryId?: string;
  zipCodes?: string[];
}

const FranchiseSubTerritorySchema = new Schema<IFranchiseSubTerritory>(
  {
    _id: { type: String },
    externalKey: String,
    id: String,
    country: { type: String, index: true },
    parentTerritory: { type: String, index: true },
    name: { type: String, index: true },
    region: String,
    status: { type: String, index: true },
    ownerEmail: String,
    parentId: String,
    parentTerritoryId: String,
    zipCodes: { type: [String], index: true },
  },
  {
    collection: "franchise_sub_territories",
    strict: false,
    timestamps: false,
    _id: false,
  }
);

FranchiseSubTerritorySchema.index({ zipCodes: 1, status: 1 });
FranchiseSubTerritorySchema.index({ country: 1, parentTerritory: 1, name: 1 });

export const FranchiseSubTerritory = model<IFranchiseSubTerritory>(
  "FranchiseSubTerritory",
  FranchiseSubTerritorySchema
);
