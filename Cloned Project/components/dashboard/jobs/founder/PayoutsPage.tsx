"use client";

// A15 · Referral payouts — rewards held for open roles, hires inside their
// guarantee period, rewards paid through the Unilevel Plus plan and rewards
// cancelled because a hire left early. Each reward opens a drawer with the
// split it was (or will be) paid out with.

import React from "react";
import { Download, ExternalLink, Info, UserRound, UserX, Wallet } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../api";
import { useJobsNav } from "../nav";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  GOLD,
  Modal,
  PageHeader,
  RowMenu,
  SkeletonRows,
  StatTile,
  StatusPill,
  TextArea,
  UnderlineTabs,
  formatDate,
  formatMoney,
  useLoad,
} from "../ui";
import type { PayoutDetailResponse, PayoutRow, PayoutsResponse, RewardStatus } from "../types";

type Tab = "all" | "in_guarantee" | "paid" | "refunded" | "held";

const STATUS_STYLE: Record<RewardStatus, { label: string; fg: string; bg: string }> = {
  in_guarantee: { label: "In guarantee", fg: "#93c5fd", bg: "rgba(96,165,250,0.12)" },
  processing: { label: "Paying out", fg: "#93c5fd", bg: "rgba(96,165,250,0.12)" },
  paid: { label: "Paid", fg: "#4ade80", bg: "rgba(34,197,94,0.12)" },
  payment_due: { label: "Payment due", fg: "#fbbf24", bg: "rgba(245,158,11,0.12)" },
  failed: { label: "Failed", fg: "#f87171", bg: "rgba(248,113,113,0.12)" },
  cancelled: { label: "Refunded", fg: "#a1a1aa", bg: "rgba(161,161,170,0.12)" },
  refund_due: { label: "Refund due", fg: "#f87171", bg: "rgba(248,113,113,0.12)" },
};

function statusLabel(status: RewardStatus, funding: "hold" | "on_hire") {
  // A cancelled "on hire" reward was never charged, so nothing was refunded.
  if (status === "cancelled" && funding === "on_hire") return "Cancelled";
  return STATUS_STYLE[status]?.label || status;
}

function RewardStatusPill({ status, funding }: { status: RewardStatus; funding: "hold" | "on_hire" }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.in_guarantee;
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ color: s.fg, background: s.bg }}>
      {statusLabel(status, funding)}
    </span>
  );
}

