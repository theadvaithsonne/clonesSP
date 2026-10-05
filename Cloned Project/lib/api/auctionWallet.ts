/**
 * Auction Wallet — one prepaid USD balance per buyer, spanning every store and
 * every auction they've ever bid on. Lives on the MAIN Garage backend
 * (NEXT_PUBLIC_API_URL), not the store backend: it's a Garage-wide balance,
 * topped up with a Garage Invoice.
 *
 * `balance` is the spendable figure. `lockedBalance` mirrors what has already
 * physically moved into platform escrow against this user's live bids, so it
 * is NOT part of `balance` — never add the two together.
 */

import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const base = () => API_URL.replace(/\/$/, "");

async function walletFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Sign in to use your Auction Wallet");
  const res = await fetch(`${base()}${path}`, {
    ...opts,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { success?: boolean })?.success === false) {
    throw new Error(
      (data as { error?: string; message?: string })?.error ||
        (data as { message?: string })?.message ||
        `Request failed (${res.status})`
    );
  }
  return data as T;
}

export interface AuctionWalletBalance {
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  currency: string;
  exists: boolean;
  lastTransactionAt: string | null;
}

/** Reads the balance; the backend lazy-creates the wallet on first call. */
export async function getAuctionWalletBalance(): Promise<AuctionWalletBalance> {
  const data = await walletFetch<AuctionWalletBalance & { success: true }>(
    "/wallet/auction/balance"
  );
  return {
    balance: data.balance ?? 0,
    lockedBalance: data.lockedBalance ?? 0,
    availableBalance: data.availableBalance ?? data.balance ?? 0,
    currency: data.currency || "USD",
    exists: Boolean(data.exists),
    lastTransactionAt: data.lastTransactionAt ?? null,
  };
}

export interface AuctionTopupResult {
  invoice: {
    _id: string;
    invoiceNumber?: string;
    totalAmount?: number;
    itemCurrency?: string;
    status?: string;
  };
  payUrl: string;
}

/**
 * Start a top-up. Mints a Garage Invoice and hands back its hosted checkout
 * URL — the balance lands once that invoice is paid, at which point the bidder
 * comes back to the room and taps Bid again. amountCents is USD cents,
 * $1–$10,000.
 */
export async function topupAuctionWallet(
  amountCents: number
): Promise<AuctionTopupResult> {
  const data = await walletFetch<
    { success: true } & AuctionTopupResult
  >("/wallet/auction/topup", {
    method: "POST",
    body: JSON.stringify({ amountCents }),
  });
  return { invoice: data.invoice, payUrl: data.payUrl };
}
