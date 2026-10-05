"use client";

// Per-person detail for the Rank Bonus admin page.
//
// Answers the questions support actually gets: who referred me, why am I not
// Bronze, which of my directs are inactive, what would promote me, and what
// have I been paid. Everything comes from one call to
// GET /garage-admin/rank-bonus/people/:userId.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { garageAdminApi } from "@/lib/api";
import {
  X,
  ArrowUpRight,
  Users,
  GitBranch,
  History,
  Target,
  Check,
  Minus,
  ChevronLeft,
} from "lucide-react";
import { RankBadge, ActivePill, SubReasonPill, PayoutStatusPill } from "./RankBadge";

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  affiliateId: string | null;
  joinedAt: string | null;
  active: boolean;
  rank: string | null;
  rankPeriodKey: string | null;
  directsCount: number;
  downlineCount: number;
};

type Detail = {
  user: Person;
  referrer: Person | null;
  subscription: {
    active: boolean;
    reason: string;
    currentPeriodEnd: string | null;
    termMonths: number | null;
    paidCycles: number;
  };
  directs: Person[];
  activeDirects: number;
  legs: Array<{ legHead: Person; topRank: string | null; size: number }>;
  history: Array<{
    periodKey: string;
    rank: string;
    bonusUsd: number;
    payoutStatus: string;
    routedToPlatform: boolean;
    paidAt: string | null;
  }>;
  nextRank: {
    target: string;
    requirement: string;
    have: number;
    need: number;
  } | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

const money = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function Avatar({ p, size = 32 }: { p: Person; size?: number }) {
  const initial = (p.name || p.email || "?").charAt(0).toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] font-semibold text-black"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initial}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  right,
  children,
}: {
  icon: any;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/[0.06] px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-zinc-600" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function PersonRow({
  p,
  onOpen,
  trailing,
}: {
  p: Person;
  onOpen?: (id: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(p.id)}
      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]"
    >
      <Avatar p={p} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-zinc-200 group-hover:text-white">
          {p.name || "—"}
        </div>
        <div className="truncate text-[11px] text-zinc-500">{p.email || "—"}</div>
      </div>
      {trailing ?? (
        <>
          <ActivePill active={p.active} />
          <RankBadge rank={p.rank} />
        </>
      )}
      {onOpen && (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition group-hover:text-zinc-300" />
      )}
    </button>
  );
}