const DRAWER_EYEBROW: Record<RewardStatus, string> = {
  in_guarantee: "Reward in guarantee",
  processing: "Reward paying out",
  paid: "Paid reward",
  payment_due: "Payment due",
  failed: "Payout failed",
  cancelled: "Cancelled reward",
  refund_due: "Refund due",
};

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LEFT_EARLY_STATUSES: RewardStatus[] = ["in_guarantee", "payment_due", "failed", "paid"];

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export default function PayoutsPage() {
  const nav = useJobsNav();
  const [tab, setTab] = React.useState<Tab>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [leaving, setLeaving] = React.useState<PayoutRow | null>(null);
  const { data, loading, error, reload } = useLoad(() => jobsApi.getPayouts(tab), [tab]);

  const exportCsv = () => {
    if (!data) return;
    const day = new Date().toISOString().slice(0, 10);
    if (tab === "held") {
      downloadCsv(
        `reward-holds-${day}.csv`,
        ["Job", "Status", "Reward per hire (USD)", "Openings", "Held (USD)"],
        data.holds.map((h) => [h.title, h.status, h.rewardAmount, h.openings, h.heldAmount])
      );
      return;
    }
    downloadCsv(
      `referral-payouts-${day}.csv`,
      [
        "Hire",
        "Job",
        "Referred by",
        "Affiliate ID",
        "Reward (USD)",
        "Funding",
        "Joined",
        "Guarantee ends",
        "Status",
        "Paid on",
        "Paid to network (USD)",
        "Returned to you (USD)",
      ],
      data.rewards.map((r) => [
        r.hire.name,
        r.job.title,
        r.referrer.name,
        r.referrer.affiliateId || "",
        r.amount,
        r.funding === "hold" ? "Held at publish" : "Charged on payout",
        r.joinedAt ? new Date(r.joinedAt).toISOString().slice(0, 10) : "",
        r.guaranteeEndsAt ? new Date(r.guaranteeEndsAt).toISOString().slice(0, 10) : "",
        statusLabel(r.status, r.funding),
        r.paidAt ? new Date(r.paidAt).toISOString().slice(0, 10) : "",
        r.paidAmount ?? "",
        r.returnedAmount ?? "",
      ])
    );
  };

  const rowsEmpty = data ? (tab === "held" ? !data.holds.length : !data.rewards.length) : false;

  return (
    <>
      <PageHeader
        title="Referral payouts"
        subtitle="Track held rewards, guarantee periods, payouts, and refunds."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!data || rowsEmpty}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      >
        <UnderlineTabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "all", label: "All" },
            { value: "in_guarantee", label: "In guarantee", count: data?.metrics.inGuarantee.count },
            { value: "paid", label: "Paid", count: data?.metrics.paid.count },
            { value: "refunded", label: "Refunded", count: data?.metrics.refunded.count },
            { value: "held", label: "Held", count: data?.metrics.held.jobs },
          ]}
        />
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading && !data ? (
          <SkeletonRows />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : data ? (
          <div className="space-y-5">
            <Metrics metrics={data.metrics} />
            {tab === "held" ? (
              <HoldsTable holds={data.holds} onOpen={(jobId) => nav.openJob(jobId)} />
            ) : data.rewards.length === 0 ? (
              tab === "all" ? (
                <EmptyState
                  icon={<Wallet className="h-10 w-10" />}
                  title="No referral rewards yet"
                  description="A reward appears here when a candidate who applied through someone's referral link is hired. It's paid out after the job's guarantee period."
                />
              ) : (
                <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">Nothing here yet.</Card>
              )
            ) : (
              <RewardsTable
                rows={data.rewards}
                onOpen={(r) => setOpenId(r._id)}
                onViewHire={(r) => nav.openJob(r.job._id, "pipeline", r.hire.applicationId)}
                onLeftEarly={setLeaving}
              />
            )}
            <p className="flex items-center gap-2 text-xs text-[#61627a]">
              <Info className="h-3.5 w-3.5" />
              Rewards are paid through the Unilevel Plus commission plan after each guarantee period.
            </p>
          </div>
        ) : null}
      </div>

      <PayoutDrawer rewardId={openId} onClose={() => setOpenId(null)} onGaragePay={() => nav.go("GaragePay")} />
      <LeftEarlyModal
        row={leaving}
        onClose={() => setLeaving(null)}
        onDone={() => {
          setLeaving(null);
          reload(true);
        }}
      />
    </>
  );
}

function Metrics({ metrics }: { metrics: PayoutsResponse["metrics"] }) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Held for open jobs"
        value={formatMoney(metrics.held.amount)}
        sub={`Reserved across ${plural(metrics.held.jobs, "role")}`}
        accent
      />
      <StatTile
        label="In guarantee"
        value={formatMoney(metrics.inGuarantee.amount)}
        sub={`${plural(metrics.inGuarantee.count, "hire")} in guarantee`}
      />
      <StatTile
        label="Paid out all time"
        value={formatMoney(metrics.paid.amount)}
        sub={`Across ${plural(metrics.paid.count, "hire")}`}
      />
      <StatTile
        label="Refunded"
        value={formatMoney(metrics.refunded.amount)}
        sub={`${plural(metrics.refunded.count, "hire")} left early`}
      />
    </div>
  );
}

const REWARD_COLS = "grid-cols-[1.2fr_1.2fr_1.1fr_90px_100px_110px_140px_36px]";

