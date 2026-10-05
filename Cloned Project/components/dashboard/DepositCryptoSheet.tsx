"use client";

/**
 * Deposit Crypto sheet — persistent per-user address flow.
 *
 * Distinct from `TopUpStoreWalletSheet` (which mints a Razorpay/Stripe
 * invoice for USD-priced top-ups). This sheet is for a cryptobrand-
 * office member's BTC / ETH / USDT wallet: renders their long-lived
 * HD-derived deposit address as a QR + copyable string, and polls
 * `/wallet/store/topup-transactions` every 10s while open so a landed
 * deposit shows up without a manual refresh.
 *
 * Zero writes on this side — the backend watchers on `crypto.garage.app`
 * detect the incoming tx, credit the user's native-currency StoreWallet,
 * and write a CryptoTopupTransaction row. This sheet just displays.
 *
 * Design brief locked with Shorupan (2026-09-18):
 *   - Right-side slide-in, matches TopUpStoreWalletSheet visual
 *   - No new npm deps — QR uses the existing api.qrserver.com image URL,
 *     same as CryptoPaymentPanel on the checkout page
 *   - No polling globally — only while THIS sheet is open
 *   - USDT wallet exposes a chain selector (Tron / Polygon / BSC);
 *     BTC / ETH have a single fixed chain and skip the selector
 *   - Every displayed hash + address is copyable via existing
 *     `sonner` toast pattern
 */

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Check as CheckIcon,
  Copy,
  Loader2,
  ArrowUpRight,
  X,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import {
  getCryptoTopupAddress,
  listCryptoTopupTransactions,
  type CryptoTopupAddress,
  type CryptoTopupTransaction,
  type CryptoTopupChain,
} from "@/lib/feed-api";

// ── props / helpers ─────────────────────────────────────────────────

export interface DepositCryptoSheetWallet {
  orgId: string;
  currency: "BTC" | "ETH" | "USDT";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: DepositCryptoSheetWallet | null;
  /** Fires whenever a new deposit lands so the parent wallet page can
   *  refresh the balance card + generic transactions list. */
  onDeposit?: (tx: CryptoTopupTransaction) => void;
}

/** USDT is the only currency that needs a chain picker. */
const USDT_CHAINS: Array<{ value: CryptoTopupChain; label: string; sublabel: string }> = [
  { value: "tron", label: "Tron", sublabel: "TRC-20 · cheapest fees" },
  { value: "polygon", label: "Polygon", sublabel: "ERC-20 on Polygon" },
  { value: "bsc", label: "BNB Chain", sublabel: "BEP-20" },
];

const CHAIN_LABELS: Record<CryptoTopupChain, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  polygon: "Polygon",
  bsc: "BNB Chain",
  tron: "Tron",
};

const EXPLORER_ADDRESS: Record<CryptoTopupChain, string> = {
  bitcoin: "https://mempool.space/address/",
  ethereum: "https://etherscan.io/address/",
  polygon: "https://polygonscan.com/address/",
  bsc: "https://bscscan.com/address/",
  tron: "https://tronscan.org/#/address/",
};

const EXPLORER_TX: Record<CryptoTopupChain, string> = {
  bitcoin: "https://mempool.space/tx/",
  ethereum: "https://etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  bsc: "https://bscscan.com/tx/",
  tron: "https://tronscan.org/#/transaction/",
};

/** Same free QR-code image API used by CryptoPaymentPanel on checkout.
 *  Zero install — matches the "same invoice one" spec. */
