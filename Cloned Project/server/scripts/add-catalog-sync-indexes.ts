/**
 * One-time migration: add compound (status|isActive, updatedAt, _id) indexes
 * to each of the 7 sellable + office collections so the new
 * `/internal/catalog/items` cursor pagination is index-supported.
 *
 * Run once per environment:
 *     npx ts-node src/scripts/add-catalog-sync-indexes.ts
 *
 * Safe to re-run — `createIndex` is idempotent.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import { Product } from "../models/product.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Channel } from "../models/channel.model";
import { Service } from "../models/service.model";
import { CallOffering } from "../models/callOffering.model";
import { Organization } from "../models/organization.model";

dotenv.config();

interface Spec {
  name: string;
  collection: any;
  index: Record<string, 1 | -1>;
}

const INDEXES: Spec[] = [
  // status-enum models
  {
    name: "Product",
    collection: Product,
    index: { status: 1, updatedAt: 1, _id: 1 },
  },
  {
    name: "Course",
    collection: Course,
    index: { status: 1, updatedAt: 1, _id: 1 },
  },
  {
    name: "Service",
    collection: Service,
    index: { status: 1, updatedAt: 1, _id: 1 },
  },
  {
    name: "CallOffering",
    collection: CallOffering,
    index: { status: 1, updatedAt: 1, _id: 1 },
  },
  // isActive-bool models
  {
    name: "Workshop",
    collection: Workshop,
    index: { isActive: 1, updatedAt: 1, _id: 1 },
  },
  {
    name: "Channel",
    collection: Channel,
    index: { isActive: 1, updatedAt: 1, _id: 1 },
  },
  // Organization (offices = parent != true)
  {
    name: "Organization",
    collection: Organization,
    index: { parent: 1, updatedAt: 1, _id: 1 },
  },
];

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }

  console.log("→ Connecting to MongoDB…");
  await mongoose.connect(uri);
  console.log("✓ connected\n");

  for (const spec of INDEXES) {
    const indexName = `catalog_sync_${Object.keys(spec.index).join("_")}`;
    try {
      await spec.collection.collection.createIndex(spec.index, {
        name: indexName,
        background: true,
      });
      console.log(`✓ ${spec.name}: ${indexName} ${JSON.stringify(spec.index)}`);
    } catch (err: any) {
      console.error(`✗ ${spec.name}: ${err?.message || err}`);
    }
  }

  await mongoose.disconnect();
  console.log("\n✓ done");
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
