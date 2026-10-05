import { Types } from "mongoose";
import { Invoice, IInvoice } from "../models/invoice.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import { User } from "../models/user.model";
import { createThirdPartyInvoice, ThirdPartyError } from "./thirdPartyInvoice";
import { fulfillInvoice, getNextChargeDate } from "./invoice";
import { addMonthsClamped } from "../utils/dateMath";

// One-time-globally externalId. Ties the combo invoice to the buyer so any
// re-run (verify-payment retry, fulfillInvoice retry, admin retry) hits the
// same idempotency check inside createThirdPartyInvoice.
function comboExternalId(buyerId: string): string {
  return `combo_free_first_month_${buyerId}`;
}

/**
 * ExternalId for a PAID activation. Keyed on the UP cart invoice rather than
 * the buyer, so a fulfilment replay dedupes to the same row while a genuine
 * later re-subscribe (after a cancellation) can still mint a new chain.
 */
function paidExternalId(triggerInvoiceId: string): string {
  return `nc_paid_first_cycle_${triggerInvoiceId}`;
}

export interface ActivateComboInput {
  buyerId: string;
  clientId: string;
  productCode?: string;
  triggerInvoiceId: string;
  /**
   * Term the buyer selected for their ONGOING subscription at UP checkout.
   * The free cycle is always 1 month; this is queued as
   * `metadata.pendingTermMonths` so cycle 2 is priced at the chosen term.
   *
   * Ignored when `freeFirstCycle` is false — a paid activation bills the chosen
   * term on the root invoice itself, so there is nothing to queue.
   */
  nextTermMonths?: number;
  /**
   * Present when the buyer purchased a term in the same cart as the $25 licence.
   * The licence is always attributed at its full list value; `subUsd` is the
   * discounted subscription portion, already collected on the UP invoice.
   */
  bundle?: { licenceUsd: number; subUsd: number; termMonths: number };
  /**
   * Whether this activation grants the free first month.
   *
   * Defaults to true — today's combo behaviour, byte-identical.
   *
   * False is the post-offer-window path: the buyer paid for their first cycle
   * in the same cart as the licence, so the ROOT invoice is itself the prepaid
   * cycle. It covers `bundle.termMonths` from today, commission runs on it, and
   * the buyer counts as an active paid subscriber immediately rather than after
   * a free month. Requires `bundle`, since that is where the cash figure lives.
   */
  freeFirstCycle?: boolean;
}

export interface ActivateComboResult {
  invoice: IInvoice;
  alreadyExisted: boolean;
}

/**
 * Issue the $0 first-cycle invoice for a combo offer (UP $25 → free month of
 * a third-party subscription). Marks paid, sets nextDueDate for the recurring
 * cron to pick up cycle 2 at full price, and triggers fulfillInvoice — which
 * lands in the existing zero-pay branch of the third_party_subscription case
 * (fires the partner webhook, marks commissionDistributed=true).
 *
 * Idempotent on (clientId, externalId) via createThirdPartyInvoice's existing
 * dedupe — if the invoice already exists we short-circuit and report it.
 */
