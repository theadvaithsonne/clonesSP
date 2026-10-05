"use client";

// Invoice detail drawer for the garage-admin tables. Opens IN-PAGE (a
// right-side sheet over a dimmed backdrop) so clicking an invoice number
// never navigates away from the list. Fetches the public invoice endpoint
// `GET /api/invoices/:idOrNumber` — getInvoice() accepts the invoice NUMBER
// directly, so the tables (which only carry invoiceNumber) can open it
// without a backend change. Same shell as NetworkChainSubsFilterDrawer.

import { useEffect, useState } from "react";
import { invoiceUrl } from "@/lib/admin-domain";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface InvoiceLineItem {
  name?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  [k: string]: unknown;
}

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  invoiceType?: string;
  status?: string;
  lineItems?: InvoiceLineItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  shippingCost?: number;
  totalAmount?: number;
  itemCurrency?: string;
  paymentCurrency?: string;
  paymentMethodCategory?: string | null;
  paymentPlatform?: string | null;
  metadata?: Record<string, unknown>;
  isRecurring?: boolean;
  recurringPeriod?: string;
  recurringPaymentNumber?: number;
  couponCode?: string | null;
  paymentMode?: string | null;
  customerEmail?: string;
  customerName?: string;
  paidAt?: string | null;
  nextDueDate?: string | null;
  invoiceShortUrl?: string | null;
  createdAt?: string;
  [k: string]: unknown;
}

interface Props {
  /** Invoice number OR id to load. null closes the drawer. */
  invoiceNumber: string | null;
  onClose: () => void;
}

