"use client";

import { useState, useEffect, useRef } from "react";
import {
  CHECKOUT_FIAT_CURRENCIES,
  currencySymbol,
  formatMinor,
  isFiatCurrency,
} from "@/lib/checkout-currencies";
import {
  CreditCard,
  Smartphone,
  Bitcoin,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  ArrowRight,
  Shield,
  Store,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import StripeCardForm from "./StripeCardForm";
import {
  listPaymentMethods,
  type SavedStripeMethod,
  type SavedRazorpayToken,
} from "@/lib/payment-methods-api";

// ============ Types ============

interface PaymentPlatform {
  id: string;
  name: string;
  enabled: boolean;
}

interface PaymentMethod {
  category: "card" | "upi" | "crypto" | "wallet";
  platforms: PaymentPlatform[];
  enabled: boolean;
}

interface PaymentOptionsResponse {
  success: boolean;
  currencies: string[];
  methods: Record<string, PaymentMethod[]>;
}

interface StoreWalletInfo {
  orgId: string;
  orgName: string;
  orgIcon?: string;
  balance: number;
  // Currency of this specific wallet row. Cryptobrand orgs expose one
  // row per currency (USD/INR/ETH/BTC) — the picker filters against the
  // invoice's currency before rendering.
  currency: string;
}

// Wallet balances: fiat gets its checkout symbol + 2dp, crypto (ETH/BTC
// store vaults) falls back to "0.0200 ETH".
function formatWalletAmount(amount: number, currency: string): string {
  if (isFiatCurrency(currency)) {
    return `${currencySymbol(currency)}${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(4)} ${currency}`;
}

interface UserWallets {
  // Store vaults only — the Affiliate Vault is not a payment source.
  stores: StoreWalletInfo[];
}

interface PaymentMethodSelectorProps {
  invoiceId: string;
  itemCurrency: string;
  totalAmount: number;
  country?: string;
  /**
   * Set to `"crypto"` when the invoice is intended to be paid ONLY via
   * the crypto tab (e.g. HiFi USDC/USDT applications) — hides the fiat
   * currency tabs and the store-wallet chooser. Read from
   * `invoice.metadata.paymentChannel` upstream. Defaults to `"any"`
   * (existing multi-channel behavior).
   */
  paymentChannel?: "any" | "crypto";
  /**
   * Currencies this invoice's wallet debits are restricted to, from
   * `invoice.metadata.allowedWalletCurrencies` (HiFi and cryptobrand-office
   * invoices set it). Fiat tabs outside the list are hidden, because paying
   * from a USD tab on an INR-locked invoice dead-ends with every wallet
   * debit 400ing.
   *
   * Omit it — as every current caller does — and no filtering happens.
   */
  walletCurrencyLock?: string[];
  /**
   * Server-computed UPI autopay disclosure, or null/undefined when paying this
   * invoice by UPI would NOT establish a mandate.
   *
   * Presence is the eligibility signal: the backend builds this with the same
   * test its mandate-registration branch uses, so the warning shows exactly
   * when a standing debit authority is about to be created — never more, never
   * less. Amounts are server-computed too, so the figure disclosed here cannot
   * drift from the figure actually debited.
   *
   * This prop never GRANTS anything; it only describes. Omit it — as every
   * existing caller does — and no disclosure renders.
   */
  upiAutopayNotice?: {
    /** What they pay today, minor units of `currency`, GST included. */
    firstAmount: number;
    /** What each renewal costs, same basis. Null when unresolved. */
    renewalAmount: number | null;
    currency: string;
    /** "month", "3 months", … */
    renewalEvery: string;
    /** True when today's charge differs from the renewal. */
    differsFromRenewal: boolean;
  } | null;
  onPaymentInitiated: (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    razorpaySubscriptionId?: string;
    // ─── Save-card additions (phase 2) ──────────────────────────────
    // Threaded from BE `selectPaymentMethod` → into CheckoutPaymentStep
    // so the Razorpay popup can open with the right customer/token/save
    // flags. Optional; absent on plain fresh-card checkouts.
    razorpayCustomerId?: string;
    razorpayPreferredTokenId?: string;
    razorpaySave?: boolean;
    /**
     * True when the BE minted a UPI Autopay mandate-registration order rather
     * than a plain one. Consumers MUST pass `recurring: 1` (with
     * `customer_id`) to Razorpay Checkout when this is set — without it the
     * mandate is rejected or silently dropped and the buyer pays with no
     * autopay established. Set only by the mandate branch, never by a client.
     */
    upiAutopay?: boolean;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId: string;
    // Consumers may be async (most open the Razorpay modal). Declared so the
    // awaited call above is honest about what it's waiting on.
  }) => void | Promise<void>;
  customerEmail?: string;
  onError: (error: string) => void;
  disabled?: boolean;
}

// ============ Constants ============

// Step 1 options: fiat currencies + crypto
// Fiat codes are a plain string here (not a literal union): the list lives in
// lib/checkout-currencies.ts and the BE decides which are offered. Anything
// the BE returns that the table doesn't know is dropped before it becomes a
// tile (see `paymentTypes`), so a BE-first deploy can't render a blank card.
type PaymentType = string | "crypto";

type PaymentTypeConfig = {
  label: string;
  sublabel: string;
  flag?: string;
  icon?: typeof Bitcoin;
  gradient: string;
};

const PAYMENT_TYPE_CONFIG: Record<string, PaymentTypeConfig> = {
  ...Object.fromEntries(
    CHECKOUT_FIAT_CURRENCIES.map((c) => [
      c.code,
      { label: c.label, sublabel: c.sublabel, flag: c.flag, gradient: c.gradient },
    ]),
  ),
  crypto: {
    label: "Crypto",
    // Placeholder — the tile below overrides this at render time with a
    // sublabel built from the live GET /crypto/chains response, so a
    // chain going up/down (env var flip on the BE) is reflected here
    // with no FE deploy. Kept as a fallback for the pre-fetch flash.
    sublabel: "USDT (multiple chains)",
    icon: Bitcoin,
    gradient: "from-amber-500/20 to-orange-500/10",
  },
};

// Chain/coin combos the backend can currently accept. Fetched from
// GET /invoices/crypto/chains on mount so a chain going down (env var
// unset on the BE) removes it from the picker with zero FE deploy.
interface CryptoChainOption {
  // "ethereum" / "bitcoin" appear when the BE has HD enabled for that
  // chain — native ETH / native BTC / native POL invoices route through
  // `cryptoNativeEvmWatcher` (or the bitcoin watcher) rather than the
  // stablecoin poller.
  chain: "tron" | "polygon" | "bsc" | "ethereum" | "bitcoin";
  // "POL" is Polygon's native gas coin (renamed from MATIC in Sep 2024).
  // Priced against USD at mint time like ETH/BTC.
  coin: "USDT" | "USDC" | "ETH" | "BTC" | "POL";
  label: string; // e.g. "USDT on Tron", "Native POL on Polygon"
  chainName: string; // e.g. "TRON", "Polygon"
}

// ===== Direct UPI intent (gateway-free, founder-scoped) =====
//
// The mobile UPI-app grid opens the tapped app with a raw upi:// deep link —
// payee, amount and note prefilled. NO payment gateway is involved: money
// goes straight to DIRECT_UPI_VPA's bank account, so the invoice is NOT
// auto-marked paid — reconciliation is manual from the bank/UPI statement
// (the invoice id rides in the transaction note). Because of that, the grid
// is scoped to invoices billed to DIRECT_UPI_ALLOWED_EMAIL only; everyone
// else keeps the normal Pay button → Razorpay popup.
const DIRECT_UPI_VPA = "9599677424@axisb";
const DIRECT_UPI_PAYEE_NAME = "GaragePay";
const DIRECT_UPI_ALLOWED_EMAIL = "shorupan@gmail.com";

// "any" opens the Android system UPI chooser and is hidden on iOS — iOS has
// no generic upi:// chooser, only app-specific schemes work there. Logos are
// official brand wordmarks (public/images/upi/) rendered on a white chip
// since they are drawn for light backgrounds.
const UPI_INTENT_APPS: Array<{
  id: string;
  label: string;
  logo: string;
  androidOnly?: boolean;
}> = [
  { id: "gpay", label: "GPay", logo: "/images/upi/gpay.svg" },
  { id: "phonepe", label: "PhonePe", logo: "/images/upi/phonepe.svg" },
  { id: "paytm", label: "Paytm", logo: "/images/upi/paytm.svg" },
  { id: "any", label: "Other", logo: "/images/upi/upi.svg", androidOnly: true },
];

function buildUpiIntentUrl(
  app: string,
  opts: { amountPaise: number; note: string; isIOS: boolean }
): string {
  const query = [
    `pa=${DIRECT_UPI_VPA}`,
    `pn=${encodeURIComponent(DIRECT_UPI_PAYEE_NAME)}`,
    `am=${(opts.amountPaise / 100).toFixed(2)}`,
    "cu=INR",
    `tn=${encodeURIComponent(opts.note)}`,
  ].join("&");

  switch (app) {
    case "gpay":
      // GPay registers tez:// on Android and gpay:// on iOS.
      return `${opts.isIOS ? "gpay" : "tez"}://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    default:
      // Generic scheme — Android shows the system UPI app chooser.
      return `upi://pay?${query}`;
  }
}

const METHOD_CONFIG: Record<string, { icon: typeof CreditCard; label: string; description: string; gradient: string }> = {
  card: {
    icon: CreditCard,
    label: "Credit / Debit Card",
    description: "Visa, Mastercard, Amex, RuPay",
    gradient: "from-blue-500/20 to-indigo-500/10",
  },
  upi: {
    icon: Smartphone,
    label: "UPI",
    description: "GPay, PhonePe, Paytm, BHIM",
    gradient: "from-emerald-500/20 to-teal-500/10",
  },
  store_wallet: {
    icon: Store,
    label: "Store Vault",
    description: "Pay from a store balance",
    gradient: "from-emerald-500/20 to-teal-500/10",
  },
};

// ============ Component ============

export function PaymentMethodSelector({
  invoiceId,
  itemCurrency,
  totalAmount,
  country,
  onPaymentInitiated,
  onError,
  disabled = false,
  customerEmail,
  paymentChannel = "any",
  walletCurrencyLock,
  upiAutopayNotice,
}: PaymentMethodSelectorProps) {
  const cryptoOnly = paymentChannel === "crypto";
  const isMobile = useIsMobile();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [methods, setMethods] = useState<Record<string, PaymentMethod[]>>({});
  const [cryptoAvailable, setCryptoAvailable] = useState(false);
  // Chain/coin combos accepted by the in-house crypto flow. Empty array
  // = no chains configured on BE (crypto option should hide entirely).
  const [cryptoChains, setCryptoChains] = useState<CryptoChainOption[]>([]);
  // Which chain/coin the user picked in the crypto sub-step. Null until
  // they pick — Pay button stays disabled while null.
  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoChainOption | null>(null);
  // Last (chain, coin) we successfully sent to the BE. Populated in
  // handlePayNow after a crypto select-payment call. Drives the auto-
  // refetch effect below: if the user changes selectedCrypto AFTER the
  // first Pay Now (i.e. they're staring at Tron's address and switch to
  // Polygon), we auto-fire handlePayNow again so the panel + QR update
  // without a second click. Radio-button UX.
  const lastSentCryptoRef = useRef<{ chain: string; coin: string } | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState<PaymentType>(
    cryptoOnly ? "crypto" : (itemCurrency as PaymentType),
  );
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  // Full USD→* table from the same call, for the CAD/EUR/GBP previews.
  // `exchangeRate` (USD→INR) stays as the field the INR paths read.
  const [fxRates, setFxRates] = useState<Record<string, number> | null>(null);

  // Wallet state
  const [wallets, setWallets] = useState<UserWallets | null>(null);
  const [selectedStoreWalletOrgId, setSelectedStoreWalletOrgId] = useState<string | null>(null);
  const [storeVaultExpanded, setStoreVaultExpanded] = useState(false);

  // Currency-switch cleanup: if the buyer flips from USD → INR (or any
  // other pair), the previously-picked store wallet may no longer exist
  // in the newly-eligible list. Clear the selection so we don't submit
  // stale orgId + currency to pay-with-wallet.
  useEffect(() => {
    setSelectedStoreWalletOrgId(null);
    if (selectedMethod === "store_wallet") {
      setSelectedMethod(null);
    }
  }, [selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stripe state — set when select-payment returns a clientSecret.
  // `savedCardFlow` distinguishes the two flows:
  //   false → fresh-card entry, render the full Elements + billing form
  //   true  → saved-card 3DS/OTP completion, render the zero-form
  //           SavedCard3DSConfirm view (auto-fires confirmCardPayment)
  const [stripeIntent, setStripeIntent] = useState<{
    clientSecret: string;
    publishableKey: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    savedCardFlow: boolean;
  } | null>(null);

  // ─── Save-card state (Stripe phase 1) ────────────────────────────────
  // `savedCards` fills on mount from GET /payment-methods. When the user
  // is on USD (Stripe) and has ≥1 saved card, the picker shows a compact
  // "Pay with •••• 4242" row that bypasses the Elements form entirely.
  const [savedCards, setSavedCards] = useState<SavedStripeMethod[]>([]);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  // Default ON so first-time card-payers auto-save. Only surfaced in the
  // fresh-card path (not when a saved card is picked).
  const [saveForFuture, setSaveForFuture] = useState(true);

  // ─── Razorpay saved-card state (phase 2) ─────────────────────────────
  // Parallel to Stripe. Only surfaces when the picker is on INR.
  // Selecting a saved token routes select-payment with the token id;
  // Standard Checkout then opens pre-scoped to that customer's saved
  // cards (Razorpay popup shows them in the "Saved" tab).
  const [savedRazorpayTokens, setSavedRazorpayTokens] = useState<
    SavedRazorpayToken[]
  >([]);
  const [selectedSavedRazorpayTokenId, setSelectedSavedRazorpayTokenId] =
    useState<string | null>(null);
  const [saveRazorpayForFuture, setSaveRazorpayForFuture] = useState(true);

  // Buyer profile — used to pre-fill Stripe billing details (required by India
  // Stripe accounts for export transactions).
  const [buyerProfile, setBuyerProfile] = useState<{
    name?: string;
    email?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  } | null>(null);

  /**
   * Self-fetched UPI autopay disclosure.
   *
   * Deliberately NOT left to the caller. Paying certain INR invoices by UPI
   * registers a standing debit mandate, and the invariant is that this can
   * never happen without the buyer being told. Relying on each surface to pass
   * `upiAutopayNotice` broke that immediately — WalletPageNew renders this
   * component for exactly the combo carts that register mandates and passed
   * nothing, so the disclosure silently vanished on the highest-volume path.
   *
   * Fetching it here means no current or future caller can omit it. The prop
   * still wins when supplied (CheckoutPaymentStep already has the invoice in
   * hand, so it avoids the extra round trip).
   */
  const [fetchedAutopayNotice, setFetchedAutopayNotice] = useState<
    PaymentMethodSelectorProps["upiAutopayNotice"] | null
  >(null);
  const autopayNotice = upiAutopayNotice ?? fetchedAutopayNotice;

  const fetchAutopayNotice = async () => {
    // Only needed when the caller didn't supply it. The endpoint accepts either
    // an ObjectId or an invoice number, so both surfaces work unchanged.
    if (upiAutopayNotice !== undefined || !invoiceId) return;
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) setFetchedAutopayNotice(data.upiAutopayNotice ?? null);
    } catch {
      // Non-fatal: a missing disclosure must never block the fetch of payment
      // options. The mandate branch is BE-side and independent of this call.
    }
  };

  useEffect(() => {
    fetchPaymentOptions();
    fetchExchangeRate();
    fetchWalletBalances();
    fetchBuyerProfile();
    fetchSavedCards();
    fetchAutopayNotice();
  }, []);

  const fetchSavedCards = async () => {
    // Guests / non-authed viewers can't have saved cards — skip cleanly.
    const token = getToken();
    if (!token) return;
    try {
      const res = await listPaymentMethods();
      setSavedCards(res.stripe.methods || []);
      setSavedRazorpayTokens(res.razorpay?.tokens || []);
    } catch {
      // Non-blocking — the picker just won't show a saved-card row.
    }
  };

  const fetchBuyerProfile = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const u = data?.user;
      if (!u) return;
      // Our User schema doesn't store a street line — only city/state/country/postalCode.
      // Pre-fill what we have; Stripe Element will collect the rest.
      setBuyerProfile({
        name: u.name,
        email: u.email,
        address: {
          city: u.city,
          state: u.state,
          postal_code: u.postalCode,
          country: u.country,
        },
      });
    } catch {
      // Best effort — Stripe Element will collect any missing fields.
    }
  };

  const fetchWalletBalances = async () => {
    const token = getToken();
    if (!token) return; // Not authenticated — skip wallet fetching (wallet options hidden)

    try {
      // /wallet/all for store wallets.
      //
      // Pass `?invoiceId=X` on /wallet/all so the backend can materialize
      // the invoice's issuing-org cryptobrand sibling wallets (INR / ETH
      // / BTC) for the buyer on demand. Without the hint, a buyer who
      // isn't a formal member of the seller's cryptobrand office would
      // see the store-wallet chooser render empty on an INR invoice even
      // though the invoice is meant to be paid from an INR wallet.
      const walletAllUrl = invoiceId
        ? `${API_URL}/wallet/all?invoiceId=${encodeURIComponent(invoiceId)}`
        : `${API_URL}/wallet/all`;
      const walletAllRes = await fetch(walletAllUrl, { headers: { Authorization: `Bearer ${token}` } });
      const walletAllData = walletAllRes.ok ? await walletAllRes.json() : null;

      const stores: StoreWalletInfo[] = (walletAllData?.storeWallets || []).map((w: any) => ({
        orgId: typeof w.orgId === "object" && w.orgId?._id ? w.orgId._id : w.orgId,
        orgName: typeof w.orgId === "object" ? w.orgId?.name || "Store" : "Store",
        orgIcon: typeof w.orgId === "object" ? w.orgId?.icon : undefined,
        balance: Number(w.balance) || 0,
        // Cryptobrand orgs expose per-currency wallets on the same org;
        // legacy USD-only wallets have no currency field so we default.
        currency: (w.currency ? String(w.currency) : "USD").toUpperCase(),
      }));

      setWallets({ stores });
    } catch (err) {
      console.warn("Failed to fetch wallet balances:", err);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.rates?.INR) {
        setExchangeRate(data.rates.INR);
        setFxRates(data.rates);
      }
    } catch {
      setExchangeRate(85);
    }
  };

  // Preview conversion between any two fiat currencies, cross-rated
  // through USD the way the BE's convertCurrency does. All five use 1/100
  // minor units so the rate applies to the integer directly. Returns null
  // when the table hasn't loaded — callers fall back to the unconverted
  // amount, matching the existing USD/INR behaviour.
  const previewRate = (from: string, to: string): number | null => {
    if (from === to) return 1;
    if (from === "USD" && to === "INR") return exchangeRate;
    if (from === "INR" && to === "USD") return exchangeRate ? 1 / exchangeRate : null;
    const usdToFrom = from === "USD" ? 1 : fxRates?.[from];
    const usdToTo = to === "USD" ? 1 : fxRates?.[to];
    if (!usdToFrom || !usdToTo) return null;
    return usdToTo / usdToFrom;
  };

  const getDisplayAmount = (): number => {
    if (selectedType === "crypto" || selectedType === itemCurrency) return totalAmount;
    if (!exchangeRate) return totalAmount;
    if (itemCurrency === "USD" && selectedType === "INR") {
      return Math.round((totalAmount / 100) * exchangeRate * 100);
    }
    if (itemCurrency === "INR" && selectedType === "USD") {
      return Math.round(((totalAmount / 100) / exchangeRate) * 100);
    }
    const rate = previewRate(itemCurrency, selectedType);
    return rate ? Math.round(totalAmount * rate) : totalAmount;
  };

  const fetchPaymentOptions = async () => {
    try {
      setOptionsLoading(true);
      const params = new URLSearchParams();
      // Send invoiceId so the BE resolves the buyer's region using the
      // same helper GST uses (server-authoritative). Without it, the
      // route falls back to the FE-passed country hint — fine for
      // callers without an invoice context, but our invoice pay page
      // always has one.
      if (invoiceId) params.set("invoiceId", invoiceId);
      if (country) params.set("country", country);
      if (totalAmount) params.set("amount", String(totalAmount));
      if (itemCurrency) params.set("itemCurrency", itemCurrency);

      const res = await fetch(`${API_URL}/api/invoices/payment-options?${params.toString()}`);
      const data: PaymentOptionsResponse = await res.json();

      if (data.success) {
        setCurrencies(data.currencies);
        setMethods(data.methods);

        // Check if crypto is enabled — across EVERY currency's methods, not
        // just the first. CAD/EUR/GBP are card-only and carry no crypto row,
        // so sniffing whichever currency happened to be listed first hid
        // the crypto tile for everyone.
        const cryptoMethod = Object.values(data.methods)
          .flat()
          .find((m) => m.category === "crypto");
        setCryptoAvailable(!!cryptoMethod?.enabled);

        // Fetch the specific chain/coin combos accepted by the in-house
        // crypto flow. If nothing comes back, force-hide crypto so we
        // don't show a broken option to the user. Non-blocking on the
        // main options load — the crypto card just disappears if this
        // fails.
        fetch(`${API_URL}/api/invoices/crypto/chains`)
          .then((r) => r.json())
          .then((d: { success: boolean; chains?: CryptoChainOption[] }) => {
            const chains = d.chains || [];
            setCryptoChains(chains);
            if (chains.length === 0) setCryptoAvailable(false);
          })
          .catch(() => {
            // BE down or endpoint missing — hide crypto to be safe.
            setCryptoChains([]);
            setCryptoAvailable(false);
          });

        // Crypto-only invoices — never override the initial "crypto"
        // selection with a fiat currency from the server response.
        // Wallet-locked invoices — clamp to a currency the invoice can
        // actually accept (an INR-locked invoice must default to INR
        // even if the server-returned currency list starts with USD).
        if (!cryptoOnly) {
          const lockedList = walletCurrencyLock
            ? data.currencies.filter((c) => walletCurrencyLock.includes(c))
            : data.currencies;
          const initialList = lockedList.length > 0 ? lockedList : data.currencies;
          setSelectedType(
            (initialList.includes(itemCurrency)
              ? itemCurrency
              : initialList[0]) as PaymentType
          );
        }
      }
    } catch {
      setCurrencies(["USD", "INR"]);
      setMethods({
        USD: [
          { category: "card", platforms: [{ id: "razorpay", name: "RazorPay", enabled: true }], enabled: true },
        ],
        INR: [
          { category: "card", platforms: [{ id: "razorpay", name: "RazorPay", enabled: true }], enabled: true },
          { category: "upi", platforms: [{ id: "razorpay", name: "RazorPay", enabled: true }], enabled: true },
        ],
      });
    } finally {
      setOptionsLoading(false);
    }
  };

  // Called when user clicks the main "Pay" button
  const handlePayNow = async () => {
    setLoading(true);
    try {
      // Wallet payment — calls a dedicated endpoint that atomically debits and
      // fulfills. Store Vault only: the Affiliate Vault stopped being a payment
      // source on 19 Sep 2026 (earnings move to the Store Vault first).
      if (selectedMethod === "store_wallet") {
        const token = getToken();
        if (!token) {
          onError("Authentication required to use wallet payments");
          setLoading(false);
          return;
        }

        const body: any = { walletType: "store" };
        {
          if (!selectedStoreWalletOrgId) {
            onError("Please select a store vault to pay from");
            setLoading(false);
            return;
          }
          body.orgId = selectedStoreWalletOrgId;
          // Debit currency = the invoice's selected currency. The BE
          // validates against invoice.metadata.allowedWalletCurrencies
          // (set for HiFi / cryptobrand-locked invoices); passing it
          // unconditionally is safe because legacy USD-only invoices
          // ignore the field entirely.
          body.currency = selectedType === "crypto" ? itemCurrency : selectedType;
        }

        const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/pay-with-wallet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Wallet payment failed");

        // Signal the parent that payment is already complete — no Razorpay modal needed
        onPaymentInitiated({
          walletPaid: true,
          amount: getDisplayAmount(),
          currency: "USD",
          invoiceId,
        });
        return;
      }

      // Non-wallet flows (Razorpay / crypto)
      let body: any;

      if (selectedType === "crypto") {
        // In-house crypto flow. FE picks chain + coin in the sub-step;
        // BE generates a CryptoPaymentRequest with a unique amount-tail
        // and returns { cryptoRequest: { address, amount, expiresAt, ...} }.
        // The CheckoutPaymentStep renders the returned request inline via
        // <CryptoPaymentPanel/>. No hosted-page redirect.
        if (!selectedCrypto) {
          onError("Please pick a crypto network before continuing");
          setLoading(false);
          return;
        }
        body = {
          paymentCurrency: itemCurrency,
          paymentMethodCategory: "crypto",
          paymentPlatform: "crypto_wallet",
          chain: selectedCrypto.chain,
          coin: selectedCrypto.coin,
        };
      } else {
        // ─── Saved-card fast path ────────────────────────────────────
        // If the user picked a saved card, override method selection
        // and route straight to server-side off-session charge. Backend
        // returns { alreadyPaid: true } on success, or a stripeClientSecret
        // if 3DS step-up is required.
        if (selectedSavedCardId) {
          body = {
            paymentCurrency: selectedType,
            paymentMethodCategory: "card",
            paymentPlatform: "stripe",
            savedPaymentMethodId: selectedSavedCardId,
          };
        } else if (selectedSavedRazorpayTokenId) {
          // Razorpay saved-card path: opens Standard Checkout scoped to
          // the founder's Razorpay Customer with a preferred token, so
          // their saved card shows up at the top of the popup's list.
          // Not zero-click — user still OTPs per RBI — but no PAN
          // retyping.
          body = {
            paymentCurrency: "INR",
            paymentMethodCategory: "card",
            paymentPlatform: "razorpay",
            savedRazorpayTokenId: selectedSavedRazorpayTokenId,
          };
        } else {
          // Fiat: need a method selected
          if (!selectedMethod) {
            onError("Please select a payment method");
            setLoading(false);
            return;
          }
          const availableMethods = methods[selectedType] || [];
          const method = availableMethods.find((m) => m.category === selectedMethod);
          const platform = method?.platforms.find((p) => p.enabled)?.id || "razorpay";
          body = {
            paymentCurrency: selectedType,
            paymentMethodCategory: selectedMethod,
            paymentPlatform: platform,
            // Save-for-future — Stripe (USD) OR Razorpay (INR) fresh
            // card. Backend ignores the flag when it doesn't apply.
            ...(platform === "stripe" && selectedMethod === "card" && saveForFuture
              ? { savePaymentMethodForFuture: true }
              : {}),
            ...(platform === "razorpay" &&
            selectedMethod === "card" &&
            selectedType === "INR" &&
            saveRazorpayForFuture
              ? { saveRazorpayCardForFuture: true }
              : {}),
          };
        }
      }

      const token = getToken();
      const res = await fetch(`${API_URL}/api/invoices/${invoiceId}/select-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to initiate payment");

      // ─── Saved-card path outcomes ────────────────────────────────────
      // Server-side off-session charge already fired. Three outcomes:
      //   alreadyPaid: true   → done, tell parent
      //   stripeClientSecret  → 3DS challenge needed; render Elements
      //                          to run stripe.confirmPayment
      //   error               → bubble to caller (throw above)
      if (data.alreadyPaid) {
        onPaymentInitiated({
          stripePaid: true,
          amount: data.amount ?? getDisplayAmount(),
          currency: data.currency ?? selectedType,
          invoiceId,
        });
        setLoading(false);
        return;
      }

      // Stripe path — render embedded form inline instead of bubbling up.
      // Two flavors:
      //   savedCardFlow: true  → the PI already has customer + PM attached
      //     server-side (saved-card charge, INR CIT path). StripeCardForm's
      //     saved3DSOnly view auto-fires confirmCardPayment on mount — no
      //     billing form, no PaymentElement, just the 3DS/OTP challenge.
      //   savedCardFlow: false → fresh-card entry. Full Elements + billing
      //     form + PaymentElement, user types card, then Pay.
      if (data.stripeClientSecret) {
        setStripeIntent({
          clientSecret: data.stripeClientSecret,
          publishableKey: data.stripePublishableKey || "",
          paymentIntentId: data.stripePaymentIntentId || "",
          amount: data.amount,
          currency: data.currency,
          savedCardFlow: !!selectedSavedCardId,
        });
        setLoading(false);
        return;
      }

      // AWAITED deliberately. Consumers' handlers are async and several of them
      // build the Razorpay options object inline — if one throws, an un-awaited
      // call turns it into an unhandled rejection that this try/catch never
      // sees, so `onError` never fires and the buyer gets a Pay button that
      // does nothing, with no toast and no console trace. That exact failure
      // silently killed every post-window combo purchase for three weeks.
      // Awaiting routes consumer failures into the catch below like any other.
      await onPaymentInitiated(data);
      // Stamp the last-sent crypto tuple AFTER success so the auto-refetch
      // effect knows what's currently rendered in the panel above and can
      // detect a user-driven chain change.
      if (selectedType === "crypto" && selectedCrypto) {
        lastSentCryptoRef.current = {
          chain: selectedCrypto.chain,
          coin: selectedCrypto.coin,
        };
      }
    } catch (err: any) {
      onError(err.message || "Payment initiation failed");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refetch on chain switch. Once the user has fired Pay Now for
  // some (chain, coin) — CryptoPaymentPanel now showing the address+QR
  // — picking a DIFFERENT chain in the network grid re-fires
  // handlePayNow automatically. Without this, the address/QR are stale
  // until the user hunts down the Pay Now button and clicks again.
  useEffect(() => {
    if (selectedType !== "crypto") return;
    if (!selectedCrypto) return;
    const last = lastSentCryptoRef.current;
    if (!last) return; // Haven't fired the first Pay Now yet — user still on picker.
    if (last.chain === selectedCrypto.chain && last.coin === selectedCrypto.coin) return;
    if (loading || disabled) return;
    handlePayNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCrypto?.chain, selectedCrypto?.coin]);

  // Direct UPI intent: opens the tapped app with payee + amount + invoice
  // note prefilled via a raw deep link. Gateway-free by design — see the
  // DIRECT_UPI_* constants for the scoping/reconciliation trade-off.
  const handleUpiAppPay = (app: string) => {
    const isIOS =
      typeof navigator !== "undefined" &&
      /iphone|ipad|ipod/i.test(navigator.userAgent);
    window.location.href = buildUpiIntentUrl(app, {
      amountPaise: totalAmount,
      note: `Invoice ${invoiceId}`,
      isIOS,
    });
  };

  const handleStripeSucceeded = async (paymentIntentId: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/invoices/${invoiceId}/confirm-stripe-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Stripe confirmation failed");
      }
      onPaymentInitiated({
        stripePaid: true,
        amount: stripeIntent?.amount ?? totalAmount,
        currency: stripeIntent?.currency ?? itemCurrency,
        invoiceId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm Stripe payment";
      onError(msg);
    }
  };

  const formatAmount = (amount: number, currency: string) => formatMinor(amount, currency);

  // Convert a notice amount (stored in the invoice's itemCurrency) into the
  // currency the buyer is actually paying in. The mandate is registered in
  // INR, so disclosing "$36 every month" while debiting ₹3,170 would state
  // the terms in a currency no charge is ever made in. Same rate and rounding
  // as getDisplayAmount, so the quoted figure matches the Pay button.
  const convertForDisplay = (minor: number, fromCurrency: string): number => {
    if (selectedType === "crypto" || selectedType === fromCurrency) return minor;
    if (!exchangeRate) return minor;
    if (fromCurrency === "USD" && selectedType === "INR") {
      return Math.round((minor / 100) * exchangeRate * 100);
    }
    if (fromCurrency === "INR" && selectedType === "USD") {
      return Math.round((minor / 100 / exchangeRate) * 100);
    }
    const rate = previewRate(fromCurrency, selectedType);
    return rate ? Math.round(minor * rate) : minor;
  };

  // Build list of Step 1 options (fiat + crypto if available).
  // Crypto-only invoices (e.g. HiFi USDC/USDT applications) collapse
  // to a single crypto tile — no fiat option, no wallet chooser.
  //
  // When the invoice locks to specific wallet currencies (HiFi +
  // cryptobrand-office invoices set `metadata.allowedWalletCurrencies`),
  // hide fiat tabs the invoice can't accept — showing USD tab on an
  // INR-locked invoice just leads the buyer to a dead end where all
  // wallet debits 400. Card + UPI go through the currency-matched tab
  // that survives the filter.
  // Only currencies this build knows how to render. A backend that has
  // gained a currency ahead of the frontend must not produce an unlabeled
  // tile — it simply isn't offered until the frontend catches up.
  const knownCurrencies = currencies.filter(isFiatCurrency);
  const currencyLockedTabs = walletCurrencyLock
    ? (knownCurrencies as PaymentType[]).filter((c) =>
        walletCurrencyLock.includes(c),
      )
    : (knownCurrencies as PaymentType[]);
  const paymentTypes: PaymentType[] = cryptoOnly
    ? (["crypto"] as PaymentType[])
    : [
        ...currencyLockedTabs,
        ...(cryptoAvailable ? (["crypto"] as PaymentType[]) : []),
      ];

  // If there's exactly ONE payment type after filtering (invoice is
  // wallet-locked to one currency AND crypto isn't offered), the buyer
  // has no meaningful choice on step 1 — auto-advance to step 2 so
  // they land straight on card/UPI/wallet. Otherwise leave the step
  // indicator alone so the buyer picks between currency + crypto.
  useEffect(() => {
    if (!optionsLoading && paymentTypes.length === 1 && step === 1 && !cryptoOnly) {
      const only = paymentTypes[0];
      if (only !== selectedType) setSelectedType(only);
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsLoading, paymentTypes.join(","), cryptoOnly]);

  const availableMethods = selectedType !== "crypto" ? methods[selectedType] || [] : [];
  // Filter out crypto and wallet — crypto is a top-level option, wallet rendered separately
  const fiatMethods = availableMethods.filter(
    (m) => m.category !== "crypto" && m.category !== "wallet"
  );

  // Wallet availability checks
  //
  // Store wallets are per-currency for cryptobrand orgs — one row per
  // (org, currency) — so the picker filters to wallets whose currency
  // matches the invoice's selected currency (USD invoice → USD wallets,
  // INR invoice → INR wallets, ETH → ETH). Balances compare at parity
  // in the currency's major unit (`getDisplayAmount()` returns the
  // smallest unit).
  //
  // Affiliate wallet stays USD-only — that's still a USD-denominated
  // ledger and there's no per-currency affiliate wallet.
  const displayAmountForCheck = getDisplayAmount();
  const walletAmountInSelectedCurrency =
    selectedType === "crypto" ? 0 : displayAmountForCheck / 100;
  const eligibleStoreWallets = (wallets?.stores || []).filter(
    (s) => selectedType !== "crypto" && s.currency === selectedType,
  );
  const hasStoreWallets = eligibleStoreWallets.length > 0;
  const maxStoreBalance = hasStoreWallets
    ? Math.max(...eligibleStoreWallets.map((s) => s.balance))
    : 0;

  const displayAmount = getDisplayAmount();
  const displayCurrency = selectedType === "crypto" ? itemCurrency : selectedType;
  const isConverted = selectedType !== "crypto" && selectedType !== itemCurrency;

  // Mobile + INR invoice + UPI selected + allowed buyer → replace the Pay
  // button with the direct UPI app grid; tapping an app launches it with the
  // payee and exact invoice amount prefilled. Everyone else (desktop, other
  // buyers, converted currencies) keeps the Pay button → Razorpay popup.
  const upiAppsMode =
    isMobile &&
    selectedType === "INR" &&
    itemCurrency === "INR" &&
    selectedMethod === "upi" &&
    (customerEmail || "").trim().toLowerCase() === DIRECT_UPI_ALLOWED_EMAIL;
  const isAndroid =
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  if (optionsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-10 h-10 rounded-full border-2 border-[#2a2a35] border-t-brand animate-spin" />
        <p className="mt-3 text-sm text-[#6b6b80]">Loading payment options...</p>
      </div>
    );
  }

  // Crypto mode: simpler one-step flow (no Step 2 needed)
  const isCryptoMode = selectedType === "crypto";

  return (
    <div className="space-y-5">
      {/* Step Indicator (hidden in crypto mode since there's only one step) */}
      {!isCryptoMode && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { setStep(1); setSelectedMethod(null); }}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-all",
              step === 1 ? "text-brand" : "text-[#6b6b80] hover:text-[#9fa0b8]"
            )}
          >
            <span className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
              step === 1
                ? "bg-brand text-brand-foreground"
                : step > 1
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-[#1a1a22] text-[#6b6b80]"
            )}>
              {step > 1 ? <Check className="w-3 h-3" /> : "1"}
            </span>
            Currency
          </button>
          <div className="w-8 h-px bg-[#2a2a35]" />
          <button
            onClick={() => setStep(2)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-all",
              step === 2 ? "text-brand" : "text-[#6b6b80]"
            )}
          >
            <span className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
              step === 2 ? "bg-brand text-brand-foreground" : "bg-[#1a1a22] text-[#6b6b80]"
            )}>
              2
            </span>
            Pay
          </button>
        </div>
      )}

      {/* Amount Display */}
      <div className="text-center py-2">
        <div className="text-2xl font-bold text-white">
          {formatAmount(displayAmount, displayCurrency)}
        </div>
        {isConverted && exchangeRate && (
          <p className="text-xs text-[#6b6b80] mt-1">
            {formatAmount(totalAmount, itemCurrency)} at{" "}
            {(() => {
              // Quote the rate in the direction the buyer reads it: one unit
              // of the priced currency in the currency they're paying.
              const rate = previewRate(itemCurrency, displayCurrency);
              return rate
                ? `1 ${itemCurrency} = ${rate.toFixed(rate < 0.1 ? 4 : 2)} ${displayCurrency}`
                : `1 USD = ${exchangeRate.toFixed(2)} INR`;
            })()}
          </p>
        )}
        {isCryptoMode && (
          <p className="text-xs text-[#6b6b80] mt-1">
            Pay with any of 300+ cryptocurrencies
          </p>
        )}
      </div>

      {/* Step 1: Payment Type (Currency + Crypto) */}
      {step === 1 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-200">
          <p className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider">
            Select payment option
          </p>
          <div className={cn(
            "grid gap-3",
            // Mobile-first: 3 cards no longer force `grid-cols-3` on tiny
            // viewports (was clipping/overflowing the modal — see the
            // checkout responsive bug report). 2-col on mobile (2 cards
            // top row, 1 bottom), 3-col from `sm:` upward so desktop is
            // unchanged.
            paymentTypes.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
          )}>
            {paymentTypes.map((type) => {
              const config = PAYMENT_TYPE_CONFIG[type];
              const isSelected = selectedType === type;
              const Icon = config?.icon;
              // Crypto sublabel is derived from the live chains response
              // so a BE-side chain flip (Tron/Polygon/BSC env var
              // unset) is reflected here with no FE deploy. Falls back
              // to the static placeholder pre-fetch and when the
              // response is empty.
              const sublabel =
                type === "crypto" && cryptoChains.length > 0
                  ? cryptoChains
                      .map((c) => `${c.coin} (${c.chainName})`)
                      .join(" · ")
                  : config?.sublabel;
              return (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setSelectedMethod(null);
                  }}
                  disabled={disabled || loading}
                  className={cn(
                    // Tighter padding on mobile so the card content fits
                    // comfortably; `sm:p-4` restores the original desktop
                    // spacing.
                    "relative p-3 sm:p-4 rounded-xl border transition-all duration-200 text-left group min-w-0",
                    isSelected
                      ? "border-brand/50 bg-brand/5"
                      : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45] hover:bg-[#131318]",
                    (disabled || loading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-brand-foreground" />
                    </div>
                  )}
                  {config?.flag ? (
                    <span className="text-xl mb-1.5 block">{config.flag}</span>
                  ) : Icon ? (
                    <div className="mb-1.5">
                      <Icon className="w-5 h-5 text-amber-400" />
                    </div>
                  ) : null}
                  <div className="text-sm font-semibold text-white break-words">
                    {config?.label}
                  </div>
                  <div className="text-[11px] text-[#6b6b80] mt-0.5 break-words">
                    {sublabel}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Crypto coin picker — shown only when crypto is the selected type.
              Lists all chain/coin combos the BE currently accepts (from
              GET /crypto/chains). User must pick one before Pay Now enables. */}
          {isCryptoMode && cryptoChains.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-semibold text-[#9fa0b8] uppercase tracking-wider">
                Choose network
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cryptoChains.map((opt) => {
                  const isSelected =
                    selectedCrypto?.chain === opt.chain &&
                    selectedCrypto?.coin === opt.coin;
                  return (
                    <button
                      key={`${opt.chain}-${opt.coin}`}
                      type="button"
                      onClick={() => setSelectedCrypto(opt)}
                      disabled={disabled || loading}
                      className={cn(
                        "relative text-left px-3 py-2.5 rounded-xl border transition-all",
                        "bg-gradient-to-br from-amber-500/5 to-orange-500/5",
                        isSelected
                          ? "border-brand ring-2 ring-brand/30"
                          : "border-white/[0.08] hover:border-white/[0.16]"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-brand-foreground" />
                        </div>
                      )}
                      <div className="text-sm font-semibold text-white">
                        {opt.coin}
                      </div>
                      <div className="text-[10px] text-[#9fa0b8] mt-0.5">
                        on {opt.chainName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Continue / Pay Button */}
          {isCryptoMode ? (
            <Button
              onClick={handlePayNow}
              disabled={loading || disabled || !selectedCrypto}
              className="w-full h-12 bg-brand hover:opacity-90 text-brand-foreground font-semibold rounded-xl transition-all shadow-lg shadow-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing payment...
                </span>
              ) : !selectedCrypto ? (
                <span>Pick a network to continue</span>
              ) : (
                <span className="flex items-center gap-2">
                  Pay with {selectedCrypto.coin}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(2)}
              disabled={!selectedType || disabled}
              className="w-full h-11 bg-brand hover:opacity-90 text-brand-foreground font-semibold rounded-xl transition-all"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <Shield className="w-3 h-3 text-[#6b6b80]" />
            <span className="text-[10px] text-[#6b6b80]">
              {isCryptoMode
                ? "Secured by NOWPayments. 300+ cryptocurrencies."
                : "Secured by GaragePay. 256-bit encryption."}
            </span>
          </div>
        </div>
      )}

      {/* Step 2: Payment Method (Fiat only) */}
      {step === 2 && !isCryptoMode && (
        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-200">
          <button
            onClick={() => { setStep(1); setSelectedMethod(null); }}
            className="flex items-center gap-1 text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            Change payment option
          </button>

          <p className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider">
            Payment method
          </p>

          {/* ─── Saved cards (Stripe) ─────────────────────────────────
              Shows one row per stored Stripe PaymentMethod. Surfaces on
              both USD and INR now that INR cards also route through
              Stripe India. Currency-filtered by card.country so the
              picker only shows cards that'll actually work well:
                INR → Indian issuers (country === "IN")
                USD → foreign issuers (country !== "IN")
              Legacy rows without country info are shown to both — the
              charge attempt is the source of truth if the card is
              incompatible.
              Clicking a saved card clears selectedMethod so the Pay
              button switches to the saved-card charge path. */}
          {(() => {
            if (savedCards.length === 0 || !isFiatCurrency(selectedType)) {
              return null;
            }
            const filtered = savedCards.filter((c) => {
              // Legacy row (pre-country capture) — show everywhere.
              if (!c.country) return true;
              // INR → Indian issuers. Every other currency (USD and the
              // card-only CAD/EUR/GBP) → foreign issuers, since Stripe
              // India refuses non-INR charges on Indian cards.
              if (selectedType === "INR") return c.country === "IN";
              return c.country !== "IN";
            });
            if (filtered.length === 0) return null;
            return (
            <div className="space-y-1.5">
              {filtered.map((card) => {
                const isSelected = selectedSavedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      // Saved-card path is mutually exclusive with the
                      // regular method picker AND with the Razorpay
                      // saved-token path.
                      setSelectedSavedCardId(card.id);
                      setSelectedSavedRazorpayTokenId(null);
                      setSelectedMethod(null);
                    }}
                    disabled={disabled || loading}
                    className={cn(
                      "relative w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left",
                      isSelected
                        ? "border-brand/50 bg-gradient-to-r from-blue-500/20 to-indigo-500/10"
                        : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45] hover:bg-[#131318] cursor-pointer",
                      (disabled || loading) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isSelected ? "bg-brand/20" : "bg-[#1a1a22]"
                    )}>
                      <CreditCard className={cn(
                        "w-4 h-4",
                        isSelected ? "text-brand" : "text-[#9fa0b8]"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-sm font-medium tabular-nums",
                        isSelected ? "text-white" : "text-[#c9c9ee]"
                      )}>
                        {card.brand
                          ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
                          : "Card"}
                        {" "}•••• {card.last4}
                        {card.isDefault && (
                          <span className="ml-2 text-[10px] text-brand uppercase">Default</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6b6b80]">
                        Expires {String(card.expMonth || "?").padStart(2, "0")}/
                        {String(card.expYear || "?").slice(-2)}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-brand" />
                    )}
                  </button>
                );
              })}
              <div className="pt-1 pb-2 flex items-center gap-2 text-[11px] text-[#6b6b80]">
                <div className="flex-1 h-px bg-[#2a2a35]" />
                <span>or pick another method</span>
                <div className="flex-1 h-px bg-[#2a2a35]" />
              </div>
            </div>
            );
          })()}

          {/* ─── Razorpay saved tokens (phase 2, INR only) ────────────
              Same visual pattern as the Stripe block above. Selecting a
              row opens Standard Checkout scoped to the founder's saved
              cards on Razorpay's side — user picks + OTPs, no PAN
              retyping. */}
          {savedRazorpayTokens.length > 0 && selectedType === "INR" && (
            <div className="space-y-1.5">
              {savedRazorpayTokens.map((token) => {
                const isSelected = selectedSavedRazorpayTokenId === token.id;
                return (
                  <button
                    key={token.id}
                    onClick={() => {
                      setSelectedSavedRazorpayTokenId(token.id);
                      setSelectedSavedCardId(null);
                      setSelectedMethod(null);
                    }}
                    disabled={disabled || loading}
                    className={cn(
                      "relative w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left",
                      isSelected
                        ? "border-brand/50 bg-gradient-to-r from-blue-500/20 to-indigo-500/10"
                        : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45] hover:bg-[#131318] cursor-pointer",
                      (disabled || loading) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isSelected ? "bg-brand/20" : "bg-[#1a1a22]"
                    )}>
                      <CreditCard className={cn(
                        "w-4 h-4",
                        isSelected ? "text-brand" : "text-[#9fa0b8]"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-sm font-medium tabular-nums",
                        isSelected ? "text-white" : "text-[#c9c9ee]"
                      )}>
                        {token.network
                          ? token.network.charAt(0).toUpperCase() +
                            token.network.slice(1)
                          : "Card"}
                        {" "}•••• {token.last4}
                        {token.isDefault && (
                          <span className="ml-2 text-[10px] text-brand uppercase">Default</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6b6b80]">
                        {token.issuer ? `${token.issuer} · ` : ""}Expires{" "}
                        {String(token.expMonth || "?").padStart(2, "0")}/
                        {String(token.expYear || "?").slice(-2)}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-brand" />
                    )}
                  </button>
                );
              })}
              <div className="pt-1 pb-2 flex items-center gap-2 text-[11px] text-[#6b6b80]">
                <div className="flex-1 h-px bg-[#2a2a35]" />
                <span>or pick another method</span>
                <div className="flex-1 h-px bg-[#2a2a35]" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {fiatMethods.map((method) => {
              const config = METHOD_CONFIG[method.category];
              if (!config) return null;
              const Icon = config.icon;
              const isSelected = selectedMethod === method.category;

              return (
                <button
                  key={method.category}
                  onClick={() => {
                    if (!method.enabled) return;
                    // Picking a method clears any saved-card selection so
                    // the two mutually-exclusive paths don't conflict.
                    setSelectedSavedCardId(null);
                    setSelectedSavedRazorpayTokenId(null);
                    setSelectedMethod(method.category);
                  }}
                  disabled={!method.enabled || disabled || loading}
                  className={cn(
                    "relative w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 text-left",
                    !method.enabled
                      ? "border-[#1a1a22] bg-[#0a0a0c] opacity-40 cursor-not-allowed"
                      : isSelected
                      ? "border-brand/50 bg-gradient-to-r " + config.gradient
                      : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45] hover:bg-[#131318] cursor-pointer",
                    (disabled || loading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    isSelected ? "bg-brand/20" : "bg-[#1a1a22]"
                  )}>
                    <Icon className={cn(
                      "w-4 h-4 transition-colors",
                      isSelected ? "text-brand" : "text-[#9fa0b8]"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium transition-colors",
                      isSelected ? "text-white" : "text-[#c9c9ee]"
                    )}>
                      {config.label}
                    </div>
                    <div className="text-[11px] text-[#6b6b80] truncate">
                      {config.description}
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-brand-foreground" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-[#2a2a35] flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {/* ========== Store Vault (expandable) ========== */}
            {hasStoreWallets && (() => {
              const config = METHOD_CONFIG.store_wallet;
              const Icon = config.icon;
              const isSelected = selectedMethod === "store_wallet";
              const storeCount = eligibleStoreWallets.length;
              return (
                <div>
                  <button
                    onClick={() => {
                      if (selectedMethod === "store_wallet" && storeVaultExpanded) {
                        setStoreVaultExpanded(false);
                      } else {
                        setSelectedMethod("store_wallet");
                        setStoreVaultExpanded(true);
                      }
                    }}
                    disabled={disabled || loading}
                    className={cn(
                      "relative w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 text-left",
                      isSelected
                        ? "border-brand/50 bg-gradient-to-r " + config.gradient
                        : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45] hover:bg-[#131318] cursor-pointer",
                      (disabled || loading) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isSelected ? "bg-brand/20" : "bg-[#1a1a22]"
                    )}>
                      <Icon className={cn(
                        "w-4 h-4 transition-colors",
                        isSelected ? "text-brand" : "text-emerald-400"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-white" : "text-[#c9c9ee]"
                      )}>
                        {config.label}
                      </div>
                      <div className="text-[11px] text-[#6b6b80] truncate">
                        {storeCount} vault{storeCount !== 1 ? "s" : ""} · up to {formatWalletAmount(maxStoreBalance, selectedType)}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-[#6b6b80] transition-transform duration-200",
                        storeVaultExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Expanded list of store wallets */}
                  {storeVaultExpanded && (
                    <div className="ml-4 mt-2 space-y-1.5 border-l border-[#2a2a35] pl-3 animate-in slide-in-from-top-1 fade-in duration-200">
                      {eligibleStoreWallets.map((store) => {
                        const enough = store.balance >= walletAmountInSelectedCurrency;
                        const subSelected =
                          isSelected && selectedStoreWalletOrgId === store.orgId;
                        return (
                          <button
                            key={store.orgId}
                            onClick={() => {
                              if (enough) {
                                setSelectedStoreWalletOrgId(store.orgId);
                                setSelectedMethod("store_wallet");
                              }
                            }}
                            disabled={!enough || disabled || loading}
                            className={cn(
                              "relative w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all duration-200 text-left",
                              !enough
                                ? "border-[#1a1a22] bg-[#0a0a0c] opacity-50 cursor-not-allowed"
                                : subSelected
                                ? "border-brand/50 bg-brand/5"
                                : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45] cursor-pointer"
                            )}
                          >
                            {store.orgIcon ? (
                              <img
                                src={store.orgIcon}
                                alt={store.orgName}
                                className="w-6 h-6 rounded-md object-cover border border-[#2a2a35] shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-md bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                                <span className="text-[10px] text-[#6b6b80] font-semibold">
                                  {store.orgName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="flex-1 text-xs text-white truncate">
                              {store.orgName}
                            </span>
                            <span className={cn(
                              "text-[11px] font-semibold tabular-nums",
                              enough ? "text-emerald-300" : "text-amber-500/70"
                            )}>
                              {formatWalletAmount(store.balance, store.currency)}
                              {!enough && <span className="ml-1 text-[9px]">low</span>}
                            </span>
                            {subSelected && (
                              <div className="w-4 h-4 rounded-full bg-brand flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-brand-foreground" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {stripeIntent ? (
            <div className="space-y-3">
              <StripeCardForm
                clientSecret={stripeIntent.clientSecret}
                publishableKey={stripeIntent.publishableKey}
                amount={stripeIntent.amount}
                currency={stripeIntent.currency}
                customerEmail={customerEmail || buyerProfile?.email}
                customerName={buyerProfile?.name}
                customerAddress={buyerProfile?.address}
                onPaid={handleStripeSucceeded}
                onError={(msg) => onError(msg)}
                saved3DSOnly={stripeIntent.savedCardFlow}
              />
              <button
                type="button"
                onClick={() => setStripeIntent(null)}
                className="w-full text-xs text-gray-400 hover:text-white transition-colors"
              >
                Use a different payment method
              </button>
            </div>
          ) : upiAppsMode ? (
            /* Direct UPI app grid (mobile, scoped) — tapping an app opens it
               with payee + amount prefilled via a raw upi:// deep link. */
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider">
                Choose your UPI app
              </p>
              <div className={cn("grid gap-2", isAndroid ? "grid-cols-4" : "grid-cols-3")}>
                {UPI_INTENT_APPS.filter((a) => !a.androidOnly || isAndroid).map(
                  (app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => handleUpiAppPay(app.id)}
                      disabled={loading || disabled}
                      aria-label={`Pay with ${app.label}`}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-[#2a2a35] bg-[#0e0e12] hover:border-brand/40 hover:bg-[#131318] transition-all",
                        (loading || disabled) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className="w-full h-10 rounded-lg bg-white flex items-center justify-center px-2">
                        <img
                          src={app.logo}
                          alt={app.label}
                          className="h-5 max-w-full object-contain"
                        />
                      </span>
                      <span className="text-[11px] text-[#c9c9ee]">{app.label}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
          <>
          {/* Save-for-future checkbox — only surfaces when the user is
              about to enter a fresh card via Stripe (USD + card selected,
              no saved card picked). Auth-required: guests skip. Default
              ON so first-time card-payers get the saved-card upgrade on
              their next invoice automatically. */}
          {(() => {
            const card = fiatMethods.find((m) => m.category === "card");
            const stripeAvailable = !!card?.platforms?.some(
              (p) => p.id === "stripe" && p.enabled,
            );
            const razorpayAvailable = !!card?.platforms?.some(
              (p) => p.id === "razorpay" && p.enabled,
            );
            const authed = !!getToken();
            const noSavedPicked = !selectedSavedCardId && !selectedSavedRazorpayTokenId;
            const onFreshCard =
              authed && selectedMethod === "card" && noSavedPicked;

            // Stripe fresh-card — now covers both USD and INR since INR
            // routes to Stripe India after the cards-to-Stripe cutover.
            // Same `setup_future_usage: off_session` + `customer` on the
            // PI, same webhook, same User doc persist. Card saved in one
            // currency is chargeable in the other via the same PM.
            if (onFreshCard && stripeAvailable && isFiatCurrency(selectedType)) {
              return (
                <label className="flex items-center gap-2 p-2 text-xs text-[#c9c9ee] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveForFuture}
                    onChange={(e) => setSaveForFuture(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#2a2a35] bg-[#0e0e12] accent-brand cursor-pointer"
                  />
                  <span>
                    Save this card for future payments
                    <span className="text-[10px] text-[#6b6b80] ml-1.5">
                      (charged only when you approve)
                    </span>
                  </span>
                </label>
              );
            }

            // Razorpay fresh-card (INR) — dead code path since cards now
            // route to Stripe on INR too. Kept as a fallback so if the
            // getPaymentOptions currency-platform routing is ever reverted
            // to Razorpay-for-INR, this checkbox reappears automatically.
            if (onFreshCard && razorpayAvailable && selectedType === "INR") {
              return (
                <label className="flex items-center gap-2 p-2 text-xs text-[#c9c9ee] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveRazorpayForFuture}
                    onChange={(e) => setSaveRazorpayForFuture(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-[#2a2a35] bg-[#0e0e12] accent-brand cursor-pointer"
                  />
                  <span>
                    Save this card for future payments
                    <span className="text-[10px] text-[#6b6b80] ml-1.5">
                      (Razorpay will show it in your saved cards next time)
                    </span>
                  </span>
                </label>
              );
            }

            return null;
          })()}

          {/* UPI autopay disclosure — UPI ONLY, and only when the server says
              this payment will actually establish a mandate.
              No checkbox, because there is no choice to offer: the buyer
              authorises the mandate inside their UPI app, which is intrinsic
              to the rail. What we owe them is the real numbers, before they
              pay — today's charge and the recurring one — not the ₹50,000
              mandate ceiling, which describes nothing they'll be billed. */}
          {autopayNotice && selectedType === "INR" && selectedMethod === "upi" && (
            // `min-w-0` on the text column is load-bearing: a flex child
            // defaults to min-width:auto, so the long disclosure refused to
            // wrap and ran off the right edge of the card, clipping the
            // sentence mid-word. Stacked into three short lines rather than one
            // run-on — the two amounts are the part a buyer actually needs to
            // read before authorising a standing debit.
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-brand/20 bg-brand/4">
              <Repeat className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-semibold text-white leading-snug">
                  Autopay will be set up for renewals
                </p>
                {autopayNotice.renewalAmount != null && (
                  <p className="text-[11px] leading-snug text-[#c9c9ee]">
                    {autopayNotice.differsFromRenewal ? (
                      <>
                        <span className="font-medium text-white">
                          {formatAmount(
                            convertForDisplay(autopayNotice.firstAmount, autopayNotice.currency),
                            selectedType,
                          )}
                        </span>{" "}
                        today, then{" "}
                        <span className="font-medium text-white">
                          {formatAmount(
                            convertForDisplay(autopayNotice.renewalAmount, autopayNotice.currency),
                            selectedType,
                          )}
                        </span>{" "}
                        every {autopayNotice.renewalEvery}
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-white">
                          {formatAmount(
                            convertForDisplay(autopayNotice.renewalAmount, autopayNotice.currency),
                            selectedType,
                          )}
                        </span>{" "}
                        every {autopayNotice.renewalEvery}
                      </>
                    )}
                  </p>
                )}
                <p className="text-[10px] leading-snug text-[#8a8aa3]">
                  Approve once in your UPI app · cancel anytime from Payment Methods. Turning
                  autopay off keeps your subscription — you just pay each invoice by hand.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handlePayNow}
            disabled={
              (!selectedMethod && !selectedSavedCardId && !selectedSavedRazorpayTokenId) ||
              loading ||
              disabled ||
              (selectedMethod === "store_wallet" && !selectedStoreWalletOrgId)
            }
            className={cn(
              "w-full h-12 rounded-xl font-semibold text-base transition-all duration-200",
              (selectedMethod || selectedSavedCardId || selectedSavedRazorpayTokenId)
                ? "bg-brand hover:opacity-90 text-brand-foreground shadow-lg shadow-brand/10"
                : "bg-[#1a1a22] text-[#6b6b80] cursor-not-allowed"
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {selectedMethod === "store_wallet" && selectedStoreWalletOrgId ? (
                  <>
                    Pay {formatWalletAmount(walletAmountInSelectedCurrency, selectedType)} from{" "}
                    {eligibleStoreWallets.find((s) => s.orgId === selectedStoreWalletOrgId)?.orgName || "Vault"}
                  </>
                ) : selectedSavedCardId || selectedSavedRazorpayTokenId ? (
                  <>
                    Pay {formatAmount(displayAmount, displayCurrency)} with saved card
                    {isConverted && <span className="text-xs opacity-60">~</span>}
                  </>
                ) : (
                  <>
                    Pay {formatAmount(displayAmount, displayCurrency)}
                    {isConverted && <span className="text-xs opacity-60">~</span>}
                  </>
                )}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
          </>
          )}

          {!stripeIntent && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <Shield className="w-3 h-3 text-[#6b6b80]" />
              <span className="text-[10px] text-[#6b6b80]">
                {selectedMethod === "store_wallet"
                  ? "Instant payment from your wallet balance."
                  : "Secured by GaragePay. 256-bit encryption."}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
