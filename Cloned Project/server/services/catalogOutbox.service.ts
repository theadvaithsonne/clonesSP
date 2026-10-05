/**
 * Catalog outbox — write-side helpers.
 *
 * Two surfaces:
 *  - `enqueueCatalogChange` — called from Mongoose post-hooks across the 7
 *    sellable / office models. Idempotently upserts a `pending` row keyed by
 *    `(itemType, itemId)` so rapid edits collapse into one delivery.
 *  - `recordCatalogTombstone` — called on delete events to keep a 30-day
 *    durable trail outliving the outbox row's TTL.
 */
import { CatalogOutbox, CatalogOutboxItemType, CatalogOutboxOp } from "../models/catalogOutbox.model";
import { CatalogTombstone } from "../models/catalogTombstone.model";

export async function enqueueCatalogChange(
  itemType: CatalogOutboxItemType,
  itemId: string,
  op: CatalogOutboxOp,
): Promise<void> {
  if (!itemType || !itemId) return;
  try {
    await CatalogOutbox.updateOne(
      { itemType, itemId },
      {
        $set: {
          itemType,
          itemId,
          op,
          status: "pending",
          nextAttemptAt: new Date(),
          attemptCount: 0,
          lastError: null,
          sentAt: null,
        },
      },
      { upsert: true },
    );
    if (op === "delete") {
      await recordCatalogTombstone(itemType, itemId);
    }
  } catch (err: any) {
    // Schema hooks must not crash the originating save; log and move on.
    // The reconciler will catch up on missed events.
    console.error(
      `[catalogOutbox] enqueue failed for ${itemType}/${itemId} (${op}):`,
      err?.message || err,
    );
  }
}

export async function recordCatalogTombstone(
  itemType: CatalogOutboxItemType,
  itemId: string,
  reason?: string,
): Promise<void> {
  try {
    await CatalogTombstone.create({
      itemType,
      itemId,
      deletedAt: new Date(),
      reason,
    });
  } catch (err: any) {
    console.error(
      `[catalogOutbox] tombstone failed for ${itemType}/${itemId}:`,
      err?.message || err,
    );
  }
}
