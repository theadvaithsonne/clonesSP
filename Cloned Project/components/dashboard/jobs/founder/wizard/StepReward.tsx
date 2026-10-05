"use client";

// A8 / F6 · Step 5 — Referral reward: amount per hire, guarantee period and
// funding from the founder's GaragePay wallet, with the split the live
// Unilevel Plus plan would pay. "Add funds" opens the existing GaragePay
// top-up sheet; nothing here moves money — publishing does.

import React from "react";
import { AlertTriangle, Info, Lock } from "lucide-react";
import { getOrgId } from "@/lib/auth";
import { TopUpStoreWalletSheet } from "@/components/dashboard/TopUpStoreWalletSheet";
import * as jobsApi from "../../api";
import { Button, Card, Chip, GOLD, SwitchControl, formatMoney, useLoad, errorMessage } from "../../ui";
import type { RewardSplitPreview } from "../../types";
import type { StepProps } from "./JobWizard";
import { StepHeading } from "./StepBasics";
import { JobCardPreview } from "./JobPreviewModal";

const PRESETS = [100, 250, 500, 1000];
const BUCKET_COLORS = ["var(--brand)", "#f59e0b", "#d97706", "#b45309", "#78716c"];

export default function StepReward({ job, detail, update }: StepProps) {
  const reward = job.reward;
  const locked = job.status !== "draft" && (reward.totalHeld || 0) > 0;
  const required = reward.enabled && reward.funding === "hold" ? reward.amount * Math.max(1, job.openings) : 0;
  const balance = useLoad(() => jobsApi.getGaragePayBalance(), []);
  const [topUpOpen, setTopUpOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<RewardSplitPreview | null>(detail.rewardPreview);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [amountText, setAmountText] = React.useState(reward.amount ? String(reward.amount) : "");

  React.useEffect(() => {
    if (!reward.enabled || !(reward.amount > 0)) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      jobsApi
        .getRewardPreview(reward.amount)
        .then((r) => {
          setPreview(r.preview);
          setPreviewError(null);
        })
        .catch((err) => setPreviewError(errorMessage(err, "Couldn't load the commission plan.")));
    }, 300);
    return () => clearTimeout(t);
  }, [reward.enabled, reward.amount]);

  const setAmount = (n: number) => {
    setAmountText(n ? String(n) : "");
    update({ reward: { amount: Math.max(0, Math.min(100000, n)) } });
  };

  const short = balance.data !== null && reward.enabled && reward.funding === "hold" && balance.data < required;
  const orgId = getOrgId() || "";

  return (
    <div className="grid gap-8 px-8 py-6 xl:grid-cols-[minmax(0,48rem)_360px]">
      <div className="min-w-0 max-w-3xl space-y-5">
        <StepHeading
          step={5}
          title="Referral reward"
          subtitle="Reward your network only after a successful hire completes the guarantee period."
          right={
            <label className="flex items-center gap-2 text-sm text-[#c7c7da]">
              Enable referral reward
              <SwitchControl checked={reward.enabled} disabled={locked} onChange={(v) => update({ reward: { enabled: v } })} aria-label="Enable referral reward" />
            </label>
          }
        />

        {locked && (
          <div className="flex items-start gap-3 rounded-xl border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-[#c7c7da]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#7c7d94]" />
            {formatMoney(reward.heldAmount)} is held for this job, so the reward settings are locked. Close the job to release the hold.
          </div>
        )}

        {!reward.enabled ? (
          <Card className="px-5 py-8 text-center text-sm text-[#7c7d94]">
            No referral reward — candidates can still apply, and nobody earns for referring them.
          </Card>
        ) : (
          <>
            <Card className="space-y-5 p-5">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Reward per hire (USD)</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7c7d94]">$</span>
                    <input
                      type="number"
                      min={0}
                      disabled={locked}
                      value={amountText}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        setAmountText(e.target.value);
                        update({ reward: { amount: Math.max(0, Math.min(100000, Number(e.target.value) || 0)) } });
                      }}
                      className="w-40 rounded-xl border border-[#262626] bg-[#1A1A1A] py-2.5 pl-7 pr-3 text-sm text-white outline-none focus:border-brand disabled:opacity-50"
                    />
                  </div>
                  {PRESETS.map((p) => (
                    <Chip key={p} active={reward.amount === p} onClick={locked ? undefined : () => setAmount(p)}>
                      {formatMoney(p)}
                    </Chip>
                  ))}
                </div>
                {reward.amount > 0 && (
                  <p className="mt-3 text-xs text-[#c7c7da]">
                    Openings: {job.openings} → up to <span className="font-semibold text-white">{formatMoney(reward.amount * job.openings)}</span> total
                  </p>
                )}
              </div>
              <div>
                <div className="mb-1 text-sm text-white">Guarantee period</div>
                <p className="mb-2 text-xs text-[#7c7d94]">The reward is cancelled if the hire leaves during this period.</p>
                <div className="flex gap-2">
                  {([30, 60, 90] as const).map((d) => (
                    <Chip key={d} active={reward.guaranteeDays === d} onClick={locked ? undefined : () => update({ reward: { guaranteeDays: d } })}>
                      {d} days
                    </Chip>
                  ))}
                </div>
              </div>
            </Card>

            <div>
              <div className="mb-1 text-sm font-semibold text-white">Funding</div>
              <p className="mb-3 text-xs text-[#7c7d94]">Choose when the reward is reserved from your GaragePay wallet.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: "hold" as const,
                      title: "Hold now from GaragePay",
                      badge: "Recommended",
                      sub:
                        balance.data !== null
                          ? `${formatMoney(required)} held from your balance of ${formatMoney(balance.data)} · released per hire`
                          : "Reserved when you publish · released per hire",
                    },
                    { value: "on_hire" as const, title: "Pay on hire", sub: "Charge your GaragePay wallet when each guarantee completes." },
                  ]
                ).map((o) => {
                  const active = reward.funding === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      disabled={locked}
                      onClick={() => update({ reward: { funding: o.value } })}
                      className="rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed"
                      style={
                        active
                          ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 8%, transparent)" }
                          : { borderColor: "#262626", background: "#141414" }
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: active ? GOLD : "#3A3A3A" }}>
                          {active && <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} />}
                        </span>
                        <span className="text-sm font-medium text-white">{o.title}</span>
                        {o.badge && (
                          <span className="rounded-md border px-1.5 py-0.5 text-[10px]" style={{ borderColor: GOLD, color: GOLD }}>
                            {o.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-[#7c7d94]">{o.sub}</p>
                    </button>
                  );
                })}
              </div>
              {short && !locked && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#f87171]/40 bg-[#f87171]/5 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-[#f87171]" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="text-white">
                      Your balance ({formatMoney(balance.data || 0)}) is below {formatMoney(required)}
                    </div>
                    <div className="text-xs text-[#c7c7da]">
                      Add funds to keep &quot;Hold now&quot;, or switch to &quot;Pay on hire&quot; to publish without reserving funds.
                    </div>
                  </div>
                  <Button variant="destructive" onClick={() => setTopUpOpen(true)}>
                    Add funds
                  </Button>
                  <Button variant="secondary" onClick={() => update({ reward: { funding: "on_hire" } })}>
                    Switch to Pay on hire
                  </Button>
                </div>
              )}
            </div>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">How your {formatMoney(reward.amount || 0)} is paid out</div>
                <div className="text-sm font-semibold" style={{ color: GOLD }}>
                  Total {formatMoney(reward.amount || 0)}
                </div>
              </div>
              {previewError ? (
                <p className="text-sm text-[#f87171]">{previewError}</p>
              ) : preview && reward.amount > 0 ? (
                <>
                  <div className="flex h-2 overflow-hidden rounded-full bg-[#1f1f28]">
                    {preview.buckets.map((b, i) => (
                      <span key={b.key} style={{ width: `${b.percentage}%`, background: BUCKET_COLORS[i % BUCKET_COLORS.length] }} title={`${b.label} · ${b.percentage}%`} />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                    {preview.buckets.map((b, i) => (
                      <div key={b.key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[#c7c7da]">
                          <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLORS[i % BUCKET_COLORS.length] }} />
                          {b.label} · {b.percentage}%
                        </span>
                        <span className="tabular-nums text-white">up to {formatMoney(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[#7c7d94]">
                    Paid through the Unilevel Plus commission plan — the same structure as your other products — after the guarantee
                    period ends. No platform fee: any part of the split nobody qualifies for comes back to your wallet.
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#7c7d94]">Set a reward amount to see the split.</p>
              )}
            </Card>
          </>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Live job-card preview</h3>
          <span className="text-xs text-[#22c55e]">Updates live</span>
        </div>
        <JobCardPreview job={job} org={detail.org} earn={reward.enabled ? preview?.directAmount : null} />
        <Card className="p-4">
          <div className="text-sm font-medium text-white">Attribution rules</div>
          <p className="mt-1 text-xs leading-5 text-[#7c7d94]">
            A candidate is credited to the affiliate whose link they applied through. Garage&apos;s usual referral rules apply: an
            existing referrer is kept, and self-referrals don&apos;t count.
          </p>
        </Card>
        <div className="flex items-start gap-3 rounded-xl border border-[#1e3a5f] bg-[#0f1b2d] px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#60a5fa]" />
          <div>
            <div className="text-sm text-white">Referral eligibility</div>
            <div className="text-xs text-[#93c5fd]">Candidates who apply without a referral link don&apos;t trigger a reward.</div>
          </div>
        </div>
      </aside>

      <TopUpStoreWalletSheet
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        orgs={[{ orgId, orgName: detail.org.name, currentBalance: balance.data ?? undefined }]}
        defaultOrgId={orgId}
        onSuccess={() => balance.reload(true)}
      />
    </div>
  );
}
