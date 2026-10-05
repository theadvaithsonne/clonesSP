import { Schema, model, Document, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";

/**
 * Read-only mirror of the `storeproducts` collection owned by the storefront
 * backend. We only consume fields needed at checkout — additional storefront
 * fields are passed through via { strict: false }.
 *
 * Price is stored in MAIN UNITS (e.g. 29.99 USD), not the smallest-unit cents
 * convention used by the existing Invoice model. Conversion to smallest unit
 * happens at invoice line-item construction time.
 */

export interface IStoreProductImage {
  url: string;
  altText?: string;
  position?: number;
}

export interface IStoreProduct extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  title: string;
  slug?: string;
  description?: string;
  vendor?: string;
  productType?: string;
  status: "active" | "archived" | "draft";
  tags?: string[];
  price: number;
  compareAtPrice?: number;
  sku?: string;
  trackInventory?: boolean;
  quantity?: number;
  requiresShipping?: boolean;
  isPhysicalProduct?: boolean;
  hasVariants?: boolean;
  images?: IStoreProductImage[];
  featuredImage?: string;
  category?: Types.ObjectId;
  publishedAt?: Date;
  // Tax fields owned by the storefront backend (garage-store-backend). Both
  // are declared here so ecommerce checkout can type them; the data already
  // flowed through via `{ strict: false }`.
  //   gstInclusive: true  → listed price already contains GST; extract it.
  //   gstInclusive: false → listed price is pre-tax; add GST on top.
  //   taxable: false      → never tax this product, whatever the buyer's region.
  gstInclusive?: boolean;
  taxable?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoreProductImageSchema = new Schema<IStoreProductImage>(
  {
    url: { type: String, required: true },
    altText: String,
    position: Number,
  },
  { _id: false, strict: false },
);

const StoreProductSchema = new Schema<IStoreProduct>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    slug: String,
    description: String,
    vendor: String,
    productType: String,
    status: { type: String, default: "active" },
    tags: [String],
    price: { type: Number, required: true },
    compareAtPrice: Number,
    sku: String,
    trackInventory: Boolean,
    quantity: Number,
    requiresShipping: Boolean,
    isPhysicalProduct: Boolean,
    hasVariants: Boolean,
    images: [StoreProductImageSchema],
    featuredImage: String,
    category: Schema.Types.ObjectId,
    publishedAt: Date,
    // Defaults intentionally omitted — this is a read-only mirror, so the
    // storefront backend's own defaults are the source of truth. Reading an
    // absent gstInclusive as falsy (= exclusive) matches how the sellable
    // item flows treat legacy documents.
    gstInclusive: Boolean,
    taxable: Boolean,
  },
  {
    collection: "storeproducts",
    strict: false,
    timestamps: true,
  },
);

// Store products are authored in an external storefront backend and mirrored
// here, so most mutations DON'T pass through Mongoose (the storefront calls
// POST /internal/catalog/notify to drive the outbox). These hooks only catch
// roam-backend's own writes (e.g. the inventory decrement on purchase) so even
// those propagate to the EarnGPT catalog index.
installCatalogHooks(StoreProductSchema, "storeproduct");

export const StoreProduct = model<IStoreProduct>(
  "StoreProduct",
  StoreProductSchema,
);