export function RankPersonDrawer({
  userId,
  onClose,
  onNavigate,
}: {
  userId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Walking the tree from inside the drawer should be undoable.
  const [trail, setTrail] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!userId) {
      setTrail([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    garageAdminApi<Detail>(`/garage-admin/rank-bonus/people/${userId}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [userId, onClose]);

  function go(id: string) {
    if (userId) setTrail((t) => [...t, userId]);
    onNavigate(id);
  }

  function back() {
    const prev = trail[trail.length - 1];
    if (!prev) return;
    setTrail((t) => t.slice(0, -1));
    onNavigate(prev);
  }

  if (!mounted) return null;

  const body = (
    <AnimatePresence>
      {userId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-full w-full max-w-[600px] flex-col overflow-y-auto border-l border-white/[0.08] bg-[#0e0e12] shadow-2xl"
          >
            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0e0e12]/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {trail.length > 0 && (
                    <button
                      onClick={back}
                      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  {data ? (
                    <>
                      <Avatar p={data.user} size={40} />
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold text-white">
                          {data.user.name || "—"}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {data.user.email || "—"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-[15px] font-semibold text-white">Member</div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {loading && (
              <div className="flex-1 space-y-3 p-5">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-white/[0.04]"
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="m-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
                {error}
              </div>
            )}

            {data && !loading && (
              <>
                {/* Standing */}
                <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
                  {[
                    {
                      label: "Rank",
                      value: <RankBadge rank={data.user.rank} size="md" />,
                      sub: data.user.rankPeriodKey || "not yet run",
                    },
                    {
                      label: "Active directs",
                      value: (
                        <span className="text-lg font-semibold tabular-nums text-white">
                          {data.activeDirects}
                          <span className="text-sm text-zinc-600">
                            /{data.user.directsCount}
                          </span>
                        </span>
                      ),
                      sub: "with a paid sub",
                    },
                    {
                      label: "Downline",
                      value: (
                        <span className="text-lg font-semibold tabular-nums text-white">
                          {data.user.downlineCount.toLocaleString()}
                        </span>
                      ),
                      sub: "all levels",
                    },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#0e0e12] px-4 py-3.5">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                        {s.label}
                      </div>
                      <div className="mt-1.5">{s.value}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Subscription */}
                <Section
                  icon={Check}
                  title="Subscription"
                  right={<SubReasonPill reason={data.subscription.reason} />}
                >
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
                    {[
                      ["Covered until", fmtDate(data.subscription.currentPeriodEnd)],
                      ["Paid cycles", String(data.subscription.paidCycles)],
                      [
                        "Term",
                        data.subscription.termMonths
                          ? `${data.subscription.termMonths} month${
                              data.subscription.termMonths > 1 ? "s" : ""
                            }`
                          : "—",
                      ],
                      ["Joined", fmtDate(data.user.joinedAt)],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between gap-3 border-b border-white/[0.04] pb-1.5"
                      >
                        <dt className="shrink-0 text-zinc-600">{k}</dt>
                        <dd className="truncate text-right text-zinc-300">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {data.user.affiliateId && (
                    <div className="mt-3 flex items-center gap-2 text-[11px]">
                      <span className="text-zinc-600">Affiliate ID</span>
                      <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-zinc-400">
                        {data.user.affiliateId}
                      </code>
                    </div>
                  )}
                </Section>

                {/* Next rank */}
                {data.nextRank && (
                  <Section icon={Target} title={`Path to ${data.nextRank.target}`}>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] text-zinc-300">
                          {data.nextRank.requirement}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
                          {data.nextRank.have}
                          <span className="text-zinc-600">/{data.nextRank.need}</span>
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FFC200] to-[#FFA800] transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (data.nextRank.have / Math.max(1, data.nextRank.need)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2.5 text-[11px] text-zinc-600">
                        {data.subscription.active
                          ? `${Math.max(
                              0,
                              data.nextRank.need - data.nextRank.have
                            )} more to go.`
                          : "Their own subscription is inactive — nothing pays out until it's current, whatever the downline does."}
                      </p>
                    </div>
                  </Section>
                )}

                {/* Referrer */}
                <Section icon={ArrowUpRight} title="Referred by">
                  {data.referrer ? (
                    <PersonRow p={data.referrer} onOpen={go} />
                  ) : (
                    <p className="px-2 text-[13px] text-zinc-600">
                      No referrer — this is a root of the tree.
                    </p>
                  )}
                </Section>

                {/* Legs */}
                {data.legs.length > 0 && (
                  <Section
                    icon={GitBranch}
                    title="Legs"
                    right={
                      <span className="text-[11px] text-zinc-600">
                        top rank in each branch
                      </span>
                    }
                  >
                    <div className="space-y-1">
                      {data.legs.map((l) => (
                        <div
                          key={l.legHead.id}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]"
                        >
                          <button
                            type="button"
                            onClick={() => go(l.legHead.id)}
                            className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <Avatar p={l.legHead} />
                            <div className="min-w-0">
                              <div className="truncate text-[13px] text-zinc-200 group-hover:text-white">
                                {l.legHead.name || l.legHead.email || "—"}
                              </div>
                              <div className="text-[11px] text-zinc-600">
                                {l.size.toLocaleString()} in this leg
                              </div>
                            </div>
                          </button>
                          <RankBadge rank={l.topRank} />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Directs */}
                <Section
                  icon={Users}
                  title="Direct referrals"
                  right={
                    <span className="text-[11px] tabular-nums text-zinc-600">
                      {data.activeDirects} of {data.directs.length} active
                    </span>
                  }
                >
                  {data.directs.length ? (
                    <div className="space-y-0.5">
                      {data.directs.map((d) => (
                        <PersonRow
                          key={d.id}
                          p={d}
                          onOpen={go}
                          trailing={
                            <>
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                  d.active
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-white/[0.04] text-zinc-600"
                                }`}
                                title={
                                  d.active
                                    ? "Counts toward Bronze"
                                    : "Inactive — does not count"
                                }
                              >
                                {d.active ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                              </span>
                              <RankBadge rank={d.rank} />
                            </>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 text-[13px] text-zinc-600">
                      No direct referrals yet.
                    </p>
                  )}
                </Section>

                {/* History */}
                <Section
                  icon={History}
                  title="Bonus history"
                  right={
                    data.history.length ? (
                      <span className="text-[11px] tabular-nums text-zinc-600">
                        {money(
                          data.history
                            .filter((h) => h.payoutStatus === "paid")
                            .reduce((s, h) => s + h.bonusUsd, 0)
                        )}{" "}
                        paid to date
                      </span>
                    ) : undefined
                  }
                >
                  {data.history.length ? (
                    <div className="space-y-1">
                      {data.history.map((h) => (
                        <div
                          key={h.periodKey}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]"
                        >
                          <span className="w-16 shrink-0 font-mono text-[11px] text-zinc-500">
                            {h.periodKey}
                          </span>
                          <RankBadge rank={h.rank} />
                          <span className="flex-1 text-right text-[13px] font-medium tabular-nums text-zinc-200">
                            {money(h.bonusUsd)}
                          </span>
                          <PayoutStatusPill status={h.payoutStatus} />
                          {h.routedToPlatform && (
                            <span
                              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 ring-1 ring-inset ring-amber-500/25"
                              title="No active Unilevel Plus licence, so the money went to the platform"
                            >
                              Platform
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 text-[13px] text-zinc-600">
                      No bonus periods yet.
                    </p>
                  )}
                </Section>

                <div className="h-6" />
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}
