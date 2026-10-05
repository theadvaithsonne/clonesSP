import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  requireThirdPartyApiKey,
  requireScope,
} from "../middleware/thirdPartyAuth";
import {
  createThirdPartyInvoice,
  listThirdPartyInvoices,
  getThirdPartyInvoice,
  cancelThirdPartyInvoice,
  getThirdPartyInvoiceReceipt,
  listCustomerInvoices,
  retryInvoiceWebhook,
  ThirdPartyError,
} from "../services/thirdPartyInvoice";
import { IThirdPartyClient } from "../models/thirdPartyClient.model";
import {
  listActiveTermPlans,
  defaultTermMonths,
  changeSubscriptionTerm,
  listSubscriptionsForUser,
} from "../services/thirdPartyTerms";

const router = Router();

router.use(requireThirdPartyApiKey);

function getClient(req: Request): IThirdPartyClient {
  return (req as any).thirdPartyClient as IThirdPartyClient;
}

function handleError(res: Response, err: any) {
  if (err instanceof ThirdPartyError) {
    return res
      .status(err.statusCode)
      .json({ error: err.message, code: err.code });
  }
  console.error("[ThirdPartyInvoice] Unhandled error:", err);
  return res.status(500).json({ error: "Internal error", code: "INTERNAL_ERROR" });
}

// ============ Term catalog ============

/**
 * GET /terms — the sellable subscription terms for this client's product.
 *
 * `savingsPercent` is 0 while pricing is a flat monthly rate × months, but it's
 * present from day one so the partner's UI needs no redeploy if a discounted
 * term is introduced later.
 */
router.get("/terms", requireScope("invoices:read"), async (req, res) => {
  try {
    const client = getClient(req);
    if (!client.productConfig) {
      throw new ThirdPartyError(
        "CLIENT_NOT_INVOICE_ENABLED",
        "This API key is not configured for invoice operations",
        403
      );
    }
    const pc = client.productConfig;
    const monthly = pc.totalAmount;

    return res.json({
      productCode: pc.productCode,
      currency: "USD",
      defaultTermMonths: defaultTermMonths(pc),
      terms: listActiveTermPlans(pc).map((t) => {
        const monthlyEquivalent = Math.round((t.totalAmount / t.termMonths) * 100) / 100;
        return {
          termMonths: t.termMonths,
          label: t.label || `${t.termMonths} month${t.termMonths > 1 ? "s" : ""}`,
          totalAmount: t.totalAmount,
          totalAmountCents: Math.round(t.totalAmount * 100),
          monthlyEquivalent,
          savingsPercent:
            monthly > 0
              ? Math.round((1 - monthlyEquivalent / monthly) * 1000) / 10
              : 0,
          isActive: true,
        };
      }),
    });
  } catch (err) {
    return handleError(res, err);
  }
});

// ============ Subscriptions / term changes ============

