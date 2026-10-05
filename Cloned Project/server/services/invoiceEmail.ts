import { Types } from "mongoose";
import { sendMail, senderForOrg, EMAIL_FROM_NOTIFICATION } from "./mailer";
import { emailShell, ctaButton, fallbackLink, greeting, bodyText } from "./bulkEmail";
import { env } from "../config/env";

/**
 * The platform's own invoice email — sent for EVERY completed purchase,
 * including $0 ones.
 *
 * ── Why this exists next to orderEmail.ts ────────────────────────────────
 * `sendOrderEmail` is the SELLER's branded confirmation and returns early
 * unless that seller configured `alerts.enabled` + a custom `templateHtml`.
 * Nobody ever has: across products, courses, workshops and channels, zero
 * items have it set, so 7 of 1,397 paid invoices (0.5%) have ever produced an
 * email, and 2 of 1,073 free ones. Buyers currently get nothing.
 *
 * This is the receipt the platform owes the buyer regardless of what the
 * seller configured. It renders from the invoice alone — no item lookup, no
 * template, no opt-in — so it cannot be switched off by a missing setting.
 * The seller's order email still fires independently when configured; the two
 * are different documents and both are legitimate.
 *
 * ── Units ────────────────────────────────────────────────────────────────
 * Every money field on Invoice is in MINOR units (6100 = $61.00, tax 1098 =
 * ₹/$10.98). Divide by 100 exactly once, here, at the render boundary.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────
 * Claimed atomically on `metadata.invoiceEmailSentAt`, deliberately a
 * different key from `orderEmailSentAt` so the two emails cannot suppress
 * each other. `fulfillInvoice` runs more than once per payment when a webhook
 * and the browser both land, so the claim — not the caller — is the de-dupe.
 * A failed send releases the claim so a retry can still deliver.
 */

const BRAND = "#FBD10D";

/**
 * Block-explorer roots for the crypto-settlement confirmation block.
 * Mirrors the maps in the admin sweeper + checkout panel.
 */
const EXPLORER_TX: Record<string, string> = {
  bsc: "https://bscscan.com/tx/",
  polygon: "https://polygonscan.com/tx/",
  ethereum: "https://etherscan.io/tx/",
  bitcoin: "https://mempool.space/tx/",
  tron: "https://tronscan.org/#/transaction/",
};

const CHAIN_LABEL: Record<string, string> = {
  bsc: "BNB Smart Chain",
  polygon: "Polygon",
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
  tron: "Tron",
};

/**
 * Crypto settlement details, when this invoice was paid on-chain.
 *
 * Why this block exists: the checkout panel tells the buyer "you can
 * close this page, the invoice updates automatically once your
 * transaction confirms." For that promise to mean anything, the email
 * that lands afterwards has to actually CONFIRM the payment was seen —
 * a generic "here's your invoice" receipt doesn't close the loop, and
 * crypto buyers have no other signal that their funds arrived.
 *
 * Returns null for every non-crypto invoice, so the receipt is
 * unchanged for card / UPI / wallet payments.
 */
function cryptoSettlement(invoice: any): {
  chain: string;
  chainName: string;
  coin: string;
  txHash: string;
  explorerUrl: string | null;
} | null {
  const meta = invoice?.metadata || {};
  const txHash = meta.cryptoTxHash;
  if (!txHash || invoice?.paymentMethodCategory !== "crypto") return null;
  const chain = String(meta.cryptoChain || "");
  const root = EXPLORER_TX[chain];
  return {
    chain,
    chainName: CHAIN_LABEL[chain] || chain || "blockchain",
    coin: String(meta.cryptoCoin || ""),
    txHash: String(txHash),
    explorerUrl: root ? `${root}${txHash}` : null,
  };
}

/** Invoice fields carry seller- and buyer-authored text. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstNameOf(fullName?: string | null, email?: string | null): string {
  const name = String(fullName || "").trim();
  if (name) return name.split(/\s+/)[0];
  return String(email || "").split("@")[0] || "";
}

/**
 * Display symbol. `itemCurrency` is only ever USD or INR; `paymentCurrency`
 * can also be CAD/EUR/GBP (card-only via Stripe). Prefixed so a Canadian
 * "$" is never mistaken for a US one on the same receipt.
 */
function currencySymbol(currency: string): string {
  switch ((currency || "USD").toUpperCase()) {
    case "INR":
      return "₹";
    case "CAD":
      return "CA$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "AED":
      return "AED ";
    case "PHP":
      return "₱";
    default:
      return "$";
  }
}