// Amounts are stored in minor units (paise / cents).
function money(minor: number | undefined, currency = "USD"): string {
  const major = (minor ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function statusColor(status?: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "cancelled" || s === "failed") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (s === "pending") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-white/10 text-zinc-300 border-white/15";
}

export function InvoiceDetailDrawer({ invoiceNumber, onClose }: Props) {
  const open = !!invoiceNumber;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceNumber) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInvoice(null);
    api<{ success: boolean; invoice: InvoiceDetail }>(
      `api/invoices/${encodeURIComponent(invoiceNumber)}`,
    )
      .then((res) => {
        if (cancelled) return;
        setInvoice(res.invoice);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load invoice");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceNumber]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const currency = invoice?.paymentCurrency || invoice?.itemCurrency || "USD";

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-end bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="mr-6 flex h-[calc(100vh-48px)] w-[440px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Invoice
                </p>
                <p className="truncate text-base font-bold text-white">
                  {invoice?.invoiceNumber || invoiceNumber}
                </p>
              </div>
              {/* Open the full invoice page (payable) in a new tab. Absolute:
                  the admin panel is on admin.garage.app, so a relative path
                  would resolve there instead of where invoices are served. */}
              {(invoice?.invoiceNumber || invoiceNumber) && (
                <a
                  href={invoiceUrl(invoice?.invoiceNumber || invoiceNumber || "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-brand/20"
                  title="Open the full invoice in a new tab"
                >
                  Open invoice
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                </div>
              ) : error ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-semibold text-white">Couldn&apos;t load invoice</p>
                  <p className="text-xs text-zinc-500">{error}</p>
                </div>
              ) : invoice ? (
                <div className="space-y-5">
                  {/* Status + type */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusColor(invoice.status)}`}
                    >
                      {invoice.status || "unknown"}
                    </span>
                    {invoice.invoiceType && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-zinc-400">
                        {invoice.invoiceType}
                      </span>
                    )}
                    {invoice.isRecurring && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-zinc-400">
                        Recurring · {invoice.recurringPeriod}
                        {invoice.recurringPaymentNumber ? ` · #${invoice.recurringPaymentNumber}` : ""}
                      </span>
                    )}
                  </div>

                  {/* Customer + dates */}
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <Field label="Customer" value={invoice.customerName || "—"} />
                    <Field label="Email" value={invoice.customerEmail || "—"} />
                    <Field label="Created" value={fmtDate(invoice.createdAt)} />
                    <Field label="Paid" value={fmtDate(invoice.paidAt)} />
                    {invoice.isRecurring && (
                      <Field label="Next due" value={fmtDate(invoice.nextDueDate)} />
                    )}
                    {(invoice.paymentMethodCategory ||
                      invoice.paymentPlatform ||
                      invoice.paymentMode ||
                      (invoice.metadata as any)?.paidWithB2Coins) && (
                      <Field
                        label="Payment method"
                        value={
                          formatInvoicePayment(invoice) ||
                          invoice.paymentMode ||
                          "—"
                        }
                      />
                    )}
                  </div>

                  {/* Line items */}
                  {invoice.lineItems && invoice.lineItems.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Items
                      </p>
                      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                        {invoice.lineItems.map((li, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-3 py-2.5 last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] text-zinc-200">
                                {li.name || li.description || "Item"}
                              </p>
                              {li.quantity != null && (
                                <p className="text-[11px] text-zinc-500">Qty {li.quantity}</p>
                              )}
                            </div>
                            <p className="shrink-0 text-[13px] tabular-nums text-zinc-300">
                              {money((li.amount ?? li.unitPrice) as number | undefined, currency)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[13px]">
                    <TotalRow label="Subtotal" value={money(invoice.subtotal, currency)} />
                    {invoice.discount ? (
                      <TotalRow label="Discount" value={`− ${money(invoice.discount, currency)}`} />
                    ) : null}
                    {invoice.tax ? (
                      <TotalRow label="Tax" value={money(invoice.tax, currency)} />
                    ) : null}
                    {invoice.shippingCost ? (
                      <TotalRow label="Shipping" value={money(invoice.shippingCost, currency)} />
                    ) : null}
                    <div className="my-1 h-px bg-white/[0.06]" />
                    <TotalRow
                      label="Total"
                      value={money(invoice.totalAmount, currency)}
                      bold
                    />
                    {invoice.couponCode && (
                      <p className="pt-1 text-[11px] text-zinc-500">
                        Coupon: <span className="text-zinc-300">{invoice.couponCode}</span>
                      </p>
                    )}
                  </div>

                  {/* Short URL */}
                  {invoice.invoiceShortUrl && (
                    <a
                      href={invoice.invoiceShortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] text-brand hover:underline"
                    >
                      Open hosted invoice
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="truncate text-zinc-200">{value}</p>
    </div>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-white" : "text-zinc-400"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-white" : "text-zinc-300"}`}>
        {value}
      </span>
    </div>
  );
}

function formatInvoicePayment(inv: InvoiceDetail): string | null {
  const method = (inv.paymentMethodCategory as string | undefined)?.toLowerCase().trim();
  const platform = (inv.paymentPlatform as string | undefined)?.toLowerCase().trim();
  const meta = inv.metadata as Record<string, any> | undefined;
  const coin = (meta?.cryptoCoin || meta?.coin)?.toUpperCase().trim();
  const chain = (meta?.cryptoChain || meta?.chain)?.toUpperCase().trim();

  // BAT246 entry purchases paid with B2 Coins (or a Snap Back Loan, which
  // is just borrowed coins) leave paymentMethodCategory/paymentPlatform
  // unset — neither closed enum has a value that means "B2 Coins" — so
  // this is the only signal. See payEntryProductWithB2Coins()
  // (bat246Layaway.service.ts) and the matching skip in
  // fulfillInvoice() (invoice.ts).
  if (meta?.paidWithB2Coins) return "Paid with B2 Coins";

  const PLATFORM_NAMES: Record<string, string> = {
    razorpay: "Razorpay",
    stripe: "Stripe",
    phonepe: "PhonePe",
    paytm: "Paytm",
    openmoney: "OpenMoney",
    square: "Square",
    crypto_wallet: "Crypto Wallet",
    store_wallet: "Store Wallet",
    affiliate_wallet: "Affiliate Wallet",
    auction_wallet: "Auction Wallet",
  };

  const METHOD_NAMES: Record<string, string> = {
    card: "Card",
    upi: "UPI",
    crypto: "Crypto",
    wallet: "Wallet",
  };

  if (method === "crypto" || platform === "crypto_wallet") {
    if (coin && chain) return `Crypto (${coin} · ${chain})`;
    if (coin) return `Crypto (${coin})`;
    if (chain) return `Crypto (${chain})`;
    return "Crypto";
  }

  if (platform === "store_wallet") {
    const store =
      (inv as any).storeName ||
      (inv as any).fromOrganization?.name ||
      meta?.storeName;
    return store ? `Store Wallet (${store})` : "Store Wallet";
  }
  if (platform === "affiliate_wallet") return "Affiliate Wallet";
  if (platform === "auction_wallet") return "Auction Wallet";

  const m = method ? METHOD_NAMES[method] || method : null;
  const p = platform ? PLATFORM_NAMES[platform] || platform : null;

  if (m && p && m.toLowerCase() !== p.toLowerCase()) return `${m} (${p})`;
  if (m) return m;
  if (p) return p;
  return null;
}

