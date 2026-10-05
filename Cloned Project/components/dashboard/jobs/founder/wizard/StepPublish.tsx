"use client";

// A9 · Step 6 — Publish: where the job appears, when it opens and closes, a
// review of every step, then Publish (which is also when any referral reward
// hold is taken from GaragePay). Editing an already-published job ends here
// with "Done" instead — changes autosave.

import React from "react";
import { AlertTriangle, Building2, Check, Globe, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { JobsApiError } from "../../api";
import { EMPLOYMENT_LABELS, JOB_PAGES, WORKPLACE_LABELS } from "../../constants";
import { useJobsNav } from "../../nav";
import { useReferralLink } from "../../useReferralLink";
import {
  Button,
  Card,
  CopyButton,
  GOLD,
  SwitchControl,
  formatDate,
  formatMoney,
  formatSalary,
  fromLocalInput,
  toLocalInput,
  errorMessage,
} from "../../ui";
import { showSellablePublished } from "@/components/shared/SellablePublishedModal";
import type { StepProps } from "./JobWizard";
import { StepHeading } from "./StepBasics";

function stripHtml(html?: string) {
  return (html || "").replace(/<[^>]*>/g, " ").trim();
}

export default function StepPublish({ job, detail, update, flush, onEditStep }: StepProps & { onEditStep: (n: number) => void }) {
  const nav = useJobsNav();
  const withRef = useReferralLink();
  const [publishing, setPublishing] = React.useState(false);
  const [fundsError, setFundsError] = React.useState<{ balance: number; required: number } | null>(null);

  const isDraft = job.status === "draft";
  const problems = detail.problems || [];
  const fields = job.form.pages.flatMap((p) => p.fields).filter((f) => !["section_heading", "info_text"].includes(f.type));
  const knockouts = fields.filter((f) => f.knockout?.enabled).length;
  const quizzes = fields.filter((f) => f.type === "quiz_mcq").length;

  const review: Array<{ step: number; title: string; summary: string; ok: boolean }> = [
    {
      step: 1,
      title: "Basics",
      summary: [job.title || "No title", detail.org.name, `${job.openings} opening${job.openings === 1 ? "" : "s"}`, EMPLOYMENT_LABELS[job.employmentType]].join(" · "),
      ok: !!job.title.trim() && (job.workplace === "remote" || job.locations.length > 0),
    },
    {
      step: 2,
      title: "Description",
      summary: stripHtml(job.description.aboutRole)
        ? `${[job.skills.length && `${job.skills.length} skills`, job.perks.length && `${job.perks.length} perks`].filter(Boolean).join(", ") || "Role overview"} complete`
        : "Role overview missing",
      ok: !!stripHtml(job.description.aboutRole),
    },
    {
      step: 3,
      title: "Application form",
      summary: `${job.form.pages.length} page${job.form.pages.length === 1 ? "" : "s"}, ${fields.length} field${fields.length === 1 ? "" : "s"}${knockouts ? `, ${knockouts} knockout` : ""}${quizzes ? `, ${quizzes} quiz question${quizzes === 1 ? "" : "s"}` : ""}`,
      ok: fields.length > 0,
    },
    {
      step: 4,
      title: "Pipeline",
      summary: `${job.stages.length} stages, ${job.team.length} team member${job.team.length === 1 ? "" : "s"}`,
      ok: job.stages.length >= 2 && job.team.length > 0,
    },
    {
      step: 5,
      title: "Referral reward",
      summary: job.reward.enabled
        ? `${formatMoney(job.reward.amount)}/hire, ${job.reward.guaranteeDays}-day guarantee, ${
            job.reward.funding === "hold" ? `${formatMoney(job.reward.amount * job.openings)} held` : "paid on hire"
          }`
        : "No referral reward",
      ok: !job.reward.enabled || job.reward.amount > 0,
    },
  ];

  const publish = async () => {
    setFundsError(null);
    setPublishing(true);
    try {
      const ok = await flush();
      if (!ok) return;
      const res = await jobsApi.publishJob(job._id);
      update({ status: res.job.status, completedStep: 6 });
      const scheduled = res.job.status === "scheduled";
      const opensAt = res.job.publishAt || job.publishAt;
      // The shared "published — now share it" popup; it adds the founder's
      // referral code to the link itself.
      showSellablePublished({
        kind: "job",
        heading: scheduled ? "Job scheduled!" : undefined,
        title: res.job.title || job.title,
        image: detail.org.icon || null,
        byline: detail.org.name,
        url: res.publicUrl,
        price: formatSalary(job.salary),
        facts: [
          EMPLOYMENT_LABELS[job.employmentType],
          WORKPLACE_LABELS[job.workplace],
          job.workplace !== "remote" && job.locations[0],
          job.openings > 1 && `${job.openings} openings`,
        ],
        note:
          [
            scheduled && opensAt && `Applications open ${formatDate(opensAt)}.`,
            res.heldAmount > 0 && `${formatMoney(res.heldAmount)} held from GaragePay for referral rewards.`,
          ]
            .filter(Boolean)
            .join(" ") || null,
        onClose: () => nav.go(JOB_PAGES.postings),
        action: { label: "Go to pipeline", onClick: () => nav.openJob(job._id) },
      });
    } catch (err) {
      if (err instanceof JobsApiError && err.status === 402) {
        setFundsError({ balance: Number(err.data.balance || 0), required: Number(err.data.required || 0) });
      } else if (err instanceof JobsApiError && Array.isArray(err.data.problems)) {
        toast.error(String(err.data.problems[0]));
      } else {
        toast.error(errorMessage(err, "Couldn't publish the job."));
      }
    } finally {
      setPublishing(false);
    }
  };

  const channels: Array<{ key: keyof typeof job.channels; title: string; sub: string; icon: React.ReactNode }> = [
    { key: "garageHq", title: "Garage HQ Jobs", sub: "Visible to Garage members in Jobs → Discover", icon: <Building2 className="h-4 w-4" /> },
    {
      key: "university",
      title: "Garage University",
      sub: "Listed for Garage University learners once University jobs are live",
      icon: <GraduationCap className="h-4 w-4" />,
    },
    { key: "publicLink", title: "Public link", sub: "Anyone with the link can view the role and apply with a Garage account", icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="grid flex-1 gap-6 px-8 py-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <StepHeading step={6} title="Publish" subtitle="Choose where the role appears and when applications open." />
          <Card className="p-5">
            <div className="mb-4">
              <div className="text-sm font-semibold text-white">Where this job appears</div>
              <div className="text-xs text-[#7c7d94]">
                {Object.values(job.channels).filter(Boolean).length} of 3 destinations on
              </div>
            </div>
            <div className="space-y-3">
              {channels.map((c) => (
                <div key={c.key} className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[#7c7d94]">{c.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white">{c.title}</div>
                      <div className="text-xs text-[#7c7d94]">{c.sub}</div>
                    </div>
                    <SwitchControl
                      checked={!!job.channels[c.key]}
                      onChange={(v) => update({ channels: { [c.key]: v } })}
                      aria-label={c.title}
                    />
                  </div>
                  {c.key === "publicLink" && job.channels.publicLink && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#141414] px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-[#c7c7da]">{withRef(detail.publicUrl)}</span>
                      <CopyButton value={withRef(detail.publicUrl)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <div className="text-sm font-semibold text-white">Review summary</div>
              <div className="text-xs text-[#7c7d94]">
                {problems.length ? "A few things still need attention." : "Everything is complete and ready to publish."}
              </div>
            </div>
            <div className="divide-y divide-[#1f1f24]">
              {review.map((r) => (
                <div key={r.step} className="flex items-center gap-3 py-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${r.ok ? "bg-[#22c55e] text-black" : "bg-[#f59e0b]/15 text-[#fbbf24]"}`}
                  >
                    {r.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white">{r.title}</div>
                    <div className="truncate text-xs text-[#7c7d94]">{r.summary}</div>
                  </div>
                  <button type="button" onClick={() => onEditStep(r.step)} className="text-xs font-medium" style={{ color: GOLD }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
            {problems.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-4 py-3 text-xs text-[#fbbf24]">
                {problems.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div>
              <div className="text-sm font-semibold text-white">Schedule</div>
              <div className="text-xs text-[#7c7d94]">Set when the listing opens and closes.</div>
            </div>
            {isDraft && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["now", "Publish now"],
                    ["scheduled", "Schedule"],
                  ] as const
                ).map(([v, label]) => {
                  const active = job.publishMode === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update({ publishMode: v })}
                      className="rounded-xl border px-3 py-2.5 text-sm transition-colors"
                      style={
                        active
                          ? { borderColor: GOLD, background: "color-mix(in srgb, var(--brand) 8%, transparent)", color: "#fff" }
                          : { borderColor: "#262626", background: "#1A1A1A", color: "#c7c7da" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {isDraft && job.publishMode === "scheduled" && (
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Publish on</div>
                <input
                  type="datetime-local"
                  value={toLocalInput(job.publishAt)}
                  onChange={(e) => update({ publishAt: fromLocalInput(e.target.value) || null })}
                  className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-brand"
                />
              </div>
            )}
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Closing date</div>
              <input
                type="datetime-local"
                value={toLocalInput(job.closesAt)}
                onChange={(e) => update({ closesAt: fromLocalInput(e.target.value) || null })}
                className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white outline-none [color-scheme:dark] focus:border-brand"
              />
              <p className="mt-1 text-[11px] text-[#61627a]">Leave empty to keep the role open until you close it.</p>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-white">
              <span>
                Close automatically when {job.openings} hire{job.openings === 1 ? " is" : "s are"} made
              </span>
              <SwitchControl checked={job.autoCloseOnHires} onChange={(v) => update({ autoCloseOnHires: v })} aria-label="Auto close" />
            </div>
          </Card>

          {fundsError && (
            <div className="rounded-xl border border-[#f87171]/40 bg-[#f87171]/5 px-4 py-3 text-sm">
              <div className="text-white">
                Your GaragePay balance ({formatMoney(fundsError.balance)}) is below the {formatMoney(fundsError.required)} to hold.
              </div>
              <div className="mt-1 text-xs text-[#c7c7da]">Add funds or switch the reward to &quot;Pay on hire&quot; in step 5.</div>
              <Button variant="secondary" className="mt-3" onClick={() => onEditStep(5)}>
                Go to Referral reward
              </Button>
            </div>
          )}

          {isDraft && !problems.length && (
            <div className="flex items-start gap-3 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5 px-4 py-3 text-xs text-[#86efac]">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              Your job page, pipeline{job.reward.enabled && job.reward.funding === "hold" ? " and referral funding" : ""} go live together.
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[#1c1c24] bg-[#0c0c0e] px-8 py-3">
        <span className="text-xs text-[#7c7d94]">
          {job.title || "Untitled job"} · {detail.org.name} ·{" "}
          {!isDraft
            ? `${job.status} — changes save automatically`
            : job.publishMode === "scheduled" && job.publishAt
              ? `publishes ${formatDate(job.publishAt)}`
              : "publishes immediately"}
        </span>
        {isDraft ? (
          <Button onClick={publish} loading={publishing} disabled={problems.length > 0}>
            {job.publishMode === "scheduled" ? "Schedule job" : "Publish job"}
          </Button>
        ) : (
          <Button
            onClick={async () => {
              if (await flush()) nav.openJob(job._id);
            }}
          >
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
