"use client";

// A1 · Jobs overview — live KPIs, the hiring funnel, where applicants come
// from, what needs attention, and the live roles.

import React from "react";
import { AlertCircle, CalendarClock, ChevronRight, Plus, Briefcase } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import * as jobsApi from "../api";
import { CATEGORY_META, JOB_PAGES, SOURCE_COLORS, SOURCE_LABELS, WORKPLACE_LABELS } from "../constants";
import { useJobsNav, useJobsNavStore } from "../nav";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterMenu,
  GOLD,
  LoadingBlock,
  PageHeader,
  RewardBadge,
  StatTile,
  StatusPill,
  formatDate,
  formatMoney,
  useLoad,
} from "../ui";
import type { OverviewResponse, PostingRow } from "../types";

export default function OverviewPage() {
  const nav = useJobsNav();
  const setNav = useJobsNavStore((s) => s.set);
  const [jobFilter, setJobFilter] = React.useState("");
  const { data, loading, error, reload } = useLoad(() => jobsApi.getOverview(jobFilter || undefined), [jobFilter]);

  const openApplications = (preset: { view?: string; stage?: string }) => {
    setNav({ applicationsPreset: preset });
    nav.go(JOB_PAGES.applications);
  };

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Post roles, run hiring, and let your network fill them."
        actions={
          <Button onClick={() => nav.openWizard(null)}>
            <Plus className="h-4 w-4" /> Post a job
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload()} />
        ) : data ? (
          <OverviewBody
            data={data}
            jobFilter={jobFilter}
            setJobFilter={setJobFilter}
            onPost={() => nav.openWizard(null)}
            onOpenJob={(id) => nav.openJob(id)}
            onApplications={openApplications}
            onPayouts={() => nav.go(JOB_PAGES.payouts)}
            onPostings={() => nav.go(JOB_PAGES.postings)}
          />
        ) : null}
      </div>
    </>
  );
}

