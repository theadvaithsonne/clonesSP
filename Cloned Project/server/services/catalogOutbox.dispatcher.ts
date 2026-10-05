/**
 * Catalog outbox dispatcher.
 *
 * Drains pending CatalogOutbox rows, signs each as a webhook payload, POSTs
 * to NetworkChainApi, and either marks `sent` or schedules an exponential
 * retry. Started once from `src/index.ts` after the Mongo connection is up.
 *
 * Design decisions:
 *  - Single-process. If multiple roam-backend instances run, each polls
 *    independently; the `findOneAndUpdate` to `in_flight` race-protects
 *    against double-delivery.
 *  - Batch size of 50 per tick caps per-tick latency; webhook receiver is
 *    cheap (idempotency Redis SETNX + Celery enqueue).
 *  - We carry IDs only in the payload — NC re-fetches the latest doc. This
 *    eliminates "old payload overwrites new" races and survives schema drift.
 *  - HMAC: same `signWebhookPayload` contract as `thirdPartyWebhook.ts`,
 *    different headers (`x-gu-catalog-*`) so middleware can tell them apart.
 */
import axios from "axios";
import crypto from "crypto";

import { env } from "../config/env";
import {
  CatalogOutbox,
  CatalogOutboxItemType,
} from "../models/catalogOutbox.model";

const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 12;

// Backoff ladder: 30s, 60s, 2m, 5m, 10m, 20m, 40m, then capped at 1h
const BACKOFF_LADDER_MS = [
  30_000, 60_000, 120_000, 300_000, 600_000, 1_200_000, 2_400_000, 3_600_000,
  3_600_000, 3_600_000, 3_600_000, 3_600_000,
];

interface WebhookEvent {
  itemType: CatalogOutboxItemType;
  itemId: string;
  op: "upsert" | "delete";
  updatedAt?: string;
}

let _started = false;
let _timer: NodeJS.Timeout | null = null;
let _draining = false;

function _signature(secret: string, timestamp: string, body: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

function _backoffMs(attemptCount: number): number {
  const idx = Math.min(attemptCount, BACKOFF_LADDER_MS.length - 1);
  // Add jitter: ±20%.
  const base = BACKOFF_LADDER_MS[idx] ?? 60_000;
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(1_000, Math.round(base + jitter));
}

async function _deliverOne(row: any): Promise<void> {
  const event: WebhookEvent = {
    itemType: row.itemType,
    itemId: row.itemId,
    op: row.op,
    updatedAt: new Date().toISOString(),
  };
  const ts = Math.floor(Date.now() / 1000).toString();
  const payload = {
    id: String(row._id),
    ts: Number(ts),
    events: [event],
  };
  const body = JSON.stringify(payload);
  const sig = _signature(env.OPENCLAW_GARAGE_WEBHOOK_SECRET, ts, body);

  const url = `${env.OPENCLAW_NC_URL.replace(/\/$/, "")}/api/internal/catalog-webhook`;

  const res = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-gu-catalog-signature": sig,
      "x-gu-catalog-timestamp": ts,
      "x-gu-event": "catalog.changed",
    },
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: () => true,
  });

  if (res.status >= 200 && res.status < 300) {
    await CatalogOutbox.updateOne(
      { _id: row._id },
      { $set: { status: "sent", sentAt: new Date(), lastError: null } },
    );
    return;
  }

  // Non-2xx → retry / dead
  const nextAttempt = (row.attemptCount ?? 0) + 1;
  if (nextAttempt >= MAX_ATTEMPTS) {
    await CatalogOutbox.updateOne(
      { _id: row._id },
      {
        $set: {
          status: "dead",
          attemptCount: nextAttempt,
          lastError: `HTTP ${res.status}: ${
            typeof res.data === "string"
              ? res.data.slice(0, 200)
              : JSON.stringify(res.data).slice(0, 200)
          }`,
        },
      },
    );
    console.error(
      `[catalog-dispatcher] dead after ${nextAttempt} attempts: ${row.itemType}/${row.itemId}`,
    );
    return;
  }
  await CatalogOutbox.updateOne(
    { _id: row._id },
    {
      $set: {
        status: "pending",
        attemptCount: nextAttempt,
        nextAttemptAt: new Date(Date.now() + _backoffMs(nextAttempt)),
        lastError: `HTTP ${res.status}`,
      },
    },
  );
}

async function _drainOnce(): Promise<number> {
  if (_draining) return 0;
  _draining = true;
  let processed = 0;
  try {
    if (
      env.CATALOG_OUTBOX_DISPATCH_DISABLED ||
      !env.OPENCLAW_GARAGE_WEBHOOK_SECRET ||
      !env.OPENCLAW_NC_URL
    ) {
      return 0;
    }

    for (let i = 0; i < BATCH_SIZE; i++) {
      const row = await CatalogOutbox.findOneAndUpdate(
        {
          status: "pending",
          nextAttemptAt: { $lte: new Date() },
        },
        { $set: { status: "in_flight" } },
        { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
      ).lean();

      if (!row) break;

      try {
        await _deliverOne(row);
        processed++;
      } catch (err: any) {
        const msg = err?.message || String(err);
        const nextAttempt = (row.attemptCount ?? 0) + 1;
        if (nextAttempt >= MAX_ATTEMPTS) {
          await CatalogOutbox.updateOne(
            { _id: row._id },
            {
              $set: {
                status: "dead",
                attemptCount: nextAttempt,
                lastError: msg.slice(0, 300),
              },
            },
          );
          console.error(
            `[catalog-dispatcher] dead (network) after ${nextAttempt}: ${row.itemType}/${row.itemId}`,
          );
        } else {
          await CatalogOutbox.updateOne(
            { _id: row._id },
            {
              $set: {
                status: "pending",
                attemptCount: nextAttempt,
                nextAttemptAt: new Date(Date.now() + _backoffMs(nextAttempt)),
                lastError: msg.slice(0, 300),
              },
            },
          );
        }
      }
    }
  } catch (err: any) {
    console.error("[catalog-dispatcher] drain error:", err?.message || err);
  } finally {
    _draining = false;
  }
  return processed;
}

export function startCatalogDispatcher(): void {
  if (_started) return;
  _started = true;

  if (env.CATALOG_OUTBOX_DISPATCH_DISABLED) {
    console.log("[catalog-dispatcher] disabled via env");
    return;
  }

  console.log("[catalog-dispatcher] started — interval 2s, batch 50");
  _timer = setInterval(() => {
    _drainOnce().catch((err) =>
      console.error("[catalog-dispatcher] tick error:", err),
    );
  }, POLL_INTERVAL_MS);
  // Don't keep the event loop alive solely for this timer.
  if (_timer.unref) _timer.unref();
}

export function stopCatalogDispatcher(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _started = false;
}
