import { Schema, model, Types } from "mongoose";

/**
 * READ-ONLY mirror of the `storedrops` collection owned by the garage-store
 * backend (the NetworkChain "Drop" short-video feature). garagenew and the
 * store backend share the same Mongo database (`roam-admin-prod`), so we can
 * read this collection directly instead of a cross-service HTTP call.
 *
 * We only declare the fields we need to authoritatively resolve a drop-driven
 * sale's creator at invoice fulfillment (`authorId`) and to validate the drop
 * (`status`, `productId`). This model must never write to the collection — the
 * store backend is the sole owner. Collection name is pinned to `storedrops`
 * to match that owner exactly.
 *
 * NOTE: the auth backend's own `drops` collection is an UNRELATED video
 * feature — do not point this at `drops`.
 */
export interface IStoreDrop {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName?: string;
  productId: Types.ObjectId;
  status: "published" | "removed";
}

const StoreDropSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId },
    authorName: { type: String },
    productId: { type: Schema.Types.ObjectId },
    status: { type: String },
  },
  { collection: "storedrops", strict: false }
);

export const StoreDrop = model<IStoreDrop>("StoreDrop", StoreDropSchema);
