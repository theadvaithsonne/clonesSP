"use client";

// Job workspace · Job details — the posting as it stands, section by section,
// each with a shortcut into the matching wizard step.

import React from "react";
import { Building2, Globe, GraduationCap } from "lucide-react";
import { CATEGORY_META, EMPLOYMENT_LABELS, TEAM_ROLE_META, WORKPLACE_LABELS } from "../../constants";
import { Card, Chip, CopyButton, GOLD, SafeHtml, formatDate, formatMoney, formatSalary } from "../../ui";
import type { JobDetailResponse } from "../../types";
import { useReferralLink } from "../../useReferralLink";

const SECTIONS: Array<[keyof JobDetailResponse["job"]["description"], string]> = [
  ["aboutRole", "About the role"],
  ["responsibilities", "What you'll do"],
  ["requirements", "What you'll need"],
  ["niceToHave", "Nice to have"],
  ["offer", "What we offer"],
];

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button type="button" onClick={() => onEdit(step)} className="text-xs font-medium" style={{ color: GOLD }}>
          Edit
        </button>
      </div>
      {children}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[#61627a]">{label}</div>
      <div className="mt-0.5 text-sm text-white">{value || "—"}</div>
    </div>
  );
}

export default function JobDetailsTab({ detail, onEdit }: { detail: JobDetailResponse; onEdit: (step: number) => void }) {
  const job = detail.job;
  const salary = formatSalary(job.salary);
  const shareUrl = useReferralLink()(detail.publicUrl);
  return (
    <div className="grid gap-5 px-8 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <Section title="Basics" step={1} onEdit={onEdit}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Fact label="Department" value={job.department} />
            <Fact label="Openings" value={job.openings} />
            <Fact label="Employment" value={EMPLOYMENT_LABELS[job.employmentType]} />
            <Fact
              label="Workplace"
              value={job.workplace === "hybrid" && job.officeDays ? `Hybrid · ${job.officeDays} days in office` : WORKPLACE_LABELS[job.workplace]}
            />
            <Fact label="Locations" value={job.locations.join(", ")} />
            <Fact
              label="Experience"
              value={job.experienceMin != null || job.experienceMax != null ? `${job.experienceMin ?? 0}–${job.experienceMax ?? "+"} years` : ""}
            />
            <Fact label="Joining" value={job.joining} />
            <Fact label="Salary" value={salary ? `${salary}${job.salary.show ? "" : " (hidden)"}` : job.salary.show ? "" : "Hidden"} />
          </div>
        </Section>

        <Section title="Description" step={2} onEdit={onEdit}>
          <div className="space-y-4">
            {SECTIONS.map(([key, label]) =>
              (job.description[key] || "").replace(/<[^>]*>/g, "").trim() ? (
                <div key={key}>
                  <div className="mb-1 text-xs font-semibold text-[#c7c7da]">{label}</div>
                  <SafeHtml html={job.description[key]} />
                </div>
              ) : null
            )}
            {job.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            )}
            {(job.perks.length > 0 || (job.education.required && job.education.qualification)) && (
              <p className="text-xs text-[#7c7d94]">
                {job.perks.length ? `Perks: ${job.perks.join(", ")}` : ""}
                {job.education.required && job.education.qualification ? ` · Education: ${job.education.qualification}` : ""}
              </p>
            )}
          </div>
        </Section>

        <Section title="Pipeline & team" step={4} onEdit={onEdit}>
          <div className="flex flex-wrap gap-2">
            {job.stages.map((s, i) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#1A1A1A] px-2.5 py-1 text-xs text-[#c7c7da]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_META[s.category].color }} />
                {i + 1}. {s.name}
                {s.autoActions.length ? <span className="text-[#61627a]">· {s.autoActions.length} auto</span> : null}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-1.5">
            {job.team.map((t) => (
              <div key={t.userId} className="flex items-center justify-between text-sm">
                <span className="text-white">{detail.people[t.userId]?.name || "Member"}</span>
                <span className="text-xs text-[#7c7d94]">{TEAM_ROLE_META[t.role].label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Where it appears" step={6} onEdit={onEdit}>
          <div className="space-y-2 text-sm">
            {[
              { on: job.channels.garageHq, label: "Garage HQ Jobs", icon: <Building2 className="h-4 w-4" /> },
              { on: job.channels.university, label: "Garage University", icon: <GraduationCap className="h-4 w-4" /> },
              { on: job.channels.publicLink, label: "Public link", icon: <Globe className="h-4 w-4" /> },
            ].map((c) => (
              <div key={c.label} className={`flex items-center gap-2 ${c.on ? "text-white" : "text-[#4f5065] line-through"}`}>
                {c.icon} {c.label}
              </div>
            ))}
          </div>
          {job.channels.publicLink && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#1A1A1A] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-[#c7c7da]">{shareUrl}</span>
              <CopyButton value={shareUrl} />
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Fact label="Published" value={job.publishedAt ? formatDate(job.publishedAt) : job.status === "scheduled" && job.publishAt ? `Scheduled ${formatDate(job.publishAt)}` : "Not yet"} />
            <Fact label="Closes" value={job.closesAt ? formatDate(job.closesAt) : "No closing date"} />
          </div>
          <p className="mt-3 text-xs text-[#7c7d94]">
            {job.autoCloseOnHires ? `Closes automatically after ${job.openings} hire${job.openings === 1 ? "" : "s"}.` : "Stays open until you close it."}
          </p>
        </Section>

        <Section title="Referral reward" step={5} onEdit={onEdit}>
          {job.reward.enabled ? (
            <div className="grid grid-cols-2 gap-3">
              <Fact label="Per hire" value={<span style={{ color: GOLD }}>{formatMoney(job.reward.amount)}</span>} />
              <Fact label="Guarantee" value={`${job.reward.guaranteeDays} days`} />
              <Fact label="Funding" value={job.reward.funding === "hold" ? "Held from GaragePay" : "Paid on hire"} />
              <Fact label="Held now" value={formatMoney(job.reward.heldAmount || 0)} />
            </div>
          ) : (
            <p className="text-sm text-[#7c7d94]">No referral reward on this job.</p>
          )}
        </Section>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Totals</h3>
          <div className="grid grid-cols-2 gap-3">
            <Fact label="Applicants" value={detail.stats.total} />
            <Fact label="New" value={detail.stats.fresh} />
            <Fact label="Hired" value={detail.stats.hired} />
            <Fact label="Rejected" value={detail.stats.rejected} />
          </div>
        </Card>
      </div>
    </div>
  );
}
