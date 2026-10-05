import { Schema, model, Document, Types } from "mongoose";

/**
 * Read-only mirror of the `stores` collection owned by the storefront backend.
 * One store per organization (the orgId is unique-ish in practice). Currency
 * here is the *display/native* currency for all products in the store.
 */

export interface IStoreBranding {
  heroImages?: string[];
  accentColor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  bannerImage?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
}

export interface IStore extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  slug?: string;
  currency: string;
  timezone?: string;
  isActive?: boolean;
  /**
   * How the store operates, owned by the storefront backend:
   *   "online"  — pure e-commerce
   *   "offline" — brick-and-mortar with POS + local delivery
   *
   * ⚠️ OPTIONAL BY DESIGN. Most stores predate the field and have it absent
   * entirely; they are online. Always test `=== "offline"`, never
   * `!== "online"`, or every legacy store is misclassified.
   */
  storeKind?: "online" | "offline";
  branding?: IStoreBranding;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<IStore>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    slug: String,
    currency: { type: String, required: true },
    timezone: String,
    isActive: Boolean,
    // Declared (rather than relying on `strict: false`) so consumers get it
    // typed. No default here — this is a read-only mirror and the storefront
    // backend owns the value; inventing one would mask absent data.
    storeKind: { type: String, enum: ["online", "offline"] },
    branding: { type: Schema.Types.Mixed },
  },
  {
    collection: "stores",
    strict: false,
    timestamps: true,
  }
);

export const Store = model<IStore>("Store", StoreSchema);
