"use client";

// Leaf page: /garage-admin/cryptobrand-offices/[orgId]/users/[userId]
//
// Shows all multi-currency wallets (USD parent + INR / ETH / BTC
// siblings) for the selected user on the selected cryptobrand office.
// Each wallet row has a "Top up" button that opens a modal to credit
// a raw amount in the wallet's native currency (no FX).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { garageAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";
import {
  ArrowLeft,
  Bitcoin,
  Wallet,
  Loader2,
  Plus,
  Mail,
  Star,
  Coins,
  DollarSign,
} from "lucide-react";

interface WalletRow {
  walletId: string;
  currency: string;
  balance: number;
  isParent: boolean;
  parentWalletId: string | null;
  isActive: boolean;
  lastTransactionAt: string | null;
  createdAt: string;
}

interface WalletsResponse {
  success: true;
  user: { userId: string; email: string | null; name: string | null } | null;
  org: { orgId: string; name: string; isCryptobrand: boolean } | null;
  isCryptobrandOrg: boolean;
  wallets: WalletRow[];
}

const CURRENCY_ICONS: Record<string, React.ReactNode> = {
  USD: <DollarSign className="h-5 w-5 text-emerald-400" />,
  INR: <span className="text-lg font-bold text-blue-400">₹</span>,
  ETH: <span className="text-lg font-bold text-indigo-400">Ξ</span>,
  BTC: <Bitcoin className="h-5 w-5 text-orange-400" />,
};

const CURRENCY_COLORS: Record<string, string> = {
  USD: "border-emerald-500/40 bg-emerald-500/5",
  INR: "border-blue-500/40 bg-blue-500/5",
  ETH: "border-indigo-500/40 bg-indigo-500/5",
  BTC: "border-orange-500/40 bg-orange-500/5",
};

function formatBalance(w: WalletRow): string {
  const isCryptoNative = w.currency === "ETH" || w.currency === "BTC";
  const decimals = isCryptoNative ? 8 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(w.balance || 0);
}

