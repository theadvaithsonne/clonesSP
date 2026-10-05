"use client";

import { Receipt, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinor, isFiatCurrency } from "@/lib/checkout-currencies";

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
  // Multi-HQ ecommerce — populated only on `ecommerce_item` lines
  organizationId?: string;
  storeId?: string;
  vendor?: string;
}

interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  convertedAt: string;
}

export interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  invoiceType: string;
  status: string;
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
  cashbackCodeId?: string;
  customerEmail: string;
  customerName?: string;
  createdAt: string;
  expiresAt?: string;
  // Tax / fee breakdown blocks. Backend stamps these at checkout when GST
  // (INR channels) or Apple's iOS 30% fee applies.
  gst?: { rate: number; amount: number; inclusive: boolean; sacCode?: string };
  appleFee?: { rate: number; amount: number; inclusive: boolean };
  paymentSource?: "web" | "ios" | "android";
}

interface InvoicePreviewProps {
  invoice: InvoiceData;
}

// ============ Component ============

export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  // Per services/invoice.ts::selectPaymentMethod (BE), `subtotal`, `tax`,
  // `shippingCost`, `totalAmount` and line-item prices always stay in
  // `itemCurrency` \u2014 the payment-side conversion is only applied to the
  // Razorpay order amount, and never overwritten on the invoice row.
  // Reading `paymentCurrency` here rendered $5.90 USD cents as "\u20B95.90"
  // when the buyer picked INR (2026-08-03 bug). Use `itemCurrency` for
  // itemised amounts; show the converted total separately below.
  const currency = invoice.itemCurrency;

  const formatAmount = (amount: number, cur: string) => formatMinor(amount, cur);

  // Backend always stores `exchangeRate` as the raw USD→INR rate
  // (~85–95, from open.er-api.com) regardless of the conversion
  // direction — the paise↔cents math itself flips in
  // services/invoice.ts::convertCurrency but the rate field on
  // `currencyConversion` is the same number both ways. That means
  // interpreting it as "1 fromCurrency = exchangeRate toCurrency"
  // fails whenever fromCurrency is INR — labelling "1 INR = 95.59 USD"
  // and multiplying totalAmount by 95.59 turns ₹2,525 into $241,371.
  //
  // The safe read is: `exchangeRate` is the USD price of the non-USD
  // currency. Multiply when converting USD → INR, divide when INR → USD.
  const conversionDisplay = (() => {
    if (!invoice.currencyConversion) return null;
    const { fromCurrency, toCurrency, exchangeRate } = invoice.currencyConversion;
    if (fromCurrency === toCurrency) return null;
    if (fromCurrency !== invoice.itemCurrency) return null;

    let convertedMinorUnits: number;
    if (fromCurrency === "USD" && toCurrency === "INR") {
      convertedMinorUnits = Math.round(invoice.totalAmount * exchangeRate);
    } else if (fromCurrency === "INR" && toCurrency === "USD") {
      convertedMinorUnits = Math.round(invoice.totalAmount / exchangeRate);
    } else if (isFiatCurrency(toCurrency)) {
      // Every other pair (a USD/INR-priced invoice paid in one of the
      // card-only currencies): the BE stores `exchangeRate` in the from→to
      // direction for these — only the legacy USD↔INR pair has the quirk
      // above — so the rate multiplies whichever way the invoice is priced.
      convertedMinorUnits = Math.round(invoice.totalAmount * exchangeRate);
      return {
        rateLabel: `Converted at 1 ${fromCurrency} = ${exchangeRate.toFixed(exchangeRate < 0.1 ? 4 : 2)} ${toCurrency}`,
        convertedCurrency: toCurrency,
        convertedText: formatAmount(convertedMinorUnits, toCurrency),
      };
    } else {
      // Unknown currency — bail rather than render a nonsense number.
      return null;
    }

    // Always render the rate as "1 USD = X INR" — the intuitive
    // direction — regardless of which way the conversion ran.
    const usdSide = fromCurrency === "USD" ? fromCurrency : toCurrency;
    const inrSide = fromCurrency === "USD" ? toCurrency : fromCurrency;

    return {
      rateLabel: `Converted at 1 ${usdSide} = ${exchangeRate.toFixed(2)} ${inrSide}`,
      convertedCurrency: toCurrency,
      convertedText: formatAmount(convertedMinorUnits, toCurrency),
    };
  })();

  // Kept for the existing "Amount charged (X)" summary row.
  const convertedTotalDisplay = conversionDisplay
    ? {
        currency: conversionDisplay.convertedCurrency,
        text: conversionDisplay.convertedText,
      }
    : null;

  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1a1a22] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-[#1a1a22]">
            <Receipt className="h-3.5 w-3.5 text-[#9fa0b8]" />
          </div>
          <span className="text-xs font-medium text-[#6b6b80]">
            {invoice.invoiceNumber}
          </span>
        </div>
        {invoice.isRecurring && (
          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
            {invoice.recurringPeriod}
          </span>
        )}
      </div>

      {/* Line Items */}
      <div className="px-4 py-3 space-y-3">
        {invoice.lineItems.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3">
            {item.itemImage ? (
              <img
                src={item.itemImage}
                alt={item.itemName}
                className="h-10 w-10 rounded-lg object-cover shrink-0 border border-[#2a2a35]"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                <span className="text-[#6b6b80] text-xs font-bold">
                  {item.itemName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {item.itemName}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {item.quantity > 1 && (
                  <div className="text-xs text-[#6b6b80]">
                    Qty: {item.quantity} x {formatAmount(item.unitPrice, item.originalCurrency)}
                  </div>
                )}
                {item.vendor && (
                  <span className="text-[10px] uppercase tracking-wider text-[#9fa0b8] bg-[#1a1a22] border border-[#2a2a35] rounded px-1.5 py-0.5">
                    {item.vendor}
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm font-medium text-white shrink-0">
              {formatAmount(item.totalPrice, item.originalCurrency)}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="px-4 py-3 border-t border-[#1a1a22] space-y-1.5">
        {(() => {
          const gstAmount = invoice.gst?.amount || 0;
          const appleFeeAmount = invoice.appleFee?.amount || 0;
          const showBreakdown =
            invoice.discount > 0 ||
            invoice.tax > 0 ||
            invoice.shippingCost > 0 ||
            gstAmount > 0 ||
            appleFeeAmount > 0;
          if (!showBreakdown) return null;
          return (
            <>
              <div className="flex justify-between text-xs text-[#6b6b80]">
                <span>Subtotal</span>
                <span>{formatAmount(invoice.subtotal, currency)}</span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span className="flex items-center gap-1">
                    Discount
                    {invoice.couponCode && (
                      <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] border border-emerald-500/20">
                        <Tag className="w-2.5 h-2.5" />
                        {invoice.couponCode}
                      </span>
                    )}
                  </span>
                  <span>-{formatAmount(invoice.discount, currency)}</span>
                </div>
              )}

              {/* Prefer the specific GST breakdown when present; fall back
                  to the generic Tax row otherwise. */}
              {invoice.gst && gstAmount > 0 ? (
                <div className="flex justify-between text-xs text-[#6b6b80]">
                  <span>
                    GST ({invoice.gst.rate}%)
                    {invoice.gst.inclusive && (
                      <span className="ml-1 text-[10px] opacity-70">included</span>
                    )}
                  </span>
                  <span>{formatAmount(gstAmount, currency)}</span>
                </div>
              ) : invoice.tax > 0 ? (
                <div className="flex justify-between text-xs text-[#6b6b80]">
                  <span>Tax</span>
                  <span>{formatAmount(invoice.tax, currency)}</span>
                </div>
              ) : null}

              {invoice.appleFee && appleFeeAmount > 0 && (
                <div className="flex justify-between text-xs text-[#6b6b80]">
                  <span>
                    Apple fee ({invoice.appleFee.rate}%)
                    {invoice.appleFee.inclusive && (
                      <span className="ml-1 text-[10px] opacity-70">included</span>
                    )}
                  </span>
                  <span>{formatAmount(appleFeeAmount, currency)}</span>
                </div>
              )}

              {invoice.shippingCost > 0 && (
                <div className="flex justify-between text-xs text-[#6b6b80]">
                  <span>Shipping</span>
                  <span>{formatAmount(invoice.shippingCost, currency)}</span>
                </div>
              )}
            </>
          );
        })()}

        {conversionDisplay && (
          <div className="text-[10px] text-amber-400/70 py-0.5">
            {conversionDisplay.rateLabel}
          </div>
        )}

        <div className={cn(
          "flex justify-between text-sm font-semibold text-white pt-2",
          (invoice.discount > 0 ||
            invoice.tax > 0 ||
            invoice.shippingCost > 0 ||
            (invoice.gst?.amount || 0) > 0 ||
            (invoice.appleFee?.amount || 0) > 0) && "border-t border-[#2a2a35]"
        )}>
          <span>Total</span>
          <span>{formatAmount(invoice.totalAmount, currency)}</span>
        </div>

        {/* Converted total shown when payment currency differs from item
            currency — reassures the buyer that the amount they see in
            Razorpay (the converted one) matches this invoice. */}
        {convertedTotalDisplay && (
          <div className="flex justify-between text-[11px] text-[#9fa0b8]">
            <span>Amount charged ({convertedTotalDisplay.currency})</span>
            <span className="font-medium">≈ {convertedTotalDisplay.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