/** Minor units -> display. */
function money(minor: number, currency = "USD"): string {
  const v = (Number(minor) || 0) / 100;
  const symbol = currencySymbol(currency);
  return `${symbol}${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(d?: Date | null): string {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const ROW = `padding:10px 0;border-bottom:1px solid #2a2a3d;`;

function lineItemsHtml(invoice: any): string {
  const cur = invoice.itemCurrency || "USD";
  return (invoice.lineItems || [])
    .map((li: any) => {
      const qty = Number(li.quantity) || 1;
      // Show unit price only when it adds information.
      const unit =
        qty > 1
          ? `<div style="color:#777;font-size:12px;margin-top:2px;">${qty} × ${money(li.unitPrice, cur)}</div>`
          : "";
      return `
<tr>
  <td style="${ROW}color:#EAEAEA;font-size:14px;">
    ${esc(li.itemName || "Item")}${unit}
  </td>
  <td style="${ROW}color:#EAEAEA;font-size:14px;text-align:right;white-space:nowrap;">
    ${money(li.totalPrice, cur)}
  </td>
</tr>`;
    })
    .join("");
}

function totalsHtml(invoice: any): string {
  const cur = invoice.itemCurrency || "USD";
  const line = (label: string, minor: number, strong = false) => `
<tr>
  <td style="padding:6px 0;color:${strong ? "#EAEAEA" : "#999"};font-size:${strong ? "16px" : "13px"};${strong ? "font-weight:700;" : ""}">${esc(label)}</td>
  <td style="padding:6px 0;color:${strong ? BRAND : "#BDBDBD"};font-size:${strong ? "18px" : "13px"};text-align:right;white-space:nowrap;${strong ? "font-weight:700;" : ""}">${money(minor, cur)}</td>
</tr>`;

  // Only render the rows that carry a value — a receipt full of $0.00 lines
  // reads as broken.
  return [
    line("Subtotal", invoice.subtotal || 0),
    invoice.discount ? line("Discount", -invoice.discount) : "",
    invoice.tax ? line("Tax", invoice.tax) : "",
    invoice.shippingCost ? line("Shipping", invoice.shippingCost) : "",
    `<tr><td colspan="2" style="border-top:1px solid #2a2a3d;height:8px;"></td></tr>`,
    line("Total", invoice.totalAmount || 0, true),
    chargedInHtml(invoice),
  ].join("");
}

/**
 * What the buyer's card was actually charged.
 *
 * 104 paid invoices are priced in one currency and settled in another — an
 * Indian buyer on a USD-priced item sees "$71.98" here and "₹6,802" on their
 * statement. Without this line the two look like different transactions.
 */
function chargedInHtml(invoice: any): string {
  const item = invoice.itemCurrency || "USD";
  const paid = invoice.paymentCurrency;
  const conv = invoice.currencyConversion;
  if (!paid || paid === item || !conv?.exchangeRate) return "";

  const charged = ((Number(invoice.totalAmount) || 0) / 100) * Number(conv.exchangeRate);
  const sym = currencySymbol(paid);
  const rate = Number(conv.exchangeRate).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return `
<tr>
  <td colspan="2" style="padding:8px 0 0;color:#777;font-size:12px;text-align:right;">
    Charged ${sym}${charged.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    &nbsp;·&nbsp; 1 ${esc(item)} = ${sym}${rate}
  </td>
</tr>`;
}

export function buildInvoiceEmail(
  invoice: any,
  orgName: string
): { subject: string; html: string; text: string } {
  const cur = invoice.itemCurrency || "USD";
  const isFree = !(Number(invoice.totalAmount) > 0);
  const to = invoice.customerEmail || "";
  const name = firstNameOf(invoice.customerName, to);
  const ref = invoice.invoiceNumber || String(invoice._id);
  const url = `${env.FRONTEND_URL}/invoice/${encodeURIComponent(ref)}`;

  // Crypto invoices get a confirmation-first headline. The buyer was
  // told they could close the checkout page and we'd take it from
  // there — this email is where that promise is kept, so it leads with
  // "payment received" rather than a neutral "your invoice".
  const crypto = cryptoSettlement(invoice);

  const header = `
    <h1 style="margin:0;color:#0C0C0E;font-size:24px;font-weight:700;">
      ${crypto ? "Payment received" : isFree ? "Your receipt" : "Your invoice"}
    </h1>
    <p style="margin:6px 0 0;color:rgba(12,12,14,0.7);font-size:13px;font-weight:600;">${esc(ref)}</p>`;

  const meta = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>
    <td style="color:#777;font-size:12px;">Billed to</td>
    <td style="color:#777;font-size:12px;text-align:right;">Date</td>
  </tr>
  <tr>
    <td style="color:#EAEAEA;font-size:14px;">${esc(invoice.customerName || to)}</td>
    <td style="color:#EAEAEA;font-size:14px;text-align:right;">${formatDate(invoice.paidAt || invoice.createdAt)}</td>
  </tr>
  <tr>
    <td style="color:#777;font-size:12px;padding-top:2px;">${esc(to)}</td>
    <td style="color:#777;font-size:12px;text-align:right;padding-top:2px;">Sold by ${esc(orgName)}</td>
  </tr>
  ${
    invoice.gstin
      ? `<tr><td colspan="2" style="color:#777;font-size:12px;padding-top:6px;">GSTIN ${esc(invoice.gstin)}</td></tr>`
      : ""
  }
</table>`;

  // A $0 invoice with a "PAID" stamp reads as a billing error. Say what it is.
  const status = isFree
    ? `<div style="display:inline-block;padding:5px 12px;border-radius:999px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);color:#34D399;font-size:12px;font-weight:600;">No payment required</div>`
    : `<div style="display:inline-block;padding:5px 12px;border-radius:999px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);color:#34D399;font-size:12px;font-weight:600;">Paid</div>`;

  // On-chain confirmation panel. Same palette as the rest of the
  // receipt — emerald for the confirmed state, #2a2a3d borders, #777
  // labels, #EAEAEA values. No new visual language introduced.
  const cryptoBlock = crypto
    ? `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid rgba(52,211,153,0.3);border-radius:8px;background:rgba(52,211,153,0.06);">
  <tr>
    <td style="padding:14px 16px;">
      <p style="margin:0 0 10px;color:#34D399;font-size:13px;font-weight:600;">
        Your ${esc(crypto.coin)} payment was received on ${esc(crypto.chainName)}
      </p>
      <p style="margin:0 0 12px;color:rgba(234,234,234,0.75);font-size:13px;line-height:1.5;">
        We detected your transaction on-chain and cleared this invoice automatically. No further action is needed.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#777;font-size:12px;padding-bottom:2px;">Network</td>
          <td style="color:#777;font-size:12px;text-align:right;padding-bottom:2px;">Confirmed</td>
        </tr>
        <tr>
          <td style="color:#EAEAEA;font-size:14px;">${esc(crypto.chainName)}</td>
          <td style="color:#EAEAEA;font-size:14px;text-align:right;">${formatDate(invoice.paidAt || invoice.createdAt)}</td>
        </tr>
        <tr>
          <td colspan="2" style="color:#777;font-size:12px;padding-top:10px;">Transaction</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top:2px;">
            ${
              crypto.explorerUrl
                ? `<a href="${esc(crypto.explorerUrl)}" style="color:${BRAND};font-size:12px;font-family:monospace;word-break:break-all;text-decoration:none;">${esc(crypto.txHash)}</a>`
                : `<span style="color:#EAEAEA;font-size:12px;font-family:monospace;word-break:break-all;">${esc(crypto.txHash)}</span>`
            }
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
    : "";

  const body = `
    ${greeting(esc(name))}
    ${bodyText(
      crypto
        ? `Good news — we've received your payment and cleared your invoice from <strong style="color:#EAEAEA;">${esc(orgName)}</strong>.`
        : isFree
          ? `Here's your receipt from <strong style="color:#EAEAEA;">${esc(orgName)}</strong>. Nothing was charged — keep this for your records.`
          : `Thanks for your purchase from <strong style="color:#EAEAEA;">${esc(orgName)}</strong>. Here's your invoice.`
    )}
    <div style="margin:20px 0;">${status}</div>
    ${cryptoBlock}
    ${meta}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2a2a3d;">
      ${lineItemsHtml(invoice)}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
      ${totalsHtml(invoice)}
    </table>
    ${ctaButton(url, "View invoice")}
    ${fallbackLink(url)}
  `;

  const items = (invoice.lineItems || [])
    .map(
      (li: any) =>
        `  ${li.itemName || "Item"}${(Number(li.quantity) || 1) > 1 ? ` × ${li.quantity}` : ""} — ${money(li.totalPrice, cur)}`
    )
    .join("\n");

  const cryptoText = crypto
    ? `