export default function CryptobrandUserWalletsPage() {
  // Crediting a wallet is a write on the "store_wallets" page — a "view"
  // role can read balances and history but must not see a Top up button.
  const { canManage } = useAdminAccess();
  const canTopUp = canManage("store_wallets");
  const params = useParams();
  const orgId = params?.orgId as string;
  const userId = params?.userId as string;
  const [data, setData] = useState<WalletsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupWallet, setTopupWallet] = useState<WalletRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await garageAdminApi<WalletsResponse>(
        `/garage-admin/store-wallets/user/${userId}/org/${orgId}`,
      );
      setData(res);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load wallets");
    } finally {
      setLoading(false);
    }
  }, [orgId, userId]);

  useEffect(() => {
    if (orgId && userId) load();
  }, [orgId, userId, load]);

  return (
    <>
      {/* Back link + header */}
      <div>
        <Link
          href={`/garage-admin/cryptobrand-offices/${orgId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {data?.org?.name || "office"} members
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">
              {(data?.user?.name || data?.user?.email || "?")
                .charAt(0)
                .toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {data?.user?.name || "Unnamed user"}
            </h1>
            <p className="text-sm text-gray-400 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              {data?.user?.email || "—"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data?.org?.name} • cryptobrand office
            </p>
          </div>
        </div>
      </div>

      {/* Wallets grid */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-400" />
            Multi-currency Wallets
          </CardTitle>
          <CardDescription className="text-gray-400">
            USD is the parent (unchanged behavior — commissions land
            here). INR / ETH / BTC are siblings funded only by manual
            top-ups below. All raw credits — no FX conversion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#9fa0b8]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading wallets…
            </div>
          ) : !data?.wallets?.length ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white">
                No wallets found
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                The user has no wallets for this org.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.wallets.map((w) => (
                <div
                  key={w.walletId}
                  className={`p-5 rounded-xl border ${CURRENCY_COLORS[w.currency] || "border-gray-800 bg-gray-800/20"}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center">
                        {CURRENCY_ICONS[w.currency] || (
                          <Coins className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white flex items-center gap-2">
                          {w.currency}
                          {w.isParent && (
                            <Badge
                              variant="outline"
                              className="border-[#FBD10D]/40 bg-[#FBD10D]/10 text-[#FBD10D] text-[10px] uppercase tracking-wider"
                            >
                              <Star className="w-2.5 h-2.5 mr-1 fill-current" />
                              Parent
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 tabular-nums">
                          {w.walletId}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                      Balance
                    </div>
                    <div className="text-3xl font-bold text-white tabular-nums">
                      {formatBalance(w)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {w.lastTransactionAt
                        ? `Last tx ${new Date(w.lastTransactionAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`
                        : "No transactions yet"}
                    </div>
                  </div>

                  {canTopUp && (
                    <Button
                      onClick={() => setTopupWallet(w)}
                      className="w-full bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Top up {w.currency}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {topupWallet && (
        <TopupModal
          wallet={topupWallet}
          onClose={() => setTopupWallet(null)}
          onSuccess={() => {
            setTopupWallet(null);
            load();
          }}
        />
      )}
    </>
  );
}

function TopupModal({
  wallet,
  onClose,
  onSuccess,
}: {
  wallet: WalletRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed > 0;
  const isCryptoNative = wallet.currency === "ETH" || wallet.currency === "BTC";
  const step = isCryptoNative ? "0.00000001" : "0.01";

  // Quick-pick chips — sensible defaults per currency. Clicking a chip
  // fills the amount input; user can still type over it.
  const quickAmounts: number[] = (() => {
    if (wallet.currency === "USD") return [10, 50, 100, 500, 1000];
    if (wallet.currency === "INR") return [500, 1000, 5000, 10000, 50000];
    if (wallet.currency === "ETH") return [0.01, 0.05, 0.1, 0.5, 1];
    if (wallet.currency === "BTC") return [0.001, 0.005, 0.01, 0.05, 0.1];
    return [];
  })();

  const currencySymbol =
    wallet.currency === "USD"
      ? "$"
      : wallet.currency === "INR"
        ? "₹"
        : wallet.currency;

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error("Enter a positive amount");
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = `topup-${wallet.walletId}-${Date.now()}`;
      const r = await garageAdminApi<{
        success: true;
        alreadyCredited: boolean;
        wallet: { balanceBefore: number; balanceAfter: number };
      }>(`/garage-admin/store-wallets/${wallet.walletId}/topup`, {
        method: "POST",
        body: JSON.stringify({
          amount: parsed,
          note: note.trim() || undefined,
          idempotencyKey,
        }),
      });
      if (r.alreadyCredited) {
        toast.info("Already credited");
      } else {
        toast.success(
          `Credited ${parsed} ${wallet.currency} — new balance ${r.wallet.balanceAfter}`,
        );
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || "Top-up failed");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-w-md p-0 gap-0 overflow-hidden">
        {/* Header — currency-tinted band with currency icon + name */}
        <div
          className={`px-6 py-5 border-b border-white/[0.06] ${CURRENCY_COLORS[wallet.currency] || ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center shrink-0">
              {CURRENCY_ICONS[wallet.currency] || (
                <Coins className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold text-white">
                Top up {wallet.currency}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#9fa0b8] mt-0.5">
                Raw credit in {wallet.currency} — no FX conversion.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current balance */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <span className="text-xs uppercase tracking-wider text-[#6a6a7a]">
              Current balance
            </span>
            <span className="text-sm font-semibold text-white tabular-nums">
              {formatBalance(wallet)} {wallet.currency}
            </span>
          </div>

          {/* Amount input with currency prefix */}
          <div>
            <Label
              htmlFor="topup-amount"
              className="text-xs font-medium text-[#9fa0b8] mb-1.5 block"
            >
              Amount to credit
            </Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1 text-[#6a6a7a] font-semibold">
                {currencySymbol}
              </div>
              <Input
                id="topup-amount"
                type="number"
                step={step}
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  wallet.currency === "USD"
                    ? "100.00"
                    : wallet.currency === "INR"
                      ? "5000"
                      : "0.05"
                }
                className="bg-[#0a0a0f] border-[#2a2a35] text-white text-lg font-semibold h-12 pl-9 pr-20 tabular-nums focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/60"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-xs font-semibold text-[#6a6a7a] uppercase tracking-wider">
                  {wallet.currency}
                </span>
              </div>
            </div>

            {/* Quick-pick chips */}
            {quickAmounts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {quickAmounts.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium tabular-nums transition-colors ${
                      parsed === v
                        ? "bg-[#FBD10D]/20 border border-[#FBD10D]/40 text-[#FBD10D]"
                        : "bg-white/[0.04] border border-white/[0.06] text-[#9fa0b8] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {currencySymbol}
                    {v.toLocaleString(undefined, {
                      minimumFractionDigits: isCryptoNative ? (v < 0.01 ? 3 : 2) : 0,
                      maximumFractionDigits: isCryptoNative ? 8 : 0,
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <Label
              htmlFor="topup-note"
              className="text-xs font-medium text-[#9fa0b8] mb-1.5 block"
            >
              Note{" "}
              <span className="text-[#6a6a7a] font-normal">(optional, for audit trail)</span>
            </Label>
            <Input
              id="topup-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this top-up?"
              className="bg-[#0a0a0f] border-[#2a2a35] text-white h-11 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/60"
              maxLength={200}
            />
          </div>

          {/* New balance preview */}
          {isValid && (
            <div className="rounded-lg border border-[#FBD10D]/30 bg-[#FBD10D]/[0.04] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9fa0b8]">New balance after top-up</span>
                <span className="text-[#FBD10D] font-bold tabular-nums text-base">
                  {(wallet.balance + parsed).toLocaleString(undefined, {
                    minimumFractionDigits: isCryptoNative ? 8 : 2,
                    maximumFractionDigits: isCryptoNative ? 8 : 2,
                  })}{" "}
                  {wallet.currency}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer — buttons pinned to bottom of modal */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-black/20 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="text-[#9fa0b8] hover:text-white hover:bg-white/[0.04]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className="bg-[#FBD10D] hover:bg-[#e6c00d] text-black font-semibold min-w-[160px] h-10"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Crediting…
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1.5" />
                {isValid ? `Credit ${currencySymbol}${parsed}` : "Enter amount"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
