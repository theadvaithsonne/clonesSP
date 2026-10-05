"use client";

import { Download, FileText, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatMinor } from "@/lib/checkout-currencies";
import { cn } from "@/lib/utils";

// ============ Types ============

interface InvoiceLineItem {
  itemType: string;
  itemId: string;
  itemName: string;
  itemDescription?: string;
  itemImage?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalCurrency: string;
}

interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  convertedAt: string;
}

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface InvoiceDocumentData {
  _id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
  /** Buyer's User._id. Optional so pre-existing consumers that build this
   *  shape client-side don't have to backfill it. GET /api/invoices/:id
   *  always returns it — the invoice-pay flow relies on it to detect the
   *  stale-localStorage-token case (see InvoicePayPage handlePayClick). */
  userId?: string;
  /** Seller org. Also stamped by the BE list/detail routes and used by the
   *  invoice-pay flow when it needs to route wallet vs Razorpay actions. */
  organizationId?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  totalAmount: number;
  itemCurrency: string;
  paymentCurrency?: string;
  currencyConversion?: CurrencyConversion;
  isRecurring: boolean;
  recurringPeriod?: string;
  recurringPaymentNumber?: number;
  couponCode?: string;
  customerEmail: string;
  customerName?: string;
  shippingAddress?: ShippingAddress;
  paidAt?: string;
  nextDueDate?: string;
  createdAt: string;
  expiresAt?: string;
  invoiceShortUrl?: string;
  // Tax / fee breakdown blocks. Stamped by the backend at checkout when GST
  // (INR channels) or Apple's iOS 30% fee applies. When present we render
  // dedicated rows; when absent the existing generic "Tax" line is used.
  gst?: { rate: number; amount: number; inclusive: boolean; sacCode?: string };
  appleFee?: { rate: number; amount: number; inclusive: boolean };
  paymentSource?: "web" | "ios" | "android";
}

export interface FromOrganization {
  _id: string;
  name: string;
  icon?: string;
  coverPhoto?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  location?: string;
  slug?: string;
  billingDetails?: {
    gstin?: string;
    legalName?: string;
    billingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    };
  };
}

interface InvoiceDocumentProps {
  invoice: InvoiceDocumentData;
  fromOrganization?: FromOrganization | null;
  onDownload?: () => void;
}

// ============ Helpers ============

function formatAmount(amount: number, currency: string): string {
  return formatMinor(amount, currency);
}

function formatDate(date?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Adds an hour/minute component to formatDate. Used for the Issued /
// Paid On / Due timestamps in the invoice header — founder wanted the
// exact time surfaced there, not just the date. Falls back to the
// bare-date behavior when the value is missing / unparseable.
function formatDateTime(date?: string): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        icon: CheckCircle2,
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        dotColor: "bg-emerald-400",
      };
    case "draft":
    case "pending":
      return {
        label: "Unpaid",
        icon: Clock,
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
        dotColor: "bg-amber-400",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        icon: XCircle,
        bg: "bg-zinc-500/10",
        text: "text-zinc-400",
        border: "border-zinc-500/30",
        dotColor: "bg-zinc-400",
      };
    case "expired":
      return {
        label: "Expired",
        icon: XCircle,
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        dotColor: "bg-red-400",
      };
    case "failed":
      return {
        label: "Failed",
        icon: XCircle,
        bg: "bg-red-500/10",
        text: "text-red-400",
        border: "border-red-500/30",
        dotColor: "bg-red-400",
      };
    case "refunded":
      return {
        label: "Refunded",
        icon: XCircle,
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/30",
        dotColor: "bg-blue-400",
      };
    default:
      return {
        label: status,
        icon: Clock,
        bg: "bg-zinc-500/10",
        text: "text-zinc-400",
        border: "border-zinc-500/30",
        dotColor: "bg-zinc-400",
      };
  }
}

