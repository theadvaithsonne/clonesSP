"use client";

/**
 * Vaults → Withdrawals → "Preferences" sub-tab.
 *
 * Every standing payout instruction users have set on their wallets (weekly
 * every Friday, or daily; optional keep-amount on either), with what is due
 * against it right now — and, on the affiliate wallet, the Garage processing
 * fee that choice earns them: daily 5% / 2%, weekly 2% / 0%, the lower rate in
 * each pair being the one where they leave $50+ behind. Store and
 * content-rewards preferences are free and read "No fee".
 *
 * Read-only by design: the team reads this and initiates withdrawals from the
 * Queue tab exactly as before — nothing is automated. Visual vocabulary matches
 * the queue (same cards, pills, stat tiles) so the two tabs read as one page.
 */

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Search, CalendarDays, CalendarClock, Wallet, PiggyBank, Users, Copy, Check as CheckIcon,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import {
  listWithdrawalPreferences,
  type WithdrawalPreferenceRow,
  type WithdrawalPreferencesResult,
} from "@/lib/admin-api/withdrawals";

const PAGE_SIZE = 30;
const FREQ = ["all", "weekly", "daily"] as const;

const WALLET_LABEL: Record<WithdrawalPreferenceRow["walletType"], string> = {
  store: "Store Wallet",
  affiliate: "Affiliate Wallet",
  content_rewards: "Content Rewards",
};

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Today";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string; icon: any; accent: "yellow" | "green" | "zinc";
}) {
  const p = {
    yellow: "bg-brand/5 border-brand/15 text-brand",
    green: "bg-green-500/5 border-green-500/15 text-green-400",
    zinc: "bg-white/[0.03] border-white/[0.08] text-[#c7c7da]",
  }[accent];
  return (
    <div className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 shadow-xl">
      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center mb-3 ${p}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5a5a72] mb-1">{label}</p>
      <p className="text-2xl font-black text-white leading-none">{value}</p>
    </div>
  );
}

function FrequencyPill({ f }: { f: WithdrawalPreferenceRow["frequency"] }) {
  return f === "daily" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-sky-500/10 text-sky-300 border-sky-500/20">
      <CalendarClock className="h-3 w-3" /> Daily
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-brand/10 text-brand border-brand/20">
      <CalendarDays className="h-3 w-3" /> Weekly · Fri
    </span>
  );
}

/**
 * What Garage charges this instruction. Colour tracks the tier so a glance down
 * the list shows who is on the expensive end: green = free, sky = discounted,
 * amber = the full 5%.
 */