export async function activateComboFreeFirstMonth(
  input: ActivateComboInput
): Promise<ActivateComboResult> {
  const {
    buyerId,
    clientId,
    productCode,
    triggerInvoiceId,
    nextTermMonths,
    bundle,
    freeFirstCycle = true,
  } = input;

  if (!freeFirstCycle && !bundle) {
    // Without `bundle` there is no record of how much cash was collected on the
    // UP invoice, and commission.ts reads `metadata.bundle.subUsd` as the
    // revenue base for a prepaid cycle. Minting one without it would silently
    // distribute $0.
    throw new ThirdPartyError(
      "INVALID_INPUT",
      "A paid activation (freeFirstCycle=false) requires `bundle` — it carries the collected amount",
      400
    );
  }

  if (!Types.ObjectId.isValid(clientId)) {
    throw new ThirdPartyError("INVALID_INPUT", "clientId is not a valid ObjectId", 400);
  }

  const client = await ThirdPartyClient.findById(clientId);
  if (!client || !client.isActive) {
    throw new ThirdPartyError(
      "CLIENT_NOT_ELIGIBLE",
      `ThirdPartyClient ${clientId} is missing or inactive`,
      404
    );
  }
  if (!client.productConfig) {
    throw new ThirdPartyError(
      "CLIENT_NOT_ELIGIBLE",
      `ThirdPartyClient ${clientId} has no productConfig`,
      404
    );
  }
  if (!client.productConfig.recurringPeriod) {
    throw new ThirdPartyError(
      "CLIENT_NOT_ELIGIBLE",
      `ThirdPartyClient ${clientId} productConfig has no recurringPeriod`,
      400
    );
  }

  const buyer = await User.findById(buyerId).select("email").lean();
  if (!buyer?.email) {
    throw new ThirdPartyError("BUYER_NOT_FOUND", `Buyer ${buyerId} has no email`, 404);
  }

  const externalId = freeFirstCycle
    ? comboExternalId(buyerId)
    : paidExternalId(triggerInvoiceId);

  // If the invoice already exists (re-run of verify-payment, retry,
  // double-fulfillment), short-circuit. We use the same eligibility check the
  // caller does, so reaching this point means we want to re-emit the same
  // logical operation — createThirdPartyInvoice will return the existing row.
  const existing = await Invoice.findOne({
    thirdPartyClientId: client._id,
    thirdPartyExternalId: externalId,
  });
  if (existing) {
    return { invoice: existing, alreadyExisted: true };
  }

  // A paid activation bills the chosen term on the root invoice itself; the
  // free path pins the root to one month and queues the term for cycle 2.
  const paidTermMonths = bundle?.termMonths || 1;

  const invoice = await createThirdPartyInvoice({
    client,
    customerEmail: buyer.email,
    productCode,
    externalId,
    ...(freeFirstCycle
      ? { freeFirstCycle: true as const, nextTermMonths }
      : {
          prepaidFirstCycle: { triggerInvoiceId },
          termMonths: paidTermMonths,
        }),
    metadata: {
      // Stamp the buyer so the partner's invoice.paid webhook is self-describing
      // (the webhook forwards invoice.metadata verbatim). Without this, combo
      // invoices carried no userId and the partner could only attribute them by
      // parsing the externalId — this makes metadata.userId consistent with the
      // partner's own nc_sub_* invoices.
      userId: buyerId,
      triggerInvoiceId,
      comboClientId: clientId,
      comboProductCode: productCode || client.productConfig.productCode,
      // Load-bearing on the paid path: commission.ts reads `bundle.subUsd` as
      // the revenue base whenever `prepaidViaBundle` is set, because
      // totalAmount is 0. Omit it and the monthly scale computes as 0/36 — no
      // commission at all.
      ...(freeFirstCycle ? {} : { bundle }),
    },
  });

  // Mark paid + set nextDueDate so the recurring cron picks up the next cycle.
  // createInvoice's zero-pay auto-pay branch only fires inside the
  // platform-coupon path; we deliberately bypass that, so we replicate its tail
  // here.
  invoice.status = "paid";
  invoice.paidAt = new Date();
  // Free path: explicitly 1 month. The combo grants exactly one free month no
  // matter which term the buyer selected — the chosen term applies from cycle 2,
  // priced by priceThirdPartyChildCycle.
  // Paid path: the root already covers the whole term, so the next charge is a
  // full term away.
  invoice.nextDueDate = getNextChargeDate(
    new Date(),
    client.productConfig.recurringPeriod,
    freeFirstCycle ? 1 : paidTermMonths
  );
  await invoice.save();

  // ── Bundle: mint the prepaid term as cycle 2 BEFORE fulfilling the parent ──
  //
  // Order matters. Fulfilling the parent fires the on-payment trigger, which
  // calls generateNextChildInvoice — and that would mint cycle 2 at the
  // STANDALONE price. Creating it here first means the generator's idempotency
  // check on {parentInvoiceId, recurringPaymentNumber: 2} finds it and no-ops.
  //
  // Only on the FREE path. When the first cycle is paid, the root invoice is
  // itself the prepaid term — minting a second one would double the coverage
  // and pay the sponsor twice for the same money.
  let prepaidCycle: IInvoice | null = null;
  if (freeFirstCycle && bundle && bundle.termMonths > 1) {
    prepaidCycle = await mintPrepaidBundleCycle({
      parent: invoice,
      client,
      bundle,
      triggerInvoiceId,
    });
  }

  // Fulfillment → case "third_party_subscription".
  //   Free path: the zero-pay branch fires the partner webhook ("invoice.paid")
  //     and stamps commissionDistributed=true without paying anyone.
  //   Paid path: prepaidViaBundle exempts it from that skip, so this is where
  //     the sponsor's NetworkChain bonus and the platform share are actually
  //     distributed — once per month covered.
  await fulfillInvoice(
    invoice,
    freeFirstCycle ? `combo_free_${invoice._id}` : `nc_paid_${invoice._id}`
  );

  // Fulfil the prepaid cycle too: distributes N months of commission (the
  // prepaidViaBundle carve-out keeps it out of the zero-pay skip), fires the
  // partner webhook for the term, and triggers generation of cycle 3 at the
  // standalone price.
  if (prepaidCycle) {
    await fulfillInvoice(prepaidCycle, `bundle_prepaid_${prepaidCycle._id}`);
  }

  return { invoice, alreadyExisted: false };
}

