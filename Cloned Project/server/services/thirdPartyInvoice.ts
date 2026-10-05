import { Types } from "mongoose";
import { Invoice, IInvoice, InvoiceStatus } from "../models/invoice.model";
import { IThirdPartyClient } from "../models/thirdPartyClient.model";
import { User } from "../models/user.model";
import { createInvoice } from "./invoice";
import { calculateTaxAmounts, GST_CONFIG, applyGstToLine } from "../utils/gstTax";
import {
  resolveBuyerGstRegion,
  gstSkippedMetadata,
} from "../utils/gstBuyerRegion";
import { ThirdPartyError } from "./thirdPartyError";
import { resolveTermPlan } from "./thirdPartyTerms";
import { addMonthsClamped } from "../utils/dateMath";

// ThirdPartyError moved to its own module to break a circular import with
// thirdPartyTerms.ts (which needs to throw it, and which this file imports for
// term pricing). Imported for local use and re-exported so the many existing
// `from "./thirdPartyInvoice"` importers keep working unchanged.
export { ThirdPartyError };

/**
 * Best-fit `recurringPeriod` label for a term. 6 has no enum slot and labels as
 * "monthly"; `recurringIntervalMonths` is the authority.
 */
function periodLabelForTerm(
  termMonths: number
): "monthly" | "quarterly" | "yearly" {
  if (termMonths === 3) return "quarterly";
  if (termMonths === 12) return "yearly";
  return "monthly";
}

/**
 * Currencies a top-up invoice may be raised in.
 *
 * An allow-list rather than "anything three letters": the value flows into the
 * invoice, the payment page and the payment provider, and a typo'd code would
 * produce an invoice nobody can pay and no error until someone tried.
 */
export const SUPPORTED_TOPUP_CURRENCIES = ["USD", "INR"];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateThirdPartyInvoiceInput {
  client: IThirdPartyClient;
  customerEmail: string;
  productCode?: string;
  externalId?: string;
  metadata?: Record<string, any>;
  couponCode?: string;
  // Top-up mode: caller-specified one-off amount, non-recurring, no coupon.
  // Requires client.productConfig.allowsTopUp === true. Uses the existing
  // third_party_subscription itemType + metadata.kind="topup" so fulfillment
  // can discriminate without a new enum value (additive only; no Mongoose
  // schema migration needed).
  mode?: "subscription" | "topup";
  /**
   * The amount in MINOR units of `currency` — cents for USD, paise for INR.
   *
   * The name says "cents" for backward compatibility with the clients written
   * against it, but the unit has always been "whatever the currency's minor
   * unit is". It only ever meant cents because the currency was always USD.
   */
  amountCents?: number;
  /**
   * ISO-4217, top-up only. Defaults to USD so every existing client is
   * unaffected.
   *
   * Before this existed the invoice currency was hardcoded USD, so a partner
   * billing in rupees produced a dollar invoice for the rupee figure — ₹5,309
   * rendered as $530,900, off by the exchange rate AND the minor-unit ratio.
   * Nothing in the API let them say otherwise.
   */
  currency?: string;
  // Combo-flow first cycle: subscription invoice with unitPrice=0 (no coupon).
  // Caller is responsible for marking it paid + setting nextDueDate +
  // calling fulfillInvoice — the zero-pay auto-pay branch in createInvoice
  // is gated on the platform-coupon path, which we deliberately bypass.
  freeFirstCycle?: boolean;
  // Post-offer-window first cycle: the buyer paid for this cycle IN CASH, but
  // on the Unilevel Plus cart invoice rather than here. So the service value is
  // recorded (subtotal) while `discount` cancels it to totalAmount=0, exactly
  // as mintPrepaidBundleCycle does for a bundled term — the difference is that
  // this is the ROOT invoice, not cycle 2.
  //
  // Unlike freeFirstCycle this is NOT free: it stamps metadata.prepaidViaBundle
  // instead of kind="combo_free_first_month", which is what makes commission
  // run (the zero-pay skip in fulfillInvoice exempts prepaidViaBundle) and what
  // makes the buyer count as an active PAID subscriber for the rank bonus.
  //
  // Multi-month terms ARE allowed here — the whole term is prepaid up front.
  prepaidFirstCycle?: { triggerInvoiceId: string };
  // Multi-month term (1 / 3 / 6 / 12). Omitting it always means 1 month —
  // there is no configurable default, so a multi-month term is only ever
  // billed when the caller explicitly asks for one.
  termMonths?: number;
  // For freeFirstCycle only: the term the buyer chose for their ONGOING
  // subscription. The free cycle itself is always 1 month; this is stamped as
  // metadata.pendingTermMonths so cycle 2 picks it up.
  nextTermMonths?: number;
}

