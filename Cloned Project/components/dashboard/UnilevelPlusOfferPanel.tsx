"use client";

/**
 * The window-aware half of the Unilevel Plus card.
 *
 * Buying the $25 licence inside a 24-hour window (24h from the buyer's
 * profileCompletedAt) includes the first NetworkChains month free. Past that
 * window NetworkChains has to be paid for — monthly, or by prepaying a term.
 *
 * The in-app card used to know none of this: it posted {quantity} to
 * /unilevel-plus/checkout/create-order and never mentioned the offer, so
 * in-window buyers missed a free month they qualified for and expired buyers
 * got no route to NetworkChains at all.
 *
 * All pricing is server-supplied. `GET /unilevel-plus/product` already returns
 * `comboTerms` priced for THIS buyer's window state — closed gives the
 * standalone list (which includes the 1-month row), open gives the bundle list
 * (which omits it, because month one is free). This component never does
 * pricing arithmetic; it renders what the backend sends.
 *
 * Prices are PRE-TAX. GST is 18% and applies only to Indian buyers, so a
 * single tax-inclusive figure would be wrong for everyone else — tax is
 * resolved at checkout.
 */

import { useEffect, useState } from "react";
import { Check, Clock, Sparkles, Zap, Loader2 } from "lucide-react";
import type { UnilevelPlusProduct } from "@/lib/feed-api";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** "7h 04m 12s" — ticked locally so the card doesn't re-poll every second. */
export function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, "0")}m`;
  if (h > 0)
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

type ComboGroup = NonNullable<UnilevelPlusProduct["comboTerms"]>[number];
type ComboTerm = ComboGroup["terms"][number];

/**
 * Live countdown to the end of the offer window.
 *
 * Seeded from the server's `secondsRemaining` rather than differencing
 * `expiresAt` against the browser clock, so a skewed device can't show an
 * offer as live when the server has already closed it. Calls `onExpire` once
 * when it reaches zero so the parent can re-fetch and flip to the picker.
 */
function Countdown({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire?: () => void;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => setLeft(seconds), [seconds]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          onExpire?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // onExpire is intentionally excluded — a parent that re-creates the
    // callback each render would otherwise restart the interval every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left > 0]);

  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Clock className="h-3 w-3" />
      {formatRemaining(left)} left
    </span>
  );
}

/**
 * IN-WINDOW banner. The buyer still qualifies, so the action stays a single
 * $25 purchase — this just makes the offer visible, which is the whole reason
 * people were missing it.
 */
export function FreeMonthBanner({
  clientName,
  secondsRemaining,
  onExpire,
}: {
  clientName: string;
  secondsRemaining: number;
  onExpire?: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-brand/25 bg-gradient-to-r from-brand/[0.12] to-transparent px-4 py-3">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">
            First month of {clientName} included
          </p>
          <p className="mt-0.5 text-[11px] text-[#9fa0b8]">
            Activate now and your first month is free — then{" "}
            {clientName} bills monthly.
          </p>
          {secondsRemaining > 0 && (
            <p className="mt-1.5 text-[11px] font-medium text-brand">
              <Countdown seconds={secondsRemaining} onExpire={onExpire} />
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PAST-WINDOW picker. The free month is gone, so the buyer chooses how much
 * NetworkChains to prepay alongside the licence.
 *
 * Rows and totals mirror the public /magic-link offer page so the two
 * checkouts read identically.
 */
export function BundlePicker({
  group,
  licenceUsd,
  selectedTermMonths,
  onSelect,
  onBuy,
  busy,
}: {
  group: ComboGroup;
  licenceUsd: number;
  selectedTermMonths: number;
  onSelect: (termMonths: number) => void;
  onBuy: () => void;
  busy?: boolean;
}) {
  const selected: ComboTerm | undefined =
    group.terms.find((t) => t.termMonths === selectedTermMonths) ??
    group.terms[0];

  if (!group.terms.length) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b6b80]">
        Choose your plan
      </p>

      <div className="space-y-2">
        {group.terms.map((t) => {
          const active = t.termMonths === selected?.termMonths;
          const perMonth =
            t.monthsOfAccess > 0 ? t.cartTotal / t.monthsOfAccess : t.cartTotal;
          return (
            <button
              key={t.termMonths}
              type="button"
              onClick={() => onSelect(t.termMonths)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-brand bg-brand/[0.07]"
                  : "border-[#2a2a35] bg-[#0a0a10] hover:border-[#3a3a45]"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  active ? "border-brand bg-brand" : "border-[#3a3a45]"
                }`}
              >
                {active && <Check className="h-2.5 w-2.5 text-black" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-white">
                  {t.label}
                </span>
                <span className="block text-[11px] text-[#6b6b80]">
                  {t.monthsOfAccess === 1
                    ? "1 month"
                    : `${t.monthsOfAccess} months`}{" "}
                  of access
                  {t.monthsOfAccess > 1
                    ? ` · ${money(Math.round(perMonth * 100) / 100)}/mo`
                    : ""}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-[15px] font-bold tabular-nums text-white">
                  {money(t.cartTotal)}
                </span>
                {/* Only when there is a real saving. Standalone and bundle
                    prices are currently identical, so rendering this
                    unconditionally produced a "Save $0" badge. */}
                {t.savingUsd > 0 && (
                  <span className="block text-[10px] font-medium text-emerald-400">
                    Save {money(t.savingUsd)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-[#2a2a35] bg-[#0a0a10] px-4 py-3 text-[12px]">
          <div className="flex justify-between">
            <span className="text-[#9fa0b8]">Unilevel Plus licence</span>
            <span className="tabular-nums text-white">{money(licenceUsd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="min-w-0 truncate pr-2 text-[#9fa0b8]">
              {group.clientName} — {selected.label}
            </span>
            <span className="tabular-nums text-white">
              {money(selected.subscriptionUsd)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#2a2a35] pt-2">
            <span className="text-[13px] text-[#9fa0b8]">Total today</span>
            <span className="text-xl font-bold tabular-nums text-white">
              {money(selected.cartTotal)}
            </span>
          </div>
          <p className="pt-1 text-[10px] text-[#6b6b80]">
            Taxes calculated at checkout.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onBuy}
        disabled={busy || !selected}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/5 transition-all hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] hover:shadow-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            {selected ? `Continue — ${money(selected.cartTotal)}` : "Continue"}
          </>
        )}
      </button>
    </div>
  );
}
