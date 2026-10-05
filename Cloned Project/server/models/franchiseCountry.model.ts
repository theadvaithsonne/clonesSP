import { Schema, model, Document } from "mongoose";

/**
 * Read-only mirror of the `franchise_countries` collection owned by the
 * franchise app (roam-admin-prod). The Garage backend only reads this — it
 * never writes. Documents use string _ids (not ObjectIds).
 */

export interface IFranchiseCountry extends Document {
  _id: string;
  id?: string;
  name: string;
  region?: string;
  status?: "available" | "taken" | "resale" | "auction" | string;
  ownerEmail?: string | null;
  territoryIds?: string[];
}

const FranchiseCountrySchema = new Schema<IFranchiseCountry>(
  {
    _id: { type: String },
    id: String,
    name: { type: String, index: true },
    region: String,
    status: { type: String, index: true },
    ownerEmail: String,
    territoryIds: [String],
  },
  {
    collection: "franchise_countries",
    strict: false,
    timestamps: false,
    _id: false,
  }
);

FranchiseCountrySchema.index({ name: 1, status: 1 });

export const FranchiseCountry = model<IFranchiseCountry>(
  "FranchiseCountry",
  FranchiseCountrySchema
);
