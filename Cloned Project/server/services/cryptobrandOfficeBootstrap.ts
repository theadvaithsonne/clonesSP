// Cryptobrand office bootstrap — mints the two initial invoices that
// every cryptobrand-flagged org needs on creation:
//
//   Invoice A: Pro office plan ($96/month, monthly recurring)
//   Invoice B: Cryptosub ($600/year, yearly recurring)
//
// Both are minted together and both returned in the org-create
// response. Cryptobrand's FE opens them as a "checkout summary" and
// the founder pays each via the standard `/invoice/<id>` pay page
// (Razorpay hosted, Stripe, crypto, wallet — anything). Fulfillment
// happens per-invoice via the existing `fulfillInvoice`:
//   - office_plan invoice → activates Pro + chains monthly cycles
//   - cryptosub invoice → activates cryptosub gate + fires the 3-bucket
//     commission split + chains yearly cycles
//
// Kept as a SIBLING service to avoid coupling with office.subscription
// or whitelabel purchase flows — this is just the "mint two invoices"
// primitive; each side's fulfillment is owned by its own module.

import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { OfficePlan } from "../models/officePlan.model";
import { createInvoice, getNextChargeDate } from "./invoice";
import { resolveOrgGstRegion } from "../utils/gstBuyerRegion";
import { applyGstToLine, GST_CONFIG } from "../utils/gstTax";
import { CRYPTOSUB_ADDON } from "../config/cryptosubAddon";

export interface BootstrapInput {
  orgId: string;
  founderUserId: string;
}

export interface BootstrapInvoiceRef {
  id: string;
  number: string;
  totalAmountUsdCents: number;
  currency: string;
  /** Relative FE path — the standard invoice pay page. */
  redirectUrl: string;
}

export interface BootstrapResult {
  officeInvoice: BootstrapInvoiceRef;
  cryptosubInvoice: BootstrapInvoiceRef;
}

/**
 * Mint the Pro-office-plan invoice AND the Cryptosub invoice for a
 * cryptobrand-flagged org. Both are recurring parents on their
 * respective cadences (monthly / yearly).
 *
 * Called ONLY from `POST /org/create-first-time` when the payload
 * carries `officeCreatedFromCryptobrand: true`. Non-cryptobrand orgs
 * never touch this path.
 *
 * Idempotency: `createInvoice`'s built-in dedup by `(userId, itemType,
 * itemId, status ∈ [draft,pending,failed])` reuses in-flight invoices
 * on retry — so a re-hit of create-first-time (network glitch, admin
 * repeat) won't mint duplicates.
 */
export async function bootstrapCryptobrandOfficeInvoices(
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const officeInvoice = await mintProOfficeInvoice(input);
  const cryptosubInvoice = await mintCryptosubInvoice(input);
  return { officeInvoice, cryptosubInvoice };
}

/**
 * Mint (or reuse via createInvoice dedup) the Pro office_plan invoice
 * for a cryptobrand org. Extracted from `bootstrapCryptobrandOfficeInvoices`
 * so the checkout-status endpoint can call it on its own when only the
 * office side is missing.
 */
