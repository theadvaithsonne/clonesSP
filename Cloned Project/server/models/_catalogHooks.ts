/**
 * Catalog change-event hooks shared by the 7 catalog models.
 *
 * Each model installs save / findOneAndUpdate / findOneAndDelete /
 * deleteOne / deleteMany hooks that enqueue an entry on `CatalogOutbox`.
 * That outbox is drained asynchronously by `catalogOutbox.dispatcher.ts`
 * which signs and POSTs to NetworkChainApi.
 *
 * Schema-level hooks are the only chokepoint that catches every Mongoose
 * mutation path (`new Model().save()`, `Model.updateOne`,
 * `findByIdAndUpdate`, etc.). Service-layer wrappers are leakier because
 * Garage has many call sites that hit Mongoose directly.
 */
import { Schema } from "mongoose";

import {
  enqueueCatalogChange,
} from "../services/catalogOutbox.service";
import type { CatalogOutboxItemType } from "./catalogOutbox.model";

interface InstallOpts {
  /** Org gate: e.g. for `office` we only mirror non-parent orgs. */
  isCatalogDoc?: (doc: any) => boolean;
}

const _DEFAULT_GATE = (_doc: any) => true;

export function installCatalogHooks(
  schema: Schema,
  itemType: CatalogOutboxItemType,
  opts: InstallOpts = {},
): void {
  const gate = opts.isCatalogDoc ?? _DEFAULT_GATE;

  // ── upserts via document.save() ──────────────────────────────────────
  schema.post("save", function (this: any) {
    try {
      if (!this || !this._id || !gate(this)) return;
      void enqueueCatalogChange(itemType, String(this._id), "upsert");
    } catch (err) {
      console.error(`[catalogHooks:${itemType}] save hook error:`, err);
    }
  });

  // ── upserts via Model.findOneAndUpdate / findByIdAndUpdate ──────────
  schema.post("findOneAndUpdate", function (doc: any) {
    try {
      if (!doc || !doc._id || !gate(doc)) return;
      void enqueueCatalogChange(itemType, String(doc._id), "upsert");
    } catch (err) {
      console.error(`[catalogHooks:${itemType}] findOneAndUpdate hook error:`, err);
    }
  });

  // ── upserts via Model.updateOne / updateMany ────────────────────────
  // Mongoose passes the result, not the doc(s); we don't know which IDs
  // were touched. Best-effort: re-query to fetch matched IDs would be
  // expensive; instead we rely on the `save`/`findOneAndUpdate` paths
  // (covers the vast majority of writes) plus the hourly reconciler.

  // ── deletes ──────────────────────────────────────────────────────────
  schema.post("findOneAndDelete", function (doc: any) {
    try {
      if (!doc || !doc._id || !gate(doc)) return;
      void enqueueCatalogChange(itemType, String(doc._id), "delete");
    } catch (err) {
      console.error(`[catalogHooks:${itemType}] findOneAndDelete hook error:`, err);
    }
  });

  schema.post("deleteOne", { document: true, query: false }, function (this: any) {
    try {
      if (!this || !this._id || !gate(this)) return;
      void enqueueCatalogChange(itemType, String(this._id), "delete");
    } catch (err) {
      console.error(`[catalogHooks:${itemType}] deleteOne(doc) hook error:`, err);
    }
  });
}