export async function createThirdPartyInvoice(
  input: CreateThirdPartyInvoiceInput
): Promise<IInvoice> {
  const {
    client,
    customerEmail: rawEmail,
    productCode,
    externalId,
    metadata,
    couponCode,
    mode = "subscription",
    amountCents,
    currency: rawCurrency,
    freeFirstCycle = false,
    prepaidFirstCycle,
    termMonths: requestedTermMonths,
    nextTermMonths,
  } = input;

  if (prepaidFirstCycle) {
    if (freeFirstCycle) {
      throw new ThirdPartyError(
        "INVALID_INPUT",
        "prepaidFirstCycle cannot be combined with freeFirstCycle — a cycle is either free or paid",
        400
      );
    }
    if (mode === "topup") {
      throw new ThirdPartyError(
        "INVALID_INPUT",
        "prepaidFirstCycle cannot be combined with mode=topup",
        400
      );
    }
    if (couponCode) {
      // The cash was collected on the UP cart invoice, where any coupon has
      // already been applied. Honouring one again here would discount a cycle
      // whose price this invoice never charged.
      throw new ThirdPartyError(
        "COUPON_NOT_ALLOWED",
        "Coupons cannot be applied to a prepaid first-cycle invoice",
        400
      );
    }
  }
  const customerEmail = normalizeEmail(rawEmail);

  if (!customerEmail) {
    throw new ThirdPartyError("INVALID_INPUT", "customerEmail is required", 400);
  }

  // productConfig is optional on the model (analytics-only clients omit it),
  // but invoice operations require it. Narrow once at the top so the rest of
  // this function can treat it as defined.
  if (!client.productConfig) {
    throw new ThirdPartyError(
      "CLIENT_NOT_INVOICE_ENABLED",
      "This API key is not configured for invoice operations",
      403
    );
  }
  const productConfig = client.productConfig;

  if (productCode && productCode !== productConfig.productCode) {
    throw new ThirdPartyError(
      "PRODUCT_MISMATCH",
      `productCode "${productCode}" does not match this client's configured product "${productConfig.productCode}"`,
      400
    );
  }

  // ── Top-up mode validation (additive: doesn't touch existing subscription
  // flow). Caller specifies the amount; we issue a non-recurring invoice that
  // fulfills as a "credit the partner's wallet" event via webhook.
  if (mode === "topup") {
    if (!productConfig.allowsTopUp) {
      throw new ThirdPartyError(
        "TOPUP_NOT_ENABLED",
        "This client is not configured for top-up invoices (productConfig.allowsTopUp=false)",
        403
      );
    }
    if (!amountCents || !Number.isInteger(amountCents) || amountCents < 100) {
      throw new ThirdPartyError(
        "INVALID_INPUT",
        "amountCents is required for top-up invoices (integer ≥ 100)",
        400
      );
    }
    if (couponCode) {
      throw new ThirdPartyError(
        "COUPON_NOT_ALLOWED",
        "Coupons cannot be applied to top-up invoices",
        400
      );
    }
    if (rawCurrency && !SUPPORTED_TOPUP_CURRENCIES.includes(rawCurrency.toUpperCase())) {
      throw new ThirdPartyError(
        "UNSUPPORTED_CURRENCY",
        `currency "${rawCurrency}" is not supported for top-up invoices (${SUPPORTED_TOPUP_CURRENCIES.join(", ")})`,
        400
      );
    }
  }

  /**
   * The invoice's currency.
   *
   * USD unless a top-up asked otherwise, so every client written before this
   * existed behaves exactly as it did. Subscriptions ignore it entirely — their
   * price comes from productConfig, which is denominated in dollars.
   */
  const invoiceCurrency =
    mode === "topup" && rawCurrency ? rawCurrency.toUpperCase() : "USD";

  // ── freeFirstCycle is mutually exclusive with topup + coupon. It produces a
  // recurring $0 first-cycle invoice for combo offers (e.g. buy UP, get one
  // month free). The caller (comboActivation) then marks it paid + sets
  // nextDueDate + fulfills.
  if (freeFirstCycle) {
    if (mode === "topup") {
      throw new ThirdPartyError(
        "INVALID_INPUT",
        "freeFirstCycle cannot be combined with mode=topup",
        400
      );
    }
    if (couponCode) {
      throw new ThirdPartyError(
        "COUPON_NOT_ALLOWED",
        "Coupons cannot be applied to a free first-cycle invoice",
        400
      );
    }
    if (requestedTermMonths && requestedTermMonths > 1) {
      // The freebie is always one month. A multi-month term for the ongoing
      // subscription travels via `nextTermMonths` instead, so we never mint a
      // $0 twelve-month invoice.
      throw new ThirdPartyError(
        "INVALID_TERM",
        "freeFirstCycle is always a 1-month cycle; use nextTermMonths for the ongoing term",
        400
      );
    }
  }

  // ── Term resolution ──────────────────────────────────────────────────────
  // Topups have no term. freeFirstCycle is pinned to 1 month.
  const termPlan =
    mode === "topup"
      ? null
      : resolveTermPlan(productConfig, freeFirstCycle ? 1 : requestedTermMonths);
  const termMonths = termPlan?.termMonths ?? 1;

  // Coupons are cycle-scoped, not month-scoped: PlatformCouponRedemption
  // .cycleCount counts CYCLES, so a 3-cycle 50%-off coupon on a 6-month term
  // is 18 months at half price against a $216 base — a 6x blow-up of coupon
  // liability. Blocked until cycleCount can be reinterpreted in months.
  if (couponCode && termMonths > 1) {
    throw new ThirdPartyError(
      "COUPON_NOT_ALLOWED_FOR_TERM",
      `Coupons are not supported on multi-month terms (requested ${termMonths} months)`,
      400
    );
  }

  // Idempotency on (clientId, externalId)
  if (externalId) {
    const existing = await Invoice.findOne({
      thirdPartyClientId: client._id,
      thirdPartyExternalId: externalId,
    });
    if (existing) {
      // Reposting the same externalId with a DIFFERENT term must not silently
      // return the old price. Standard idempotency-conflict semantics.
      if (requestedTermMonths) {
        const existingTerm =
          Number((existing.metadata as any)?.termMonths) ||
          existing.recurringIntervalMonths ||
          1;
        if (existingTerm !== requestedTermMonths) {
          throw new ThirdPartyError(
            "IDEMPOTENCY_CONFLICT",
            `externalId "${externalId}" already exists with termMonths=${existingTerm} (requested ${requestedTermMonths})`,
            409
          );
        }
      }
      return existing;
    }
  }

  // Resolve customer — must already exist (no auto-provision)
  const customer = await User.findOne({ email: customerEmail })
    .select("_id email name")
    .lean();
  if (!customer) {
    throw new ThirdPartyError(
      "CUSTOMER_NOT_FOUND",
      `No user exists for email ${customerEmail}`,
      404
    );
  }

  // Resolve platform user (Shorupan) as the sellerId
  const platformUser = await User.findOne({
    email: productConfig.platformUserEmail,
  })
    .select("_id")
    .lean();
  if (!platformUser) {
    throw new ThirdPartyError(
      "PLATFORM_USER_NOT_FOUND",
      `Platform user ${productConfig.platformUserEmail} is not provisioned`,
      500
    );
  }

  const isTopUp = mode === "topup";
  // freeFirstCycle: lineItems carry the FULL partner price (so cycle 2+ children
  // generated by the recurring cron inherit full price), and we pass discount=
  // unitPrice+tax so totalAmount comes out to 0 for the parent. The cron has a
  // matching branch that uses parent.subtotal (full) instead of parent.totalAmount
  // (0) when the parent is marked metadata.kind=combo_free_first_month.
  const unitPriceCents = isTopUp
    ? amountCents!
    : Math.round(termPlan!.totalAmount * 100);

  // 18% GST on top of the base partner price — always exclusive, no
  // per-client opt-out. Applicability is gated on the END-CUSTOMER's country
  // (the `customer` resolved from customerEmail above): an Indian customer is
  // taxed, one outside India is not.
  //
  // Topups are skipped entirely because their amount is caller-specified over
  // an API contract — adding 18% would silently change what the calling
  // partner thinks they're charging.
  //
  // For freeFirstCycle parents we STILL compute + stamp GST so the recurring
  // cron (which inherits parent.tax verbatim into cycle-2 children) bills
  // cycle 2 at the full amount; we then roll the tax into the discount so the
  // free-first-cycle parent itself still comes out to $0 for the buyer.
  const tpGstRegion = isTopUp
    ? null
    : await resolveBuyerGstRegion({
        // buyerUserId, not the `customer` doc above — that one is selected
        // down to _id/email/name and carries no country field.
        buyerUserId: customer._id.toString(),
        // SUBSCRIPTION invoices are always USD — their price comes from
        // productConfig, which is denominated in dollars — so an
        // unidentifiable customer falls back to "outside India", matching
        // how the sellable-item flows behave for USD-priced items.
        //
        // Top-ups may now be raised in another currency but never reach
        // here: this whole branch is `isTopUp ? null : …`. If GST is ever
        // wanted on a top-up, this is the line that must learn about
        // invoiceCurrency.
        paymentCurrency: "USD",
      });
  const tpGstLine = isTopUp
    ? null
    : applyGstToLine({
        listedAmountMinor: unitPriceCents,
        gstInclusive: false,
        buyerInIndia: !!tpGstRegion?.inIndia,
      });
  // A prepaid first cycle carries NO tax of its own: GST for the whole cart was
  // charged and remitted on the Unilevel Plus invoice, and fulfillInvoice
  // credits the GST wallet for any invoice with tax > 0 — a non-zero value here
  // would remit the same GST twice. Renewals are unaffected, because
  // priceThirdPartyChildCycle recomputes a child's tax from the buyer's region
  // rather than inheriting the parent's.
  const taxAmount = prepaidFirstCycle ? 0 : (tpGstLine?.taxTotal ?? 0);
  // Both the free and the prepaid cycle net to $0 for the buyer here; they
  // differ only in WHY. Free: never charged. Prepaid: charged on the UP cart.
  const parentDiscount =
    freeFirstCycle || prepaidFirstCycle ? unitPriceCents + taxAmount : 0;

  const invoice = await createInvoice({
    organizationId: productConfig.platformOrgId,
    sellerId: platformUser._id.toString(),
    userId: customer._id.toString(),
    customerEmail,
    customerName: customer.name || undefined,
    lineItems: [
      {
        itemType: "third_party_subscription",
        itemId: client._id.toString(),
        itemName: isTopUp
          ? `${client.name} wallet top-up`
          : `${client.name} subscription`,
        itemDescription: isTopUp
          ? `${client.name} account credit top-up`
          : freeFirstCycle
            ? `${productConfig.productCode} subscription — first cycle free`
            : termMonths > 1
              ? `${productConfig.productCode} subscription — ${termMonths}-month term`
              : `${productConfig.productCode} recurring subscription`,
        quantity: 1,
        unitPrice: unitPriceCents,
        originalCurrency: invoiceCurrency,
      },
    ],
    discount: parentDiscount,
    tax: taxAmount,
    itemCurrency: invoiceCurrency,
    isRecurring: !isTopUp,
    recurringPeriod: isTopUp
      ? undefined
      : termMonths > 1
        ? periodLabelForTerm(termMonths)
        : productConfig.recurringPeriod,
    // Authoritative cycle length. 6 months has no `recurringPeriod` enum slot,
    // so this is what getNextChargeDate actually keys off.
    recurringIntervalMonths: isTopUp ? undefined : termMonths,
    metadata: {
      ...(metadata || {}),
      thirdPartyClientName: client.name,
      productCode: productConfig.productCode,
      source: "third_party_api",
      ...(isTopUp
        ? {}
        : {
            termMonths,
            termPriceUsd: termPlan!.totalAmount,
            periodStart: new Date().toISOString(),
            periodEnd: addMonthsClamped(new Date(), termMonths).toISOString(),
          }),
      // Combo: the free cycle is 1 month, but the buyer picked a term for the
      // ongoing subscription. Queue it so cycle 2 is priced at that term.
      ...(freeFirstCycle && nextTermMonths && nextTermMonths > 1
        ? { pendingTermMonths: nextTermMonths }
        : {}),
      // Fulfillment discriminator. Read in invoice.ts fulfillInvoice() for the
      // third_party_subscription case — kind="topup" skips commission and
      // just fires the webhook; kind="combo_free_first_month" uses the
      // existing totalAmount===0 zero-pay branch (so the partner doesn't
      // get paid for the freebie) AND is recognised by the recurring cron
      // to reprice the child at full partner price.
      ...(isTopUp ? { kind: "topup" } : {}),
      ...(freeFirstCycle ? { kind: "combo_free_first_month" } : {}),
      // Deliberately NOT a `kind`. prepaidViaBundle is the established marker
      // for "cash collected elsewhere" and is what exempts this invoice from
      // the zero-pay commission skip in fulfillInvoice, and what makes
      // rankBonus/activeSubscribers.ts count the buyer as actively paid.
      ...(prepaidFirstCycle
        ? { prepaidViaBundle: prepaidFirstCycle.triggerInvoiceId }
        : {}),
      ...(tpGstLine?.gstMetadata && tpGstRegion
        ? {
            gst: {
              ...tpGstLine.gstMetadata,
              buyerCountry: tpGstRegion.country,
              buyerRegion: "IN" as const,
              regionSource: tpGstRegion.source,
            },
          }
        : {}),
      // Only mark "skipped" for real subscriptions — topups are untaxed by
      // contract, not by buyer region, so a skip marker would misreport why.
      ...(!isTopUp && tpGstRegion && !tpGstLine?.gstMetadata
        ? { gstSkipped: gstSkippedMetadata(tpGstRegion, "buyer_outside_india") }
        : {}),
    },
    thirdPartyClientId: client._id.toString(),
    thirdPartyExternalId: externalId,
    platformCouponCode: isTopUp || freeFirstCycle ? undefined : couponCode,
  });

  return invoice;
}