Your ${crypto.coin} payment was received on ${crypto.chainName}.
We detected your transaction on-chain and cleared this invoice
automatically. No further action is needed.

Network: ${crypto.chainName}
Confirmed: ${formatDate(invoice.paidAt || invoice.createdAt)}
Transaction: ${crypto.txHash}${crypto.explorerUrl ? `\n${crypto.explorerUrl}` : ""}
`
    : "";

  const text = `${name ? `Hi ${name},` : "Hi there,"}

${
    crypto
      ? `Good news — we've received your payment and cleared your invoice from ${orgName}.`
      : isFree
        ? `Here's your receipt from ${orgName}. Nothing was charged.`
        : `Thanks for your purchase from ${orgName}.`
  }
${cryptoText}
Invoice ${ref}
Date: ${formatDate(invoice.paidAt || invoice.createdAt)}

${items}

Total: ${money(invoice.totalAmount || 0, cur)}${isFree ? " (no payment required)" : ""}${
    invoice.paymentCurrency &&
    invoice.paymentCurrency !== cur &&
    invoice.currencyConversion?.exchangeRate
      ? `\nCharged ${currencySymbol(invoice.paymentCurrency)}${(
          ((Number(invoice.totalAmount) || 0) / 100) *
          Number(invoice.currencyConversion.exchangeRate)
        ).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (1 ${cur} = ${Number(invoice.currencyConversion.exchangeRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })})`
      : ""
  }