function buildAddressLines(org?: FromOrganization | null): string[] {
  if (!org) return [];
  const billing = org.billingDetails?.billingAddress;
  const lines: string[] = [];

  if (billing?.line1) lines.push(billing.line1);
  if (billing?.line2) lines.push(billing.line2);

  const cityStateLine = [
    billing?.city || org.city,
    billing?.state || org.state,
    billing?.pincode || org.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStateLine) lines.push(cityStateLine);

  if (org.country) lines.push(org.country);

  // Fallback: use location field if nothing else
  if (lines.length === 0 && org.location) lines.push(org.location);

  return lines;
}

// ============ Component ============

export function InvoiceDocument({ invoice, fromOrganization, onDownload }: InvoiceDocumentProps) {
  const currency = invoice.itemCurrency;
  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;

  const fromName = fromOrganization?.billingDetails?.legalName || fromOrganization?.name || "Seller";
  const fromAddressLines = buildAddressLines(fromOrganization);
  const fromGstin = fromOrganization?.billingDetails?.gstin;

  // Bill-To (buyer) info. Fallback order:
  //   1. Invoice's explicit customerName (from BE at checkout)
  //   2. Shipping address's fullName
  //   3. Email local-part (better than a "Customer" placeholder — the
  //      email is a real identifier the buyer recognises; new invoices
  //      always carry customerName so this branch mostly covers older
  //      paid invoices that predate the BE fix)
  //   4. Bare "Customer" if we have literally nothing
  const emailLocalPart = invoice.customerEmail
    ? invoice.customerEmail.split("@")[0]
    : "";
  const billToName =
    invoice.customerName ||
    invoice.shippingAddress?.fullName ||
    emailLocalPart ||
    "Customer";
  const billToEmail = invoice.customerEmail;
  const billToAddress = invoice.shippingAddress;

  const hasAnyDiscount = invoice.discount > 0;
  const hasAnyTax = invoice.tax > 0 || (invoice.gst?.amount || 0) > 0;
  const hasAnyShipping = invoice.shippingCost > 0;
  const hasAnyAppleFee = (invoice.appleFee?.amount || 0) > 0;

  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#0e0e12] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header: org branding + download */}
      <div className="px-6 sm:px-8 py-4 border-b border-[#1a1a22] flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {fromOrganization?.icon ? (
            <img
              src={fromOrganization.icon}
              alt={fromOrganization.name}
              className="w-9 h-9 rounded-lg object-cover border border-[#2a2a35] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-brand" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {fromOrganization?.name || "Invoice"}
            </div>
            {fromOrganization?.slug && (
              <div className="text-[10px] text-[#6b6b80]">@{fromOrganization.slug}</div>
            )}
          </div>
        </div>

        {onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 text-xs text-[#9fa0b8] hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-[#1a1a22]"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-6 sm:px-8 py-6 sm:py-8">
        {/* Title + Invoice number + Status badge */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Invoice</h1>
            <p className="text-xs text-[#6b6b80] font-mono">{invoice.invoiceNumber}</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border shrink-0",
              statusConfig.bg,
              statusConfig.text,
              statusConfig.border
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig.dotColor)} />
            {statusConfig.label}
            {invoice.isRecurring && <span className="opacity-70">· {invoice.recurringPeriod}</span>}
          </span>
        </div>

        {/* From / Bill To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80] mb-2">
              From
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-white">{fromName}</div>
              {fromAddressLines.map((line, idx) => (
                <div key={idx} className="text-xs text-[#9fa0b8]">
                  {line}
                </div>
              ))}
              {fromGstin && (
                <div className="text-xs text-[#9fa0b8] pt-1">GSTIN: {fromGstin}</div>
              )}
              {fromAddressLines.length === 0 && !fromGstin && (
                <div className="text-xs text-[#6b6b80] italic">—</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80] mb-2">
              Bill To
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-white">{billToName}</div>
              <div className="text-xs text-[#9fa0b8]">{billToEmail}</div>
              {billToAddress && (
                <>
                  <div className="text-xs text-[#9fa0b8]">{billToAddress.addressLine1}</div>
                  {billToAddress.addressLine2 && (
                    <div className="text-xs text-[#9fa0b8]">{billToAddress.addressLine2}</div>
                  )}
                  <div className="text-xs text-[#9fa0b8]">
                    {[billToAddress.city, billToAddress.state, billToAddress.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div className="text-xs text-[#9fa0b8]">{billToAddress.country}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Issued / Due dates */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80] mb-1">
              Issued
            </div>
            <div className="text-sm font-medium text-white">{formatDateTime(invoice.createdAt)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80] mb-1">
              {invoice.status === "paid" ? "Paid on" : "Due"}
            </div>
            <div className="text-sm font-medium text-white">
              {invoice.status === "paid"
                ? formatDateTime(invoice.paidAt)
                : /* on recurring children, nextDueDate is the cycle AFTER this one — use expiresAt for this invoice's own deadline */
                  formatDateTime(invoice.expiresAt || invoice.nextDueDate)}
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="border-t border-[#1a1a22] pt-5 mb-5">
          <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80] pb-3 border-b border-[#1a1a22]">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          {invoice.lineItems.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 gap-2 py-3 border-b border-[#1a1a22] last:border-b-0"
            >
              <div className="col-span-6 text-sm text-white flex items-center gap-2 min-w-0">
                {item.itemImage && (
                  <img
                    src={item.itemImage}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover border border-[#2a2a35] shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.itemName}</div>
                  {item.itemDescription && (
                    <div className="text-[11px] text-[#6b6b80] truncate">{item.itemDescription}</div>
                  )}
                </div>
              </div>
              <div className="col-span-2 text-sm text-[#9fa0b8] text-right flex items-center justify-end">
                {item.quantity}
              </div>
              <div className="col-span-2 text-sm text-[#9fa0b8] text-right flex items-center justify-end">
                {formatAmount(item.unitPrice, item.originalCurrency)}
              </div>
              <div className="col-span-2 text-sm text-white font-medium text-right flex items-center justify-end">
                {formatAmount(item.totalPrice, item.originalCurrency)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-1.5">
            {(hasAnyDiscount || hasAnyTax || hasAnyShipping || hasAnyAppleFee) && (
              <div className="flex justify-between text-xs text-[#9fa0b8]">
                <span>Subtotal</span>
                <span>{formatAmount(invoice.subtotal, currency)}</span>
              </div>
            )}

            {hasAnyDiscount && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span>
                  Discount
                  {invoice.couponCode && (
                    <span className="ml-1 text-[10px] opacity-80">({invoice.couponCode})</span>
                  )}
                </span>
                <span>-{formatAmount(invoice.discount, currency)}</span>
              </div>
            )}

            {/* Prefer the specific GST breakdown when available; fall back to
                the generic "Tax" row otherwise. */}
            {invoice.gst && invoice.gst.amount > 0 ? (
              <div className="flex justify-between text-xs text-[#9fa0b8]">
                <span>
                  GST ({invoice.gst.rate}%)
                  {invoice.gst.inclusive && (
                    <span className="ml-1 text-[10px] opacity-70">included</span>
                  )}
                </span>
                <span>{formatAmount(invoice.gst.amount, currency)}</span>
              </div>
            ) : hasAnyTax ? (
              <div className="flex justify-between text-xs text-[#9fa0b8]">
                <span>Tax</span>
                <span>{formatAmount(invoice.tax, currency)}</span>
              </div>
            ) : null}

            {invoice.appleFee && invoice.appleFee.amount > 0 && (
              <div className="flex justify-between text-xs text-[#9fa0b8]">
                <span>
                  Apple fee ({invoice.appleFee.rate}%)
                  {invoice.appleFee.inclusive && (
                    <span className="ml-1 text-[10px] opacity-70">included</span>
                  )}
                </span>
                <span>{formatAmount(invoice.appleFee.amount, currency)}</span>
              </div>
            )}

            {hasAnyShipping && (
              <div className="flex justify-between text-xs text-[#9fa0b8]">
                <span>Shipping</span>
                <span>{formatAmount(invoice.shippingCost, currency)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-[#2a2a35]">
              <span>Total</span>
              <span>{formatAmount(invoice.totalAmount, currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
