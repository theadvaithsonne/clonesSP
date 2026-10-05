"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Send,
  History,
  X,
  RefreshCw,
  Loader2,
  Zap,
  CheckCircle2,
  Check,
  Lock,
  Package,
  Search,
  UserPlus,
  Plus,
  Minus,
  ChevronDown,
  Building2,
  TicketPercent,
  Clock,
  Copy,
  Tag,
  Sparkles,
  Gift,
  RotateCcw,
  ListFilter,
  Download,
  QrCode,
} from "lucide-react";
import { exportRowsAsCsv } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import {
  getAllWallets,
  getStoreWalletTransactions,
  getAffiliateWalletTransactions,
  getAffiliateWalletBalance,
  getUnilevelPlusProduct,
  createUnilevelPlusOrder,
  verifyUnilevelPlusPayment,
  getReserveLicenses,
  getReserveStats,
  assignReserveLicense,
  searchUsersForAssignment,
  transferStoreCredits,
  transferAffiliateToStore,
  searchUsersForTransfer,
  getTransferTargets,
  type TransferTarget,
  getMyWithdrawals,
  getWithdrawableBalance,
  type StoreWalletData,
  type AffiliateWalletData,
  type WalletTransaction,
  type UnilevelPlusProduct,
  type ReserveLicense,
} from "@/lib/feed-api";
import {
  FreeMonthBanner,
  BundlePicker,
} from "@/components/dashboard/UnilevelPlusOfferPanel";
import { getOrgId } from "@/lib/auth";
import { getPageCache, setPageCache } from "@/lib/revenue-network-cache";
import {
  fetchContentRewardsBalance,
  fetchContentRewardsTransactions,
  transferContentRewards,
  type ContentRewardsBalance,
} from "@/lib/content-rewards-api";
import { PayoutAccountsSection } from "./PayoutAccountsSection";
import { WithdrawalPreferenceSection } from "./WithdrawalPreferenceSection";
import { RewardsTab } from "./RewardsTab";
import { CashbackCodesTab } from "./CashbackCodesTab";
import { TopUpStoreWalletSheet } from "./TopUpStoreWalletSheet";
import { DepositCryptoSheet } from "./DepositCryptoSheet";
import { MultiCurrencyTransferSheet } from "./MultiCurrencyTransferSheet";
import {
  getStoreWalletCurrencies,
  transferStoreWalletMulti,
  type StoreWalletCurrencyEntry,
} from "@/lib/feed-api";
import { ArrowLeftRight } from "lucide-react";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { PaymentMethodsPanel } from "@/components/dashboard/PaymentMethodsPanel";
import { PlatformCouponInput } from "@/components/ui/platform-coupon-input";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { getBrandHex } from "@/lib/brand-color-context";

interface DisplayWallet {
  _id: string;
  balance: number;
  currency: string;
  isActive: boolean;
  totalEarnings?: number;
}

interface DisplayTransaction {
  _id: string;
  amount: number;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  balanceBefore?: number;
  balanceAfter?: number;
  receiptUrl?: string;
  relatedUser?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  metadata?: {
    bonusType?: string;
    legNumber?: number;
    level?: number;
    campaignTitle?: string;
    /**
     * WalletTransaction row-kind. `"crypto_wallet_topup"` is stamped by
     * the crypto backend's `creditUserWalletFromTopup` — used by the
     * "Deposits" filter chip below.
     */
    kind?: string;
    /** For store-wallet cashback credits — stamped by executeCashback. */
    source?: string;
    /**
     * Present on a commission the member did not get to keep — stamped by
     * services/commissionForfeiture.ts. The row is a `debit` that cancels a
     * commission credited moments before, and its `description` already says
     * why ("Lost commission — no Unilevel Plus licence", etc.).
     */
    forfeiture?: {
      reason: "no_licence" | "no_networkchain" | "cascade_to_upline";
      grossAmount?: number;
      forfeitedAmount?: number;
      toUserId?: string | null;
    };
    cashbackCodeId?: string;
    invoiceId?: string;
    /**
     * Present when the NetworkChain coverage split fired on a commission.
     * "retained": this member had no live NetworkChain subscription and kept
     * half. "forwarded": this is the half passed up from `fromUser`.
     */
    networkChainSplit?: {
      role: "retained" | "forwarded";
      originalAmount?: number;
      fromUser?: { _id: string; name: string | null } | null;
    };
  } | null;
}

// Expand a withdrawal into two display rows (net payout + processing fee),
// each carrying the withdrawal status + receipt. Shown in the user's feed.
function withdrawalToDisplayRows(w: import("@/lib/feed-api").MyWithdrawal): DisplayTransaction[] {
  const statusNote =
    w.status === "rejected" ? " · refunded" : w.status === "initiated" ? " · pending" : "";
  return [
    {
      _id: `wd-${w._id}-net`,
      amount: w.netAmount / 100,
      type: "withdrawal",
      status: w.status,
      description: `Withdrawal${statusNote}`,
      createdAt: w.createdAt,
      receiptUrl: w.receiptUrl || undefined,
    },
    {
      _id: `wd-${w._id}-fee`,
      amount: w.feeAmount / 100,
      type: "withdrawal",
      status: w.status,
      description: `Withdrawal processing fee (${w.feePercent}%)`,
      createdAt: w.createdAt,
    },
    // One row per admin-added tax/deduction line.
    ...(w.taxes || []).map((t, i) => ({
      _id: `wd-${w._id}-tax-${i}`,
      amount: t.amount / 100,
      type: "withdrawal",
      status: w.status,
      description: t.label,
      createdAt: w.createdAt,
    })),
  ];
}

// Feature flag: set to false to enable reserve license assignment
const RESERVE_ASSIGNMENT_DISABLED = false;

// 18% GST is applied on top of the Unilevel Plus plan price. See backend
// GST_CONFIG.rate (garagenew-backend/src/utils/gstTax.ts). We recompute
// locally for button labels shown BEFORE create-order fires; the actual
// GST-inclusive total comes back from the BE as `razorpayOrder.amount`.
const UP_GST_MULT = 1.18;
const upTotalWithGst = (basePrice: number) =>
  Math.round(basePrice * UP_GST_MULT * 100) / 100;

interface WalletDisplayData {
  wallet: DisplayWallet;
  recentTransactions: DisplayTransaction[];
}

type WalletTab =
  | "store"
  | "affiliate"
  | "content_rewards"
  | "reserve"
  | "rewards"
  | "cashback_codes"
  | "payment_methods";

export function WalletPage() {

  return <WalletPageInternal />;
}

