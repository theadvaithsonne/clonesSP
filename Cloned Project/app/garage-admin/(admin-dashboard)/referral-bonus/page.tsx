"use client";

// Global signup referral bonus — admin surface.
//
// Every referred signup that completes a profile pays this amount TWICE: once
// to the referrer, once to the new user, straight out of the platform store
// wallet. There is no per-payout approval, so this page is the only gate —
// hence the funding runway and the doubled-cost framing being front and centre
// rather than buried.
//
// Backend: garagenew-backend/src/routes/garageAdminReferralBonus.ts

import { useCallback, useEffect, useState } from "react";
import { garageAdminApi } from "@/lib/api";
import { toast } from "sonner";
import {
  Gift,
  Loader2,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Users,
  MailWarning,
  PowerOff,
} from "lucide-react";

interface ConfigResponse {
  success: boolean;
  config: {
    amountUsd: number;
    isActive: boolean;
    updatedAt?: string;
    updatedByEmail?: string;
  };
  funding: {
    platformStoreWalletBalance: number;
    costPerReferredSignup: number;
    remainingPayouts: number | null;
  };
  stats: { totalPayouts: number; totalPaidUsd: number };
}

interface Payout {
  _id: string;
  amountUsd: number;
  totalDebitedUsd: number;
  createdAt: string;
  refereeUserId?: { email?: string; name?: string };
  referrerUserId?: { email?: string; name?: string };
  referrerEmailedAt?: string;
  refereeEmailedAt?: string;
}

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReferralBonusPage() {
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [cfg, po] = await Promise.all([
        garageAdminApi<ConfigResponse>("/garage-admin/referral-bonus"),
        garageAdminApi<{ payouts: Payout[] }>(
          "/garage-admin/referral-bonus/payouts?limit=25"
        ).catch(() => ({ payouts: [] })),
      ]);
      setData(cfg);
      setAmount(String(cfg.config.amountUsd ?? 0));
      setPayouts(po.payouts || []);
    } catch {
      setLoadError(true);
      toast.error("Failed to load referral bonus settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: { amountUsd?: number; isActive?: boolean }) => {
    setSaving(true);
    try {
      await garageAdminApi("/garage-admin/referral-bonus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      toast.success("Saved");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Never fall through to the normal layout on a failed load — an empty
  // config renders identically to "bonus is switched off", and an admin
  // would read a network error as a deliberate setting.
  if (loadError || !data) {
    return (
      <div className="max-w-4xl">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#262626] bg-[#161616] py-16 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-white">
              Couldn&apos;t load referral bonus settings
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              The current amount and status are unknown — nothing here has been
              changed.
            </p>
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-[#282828] bg-[#141414] px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:border-[#3a3a3a] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const cfg = data?.config;
  const fund = data?.funding;
  const parsed = Number(amount);
  const validAmount = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const dirty = validAmount && parsed !== (cfg?.amountUsd ?? 0);
  const perSignup = validAmount ? parsed * 2 : 0;
  const balance = fund?.platformStoreWalletBalance ?? 0;
  const runway = perSignup > 0 ? Math.floor(balance / perSignup) : null;
  const lowRunway = runway !== null && runway < 100;
  // An amount is configured but the switch is off: the silent-failure state.
  const armedButOff = !cfg?.isActive && (cfg?.amountUsd ?? 0) > 0;

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#FFC200]/10 border border-[#FFC200]/25 flex items-center justify-center shrink-0">
            <Gift className="h-5 w-5 text-[#FFC200]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Referral Bonus</h1>
            <p className="text-sm text-zinc-500 mt-0.5 max-w-xl leading-relaxed">
              Paid when a referred user completes their profile — the referrer
              and the new user each receive this amount, funded from the
              platform store wallet.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="shrink-0 rounded-lg border border-[#282828] bg-[#141414] p-2 text-zinc-400 hover:text-white hover:border-[#3a3a3a] transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Saving an amount does NOT switch the bonus on. That two-step is the
          one thing an admin gets wrong here, so it gets a full-width strip
          rather than a status line. */}
      {armedButOff && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.07] p-3.5">
          <PowerOff className="h-4 w-4 text-red-400 shrink-0" />
          <p className="flex-1 text-xs text-red-200/90 leading-relaxed">
            <span className="font-semibold">Nobody is being paid.</span>{" "}
            {usd(cfg?.amountUsd ?? 0)} is saved, but the bonus is switched off —
            referred signups are passing through without a payout.
          </p>
          <button
            disabled={saving}
            onClick={() => save({ isActive: true })}
            className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-40 transition-colors"
          >
            Turn it on
          </button>
        </div>
      )}

      {/* Config card */}
      <div className="rounded-2xl border border-[#262626] bg-gradient-to-b from-[#1C1C1C] to-[#161616] p-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                cfg?.isActive
                  ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]"
                  : "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-white">
                {cfg?.isActive ? "Active" : "Off"}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {cfg?.isActive
                  ? "Every referred signup is being paid."
                  : "No bonuses are being paid."}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving || (!cfg?.isActive && !((cfg?.amountUsd ?? 0) > 0))}
            onClick={() => save({ isActive: !cfg?.isActive })}
            title={
              !cfg?.isActive && !((cfg?.amountUsd ?? 0) > 0)
                ? "Save an amount above $0 first"
                : cfg?.isActive
                  ? "Turn off"
                  : "Turn on"
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              cfg?.isActive ? "bg-[#FFC200]" : "bg-[#2a2a35]"
            }`}
          >
            <span
              className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${
                cfg?.isActive ? "translate-x-[22px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-[#262626] pt-5 space-y-3">
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            Amount per person
          </label>
          <div className="flex items-center gap-3">
            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty && !saving) save({ amountUsd: parsed });
                }}
                className="w-full h-11 rounded-lg bg-[#0F0F0F] border border-[#2a2a2a] pl-7 pr-3 text-white text-lg font-semibold tabular-nums focus:border-[#FFC200]/50 focus:outline-none"
              />
            </div>
            <button
              disabled={!dirty || saving}
              onClick={() => save({ amountUsd: parsed })}
              className="h-11 px-5 rounded-lg bg-[#FFC200] text-black text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e6af00] transition-colors"
            >
              {saving ? "Saving…" : armedButOff ? "Save amount" : "Save"}
            </button>
          </div>

          {/* The number people get wrong: it's paid twice. */}
          <p className="text-xs text-zinc-400">
            Each referred signup costs{" "}
            <span className="text-white font-semibold tabular-nums">
              {usd(perSignup)}
            </span>{" "}
            — {usd(validAmount ? parsed : 0)} to the referrer and{" "}
            {usd(validAmount ? parsed : 0)} to the new user. Both are emailed
            when it lands.
          </p>
          {!validAmount && (
            <p className="text-xs text-red-400">
              Enter an amount between $0 and $100.
            </p>
          )}
          {cfg?.updatedByEmail && (
            <p className="text-[11px] text-zinc-600">
              Last changed by {cfg.updatedByEmail}
              {cfg.updatedAt
                ? ` on ${new Date(cfg.updatedAt).toLocaleDateString()}`
                : ""}
            </p>
          )}
        </div>
      </div>

      {/* Funding */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          icon={<Wallet className="h-4 w-4 text-zinc-400" />}
          label="Platform wallet"
          value={usd(balance)}
        />
        <Stat
          icon={<Users className="h-4 w-4 text-zinc-400" />}
          label="Signups funded"
          value={runway === null ? "—" : runway.toLocaleString()}
          hint={runway === null ? "Set an amount" : "at the current amount"}
          warn={lowRunway}
        />
        <Stat
          icon={<Gift className="h-4 w-4 text-zinc-400" />}
          label="Paid to date"
          value={usd(data?.stats.totalPaidUsd ?? 0)}
          hint={`${data?.stats.totalPayouts ?? 0} payouts`}
        />
      </div>

      {lowRunway && (
        <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            The platform store wallet only covers{" "}
            <span className="font-semibold">{runway}</span> more referred
            signups at this amount. Payouts are skipped — not queued — once it
            runs dry, so top it up before that happens.
          </p>
        </div>
      )}

      {/* Recent payouts */}
      <div className="rounded-2xl border border-[#262626] bg-[#161616] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#262626]">
          <p className="text-sm font-semibold text-white">Recent payouts</p>
        </div>
        {payouts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-600">
            No payouts yet.
          </p>
        ) : (
          <div className="divide-y divide-[#222]">
            {payouts.map((p) => (
              <div
                key={p._id}
                className="px-5 py-3 flex items-center gap-4 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white truncate">
                    {p.refereeUserId?.email || "—"}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    referred by {p.referrerUserId?.email || "—"}
                  </p>
                </div>
                {(!p.referrerEmailedAt || !p.refereeEmailedAt) && (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-1.5 py-0.5 text-[10px] text-amber-300"
                    title={
                      !p.referrerEmailedAt && !p.refereeEmailedAt
                        ? "Neither notification was sent"
                        : !p.referrerEmailedAt
                          ? "The referrer was not notified"
                          : "The new user was not notified"
                    }
                  >
                    <MailWarning className="h-3 w-3" />
                    {!p.referrerEmailedAt && !p.refereeEmailedAt
                      ? "no emails"
                      : "1 email"}
                  </span>
                )}
                <span className="text-zinc-300 font-semibold tabular-nums shrink-0">
                  {usd(p.totalDebitedUsd)}
                </span>
                <span className="text-[11px] text-zinc-600 tabular-nums shrink-0 w-20 text-right">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn
          ? "border-amber-500/30 bg-amber-500/[0.04]"
          : "border-[#262626] bg-[#161616]"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] text-zinc-500 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p
        className={`mt-2 text-xl font-semibold tabular-nums ${
          warn ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}
