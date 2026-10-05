import { Schema, model, Document, Types } from "mongoose";

/**
 * Mirror of the `productvariants` collection owned by the storefront backend.
 * A variant product's real price and stock live here — one doc per variant,
 * keyed to its parent via `productId` (→ storeproducts._id). The parent
 * StoreProduct.price / .quantity for a variant product are NOT kept in sync
 * with its variants (the parent quantity is just the default seeded onto new
 * variant rows), so checkout MUST read the variant when a line item carries a
 * variantId. Mostly read-only here; the one write is the inventory decrement
 * on purchase (invoice fulfillment), mirroring how StoreProduct is written for
 * the parent. We only consume the fields needed at checkout; everything else
 * passes through via { strict: false }.
 *
 * Price is in MAIN UNITS (e.g. 0.10 USD), same convention as StoreProduct.
 */

export interface IProductVariant extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  orgId?: Types.ObjectId;
  title?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  trackInventory?: boolean;
  quantity?: number;
  image?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    productId: { type: Schema.Types.ObjectId, required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, index: true },
    title: String,
    sku: String,
    price: { type: Number, required: true },
    compareAtPrice: Number,
    trackInventory: Boolean,
    quantity: Number,
    image: String,
    isActive: Boolean,
  },
  {
    collection: "productvariants",
    strict: false,
    timestamps: true,
  },
);

export const ProductVariant = model<IProductVariant>(
  "ProductVariant",
  ProductVariantSchema,
);
