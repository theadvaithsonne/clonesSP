// Passes this browser checked out, kept so Purchases can always show them.
//
// Purchases reads paid orders from the invoice feed and resolves their passes
// through the public ticket lookup, which matches an invoice number against an
// ATTENDEE's email. A buyer who booked only for other people is on no seat, so
// that lookup can't find their order; and a free registration raises no
// invoice at all. The in-app checkout records every order it completes here,
// and Purchases falls back to it for exactly those two cases.
//
// Only QR tokens and labels are stored — the same credential the ticket link
// already carries — scoped per signed-in user.

export interface StoredPass {
  token: string;
  tierName: string;
  attendeeName: string;
}

export interface StoredOrder {
  /** Invoice number for a paid order, else the first pass's token. */
  key: string;
  slug: string;
  eventName: string;
  invoiceNumber?: string;
  passes: StoredPass[];
  savedAt: string;
}

const storageKey = (userId: string) => `garage:event-orders:${userId || "anon"}`;

export function loadStoredOrders(userId: string): StoredOrder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveStoredOrder(userId: string, order: StoredOrder) {
  try {
    const rest = loadStoredOrders(userId).filter((o) => o.key !== order.key);
    localStorage.setItem(storageKey(userId), JSON.stringify([order, ...rest]));
  } catch {
    // Private mode / quota — Purchases just won't have the fallback.
  }
}