/**
 * Create the already-paid subscription cycle covered by a licence bundle.
 *
 * The buyer paid for this on the Unilevel Plus invoice, so no cash is collected
 * here: `subtotal` records the true service value while `discount` cancels it to
 * `totalAmount === 0`, which keeps the revenue from being double-counted.
 *
 * `tax` is deliberately 0 — GST for the whole bundle was charged and recorded on
 * the UP invoice, and fulfillInvoice credits the GST wallet for any invoice with
 * `tax > 0`, so a non-zero value here would remit the same GST twice.
 */
async function mintPrepaidBundleCycle(input: {
  parent: IInvoice;
  client: any;
  bundle: { licenceUsd: number; subUsd: number; termMonths: number };
  triggerInvoiceId: string;
}): Promise<IInvoice | null> {
  const { parent, client, bundle, triggerInvoiceId } = input;

  const externalId = `${parent.thirdPartyExternalId || parent._id.toString()}__cycle2`;

  // Idempotency: a fulfilment replay must not mint a second prepaid cycle.
  const existing = await Invoice.findOne({
    thirdPartyClientId: parent.thirdPartyClientId,
    thirdPartyExternalId: externalId,
  });
  if (existing) return null;

  const subtotalCents = Math.round(bundle.subUsd * 100);
  // Service starts when the free month ends.
  const periodStart = parent.nextDueDate
    ? new Date(parent.nextDueDate)
    : new Date();
  const periodEnd = addMonthsClamped(periodStart, bundle.termMonths);

  const src: any = parent.lineItems?.[0]
    ? (parent.lineItems[0] as any).toObject?.() ?? parent.lineItems[0]
    : {};

  const cycle = await Invoice.create({
    invoiceType: "recurring",
    status: "paid",
    paidAt: new Date(),
    organizationId: parent.organizationId,
    sellerId: parent.sellerId,
    userId: parent.userId,
    customerEmail: parent.customerEmail,
    customerName: parent.customerName,
    lineItems: [
      {
        ...src,
        itemName: `${client.name} subscription — ${bundle.termMonths} months`,
        itemDescription: `${client.productConfig.productCode} subscription — ${bundle.termMonths}-month term, prepaid with the $25 licence bundle`,
        quantity: 1,
        unitPrice: subtotalCents,
        totalPrice: subtotalCents,
      },
    ],
    subtotal: subtotalCents,
    discount: subtotalCents, // paid on the UP invoice; don't double-count cash
    tax: 0, // see doc comment — GST already remitted on the UP invoice
    shippingCost: 0,
    totalAmount: 0,
    itemCurrency: parent.itemCurrency,
    isRecurring: true,
    recurringPeriod: parent.recurringPeriod,
    recurringIntervalMonths: bundle.termMonths,
    recurringPaymentNumber: 2,
    parentInvoiceId: parent._id,
    nextDueDate: periodEnd,
    thirdPartyClientId: parent.thirdPartyClientId,
    thirdPartyExternalId: externalId,
    expiresAt: periodEnd,
    metadata: {
      userId: parent.userId.toString(),
      triggerInvoiceId,
      termMonths: bundle.termMonths,
      termPriceUsd: bundle.subUsd,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      // Two flags the rest of the pipeline keys off:
      //  - prepaidViaBundle exempts this cycle from the zero-pay commission skip
      //  - bundle.subUsd is the revenue the distributor splits, since
      //    totalAmount is 0
      prepaidViaBundle: triggerInvoiceId,
      bundle,
      source: "third_party_api",
      thirdPartyClientName: client.name,
      productCode: client.productConfig.productCode,
    },
  });

  console.log(
    `[ComboActivation] minted prepaid ${bundle.termMonths}-month cycle ${cycle.invoiceNumber} ($${bundle.subUsd} service, $0 collected) for parent ${parent.invoiceNumber}`
  );
  return cycle;
}
