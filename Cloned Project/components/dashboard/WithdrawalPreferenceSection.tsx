"use client";

/**
 * Withdrawal preference — one card per wallet tab, beside the payout accounts.
 *
 * The user says how often they want this wallet paid out (weekly, every
 * Friday — the default — or daily) and how much to leave in the wallet each
 * time. It is a standing instruction: nothing is automated, the payouts team
 * reads it (Admin → Vaults → Withdrawals → Preferences) and pays out from
 * there. Same visual vocabulary as PayoutAccountsSection so the two read as
 * one settings block.
 *
 * On the AFFILIATE wallet the choice is also priced, so the card shows what
 * each combination costs and what the current one earns:
 *
 *                     withdraw everything      keep $50 in
 *     daily                   5%                    2%
 *     weekly                  2%                    0%
 *
 * A bank payout additionally carries whatever the bank charges; a crypto
 * payout doesn't. The percentages, the $50 bar and the wording all come from
 * GET /wallet/withdrawal-fees — this file renders them and never hardcodes a
 * rate, so a pricing change on the server needs no release here.
 *
 * Store and Content Rewards withdrawals are free: for those the card keeps its
 * original shape and the pricing block is simply absent.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  Check,
  Coins,
  Info,
  Loader2,
  PiggyBank,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getWithdrawalFees,
  getWithdrawalPreference,
  saveWithdrawalPreference,
  type AffiliateFeeMatrixCell,
  type WalletAccountWalletType,
  type WithdrawalFeesResponse,
  type WithdrawalFrequency,
  type WithdrawalPreferenceData,
} from "@/lib/feed-api";

const WALLET_LABELS: Record<WalletAccountWalletType, string> = {
  store: "Store Wallet",
  affiliate: "Affiliate Wallet",
  content_rewards: "Content Rewards",
};

const OPTIONS: {
  value: WithdrawalFrequency;
  label: string;
  hint: string;
  icon: typeof CalendarDays;
}[] = [
  { value: "weekly", label: "Weekly", hint: "Every Friday", icon: CalendarDays },
  { value: "daily", label: "Daily", hint: "Every day", icon: CalendarClock },
];

const pctLabel = (n: number) => `${n}%`;

const inputClass =
  "bg-[#1a1a22] border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/40 focus-visible:ring-brand/20 focus-visible:border-brand/40 h-9 text-sm rounded-lg";

function centsToInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

function inputToCents(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Cheapest first — used to point out a better tier than the current one. */
function cellFor(
  matrix: AffiliateFeeMatrixCell[] | undefined,
  frequency: WithdrawalFrequency,
  keepsFifty: boolean,
): AffiliateFeeMatrixCell | undefined {
  return matrix?.find((c) => c.frequency === frequency && c.keepsFifty === keepsFifty);
}