function RewardsTable({
  rows,
  onOpen,
  onViewHire,
  onLeftEarly,
}: {
  rows: PayoutRow[];
  onOpen: (r: PayoutRow) => void;
  onViewHire: (r: PayoutRow) => void;
  onLeftEarly: (r: PayoutRow) => void;
}) {
  return (
    <Card className="overflow-visible">
      <div className={`grid ${REWARD_COLS} gap-4 border-b border-[#1f1f24] px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]`}>
        <span>Hire</span>
        <span>Job</span>
        <span>Referred by</span>
        <span>Reward</span>
        <span>Joined</span>
        <span>Guarantee ends</span>
        <span>Status</span>
        <span />
      </div>
      {rows.map((r) => {
        const canLeave = LEFT_EARLY_STATUSES.includes(r.status);
        return (
          <div
            key={r._id}
            onClick={() => onOpen(r)}
            className={`grid ${REWARD_COLS} cursor-pointer items-center gap-4 border-t border-[#1f1f24] px-5 py-3.5 transition-colors first:border-t-0 hover:bg-white/[0.02]`}
          >
            <div className="min-w-0 truncate text-sm font-medium text-white">{r.hire.name}</div>
            <div className="min-w-0 truncate text-sm text-[#c7c7da]">{r.job.title}</div>
            <div className="min-w-0">
              <div className="truncate text-sm text-[#c7c7da]">{r.referrer.name}</div>
              {r.referrer.affiliateId && <div className="truncate text-[11px] text-[#61627a]">{r.referrer.affiliateId}</div>}
            </div>
            <div className="text-sm font-medium" style={{ color: GOLD }}>
              {formatMoney(r.amount)}
            </div>
            <div className="text-sm text-[#c7c7da]">{formatDate(r.joinedAt)}</div>
            <div className="text-sm text-[#c7c7da]">{formatDate(r.guaranteeEndsAt)}</div>
            <div className="min-w-0" title={r.lastError || undefined}>
              <RewardStatusPill status={r.status} funding={r.funding} />
              {r.status === "in_guarantee" ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 w-20 overflow-hidden rounded-full bg-[#1f1f28]">
                    <div className="h-full rounded-full bg-[#60a5fa]" style={{ width: `${r.progress}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-[#61627a]">{r.progress}%</span>
                </div>
              ) : r.status === "paid" && r.paidAt ? (
                <div className="mt-1 text-[11px] text-[#61627a]">Paid {formatDate(r.paidAt, { year: undefined })}</div>
              ) : (r.status === "payment_due" || r.status === "failed") && r.lastError ? (
                <div className="mt-1 truncate text-[11px] text-[#61627a]">{r.lastError}</div>
              ) : r.status === "refund_due" ? (
                <div className="mt-1 text-[11px] text-[#61627a]">From the referrer</div>
              ) : null}
            </div>
            <RowMenu
              items={[
                { label: "View hire", icon: <UserRound className="h-4 w-4" />, onClick: () => onViewHire(r) },
                {
                  label: "Mark as left early",
                  icon: <UserX className="h-4 w-4" />,
                  danger: true,
                  disabled: !canLeave,
                  hint: r.status === "refund_due" ? "Already flagged for a refund." : "This reward is already closed.",
                  onClick: () => onLeftEarly(r),
                },
              ]}
            />
          </div>
        );
      })}
    </Card>
  );
}

const HOLD_COLS = "grid-cols-[1.8fr_140px_100px_120px_100px]";

function HoldsTable({ holds, onOpen }: { holds: PayoutsResponse["holds"]; onOpen: (jobId: string) => void }) {
  if (!holds.length) {
    return (
      <Card className="px-5 py-10 text-center text-sm text-[#7c7d94]">
        Nothing is held right now. Jobs published with “Hold now from GaragePay” reserve their rewards here until hires complete their guarantee.
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className={`grid ${HOLD_COLS} gap-4 border-b border-[#1f1f24] px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-[#7c7d94]`}>
        <span>Job</span>
        <span>Reward per hire</span>
        <span>Openings</span>
        <span>Held</span>
        <span>Status</span>
      </div>
      {holds.map((h) => (
        <div
          key={h.jobId}
          onClick={() => onOpen(h.jobId)}
          className={`grid ${HOLD_COLS} cursor-pointer items-center gap-4 border-t border-[#1f1f24] px-5 py-3.5 transition-colors first:border-t-0 hover:bg-white/[0.02]`}
        >
          <div className="min-w-0 truncate text-sm font-medium text-white">{h.title || "Untitled job"}</div>
          <div className="text-sm text-[#c7c7da]">{formatMoney(h.rewardAmount)}</div>
          <div className="text-sm text-[#c7c7da]">{h.openings}</div>
          <div className="text-sm font-medium" style={{ color: GOLD }}>
            {formatMoney(h.heldAmount)}
          </div>
          <div>
            <StatusPill status={h.status} />
          </div>
        </div>
      ))}
    </Card>
  );
}

const SPLIT_COLORS: Record<string, string> = {
  direct: "var(--brand)",
  level: "#60a5fa",
  infinity1: "#a78bfa",
  infinity2: "#f59e0b",
  pool: "#22c55e",
  returned: "#3f3f46",
};

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-[#7c7d94]">{label}</span>
      <span className="text-right text-white">{children}</span>
    </div>
  );
}

function SplitLine({
  color,
  title,
  sub,
  amount,
}: {
  color: string;
  title: string;
  sub?: string;
  amount: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{title}</div>
        {sub && <div className="text-xs text-[#7c7d94]">{sub}</div>}
      </div>
      <span className="text-sm tabular-nums text-white">{formatMoney(amount)}</span>
    </div>
  );
}

function SplitBar({ parts }: { parts: Array<{ key: string; amount: number }> }) {
  const total = parts.reduce((s, p) => s + p.amount, 0);
  if (!total) return null;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[#1f1f28]">
      {parts
        .filter((p) => p.amount > 0)
        .map((p) => (
          <span key={p.key} style={{ width: `${(p.amount / total) * 100}%`, background: SPLIT_COLORS[p.key] || "#71717a" }} />
        ))}
    </div>
  );
}

function PayoutDrawer({
  rewardId,
  onClose,
  onGaragePay,
}: {
  rewardId: string | null;
  onClose: () => void;
  onGaragePay: () => void;
}) {
  const [data, setData] = React.useState<PayoutDetailResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!rewardId) return;
    let cancelled = false;
    setData(null);
    setError(null);
    jobsApi
      .getPayout(rewardId)
      .then((d) => !cancelled && setData(d))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err, "Couldn't load this reward.")));
    return () => {
      cancelled = true;
    };
  }, [rewardId]);

  const reward = data?.reward;
  const split = data?.split;
  const preview = data?.preview;

  return (
    <Drawer
      open={!!rewardId}
      onClose={onClose}
      width={480}
      title={
        reward ? (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
              {DRAWER_EYEBROW[reward.status] || "Referral reward"}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {reward.hire.name} · {formatMoney(reward.amount)}
            </div>
          </div>
        ) : (
          "Referral reward"
        )
      }
      footer={
        <Button className="w-full" onClick={onGaragePay}>
          <ExternalLink className="h-4 w-4" /> View in GaragePay
        </Button>
      }
    >
      {error ? (
        <div className="p-6">
          <ErrorState message={error} />
        </div>
      ) : !reward ? (
        <div className="p-6">
          <SkeletonRows rows={4} />
        </div>
      ) : (
        <div className="space-y-5 px-6 py-5">
          <Card className="px-4 py-2">
            <SummaryRow label="Job">{reward.job.title}</SummaryRow>
            <SummaryRow label="Referred by">
              {reward.referrer?.name || "Affiliate"}
              {reward.referrer?.affiliateId && <span className="block text-[11px] text-[#61627a]">{reward.referrer.affiliateId}</span>}
            </SummaryRow>
            <SummaryRow label="Joined">{formatDate(reward.joinedAt)}</SummaryRow>
            {reward.status === "paid" && reward.paidAt ? (
              <SummaryRow label="Paid on">{formatDate(reward.paidAt)}</SummaryRow>
            ) : (
              <SummaryRow label="Guarantee ends">
                {formatDate(reward.guaranteeEndsAt)} · {reward.guaranteeDays} days
              </SummaryRow>
            )}
            <SummaryRow label="Funding">{reward.funding === "hold" ? "Held from GaragePay at publish" : "Charged when the guarantee ends"}</SummaryRow>
            <SummaryRow label="Status">
              <RewardStatusPill status={reward.status} funding={reward.funding} />
            </SummaryRow>
          </Card>

          {reward.lastError && (reward.status === "payment_due" || reward.status === "failed") && (
            <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/5 px-4 py-3 text-xs text-[#f87171]">{reward.lastError}</div>
          )}
          {reward.cancelReason && (
            <div className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 text-xs text-[#c7c7da]">
              <span className="text-[#7c7d94]">Reason: </span>
              {reward.cancelReason}
            </div>
          )}

          {split ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Payout split</h3>
                {reward.status === "paid" && (
                  <span className="rounded-md bg-[#22c55e]/15 px-2 py-0.5 text-[11px] font-medium text-[#4ade80]">Settled</span>
                )}
              </div>
              <SplitBar
                parts={[
                  { key: "direct", amount: split.direct?.amount || 0 },
                  { key: "level", amount: split.level.amount },
                  { key: "infinity1", amount: split.infinity1.amount },
                  { key: "infinity2", amount: split.infinity2.amount },
                  { key: "returned", amount: reward.returnedAmount || 0 },
                ]}
              />
              <div className="mt-2 divide-y divide-[#1f1f24]">
                <SplitLine
                  color={SPLIT_COLORS.direct}
                  title={`Direct · ${split.directRecipient?.name || "Referring affiliate"}`}
                  sub={split.direct ? undefined : "No direct referrer qualified"}
                  amount={split.direct?.amount || 0}
                />
                <SplitLine
                  color={SPLIT_COLORS.level}
                  title="Level bonus"
                  sub={`${split.level.recipients} affiliate${split.level.recipients === 1 ? "" : "s"}`}
                  amount={split.level.amount}
                />
                <SplitLine
                  color={SPLIT_COLORS.infinity1}
                  title="Infinity Tier 1"
                  sub={`${split.infinity1.recipients} recipient${split.infinity1.recipients === 1 ? "" : "s"}`}
                  amount={split.infinity1.amount}
                />
                <SplitLine
                  color={SPLIT_COLORS.infinity2}
                  title="Infinity Tier 2"
                  sub={`${split.infinity2.recipients} recipient${split.infinity2.recipients === 1 ? "" : "s"}`}
                  amount={split.infinity2.amount}
                />
                <SplitLine
                  color={SPLIT_COLORS.returned}
                  title="Returned to you"
                  sub="Parts of the split no one qualified for"
                  amount={reward.returnedAmount || 0}
                />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#262626] pt-3">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-base font-semibold" style={{ color: GOLD }}>
                  {formatMoney(reward.amount)}
                </span>
              </div>
            </div>
          ) : preview ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-white">How it will be split</h3>
              <p className="mb-3 text-xs text-[#7c7d94]">
                Actual amounts depend on who qualifies in the referrer&apos;s network when the guarantee ends. Anything no one earns returns to you.
              </p>
              <SplitBar parts={preview.buckets.map((b) => ({ key: b.key, amount: b.amount }))} />
              <div className="mt-2 divide-y divide-[#1f1f24]">
                {preview.buckets.map((b) => (
                  <SplitLine key={b.key} color={SPLIT_COLORS[b.key] || "#71717a"} title={b.label} sub={`${b.percentage}% of reward`} amount={b.amount} />
                ))}
              </div>
              {preview.returnedPercentage > 0 && (
                <p className="mt-2 text-xs text-[#61627a]">The remaining {preview.returnedPercentage}% is never paid out and stays with you.</p>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-[#262626] pt-3">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="text-base font-semibold" style={{ color: GOLD }}>
                  {formatMoney(reward.amount)}
                </span>
              </div>
            </div>
          ) : null}

          {reward.status !== "paid" && reward.status !== "cancelled" && reward.status !== "refund_due" && (
            <p className="flex items-start gap-2 text-xs text-[#61627a]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Rewards stay held in GaragePay until the guarantee period ends, then pay out automatically.
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function LeftEarlyModal({ row, onClose, onDone }: { row: PayoutRow | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setReason(""), [row]);
  const paid = row?.status === "paid";
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title="Mark as left early?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              if (!row) return;
              setBusy(true);
              try {
                const res = await jobsApi.markLeftEarly(row._id, reason.trim() || undefined);
                toast.success(
                  res.reward.status === "refund_due"
                    ? "Flagged as a refund due from the referrer"
                    : row.funding === "hold"
                      ? "Reward cancelled — the held amount is back in your GaragePay wallet"
                      : "Reward cancelled"
                );
                onDone();
              } catch (err: unknown) {
                toast.error(errorMessage(err, "Couldn't update this reward."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Mark as left early
          </Button>
        </>
      }
    >
      <p className="text-sm leading-6 text-zinc-400">
        <span className="text-white">{row?.hire.name}</span> left {row?.job.title}.{" "}
        {paid
          ? `The ${row ? formatMoney(row.amount) : ""} reward was already paid out, so it will be flagged as a refund due from the referrer. Recovering it is handled manually.`
          : row?.funding === "hold"
            ? `The ${row ? formatMoney(row.amount) : ""} reward is cancelled and the amount held for it goes back to your GaragePay wallet.`
            : "The reward is cancelled. Nothing was charged for it yet."}
      </p>
      <TextArea label="Reason (optional)" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Resigned during probation" />
    </Modal>
  );
}