function qrImageUrl(payload: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&margin=8`;
}

function truncateMid(s: string, head = 8, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function formatAmount(amount: number, coin: string): string {
  if (coin === "BTC" || coin === "ETH") return amount.toFixed(8);
  if (coin === "USDT") return amount.toFixed(2);
  return String(amount);
}

function formatUsd(n: number): string {
  if (!n || n < 0) return "—";
  if (n < 0.01) return "< $0.01";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(input: string | Date | null): string {
  if (!input) return "—";
  const then = typeof input === "string" ? new Date(input) : input;
  const ms = Date.now() - then.getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// ── component ───────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;

export function DepositCryptoSheet({
  open,
  onOpenChange,
  wallet,
  onDeposit,
}: Props) {
  const [chain, setChain] = useState<CryptoTopupChain | null>(null);
  const [address, setAddress] = useState<CryptoTopupAddress | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [txs, setTxs] = useState<CryptoTopupTransaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [lastLandedTxHash, setLastLandedTxHash] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const seenTxIds = useRef<Set<string>>(new Set());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── auto-pick the fixed chain for BTC / ETH; leave null for USDT ──
  useEffect(() => {
    if (!open || !wallet) {
      setChain(null);
      setAddress(null);
      setAddressError(null);
      setTxs([]);
      setLastLandedTxHash(null);
      seenTxIds.current = new Set();
      return;
    }
    if (wallet.currency === "BTC") setChain("bitcoin");
    else if (wallet.currency === "ETH") setChain("ethereum");
    else setChain(null); // USDT — user picks
  }, [open, wallet]);

  // ── fetch address when chain resolves ─────────────────────────────
  const loadAddress = useCallback(async () => {
    if (!wallet || !chain) return;
    setLoadingAddress(true);
    setAddressError(null);
    setAddress(null);
    try {
      const res = await getCryptoTopupAddress({
        orgId: wallet.orgId,
        currency: wallet.currency,
        chain: wallet.currency === "USDT" ? chain : undefined,
      });
      setAddress(res);
    } catch (err: any) {
      setAddressError(err?.message || "Failed to fetch deposit address");
    } finally {
      setLoadingAddress(false);
    }
  }, [wallet, chain]);

  useEffect(() => {
    if (open && wallet && chain) {
      void loadAddress();
    }
  }, [open, wallet, chain, loadAddress]);

  // ── fetch topup history + poll while open ─────────────────────────
  const loadTxs = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!wallet) return;
      if (!opts.silent) setLoadingTxs(true);
      try {
        const res = await listCryptoTopupTransactions({
          orgId: wallet.orgId,
          currency: wallet.currency,
          page: 1,
          limit: 20,
        });
        // Detect newly-landed deposits vs what we knew last poll.
        const seen = seenTxIds.current;
        const fresh = res.transactions.filter((t) => !seen.has(t._id));
        // Only fire "new deposit" toast after the initial baseline load —
        // the first poll bootstraps the seen-set so we don't spam a toast
        // for every historical row.
        if (seen.size > 0 && fresh.length > 0) {
          for (const t of fresh) {
            setLastLandedTxHash(t.txHash);
            toast.success(
              `Deposit received — ${formatAmount(t.amount, t.coin)} ${t.currency}`,
            );
            onDeposit?.(t);
          }
        }
        res.transactions.forEach((t) => seen.add(t._id));
        setTxs(res.transactions);
      } catch {
        // silent; the manual refresh button is the fallback UX
      } finally {
        if (!opts.silent) setLoadingTxs(false);
      }
    },
    [wallet, onDeposit],
  );

  useEffect(() => {
    if (!open || !wallet) {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    // Initial baseline pull.
    void loadTxs();
    // Poll every 10s while open — matches CryptoPaymentPanel cadence.
    pollTimer.current = setInterval(() => {
      void loadTxs({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [open, wallet, loadTxs]);

  // ── copy address to clipboard ─────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!address?.address) return;
    navigator.clipboard.writeText(address.address).then(() => {
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    });
  }, [address?.address]);

  if (!open || !wallet) return null;

  const isUsdt = wallet.currency === "USDT";
  const chainReadyToLoad = wallet.currency !== "USDT" || chain !== null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Right-side slide-in — mirrors TopUpStoreWalletSheet visual */}
      <div
        className={cn(
          "relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35]",
          "shadow-2xl flex flex-col",
          "animate-in slide-in-from-right duration-300",
        )}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#2a2a35] bg-[#0e0e12]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-brand/10 border border-brand/30 shrink-0">
                <Wallet className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">
                  Deposit {wallet.currency}
                </h2>
                <p className="text-[11px] text-[#9fa0b8] mt-0.5">
                  Send {wallet.currency} to your persistent address —
                  balance credits automatically.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — scrolls */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* USDT chain selector */}
          {isUsdt && (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#9fa0b8] mb-2">
                Choose network
              </label>
              <div className="space-y-1.5">
                {USDT_CHAINS.map((opt) => {
                  const active = chain === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChain(opt.value)}
                      className={cn(
                        "w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg border transition-colors",
                        active
                          ? "border-brand/50 bg-brand/[0.04]"
                          : "border-[#2a2a35] bg-[#131318] hover:border-[#3a3a48] hover:bg-[#1a1a22]",
                      )}
                    >
                      <div>
                        <div className="text-sm text-white">{opt.label}</div>
                        <div className="text-[10px] text-[#6b6b80] mt-0.5">
                          {opt.sublabel}
                        </div>
                      </div>
                      {active && (
                        <CheckIcon className="w-4 h-4 text-brand shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              {chain === null && (
                <div className="mt-2 text-[10px] text-[#6b6b80]">
                  Pick the network your sender is using. Each chain has its
                  own address — sending to the wrong one loses the funds.
                </div>
              )}
            </div>
          )}

          {/* Address / QR panel */}
          {chainReadyToLoad && (
            <div className="rounded-xl border border-[#2a2a35] bg-[#131318] p-4">
              {loadingAddress && (
                <div className="flex flex-col items-center justify-center py-10 text-[#9fa0b8] text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mb-2" />
                  Loading your deposit address…
                </div>
              )}

              {addressError && !loadingAddress && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/[0.03] p-3 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-[#9fa0b8]">
                    <div className="text-red-400 font-medium mb-0.5">
                      Couldn&apos;t load address
                    </div>
                    {addressError}
                    <button
                      type="button"
                      onClick={() => void loadAddress()}
                      className="mt-2 inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                </div>
              )}

              {address && !loadingAddress && !addressError && (
                <>
                  {/* QR */}
                  <div className="flex items-center justify-center bg-white p-3 rounded-lg mx-auto w-[220px] h-[220px]">
                    <img
                      src={qrImageUrl(address.qrData, 200)}
                      alt={`Deposit address QR for ${wallet.currency}`}
                      width={200}
                      height={200}
                      className="block"
                    />
                  </div>

                  {/* Address string + copy */}
                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-wider text-[#6b6b80] mb-1.5">
                      Address · {CHAIN_LABELS[address.chain]}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="w-full text-left px-3 py-2.5 rounded-lg bg-[#0e0e12] border border-[#2a2a35] hover:border-[#3a3a48] transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-white break-all">
                          {address.address}
                        </span>
                        {copied ? (
                          <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#6b6b80] group-hover:text-white shrink-0" />
                        )}
                      </div>
                    </button>
                    <a
                      href={`${EXPLORER_ADDRESS[address.chain]}${address.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#6b6b80] hover:text-brand"
                    >
                      View on explorer <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  {/* Chain-mismatch warning */}
                  <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.03] p-3 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-[#9fa0b8] leading-snug">
                      Send only <span className="text-white font-medium">{address.coin}</span> on the{" "}
                      <span className="text-white font-medium">
                        {CHAIN_LABELS[address.chain]}
                      </span>{" "}
                      network. Sending any other coin or a different network
                      will result in permanent loss of funds.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Waiting-for-deposit indicator + "you can leave" note.
              While THIS sheet is open the FE polls /topup-transactions
              every 10s, which also extends the backend's fast-poll
              window (activePollUntil) — so live detection stays snappy.
              Once the sheet closes, the slower reconciler is the
              safety net: deposits still credit, just with higher
              latency. Copy below is what Shorupan asked for verbatim:
              users should feel free to close this page. */}
          {address && !addressError && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-[#9fa0b8]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand/40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                </span>
                Watching for incoming deposit — usually seconds after your send confirms
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] px-3 py-2 text-[11px] text-[#c7c7da] leading-snug">
                <span className="text-emerald-300 font-medium">
                  You can close this window if you&apos;ve already sent.
                </span>{" "}
                Your wallet updates automatically when the deposit lands —
                no need to keep this open.
              </div>
            </div>
          )}

          {/* Recent deposits (for THIS wallet only) */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-[#9fa0b8]">
                  Recent deposits
                </div>
                <div className="text-[10px] text-[#6b6b80] mt-0.5">
                  Auto-checks every 10 s while this window is open
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadTxs()}
                className="text-[10px] text-[#6b6b80] hover:text-white flex items-center gap-1 shrink-0"
                title="Check now"
              >
                <RefreshCw
                  className={cn(
                    "w-3 h-3",
                    loadingTxs && "animate-spin",
                  )}
                />
                {loadingTxs ? "Checking…" : "Check now"}
              </button>
            </div>
            {txs.length === 0 && !loadingTxs && (
              <div className="text-[11px] text-[#6b6b80] py-4 text-center border border-dashed border-[#1a1a22] rounded-lg">
                No deposits yet. Send a small amount to test the flow —
                it&apos;ll show up here within seconds of the transaction
                confirming on-chain.
              </div>
            )}
            <div className="space-y-1.5">
              {txs.slice(0, 5).map((t) => {
                const isNewest = t.txHash === lastLandedTxHash;
                return (
                  <div
                    key={t._id}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 transition-colors",
                      isNewest
                        ? "border-emerald-500/40 bg-emerald-500/[0.03]"
                        : "border-[#1a1a22] bg-[#0e0e12] hover:bg-[#131318]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-white tabular-nums truncate">
                            +{formatAmount(t.amount, t.coin)}{" "}
                            <span className="text-[#6b6b80] font-normal">
                              {t.currency}
                            </span>{" "}
                            <span className="text-[10px] text-[#6b6b80]">
                              on {CHAIN_LABELS[t.chain]}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#6b6b80] mt-0.5">
                            ≈ {formatUsd(t.amountUsdAtDeposit)} · {timeAgo(t.receivedAt)}
                          </div>
                        </div>
                      </div>
                      <a
                        href={`${EXPLORER_TX[t.chain]}${t.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#6b6b80] hover:text-brand flex items-center gap-1 shrink-0"
                        title={t.txHash}
                      >
                        {truncateMid(t.txHash, 6, 4)}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer — simple close */}
        <div className="shrink-0 px-5 py-4 border-t border-[#2a2a35] bg-[#0e0e12]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full inline-flex items-center justify-center gap-1.5 text-sm text-white bg-[#1a1a22] hover:bg-[#22222c] border border-[#2a2a35] px-3 py-2.5 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