export function WithdrawalPreferenceSection({
  walletType,
  orgId,
}: {
  walletType: WalletAccountWalletType;
  orgId?: string | null;
}) {
  const blocked = walletType === "store" && !orgId;
  const priced = walletType === "affiliate";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<WithdrawalPreferenceData | null>(null);
  const [fees, setFees] = useState<WithdrawalFeesResponse | null>(null);
  const [frequency, setFrequency] = useState<WithdrawalFrequency>("weekly");
  const [keepsFifty, setKeepsFifty] = useState(false);
  /** Free-form buffer — store / content-rewards only, unchanged from before. */
  const [keep, setKeep] = useState<string>("");

  const keepThresholdCents = fees?.keepThresholdCents ?? 5000;
  const keepLabel = `$${(keepThresholdCents / 100).toFixed(0)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefRes, feeRes] = await Promise.all([
        getWithdrawalPreference(walletType, orgId),
        priced ? getWithdrawalFees(walletType) : Promise.resolve(null),
      ]);
      setSaved(prefRes.preference);
      setFrequency(prefRes.preference.frequency);
      const threshold = (feeRes as WithdrawalFeesResponse | null)?.keepThresholdCents ?? 5000;
      setKeepsFifty((prefRes.preference.keepAmountCents ?? 0) >= threshold);
      setKeep(centsToInput(prefRes.preference.keepAmountCents));
      if (feeRes) setFees(feeRes as WithdrawalFeesResponse);
    } catch {
      // Unreachable backend — show the default, still editable.
      setSaved({ frequency: "weekly", keepAmountCents: null, isSet: false, updatedAt: null });
    } finally {
      setLoading(false);
    }
  }, [walletType, orgId, priced]);

  useEffect(() => {
    if (blocked) {
      setLoading(false);
      return;
    }
    void load();
  }, [blocked, load]);

  const savedKeepsFifty = (saved?.keepAmountCents ?? 0) >= keepThresholdCents;
  const keepCents = useMemo(() => inputToCents(keep), [keep]);
  const keepInvalid = !priced && keep.trim() !== "" && keepCents === null;
  const dirty =
    !!saved &&
    (priced
      ? // An unconfigured user sits on the default 5% while the screen already
        // reads "weekly / withdraw everything" — which is 2%. Nothing is
        // "changed", so a pure diff would grey out Save and strand them on the
        // dearer rate. Saving IS the action that earns the discount.
        !saved.isSet ||
        frequency !== saved.frequency ||
        keepsFifty !== savedKeepsFifty
      : frequency !== saved.frequency ||
        (frequency === "weekly" && (keepCents ?? null) !== (saved.keepAmountCents ?? null)));

  /** What the current on-screen selection would cost. */
  const selected = useMemo(
    () => cellFor(fees?.matrix, frequency, keepsFifty),
    [fees?.matrix, frequency, keepsFifty],
  );

  /** The cheapest tier available, to nudge toward when they aren't on it. */
  const best = useMemo(() => cellFor(fees?.matrix, "weekly", true), [fees?.matrix]);

  async function save() {
    if (keepInvalid) {
      toast.error("Enter a valid amount to keep, or leave it empty");
      return;
    }
    setSaving(true);
    try {
      const r = await saveWithdrawalPreference({
        walletType,
        orgId,
        frequency,
        keepAmountCents: priced
          ? keepsFifty
            ? keepThresholdCents
            : null
          : frequency === "weekly"
            ? keepCents
            : null,
      });
      setSaved(r.preference);
      setKeep(centsToInput(r.preference.keepAmountCents));
      toast.success(
        priced && selected
          ? `Saved — ${pctLabel(selected.feePercent)} Garage processing fee`
          : "Withdrawal preference saved",
      );
      // PUT already returns the newly-resolved tier, so the "Now paying" pill
      // updates from the same write that caused it — no second round trip, and
      // no stale pill if a refetch were to fail.
      if (priced && r.preference.feeTier) {
        setFees((f) => (f ? { ...f, current: r.preference.feeTier! } : f));
      }
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save the preference");
    } finally {
      setSaving(false);
    }
  }

  if (blocked) return null;

  if (loading) {
    return (
      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-5">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-[#1a1a22]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 rounded bg-[#1a1a22]" />
            <div className="h-3 w-52 rounded bg-[#1a1a22]" />
          </div>
        </div>
      </div>
    );
  }

  const currentFeePct = fees?.current?.feePercent;
  const unconfigured = priced && saved && !saved.isSet;

  return (
    <div className="space-y-3">
      {/* heading — same row shape as Payout Accounts */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarClock className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
          Withdrawal Preference
        </h3>
        <span className="text-[10px] text-[#5a5a72]">
          {WALLET_LABELS[walletType]}
          {saved && !saved.isSet ? " · using the default" : ""}
        </span>
        {priced && typeof currentFeePct === "number" && (
          <span
            className={[
              "ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              currentFeePct === 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : currentFeePct <= 2
                  ? "bg-brand/10 text-brand border-brand/20"
                  : "bg-[#1a1a22] text-[#9fa0b8] border-[#2a2a35]",
            ].join(" ")}
          >
            Now paying {pctLabel(currentFeePct)}
          </span>
        )}
      </div>

      <div className="bg-[#0e0e12] rounded-xl border border-[#2a2a35] p-4 sm:p-5 space-y-4">
        {/* Nobody configured yet → say what it is costing them. */}
        {unconfigured && (
          <div className="flex items-start gap-2.5 rounded-xl border border-brand/25 bg-brand/[0.06] px-3.5 py-3">
            <Info className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-[#e6e6f0]">
              You&apos;re on the default{" "}
              <span className="font-semibold text-white">
                {pctLabel(fees?.defaultFeePercent ?? 5)} processing fee
              </span>
              . Choose a schedule below — weekly payouts while keeping {keepLabel} in
              the wallet bring it to{" "}
              <span className="font-semibold text-emerald-400">
                {pctLabel(best?.feePercent ?? 0)}
              </span>
              .
            </p>
          </div>
        )}

        {/* frequency — segmented, two tiles */}
        <div>
          <div className="text-[11px] text-[#9fa0b8] mb-2">
            How often should this wallet be paid out?
          </div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Withdrawal frequency">
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              const on = frequency === o.value;
              const cell = cellFor(fees?.matrix, o.value, keepsFifty);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setFrequency(o.value)}
                  className={[
                    "relative flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    on
                      ? "border-brand/50 bg-brand/[0.06]"
                      : "border-[#2a2a35] bg-[#0a0a0c] hover:border-[#3a3a45] hover:bg-[#131318]",
                  ].join(" ")}
                >
                  <div className={["p-2 rounded-lg shrink-0", on ? "bg-brand/20" : "bg-[#1a1a22]"].join(" ")}>
                    <Icon className={["w-4 h-4", on ? "text-brand" : "text-[#9fa0b8]"].join(" ")} />
                  </div>
                  <div className="min-w-0">
                    <div className={["text-sm font-semibold", on ? "text-white" : "text-[#c9c9ee]"].join(" ")}>
                      {o.label}
                      {o.value === "weekly" && (
                        <span className="ml-1.5 text-[10px] font-medium text-[#5a5a72]">Default</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#9fa0b8]">{o.hint}</div>
                    {priced && cell && (
                      <div
                        className={[
                          "text-[11px] font-semibold mt-0.5",
                          cell.feePercent === 0 ? "text-emerald-400" : "text-brand",
                        ].join(" ")}
                      >
                        {pctLabel(cell.feePercent)} fee
                      </div>
                    )}
                  </div>
                  {on && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-brand-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* keep-amount — a binary choice on affiliate (it is what moves the
            fee); a free-form buffer elsewhere is not offered, since only the
            affiliate wallet prices it. */}
        {priced ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-3.5 h-3.5 text-[#9fa0b8]" />
              <div className="text-[11px] text-[#9fa0b8]">
                Leave {keepLabel} in the wallet each payout?
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`Keep ${keepLabel}`}>
              {[
                { on: false, title: "Withdraw everything", sub: "Nothing held back" },
                { on: true, title: `Keep ${keepLabel} in`, sub: "Lower processing fee" },
              ].map((opt) => {
                const active = keepsFifty === opt.on;
                const cell = cellFor(fees?.matrix, frequency, opt.on);
                return (
                  <button
                    key={String(opt.on)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKeepsFifty(opt.on)}
                    className={[
                      "relative rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-brand/50 bg-brand/[0.06]"
                        : "border-[#2a2a35] bg-[#0a0a0c] hover:border-[#3a3a45] hover:bg-[#131318]",
                    ].join(" ")}
                  >
                    <div className={["text-sm font-semibold", active ? "text-white" : "text-[#c9c9ee]"].join(" ")}>
                      {opt.title}
                    </div>
                    <div className="text-[11px] text-[#9fa0b8]">{opt.sub}</div>
                    {cell && (
                      <div
                        className={[
                          "text-[11px] font-semibold mt-0.5",
                          cell.feePercent === 0 ? "text-emerald-400" : "text-brand",
                        ].join(" ")}
                      >
                        {pctLabel(cell.feePercent)} fee
                      </div>
                    )}
                    {active && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-brand-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Store / Content Rewards — untouched: a free-form optional buffer on
             weekly, exactly as before. These wallets carry no Garage fee, so
             there is no tier to buy and nothing to price. */
          frequency === "weekly" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-3.5 h-3.5 text-[#9fa0b8]" />
                <div className="text-[11px] text-[#9fa0b8]">
                  Leave this much in the wallet and withdraw the rest
                  <span className="ml-1 text-[#5a5a72]">(optional)</span>
                </div>
              </div>
              <div className="relative max-w-[220px]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9fa0b8]">
                  $
                </span>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={keep}
                  onChange={(e) => setKeep(e.target.value.replace(/[^\d.]/g, ""))}
                  aria-invalid={keepInvalid}
                  className={`${inputClass} pl-7 ${keepInvalid ? "border-red-500/50 focus-visible:border-red-500/60" : ""}`}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-[#5a5a72]">
                {keepCents && keepCents > 0
                  ? `Each Friday, everything above $${(keepCents / 100).toFixed(2)} is paid out.`
                  : "Leave empty to withdraw the full available balance each Friday."}
              </div>
            </div>
          )
        )}

        {/* What the current selection costs, per payout method. Labels come
            from the server so the wording is identical everywhere. */}
        {priced && selected && (
          <div className="rounded-xl border border-[#2a2a35] bg-[#0a0a0c] p-3.5 space-y-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5a5a72]">
              What you&apos;ll be charged
            </div>
            {selected.methods.map((m) => {
              const Icon = m.method === "crypto" ? Coins : Banknote;
              return (
                <div key={m.method} className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-[#1a1a22] shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#9fa0b8]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-white capitalize">
                      {m.method === "crypto" ? "Crypto payout" : "Bank transfer"}
                    </div>
                    <div className="text-[11px] text-[#9fa0b8] leading-relaxed">{m.label}</div>
                  </div>
                  <div
                    className={[
                      "ml-auto text-sm font-bold tabular-nums shrink-0",
                      m.feePercent === 0 ? "text-emerald-400" : "text-brand",
                    ].join(" ")}
                  >
                    {pctLabel(m.feePercent)}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-[#5a5a72] leading-relaxed pt-0.5 border-t border-[#1a1a22]">
              Bank transfer fees are charged by your bank, not by Garage — they vary
              by bank and country and are deducted from the amount you receive.
            </p>
          </div>
        )}

        {/* One-line nudge when a cheaper tier exists. */}
        {priced && best && selected && selected.feePercent > best.feePercent && (
          <button
            type="button"
            onClick={() => {
              setFrequency("weekly");
              setKeepsFifty(true);
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5 text-left transition-colors hover:border-emerald-500/40"
          >
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-[#e6e6f0]">
              Switch to weekly and keep {keepLabel} in to pay{" "}
              <span className="font-semibold text-emerald-400">
                {pctLabel(best.feePercent)}
              </span>{" "}
              instead of {pctLabel(selected.feePercent)}.
            </span>
          </button>
        )}

        {/* footer */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-[#5a5a72]">
            {saved?.isSet && saved.updatedAt
              ? `Saved ${new Date(saved.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "Payouts are processed by the Garage team on this schedule."}
          </div>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !dirty || keepInvalid}
            className="h-8 bg-brand text-brand-foreground hover:bg-brand/90 text-xs font-semibold disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : dirty ? (
              "Save preference"
            ) : saved?.isSet ? (
              "Saved"
            ) : (
              "Default in use"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default WithdrawalPreferenceSection;
