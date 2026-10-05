import { Router, Request, Response } from "express";
import { verifyIpnSignature } from "../services/nowpayments";
import { Invoice } from "../models/invoice.model";
import { fulfillInvoice } from "../services/invoice";
import { User } from "../models/user.model";
import { Product } from "../models/product.model";
import {
  createBoardFromPurchase,
  addAtBatFromPurchase,
  addFromUpperBaseInvite,
  addToDugoutFromPurchase,
  addFromGenericInvite,
} from "../bat246/services/bat246Entry.service";

const router = Router();

/**
 * POST /webhooks/nowpayments
 * IPN (Instant Payment Notification) callback from NOWPayments.
 * Called when crypto payment status changes.
 *
 * NOTE: This route uses express.raw() middleware (mounted in app.ts),
 * so req.body is a Buffer — we must parse it to JSON ourselves AFTER
 * signature verification.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-nowpayments-sig"] as string;

    if (!signature) {
      console.warn("[NOWPayments Webhook] Missing signature header");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Parse the raw body buffer to JSON
    let body: any;
    try {
      const rawString = Buffer.isBuffer(req.body)
        ? req.body.toString("utf-8")
        : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);
      body = JSON.parse(rawString);
    } catch (parseErr) {
      console.warn("[NOWPayments Webhook] Invalid JSON body:", parseErr);
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // Verify IPN signature against the parsed object
    const isValid = verifyIpnSignature(body, signature);
    if (!isValid) {
      console.warn("[NOWPayments Webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    console.log(`[NOWPayments Webhook] Verified signature for payment ${body.payment_id || "?"}`);

    const {
      payment_id,
      payment_status,
      order_id,
      price_amount,
      price_currency,
      pay_amount,
      pay_currency,
      actually_paid,
    } = body;

    console.log(
      `[NOWPayments Webhook] Payment #${payment_id} status: ${payment_status} for invoice ${order_id}`
    );

    // Find the invoice by order_id (which is our invoice ID)
    if (!order_id) {
      return res.status(200).json({ ok: true }); // Ignore if no order_id
    }

    const invoice = await Invoice.findById(order_id);
    if (!invoice) {
      console.warn(`[NOWPayments Webhook] Invoice not found: ${order_id}`);
      return res.status(200).json({ ok: true });
    }

    // Handle payment status
    switch (payment_status) {
      case "finished":
      case "confirmed": {
        // Payment completed — mark invoice as paid and fulfill
        if (invoice.status === "paid") {
          // Already processed
          return res.status(200).json({ ok: true, message: "Already paid" });
        }

        invoice.status = "paid";
        invoice.paidAt = new Date();
        invoice.paymentMethodCategory = "crypto";
        invoice.paymentPlatform = "crypto_wallet";
        invoice.metadata = {
          ...invoice.metadata,
          nowpaymentsPaymentId: payment_id,
          cryptoCurrency: pay_currency,
          cryptoAmount: pay_amount,
          cryptoActuallyPaid: actually_paid,
          fiatAmount: price_amount,
          fiatCurrency: price_currency,
        };
        await invoice.save();

        // Fulfill the invoice (create order, enroll in course, etc.)
        try {
          await fulfillInvoice(invoice, `nowpayments_${payment_id}`);
          console.log(
            `[NOWPayments Webhook] Invoice ${invoice.invoiceNumber} fulfilled successfully`
          );
        } catch (fulfillErr) {
          console.error(
            `[NOWPayments Webhook] Fulfillment error for ${invoice.invoiceNumber}:`,
            fulfillErr
          );
        }

        // ── Bat246 board placement ────────────────────────────────────────────
        if (invoice.metadata?.type === "product_checkout") {
          try {
            const invoiceProductId = invoice.lineItems?.[0]?.itemId?.toString();
            if (invoiceProductId) {
              const invoiceProduct = await Product.findById(invoiceProductId).select("tags").lean() as any;
              const productTags: string[] = invoiceProduct?.tags ?? [];
              if (productTags.includes("bat246_entry")) {
                const bat246BoardId: string | undefined = invoice.metadata?.bat246BoardId;
                const bat246Pos: string | undefined = invoice.metadata?.bat246Pos;
                const bat246UpperRef: string | undefined = invoice.metadata?.bat246UpperRef;
                const bat246UpperRefPlayerId: string | undefined = invoice.metadata?.bat246UpperRefPlayerId;
                const bat246DugoutRef: string | undefined = invoice.metadata?.bat246DugoutRef;
                const bat246GenRef: string | undefined = invoice.metadata?.bat246GenRef;
                const userId = invoice.userId.toString();
                const invoiceUser = await User.findById(userId).select("name email country").lean() as any;
                const saleAmt = (invoice.totalAmount ?? 0) / 100;
                if (bat246BoardId && bat246Pos) {
                  await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
                } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
                  await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId: bat246UpperRefPlayerId, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
                } else if (bat246BoardId && bat246GenRef) {
                  await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
                } else if (bat246BoardId && bat246DugoutRef) {
                  await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId, userName: invoiceUser?.name || "", userEmail: invoiceUser?.email || "", productId: invoiceProductId, saleAmount: saleAmt, countryResidence: invoiceUser?.country ?? undefined });
                } else {
                  console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
                }
              }
            }
          } catch (bat246Err: any) {
            console.error("[bat246] nowpayments placement failed:", bat246Err.message);
          }
        }

        break;
      }

      case "partially_paid": {
        // User sent some but not enough
        invoice.metadata = {
          ...invoice.metadata,
          nowpaymentsPaymentId: payment_id,
          partiallyPaid: true,
          actuallyPaid: actually_paid,
          expectedAmount: pay_amount,
        };
        await invoice.save();
        console.log(
          `[NOWPayments Webhook] Invoice ${invoice.invoiceNumber} partially paid: ${actually_paid}/${pay_amount} ${pay_currency}`
        );
        break;
      }

      case "failed":
      case "expired": {
        if (invoice.status === "paid") {
          break; // Don't override a paid invoice
        }
        invoice.status = "failed";
        invoice.failedAt = new Date();
        invoice.errorDescription = `Crypto payment ${payment_status}`;
        invoice.metadata = {
          ...invoice.metadata,
          nowpaymentsPaymentId: payment_id,
          failureReason: payment_status,
        };
        await invoice.save();
        console.log(
          `[NOWPayments Webhook] Invoice ${invoice.invoiceNumber} marked as ${payment_status}`
        );
        break;
      }

      case "refunded": {
        invoice.status = "refunded";
        invoice.refundedAt = new Date();
        invoice.metadata = {
          ...invoice.metadata,
          nowpaymentsPaymentId: payment_id,
        };
        await invoice.save();
        break;
      }

      default:
        // waiting, confirming, sending — intermediate states, just log
        console.log(
          `[NOWPayments Webhook] Invoice ${invoice.invoiceNumber} intermediate status: ${payment_status}`
        );
        break;
    }

    res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("[NOWPayments Webhook] Error:", error);
    res.status(200).json({ ok: true }); // Always return 200 to prevent retries
  }
});

export default router;