function OverviewBody({
  data,
  jobFilter,
  setJobFilter,
  onPost,
  onOpenJob,
  onApplications,
  onPayouts,
  onPostings,
}: {
  data: OverviewResponse;
  jobFilter: string;
  setJobFilter: (v: string) => void;
  onPost: () => void;
  onOpenJob: (id: string) => void;
  onApplications: (preset: { view?: string; stage?: string }) => void;
  onPayouts: () => void;
  onPostings: () => void;
}) {
  const m = data.metrics;
  const nothingYet = !data.jobs.length && !m.liveJobs && !data.funnel[0]?.count;

  if (nothingYet) {
    return (
      <EmptyState
        icon={<Briefcase className="h-10 w-10" />}
        title="No jobs yet"
        description="Post your first role. Candidates apply through Garage, and your network can refer people for a reward."
        action={
          <Button onClick={onPost}>
            <Plus className="h-4 w-4" /> Post your first job
          </Button>
        }
      />
    );
  }

  const delta =
    m.applicantsPrev30d > 0
      ? Math.round(((m.applicants30d - m.applicantsPrev30d) / m.applicantsPrev30d) * 100)
      : null;
  const applied = data.funnel[0]?.count || 0;
  const sourceTotal = data.sources.reduce((s, x) => s + x.count, 0);
  const referralCount = data.sources.find((s) => s.source === "referral")?.count || 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Live jobs" value={m.liveJobs} sub={`${m.acceptingJobs} accepting applications`} />
        <StatTile
          label="Applicants (30 days)"
          value={m.applicants30d}
          sub={delta === null ? "No earlier period to compare" : `${delta >= 0 ? "+" : ""}${delta}% vs previous 30 days`}
        />
        <StatTile
          label="In interview"
          value={m.inInterview}
          sub={`Across ${m.interviewJobs} role${m.interviewJobs === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Hired this quarter"
          value={m.hiredQuarter}
          sub={`${m.hiredQuarterReferral} from referrals`}
        />
        <StatTile label="Rewards held" value={formatMoney(m.rewardsHeld)} sub="Released after guarantee" accent />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Hiring funnel</h2>
            <FilterMenu
              label="Job"
              value={jobFilter}
              allLabel="All jobs"
              options={data.jobs.map((j) => ({ value: j._id, label: j.title || "Untitled job" }))}
              onChange={setJobFilter}
            />
          </div>
          <div className="space-y-3">
            {data.funnel.map((f) => {
              const pct = applied ? (f.count / applied) * 100 : 0;
              return (
                <div key={f.category} className="grid grid-cols-[96px_1fr_48px_48px] items-center gap-3 text-sm">
                  <span className="text-[#c7c7da]">{CATEGORY_META[f.category].label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#1f1f28]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(pct, f.count ? 2 : 0)}%`, background: CATEGORY_META[f.category].color }}
                    />
                  </div>
                  <span className="text-right tabular-nums text-white">{f.count}</span>
                  <span className="text-right text-xs tabular-nums text-[#7c7d94]">
                    {applied ? `${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Where applicants come from</h2>
          {sourceTotal ? (
            <>
              <div className="flex items-center gap-6">
                <div className="h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.sources}
                        dataKey="count"
                        nameKey="source"
                        innerRadius={38}
                        outerRadius={60}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {data.sources.map((s) => (
                          <Cell key={s.source} fill={SOURCE_COLORS[s.source] || "#71717a"} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-2 text-sm">
                  {[...data.sources]
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <li key={s.source} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[#c7c7da]">
                          <span className="h-2 w-2 rounded-sm" style={{ background: SOURCE_COLORS[s.source] || "#71717a" }} />
                          {SOURCE_LABELS[s.source] || s.source}
                        </span>
                        <span className="tabular-nums text-white">{Math.round((s.count / sourceTotal) * 100)}%</span>
                      </li>
                    ))}
                </ul>
              </div>
              <p className="mt-4 text-xs text-[#7c7d94]">
                {referralCount} applicant{referralCount === 1 ? "" : "s"} arrived through referral links.
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-[#7c7d94]">Sources appear once candidates apply.</p>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1f1f24] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Needs your attention</h2>
          {data.attention.length > 0 && (
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium"
              style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
            >
              {data.attention.length} item{data.attention.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {data.attention.length ? (
          <ul>
            {data.attention.map((a, i) => {
              let text = "";
              let icon = <AlertCircle className="h-4 w-4" style={{ color: GOLD }} />;
              let onClick: () => void = () => {};
              if (a.kind === "new_applications") {
                text = `${a.count} new application${a.count === 1 ? "" : "s"} need review`;
                onClick = () => onApplications({ view: "new" });
              } else if (a.kind === "overdue_scorecards") {
                text = `${a.count} interview scorecard${a.count === 1 ? " is" : "s are"} overdue`;
                onClick = () => onApplications({ stage: "interview" });
              } else if (a.kind === "closing_soon") {
                text = `${a.title} closes ${formatDate(a.closesAt, { year: undefined })}`;
                icon = <CalendarClock className="h-4 w-4 text-[#7c7d94]" />;
                onClick = () => a.jobId && onOpenJob(a.jobId);
              } else if (a.kind === "guarantee_starts") {
                text = `${a.name}'s guarantee starts ${formatDate(a.joinedAt, { year: undefined })}`;
                icon = <CalendarClock className="h-4 w-4 text-[#7c7d94]" />;
                onClick = onPayouts;
              }
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={onClick}
                    className="flex w-full items-center gap-3 border-t border-[#1f1f24] px-5 py-3 text-left text-sm text-[#c7c7da] transition-colors first:border-t-0 hover:bg-white/[0.02] hover:text-white"
                  >
                    {icon}
                    <span className="flex-1">{text}</span>
                    <ChevronRight className="h-4 w-4 text-[#4f5065]" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-[#7c7d94]">You&apos;re all caught up.</p>
        )}
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Live jobs</h2>
          <button type="button" onClick={onPostings} className="text-sm font-medium hover:brightness-110" style={{ color: GOLD }}>
            View all postings →
          </button>
        </div>
        {data.liveJobs.length ? (
          <div className="space-y-2">
            {data.liveJobs.map((j) => (
              <LiveJobRow key={j._id} job={j} onOpen={() => onOpenJob(j._id)} />
            ))}
          </div>
        ) : (
          <Card className="px-5 py-6 text-sm text-[#7c7d94]">No live jobs right now.</Card>
        )}
      </div>
    </div>
  );
}

function LiveJobRow({ job, onOpen }: { job: PostingRow; onOpen: () => void }) {
  const place = [job.department, job.locations[0], WORKPLACE_LABELS[job.workplace]].filter(Boolean).join(" · ");
  return (
    <Card
      onClick={onOpen}
      className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:border-[#3a3a48] md:grid-cols-[1.6fr_80px_120px_140px_110px_16px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">{job.title}</div>
        <div className="truncate text-xs text-[#7c7d94]">{place}</div>
      </div>
      <div className="hidden md:block">
        <StatusPill status={job.status} />
      </div>
      <div className="hidden text-sm text-[#c7c7da] md:block">
        {job.applicants} applicant{job.applicants === 1 ? "" : "s"}
      </div>
      <div className="hidden md:block">{job.reward.enabled ? <RewardBadge amount={job.reward.amount} /> : null}</div>
      <div className="hidden text-sm text-[#7c7d94] md:block">
        {job.closesAt ? `Closes ${formatDate(job.closesAt, { year: undefined })}` : "No closing date"}
      </div>
      <ChevronRight className="h-4 w-4 text-[#4f5065]" />
    </Card>
  );
}