function WalletPageInternal() {
  const initialTab: WalletTab = (() => {
    if (typeof window === "undefined") return "affiliate";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t === "rewards" ||
      t === "store" ||
      t === "reserve" ||
      t === "affiliate" ||
      t === "content_rewards" ||
      t === "cashback_codes" ||
      t === "payment_methods"
      ? (t as WalletTab)
      : "affiliate";
  })();
  const [activeTab, setActiveTab] = useState<WalletTab>(initialTab);
  const [walletData, setWalletData] = useState<WalletDisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Store the raw wallet data from API
  const [storeWallets, setStoreWallets] = useState<StoreWalletData[]>([]);
  const [affiliateWallet, setAffiliateWallet] = useState<AffiliateWalletData | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  // Affiliate transactions pagination
  const [affiliateTxOffset, setAffiliateTxOffset] = useState(0);
  const [affiliateTxTotal, setAffiliateTxTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Store transactions pagination
  const [storeTxOffset, setStoreTxOffset] = useState(0);
  const [storeTxTotal, setStoreTxTotal] = useState(0);

  // Content Rewards transactions pagination
  const [contentRewardsTxOffset, setContentRewardsTxOffset] = useState(0);
  const [contentRewardsTxTotal, setContentRewardsTxTotal] = useState(0);
  const [contentRewardsBalance, setContentRewardsBalance] = useState<ContentRewardsBalance | null>(null);
  // Matured (withdrawable) balance in cents for the active wallet tab.
  const [withdrawableCents, setWithdrawableCents] = useState<number | null>(null);

  // Recent feed filter — lets the user narrow the merged transactions list to
  // just earnings (money-in) or just withdrawals. "all" is the default.
  type FeedFilter = "all" | "earnings" | "withdrawals" | "deposits";
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");

  // Send Credits Modal States
  const [showSendModal, setShowSendModal] = useState(false);
  const [showTopUpSheet, setShowTopUpSheet] = useState(false);
  // Deposit-crypto sheet (persistent per-user address, cryptobrand only).
  // Distinct from TopUpStoreWalletSheet — no invoice, no Razorpay/Stripe,
  // just QR + address for the currently-selected crypto currency wallet.
  const [showDepositCryptoSheet, setShowDepositCryptoSheet] = useState(false);

  // ─── Multi-currency wallet (cryptobrand offices) ─────────────────
  // Fetched per org when the Store tab is active. Non-cryptobrand
  // orgs return a single USD entry; cryptobrand orgs return four
  // (USD parent + INR/ETH/BTC siblings). The Convert button below
  // only surfaces when this array has more than one entry.
  const [currentOrgCurrencies, setCurrentOrgCurrencies] = useState<
    StoreWalletCurrencyEntry[]
  >([]);
  const [currentOrgIsCryptobrand, setCurrentOrgIsCryptobrand] = useState(false);
  const [showConvertSheet, setShowConvertSheet] = useState(false);
  const [showMultiTransferSheet, setShowMultiTransferSheet] = useState(false);
  // Which currency wallet the Store tab is viewing right now. Defaults
  // to USD (the parent, and the only wallet non-cryptobrand orgs have).
  // Clicking a chip in the multi-currency roster changes this, which
  // refetches balance + tx history for that specific sibling.
  const [selectedStoreCurrency, setSelectedStoreCurrency] = useState<string>("USD");
  const [sendAmount, setSendAmount] = useState("");
  const [sendDescription, setSendDescription] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendRecipient, setSendRecipient] = useState<{ _id: string; name: string; email: string; profilePicture?: string } | null>(null);
  const [sendSearchQuery, setSendSearchQuery] = useState("");
  const [sendSearchResults, setSendSearchResults] = useState<any[]>([]);
  const [sendSearching, setSendSearching] = useState(false);
  const [sendStep, setSendStep] = useState<"form" | "confirm" | "success">("form");
  const [sendProcessing, setSendProcessing] = useState(false);
  // Recipient's selectable destination wallets (Store per-org + Content Rewards; Affiliate excluded).
  const [sendTargets, setSendTargets] = useState<TransferTarget[]>([]);
  const [sendTargetsLoading, setSendTargetsLoading] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TransferTarget | null>(null);

  // ─── Send Credits: source + target currency (cryptobrand offices) ──
  // Source currency = which of MY sibling wallets in `currentOrgId` funds
  // the transfer. Target currency = which sibling wallet on the recipient
  // side receives it. USD/USD keeps the legacy `transferStoreCredits`
  // path; anything else routes through `transferStoreWalletMulti` and the
  // backend does the FX + auto-provisioning.
  const [sendFromCurrency, setSendFromCurrency] = useState<string>("USD");
  const [sendToCurrency, setSendToCurrency] = useState<string>("USD");

  // Affiliate to Store Transfer Modal States
  const [showAffiliateTransferModal, setShowAffiliateTransferModal] = useState(false);
  const [affTransferAmount, setAffTransferAmount] = useState("");
  const [affTransferOrgId, setAffTransferOrgId] = useState<string | null>(null);
  const [affTransferProcessing, setAffTransferProcessing] = useState(false);
  const [affTransferError, setAffTransferError] = useState<string | null>(null);
  const [affOrgPickerOpen, setAffOrgPickerOpen] = useState(false);

  // Content Rewards Transfer Modal States — earner moves NcWallet balance
  // into their own Store or Affiliate wallet. Backend keys both sides on
  // me.userId, so this is self-only and safe for any authenticated user.
  const [showCrTransferModal, setShowCrTransferModal] = useState(false);
  const [crTransferAmount, setCrTransferAmount] = useState("");
  const [crTransferDestination, setCrTransferDestination] = useState<"store" | "affiliate">("affiliate");
  const [crTransferOrgId, setCrTransferOrgId] = useState<string | null>(null);
  const [crTransferNote, setCrTransferNote] = useState("");
  const [crTransferProcessing, setCrTransferProcessing] = useState(false);
  const [crTransferError, setCrTransferError] = useState<string | null>(null);
  const [crOrgPickerOpen, setCrOrgPickerOpen] = useState(false);

  // Unilevel Plus Product state
  const [upProduct, setUpProduct] = useState<UnilevelPlusProduct | null>(null);
  const [upAssignedBy, setUpAssignedBy] = useState<{ _id: string; name: string; email: string; profilePicture?: string } | null>(null);
  const [upLoading, setUpLoading] = useState(false);
  const [upProcessing, setUpProcessing] = useState(false);

  // Reserve licenses state
  const [reserveLicenses, setReserveLicenses] = useState<ReserveLicense[]>([]);
  const [reserveStats, setReserveStats] = useState<{ available: number; assigned: number; total: number } | null>(null);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [upQuantity, setUpQuantity] = useState(1);

  // Rewards rendering is delegated to <RewardsTab />, which fetches its own
  // data from /me/rewards. No state needed here for that tab.

  // Assignment state
  const [assigningLicenseId, setAssigningLicenseId] = useState<string | null>(null);
  const [assignSearchQuery, setAssignSearchQuery] = useState("");
  const [assignSearchResults, setAssignSearchResults] = useState<any[]>([]);
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Affiliate wallet gating state
  const [affiliateGating, setAffiliateGating] = useState<{
    hasPurchasedUnilevelPlus: boolean;
    purchasedAt: string | null;
    balance: number;
    redeemableBalance: number;
    lockedBalance: number;
  } | null>(null);

  const AFFILIATE_TX_PAGE_SIZE = 10;
  const CONTENT_REWARDS_TX_PAGE_SIZE = 10;
  const STORE_TX_PAGE_SIZE = 10;

  const fetchWalletData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }

    const orgId = getOrgId();
    const cacheKey = `wallet:${orgId}:${activeTab}`;

    // Show cached data immediately while fresh data loads in background
    if (!isRefresh) {
      const cached = getPageCache<{ walletData: WalletDisplayData; storeWallets: StoreWalletData[]; affiliateWallet: AffiliateWalletData | null }>(cacheKey);
      if (cached) {
        setWalletData(cached.walletData);
        setStoreWallets(cached.storeWallets || []);
        setAffiliateWallet(cached.affiliateWallet);
        setLoading(false);
      }
    }

    try {
      // Get orgId from localStorage
      setCurrentOrgId(orgId);

      // Fetch all wallets from roam-backend
      const walletsResult = await getAllWallets();

      const freshStoreWallets = walletsResult.storeWallets || [];
      const freshAffiliateWallet = walletsResult.affiliateWallet || null;
      setStoreWallets(freshStoreWallets);
      setAffiliateWallet(freshAffiliateWallet);

      let freshWalletData: WalletDisplayData | null = null;

      // Get transactions based on active tab
      if (activeTab === "store" && orgId) {
        // Find the store wallet for current org
        const currentStoreWallet = freshStoreWallets.find((w) => {
          const walletOrgId = w.orgId && typeof w.orgId === "object" ? w.orgId._id : w.orgId;
          return walletOrgId === orgId;
        });

        // Fetch store transactions
        const txResult = await getStoreWalletTransactions(orgId, {
          limit: STORE_TX_PAGE_SIZE,
          offset: 0,
        });
        setStoreTxTotal(txResult.total || 0);
        setStoreTxOffset(STORE_TX_PAGE_SIZE);

        freshWalletData = {
          wallet: {
            _id: currentStoreWallet?._id || "",
            balance: currentStoreWallet?.balance || 0,
            currency: currentStoreWallet?.currency || "USD",
            isActive: currentStoreWallet?.isActive ?? true,
          },
          recentTransactions: (txResult.transactions || []).map((tx: any) => ({
            _id: tx._id,
            amount: tx.amount,
            type: tx.type,
            status: tx.status,
            description: tx.description,
            createdAt: tx.createdAt,
            balanceBefore: tx.balanceBefore,
            balanceAfter: tx.balanceAfter,
            relatedUser: tx.relatedUserId ? {
              _id: tx.relatedUserId._id,
              name: tx.relatedUserId.name,
              email: tx.relatedUserId.email,
            } : null,
            // Carry through metadata.source so the row can render a
            // distinct "Cashback" affordance. executeCashback stamps
            // { source: "cashback", cashbackCodeId, invoiceId } on the
            // buyer's store credit.
            metadata: tx.metadata ? {
              source: tx.metadata.source,
              cashbackCodeId: tx.metadata.cashbackCodeId,
              invoiceId: tx.metadata.invoiceId,
            } : null,
          })),
        };
        setWalletData(freshWalletData);
      } else if (activeTab === "affiliate") {
        // Fetch affiliate transactions, balance with gating, and Unilevel Plus product
        const [txResult, balanceResult] = await Promise.all([
          getAffiliateWalletTransactions({ limit: AFFILIATE_TX_PAGE_SIZE, offset: 0 }),
          getAffiliateWalletBalance(),
          fetchUPProduct(),
        ]);

        setAffiliateGating({
          hasPurchasedUnilevelPlus: balanceResult.hasPurchasedUnilevelPlus,
          purchasedAt: balanceResult.purchasedAt ?? null,
          balance: balanceResult.balance,
          redeemableBalance: balanceResult.redeemableBalance,
          lockedBalance: balanceResult.lockedBalance,
        });

        setAffiliateTxTotal(txResult.total || 0);
        setAffiliateTxOffset(AFFILIATE_TX_PAGE_SIZE);

        freshWalletData = {
          wallet: {
            _id: walletsResult.affiliateWallet?._id || "",
            balance: walletsResult.affiliateWallet?.balance || 0,
            currency: walletsResult.affiliateWallet?.currency || "USD",
            isActive: walletsResult.affiliateWallet?.isActive ?? true,
            totalEarnings: walletsResult.affiliateWallet?.totalEarnings || 0,
          },
          recentTransactions: (txResult.transactions || []).map((tx: any) => ({
            _id: tx._id,
            amount: tx.amount,
            type: tx.type,
            status: tx.status,
            description: tx.description,
            createdAt: tx.createdAt,
            balanceBefore: tx.balanceBefore,
            balanceAfter: tx.balanceAfter,
            relatedUser: tx.relatedUserId ? {
              _id: tx.relatedUserId._id,
              name: tx.relatedUserId.name,
              email: tx.relatedUserId.email,
            } : null,
            metadata: tx.metadata ? {
              bonusType: tx.metadata.bonusType,
              legNumber: tx.metadata.legNumber,
              level: tx.metadata.level,
              networkChainSplit: tx.metadata.networkChainSplit,
              // Whitelisted like the rest — without this the loss rows reach
              // the feed with no `forfeiture`, and the Earnings filter drops
              // them again.
              forfeiture: tx.metadata.forfeiture,
            } : null,
          })),
        };
        setWalletData(freshWalletData);
      } else if (activeTab === "content_rewards") {
        // Fetch ContentRewardsWallet balance + recent transactions in parallel.
        // Scoped to the current org so switching between orgs actually shows
        // different balances (the underlying OrgRewardsWallet is per-(user,org)).
        // Falls back to the legacy cross-org rollup only if orgId isn't
        // resolvable — shouldn't happen for a normal signed-in user.
        const [balanceRes, txRes] = await Promise.all([
          fetchContentRewardsBalance(orgId || undefined),
          fetchContentRewardsTransactions({
            limit: CONTENT_REWARDS_TX_PAGE_SIZE,
            offset: 0,
            orgId: orgId || undefined,
          }),
        ]);

        const crBalance: ContentRewardsBalance = {
          balance: balanceRes.balance,
          totalEarnings: balanceRes.totalEarnings,
          totalWithdrawn: balanceRes.totalWithdrawn,
          currency: balanceRes.currency,
        };
        setContentRewardsBalance(crBalance);
        setContentRewardsTxTotal(txRes.total || 0);
        setContentRewardsTxOffset(CONTENT_REWARDS_TX_PAGE_SIZE);

        freshWalletData = {
          wallet: {
            _id: "content_rewards",
            balance: crBalance.balance,
            currency: crBalance.currency,
            isActive: true,
            totalEarnings: crBalance.totalEarnings,
          },
          recentTransactions: (txRes.transactions || []).map((tx: any) => ({
            _id: tx._id,
            amount: tx.amount,
            type: tx.type,
            status: tx.status,
            description: tx.description,
            createdAt: tx.createdAt,
            balanceBefore: tx.balanceBefore,
            balanceAfter: tx.balanceAfter,
            relatedUser: null,
            metadata: {
              campaignTitle:
                tx.campaignId && typeof tx.campaignId === "object"
                  ? tx.campaignId.title
                  : undefined,
            },
          })),
        };
        setWalletData(freshWalletData);
      }

      // Merge admin-initiated withdrawals into this wallet's feed (two rows
      // each: net payout + processing fee), carrying status + receipt.
      if (
        freshWalletData &&
        (activeTab === "store" || activeTab === "affiliate" || activeTab === "content_rewards")
      ) {
        // Withdrawable (matured) balance — only meaningful for the affiliate
        // wallet (Sunday-cutoff gating + Unilevel-Plus redeemable cap). Store
        // and content_rewards have no maturity rule, so the badge isn't shown
        // and we skip the fetch entirely.
        if (activeTab === "affiliate") {
          getWithdrawableBalance("affiliate")
            .then((r) => setWithdrawableCents(r.withdrawableCents))
            .catch(() => setWithdrawableCents(null));
        } else {
          setWithdrawableCents(null);
        }
        try {
          const wdRes = await getMyWithdrawals(
            activeTab,
            activeTab === "store" ? orgId : undefined
          );
          const wdRows = (wdRes.withdrawals || []).flatMap(withdrawalToDisplayRows);
          if (wdRows.length > 0) {
            freshWalletData = {
              ...freshWalletData,
              recentTransactions: [...freshWalletData.recentTransactions, ...wdRows].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              ),
            };
            setWalletData(freshWalletData);
          }
        } catch {
          // non-fatal — feed still shows the base transactions
        }
      }

      if (freshWalletData) {
        setPageCache(cacheKey, { walletData: freshWalletData, storeWallets: freshStoreWallets, affiliateWallet: freshAffiliateWallet });
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching wallet data:", err);
      setError("Failed to fetch wallet data");
    } finally {
      setLoading(false);
      if (isRefresh) {
        setRefreshing(false);
      }
    }
  };

  // Refresh the current org's currency roster whenever the org or
  // active tab changes. Cheap read (one Mongo query, no auth chain
  // beyond the token). Result populates the Convert button below and
  // the transfer sheet's source picker.
  useEffect(() => {
    if (activeTab !== "store" || !currentOrgId) return;
    let cancelled = false;
    getStoreWalletCurrencies(currentOrgId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setCurrentOrgCurrencies(res.wallets);
          setCurrentOrgIsCryptobrand(res.isCryptobrand);
        }
      })
      .catch((e) =>
        console.warn(
          "[WalletPageNew] getStoreWalletCurrencies failed:",
          (e as Error).message,
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [activeTab, currentOrgId]);

  // Reset the selected sibling to USD when the org changes — otherwise
  // switching orgs while viewing a BTC-only balance would show a
  // BTC-typed balance for an org that has no BTC wallet.
  useEffect(() => {
    setSelectedStoreCurrency("USD");
  }, [currentOrgId]);

  // Prime the Send Credits form's source currency from whichever sibling
  // wallet the Store tab is currently viewing, so opening the sheet on
  // BTC immediately funds a BTC-source transfer. Only fires when the
  // modal transitions from closed → open (guarded by sendStep === "form"
  // + empty amount) so the user's mid-edit picks stay put.
  useEffect(() => {
    if (!showSendModal) return;
    setSendFromCurrency(selectedStoreCurrency || "USD");
    setSendToCurrency(selectedStoreCurrency || "USD");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSendModal]);

  // When the user picks a different currency sibling — INCLUDING
  // switching back to USD — refetch that wallet's balance and
  // transactions and overwrite walletData. The previous version
  // early-returned for USD which left stale non-USD data in
  // walletData after a click sequence like BTC → USD (balance stayed
  // 0 with the USD chip highlighted, matching the bug report).
  //
  // Skipped only until currentOrgCurrencies has loaded — otherwise
  // we'd race the roster fetch and show a $0 flash before the real
  // USD balance settles.
  useEffect(() => {
    if (activeTab !== "store" || !currentOrgId) return;
    if (currentOrgCurrencies.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const txResult = await getStoreWalletTransactions(currentOrgId, {
          limit: STORE_TX_PAGE_SIZE,
          offset: 0,
          currency: selectedStoreCurrency,
        });
        if (cancelled) return;
        setStoreTxTotal(txResult.total || 0);
        setStoreTxOffset(STORE_TX_PAGE_SIZE);
        const sibling = currentOrgCurrencies.find(
          (w) => w.currency === selectedStoreCurrency,
        );
        setWalletData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            wallet: {
              ...prev.wallet,
              balance: sibling?.balance ?? 0,
              currency: selectedStoreCurrency,
            },
            recentTransactions: (txResult.transactions || []).map((tx: any) => ({
              _id: tx._id,
              amount: tx.amount,
              type: tx.type,
              status: tx.status,
              description: tx.description,
              createdAt: tx.createdAt,
              balanceBefore: tx.balanceBefore,
              balanceAfter: tx.balanceAfter,
              relatedUser: tx.relatedUserId
                ? {
                    _id: tx.relatedUserId._id,
                    name: tx.relatedUserId.name,
                    email: tx.relatedUserId.email,
                  }
                : null,
              metadata: tx.metadata
                ? {
                    source: tx.metadata.source,
                    cashbackCodeId: tx.metadata.cashbackCodeId,
                    invoiceId: tx.metadata.invoiceId,
                  }
                : null,
            })),
          };
        });
      } catch (e) {
        console.warn(
          "[WalletPageNew] currency-scoped tx fetch failed:",
          (e as Error).message,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreCurrency, currentOrgId, activeTab, currentOrgCurrencies.length]);

  const loadMoreContentRewardsTransactions = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      // Same org scoping as the initial fetch above — otherwise the
      // "load more" would suddenly append cross-org rows to a per-org list.
      const txResult = await fetchContentRewardsTransactions({
        limit: CONTENT_REWARDS_TX_PAGE_SIZE,
        offset: contentRewardsTxOffset,
        orgId: currentOrgId || undefined,
      });
      const newTxs = (txResult.transactions || []).map((tx: any) => ({
        _id: tx._id,
        amount: tx.amount,
        type: tx.type,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        relatedUser: null,
        metadata: {
          campaignTitle:
            tx.campaignId && typeof tx.campaignId === "object"
              ? tx.campaignId.title
              : undefined,
        },
      }));
      setWalletData((prev) =>
        prev
          ? { ...prev, recentTransactions: [...prev.recentTransactions, ...newTxs] }
          : prev
      );
      setContentRewardsTxOffset((prev) => prev + CONTENT_REWARDS_TX_PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more content rewards transactions:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreAffiliateTransactions = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const txResult = await getAffiliateWalletTransactions({
        limit: AFFILIATE_TX_PAGE_SIZE,
        offset: affiliateTxOffset,
      });
      const newTxs = (txResult.transactions || []).map((tx: any) => ({
        _id: tx._id,
        amount: tx.amount,
        type: tx.type,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        relatedUser: tx.relatedUserId ? {
          _id: tx.relatedUserId._id,
          name: tx.relatedUserId.name,
          email: tx.relatedUserId.email,
        } : null,
        metadata: tx.metadata ? {
          bonusType: tx.metadata.bonusType,
          legNumber: tx.metadata.legNumber,
          level: tx.metadata.level,
          networkChainSplit: tx.metadata.networkChainSplit,
          forfeiture: tx.metadata.forfeiture,
        } : null,
      }));
      setWalletData((prev) =>
        prev
          ? { ...prev, recentTransactions: [...prev.recentTransactions, ...newTxs] }
          : prev
      );
      setAffiliateTxOffset((prev) => prev + AFFILIATE_TX_PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more affiliate transactions:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreStoreTransactions = async () => {
    if (loadingMore || !currentOrgId) return;
    setLoadingMore(true);
    try {
      const txResult = await getStoreWalletTransactions(currentOrgId, {
        limit: STORE_TX_PAGE_SIZE,
        offset: storeTxOffset,
        // Currency-aware paging — the selected sibling determines
        // which ledger we're paging through. Default USD covers the
        // legacy behaviour when no chip is picked.
        currency: selectedStoreCurrency,
      });
      const newTxs = (txResult.transactions || []).map((tx: any) => ({
        _id: tx._id,
        amount: tx.amount,
        type: tx.type,
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
        balanceBefore: tx.balanceBefore,
        balanceAfter: tx.balanceAfter,
        relatedUser: tx.relatedUserId ? {
          _id: tx.relatedUserId._id,
          name: tx.relatedUserId.name,
          email: tx.relatedUserId.email,
        } : null,
        metadata: tx.metadata ? {
          source: tx.metadata.source,
          cashbackCodeId: tx.metadata.cashbackCodeId,
          invoiceId: tx.metadata.invoiceId,
        } : null,
      }));
      setWalletData((prev) =>
        prev
          ? { ...prev, recentTransactions: [...prev.recentTransactions, ...newTxs] }
          : prev
      );
      setStoreTxOffset((prev) => prev + STORE_TX_PAGE_SIZE);
    } catch (err) {
      console.error("Error loading more store transactions:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    fetchWalletData(true);
  };

  // Fetch wallet data on mount and when activeTab changes
  useEffect(() => {
    if (activeTab === "reserve") {
      setLoading(false);
      fetchReserveLicenses();
      return;
    }
    if (activeTab === "rewards") {
      // RewardsTab manages its own loading; just stop the page-level spinner.
      setLoading(false);
      return;
    }
    // Payment Methods tab: still fetch wallet data so the walletData
    // null-guard passes on a cold ?tab=payment_methods load — the panel
    // itself uses none of it, but the render path assumes non-null.
    setLoading(true);
    setAffiliateGating(null);
    setWithdrawableCents(null);
    setAffiliateTxOffset(0);
    setAffiliateTxTotal(0);
    setContentRewardsTxOffset(0);
    setContentRewardsTxTotal(0);
    // Reset the feed filter when switching wallets — a stale "withdrawals"
    // filter on the new tab is more confusing than helpful.
    setFeedFilter("all");
    fetchWalletData();
  }, [activeTab]);

  const fetchUPProduct = async () => {
    try {
      setUpLoading(true);
      const result = await getUnilevelPlusProduct();
      // Keep the WHOLE payload. This used to copy only plan/purchased/purchase,
      // which is why this card never knew about the 24h free-month window or
      // the NetworkChains bundles — the backend had been sending both all
      // along.
      setUpProduct({
        plan: result.plan,
        purchased: result.purchased,
        purchase: result.purchase,
        freeMonthWindow: result.freeMonthWindow,
        comboUsed: result.comboUsed,
        comboEligible: result.comboEligible,
        comboTerms: result.comboTerms,
      });
      setUpAssignedBy((result as any).assignedBy || null);
    } catch (err) {
      console.error("Error fetching UP product:", err);
    } finally {
      setUpLoading(false);
    }
  };

  const fetchReserveLicenses = async () => {
    setReserveLoading(true);
    try {
      const [licensesRes, statsRes] = await Promise.all([
        getReserveLicenses(),
        getReserveStats(),
      ]);
      if (licensesRes.success) setReserveLicenses(licensesRes.licenses);
      if (statsRes.success) setReserveStats(statsRes);
    } catch (err) {
      console.error("Error fetching reserve licenses:", err);
    } finally {
      setReserveLoading(false);
    }
  };

  const handleAssignSearch = async (query: string) => {
    setAssignSearchQuery(query);
    if (query.length < 2) { setAssignSearchResults([]); return; }
    setAssignSearchLoading(true);
    try {
      const res = await searchUsersForAssignment(query);
      if (res.success) setAssignSearchResults(res.users);
    } catch (err) {
      console.error("Error searching users:", err);
    } finally {
      setAssignSearchLoading(false);
    }
  };

  const handleAssignLicense = async (licenseId: string, targetUserId: string) => {
    setAssigning(true);
    try {
      const res = await assignReserveLicense(licenseId, targetUserId);
      if (res.success) {
        toast.success(`License assigned to ${res.assignedTo.name}`);
        setAssigningLicenseId(null);
        setAssignSearchQuery("");
        setAssignSearchResults([]);
        fetchReserveLicenses();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to assign license");
    } finally {
      setAssigning(false);
    }
  };

  // ============= Send Credits Handlers =============

  const resetSendModal = () => {
    setSendAmount("");
    setSendDescription("");
    setSendError(null);
    setSendSuccess(null);
    setSendRecipient(null);
    setSendSearchQuery("");
    setSendSearchResults([]);
    setSendStep("form");
    setSendProcessing(false);
    setSendTargets([]);
    setSelectedTarget(null);
    // Reset currency picks to the wallet the Store tab is currently
    // viewing — so re-opening Send Credits on the BTC tab immediately
    // funds the transfer from BTC.
    setSendFromCurrency(selectedStoreCurrency || "USD");
    setSendToCurrency(selectedStoreCurrency || "USD");
  };

  // Currency display helpers — kept local to this component (also used
  // by the multi-currency chip row above).
  const currencySymbol = (c: string): string =>
    c === "USD" ? "$" : c === "INR" ? "₹" : c === "ETH" ? "Ξ" : c === "BTC" ? "₿" : "";
  const currencyDecimals = (c: string): number =>
    c === "USD" || c === "INR" ? 2 : 6;
  const formatSymbolAmount = (amount: number, c: string): string =>
    `${currencySymbol(c)}${amount.toFixed(currencyDecimals(c))}`;

  // Source funds come from the sender's chosen currency wallet in the
  // current org. Falls back to the legacy USD balance when there is only
  // one wallet (non-cryptobrand orgs).
  const sendSourceBalance = (() => {
    const entry = currentOrgCurrencies.find(
      (w) => w.currency === sendFromCurrency,
    );
    if (entry) return entry.balance;
    return walletData?.wallet.balance || 0;
  })();

  // When a recipient is picked, load the wallets we can send into. We used
  // to auto-default `selectedTarget` to the recipient's store wallet in
  // the SENDER's current org — that silently sent transfers to the wrong
  // org whenever the sender intended a different one and didn't explicitly
  // click a target (see the 2026-07-05 misdirected Chamak transfer). Now
  // we leave `selectedTarget` null and gate the Send button on an
  // explicit pick so the sender must consciously choose the destination.
  //
  // If the recipient has only one possible target (edge case — a user
  // with a single org membership), we still preselect it since there's
  // no ambiguity, and it saves the user a redundant click.
  const loadTransferTargets = async (recipientId: string) => {
    setSendTargetsLoading(true);
    setSendTargets([]);
    setSelectedTarget(null);
    try {
      const res = await getTransferTargets(recipientId);
      if (res.success && res.targets) {
        // Content Rewards is a payout vault, not a spendable balance —
        // do not let users transfer arbitrary funds into it.
        let spendableTargets = res.targets.filter(
          (t) => t.walletType !== "content_rewards"
        );
        // Self-transfer: when the recipient is the sender themselves,
        // exclude the sender's current org from the destination picker —
        // moving funds to the same wallet is a no-op and would fail the
        // backend "same wallet" guard. Any OTHER org the sender belongs
        // to is a legitimate destination.
        const myUserId = getUserIdFromToken();
        if (myUserId && recipientId === myUserId && currentOrgId) {
          spendableTargets = spendableTargets.filter(
            (t) => t.orgId !== currentOrgId
          );
        }
        setSendTargets(spendableTargets);
        // Only auto-select when there is exactly ONE target — zero ambiguity.
        if (spendableTargets.length === 1) {
          setSelectedTarget(spendableTargets[0]);
        }
      }
    } catch (err) {
      console.error("Error loading transfer targets:", err);
    } finally {
      setSendTargetsLoading(false);
    }
  };

  const targetLabel = (t: TransferTarget | null) => {
    if (!t) return "";
    return t.walletType === "content_rewards"
      ? "Content Rewards"
      : `Store · ${t.orgName || "Organization"}`;
  };

  const handleSendSearch = async (query: string) => {
    setSendSearchQuery(query);
    if (query.length < 2) { setSendSearchResults([]); return; }
    setSendSearching(true);
    try {
      const res = await searchUsersForTransfer(query);
      if (res.success) setSendSearchResults(res.users);
    } catch (err) {
      console.error("Error searching users for transfer:", err);
    } finally {
      setSendSearching(false);
    }
  };

  const handleSendCredits = async () => {
    if (!sendRecipient || !currentOrgId) return;
    if (!selectedTarget) {
      setSendError("Please choose a destination wallet");
      return;
    }
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setSendError("Please enter a valid amount");
      return;
    }

    // Route through the multi-currency endpoint whenever either side is
    // non-USD (or the sender explicitly picked USD on both but the target
    // is Content Rewards — that path stays legacy because Content Rewards
    // only holds USD).
    const isStoreTarget = selectedTarget.walletType === "store";
    const useMulti =
      isStoreTarget &&
      (sendFromCurrency !== "USD" ||
        sendToCurrency !== "USD" ||
        sendFromCurrency !== sendToCurrency);

    setSendProcessing(true);
    setSendError(null);
    try {
      const myUserId = getUserIdFromToken();
      const isSelfTransfer = !!(myUserId && sendRecipient._id === myUserId);
      const dest = targetLabel(selectedTarget);

      if (useMulti) {
        const res = await transferStoreWalletMulti({
          toUserId: sendRecipient._id,
          fromOrgId: currentOrgId,
          fromCurrency: sendFromCurrency,
          toOrgId: selectedTarget.orgId || currentOrgId,
          toCurrency: sendToCurrency,
          amount,
          description:
            sendDescription ||
            `Transfer to ${sendRecipient.name}`,
          note: sendDescription || undefined,
        });
        if (res.success) {
          const sentLabel = formatSymbolAmount(
            res.fromWallet.amountDebited,
            res.fromWallet.currency,
          );
          const receivedLabel = formatSymbolAmount(
            res.toWallet.amountCredited,
            res.toWallet.currency,
          );
          const sameCurrency =
            res.fromWallet.currency === res.toWallet.currency;
          setSendStep("success");
          setSendSuccess(
            isSelfTransfer
              ? sameCurrency
                ? `Moved ${sentLabel} to your ${dest} wallet`
                : `Converted ${sentLabel} → ${receivedLabel} in your ${dest} wallet`
              : sameCurrency
                ? `Sent ${sentLabel} to ${sendRecipient.name}`
                : `Sent ${sentLabel} → ${sendRecipient.name} received ${receivedLabel}`,
          );
          toast.success(
            sameCurrency
              ? `Sent ${sentLabel} to ${sendRecipient.name}'s ${dest} wallet`
              : `Sent ${sentLabel} → ${receivedLabel} landed in ${sendRecipient.name}'s ${res.toWallet.currency} wallet`,
          );
          fetchWalletData(true);
          // Refresh the source-org currency roster so the chip row shows
          // the new post-transfer balance immediately.
          getStoreWalletCurrencies(currentOrgId)
            .then((r) => {
              if (r.success) setCurrentOrgCurrencies(r.wallets);
            })
            .catch(() => {});
        }
        return;
      }

      // Legacy USD-only same-org path — untouched, exactly as before.
      const res = await transferStoreCredits(
        sendRecipient._id,
        currentOrgId,
        amount,
        sendDescription || undefined,
        {
          destinationWalletType: selectedTarget.walletType,
          destinationOrgId: selectedTarget.orgId || undefined,
        },
      );
      if (res.success) {
        setSendStep("success");
        setSendSuccess(
          isSelfTransfer
            ? `Moved $${amount.toFixed(2)} to your ${dest} wallet`
            : `Successfully sent $${amount.toFixed(2)} to ${sendRecipient.name}`,
        );
        toast.success(
          isSelfTransfer
            ? `Moved $${amount.toFixed(2)} to your ${dest} wallet`
            : `Sent $${amount.toFixed(2)} to ${sendRecipient.name}'s ${dest} wallet`,
        );
        fetchWalletData(true);
      }
    } catch (err: any) {
      setSendError(err.message || "Failed to send credits");
    } finally {
      setSendProcessing(false);
    }
  };

  // ============= Affiliate to Store Transfer Handlers =============

  const resetAffiliateTransferModal = () => {
    setAffTransferAmount("");
    setAffTransferOrgId(currentOrgId);
    setAffTransferProcessing(false);
    setAffTransferError(null);
    setAffOrgPickerOpen(false);
  };

  const handleAffiliateToStoreTransfer = async () => {
    const orgId = affTransferOrgId || currentOrgId;
    if (!orgId) return;
    const amount = parseFloat(affTransferAmount);
    if (isNaN(amount) || amount <= 0) {
      setAffTransferError("Please enter a valid amount");
      return;
    }

    setAffTransferProcessing(true);
    setAffTransferError(null);
    try {
      const res = await transferAffiliateToStore(orgId, amount);
      if (res.success) {
        toast.success(`Transferred $${amount.toFixed(2)} to Store Vault`);
        setShowAffiliateTransferModal(false);
        resetAffiliateTransferModal();
        fetchWalletData(true);
      }
    } catch (err: any) {
      setAffTransferError(err.message || "Failed to transfer");
    } finally {
      setAffTransferProcessing(false);
    }
  };

  // ============= Content Rewards Transfer Handlers =============

  const resetCrTransferModal = () => {
    setCrTransferAmount("");
    setCrTransferDestination("affiliate");
    setCrTransferOrgId(currentOrgId);
    setCrTransferNote("");
    setCrTransferProcessing(false);
    setCrTransferError(null);
    setCrOrgPickerOpen(false);
  };

  const handleContentRewardsTransfer = async () => {
    const amountUsd = parseFloat(crTransferAmount);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      setCrTransferError("Please enter a valid amount");
      return;
    }

    const available = contentRewardsBalance?.balance || 0;
    if (amountUsd > available) {
      setCrTransferError(`Amount exceeds available balance ($${available.toFixed(2)})`);
      return;
    }

    if (crTransferDestination === "store" && !(crTransferOrgId || currentOrgId)) {
      setCrTransferError("Pick a destination office");
      return;
    }

    setCrTransferProcessing(true);
    setCrTransferError(null);
    try {
      // Convert dollars → cents at the boundary. Backend expects integer cents.
      const amountCents = Math.round(amountUsd * 100);
      const res = await transferContentRewards({
        destination: crTransferDestination,
        amountCents,
        // Per-org source bucket — drains the CR balance for the org the
        // user picked in the modal (defaults to their active org).
        orgId: crTransferOrgId || currentOrgId || undefined,
        note: crTransferNote.trim() || undefined,
      });
      if (res.success) {
        const destLabel = crTransferDestination === "store" ? "Store Vault" : "Affiliate Wallet";
        toast.success(`Transferred $${amountUsd.toFixed(2)} to ${destLabel}`);
        setShowCrTransferModal(false);
        resetCrTransferModal();
        fetchWalletData(true);
      }
    } catch (err: any) {
      setCrTransferError(err.message || "Failed to transfer");
    } finally {
      setCrTransferProcessing(false);
    }
  };

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Invoice-based payment state for Unilevel Plus
  const [upInvoiceId, setUpInvoiceId] = useState<string | null>(null);
  const [showUpPaymentSelector, setShowUpPaymentSelector] = useState(false);
  const [upOrderData, setUpOrderData] = useState<{ key: string; amount: number; currency: string; orderId: string; planName: string } | null>(null);
  const [upDiscountedTotalCents, setUpDiscountedTotalCents] = useState<number | null>(null);
  const [upAppliedCouponCode, setUpAppliedCouponCode] = useState<string | null>(null);

  /**
   * Offer-window state for the Unilevel Plus card. All server-decided — the
   * client never recomputes the window or adjusts prices.
   *
   * `comboTerms` arrives already priced for this buyer: past the window it is
   * the standalone list (which includes the 1-month row, $25 + $36); inside
   * the window it is the bundle list, which omits monthly because month one is
   * free.
   */
  const upComboGroup = upProduct?.comboTerms?.[0] ?? null;
  const upOfferWindowOpen = !!upProduct?.freeMonthWindow?.open;

  /**
   * Is buying the $25 licence on its own a real offer for this viewer?
   *
   * Yes in three cases:
   *   - they already own it — the stepper is then "buy reserve licences",
   *     seats to gift, which stay flat $25 regardless of any window;
   *   - the 24h window is open — the licence IS the whole cart, with the
   *     first partner cycle riding along free;
   *   - no combo product is configured — then licence-only is all we sell.
   *
   * No for a non-owner once the window has closed: the licence is sold with
   * the first subscription cycle ($61). Showing a $25 "or licence only"
   * option there undercut the bundle and left buyers with a licence and no
   * subscription. The backend now rejects that order outright; this stops it
   * being offered in the first place.
   */
  const upLicenceOnlyAvailable =
    !!upProduct?.purchased ||
    upOfferWindowOpen ||
    !upComboGroup ||
    upComboGroup.terms.length === 0;
  const [upTermMonths, setUpTermMonths] = useState(1);
  const [upComboProcessing, setUpComboProcessing] = useState(false);

  // Default to whatever the backend nominates, once terms land.
  useEffect(() => {
    if (!upComboGroup?.terms?.length) return;
    const has = upComboGroup.terms.some((t) => t.termMonths === upTermMonths);
    if (!has) {
      setUpTermMonths(
        upComboGroup.defaultTermMonths ?? upComboGroup.terms[0].termMonths,
      );
    }
  }, [upComboGroup, upTermMonths]);

  /**
   * Past-window purchase: licence + prepaid NetworkChains in one cart.
   *
   * Mints the invoice through the combo endpoint, then hands off to the SAME
   * PaymentMethodSelector the plain licence flow uses — no second payment
   * path. The amount shown there comes from the invoice the backend just
   * priced, so display and charge cannot drift.
   */
  const handleUPComboPurchase = async () => {
    if (!upComboGroup) return;
    try {
      setUpComboProcessing(true);
      const { createComboInvoice } = await import(
        "@/lib/webinar/garage-store-plans"
      );
      const res: any = await createComboInvoice({
        thirdPartyClientId: upComboGroup.thirdPartyClientId,
        termMonths: upTermMonths,
      });
      const invoiceId = res?.invoiceId || res?.invoice?._id;
      if (!invoiceId) {
        throw new Error("Could not start checkout — no invoice was created.");
      }
      setUpInvoiceId(invoiceId);
      // Let the selector fall back to the invoice's own total rather than the
      // licence-only GST estimate, which would understate a bundle cart.
      setUpDiscountedTotalCents(
        typeof res?.totalAmountCents === "number"
          ? res.totalAmountCents
          : typeof res?.invoice?.totalAmount === "number"
            ? res.invoice.totalAmount
            : null,
      );
      setShowUpPaymentSelector(true);
    } catch (err: any) {
      console.error("Error starting UP combo checkout:", err);
      alert(err?.message ?? "Could not start checkout. Please try again.");
    } finally {
      setUpComboProcessing(false);
    }
  };

  const handleUPPurchase = async () => {
    try {
      setUpProcessing(true);

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert("Failed to load payment gateway. Please try again.");
        return;
      }

      const orderResult = await createUnilevelPlusOrder(upQuantity);

      // If invoice is available, show payment method selector
      if (orderResult.invoiceId) {
        setUpInvoiceId(orderResult.invoiceId);
        setUpOrderData({
          key: orderResult.razorpayKeyId,
          amount: orderResult.razorpayOrder.amount,
          currency: orderResult.razorpayOrder.currency,
          orderId: orderResult.razorpayOrder.id,
          planName: orderResult.plan.name,
        });
        setShowUpPaymentSelector(true);
        setUpProcessing(false);
        return;
      }

      // Fallback: direct Razorpay flow
      const options = {
        key: orderResult.razorpayKeyId,
        amount: orderResult.razorpayOrder.amount,
        currency: orderResult.razorpayOrder.currency,
        name: orderResult.plan.name,
        description: "Unilevel Plus Plan Activation",
        order_id: orderResult.razorpayOrder.id,
        handler: async (response: any) => {
          try {
            await verifyUnilevelPlusPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            // Refresh product status and wallet data
            await fetchUPProduct();
            await fetchWalletData(true);
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            alert(
              err?.message
                ? `Payment verification failed: ${err.message}`
                : "Payment verification failed. Please contact support."
            );
          }
        },
        theme: { color: getBrandHex() },
        prefill: {
          contact: await (
            await import("@/lib/razorpayPrefill")
          ).getRazorpayContactForCurrentUser(),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Error creating UP order:", err);
      alert(err.message || "Failed to initiate payment. Please try again.");
    } finally {
      setUpProcessing(false);
    }
  };

  const handleUpPaymentInitiated = async (data: {
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    razorpaySubscriptionId?: string;
    /** Set by the BE mandate branch; requires `recurring: 1` + `customer_id`. */
    upiAutopay?: boolean;
    razorpayCustomerId?: string;
    shortUrl?: string;
    cryptoPaymentUrl?: string;
    walletPaid?: boolean;
    stripePaid?: boolean;
    amount: number;
    currency: string;
    invoiceId?: string;
  }) => {
    if (data.walletPaid || data.stripePaid) {
      toast.success("Payment complete!");
      setShowUpPaymentSelector(false);
      setUpInvoiceId(null);
      setUpProcessing(false);
      await fetchUPProduct();
      await fetchWalletData(true);
      return;
    }
    if (data.cryptoPaymentUrl) {
      window.open(data.cryptoPaymentUrl, "_blank");
      toast.info("Complete your crypto payment in the new tab. The invoice will update automatically once confirmed.");
      setUpProcessing(false);
      return;
    }
    if (data.razorpayOrderId && data.razorpayKeyId) {
      // The SDK is loaded lazily and only the legacy handleUPPurchase path
      // above ever loaded it. On a fresh dashboard load this invoice path
      // reached `new window.Razorpay(...)` with the script never fetched —
      // "window.Razorpay is not a constructor" (18 Sep 2026) — and, because
      // the selector calls this handler without awaiting it, the buyer saw an
      // alert and a button stuck on "Processing…". Same guard as the legacy
      // path; a no-op when the script is already present.
      const loaded = await loadRazorpayScript();
      if (!loaded || !(window as any).Razorpay) {
        setUpProcessing(false);
        toast.error("Couldn't load the payment gateway. Please try again.");
        return;
      }
      const options = {
        key: data.razorpayKeyId,
        amount: data.amount,
        currency: data.currency,
        // `upOrderData` is only populated by handleUPPurchase (the licence-only
        // flow). handleUPComboPurchase never sets it, so an unguarded read here
        // threw a TypeError before `new Razorpay(...)` below was ever reached —
        // and because the selector calls this handler without awaiting it, the
        // rejection was swallowed and the buyer saw nothing at all. Zero
        // post-window combo carts completed between 13 Aug and 3 Sep because of
        // this one line. Guarded the same way line ~1595 already guards
        // `upOrderData?.amount`.
        name: upOrderData?.planName ?? upProduct?.plan?.name ?? "Garage",
        description: "Unilevel Plus Plan Activation",
        order_id: data.razorpayOrderId,
        // UPI Autopay: an order carrying a `token` block needs BOTH
        // `recurring: 1` and `customer_id`, or Razorpay refuses it / drops the
        // mandate. This surface passed neither. `upiAutopay` is stamped only by
        // the BE mandate branch, so a plain payment is unaffected.
        ...(data.upiAutopay
          ? {
              recurring: 1,
              ...(data.razorpayCustomerId
                ? { customer_id: data.razorpayCustomerId }
                : {}),
            }
          : {}),
        handler: async (response: any) => {
          try {
            await verifyUnilevelPlusPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setShowUpPaymentSelector(false);
            setUpInvoiceId(null);
            await fetchUPProduct();
            await fetchWalletData(true);
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            alert(
              err?.message
                ? `Payment verification failed: ${err.message}`
                : "Payment verification failed. Please contact support."
            );
          }
        },
        theme: { color: getBrandHex() },
        prefill: {
          contact: await (
            await import("@/lib/razorpayPrefill")
          ).getRazorpayContactForCurrentUser(),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    }
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    // Crypto tickers (BTC / ETH / USDT) aren't ISO 4217 — Intl.NumberFormat
    // throws RangeError on them. Format the number ourselves and append the
    // ticker as a suffix; the fiat path keeps the native currency formatter
    // for locale-correct symbols ($, ₹) and grouping.
    const CRYPTO = new Set(["BTC", "ETH", "USDT"]);
    if (CRYPTO.has(currency)) {
      // BTC / ETH need 8 decimals; USDT is a stablecoin so 2 is enough.
      const digits = currency === "USDT" ? 2 : 8;
      const num = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: digits,
      }).format(amount);
      return `${num} ${currency}`;
    }
    // min 2 / max 6 fraction digits so franchise sub-cent slices
    // (e.g. 15% of a $0.25 platform fee = $0.0375) render at full
    // precision. Whole-dollar amounts still show as "$X.XX".
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(amount);
    } catch {
      // Unknown ticker — degrade gracefully rather than crashing the tree.
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-2">
            <div className="h-6 sm:h-8 w-40 sm:w-48 bg-[#1a1a22] rounded animate-pulse"></div>
            <div className="h-4 w-56 sm:w-64 bg-[#1a1a22] rounded animate-pulse"></div>
          </div>

          {/* Balance Card Skeleton */}
          <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-5 sm:h-6 w-28 sm:w-32 bg-[#1a1a22] rounded"></div>
              <div className="h-10 sm:h-12 w-40 sm:w-48 bg-[#1a1a22] rounded"></div>
              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4">
                <div className="h-9 sm:h-10 w-full sm:w-24 bg-[#1a1a22] rounded"></div>
                <div className="h-9 sm:h-10 w-full sm:w-24 bg-[#1a1a22] rounded"></div>
              </div>
            </div>
          </div>

          {/* Recent Transactions Skeleton */}
          <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-5 sm:h-6 w-40 sm:w-48 bg-[#1a1a22] rounded"></div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 sm:space-x-4">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-[#1a1a22] rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 sm:w-32 bg-[#1a1a22] rounded"></div>
                    <div className="h-3 w-40 sm:w-48 bg-[#1a1a22] rounded"></div>
                  </div>
                  <div className="h-4 w-14 sm:w-16 bg-[#1a1a22] rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 sm:p-6 text-center">
            <div className="text-red-400 text-base sm:text-lg font-medium mb-2">
              Error Loading Wallet
            </div>
            <div className="text-red-400/70 text-sm sm:text-base mb-4">{error}</div>
            <Button
              onClick={() => fetchWalletData()}
              variant="outline"
              className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] h-9 sm:h-10"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-[#9fa0b8] text-sm sm:text-base">No wallet data found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-brand" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">Wallet</h1>
          </div>
          <p className="text-sm sm:text-base text-[#9fa0b8]">
            {activeTab === "store"
              ? "Manage your store credits and transactions"
              : activeTab === "reserve"
                ? "Manage your reserve licenses and assignments"
                : activeTab === "rewards"
                  ? "Discount codes you can use at checkout"
                  : activeTab === "payment_methods"
                    ? "Save cards for one-click reuse on future invoices"
                    : "View your affiliate commission earnings and history"}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#2a2a35]">
          <div className="flex space-x-4 sm:space-x-8">
            <button
              onClick={() => setActiveTab("affiliate")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 ${activeTab === "affiliate"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              Affiliate Wallet
            </button>
            <button
              onClick={() => setActiveTab("store")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 ${activeTab === "store"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              Store Wallet
            </button>
            <button
              onClick={() => setActiveTab("content_rewards")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "content_rewards"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              <Gift className="w-3.5 h-3.5" />
              Content Rewards
            </button>
            <button
              onClick={() => setActiveTab("reserve")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "reserve"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              Reserve
              {reserveStats && reserveStats.available > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {reserveStats.available}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("rewards")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "rewards"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              Rewards
            </button>
            <button
              onClick={() => setActiveTab("cashback_codes")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "cashback_codes"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              <TicketPercent className="w-3.5 h-3.5" />
              Cashback Codes
            </button>
            <button
              onClick={() => setActiveTab("payment_methods")}
              className={`pb-3 sm:pb-4 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "payment_methods"
                ? "border-brand text-brand"
                : "border-transparent text-[#9fa0b8] hover:text-white"
                }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Payment Methods
            </button>
          </div>
        </div>

        {/* Cashback Codes tab — replaces the standard balance/transactions body */}
        {activeTab === "cashback_codes" && (
          <CashbackCodesTab orgId={currentOrgId} />
        )}

        {/* Payment Methods tab — reuses the /settings/payment-methods panel */}
        {activeTab === "payment_methods" && (
          <PaymentMethodsPanel showHeader={false} />
        )}

        {/* Content Rewards Wallet Info Banner */}
        {activeTab === "content_rewards" && (
          <div className="bg-brand/10 border border-brand/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-brand/20 rounded-lg shrink-0">
                <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-brand mb-1">
                  Content Rewards Wallet
                </h3>
                <p className="text-xs sm:text-sm text-brand/70">
                  Earnings from content campaigns you join. Approved posts accrue
                  views and the hourly payout sweep credits this wallet
                  automatically — no founder action required.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Affiliate Wallet Info Banner */}
        {activeTab === "affiliate" && (
          <div className="bg-brand/10 border border-brand/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-brand/20 rounded-lg shrink-0">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-brand mb-1">
                  Affiliate Commission Wallet
                </h3>
                <p className="text-xs sm:text-sm text-brand/70">
                  This wallet is separate from your store wallets. It contains
                  commission earnings from your affiliate referrals across all
                  stores.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Unilevel Plus Product Card */}
        {activeTab === "affiliate" && upProduct?.plan && (
          <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-brand/20 rounded-xl shrink-0">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-white mb-1">
                    {upProduct.plan.name}
                  </h3>
                  {upProduct.plan.description && (
                    <p className="text-xs sm:text-sm text-[#9fa0b8] mb-2">
                      {upProduct.plan.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#9fa0b8]">
                    <span>{upProduct.plan.maxLevels} levels deep</span>
                    <span>•</span>
                    <span>{upProduct.plan.directBonusPercentage}% direct bonus</span>
                    <span>•</span>
                    <span>{upProduct.plan.levelBonusPercentage}% level bonus</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg sm:text-xl font-bold text-white">
                  ${upProduct.plan.productPrice}
                </div>
                <div className="text-[10px] text-[#6b6b80] mb-2">
                  +18% GST = ${upTotalWithGst(upProduct.plan.productPrice).toFixed(2)}
                </div>
                {showUpPaymentSelector && upInvoiceId ? (
                  // Width has to be BOUNDED here. This sits inside the
                  // right-hand `text-right shrink-0` price column, which is
                  // sized by its widest child and refuses to shrink — so an
                  // unbounded checkout panel pushed the whole card wider the
                  // moment a longer row (the UPI autopay disclosure) appeared.
                  // A fixed panel width keeps the card the same size no matter
                  // which method is selected. `text-left` undoes the column's
                  // right alignment, which the coupon block above also has to
                  // opt out of.
                  <div className="w-full sm:w-[420px] max-w-full min-w-0 mt-4 text-left">
                    {!upAppliedCouponCode ? (
                      <div className="mb-3 text-left">
                        <PlatformCouponInput
                          productType="unilevel_plus"
                          amountCents={Math.round(upProduct.plan.productPrice * upQuantity * 100)}
                          invoiceCurrency={(upProduct.plan.currency as "USD" | "INR") || "USD"}
                          authToken={getToken() || undefined}
                          onApplied={async (ap) => {
                            try {
                              const res = await fetch(`${API_URL}/api/invoices/${upInvoiceId}/apply-platform-coupon`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${getToken() || ""}`,
                                },
                                body: JSON.stringify({ code: ap.code }),
                              });
                              const data = await res.json();
                              if (!res.ok || !data.success) {
                                // Throw so the coupon input rolls back its
                                // "applied" state instead of showing a
                                // discount the invoice never took.
                                throw new Error(data.error || "Failed to apply coupon");
                              }
                              setUpDiscountedTotalCents(data.invoice.totalAmount);
                              setUpAppliedCouponCode(data.invoice.couponCode);
                              toast.success("Coupon applied");
                            } catch (err: any) {
                              toast.error(err?.message || "Failed to apply coupon");
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2 text-left">
                        <Tag className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-medium">
                          Coupon {upAppliedCouponCode} applied
                        </span>
                      </div>
                    )}
                    <PaymentMethodSelector
                      invoiceId={upInvoiceId}
                      itemCurrency={upProduct.plan.currency || "USD"}
                      // Priority: coupon-adjusted total (BE) > BE-reported
                      // GST-inclusive order amount > local GST-inclusive
                      // fallback. Never the raw pre-tax price.
                      totalAmount={
                        upDiscountedTotalCents ??
                        upOrderData?.amount ??
                        Math.round(upProduct.plan.productPrice * upQuantity * UP_GST_MULT * 100)
                      }
                      onPaymentInitiated={handleUpPaymentInitiated}
                      onError={(err) => alert(err)}
                    />
                    <button
                      onClick={() => {
                        setShowUpPaymentSelector(false);
                        setUpInvoiceId(null);
                        setUpDiscountedTotalCents(null);
                        setUpAppliedCouponCode(null);
                      }}
                      className="mt-3 text-xs text-[#6b6b80] hover:text-[#9fa0b8] transition-colors w-full text-center"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Activated Badge */}
                    {upProduct.purchased && (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs font-medium text-emerald-400">Activated</span>
                        </div>

                        {/* Assigned-by banner — shown when activated via reserve license */}
                        {upAssignedBy && (
                          <div className="flex items-center gap-2.5 p-2.5 bg-brand/5 border border-brand/15 rounded-lg">
                            {upAssignedBy.profilePicture ? (
                              <img
                                src={upAssignedBy.profilePicture}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover border border-[#2a2a35] shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                                <span className="text-[9px] text-brand font-bold">
                                  {upAssignedBy.name?.charAt(0)?.toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[11px] text-brand/80">
                                License gifted by{" "}
                                <span className="font-semibold text-brand">{upAssignedBy.name}</span>
                              </p>
                              {upProduct.purchase?.purchasedAt && (
                                <p className="text-[10px] text-[#6b6b80]">
                                  {new Date(upProduct.purchase.purchasedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 24h offer window — in-window buyers get the first
                        NetworkChains month free; past the window they pick a
                        bundle. Both states are server-decided; see
                        UnilevelPlusOfferPanel. */}
                    {!upProduct.purchased && upOfferWindowOpen && upComboGroup && (
                      <FreeMonthBanner
                        clientName={upComboGroup.clientName}
                        secondsRemaining={
                          upProduct.freeMonthWindow?.secondsRemaining ?? 0
                        }
                        onExpire={fetchUPProduct}
                      />
                    )}

                    {!upProduct.purchased &&
                      !upOfferWindowOpen &&
                      upComboGroup &&
                      upComboGroup.terms.length > 0 && (
                        // No "or licence only" escape hatch here. Once the
                        // window has closed the licence is not sold alone —
                        // it goes with the first subscription cycle — so
                        // offering $25 alongside the $61 bundle undercut the
                        // only price on offer. The licence-only block below
                        // is hidden in this state for the same reason.
                        <BundlePicker
                          group={upComboGroup}
                          licenceUsd={upProduct.plan.productPrice}
                          selectedTermMonths={upTermMonths}
                          onSelect={setUpTermMonths}
                          onBuy={handleUPComboPurchase}
                          busy={upComboProcessing}
                        />
                      )}

                    {/* Licence-only purchase — hidden for a post-window
                        non-owner, who must buy the bundle above. */}
                    {upLicenceOnlyAvailable && (
                      <>
                    {/* Quantity Selector */}
                    <div>
                      {upProduct.purchased && (
                        <p className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-2">
                          Buy reserve licenses
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        {/* Stepper */}
                        <div className="flex items-center bg-[#131318] rounded-lg border border-[#2a2a35] overflow-hidden">
                          <button
                            onClick={() => setUpQuantity(Math.max(1, upQuantity - 1))}
                            className="w-9 h-9 flex items-center justify-center hover:bg-[#1a1a22] transition-colors text-[#9fa0b8] hover:text-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-10 text-center text-sm font-semibold text-white tabular-nums">
                            {upQuantity}
                          </span>
                          <button
                            onClick={() => setUpQuantity(Math.min(50, upQuantity + 1))}
                            className="w-9 h-9 flex items-center justify-center hover:bg-[#1a1a22] transition-colors text-[#9fa0b8] hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Price — base × qty prominent, GST-inclusive total in sub-text */}
                        <div className="flex-1">
                          <div className="text-sm font-bold text-white">
                            {upQuantity > 1
                              ? `${upQuantity} × $${upProduct.plan.productPrice}`
                              : `$${upProduct.plan.productPrice}`}
                          </div>
                          <div className="text-[10px] text-[#6b6b80]">
                            +18% GST = ${upTotalWithGst(upQuantity * upProduct.plan.productPrice).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Buy Button */}
                    <Button
                      onClick={handleUPPurchase}
                      disabled={upProcessing}
                      className="bg-brand hover:opacity-90 text-brand-foreground h-10 text-sm font-semibold w-full rounded-xl transition-all shadow-lg shadow-brand/5 hover:shadow-brand/10"
                    >
                      {upProcessing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </span>
                      ) : upProduct.purchased ? (
                        <span className="flex items-center gap-1.5">
                          <Package className="w-4 h-4" />
                          Buy {upQuantity} License{upQuantity > 1 ? "s" : ""}
                        </span>
                      ) : upQuantity > 1 ? (
                        <span className="flex items-center gap-1.5">
                          <Zap className="w-4 h-4" />
                          Activate + {upQuantity - 1} Reserve
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Zap className="w-4 h-4" />
                          Activate Now
                        </span>
                      )}
                    </Button>

                    {/* Helper text */}
                    {!upProduct.purchased && upQuantity > 1 && (
                      <p className="text-[10px] text-[#6b6b80] text-center">
                        1 license activates you, {upQuantity - 1} go to your reserve
                      </p>
                    )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Balance Card — hidden on Reserve + Rewards + Payment Methods tabs */}
        {activeTab !== "reserve" && activeTab !== "rewards" && activeTab !== "payment_methods" && <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className="text-sm sm:text-base text-[#9fa0b8]">
              {activeTab === "affiliate" && affiliateGating?.hasPurchasedUnilevelPlus
                ? "Redeemable Balance"
                : "Current Balance"}
            </span>
            <div className="flex items-center gap-2">
              {activeTab === "affiliate" && affiliateGating && !affiliateGating.hasPurchasedUnilevelPlus && (
                <div className="px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs bg-red-500/20 text-red-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Locked
                </div>
              )}
              <div
                className={`px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs ${walletData.wallet.isActive
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
                  }`}
              >
                {walletData.wallet.isActive ? "Active" : "Inactive"}
              </div>
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 sm:space-x-3">
              <div className={`text-2xl sm:text-4xl font-bold ${activeTab === "affiliate" && affiliateGating && !affiliateGating.hasPurchasedUnilevelPlus
                ? "text-[#9fa0b8]"
                : "text-white"
                }`}>
                {activeTab === "affiliate" && affiliateGating?.hasPurchasedUnilevelPlus
                  ? formatCurrency(affiliateGating.redeemableBalance, walletData.wallet.currency)
                  : formatCurrency(walletData.wallet.balance, walletData.wallet.currency)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 sm:p-2 hover:bg-[#1a1a22] text-[#9fa0b8]"
              >
                <RefreshCw
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {/* Withdrawable (matured) balance — only the affiliate wallet
                carries the Sunday-cutoff + Unilevel-Plus redeemable gating.
                Store and content_rewards: full balance is always available. */}
            {activeTab === "affiliate" &&
              withdrawableCents !== null && (
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] px-2.5 py-1"
                    title="Earnings that have matured (credited before last Sunday 11:59 PM IST) are withdrawable. This week's earnings unlock next Sunday night."
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs text-[#9fa0b8]">Withdrawable</span>
                    <span className="text-xs font-semibold text-white">
                      {formatCurrency(withdrawableCents / 100, walletData.wallet.currency)}
                    </span>
                  </div>

                  {/* Total wallet balance — shown ONLY when there's a locked
                      pre-activation slice. Otherwise the top big number
                      IS the total and this pill would be redundant. Bridges
                      the perceived gap with the transaction ledger's "Bal"
                      column which always reflects the raw wallet balance. */}
                  {affiliateGating?.hasPurchasedUnilevelPlus &&
                    (affiliateGating.lockedBalance ?? 0) > 0 && (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a22] border border-[#2a2a35] px-2.5 py-1"
                        title="Your true wallet balance (redeemable + pre-activation locked). This is the running balance shown in the transaction ledger below."
                      >
                        <span className="text-xs text-[#9fa0b8]">Total balance</span>
                        <span className="text-xs font-semibold text-white">
                          {formatCurrency(affiliateGating.balance, walletData.wallet.currency)}
                        </span>
                      </div>
                    )}
                </div>
              )}

            {/* Affiliate: Not purchased — gating banner with buy button */}
            {activeTab === "affiliate" && affiliateGating && !affiliateGating.hasPurchasedUnilevelPlus && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-400">
                        You&apos;re missing out on all affiliate earnings
                      </p>
                      <p className="text-xs text-red-400/70 mt-1">
                        Activate the Unilevel Plus Plan to start redeeming your future commission earnings.
                      </p>
                    </div>
                  </div>
                  {/* Window-aware pricing.
                      This banner used to hardcode `plan.productPrice`, so it
                      offered the $25 licence on its own forever — including
                      after the 24h window had closed, when the licence is only
                      sold together with the first subscription cycle ($61).
                      38 buyers took that price between Apr and Aug 2026 and
                      got no subscription at all. The main card above already
                      branches on the window; this one was missed.

                      The backend now refuses a post-window single-seat licence
                      order outright, so getting this wrong fails loudly rather
                      than under-charging — but the button should never offer
                      the wrong thing in the first place. */}
                  {(() => {
                    if (!upProduct?.plan) return null;

                    const postWindowCombo =
                      !upOfferWindowOpen && upComboGroup && upComboGroup.terms.length > 0;

                    if (postWindowCombo) {
                      const term =
                        upComboGroup.terms.find(
                          (t) => t.termMonths === upTermMonths,
                        ) ??
                        upComboGroup.terms.find(
                          (t) => t.termMonths === upComboGroup.defaultTermMonths,
                        ) ??
                        upComboGroup.terms[0];
                      return (
                        <Button
                          onClick={handleUPComboPurchase}
                          disabled={upComboProcessing}
                          className="bg-brand hover:opacity-90 text-brand-foreground h-8 sm:h-9 text-xs sm:text-sm font-semibold px-3 sm:px-4 shrink-0"
                        >
                          {upComboProcessing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              Processing...
                            </>
                          ) : (
                            `Activate $${upTotalWithGst(term.cartTotal).toFixed(2)}`
                          )}
                        </Button>
                      );
                    }

                    // Window open (or no combo product configured) — the
                    // licence genuinely is the whole cart.
                    return (
                      <Button
                        onClick={handleUPPurchase}
                        disabled={upProcessing}
                        className="bg-brand hover:opacity-90 text-brand-foreground h-8 sm:h-9 text-xs sm:text-sm font-semibold px-3 sm:px-4 shrink-0"
                      >
                        {upProcessing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            Processing...
                          </>
                        ) : (
                          `Activate $${upTotalWithGst(upProduct.plan.productPrice).toFixed(2)}`
                        )}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Content Rewards: lifetime earnings strip */}
            {activeTab === "content_rewards" && contentRewardsBalance && contentRewardsBalance.totalEarnings > 0 && (
              <div className="bg-[#1a1a22] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#9fa0b8]" />
                    <span className="text-xs sm:text-sm text-[#9fa0b8]">Lifetime earnings</span>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-white">
                    {formatCurrency(contentRewardsBalance.totalEarnings, contentRewardsBalance.currency)}
                  </span>
                </div>
                {contentRewardsBalance.totalWithdrawn > 0 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a35]">
                    <span className="text-xs text-[#9fa0b8] ml-5.5">Withdrawn</span>
                    <span className="text-xs text-[#9fa0b8]">
                      {formatCurrency(contentRewardsBalance.totalWithdrawn, contentRewardsBalance.currency)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Affiliate: Purchased — locked balance breakdown */}
            {activeTab === "affiliate" && affiliateGating?.hasPurchasedUnilevelPlus && affiliateGating.lockedBalance > 0 && (
              <div className="bg-[#1a1a22] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#9fa0b8]" />
                    <span className="text-xs sm:text-sm text-[#9fa0b8]">Pre-activation earnings (locked)</span>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-[#9fa0b8]">
                    {formatCurrency(affiliateGating.lockedBalance, walletData.wallet.currency)}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-[#9fa0b8]/60 mt-1 ml-5.5">
                  Earnings before activation cannot be redeemed
                </p>
              </div>
            )}

            {/* Multi-currency wallet roster — cryptobrand offices only.
                Renders one chip per sibling wallet (USD parent + INR /
                ETH / BTC siblings). Chips are TABS — clicking one
                switches which sibling's balance + transaction history
                the rest of the page shows. Zero-balance siblings still
                render so the founder can see they exist. */}
            {activeTab === "store" &&
              currentOrgIsCryptobrand &&
              currentOrgCurrencies.length > 1 && (
                <div className="pt-2 border-t border-[#1a1a22]">
                  <div className="text-[10px] uppercase tracking-wider text-[#6b6b80] mb-2">
                    Multi-currency wallets · click to switch
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentOrgCurrencies.map((w) => {
                      const symbol =
                        w.currency === "USD"
                          ? "$"
                          : w.currency === "INR"
                          ? "₹"
                          : w.currency === "ETH"
                          ? "Ξ"
                          : w.currency === "BTC"
                          ? "₿"
                          : "";
                      const decimals =
                        w.currency === "USD" || w.currency === "INR" ? 2 : 6;
                      const display = `${symbol}${w.balance.toFixed(decimals)}`;
                      const isActive = selectedStoreCurrency === w.currency;
                      return (
                        <button
                          type="button"
                          key={w.currency}
                          onClick={() => setSelectedStoreCurrency(w.currency)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all ${
                            isActive
                              ? "border-brand bg-brand/10 ring-1 ring-brand/30"
                              : w.isParent
                              ? "border-brand/30 bg-brand/[0.03] hover:border-brand/60"
                              : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45]"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-semibold ${
                              isActive || w.isParent
                                ? "text-brand"
                                : "text-[#9fa0b8]"
                            }`}
                          >
                            {w.currency}
                            {w.isParent && (
                              <span className="ml-1 opacity-60">· parent</span>
                            )}
                          </span>
                          <span className="text-xs font-medium text-white tabular-nums">
                            {display}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Store Wallet Actions */}
            {activeTab === "store" && (
              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4">
                <Button
                  className="flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm transition-all bg-brand hover:opacity-90 text-brand-foreground"
                  onClick={() => setShowTopUpSheet(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span>Top Up</span>
                </Button>
                {/* Deposit Crypto — persistent HD-derived address for the
                    currently-selected BTC / ETH / USDT wallet. Only shown
                    on cryptobrand offices when a crypto wallet is
                    selected; hides on USD / INR. Separate from Top Up
                    (which goes through Razorpay/Stripe → USD credit). */}
                {currentOrgIsCryptobrand &&
                  currentOrgId &&
                  (selectedStoreCurrency === "BTC" ||
                    selectedStoreCurrency === "ETH" ||
                    selectedStoreCurrency === "USDT") && (
                    <Button
                      className="flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm transition-all bg-[#1a1a22] border border-brand/40 text-brand hover:bg-[#22222c]"
                      onClick={() => setShowDepositCryptoSheet(true)}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Deposit {selectedStoreCurrency}</span>
                    </Button>
                  )}
                <Button
                  className={`flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm transition-all ${showSendModal
                    ? "bg-[#1a1a22] border border-brand/40 text-brand hover:bg-[#1a1a22]"
                    : "bg-[#1a1a22] border border-[#2a2a35] hover:bg-[#22222c] text-white"
                    }`}
                  onClick={() => {
                    if (showSendModal) {
                      setShowSendModal(false);
                      resetSendModal();
                    } else {
                      setShowSendModal(true);
                    }
                  }}
                >
                  <Send className="w-4 h-4" />
                  <span>{showSendModal ? "Cancel" : "Send Credits"}</span>
                </Button>
                {/* Convert — only surfaces on cryptobrand offices where
                    the user has multiple currency wallets. Non-cryptobrand
                    orgs have USD only, nothing to convert to. */}
                {currentOrgIsCryptobrand && currentOrgCurrencies.length > 1 && (
                  <Button
                    className="flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm transition-all bg-[#1a1a22] border border-[#2a2a35] hover:bg-[#22222c] text-white"
                    onClick={() => setShowConvertSheet(true)}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Convert</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm"
                >
                  <History className="w-4 h-4" />
                  <span>View History</span>
                </Button>
              </div>
            )}

            {/* Multi-currency Convert sheet — self-transfer between my
                own currency wallets (USD ↔ INR ↔ ETH ↔ BTC). Rendered
                only on cryptobrand orgs where the user actually has
                sibling wallets to convert between.
                Deduped by orgId — /wallet/all returns one entry per
                (org, currency) so the same org can appear 4× on
                cryptobrand accounts. */}
            {currentOrgId && (() => {
              const orgMap = new Map<string, { orgId: string; orgName: string }>();
              for (const w of storeWallets as any[]) {
                // `orgId` can be a populated object, a string, or null
                // (soft-deleted org, race with the populate). Skip
                // nulls so `.map` doesn't crash on `null._id`.
                const raw = w?.orgId;
                if (!raw) continue;
                const orgId =
                  typeof raw === "object"
                    ? (raw._id ? String(raw._id) : "")
                    : String(raw);
                if (!orgId) continue;
                const orgName =
                  typeof raw === "object" && raw.name ? String(raw.name) : "Vault";
                if (!orgMap.has(orgId)) orgMap.set(orgId, { orgId, orgName });
              }
              return (
                <MultiCurrencyTransferSheet
                  open={showConvertSheet}
                  onClose={() => setShowConvertSheet(false)}
                  mode="convert"
                  myOrgs={[...orgMap.values()]}
                  defaultFromOrgId={currentOrgId}
                  defaultFromCurrency="USD"
                  onCompleted={() => {
                    // Refresh balances + roster after a successful convert.
                    fetchWalletData(true);
                    getStoreWalletCurrencies(currentOrgId)
                      .then((res) => {
                        if (res.success) setCurrentOrgCurrencies(res.wallets);
                      })
                      .catch(() => {});
                  }}
                />
              );
            })()}

            {/* Store → Send Credits — inline slide-down */}
            {activeTab === "store" && showSendModal && (
              <div className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="rounded-xl border border-brand/15 bg-brand/[0.02] p-4 space-y-3">

                  {sendStep === "form" && (
                    <>
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 rounded-lg bg-brand/10">
                          <Send className="w-3.5 h-3.5 text-brand" />
                        </div>
                        <span className="text-xs font-medium text-[#9fa0b8]">Send to a user (or to your own other vault)</span>
                      </div>

                      {/* Source currency picker — cryptobrand offices only.
                          Lets the sender fund the transfer from any of their
                          sibling wallets in the current org (USD parent or
                          INR/ETH/BTC siblings). Non-cryptobrand orgs skip
                          this row entirely (USD is the only choice). */}
                      {currentOrgIsCryptobrand && currentOrgCurrencies.length > 1 && (
                        <div>
                          <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Send from</label>
                          <div className="flex flex-wrap gap-1.5">
                            {currentOrgCurrencies.map((w) => {
                              const active = sendFromCurrency === w.currency;
                              return (
                                <button
                                  key={w.currency}
                                  type="button"
                                  onClick={() => {
                                    setSendFromCurrency(w.currency);
                                    // If target currency was previously
                                    // mirroring source (default behavior),
                                    // move it along so same-currency stays
                                    // the default until the sender picks
                                    // otherwise.
                                    if (
                                      sendToCurrency === sendFromCurrency ||
                                      !sendToCurrency
                                    ) {
                                      setSendToCurrency(w.currency);
                                    }
                                    setSendAmount("");
                                    setSendError(null);
                                  }}
                                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all ${
                                    active
                                      ? "border-brand bg-brand/10 ring-1 ring-brand/30"
                                      : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45]"
                                  }`}
                                >
                                  <span className={`text-[10px] font-semibold ${active ? "text-brand" : "text-[#9fa0b8]"}`}>
                                    {w.currency}
                                  </span>
                                  <span className="text-[11px] font-medium text-white tabular-nums">
                                    {formatSymbolAmount(w.balance, w.currency)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recipient Search */}
                      <div>
                        <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Recipient</label>
                        <p className="text-[10px] text-[#6b6b80] mb-1.5">
                          Enter your own email to move funds between your own Store Vaults across orgs.
                        </p>
                        {sendRecipient ? (
                          <div className="flex items-center gap-3 p-2.5 rounded-lg border border-brand/20 bg-brand/5">
                            {sendRecipient.profilePicture ? (
                              <img src={sendRecipient.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover border border-[#2a2a35]" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-[10px] font-bold text-brand">
                                {sendRecipient.name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white font-medium truncate">{sendRecipient.name}</div>
                              <div className="text-[10px] text-[#6b6b80] truncate">{sendRecipient.email}</div>
                            </div>
                            <button
                              onClick={() => { setSendRecipient(null); setSendSearchQuery(""); setSendSearchResults([]); setSendTargets([]); setSelectedTarget(null); }}
                              className="p-1 hover:bg-[#1a1a22] rounded-full transition-colors"
                            >
                              <X className="w-3 h-3 text-[#6b6b80]" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b80]" />
                              <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={sendSearchQuery}
                                onChange={(e) => handleSendSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-sm text-white placeholder-[#6b6b80] focus:outline-none focus:border-brand/40 transition-colors"
                              />
                              {sendSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand animate-spin" />
                              )}
                            </div>
                            {sendSearchResults.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 max-h-44 overflow-y-auto bg-[#0e0e12] border border-[#2a2a35] rounded-lg shadow-xl">
                                {sendSearchResults.map((user: any) => (
                                  <button
                                    key={user._id}
                                    onClick={() => {
                                      setSendRecipient(user);
                                      setSendSearchQuery("");
                                      setSendSearchResults([]);
                                      loadTransferTargets(user._id);
                                    }}
                                    className="w-full flex items-center gap-3 p-2.5 hover:bg-[#1a1a22] transition-colors text-left"
                                  >
                                    {user.profilePicture ? (
                                      <img src={user.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover border border-[#2a2a35]" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-[10px] font-bold text-[#9fa0b8]">
                                        {user.name?.charAt(0)?.toUpperCase() || "?"}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm text-white truncate">{user.name}</div>
                                      <div className="text-[10px] text-[#6b6b80] truncate">{user.email}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            {!sendSearching && sendSearchQuery.length >= 2 && sendSearchResults.length === 0 && (
                              <div className="absolute z-10 w-full mt-1 p-3 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-center">
                                <p className="text-[10px] text-[#6b6b80]">No users found</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Destination wallet — only once a recipient is chosen */}
                      {sendRecipient && (
                        <div>
                          <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Send to wallet</label>
                          {sendTargetsLoading ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#2a2a35] bg-[#0e0e12]">
                              <Loader2 className="w-3.5 h-3.5 text-brand animate-spin" />
                              <span className="text-xs text-[#6b6b80]">Loading wallets…</span>
                            </div>
                          ) : sendTargets.length === 0 ? (
                            <div className="px-3 py-2.5 rounded-lg border border-[#2a2a35] bg-[#0e0e12]">
                              <span className="text-xs text-[#6b6b80]">No eligible wallets for this user.</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {sendTargets.map((t) => {
                                const key = `${t.walletType}:${t.orgId || ""}`;
                                const active =
                                  selectedTarget?.walletType === t.walletType &&
                                  (selectedTarget?.orgId || "") === (t.orgId || "");
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedTarget(t)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                                      active
                                        ? "border-brand/40 bg-brand/[0.06]"
                                        : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a48]"
                                    }`}
                                  >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? "bg-brand/15" : "bg-[#1a1a22]"}`}>
                                      {t.walletType === "content_rewards" ? (
                                        <Sparkles className={`w-3.5 h-3.5 ${active ? "text-brand" : "text-[#9fa0b8]"}`} />
                                      ) : (
                                        <Building2 className={`w-3.5 h-3.5 ${active ? "text-brand" : "text-[#9fa0b8]"}`} />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm text-white truncate">
                                        {t.walletType === "content_rewards" ? "Content Rewards" : "Store Vault"}
                                      </div>
                                      <div className="text-[10px] text-[#6b6b80] truncate">
                                        {t.orgName || "Organization"}
                                      </div>
                                    </div>
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${active ? "border-brand" : "border-[#3a3a48]"}`}>
                                      {active && <div className="w-1.5 h-1.5 rounded-full bg-brand" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Target currency picker — surfaces only for Store
                          destinations. Content Rewards is USD-only, so we
                          hide it there. All four cryptobrand currencies are
                          offered; the backend auto-provisions the recipient's
                          sibling wallet if it doesn't exist yet (cryptobrand
                          orgs). A non-cryptobrand target org that gets a
                          non-USD pick will 400 with WALLET_NOT_FOUND. */}
                      {sendRecipient && selectedTarget?.walletType === "store" && (
                        <div>
                          <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">
                            Recipient receives in
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {["USD", "INR", "ETH", "BTC"].map((c) => {
                              const active = sendToCurrency === c;
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    setSendToCurrency(c);
                                    setSendError(null);
                                  }}
                                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all ${
                                    active
                                      ? "border-brand bg-brand/10 ring-1 ring-brand/30"
                                      : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45]"
                                  }`}
                                >
                                  <span className={`text-[11px] font-semibold ${active ? "text-brand" : "text-[#9fa0b8]"}`}>
                                    {currencySymbol(c)} {c}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {sendFromCurrency !== sendToCurrency && (
                            <p className="text-[10px] text-[#6b6b80] mt-1">
                              Cross-currency — converted at spot rate on send.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Amount */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider">
                            Amount {sendFromCurrency !== "USD" && `(${sendFromCurrency})`}
                          </label>
                          <button
                            onClick={() => setSendAmount(String(sendSourceBalance || 0))}
                            className="text-[10px] text-brand hover:opacity-80 font-medium transition-colors"
                          >
                            Max
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b6b80] font-medium">
                            {currencySymbol(sendFromCurrency)}
                          </span>
                          <input
                            type="number"
                            min={currencyDecimals(sendFromCurrency) === 6 ? "0.000001" : "0.01"}
                            step={currencyDecimals(sendFromCurrency) === 6 ? "0.000001" : "0.01"}
                            max={sendSourceBalance || 0}
                            placeholder={currencyDecimals(sendFromCurrency) === 6 ? "0.000000" : "0.00"}
                            value={sendAmount}
                            onChange={(e) => setSendAmount(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-sm text-white placeholder-[#6b6b80] focus:outline-none focus:border-brand/40 transition-colors"
                          />
                        </div>
                        <p className="text-[10px] text-[#6b6b80] mt-1">
                          Available: {formatSymbolAmount(sendSourceBalance || 0, sendFromCurrency)}
                        </p>
                      </div>

                      {/* Note */}
                      <div>
                        <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1 block">Note (optional)</label>
                        <input
                          type="text"
                          placeholder="What's this for?"
                          value={sendDescription}
                          onChange={(e) => setSendDescription(e.target.value)}
                          maxLength={500}
                          className="w-full px-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-sm text-white placeholder-[#6b6b80] focus:outline-none focus:border-brand/40 transition-colors"
                        />
                      </div>

                      {sendError && (
                        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400">{sendError}</p>
                        </div>
                      )}

                      <Button
                        onClick={() => {
                          if (!sendRecipient) { setSendError("Please select a recipient"); return; }
                          if (!selectedTarget) { setSendError("Please choose a destination wallet"); return; }
                          const amt = parseFloat(sendAmount);
                          if (isNaN(amt) || amt <= 0) { setSendError("Please enter a valid amount"); return; }
                          if (amt > sendSourceBalance) { setSendError("Insufficient balance"); return; }
                          setSendError(null);
                          setSendStep("confirm");
                        }}
                        disabled={!sendRecipient || !sendAmount || !selectedTarget || sendTargetsLoading}
                        className="w-full bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm font-medium disabled:opacity-50"
                      >
                        Continue
                      </Button>
                    </>
                  )}

                  {sendStep === "confirm" && sendRecipient && (
                    <>
                      {/* Amount hero — shows source amount + currency. When
                          source ≠ target we add a small "→ recipient
                          receives … at spot" line so the sender knows the
                          FX conversion happens on the receiving side. */}
                      <div className="text-center pt-1 pb-0.5">
                        <div className="text-2xl font-bold text-white tracking-tight">
                          {formatSymbolAmount(parseFloat(sendAmount || "0"), sendFromCurrency)}
                        </div>
                        <p className="text-[10px] text-[#6b6b80] mt-0.5">{sendFromCurrency}</p>
                        {selectedTarget?.walletType === "store" &&
                          sendFromCurrency !== sendToCurrency && (
                            <p className="text-[10px] text-brand mt-1">
                              Recipient receives in {sendToCurrency} at spot rate
                            </p>
                          )}
                      </div>

                      {/* Visual flow: You → Recipient */}
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-9 h-9 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center text-[10px] font-bold text-[#9fa0b8]">
                            You
                          </div>
                          <span className="text-[9px] text-[#6b6b80]">Sender</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-px bg-[#2a2a35]" />
                          <Send className="w-3 h-3 text-brand" />
                          <div className="w-5 h-px bg-[#2a2a35]" />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          {sendRecipient.profilePicture ? (
                            <img src={sendRecipient.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover border border-[#2a2a35]" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[10px] font-bold text-brand">
                              {sendRecipient.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-[9px] text-[#6b6b80] max-w-[70px] truncate text-center">{sendRecipient.name}</span>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="rounded-lg border border-[#1f1f2a] bg-[#0a0a0e] overflow-hidden text-xs">
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-[#6b6b80]">Recipient</span>
                          <span className="text-white">{sendRecipient.email}</span>
                        </div>
                        <div className="h-px bg-[#1f1f2a]" />
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-[#6b6b80]">To wallet</span>
                          <span className="text-white">{targetLabel(selectedTarget)}</span>
                        </div>
                        {sendDescription && (
                          <>
                            <div className="h-px bg-[#1f1f2a]" />
                            <div className="px-3 py-2 flex items-center justify-between">
                              <span className="text-[#6b6b80]">Note</span>
                              <span className="text-[#9fa0b8] truncate ml-3 max-w-[160px]">{sendDescription}</span>
                            </div>
                          </>
                        )}
                        <div className="h-px bg-[#1f1f2a]" />
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-[#6b6b80]">Balance after</span>
                          <span className="text-white font-medium">
                            {formatSymbolAmount(
                              (sendSourceBalance || 0) - parseFloat(sendAmount || "0"),
                              sendFromCurrency,
                            )}
                          </span>
                        </div>
                      </div>

                      {sendError && (
                        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400">{sendError}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setSendStep("form")}
                          className="flex-1 border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] h-9 text-sm"
                          disabled={sendProcessing}
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleSendCredits}
                          disabled={sendProcessing}
                          className="flex-1 bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm font-medium"
                        >
                          {sendProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Send"}
                        </Button>
                      </div>
                    </>
                  )}

                  {sendStep === "success" && (
                    <div className="text-center py-3">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-white mb-0.5">{sendSuccess}</p>
                      <p className="text-[10px] text-[#6b6b80] mb-3">The recipient will see the credits in their {targetLabel(selectedTarget) || "wallet"}.</p>
                      <Button
                        onClick={() => { setShowSendModal(false); resetSendModal(); }}
                        className="w-full bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm"
                      >
                        Done
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Affiliate Wallet Actions */}
            {activeTab === "affiliate" && (
              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4">
                {affiliateGating?.hasPurchasedUnilevelPlus && affiliateGating.redeemableBalance > 0 && (
                  <Button
                    className={`flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm transition-all ${showAffiliateTransferModal
                      ? "bg-[#1a1a22] border border-brand/40 text-brand hover:bg-[#1a1a22]"
                      : "bg-brand hover:opacity-90 text-brand-foreground"
                      }`}
                    onClick={() => {
                      if (showAffiliateTransferModal) {
                        setShowAffiliateTransferModal(false);
                        resetAffiliateTransferModal();
                      } else {
                        setAffTransferOrgId(currentOrgId);
                        setShowAffiliateTransferModal(true);
                      }
                    }}
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>{showAffiliateTransferModal ? "Cancel" : "Transfer to Store Vault"}</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm"
                >
                  <History className="w-4 h-4" />
                  <span>View History</span>
                </Button>
              </div>
            )}

            {/* Affiliate → Store Transfer — inline slide-down */}
            {activeTab === "affiliate" && showAffiliateTransferModal && (
              <div
                className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300"
              >
                <div className="rounded-xl border border-brand/15 bg-brand/[0.02] p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-lg bg-brand/10">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-brand" />
                    </div>
                    <span className="text-xs font-medium text-[#9fa0b8]">Move to Store Vault</span>
                  </div>

                  {/* Destination Office Selector */}
                  <div>
                    <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Destination Office</label>
                    <Popover open={affOrgPickerOpen} onOpenChange={setAffOrgPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-left hover:border-[#3a3a45] focus:outline-none focus:border-brand/40 transition-colors"
                        >
                          {(() => {
                            const selected = storeWallets.find((w) => {
                              const oId = w.orgId && typeof w.orgId === "object" ? w.orgId._id : w.orgId;
                              return oId === (affTransferOrgId || currentOrgId);
                            });
                            const sName = selected && selected.orgId && typeof selected.orgId === "object" ? selected.orgId.name : "Select office";
                            const sIcon = selected && selected.orgId && typeof selected.orgId === "object" ? selected.orgId.icon : undefined;
                            return (
                              <>
                                {sIcon ? (
                                  <img src={sIcon} alt="" className="w-6 h-6 rounded-md object-cover border border-[#2a2a35] shrink-0" />
                                ) : (
                                  <div className="w-6 h-6 rounded-md bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                                    <Building2 className="w-3 h-3 text-[#6b6b80]" />
                                  </div>
                                )}
                                <span className="flex-1 text-sm text-white truncate">{sName}</span>
                                <ChevronDown className={`w-4 h-4 text-[#6b6b80] shrink-0 transition-transform duration-200 ${affOrgPickerOpen ? "rotate-180" : ""}`} />
                              </>
                            );
                          })()}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-1.5 bg-[#0e0e12] border-[#2a2a35] rounded-xl"
                        align="start"
                        sideOffset={6}
                      >
                        <div className="space-y-0.5">
                          {storeWallets.map((w) => {
                            const orgObj = w.orgId && typeof w.orgId === "object" ? w.orgId : null;
                            const oId: string = orgObj ? orgObj._id : (typeof w.orgId === "string" ? w.orgId : "");
                            const oName = orgObj ? orgObj.name : "Store";
                            const oIcon = orgObj ? orgObj.icon : undefined;
                            const isSelected = oId === (affTransferOrgId || currentOrgId);
                            return (
                              <button
                                key={oId}
                                onClick={() => {
                                  setAffTransferOrgId(oId);
                                  setAffOrgPickerOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isSelected
                                  ? "bg-brand/10 border border-brand/20"
                                  : "hover:bg-[#1a1a22] border border-transparent"
                                  }`}
                              >
                                {oIcon ? (
                                  <img src={oIcon} alt="" className="w-7 h-7 rounded-md object-cover border border-[#2a2a35] shrink-0" />
                                ) : (
                                  <div className="w-7 h-7 rounded-md bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-[#6b6b80]" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="text-sm text-white truncate">{oName}</div>
                                  <div className="text-[10px] text-[#6b6b80]">${w.balance.toFixed(2)} balance</div>
                                </div>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 text-brand-foreground" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Amount row — capped at the WITHDRAWABLE balance
                      (min of matured-via-Sunday-cutoff AND Unilevel-Plus
                      redeemable). Moving funds out of the affiliate wallet
                      is gated by the same rule as a withdrawal — this week's
                      earnings stay locked until next Monday. The backend
                      rejects anything above this cap with "Insufficient
                      withdrawable balance"; reflecting it here so the user
                      doesn't see a stale "Available: $X" that contradicts
                      reality. */}
                  {(() => {
                    const withdrawableUsd =
                      withdrawableCents !== null ? withdrawableCents / 100 : 0;
                    const redeemableUsd = affiliateGating?.redeemableBalance || 0;
                    // Defensive: if /withdrawable hasn't returned yet (null),
                    // fall back to redeemable so we don't show $0.00 and
                    // disable Max. Backend still enforces the true cap.
                    const capUsd =
                      withdrawableCents !== null ? withdrawableUsd : redeemableUsd;
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider">Amount</label>
                          <button
                            onClick={() => setAffTransferAmount(capUsd.toFixed(2))}
                            className="text-[10px] text-brand hover:opacity-80 font-medium transition-colors"
                          >
                            Max
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b6b80] font-medium">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={capUsd}
                            placeholder="0.00"
                            value={affTransferAmount}
                            onChange={(e) => setAffTransferAmount(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-sm text-white placeholder-[#6b6b80] focus:outline-none focus:border-brand/40 transition-colors"
                          />
                        </div>
                        <p className="text-[10px] text-[#6b6b80] mt-1">
                          Available: ${capUsd.toFixed(2)}
                          {withdrawableCents !== null && redeemableUsd > withdrawableUsd && (
                            <span
                              className="ml-1 text-[#5a5a72]"
                              title="Earnings credited this week unlock next Sunday 11:59 PM IST."
                            >
                              · ${(redeemableUsd - withdrawableUsd).toFixed(2)} unlocks next Sunday
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })()}

                  {affTransferError && (
                    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400">{affTransferError}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleAffiliateToStoreTransfer}
                    disabled={(() => {
                      if (affTransferProcessing) return true;
                      const parsed = parseFloat(affTransferAmount);
                      if (!affTransferAmount || isNaN(parsed) || parsed <= 0) return true;
                      // Mirror the backend cap so the user can't hit a
                      // server-side "Insufficient withdrawable balance"
                      // error. Falls back to redeemable when /withdrawable
                      // hasn't returned yet (defensive — backend still
                      // enforces the true cap).
                      const cap =
                        withdrawableCents !== null
                          ? withdrawableCents / 100
                          : affiliateGating?.redeemableBalance || 0;
                      if (parsed > cap + 0.005) return true;
                      return false;
                    })()}
                    className="w-full bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm font-medium disabled:opacity-50"
                  >
                    {affTransferProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Transfer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Content Rewards Wallet Actions */}
            {activeTab === "content_rewards" && (contentRewardsBalance?.balance ?? 0) > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4">
                <Button
                  className={`flex items-center justify-center space-x-2 h-9 sm:h-10 text-sm transition-all ${showCrTransferModal
                    ? "bg-[#1a1a22] border border-brand/40 text-brand hover:bg-[#1a1a22]"
                    : "bg-brand hover:opacity-90 text-brand-foreground"
                    }`}
                  onClick={() => {
                    if (showCrTransferModal) {
                      setShowCrTransferModal(false);
                      resetCrTransferModal();
                    } else {
                      setCrTransferOrgId(currentOrgId);
                      // Default destination: Store if user has an active org,
                      // otherwise Affiliate (which works for any user).
                      setCrTransferDestination(currentOrgId ? "store" : "affiliate");
                      setShowCrTransferModal(true);
                    }
                  }}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{showCrTransferModal ? "Cancel" : "Transfer Earnings"}</span>
                </Button>
              </div>
            )}

            {/* Content Rewards → Store/Affiliate Transfer — inline slide-down */}
            {activeTab === "content_rewards" && showCrTransferModal && (
              <div className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="rounded-xl border border-brand/15 bg-brand/[0.02] p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-lg bg-brand/10">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-brand" />
                    </div>
                    <span className="text-xs font-medium text-[#9fa0b8]">Transfer Content Rewards</span>
                  </div>

                  {/* Destination Selector — Store vs Affiliate */}
                  <div>
                    <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Destination Wallet</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setCrTransferDestination("store")}
                        disabled={!currentOrgId}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-sm ${crTransferDestination === "store"
                          ? "bg-brand/10 border-brand/40 text-brand"
                          : "bg-[#0e0e12] border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45]"
                          } ${!currentOrgId ? "opacity-40 cursor-not-allowed" : ""}`}
                        title={!currentOrgId ? "Switch to an organization to transfer to a Store Vault" : ""}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="font-medium">Store Vault</span>
                      </button>
                      <button
                        onClick={() => setCrTransferDestination("affiliate")}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-sm ${crTransferDestination === "affiliate"
                          ? "bg-brand/10 border-brand/40 text-brand"
                          : "bg-[#0e0e12] border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a45]"
                          }`}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span className="font-medium">Affiliate Wallet</span>
                      </button>
                    </div>
                  </div>

                  {/* Destination Office Selector — only when destination is Store */}
                  {crTransferDestination === "store" && (
                    <div>
                      <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Destination Office</label>
                      <Popover open={crOrgPickerOpen} onOpenChange={setCrOrgPickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-left hover:border-[#3a3a45] focus:outline-none focus:border-brand/40 transition-colors"
                          >
                            {(() => {
                              const selected = storeWallets.find((w) => {
                                const oId = w.orgId && typeof w.orgId === "object" ? w.orgId._id : w.orgId;
                                return oId === (crTransferOrgId || currentOrgId);
                              });
                              const sName = selected && selected.orgId && typeof selected.orgId === "object" ? selected.orgId.name : "Select office";
                              const sIcon = selected && selected.orgId && typeof selected.orgId === "object" ? selected.orgId.icon : undefined;
                              return (
                                <>
                                  {sIcon ? (
                                    <img src={sIcon} alt="" className="w-6 h-6 rounded-md object-cover border border-[#2a2a35] shrink-0" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-md bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                                      <Building2 className="w-3 h-3 text-[#6b6b80]" />
                                    </div>
                                  )}
                                  <span className="flex-1 text-sm text-white truncate">{sName}</span>
                                  <ChevronDown className={`w-4 h-4 text-[#6b6b80] shrink-0 transition-transform duration-200 ${crOrgPickerOpen ? "rotate-180" : ""}`} />
                                </>
                              );
                            })()}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-1.5 bg-[#0e0e12] border-[#2a2a35] rounded-xl"
                          align="start"
                          sideOffset={6}
                        >
                          <div className="space-y-0.5">
                            {storeWallets.map((w) => {
                              const orgObj = w.orgId && typeof w.orgId === "object" ? w.orgId : null;
                              const oId: string = orgObj ? orgObj._id : (typeof w.orgId === "string" ? w.orgId : "");
                              const oName = orgObj ? orgObj.name : "Store";
                              const oIcon = orgObj ? orgObj.icon : undefined;
                              const isSelected = oId === (crTransferOrgId || currentOrgId);
                              return (
                                <button
                                  key={oId}
                                  onClick={() => {
                                    setCrTransferOrgId(oId);
                                    setCrOrgPickerOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isSelected
                                    ? "bg-brand/10 border border-brand/20"
                                    : "hover:bg-[#1a1a22] border border-transparent"
                                    }`}
                                >
                                  {oIcon ? (
                                    <img src={oIcon} alt="" className="w-7 h-7 rounded-md object-cover border border-[#2a2a35] shrink-0" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-md bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                                      <Building2 className="w-3.5 h-3.5 text-[#6b6b80]" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="text-sm text-white truncate">{oName}</div>
                                    <div className="text-[10px] text-[#6b6b80]">${w.balance.toFixed(2)} balance</div>
                                  </div>
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0">
                                      <Check className="w-3 h-3 text-brand-foreground" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Amount row */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider">Amount</label>
                      <button
                        onClick={() => setCrTransferAmount(String(contentRewardsBalance?.balance || 0))}
                        className="text-[10px] text-brand hover:opacity-80 font-medium transition-colors"
                      >
                        Max
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b6b80] font-medium">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={contentRewardsBalance?.balance || 0}
                        placeholder="0.00"
                        value={crTransferAmount}
                        onChange={(e) => setCrTransferAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-sm text-white placeholder-[#6b6b80] focus:outline-none focus:border-brand/40 transition-colors"
                      />
                    </div>
                    <p className="text-[10px] text-[#6b6b80] mt-1">
                      Available: ${(contentRewardsBalance?.balance || 0).toFixed(2)}
                    </p>
                  </div>

                  {/* Optional note */}
                  <div>
                    <label className="text-[10px] font-medium text-[#6b6b80] uppercase tracking-wider mb-1.5 block">Note (optional)</label>
                    <input
                      type="text"
                      maxLength={1000}
                      placeholder="e.g. Moving earnings for purchases"
                      value={crTransferNote}
                      onChange={(e) => setCrTransferNote(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0e0e12] border border-[#2a2a35] rounded-lg text-sm text-white placeholder-[#6b6b80] focus:outline-none focus:border-brand/40 transition-colors"
                    />
                  </div>

                  {crTransferError && (
                    <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400">{crTransferError}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleContentRewardsTransfer}
                    disabled={crTransferProcessing || !crTransferAmount || parseFloat(crTransferAmount) <= 0}
                    className="w-full bg-brand hover:opacity-90 text-brand-foreground h-9 text-sm font-medium disabled:opacity-50"
                  >
                    {crTransferProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Transfer to {crTransferDestination === "store" ? "Store Vault" : "Affiliate Wallet"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>}

        {/* Per-wallet payout accounts (bank + crypto) — store / affiliate / content rewards */}
        {activeTab === "store" && (
          <>
            <PayoutAccountsSection walletType="store" orgId={currentOrgId} />
            <WithdrawalPreferenceSection walletType="store" orgId={currentOrgId} />
          </>
        )}
        {activeTab === "affiliate" && (
          <>
            <PayoutAccountsSection walletType="affiliate" />
            <WithdrawalPreferenceSection walletType="affiliate" />
          </>
        )}
        {activeTab === "content_rewards" && (
          <>
            <PayoutAccountsSection walletType="content_rewards" />
            <WithdrawalPreferenceSection walletType="content_rewards" />
          </>
        )}

        {/* Recent Transactions — hidden on Reserve + Rewards + Payment Methods tabs */}
        {activeTab !== "reserve" && activeTab !== "rewards" && activeTab !== "payment_methods" && (() => {
          // Narrow the merged feed by user-selected filter. "earnings" hides
          // any debit-like row (debits, outgoing transfers, withdrawals);
          // "withdrawals" keeps only the withdrawal rows.
          const filteredTransactions = walletData.recentTransactions.filter((t: DisplayTransaction) => {
            if (feedFilter === "all") return true;
            if (feedFilter === "withdrawals") return t.type === "withdrawal";
            if (feedFilter === "deposits") {
              // Crypto top-ups stamp `metadata.kind = "crypto_wallet_topup"`
              // on the WalletTransaction ledger row (see crypto backend's
              // creditUserWalletFromTopup). Matches only those.
              return t.metadata?.kind === "crypto_wallet_topup";
            }
            // "earnings"
            // Forfeitures are the exception among debits: they are part of the
            // earning, not a separate movement. Each one cancels a commission
            // credited moments earlier (no licence, no NetworkChain
            // subscription, or passed up to a licensed upline), so hiding them
            // here would show "+$9.00" for a sale the member kept nothing
            // from — the misleading picture the gross-credit change exists to
            // get rid of.
            if (t.type === "debit" && t.metadata?.forfeiture) return true;
            if (t.type === "withdrawal" || t.type === "debit") return false;
            if (t.type === "transfer") {
              return (t.balanceAfter ?? 0) >= (t.balanceBefore ?? 0);
            }
            return true; // credit
          });
          // Deposits filter only makes sense on cryptobrand offices —
          // treat as "all" everywhere else so a stale selection can't
          // leak crypto-only UI onto a regular USD org.
          const depositsAllowed = activeTab === "store" && currentOrgIsCryptobrand;
          if (feedFilter === "deposits" && !depositsAllowed) {
            // Fire-and-forget reset — cheap, avoids empty state on wrong org.
            queueMicrotask(() => setFeedFilter("all"));
          }
          const filterActive = feedFilter !== "all";
          const filterLabel =
            feedFilter === "withdrawals" ? "Withdrawals" :
            feedFilter === "earnings" ? "Earnings only" :
            feedFilter === "deposits" ? "Deposits" :
            "All";
          return (
        <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <span className="text-sm sm:text-base text-white font-semibold truncate">
              {feedFilter === "withdrawals"
                ? "Recent Withdrawals"
                : feedFilter === "deposits"
                ? "Recent Crypto Deposits"
                : activeTab === "affiliate"
                ? "Recent Commission Earnings"
                : "Recent Transactions"}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title="Filter feed"
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] font-medium transition-colors ${
                      filterActive
                        ? "bg-brand/10 border-brand/30 text-brand"
                        : "bg-transparent border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:border-[#3a3a45]"
                    }`}
                  >
                    <ListFilter className="w-3 h-3" />
                    <span className="hidden sm:inline">{filterLabel}</span>
                    {filterActive && (
                      <span className="sm:hidden ml-0.5 inline-block w-1 h-1 rounded-full bg-brand" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[180px] bg-[#0e0e12] border-[#2a2a35]"
                >
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-[#6b6b80] font-semibold">
                    Show
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#2a2a35]" />
                  <DropdownMenuRadioGroup
                    value={feedFilter}
                    onValueChange={(v) => setFeedFilter(v as FeedFilter)}
                  >
                    <DropdownMenuRadioItem
                      value="all"
                      className="text-[12px] text-[#c7c7da] focus:bg-[#1a1a22] focus:text-white"
                    >
                      All activity
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="earnings"
                      className="text-[12px] text-[#c7c7da] focus:bg-[#1a1a22] focus:text-white"
                    >
                      {activeTab === "affiliate" ? "Earnings only" : "Money in only"}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="withdrawals"
                      className="text-[12px] text-[#c7c7da] focus:bg-[#1a1a22] focus:text-white"
                    >
                      Withdrawals only
                    </DropdownMenuRadioItem>
                    {/* Only surface the crypto-deposit filter on
                        cryptobrand offices — regular USD wallets never
                        get a crypto_wallet_topup row. */}
                    {activeTab === "store" && currentOrgIsCryptobrand && (
                      <DropdownMenuRadioItem
                        value="deposits"
                        className="text-[12px] text-[#c7c7da] focus:bg-[#1a1a22] focus:text-white"
                      >
                        Crypto deposits only
                      </DropdownMenuRadioItem>
                    )}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Export visible transactions as CSV. Operates on the FILTERED
                  feed (what the user actually sees), so toggling the filter
                  scopes the export naturally. Client-side only — works on
                  what's already been loaded ("Load More" extends the set). */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (filteredTransactions.length === 0) {
                    toast.error("No transactions to export");
                    return;
                  }
                  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                  const walletLabel =
                    activeTab === "store"
                      ? "store"
                      : activeTab === "affiliate"
                      ? "affiliate"
                      : "content-rewards";
                  // Mirror the UI's sign convention so totals SUM correctly
                  // in Excel: outgoing = negative, voided (refunded
                  // withdrawals) = zero, everything else = positive.
                  // Matches the +/-/strikethrough display in the list above.
                  const directionFor = (t: DisplayTransaction): "in" | "out" | "voided" => {
                    if (t.type === "withdrawal" && t.status === "rejected") return "voided";
                    if (t.type === "transfer") {
                      return (t.balanceAfter ?? 0) < (t.balanceBefore ?? 0) ? "out" : "in";
                    }
                    if (t.type === "debit" || t.type === "withdrawal") return "out";
                    return "in";
                  };
                  const signedAmountFor = (t: DisplayTransaction): string => {
                    const raw = Math.abs(Number(t.amount || 0));
                    const dir = directionFor(t);
                    if (dir === "voided") return "0.00";
                    if (dir === "out") return (-raw).toFixed(2);
                    return raw.toFixed(2);
                  };
                  const count = exportRowsAsCsv(
                    filteredTransactions,
                    [
                      { header: "Date (UTC)", accessor: (t) => t.createdAt },
                      { header: "Type", accessor: (t) => t.type },
                      { header: "Direction", accessor: (t) => directionFor(t) },
                      { header: "Status", accessor: (t) => t.status },
                      {
                        // Signed: positive = money in, negative = money out,
                        // zero = voided (e.g. rejected withdrawal). Sum this
                        // column for net movement over the visible period.
                        header: "Amount",
                        accessor: (t) => signedAmountFor(t),
                      },
                      {
                        header: "Currency",
                        accessor: () => walletData.wallet.currency,
                      },
                      {
                        header: "Balance before",
                        accessor: (t) =>
                          t.balanceBefore !== undefined
                            ? Number(t.balanceBefore).toFixed(2)
                            : "",
                      },
                      {
                        header: "Balance after",
                        accessor: (t) =>
                          t.balanceAfter !== undefined
                            ? Number(t.balanceAfter).toFixed(2)
                            : "",
                      },
                      { header: "Description", accessor: (t) => t.description || "" },
                      {
                        header: "Related user",
                        accessor: (t) =>
                          t.relatedUser ? `${t.relatedUser.name} <${t.relatedUser.email}>` : "",
                      },
                      {
                        header: "Receipt URL",
                        accessor: (t) => t.receiptUrl || "",
                      },
                    ],
                    `wallet-${walletLabel}-${ts}.csv`
                  );
                  toast.success(`Exported ${count} transaction${count === 1 ? "" : "s"}`);
                }}
                disabled={refreshing}
                title="Export visible transactions to CSV"
                className="p-1.5 sm:p-2 hover:bg-[#1a1a22] text-[#9fa0b8]"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 sm:p-2 hover:bg-[#1a1a22] text-[#9fa0b8]"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <Wallet className="w-10 h-10 sm:w-12 sm:h-12 text-[#2a2a35] mx-auto mb-3 sm:mb-4" />
                <div className="text-sm sm:text-base text-[#9fa0b8] font-medium">
                  {feedFilter === "withdrawals"
                    ? "No withdrawals yet"
                    : feedFilter === "deposits"
                    ? "No crypto deposits yet"
                    : feedFilter === "earnings"
                    ? activeTab === "affiliate"
                      ? "No commission earnings yet"
                      : "No incoming activity yet"
                    : activeTab === "affiliate"
                    ? "No commission earnings yet"
                    : "No transactions yet"}
                </div>
                <div className="text-[#9fa0b8]/70 text-xs sm:text-sm">
                  {feedFilter === "withdrawals"
                    ? "Initiated and completed withdrawals will appear here"
                    : feedFilter === "deposits"
                    ? "Incoming crypto top-ups (BTC / ETH / USDT) will appear here"
                    : feedFilter === "earnings"
                    ? "Incoming credits and earnings will appear here"
                    : activeTab === "affiliate"
                    ? "Your affiliate commission earnings will appear here"
                    : "Your transaction history will appear here"}
                </div>
                {filterActive && walletData.recentTransactions.length > 0 && (
                  <button
                    onClick={() => setFeedFilter("all")}
                    className="mt-3 text-[11px] text-brand hover:opacity-80 font-medium transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              filteredTransactions.map((transaction: DisplayTransaction) => {
                // Determine transaction direction — transfers use balance comparison
                const isOutgoing = transaction.type === "transfer"
                  ? (transaction.balanceAfter ?? 0) < (transaction.balanceBefore ?? 0)
                  : transaction.type === "debit" || transaction.type === "withdrawal";
                const isDebit = isOutgoing;
                // A rejected withdrawal was refunded — render it neutral/struck,
                // not as a red debit, so it doesn't read like a loss.
                const isVoided =
                  transaction.type === "withdrawal" && transaction.status === "rejected";
                // Cashback credits get an amber gift affordance so they read
                // distinctly from ordinary credits/commissions. Metadata is
                // stamped by executeCashback in the backend.
                const isCashback =
                  !isDebit &&
                  !isVoided &&
                  transaction.metadata?.source === "cashback";

                return (
                  <div
                    key={transaction._id}
                    className="flex items-center gap-3 sm:space-x-4 p-2 sm:p-3 hover:bg-[#1a1a22] rounded-lg transition-colors"
                  >
                    <div
                      className={`p-1.5 sm:p-2 rounded-full shrink-0 ${
                        isVoided
                          ? "bg-[#1a1a22]"
                          : isCashback
                          ? "bg-amber-500/20"
                          : isDebit
                          ? "bg-red-500/20"
                          : "bg-green-500/20"
                      }`}
                    >
                      {isVoided ? (
                        <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-[#5a5a72]" />
                      ) : isCashback ? (
                        <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                      ) : isDebit ? (
                        <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-medium text-white truncate">
                        {transaction.type === "transfer"
                          ? (transaction.relatedUser
                            ? (isOutgoing
                              ? `Sent to ${transaction.relatedUser.name}`
                              : `Received from ${transaction.relatedUser.name}`)
                            : transaction.description)
                          : transaction.description}
                      </div>
                      <div className="text-xs sm:text-sm text-[#9fa0b8] flex flex-wrap items-center gap-1 sm:space-x-2">
                        <span>{formatDate(transaction.createdAt)}</span>
                        {isCashback && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Cashback
                            </span>
                          </>
                        )}
                        {transaction.type !== "transfer" && transaction.relatedUser && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="truncate max-w-[120px] sm:max-w-none">{transaction.relatedUser.name}</span>
                          </>
                        )}
                        {activeTab === "affiliate" && transaction.metadata?.legNumber && (
                          <>
                            <span>•</span>
                            <span className="text-brand/80 font-medium">Leg {transaction.metadata.legNumber}</span>
                          </>
                        )}
                        {activeTab === "affiliate" &&
                          transaction.metadata?.networkChainSplit?.role === "retained" && (
                            <>
                              <span>•</span>
                              <span
                                title={
                                  transaction.metadata.networkChainSplit.originalAmount
                                    ? `Full commission was ${formatCurrency(transaction.metadata.networkChainSplit.originalAmount)}. Without an active NetworkChain subscription you keep half; the rest goes to your upline.`
                                    : "Without an active NetworkChain subscription you keep half; the rest goes to your upline."
                                }
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              >
                                Half retained — get NetworkChain to keep 100%
                              </span>
                            </>
                          )}
                        {activeTab === "affiliate" &&
                          transaction.metadata?.networkChainSplit?.role === "forwarded" && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 truncate max-w-[200px]">
                                {transaction.metadata.networkChainSplit.fromUser?.name
                                  ? `From ${transaction.metadata.networkChainSplit.fromUser.name}`
                                  : "Forwarded from your downline"}
                              </span>
                            </>
                          )}
                        {activeTab === "content_rewards" && transaction.metadata?.campaignTitle && (
                          <>
                            <span>•</span>
                            <span className="text-brand/80 font-medium truncate max-w-[180px]">{transaction.metadata.campaignTitle}</span>
                          </>
                        )}
                        {transaction.type === "withdrawal" && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              transaction.status === "completed"
                                ? "bg-green-500/10 text-green-400 border-green-500/20"
                                : transaction.status === "rejected"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-brand/10 text-brand border-brand/20"
                            }`}
                          >
                            {transaction.status === "completed"
                              ? "Completed"
                              : transaction.status === "rejected"
                              ? "Rejected"
                              : "Initiated"}
                          </span>
                        )}
                        {transaction.type === "withdrawal" &&
                          transaction.status === "initiated" &&
                          transaction._id.endsWith("-net") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                              disabled={refreshing}
                              title="Refresh status"
                              className="inline-flex items-center justify-center h-4 w-4 text-[#9fa0b8] hover:text-brand transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                            </button>
                          )}
                        {transaction.type === "withdrawal" &&
                          transaction.status === "completed" &&
                          transaction.receiptUrl && (
                            <a
                              href={transaction.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand/80 hover:text-brand underline underline-offset-2"
                            >
                              Receipt
                            </a>
                          )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div
                        className={`text-sm sm:text-base font-semibold ${
                          isVoided
                            ? "text-[#5a5a72] line-through decoration-[#3a3a4a]"
                            : isDebit
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        {isVoided ? "" : isOutgoing ? "-" : "+"}
                        {formatCurrency(
                          Math.abs(transaction.amount),
                          walletData.wallet.currency
                        )}
                      </div>
                      {/* Running balance after this transaction. Real wallet
                          transactions snapshot `balanceAfter` at write time;
                          synthetic withdrawal sub-rows (net / fee / tax
                          breakdown) don't have one, so we omit it there
                          rather than show a misleading number. */}
                      {transaction.balanceAfter !== undefined && (
                        <div className="text-[10px] sm:text-[11px] text-[#5a5a72] mt-0.5 leading-none">
                          <span className="text-[#3a3a45]">Bal</span>{" "}
                          {formatCurrency(
                            transaction.balanceAfter,
                            walletData.wallet.currency
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load More — store */}
          {activeTab === "store" && walletData.recentTransactions.length > 0 && walletData.recentTransactions.length < storeTxTotal && (
            <div className="mt-3 sm:mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreStoreTransactions}
                disabled={loadingMore}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] h-9 sm:h-10 text-sm"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  `Load More (${storeTxTotal - walletData.recentTransactions.length} remaining)`
                )}
              </Button>
            </div>
          )}

          {/* Load More — affiliate only */}
          {activeTab === "affiliate" && walletData.recentTransactions.length > 0 && walletData.recentTransactions.length < affiliateTxTotal && (
            <div className="mt-3 sm:mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreAffiliateTransactions}
                disabled={loadingMore}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] h-9 sm:h-10 text-sm"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  `Load More (${affiliateTxTotal - walletData.recentTransactions.length} remaining)`
                )}
              </Button>
            </div>
          )}

          {/* Load More — content rewards */}
          {activeTab === "content_rewards" && walletData.recentTransactions.length > 0 && walletData.recentTransactions.length < contentRewardsTxTotal && (
            <div className="mt-3 sm:mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreContentRewardsTransactions}
                disabled={loadingMore}
                className="border-[#2a2a35] text-[#9fa0b8] hover:bg-[#1a1a22] h-9 sm:h-10 text-sm"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  `Load More (${contentRewardsTxTotal - walletData.recentTransactions.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </div>
          );
        })()}

        {/* Reserve Tab Content */}
        {activeTab === "reserve" && (
          <div className="space-y-4 sm:space-y-5">
            {reserveLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 rounded-full border-2 border-[#2a2a35] border-t-brand animate-spin" />
                <p className="mt-3 text-sm text-[#6b6b80]">Loading licenses...</p>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                {reserveStats && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-emerald-400">{reserveStats.available}</div>
                      <div className="text-[10px] sm:text-xs text-[#6b6b80] mt-0.5">Available</div>
                    </div>
                    <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-blue-400">{reserveStats.assigned}</div>
                      <div className="text-[10px] sm:text-xs text-[#6b6b80] mt-0.5">Assigned</div>
                    </div>
                    <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-3 sm:p-4 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-white">{reserveStats.total}</div>
                      <div className="text-[10px] sm:text-xs text-[#6b6b80] mt-0.5">Total</div>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {reserveLicenses.length === 0 ? (
                  <div className="bg-[#0e0e12] rounded-2xl border border-[#2a2a35] p-8 sm:p-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 border border-brand/10 mb-4">
                      <Package className="w-6 h-6 text-brand" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1">No reserve licenses</h3>
                    <p className="text-sm text-[#6b6b80] max-w-xs mx-auto">
                      Buy licenses from the Affiliate tab and assign them to other users to unlock their earnings.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reserveLicenses.map((license) => {
                      const isAssigning = assigningLicenseId === license._id;
                      const isAvailable = license.status === "available";

                      return (
                        <div
                          key={license._id}
                          className={`rounded-xl border transition-all duration-200 overflow-hidden ${isAssigning
                            ? "border-brand/30 bg-[#0e0e12]"
                            : "border-[#2a2a35] bg-[#0e0e12] hover:border-[#3a3a45]"
                            }`}
                        >
                          {/* License Card */}
                          <div className="p-4 flex items-center gap-3.5">
                            {/* Icon */}
                            <div className={`p-2.5 rounded-xl shrink-0 ${isAvailable
                              ? "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20"
                              : "bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/20"
                              }`}>
                              <Zap className={`w-4 h-4 ${isAvailable ? "text-emerald-400" : "text-blue-400"}`} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">Unilevel Plus License</span>
                                <span className={`px-1.5 py-0.5 text-[10px] rounded-md font-medium ${isAvailable
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-blue-500/10 text-blue-400"
                                  }`}>
                                  {isAvailable ? "Available" : "Assigned"}
                                </span>
                              </div>

                              {isAvailable ? (
                                <p className="text-xs text-[#6b6b80] mt-0.5">
                                  ${license.amount} · Ready to assign
                                </p>
                              ) : license.assignedTo ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  {license.assignedTo.profilePicture ? (
                                    <img
                                      src={license.assignedTo.profilePicture}
                                      alt=""
                                      className="w-4.5 h-4.5 rounded-full object-cover border border-[#2a2a35]"
                                    />
                                  ) : (
                                    <div className="w-4.5 h-4.5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                      <span className="text-[8px] text-blue-300 font-bold">
                                        {license.assignedTo.name?.charAt(0)?.toUpperCase() || "?"}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs text-[#9fa0b8] truncate">
                                    {license.assignedTo.name}
                                  </span>
                                  <span className="text-[10px] text-[#6b6b80]">·</span>
                                  <span className="text-[10px] text-[#6b6b80] shrink-0">
                                    {license.assignedAt ? new Date(license.assignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                                  </span>
                                </div>
                              ) : null}
                            </div>

                            {/* Action */}
                            {isAvailable && (
                              RESERVE_ASSIGNMENT_DISABLED ? (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[#1a1a22] text-[#6b6b80] border border-[#2a2a35] shrink-0">
                                  <UserPlus className="w-3 h-3" />
                                  Coming Soon
                                </span>
                              ) : (
                                <button
                                  onClick={() => setAssigningLicenseId(isAssigning ? null : license._id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${isAssigning
                                    ? "bg-[#1a1a22] text-[#9fa0b8] border border-[#2a2a35]"
                                    : "bg-brand hover:opacity-90 text-brand-foreground"
                                    }`}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  {isAssigning ? "Cancel" : "Assign"}
                                </button>
                              )
                            )}
                          </div>

                          {/* Assignment Panel — slides down when active (hidden when feature disabled) */}
                          {isAssigning && !RESERVE_ASSIGNMENT_DISABLED && (
                            <div className="border-t border-[#1a1a22] bg-[#0a0a0c] p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                              <p className="text-xs font-medium text-[#9fa0b8] uppercase tracking-wider mb-3">
                                Assign to a user
                              </p>

                              {/* Search Input */}
                              <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b80]" />
                                <input
                                  type="text"
                                  placeholder="Search by name or email..."
                                  value={assignSearchQuery}
                                  onChange={(e) => handleAssignSearch(e.target.value)}
                                  autoFocus
                                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#131318] border border-[#2a2a35] text-sm text-white placeholder:text-[#6b6b80] focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/10 transition-all"
                                />
                              </div>

                              {/* Loading */}
                              {assignSearchLoading && (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-4 h-4 animate-spin text-[#6b6b80]" />
                                </div>
                              )}

                              {/* Results */}
                              {!assignSearchLoading && assignSearchResults.length > 0 && (
                                <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar rounded-xl">
                                  {assignSearchResults.filter((user: any) => !user.hasUnilevelPlus).map((user: any) => {
                                    const canAssign = !assigning;
                                    return (
                                      <button
                                        key={user._id}
                                        onClick={() => canAssign && handleAssignLicense(license._id, user._id)}
                                        disabled={!canAssign}
                                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-150 ${!canAssign
                                          ? "opacity-40 cursor-not-allowed"
                                          : "hover:bg-[#131318] cursor-pointer group"
                                          }`}
                                      >
                                        {/* Avatar */}
                                        {user.profilePicture ? (
                                          <img
                                            src={user.profilePicture}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover border border-[#2a2a35] shrink-0"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-[#1a1a22] border border-[#2a2a35] flex items-center justify-center shrink-0">
                                            <span className="text-xs text-[#9fa0b8] font-semibold">
                                              {user.name?.charAt(0)?.toUpperCase() || "?"}
                                            </span>
                                          </div>
                                        )}

                                        {/* User info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm text-white font-medium truncate group-hover:text-brand transition-colors">
                                            {user.name || "Unknown"}
                                          </div>
                                          <div className="text-[11px] text-[#6b6b80] truncate">{user.email}</div>
                                        </div>

                                        {/* Status */}
                                        <span className="px-2 py-0.5 text-[10px] rounded-md bg-brand/0 text-[#6b6b80] group-hover:bg-brand/10 group-hover:text-brand border border-transparent group-hover:border-brand/20 transition-all shrink-0">
                                          Select
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* No results */}
                              {!assignSearchLoading && assignSearchQuery.length >= 2 && assignSearchResults.filter((u: any) => !u.hasUnilevelPlus).length === 0 && (
                                <div className="text-center py-6">
                                  <Search className="w-5 h-5 text-[#2a2a35] mx-auto mb-2" />
                                  <p className="text-xs text-[#6b6b80]">No users found for &ldquo;{assignSearchQuery}&rdquo;</p>
                                </div>
                              )}

                              {/* Hint */}
                              {assignSearchQuery.length < 2 && !assignSearchLoading && (
                                <div className="text-center py-4">
                                  <p className="text-xs text-[#6b6b80]">Type at least 2 characters to search</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Rewards Tab Content */}
        {activeTab === "rewards" && <RewardsTab />}

      </div>

      {/* Top Up Store Wallet — slide-in card, available on the Store tab.
          Embeds PaymentMethodSelector inline so the buyer never leaves
          the page (same flow as ProductsPage purchase). */}
      <TopUpStoreWalletSheet
        open={showTopUpSheet}
        onOpenChange={setShowTopUpSheet}
        defaultOrgId={currentOrgId}
        onSuccess={() => fetchWalletData(true)}
        orgs={storeWallets.map((w) => {
          const orgId =
            typeof w.orgId === "object" && w.orgId
              ? w.orgId._id
              : (w.orgId as string);
          const orgName =
            typeof w.orgId === "object" && w.orgId
              ? w.orgId.name
              : "Organization";
          return {
            orgId: String(orgId),
            orgName,
            currentBalance: w.balance || 0,
          };
        })}
      />

      {/* Deposit Crypto sheet — persistent per-user HD-derived address for
          the currently-selected BTC / ETH / USDT wallet on a cryptobrand
          office. Zero writes; backend watchers credit the wallet on any
          incoming tx. Chain selector inside for USDT. */}
      <DepositCryptoSheet
        open={showDepositCryptoSheet}
        onOpenChange={setShowDepositCryptoSheet}
        wallet={
          showDepositCryptoSheet &&
          currentOrgId &&
          (selectedStoreCurrency === "BTC" ||
            selectedStoreCurrency === "ETH" ||
            selectedStoreCurrency === "USDT")
            ? {
                orgId: currentOrgId,
                currency: selectedStoreCurrency as "BTC" | "ETH" | "USDT",
              }
            : null
        }
        onDeposit={() => fetchWalletData(true)}
      />
    </div>
  );
}
