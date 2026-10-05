import mongoose, { Schema, Document } from "mongoose";

/**
 * Durable record of catalog deletes.
 *
 * The outbox row for a delete event eventually expires (24h sent-TTL or
 * `dead` after 12 retries). The tombstone trail outlives that window so the
 * hourly NC reconciler can replay deletes that were lost during a webhook
 * outage. TTL is 30 days — well past any reasonable reconciler-recovery
 * window and bounded enough to keep the collection small.
 */
export type CatalogTombstoneItemType =
  | "product"
  | "storeproduct"
  | "course"
  | "workshop"
  | "channel"
  | "service"
  | "call"
  | "office";

export interface ICatalogTombstone extends Document {
  itemType: CatalogTombstoneItemType;
  itemId: string;
  deletedAt: Date;
  reason?: string;
}

const CatalogTombstoneSchema = new Schema<ICatalogTombstone>(
  {
    itemType: {
      type: String,
      required: true,
      enum: [
        "product",
        "storeproduct",
        "course",
        "workshop",
        "channel",
        "service",
        "call",
        "office",
      ],
    },
    itemId: { type: String, required: true },
    deletedAt: { type: Date, default: () => new Date() },
    reason: { type: String },
  },
  { timestamps: true },
);

CatalogTombstoneSchema.index(
  { itemType: 1, itemId: 1, deletedAt: -1 },
  { name: "catalog_tombstone_item_recent" },
);

CatalogTombstoneSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 30,
    name: "catalog_tombstone_ttl_30d",
  },
);

export const CatalogTombstone = mongoose.model<ICatalogTombstone>(
  "CatalogTombstone",
  CatalogTombstoneSchema,
);
