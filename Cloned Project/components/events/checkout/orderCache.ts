"use client";

// What the buyer was charged, carried from the checkout page to the
// confirmation page.
//
// The public ticket endpoint returns the ticket and the event, not the order:
// it has no line items, no promo, no tax and no invoice number. Rather than
// widen a public endpoint to expose pricing to anyone holding a QR token, the
// checkout writes its own summary to sessionStorage and the confirmation page
// reads it back. Same tab, same buyer, gone when the tab closes.
//
// Treat it as decoration, never as truth: a buyer who opens the ticket link on
// another device gets no cache, and the confirmation page must still render.

export interface CachedOrderLine {
  label: string;
  amount: number;
}

export interface CachedOrder {
  currency: string;
  lines: CachedOrderLine[];
  subtotal: number;
  discount: number;
  promoCode?: string;
  taxRate: number;
  tax: number;
  total: number;
  /** INV-… number, for the "Download invoice" link. Absent on free tickets. */
  invoiceNumber?: string;
  email: string;
  /**
   * Every ticket the order produced — one per pass type, each with its own QR
   * code. The confirmation page is opened on the first of them and links the
   * rest from here.
   */
  tickets?: Array<{ label: string; token: string }>;
}

const key = (token: string) => `garage:event-order:${token}`;

export function saveOrder(token: string, order: CachedOrder) {
  try {
    sessionStorage.setItem(key(token), JSON.stringify(order));
  } catch {
    // Private mode / quota. The confirmation page degrades on its own.
  }
}

export function loadOrder(token: string): CachedOrder | null {
  try {
    const raw = sessionStorage.getItem(key(token));
    return raw ? (JSON.parse(raw) as CachedOrder) : null;
  } catch {
    return null;
  }
}