function FeePill({ r }: { r: WithdrawalPreferenceRow }) {
  if (r.walletType !== "affiliate") {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white/[0.03] text-[#5a5a72] border-white/[0.08]">
        No fee
      </span>
    );
  }
  const tone =
    r.feePercent === 0
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : r.feePercent <= 2
        ? "bg-sky-500/10 text-sky-300 border-sky-500/20"
        : "bg-amber-500/10 text-amber-300 border-amber-500/20";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tone}`}
      title={`${r.feePercent}% Garage processing fee — ${r.frequency}, ${
        r.feeTier?.meetsKeepThreshold ? `keeps ${fmt(r.keepThresholdCents)}+` : "withdraws everything"
      }`}
    >
      <Percent className="h-3 w-3" />
      {r.feePercent}% fee
    </span>
  );
}

function CopyEmail({ email }: { email: string | null }) {
  const [done, setDone] = useState(false);
  if (!email) return null;
  return (
    <button
      type="button"
      title="Copy email"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          toast.error("Couldn't copy");
        }
      }}
      className="text-[#5a5a72] hover:text-white transition-colors"
    >
      {done ? <CheckIcon className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function WithdrawalPreferencesTab({ headerSearch }: { headerSearch: string }) {
  const [data, setData] = useState<WithdrawalPreferencesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState<(typeof FREQ)[number]>("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setSkip(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const effectiveSearch = debounced || headerSearch;
  const params = useMemo(
    () => ({ frequency, due: dueOnly, search: effectiveSearch || undefined, skip, limit: PAGE_SIZE }),
    [frequency, dueOnly, effectiveSearch, skip],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listWithdrawalPreferences(params)
      .then((r) => alive && setData(r))
      .catch((e) => toast.error(e?.message ?? "Failed to load preferences"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [params]);

  const stats = data?.stats;
  const items = data?.items ?? [];

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <StatCard label="Due now" value={stats ? String(stats.dueNow) : "—"} icon={Wallet} accent="yellow" />
        <StatCard label="Due amount" value={stats ? fmt(stats.dueAmountCents) : "—"} icon={PiggyBank} accent="yellow" />
        <StatCard label="Processing fees" value={stats ? fmt(stats.feeAmountCents) : "—"} icon={Percent} accent="green" />
        <StatCard label="Weekly · next Fri" value={stats ? `${stats.weekly} · ${fmtDay(stats.nextFriday)}` : "—"} icon={CalendarDays} accent="green" />
        <StatCard label="Daily" value={stats ? String(stats.daily) : "—"} icon={CalendarClock} accent="zinc" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5a5a72]" />
          <Input
            placeholder="Search by user name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-[#0d0d11] border-[#2c2c3a] text-white placeholder:text-[#5a5a72] rounded-xl focus-visible:ring-1 focus-visible:ring-brand/40 focus-visible:border-brand/40"
          />
        </div>
        <div className="flex gap-1.5">
          {FREQ.map((f) => (
            <button
              key={f}
              onClick={() => { setFrequency(f); setSkip(0); }}
              className={`h-9 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                frequency === f
                  ? "bg-brand/10 border border-brand/30 text-brand"
                  : "bg-[#0d0d11] border border-[#2c2c3a] text-[#9fa0b8] hover:text-white hover:border-[#363649]"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => { setDueOnly((v) => !v); setSkip(0); }}
            role="switch"
            aria-checked={dueOnly}
            className={`h-9 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
              dueOnly
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-[#0d0d11] border border-[#2c2c3a] text-[#9fa0b8] hover:text-white hover:border-[#363649]"
            }`}
          >
            Due only
          </button>
        </div>
      </div>

      {/* Rows */}
      {loading && !data ? (
        <div className="grid grid-cols-1 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-[#111116] border border-[#2a2a35] rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[#2a2a35] rounded-2xl py-20 flex flex-col items-center gap-3">
          <Users className="h-6 w-6 text-[#5a5a72]" />
          <p className="text-sm font-bold text-[#c7c7da]">
            {dueOnly ? "Nothing due right now" : "No one has set a withdrawal preference yet"}
          </p>
          <p className="text-[11px] text-[#5a5a72]">Users set this on each wallet under Wallet → Withdrawal Preference.</p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-2.5 ${loading ? "opacity-60" : ""}`}>
          {items.map((r) => (
            <div key={r.id} className="bg-gradient-to-b from-[#13131a] to-[#0f0f14] border border-[#2a2a35] rounded-2xl p-4">
              <div className="flex items-center gap-3">
                {r.user.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.user.profilePicture} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0 ring-1 ring-[#2a2a35]" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-brand/5 border border-brand/10 flex items-center justify-center shrink-0 text-sm font-black text-brand">
                    {(r.user.name || r.user.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white truncate">{r.user.name || r.user.email || "User"}</p>
                    <FrequencyPill f={r.frequency} />
                    <FeePill r={r} />
                    {r.dueCents > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-500/10 text-green-400 border-green-500/20">
                        Due {fmtDay(r.nextRunAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5a5a72] truncate mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      {r.user.email}
                      <CopyEmail email={r.user.email} />
                    </span>
                    <span className="text-[#2a2a35]">·</span>
                    <span>
                      {WALLET_LABEL[r.walletType]}
                      {r.org?.name ? ` · ${r.org.name}` : ""}
                    </span>
                    {/* The keep-amount is what buys the lower fee tier, so it is
                        shown on daily as well as weekly — not weekly-only. */}
                    <span className="text-[#2a2a35]">·</span>
                    <span
                      className={`inline-flex items-center gap-1 ${
                        r.feeTier?.meetsKeepThreshold ? "text-green-400/80" : ""
                      }`}
                    >
                      <PiggyBank className="h-3 w-3" />
                      {r.keepAmountCents ? `keeps ${fmt(r.keepAmountCents)}` : "withdraws everything"}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-mono text-base font-black leading-none ${r.dueCents > 0 ? "text-white" : "text-[#5a5a72]"}`}>
                    {fmt(r.dueCents)}
                  </p>
                  <p className="text-[10px] text-[#5a5a72] mt-1 font-mono">
                    due · available {fmt(r.withdrawableCents)}
                  </p>
                  {r.walletType === "affiliate" && r.dueCents > 0 && (
                    <p
                      className="text-[10px] mt-1 font-mono"
                      title="Garage processing fee only. A bank payout also carries the bank's own transfer fee, which is set per withdrawal when the team initiates it."
                    >
                      <span className={r.feeOnDueCents > 0 ? "text-amber-300/80" : "text-green-400/80"}>
                        {r.feeOnDueCents > 0 ? `−${fmt(r.feeOnDueCents)} fee` : "no fee"}
                      </span>
                      <span className="text-[#2a2a35]"> · </span>
                      <span className="text-[#9fa0b8]">net {fmt(r.netOnDueCents)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pager */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-[11px] text-[#5a5a72]">
          <span>
            {data.skip + 1}–{Math.min(data.skip + PAGE_SIZE, data.total)} of {data.total}
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={data.skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
              className="h-8 px-3 rounded-lg border border-[#2c2c3a] text-[#9fa0b8] hover:text-white disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={!data.hasMore}
              onClick={() => setSkip(skip + PAGE_SIZE)}
              className="h-8 px-3 rounded-lg border border-[#2c2c3a] text-[#9fa0b8] hover:text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default WithdrawalPreferencesTab;
