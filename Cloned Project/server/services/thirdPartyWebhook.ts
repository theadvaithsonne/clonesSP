import crypto from "crypto";
import axios from "axios";
import { Invoice } from "../models/invoice.model";
import { IThirdPartyClient } from "../models/thirdPartyClient.model";
import { addMonthsClamped } from "../utils/dateMath";

export type WebhookEvent = "invoice.paid" | "invoice.cancelled" | "invoice.failed";

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000];

/**
 * Internal bookkeeping that must never reach the partner.
 *
 * `invoice.metadata` is forwarded verbatim in the payload, so anything we stash
 * there for our own use leaks. These four are subscription-level state and
 * failure diagnostics that mean nothing outside Garage.
 */
const INTERNAL_METADATA_KEYS = [
  "pendingTermMonths",
  "termHistory",
  "lastTermChange",
  "commissionPartial",
] as const;

function redactInternalKeys(metadata: any): any {
  if (!metadata || typeof metadata !== "object") return metadata;
  const src = metadata?.toObject?.() ?? metadata;
  const out: Record<string, any> = { ...src };
  for (const k of INTERNAL_METADATA_KEYS) delete out[k];
  return out;
}

export function signWebhookPayload(
  secret: string,
  timestamp: string,
  body: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

/**
 * Deliver a webhook to the third-party client.
 * Retries up to 3 times with backoff (5s, 30s, 120s). Retries are in-process via
 * setTimeout — they are LOST across restarts. For durable delivery, move to a queue.
 */
export async function deliverInvoiceWebhook(
  invoice: any,
  client: IThirdPartyClient,
  event: WebhookEvent
): Promise<void> {
  if (!client.webhookUrl) {
    // Loud failure: a missing webhookUrl is almost always misconfiguration
    // (we hit this with NetworkChain — paid invoices silently failed to
    // notify NC for weeks because nobody noticed `attempts: 0` and a
    // stdout log line). Record the skip on the invoice itself so future
    // investigation by ops doesn't conclude "the dispatcher never ran."
    // Stamping `lastStatus: 0` (HTTP-like sentinel) + a descriptive
    // `lastError` is enough to grep over.
    console.error(
      `[ThirdPartyWebhook] MISCONFIG: client "${client.name}" (${client._id}) has no webhookUrl — ${event} for ${invoice.invoiceNumber} not delivered. Set webhookUrl on the ThirdPartyClient doc.`,
    );
    try {
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            "webhookDelivery.lastAttemptAt": new Date(),
            "webhookDelivery.lastStatus": 0,
            "webhookDelivery.lastError": `missing_webhook_url:${client.name}`,
          },
        },
      );
    } catch {
      /* writing the diagnostic shouldn't break callers */
    }
    return;
  }

  const md = (invoice.metadata as any) || {};
  const isTopUp = md.kind === "topup";

  // Term/period block. Additive — a partner that ignores unknown fields keeps
  // working exactly as before. But note that WITHOUT reading `termMonths` a
  // partner will advance their own period by one month for a payment covering
  // up to twelve, so multi-month terms must stay gated behind
  // productConfig.termPlans[].isActive until they confirm they honour it.
  const termMonths = isTopUp
    ? undefined
    : Number(md.termMonths) ||
      invoice.recurringIntervalMonths ||
      (invoice.recurringPeriod === "quarterly"
        ? 3
        : invoice.recurringPeriod === "yearly"
          ? 12
          : 1);

  const periodStart =
    isTopUp || !termMonths
      ? undefined
      : invoice.paidAt || (md.periodStart ? new Date(md.periodStart) : new Date());
  const periodEnd =
    periodStart && termMonths
      ? addMonthsClamped(periodStart, termMonths)
      : undefined;

  const payload = {
    event,
    invoiceId: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    amount: invoice.totalAmount,
    currency: invoice.itemCurrency,
    customerEmail: invoice.customerEmail,
    paidAt: invoice.paidAt,
    thirdPartyExternalId: invoice.thirdPartyExternalId,
    // ── Term / service period ──
    ...(termMonths ? { termMonths, recurringIntervalMonths: termMonths } : {}),
    ...(periodStart ? { periodStart: periodStart.toISOString() } : {}),
    ...(periodEnd ? { periodEnd: periodEnd.toISOString() } : {}),
    ...(invoice.recurringPaymentNumber
      ? { recurringPaymentNumber: invoice.recurringPaymentNumber }
      : {}),
    metadata: redactInternalKeys(invoice.metadata),
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhookPayload(client.webhookSecret, timestamp, body);

  const attempt = async (attemptNum: number): Promise<boolean> => {
    try {
      const res = await axios.post(client.webhookUrl!, payload, {
        headers: {
          "Content-Type": "application/json",
          "x-gu-signature": signature,
          "x-gu-timestamp": timestamp,
          "x-gu-event": event,
        },
        timeout: 10_000,
        validateStatus: () => true,
      });

      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $inc: { "webhookDelivery.attempts": 1 },
          $set: {
            "webhookDelivery.lastAttemptAt": new Date(),
            "webhookDelivery.lastStatus": res.status,
            ...(res.status >= 200 && res.status < 300
              ? { "webhookDelivery.deliveredAt": new Date() }
              : {}),
          },
        }
      );

      if (res.status >= 200 && res.status < 300) {
        console.log(
          `[ThirdPartyWebhook] Delivered ${event} for ${invoice.invoiceNumber} to ${client.name} (attempt ${attemptNum + 1})`
        );
        return true;
      }

      console.warn(
        `[ThirdPartyWebhook] Non-2xx response (${res.status}) for ${invoice.invoiceNumber} to ${client.name} attempt ${attemptNum + 1}`
      );
      return false;
    } catch (err: any) {
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $inc: { "webhookDelivery.attempts": 1 },
          $set: { "webhookDelivery.lastAttemptAt": new Date() },
        }
      );
      console.error(
        `[ThirdPartyWebhook] Delivery error for ${invoice.invoiceNumber} attempt ${attemptNum + 1}:`,
        err.message
      );
      return false;
    }
  };

  const run = async () => {
    for (let i = 0; i < RETRY_DELAYS_MS.length + 1; i++) {
      const ok = await attempt(i);
      if (ok) return;
      if (i < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
      }
    }
    console.error(
      `[ThirdPartyWebhook] Gave up after ${RETRY_DELAYS_MS.length + 1} attempts for ${invoice.invoiceNumber}`
    );
  };

  // Fire-and-forget
  run().catch((err) =>
    console.error("[ThirdPartyWebhook] Unhandled error:", err)
  );
}
