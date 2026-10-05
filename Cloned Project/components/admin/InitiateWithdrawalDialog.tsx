"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowUpRight, AlertTriangle, Landmark, Coins, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  initiateWithdrawal,
  quoteWithdrawal,
  type WithdrawalQuote,
} from "@/lib/admin-api/withdrawals";
import type { AdminUserWallet, AdminWalletAccount } from "@/lib/admin-api/users";
import { PayoutAccountDetail } from "@/components/admin/PayoutAccountDetail";

type TaxRow = { id: string; label: string; type: "percent" | "flat"; value: string };
let taxRowSeq = 0;
const newTaxRow = (): TaxRow => ({ id: `t${++taxRowSeq}`, label: "", type: "percent", value: "" });

const NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum", tron: "Tron", bitcoin: "Bitcoin",
  solana: "Solana", bsc: "BNB Chain", polygon: "Polygon",
};
const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function accountLabel(a: AdminWalletAccount): string {
  if (a.accountType === "bank") {
    const tail = a.accountNumber ? `••••${a.accountNumber.slice(-4)}` : "";
    return `${a.bankName || "Bank"}${tail ? ` · ${tail}` : ""}`;
  }
  const net = NETWORK_LABELS[a.cryptoNetwork] || a.cryptoNetwork;
  const tail = a.cryptoAddress ? `${a.cryptoAddress.slice(0, 6)}…${a.cryptoAddress.slice(-4)}` : "";
  return `${net}${tail ? ` · ${tail}` : ""}`;
}

// The fee is NOT computed here. On the affiliate wallet it depends on the
// user's own payout preference (daily/weekly × whether they keep $50 in the
// wallet), so the only honest source is the server: POST
// /garage-admin/withdrawals/quote returns the exact breakdown this dialog
// then commits. A hardcoded percentage here would quietly disagree with what
// is actually charged the moment pricing changes.