export interface ListThirdPartyInvoicesInput {
  clientId: string;
  status?: InvoiceStatus;
  customerEmail?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export async function listThirdPartyInvoices(
  input: ListThirdPartyInvoicesInput
): Promise<{ invoices: IInvoice[]; total: number }> {
  const query: any = {
    thirdPartyClientId: new Types.ObjectId(input.clientId),
  };
  if (input.status) query.status = input.status;
  if (input.customerEmail) query.customerEmail = normalizeEmail(input.customerEmail);
  if (input.from || input.to) {
    query.createdAt = {};
    if (input.from) query.createdAt.$gte = input.from;
    if (input.to) query.createdAt.$lte = input.to;
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const [invoices, total] = await Promise.all([
    Invoice.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
    Invoice.countDocuments(query),
  ]);

  return { invoices, total };
}

export async function getThirdPartyInvoice(
  clientId: string,
  invoiceIdOrNumber: string
): Promise<IInvoice | null> {
  const query: any = { thirdPartyClientId: new Types.ObjectId(clientId) };
  if (Types.ObjectId.isValid(invoiceIdOrNumber)) {
    query._id = new Types.ObjectId(invoiceIdOrNumber);
  } else {
    query.invoiceNumber = invoiceIdOrNumber;
  }
  return Invoice.findOne(query);
}

export async function cancelThirdPartyInvoice(
  clientId: string,
  invoiceIdOrNumber: string
): Promise<IInvoice> {
  const invoice = await getThirdPartyInvoice(clientId, invoiceIdOrNumber);
  if (!invoice) {
    throw new ThirdPartyError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  }
  if (!["draft", "pending"].includes(invoice.status)) {
    throw new ThirdPartyError(
      "INVOICE_NOT_CANCELLABLE",
      `Invoice is ${invoice.status} and cannot be cancelled`,
      409
    );
  }
  invoice.status = "cancelled";
  invoice.cancelledAt = new Date();
  await invoice.save();
  return invoice;
}

export async function getThirdPartyInvoiceReceipt(
  clientId: string,
  invoiceIdOrNumber: string
): Promise<{
  invoice: IInvoice;
  receipt: {
    invoiceNumber: string;
    status: InvoiceStatus;
    paidAt?: Date;
    amount: number;
    currency: string;
    paymentMethod?: string;
    paymentPlatform?: string;
    razorpayPaymentId?: string;
    customerEmail: string;
    customerName?: string;
    lineItems: Array<{
      itemName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  };
}> {
  const invoice = await getThirdPartyInvoice(clientId, invoiceIdOrNumber);
  if (!invoice) {
    throw new ThirdPartyError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  }
  if (invoice.status !== "paid") {
    throw new ThirdPartyError(
      "RECEIPT_UNAVAILABLE",
      `Receipt is only available for paid invoices (current status: ${invoice.status})`,
      409
    );
  }
  return {
    invoice,
    receipt: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      paidAt: invoice.paidAt,
      amount: invoice.totalAmount,
      currency: invoice.paymentCurrency || invoice.itemCurrency,
      paymentMethod: invoice.paymentMethodCategory,
      paymentPlatform: invoice.paymentPlatform,
      razorpayPaymentId: invoice.razorpayPaymentId,
      customerEmail: invoice.customerEmail,
      customerName: invoice.customerName,
      lineItems: invoice.lineItems.map((li) => ({
        itemName: li.itemName,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
      })),
    },
  };
}

export async function listCustomerInvoices(
  clientId: string,
  customerEmail: string,
  options: { status?: InvoiceStatus; limit?: number; offset?: number } = {}
): Promise<{ invoices: IInvoice[]; total: number }> {
  return listThirdPartyInvoices({
    clientId,
    customerEmail,
    status: options.status,
    limit: options.limit,
    offset: options.offset,
  });
}

export async function retryInvoiceWebhook(
  clientId: string,
  invoiceIdOrNumber: string
): Promise<{ invoice: IInvoice; dispatched: boolean }> {
  const invoice = await getThirdPartyInvoice(clientId, invoiceIdOrNumber);
  if (!invoice) {
    throw new ThirdPartyError("INVOICE_NOT_FOUND", "Invoice not found", 404);
  }

  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const client = await ThirdPartyClient.findById(clientId);
  if (!client) {
    throw new ThirdPartyError("CLIENT_NOT_FOUND", "Client not found", 404);
  }
  if (!client.webhookUrl) {
    throw new ThirdPartyError(
      "NO_WEBHOOK_URL",
      "This client has no webhookUrl configured",
      400
    );
  }

  const event =
    invoice.status === "paid"
      ? "invoice.paid"
      : invoice.status === "cancelled"
      ? "invoice.cancelled"
      : invoice.status === "failed"
      ? "invoice.failed"
      : null;
  if (!event) {
    throw new ThirdPartyError(
      "NO_WEBHOOK_EVENT",
      `Invoice status "${invoice.status}" does not correspond to a webhook event`,
      409
    );
  }

  const { deliverInvoiceWebhook } = await import("./thirdPartyWebhook");
  deliverInvoiceWebhook(invoice, client, event).catch((err) =>
    console.error("[ThirdPartyInvoice] manual webhook retry failed:", err)
  );

  return { invoice, dispatched: true };
}