router.get(
  "/customers/:email/subscriptions",
  requireScope("invoices:read"),
  async (req, res) => {
    try {
      const client = getClient(req);
      const { User } = await import("../models/user.model");
      const user = await User.findOne({
        email: req.params.email.trim().toLowerCase(),
      })
        .select("_id")
        .lean();
      if (!user) {
        throw new ThirdPartyError(
          "CUSTOMER_NOT_FOUND",
          `No user exists for email ${req.params.email}`,
          404
        );
      }
      const subscriptions = await listSubscriptionsForUser(
        user._id.toString(),
        client._id.toString()
      );
      return res.json({ subscriptions });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

const partnerTermSchema = z.object({
  termMonths: z.number().int().min(1).max(60),
});

router.patch(
  "/subscriptions/:parentInvoiceId/term",
  requireScope("invoices:write"),
  async (req, res) => {
    try {
      const parsed = partnerTermSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request body",
          code: "INVALID_INPUT",
          details: parsed.error.issues,
        });
      }
      const client = getClient(req);
      const result = await changeSubscriptionTerm({
        parentInvoiceId: req.params.parentInvoiceId,
        termMonths: parsed.data.termMonths,
        actor: { kind: "partner", clientId: client._id.toString() },
      });
      return res.json(result);
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Create invoice ============

const createSchema = z.object({
  customerEmail: z.string().email(),
  productCode: z.string().optional(),
  externalId: z.string().max(128).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  couponCode: z.string().min(3).max(20).optional(),
  // Top-up mode: one-off wallet credit, caller-specified amount, no recurring,
  // no coupon. Requires client.productConfig.allowsTopUp=true.
  mode: z.enum(["subscription", "topup"]).optional(),
  // Minor units of `currency` — cents for USD, paise for INR.
  //
  // The ceiling is 10,000,000 rather than 1,000,000: the old cap was written
  // when every invoice was dollars, where it meant $10,000. In paise it meant
  // ₹10,000, which rejected any booking above that with a bare INVALID_INPUT.
  amountCents: z.number().int().min(100).max(10_000_000).optional(),
  // ISO-4217, top-up only. Defaults to USD, so every existing client is
  // unaffected. Validated against SUPPORTED_TOPUP_CURRENCIES in the service.
  currency: z.string().length(3).optional(),
  // Multi-month term. The VALUE is validated in the service (not here) so the
  // error carries INVALID_TERM plus the list of terms this product offers.
  termMonths: z.number().int().min(1).max(60).optional(),
});

router.post(
  "/invoices",
  requireScope("invoices:write"),
  async (req: Request, res: Response) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request body",
          code: "INVALID_INPUT",
          details: parsed.error.issues,
        });
      }
      const client = getClient(req);
      const invoice = await createThirdPartyInvoice({
        client,
        customerEmail: parsed.data.customerEmail,
        productCode: parsed.data.productCode,
        externalId: parsed.data.externalId,
        metadata: parsed.data.metadata,
        couponCode: parsed.data.couponCode,
        mode: parsed.data.mode,
        amountCents: parsed.data.amountCents,
        currency: parsed.data.currency,
        termMonths: parsed.data.termMonths,
      });
      return res.status(201).json({
        invoice: serializeInvoice(invoice),
        paymentUrl: buildPaymentUrl(invoice._id.toString()),
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ List invoices ============

const listSchema = z.object({
  status: z
    .enum(["draft", "pending", "paid", "failed", "cancelled", "refunded", "expired"])
    .optional(),
  customerEmail: z.string().email().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get(
  "/invoices",
  requireScope("invoices:read"),
  async (req: Request, res: Response) => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid query",
          code: "INVALID_INPUT",
          details: parsed.error.issues,
        });
      }
      const client = getClient(req);
      const result = await listThirdPartyInvoices({
        clientId: client._id.toString(),
        status: parsed.data.status,
        customerEmail: parsed.data.customerEmail,
        from: parsed.data.from ? new Date(parsed.data.from) : undefined,
        to: parsed.data.to ? new Date(parsed.data.to) : undefined,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });
      return res.json({
        total: result.total,
        invoices: result.invoices.map(serializeInvoice),
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Get one ============

router.get(
  "/invoices/:id",
  requireScope("invoices:read"),
  async (req: Request, res: Response) => {
    try {
      const client = getClient(req);
      const invoice = await getThirdPartyInvoice(client._id.toString(), req.params.id);
      if (!invoice) {
        return res
          .status(404)
          .json({ error: "Invoice not found", code: "INVOICE_NOT_FOUND" });
      }
      return res.json({
        invoice: serializeInvoice(invoice),
        paymentUrl: buildPaymentUrl(invoice._id.toString()),
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Status (lightweight) ============

router.get(
  "/invoices/:id/status",
  requireScope("invoices:read"),
  async (req: Request, res: Response) => {
    try {
      const client = getClient(req);
      const invoice = await getThirdPartyInvoice(client._id.toString(), req.params.id);
      if (!invoice) {
        return res
          .status(404)
          .json({ error: "Invoice not found", code: "INVOICE_NOT_FOUND" });
      }
      return res.json({
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        paidAt: invoice.paidAt,
        amount: invoice.totalAmount,
        currency: invoice.itemCurrency,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Payment link ============

router.get(
  "/invoices/:id/payment-link",
  requireScope("invoices:read"),
  async (req: Request, res: Response) => {
    try {
      const client = getClient(req);
      const invoice = await getThirdPartyInvoice(client._id.toString(), req.params.id);
      if (!invoice) {
        return res
          .status(404)
          .json({ error: "Invoice not found", code: "INVOICE_NOT_FOUND" });
      }
      return res.json({
        paymentUrl: buildPaymentUrl(invoice._id.toString()),
        expiresAt: invoice.expiresAt,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Cancel ============

router.post(
  "/invoices/:id/cancel",
  requireScope("invoices:write"),
  async (req: Request, res: Response) => {
    try {
      const client = getClient(req);
      const invoice = await cancelThirdPartyInvoice(
        client._id.toString(),
        req.params.id
      );
      return res.json({ invoice: serializeInvoice(invoice) });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Receipt (paid invoices only) ============

router.get(
  "/invoices/:id/receipt",
  requireScope("invoices:read"),
  async (req: Request, res: Response) => {
    try {
      const client = getClient(req);
      const { invoice, receipt } = await getThirdPartyInvoiceReceipt(
        client._id.toString(),
        req.params.id
      );
      return res.json({
        invoice: serializeInvoice(invoice),
        receipt,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Manual webhook retry ============

router.post(
  "/invoices/:id/resend-webhook",
  requireScope("invoices:write"),
  async (req: Request, res: Response) => {
    try {
      const client = getClient(req);
      const { invoice, dispatched } = await retryInvoiceWebhook(
        client._id.toString(),
        req.params.id
      );
      return res.json({
        dispatched,
        invoice: serializeInvoice(invoice),
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Per-customer invoice list ============

const customerListSchema = z.object({
  status: z
    .enum(["draft", "pending", "paid", "failed", "cancelled", "refunded", "expired"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get(
  "/customers/:email/invoices",
  requireScope("invoices:read"),
  async (req: Request, res: Response) => {
    try {
      const parsed = customerListSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid query",
          code: "INVALID_INPUT",
          details: parsed.error.issues,
        });
      }
      const client = getClient(req);
      const result = await listCustomerInvoices(
        client._id.toString(),
        req.params.email,
        parsed.data
      );
      return res.json({
        total: result.total,
        customerEmail: req.params.email.toLowerCase(),
        invoices: result.invoices.map(serializeInvoice),
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
);

// ============ Self-introspection ============

router.get("/clients/me", async (req: Request, res: Response) => {
  const client = getClient(req);
  return res.json({
    id: client._id.toString(),
    name: client.name,
    apiKeyPrefix: client.apiKeyPrefix,
    scopes: client.scopes,
    isActive: client.isActive,
    webhookUrl: client.webhookUrl,
    rateLimits: client.rateLimits,
    productConfig: client.productConfig,
    lastUsedAt: client.lastUsedAt,
    createdAt: client.createdAt,
  });
});

// ============ Helpers ============

function buildPaymentUrl(invoiceId: string): string {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invoice/${invoiceId}`;
}

function serializeInvoice(invoice: any) {
  return {
    id: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    customerEmail: invoice.customerEmail,
    customerName: invoice.customerName,
    amount: invoice.totalAmount,
    // Pre-tax base + the tax component, so partners can display an ex-tax price
    // and surface tax separately. `tax` is 0 when no GST was owed (e.g. the buyer
    // is outside India); `subtotal` is then equal to `amount`. Same minor units.
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    currency: invoice.itemCurrency,
    isRecurring: invoice.isRecurring,
    recurringPeriod: invoice.recurringPeriod,
    // Authoritative cycle length — 6 months has no `recurringPeriod` value, so
    // partners must read this rather than inferring from the period label.
    recurringIntervalMonths: invoice.recurringIntervalMonths,
    termMonths:
      (invoice.metadata as any)?.termMonths ??
      invoice.recurringIntervalMonths ??
      undefined,
    recurringPaymentNumber: invoice.recurringPaymentNumber,
    parentInvoiceId: invoice.parentInvoiceId?.toString(),
    nextDueDate: invoice.nextDueDate,
    thirdPartyExternalId: invoice.thirdPartyExternalId,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    expiresAt: invoice.expiresAt,
    createdAt: invoice.createdAt,
    metadata: invoice.metadata,
    lineItems: invoice.lineItems?.map((li: any) => ({
      itemType: li.itemType,
      itemName: li.itemName,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      totalPrice: li.totalPrice,
      currency: li.originalCurrency,
    })),
  };
}

export default router;