export function InitiateWithdrawalDialog({
  userId,
  wallet,
  walletLabel,
  open,
  onOpenChange,
  onDone,
}: {
  userId: string;
  wallet: AdminUserWallet;
  walletLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [accountId, setAccountId] = useState<string>(wallet.accounts[0]?._id || "");
  const [amount, setAmount] = useState("");
  const [taxes, setTaxes] = useState<TaxRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [bankFee, setBankFee] = useState("");
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  // ── Super-admin overrides, this withdrawal only ──────────────────────
  // Neither is written back to the member's saved preference: the fee tier
  // and the withdrawable calculation are untouched from the next
  // withdrawal onwards.
  const [releaseLocked, setReleaseLocked] = useState(false);
  const [feeOverride, setFeeOverride] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");

  const selectedAccount = useMemo(
    () => wallet.accounts.find((a) => a._id === accountId),
    [wallet.accounts, accountId],
  );
  const isBank = selectedAccount?.accountType === "bank";
  const grossCents = Math.round((parseFloat(amount) || 0) * 100);
  const bankFeeCents = isBank ? Math.round((parseFloat(bankFee) || 0) * 100) : 0;

  // Compute each tax line's cents amount off the gross (percent) or flat dollars.
  const taxComputed = taxes.map((t) => {
    const v = parseFloat(t.value) || 0;
    const amount = t.type === "percent" ? Math.round((grossCents * v) / 100) : Math.round(v * 100);
    return { ...t, amount };
  });
  const taxTotalCents = taxComputed.reduce((s, t) => s + t.amount, 0);

  // Every money figure comes from the server quote; the locals below only
  // drive layout before the first quote lands.
  const resolvedFeePct = quote?.feePercent ?? 0;
  const feeCents = quote?.feeCents ?? 0;
  const netCents = quote ? quote.netCents : grossCents - bankFeeCents - taxTotalCents;

  // An empty box means "use the member's tier", not 0%.
  const feeOverridePct =
    feeOverride.trim() === "" ? undefined : Math.max(0, Math.min(100, parseFloat(feeOverride) || 0));
  const overrides =
    releaseLocked || feeOverridePct !== undefined
      ? {
          ...(releaseLocked ? { releaseLockedFunds: true } : {}),
          ...(feeOverridePct !== undefined ? { feePercent: feeOverridePct } : {}),
          ...(overrideReason.trim() ? { reason: overrideReason.trim() } : {}),
        }
      : undefined;

  const bd = quote?.breakdown;
  // The ceiling is the server's, not ours — the dialog must never offer more
  // than the API will accept.
  //
  // The fallback is deliberately `withdrawableBalance` and never
  // `wallet.balance`: on this row the former is CENTS and the latter is
  // DOLLARS (see garageAdmin.controller listAllUserWallets), so mixing them
  // would show a balance 100x wrong. Releasing locked funds therefore waits
  // for the server quote rather than guessing.
  const available = quote?.ceilingCents ?? (wallet.withdrawableBalance || 0);
  const tooMuch = grossCents > available;
  const releasedCents = Math.max(0, grossCents - (bd?.withdrawableCents ?? available));
  const taxesValid = taxes.every((t) => t.label.trim() && (parseFloat(t.value) || 0) >= 0
    && (t.type !== "percent" || (parseFloat(t.value) || 0) <= 100));
  const valid = !!accountId && grossCents >= 1 && !tooMuch && netCents >= 1 && taxesValid;

  // Re-price whenever anything that moves the number changes. Debounced so
  // typing an amount doesn't fire a request per keystroke.
  useEffect(() => {
    if (!open || !accountId) {
      setQuote(null);
      return;
    }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteWithdrawal({
          userId,
          walletType: wallet.walletType,
          ...(wallet.orgId ? { orgId: wallet.orgId } : {}),
          accountId,
          // Priced at a cent when the box is still empty: every money row is
          // hidden until grossCents >= 1, and `breakdown` / `ceilingCents`
          // describe the wallet rather than the amount, so the panel can
          // render the moment the dialog opens.
          amountCents: Math.max(1, grossCents),
          taxes: taxes.map((tx) => ({
            label: tx.label.trim() || "Tax",
            type: tx.type,
            value:
              tx.type === "percent"
                ? parseFloat(tx.value) || 0
                : Math.round((parseFloat(tx.value) || 0) * 100),
          })),
          bankTransferFeeCents: bankFeeCents,
          ...(overrides ? { overrides } : {}),
        });
        if (alive) setQuote(q);
      } catch {
        if (alive) setQuote(null);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, grossCents, bankFeeCents, taxes, userId, wallet.walletType, wallet.orgId,
      releaseLocked, feeOverridePct]);

  function updateTax(id: string, patch: Partial<TaxRow>) {
    setTaxes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
      await initiateWithdrawal({
        userId,
        walletType: wallet.walletType,
        // Forward orgId whenever the wallet has one. Store + Content Rewards
        // are per-org; Affiliate is the only single-pool wallet (orgId
        // arrives as null and we omit it rather than ship `null`).
        ...(wallet.orgId ? { orgId: wallet.orgId } : {}),
        accountId,
        amountCents: grossCents,
        bankTransferFeeCents: bankFeeCents,
        taxes: taxes.map((t) => ({
          label: t.label.trim(),
          type: t.type,
          // percent → the percentage number; flat → cents
          value: t.type === "percent" ? (parseFloat(t.value) || 0) : Math.round((parseFloat(t.value) || 0) * 100),
        })),
        ...(overrides ? { overrides } : {}),
      });
      toast.success("Withdrawal initiated");
      onOpenChange(false);
      setAmount("");
      setTaxes([]);
      setBankFee("");
      setQuote(null);
      setReleaseLocked(false);
      setFeeOverride("");
      setOverrideReason("");
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Failed to initiate withdrawal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111116] border-[#2a2a35] text-white rounded-2xl shadow-2xl max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-[#FBD10D]/10 border border-[#FBD10D]/25 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-[#FBD10D]" />
            </div>
            <DialogTitle className="text-lg font-black tracking-tight">Initiate withdrawal</DialogTitle>
          </div>
          <p className="text-xs text-[#9fa0b8]">
            {walletLabel} · {wallet.walletType === "affiliate" ? "withdrawable" : "balance"}{" "}
            <span className="font-mono text-[#c7c7da]">{fmt(available)}</span>
          </p>
        </DialogHeader>

        {/* Only this middle section scrolls. With the breakdown panel, the
            destination card and an override warning all open at once the
            dialog outgrew the viewport, and the Initiate button went with
            it — hence a fixed header/footer and an overflow body. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1 space-y-4 py-1">
          {/* ── What this wallet actually holds, and why the cap is lower ──
              A super admin is allowed to override the cap, so the dialog has
              to show the reasoning rather than a single number. The two
              locks overlap, so they are listed as separate reasons and never
              summed. */}
          {bd && bd.balanceCents !== bd.withdrawableCents && (
            <div className="rounded-xl border border-[#2a2a35] bg-[#0d0d11] p-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9fa0b8]">Wallet balance</span>
                <span className="font-mono text-white">{fmt(bd.balanceCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#9fa0b8]">Withdrawable now</span>
                <span className="font-mono text-[#c7c7da]">{fmt(bd.withdrawableCents)}</span>
              </div>
              <div className="border-t border-[#22222c] pt-1.5 space-y-1">
                {bd.lockedByMaturityCents > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] leading-snug text-[#5a5a72]">
                      Held for maturity — credited since last Sunday, matures
                      at the next Sunday 11:59pm IST boundary
                    </span>
                    <span className="font-mono text-[11px] text-[#9fa0b8] shrink-0">
                      {fmt(bd.lockedByMaturityCents)}
                    </span>
                  </div>
                )}
                {bd.lockedByLicenceCents > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] leading-snug text-[#5a5a72]">
                      Locked by licence — earned before{" "}
                      {bd.hasLicence ? "the Unilevel Plus licence was bought" : "any Unilevel Plus licence"}
                      , never qualified earnings
                    </span>
                    <span className="font-mono text-[11px] text-[#9fa0b8] shrink-0">
                      {fmt(bd.lockedByLicenceCents)}
                    </span>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={releaseLocked}
                  onChange={(e) => setReleaseLocked(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-[#FBD10D]"
                />
                <span className="text-[11px] leading-snug text-[#c7c7da]">
                  Release locked funds for this withdrawal — raises the cap to{" "}
                  <span className="font-mono">{fmt(bd.balanceCents)}</span>. Never above the
                  real balance, and the member&apos;s rules are unchanged next time.
                </span>
              </label>
            </div>
          )}

          {/* ── The member's own payout settings ──────────────────────
              These decide the fee tier, so an admin looking at a 5% charge
              needs to see WHY it is 5%: how often they take payouts, and
              whether they keep the $50 buffer that earns the lower rate.
              It was previously a one-line hint under the fee and was easy
              to miss entirely. */}
          {wallet.walletType === "affiliate" && (
            <div className="rounded-xl border border-[#2a2a35] bg-[#0d0d11] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-2">
                Their payout preference
              </p>
              {quote?.feeTier?.configured ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9fa0b8]">Frequency</span>
                    <span className="text-white capitalize">
                      {quote.feeTier.frequency === "daily" ? "Daily" : "Weekly"} payouts
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9fa0b8]">Keeps in wallet</span>
                    <span className="font-mono text-white">
                      {quote.feeTier.keepAmountCents
                        ? fmt(quote.feeTier.keepAmountCents)
                        : "nothing — withdraws everything"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9fa0b8]">
                      Meets the {fmt(quote.keepThresholdCents)} buffer
                    </span>
                    <span
                      className={
                        quote.feeTier.meetsKeepThreshold ? "text-emerald-400" : "text-[#c7c7da]"
                      }
                    >
                      {quote.feeTier.meetsKeepThreshold ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#22222c] pt-1.5 text-sm">
                    <span className="text-[#9fa0b8]">Their fee tier</span>
                    <span className="font-mono text-white">{quote.tierFeePercent ?? quote.feePercent}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] leading-snug text-[#9fa0b8]">
                  Nothing saved — they have never chosen a frequency or a buffer, so the
                  default{" "}
                  <span className="font-mono text-white">
                    {quote?.tierFeePercent ?? quote?.feePercent ?? 5}%
                  </span>{" "}
                  applies.
                </p>
              )}
            </div>
          )}

          {/* Account picker */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5 block">
              Payout account
            </label>
            {wallet.accounts.length === 0 ? (
              <p className="text-xs text-red-400">No payout account on this wallet.</p>
            ) : (
              <div className="space-y-1.5">
                {wallet.accounts.map((a) => {
                  const active = a._id === accountId;
                  return (
                    <button
                      key={a._id}
                      type="button"
                      onClick={() => setAccountId(a._id)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                        active
                          ? "bg-[#FBD10D]/10 border-[#FBD10D]/40"
                          : "bg-[#0d0d11] border-[#2a2a35] hover:border-[#363649]"
                      }`}
                    >
                      <div className="h-7 w-7 rounded-lg bg-[#FBD10D]/10 border border-[#FBD10D]/15 flex items-center justify-center shrink-0">
                        {a.accountType === "bank" ? <Landmark className="h-3.5 w-3.5 text-[#FBD10D]" /> : <Coins className="h-3.5 w-3.5 text-[#FBD10D]" />}
                      </div>
                      <span className="text-sm text-white truncate flex-1">{accountLabel(a)}</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-[#5a5a72]">{a.accountType}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Full details of the selected account — always visible so the
                admin can verify the destination before initiating the bank
                transfer. Same fields as the user-detail expandable row,
                rendered via the shared PayoutAccountDetail component. */}
            {(() => {
              const selected = wallet.accounts.find((a) => a._id === accountId);
              if (!selected) return null;
              return (
                <div className="mt-2.5 rounded-xl border border-[#2a2a35] bg-[#0a0a0e] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-2">
                    Verify destination
                  </p>
                  <PayoutAccountDetail account={selected} />
                </div>
              );
            })()}
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1.5 block">
              Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a72]">$</span>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7 h-10 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-xl font-mono focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
              />
              <button
                type="button"
                onClick={() => setAmount((available / 100).toFixed(2))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-[#FBD10D] hover:text-[#e6c00d] px-1.5 py-0.5"
              >
                Max
              </button>
            </div>
            {tooMuch && <p className="text-[11px] text-red-400 mt-1">Exceeds available balance.</p>}
          </div>

          {/* Live breakdown */}
          {grossCents >= 1 && !tooMuch && (
            <div className="bg-[#0d0d11] border border-[#2a2a35] rounded-xl p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between text-[#9fa0b8]">
                <span>Withdrawal amount</span>
                <span className="font-mono text-white">{fmt(grossCents)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[#9fa0b8]">
                <span className="flex items-center gap-1.5 shrink-0">
                  Garage processing fee
                  {/* Blank = the member's own tier. Typing a number applies
                      it to THIS withdrawal only — the fee never touches the
                      debit, it only splits the gross, so nothing about the
                      balance moves. */}
                  <span className="relative inline-flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={feeOverride}
                      onChange={(e) => setFeeOverride(e.target.value)}
                      placeholder={String(quote?.tierFeePercent ?? resolvedFeePct)}
                      aria-label="Override the processing fee percentage"
                      className={`w-14 h-6 rounded-md bg-[#141419] border px-1.5 pr-4 text-right font-mono text-[12px] text-white outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        quote?.feeOverridden
                          ? "border-[#FBD10D]/50 text-[#FBD10D]"
                          : "border-[#2c2c3a] focus:border-[#FBD10D]/40"
                      }`}
                    />
                    <span className="pointer-events-none absolute right-1.5 text-[11px] text-[#5a5a72]">%</span>
                  </span>
                  {quoting && <Loader2 className="inline h-3 w-3 animate-spin" />}
                </span>
                <span className="font-mono text-[#c7c7da]">
                  {feeCents > 0 ? `−${fmt(feeCents)}` : "—"}
                </span>
              </div>
              {quote?.feeOverridden && (
                <p className="-mt-1 text-[11px] text-[#FBD10D]/80">
                  Overridden for this withdrawal — their saved tier is{" "}
                  {quote.tierFeePercent}% and stays that way.
                </p>
              )}
              {quote?.feeTier && (
                <p className="text-[11px] text-[#5a5a72] -mt-1">
                  {quote.feeTier.configured
                    ? `${quote.feeTier.frequency === "daily" ? "Daily" : "Weekly"} payouts · ${
                        quote.feeTier.meetsKeepThreshold
                          ? `keeps ${fmt(quote.feeTier.keepAmountCents || 0)} in the wallet`
                          : "withdraws everything"
                      }`
                    : "No preference saved — default rate"}
                </p>
              )}
              {isBank && (
                <div className="flex items-center justify-between gap-2 text-[#9fa0b8]">
                  <span className="min-w-0">
                    Bank transfer fee
                    <span className="block text-[10px] text-[#5a5a72] leading-tight">
                      charged by the bank — not kept by Garage
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[#5a5a72] text-xs">$</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={bankFee}
                      onChange={(e) => setBankFee(e.target.value)}
                      placeholder="0.00"
                      className="h-8 w-20 bg-[#111116] border-[#2c2c3a] text-white text-xs rounded-lg font-mono focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                    />
                    <span className="font-mono text-[#c7c7da] text-xs w-16 text-right">
                      {bankFeeCents > 0 ? `−${fmt(bankFeeCents)}` : "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Editable tax lines */}
              {taxComputed.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <Input
                    value={t.label}
                    onChange={(e) => updateTax(t.id, { label: e.target.value })}
                    placeholder="Tax / deduction"
                    className="h-8 flex-1 min-w-0 bg-[#111116] border-[#2c2c3a] text-white text-xs rounded-lg focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                  />
                  {/* %/$ toggle */}
                  <div className="flex rounded-lg border border-[#2c2c3a] overflow-hidden shrink-0">
                    {(["percent", "flat"] as const).map((ty) => (
                      <button
                        key={ty}
                        type="button"
                        onClick={() => updateTax(t.id, { type: ty })}
                        className={`h-8 w-7 text-xs font-bold transition-colors ${
                          t.type === ty ? "bg-[#FBD10D] text-black" : "bg-[#111116] text-[#9fa0b8] hover:text-white"
                        }`}
                      >
                        {ty === "percent" ? "%" : "$"}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={t.value}
                    onChange={(e) => updateTax(t.id, { value: e.target.value })}
                    placeholder={t.type === "percent" ? "0" : "0.00"}
                    className="h-8 w-16 shrink-0 bg-[#111116] border-[#2c2c3a] text-white text-xs rounded-lg font-mono focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40 focus-visible:border-[#FBD10D]/40"
                  />
                  <span className="font-mono text-[#c7c7da] text-xs w-16 text-right shrink-0">−{fmt(t.amount)}</span>
                  <button
                    type="button"
                    onClick={() => setTaxes((prev) => prev.filter((x) => x.id !== t.id))}
                    className="h-6 w-6 rounded-md flex items-center justify-center text-[#5a5a72] hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {taxes.length < 10 && (
                <button
                  type="button"
                  onClick={() => setTaxes((prev) => [...prev, newTaxRow()])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FBD10D] hover:text-[#e6c00d]"
                >
                  <Plus className="h-3 w-3" /> Add tax / deduction
                </button>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#2a2a35]">
                <span className="text-white font-semibold">Net payout</span>
                <span className={`font-mono font-black ${netCents >= 1 ? "text-[#FBD10D]" : "text-red-400"}`}>
                  {fmt(Math.max(0, netCents))}
                </span>
              </div>
              {quote && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#5a5a72]">Garage keeps (fee + taxes)</span>
                  <span className="font-mono text-[#9fa0b8]">{fmt(quote.platformRetainsCents)}</span>
                </div>
              )}
              {netCents < 1 && (
                <p className="text-[11px] text-red-400">Deductions exceed the withdrawal amount.</p>
              )}
            </div>
          )}

          {/* Spell out the exception before it is committed, and record why.
              Only appears once an override is actually changing the outcome. */}
          {(releasedCents > 0 || quote?.feeOverridden) && (
            <div className="rounded-xl border border-[#FBD10D]/30 bg-[#FBD10D]/[0.06] p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-[#FBD10D] mt-0.5 shrink-0" />
                <div className="space-y-1 text-[11px] leading-snug text-[#e4d8a8]">
                  {releasedCents > 0 && (
                    <p>
                      Paying out{" "}
                      <span className="font-mono font-semibold">{fmt(releasedCents)}</span> more
                      than the rules allow
                      {bd && bd.lockedByLicenceCents > 0 && releasedCents > bd.lockedByMaturityCents
                        ? " — this reaches into commissions locked by the licence rule, not just early maturity."
                        : "."}
                    </p>
                  )}
                  {quote?.feeOverridden && (
                    <p>
                      Charging {quote.feePercent}% instead of their {quote.tierFeePercent}% tier.
                    </p>
                  )}
                  <p className="text-[#b9ac7e]">
                    The wallet is still debited the full {fmt(grossCents)} and can never go
                    below zero. Their saved preference is untouched.
                  </p>
                </div>
              </div>
              <Input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason (stored on the withdrawal record)"
                maxLength={500}
                className="h-8 bg-[#0d0d11] border-[#2c2c3a] text-white rounded-lg text-[12px] focus-visible:ring-1 focus-visible:ring-[#FBD10D]/40"
              />
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-[#22222c] pt-3 mt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-9 border-[#2c2c3a] bg-transparent text-[#c7c7da] hover:text-white hover:bg-[#15151b] hover:border-[#363649] rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!valid || submitting}
            className="h-9 bg-[#FBD10D] text-black font-bold hover:bg-[#e8c00c] active:scale-[0.98] rounded-xl shadow-lg shadow-[#FBD10D]/10 disabled:opacity-50"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Initiating…</> : "Initiate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