export async function mintProOfficeInvoice(
  input: BootstrapInput,
): Promise<BootstrapInvoiceRef> {
  const { orgId, founderUserId } = input;
  const [org, founder, proPlan] = await Promise.all([
    Organization.findById(orgId)
      .select("_id name officeCreatedFromCryptobrand")
      .lean<any>(),
    User.findById(founderUserId).select("_id email name").lean<any>(),
    OfficePlan.findOne({ slug: "pro" })
      .select("_id name description amount currency taxRate")
      .lean<any>(),
  ]);
  if (!org) throw new Error(`Bootstrap: org ${orgId} not found`);
  if (!founder) throw new Error(`Bootstrap: founder ${founderUserId} not found`);
  if (!proPlan) throw new Error(`Bootstrap: OfficePlan slug "pro" not seeded`);

  const gstRegion = await resolveOrgGstRegion({
    orgId,
    subscriberUserId: founderUserId,
    paymentCurrency: "USD",
  });
  const officeGst = applyGstToLine({
    listedAmountMinor: proPlan.amount, // 9600 cents = $96
    gstInclusive: false,
    buyerInIndia: gstRegion.inIndia,
    taxRate: proPlan.taxRate ?? GST_CONFIG.rate,
  });

  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: founderUserId,
    userId: founderUserId,
    customerEmail: founder.email || "",
    customerName: founder.name || undefined,
    lineItems: [
      {
        itemType: "office_plan",
        itemId: proPlan._id.toString(),
        itemName: `Office ${proPlan.name} Plan`,
        itemDescription: proPlan.description,
        quantity: 1,
        unitPrice: proPlan.amount,
        originalCurrency: proPlan.currency || "USD",
      },
    ],
    itemCurrency: proPlan.currency || "USD",
    tax: officeGst.taxTotal,
    isRecurring: true,
    recurringPeriod: "monthly",
    metadata: {
      type: "office_subscription",
      planSlug: "pro",
      source: "cryptobrand_bootstrap",
      ...(officeGst.gstMetadata
        ? {
            gst: {
              ...officeGst.gstMetadata,
              buyerCountry: gstRegion.country,
              regionSource: gstRegion.source,
            },
          }
        : {}),
    },
  });
  // `nextDueDate` + `recurringPaymentNumber` only need setting on a
  // FRESH mint. createInvoice's pending-dedup returns an existing row
  // when one is already in flight; that row already has these fields
  // set from its original mint, so an unconditional reassign here would
  // stomp a valid pre-existing schedule with `now`. Guard on absence.
  const now = new Date();
  if (!invoice.nextDueDate) invoice.nextDueDate = getNextChargeDate(now, "monthly");
  if (!invoice.recurringPaymentNumber) invoice.recurringPaymentNumber = 1;
  if (invoice.isModified()) await invoice.save();

  return {
    id: String(invoice._id),
    number: invoice.invoiceNumber,
    totalAmountUsdCents: invoice.totalAmount,
    currency: invoice.itemCurrency,
    redirectUrl: `/invoice/${invoice._id}`,
  };
}

/**
 * Mint (or reuse) the Cryptosub yearly invoice for a cryptobrand org.
 * Same extraction rationale as `mintProOfficeInvoice`.
 */
export async function mintCryptosubInvoice(
  input: BootstrapInput,
): Promise<BootstrapInvoiceRef> {
  const { orgId, founderUserId } = input;
  const founder = await User.findById(founderUserId)
    .select("_id email name")
    .lean<any>();
  if (!founder) throw new Error(`Bootstrap: founder ${founderUserId} not found`);

  const gstRegion = await resolveOrgGstRegion({
    orgId,
    subscriberUserId: founderUserId,
    paymentCurrency: "USD",
  });
  const cryptosubGst = applyGstToLine({
    listedAmountMinor: CRYPTOSUB_ADDON.priceUsdCents,
    gstInclusive: false,
    buyerInIndia: gstRegion.inIndia,
    taxRate: CRYPTOSUB_ADDON.gstRate,
  });

  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: founderUserId,
    userId: founderUserId,
    customerEmail: founder.email || "",
    customerName: founder.name || undefined,
    lineItems: [
      {
        itemType: "cryptosub",
        itemId: orgId,
        itemName: "Cryptosub — 1 year",
        itemDescription: "Cryptobrand yearly subscription. Auto-renews.",
        quantity: 1,
        unitPrice: CRYPTOSUB_ADDON.priceUsdCents,
        originalCurrency: CRYPTOSUB_ADDON.currency,
      },
    ],
    itemCurrency: CRYPTOSUB_ADDON.currency,
    tax: cryptosubGst.taxTotal,
    isRecurring: true,
    recurringPeriod: CRYPTOSUB_ADDON.subscriptionPeriod,
    metadata: {
      addonSlug: CRYPTOSUB_ADDON.slug,
      source: "cryptobrand_bootstrap",
      buyerRegion: {
        country: gstRegion.country,
        source: gstRegion.source,
      },
      gst: gstRegion.inIndia
        ? {
            rate: CRYPTOSUB_ADDON.gstRate,
            amount: cryptosubGst.taxTotal,
            inclusive: false,
            sacCode: CRYPTOSUB_ADDON.sacCode,
          }
        : undefined,
    },
  });
  const now = new Date();
  if (!invoice.nextDueDate) invoice.nextDueDate = getNextChargeDate(now, "yearly");
  if (!invoice.recurringPaymentNumber) invoice.recurringPaymentNumber = 1;
  if (invoice.isModified()) await invoice.save();

  return {
    id: String(invoice._id),
    number: invoice.invoiceNumber,
    totalAmountUsdCents: invoice.totalAmount,
    currency: invoice.itemCurrency,
    redirectUrl: `/invoice/${invoice._id}`,
  };
}
