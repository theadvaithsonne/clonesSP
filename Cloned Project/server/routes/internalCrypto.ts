// Internal endpoints called by garage-crypto-backend. Every handler
// runs behind requireInternalService (X-Internal-Token header + no
// Authorization).
//
// The only endpoint today is the fulfill-paid webhook: crypto backend
// marks an invoice paid when a deposit lands, then posts here so
// main's fulfillInvoice runs (commission distribution, seller USD
// credit, per-itemType fulfillment). Duplicate delivery is safe — the
// Idempotency-Key is recorded on the invoice and a second call with
// the same key returns 409 without re-running fulfilment.

import { Router } from "express";
import { requireInternalService } from "../middleware/internalService";
import { Invoice } from "../models/invoice.model";
import { fulfillInvoice } from "../services/invoice";

const router = Router();
router.use(requireInternalService);

router.post("/invoices/:invoiceId/fulfill-paid", async (req, res) => {
  const { invoiceId } = req.params;
  const idempotencyKey =
    (req.header("idempotency-key") ||
      (req.body && (req.body as any).idempotencyKey)) as string | undefined;
  if (!idempotencyKey) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }
  const invoice: any = await Invoice.findById(invoiceId);
  if (!invoice) return res.status(404).json({ error: "invoice_not_found" });

  const meta = (invoice.metadata || {}) as Record<string, any>;
  const keys: string[] = Array.isArray(meta.cryptoFulfillmentKeys)
    ? meta.cryptoFulfillmentKeys
    : [];
  if (keys.includes(idempotencyKey)) {
    return res.status(409).json({
      invoiceId,
      status: invoice.status,
      duplicate: true,
    });
  }

  // Record the key BEFORE fulfilment runs so a crash after fulfilment
  // still short-circuits the retry — fulfillInvoice is idempotent
  // internally but each pass has real side effects (emails, hooks).
  invoice.metadata = { ...meta, cryptoFulfillmentKeys: [...keys, idempotencyKey] };
  await invoice.save();

  try {
    await fulfillInvoice(invoice, `crypto_${idempotencyKey}`);
  } catch (err) {
    console.error(
      `[internal/fulfill-paid] fulfillInvoice failed for invoice ${invoiceId}:`,
      err,
    );
    // Roll the key back so the outbox retry runs fulfilment cleanly.
    await Invoice.updateOne(
      { _id: invoiceId },
      { $pull: { "metadata.cryptoFulfillmentKeys": idempotencyKey } },
    );
    return res.status(500).json({
      error: "fulfill_failed",
      message: (err as Error).message,
    });
  }

  res.json({ invoiceId, status: invoice.status });
});

export default router;
