"use client";

// How the role reads to candidates: the job card (live preview in Basics and
// Referral reward) and the full job page (header "Preview").

import React from "react";
import { Bookmark, Briefcase, Clock, MapPin } from "lucide-react";
import { EMPLOYMENT_LABELS, WORKPLACE_LABELS } from "../../constants";
import { Chip, GOLD, Modal, OrgLogo, RewardBadge, SafeHtml, formatSalary } from "../../ui";
import type { Job, OrgInfo } from "../../types";

export function JobCardPreview({
  job,
  org,
  earn,
  footer,
}: {
  job: Job;
  org: OrgInfo;
  /** Affiliate "Earn $X" line, shown on the reward step. */
  earn?: number | null;
  footer?: React.ReactNode;
}) {
  const salary = formatSalary(job.salary);
  const workplace =
    job.workplace === "hybrid" && job.officeDays ? `Hybrid · ${job.officeDays} days in office` : WORKPLACE_LABELS[job.workplace];
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
      <div className="flex items-start gap-3">
        <OrgLogo name={org.name} src={org.icon} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-white">{job.title || "Job title"}</div>
          <div className="truncate text-sm text-[#7c7d94]">{org.name}</div>
        </div>
        <Bookmark className="h-4 w-4 text-[#4f5065]" />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#c7c7da]">
        {job.locations[0] && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#7c7d94]" />
            {job.locations[0]}
            {job.locations.length > 1 ? ` +${job.locations.length - 1}` : ""}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-[#7c7d94]" />
          {workplace}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[#7c7d94]" />
          {EMPLOYMENT_LABELS[job.employmentType]}
        </span>
      </div>
      {salary && <div className="mt-3 text-sm font-semibold text-white">{salary}</div>}
      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 4).map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#1f1f24] pt-3 text-xs text-[#7c7d94]">
        <span>{footer ?? `Draft · ${job.openings} opening${job.openings === 1 ? "" : "s"}`}</span>
        {job.reward.enabled && job.reward.amount > 0 && <RewardBadge amount={job.reward.amount} size="sm" />}
      </div>
      {earn ? (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium"
          style={{ borderColor: GOLD, color: GOLD, background: "color-mix(in srgb, var(--brand) 8%, transparent)" }}
        >
          Affiliates see: Earn up to ${earn.toFixed(2)} per hire
        </div>
      ) : null}
    </div>
  );
}

const SECTIONS: Array<[keyof Job["description"], string]> = [
  ["aboutRole", "About the role"],
  ["responsibilities", "What you'll do"],
  ["requirements", "What you'll need"],
  ["niceToHave", "Nice to have"],
  ["offer", "What we offer"],
];

export default function JobPreviewModal({
  open,
  onClose,
  job,
  org,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  org: OrgInfo;
}) {
  const salary = formatSalary(job.salary);
  return (
    <Modal open={open} onClose={onClose} title="Candidate view" width="max-w-3xl">
      <div className="flex items-center gap-3">
        <OrgLogo name={org.name} src={org.icon} size={44} />
        <div>
          <div className="text-sm font-medium text-white">{org.name}</div>
          <div className="text-xs text-[#7c7d94]">{[org.city, org.country].filter(Boolean).join(", ")}</div>
        </div>
      </div>
      <h2 className="text-2xl font-semibold text-white">{job.title || "Job title"}</h2>
      <div className="flex flex-wrap gap-1.5">
        <Chip>{EMPLOYMENT_LABELS[job.employmentType]}</Chip>
        <Chip>
          {job.workplace === "hybrid" && job.officeDays ? `Hybrid (${job.officeDays} days)` : WORKPLACE_LABELS[job.workplace]}
        </Chip>
        {job.locations.map((l) => (
          <Chip key={l}>{l}</Chip>
        ))}
        {(job.experienceMin != null || job.experienceMax != null) && (
          <Chip>
            {job.experienceMin ?? 0}–{job.experienceMax ?? "+"} yrs
          </Chip>
        )}
        {salary && <Chip>{salary}</Chip>}
      </div>
      <div className="space-y-5 border-t border-[#262626] pt-5">
        {SECTIONS.map(([key, label]) =>
          (job.description[key] || "").replace(/<[^>]*>/g, "").trim() ? (
            <section key={key}>
              <h3 className="mb-2 text-sm font-semibold text-white">{label}</h3>
              <SafeHtml html={job.description[key]} />
            </section>
          ) : null
        )}
        {job.skills.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white">Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </section>
        )}
        {job.perks.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white">Perks</h3>
            <div className="flex flex-wrap gap-1.5">
              {job.perks.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </section>
        )}
        {job.education.required && job.education.qualification && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white">Education</h3>
            <p className="text-sm text-[#c7c7da]">{job.education.qualification}</p>
          </section>
        )}
        {org.description && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-white">About {org.name}</h3>
            <p className="text-sm leading-6 text-[#c7c7da]">{org.description}</p>
          </section>
        )}
      </div>
    </Modal>
  );
}