View invoice: ${url}

— ${orgName}`;

  return {
    subject: crypto
      ? `Payment received — invoice ${ref} cleared`
      : isFree
        ? `Your receipt from ${orgName} — ${ref}`
        : `Your invoice from ${orgName} — ${ref}`,
    html: emailShell(header, body),
    text,
  };
}

/**
 * Sends the invoice email once per invoice. Returns whether it went out.
 * Throws only so `queueInvoiceEmail` can log — callers on a purchase path
 * must use the queue wrapper, never this directly.
 */
export async function sendInvoiceEmail(invoiceOrId: any): Promise<boolean> {
  const { Invoice } = await import("../models/invoice.model");

  const invoice: any =
    typeof invoiceOrId === "string" || invoiceOrId instanceof Types.ObjectId
      ? await Invoice.findById(String(invoiceOrId)).lean()
      : invoiceOrId;
  if (!invoice) return false;

  const to = String(invoice.customerEmail || "").trim();
  if (!to) {
    console.warn(`[invoice-email] no recipient for invoice ${invoice._id}`);
    return false;
  }

  /**
   * Combo bookkeeping is not a bill — don't mail it.
   *
   * Buying the $25 licence (+ an optional term) is ONE payment on ONE
   * invoice, and that invoice is emailed. Activation then mints $0
   * NetworkChain records so the subscription chain has a parent: the free
   * first month (`kind: combo_free_first_month`) and, for a bundle, a
   * prepaid term whose cash sits on the combo invoice (`prepaidViaBundle`).
   * Both carry `triggerInvoiceId` pointing at the invoice that was paid.
   * Mailing them sent the buyer up to three "invoices" for one payment — the
   * last of which read "$99, paid" for a record that collected nothing
   * (21 Sep 2026). A free month granted on an already-owned licence has no
   * funding invoice (`triggerInvoiceId: existing_up_…`) and still goes out,
   * since it is the only notice the member gets.
   */
  const meta = invoice.metadata || {};
  const fundedElsewhere =
    (invoice.totalAmount || 0) === 0 &&
    invoice.lineItems?.[0]?.itemType === "third_party_subscription" &&
    (meta.kind === "combo_free_first_month" || !!meta.prepaidViaBundle) &&
    Types.ObjectId.isValid(String(meta.prepaidViaBundle || meta.triggerInvoiceId || ""));
  if (fundedElsewhere) {
    await Invoice.updateOne(
      { _id: invoice._id, "metadata.invoiceEmailSentAt": { $exists: false } },
      { $set: { "metadata.invoiceEmailSkipped": "funded_by_combo_invoice" } },
    );
    return false;
  }

  // Atomic claim — the de-dupe point for webhook/browser races.
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoice._id, "metadata.invoiceEmailSentAt": { $exists: false } },
    { $set: { "metadata.invoiceEmailSentAt": new Date() } },
    { new: true }
  );
  if (!claimed) return false;

  try {
    const { Organization } = await import("../models/organization.model");
    const org: any = invoice.organizationId
      ? await Organization.findById(invoice.organizationId).select("name").lean()
      : null;
    const orgName = org?.name || "Garage";

    const { subject, html, text } = buildInvoiceEmail(invoice, orgName);
    const from = await senderForOrg(invoice.organizationId, EMAIL_FROM_NOTIFICATION);
    await sendMail(to, subject, html, text, from);

    console.log(
      `[invoice-email] sent to ${to} for ${invoice.invoiceNumber} (${money(invoice.totalAmount || 0, invoice.itemCurrency)})`
    );
    return true;
  } catch (err) {
    // Release so a webhook re-delivery or manual replay can still send it.
    await Invoice.updateOne(
      { _id: invoice._id },
      { $unset: { "metadata.invoiceEmailSentAt": "" } }
    ).catch(() => undefined);
    throw err;
  }
}

/**
 * Fire-and-forget wrapper for fulfilment paths: a mail failure must never fail
 * the purchase it is documenting.
 */
export function queueInvoiceEmail(invoiceOrId: any): void {
  void sendInvoiceEmail(invoiceOrId).catch((err: any) =>
    console.error("[invoice-email] send failed:", err?.message)
  );
}
