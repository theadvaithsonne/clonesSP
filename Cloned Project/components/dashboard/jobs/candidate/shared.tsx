"use client";

// Small pieces shared by the candidate screens: job facts formatting, the
// bookmark button and the job cards used in lists.

import React from "react";
import { Bookmark, MapPin } from "lucide-react";
import { CATEGORY_META, EMPLOYMENT_LABELS, WORKPLACE_LABELS } from "../constants";
import { GOLD, OrgLogo, RewardBadge, formatSalary, timeAgo } from "../ui";
import type { StageCategory } from "../types";
import { useSavedStore } from "./boardNav";
import type { PublicJob } from "./candidateTypes";

export function workplaceText(job: Pick<PublicJob, "workplace" | "officeDays">, long = false): string {
  if (job.workplace === "hybrid" && job.officeDays) {
    return long ? `Hybrid (${job.officeDays} day${job.officeDays === 1 ? "" : "s"} in office)` : `Hybrid (${job.officeDays} days)`;
  }
  return WORKPLACE_LABELS[job.workplace];
}

export function placeText(job: Pick<PublicJob, "locations" | "workplace" | "officeDays">): string {
  const where = job.locations.length ? job.locations[0] + (job.locations.length > 1 ? ` +${job.locations.length - 1}` : "") : "";
  return [where, workplaceText(job)].filter(Boolean).join(" · ");
}

export function experienceText(job: Pick<PublicJob, "experienceMin" | "experienceMax">): string | null {
  const min = job.experienceMin;
  const max = job.experienceMax;
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} yrs`;
  if (min != null) return `${min}+ yrs`;
  return `Up to ${max} yrs`;
}

export function salaryText(job: Pick<PublicJob, "salary">): string | null {
  return job.salary ? formatSalary({ show: true, ...job.salary }) : null;
}

export function postedText(job: Pick<PublicJob, "publishedAt">): string {
  return job.publishedAt ? `Posted ${timeAgo(job.publishedAt)}` : "";
}

export function employmentText(job: Pick<PublicJob, "employmentType">): string {
  return EMPLOYMENT_LABELS[job.employmentType];
}

export function processLabel(c: StageCategory): string {
  return CATEGORY_META[c]?.label || c;
}

/** Days until a closing date, or null when there is none. */
export function daysLeft(closesAt?: string | null): number | null {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function SaveButton({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  const saved = useSavedStore((s) => s.ids.has(jobId));
  const toggle = useSavedStore((s) => s.toggle);
  const load = useSavedStore((s) => s.load);
  React.useEffect(() => {
    load();
  }, [load]);
  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle(jobId);
        }}
        className="rounded-lg p-1.5 text-[#7c7d94] transition-colors hover:bg-[#1f1f28] hover:text-white"
        aria-label={saved ? "Remove from saved" : "Save job"}
        title={saved ? "Saved" : "Save"}
      >
        <Bookmark className="h-4 w-4" style={saved ? { color: GOLD, fill: GOLD } : undefined} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => toggle(jobId)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#262626] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-[#3A3A3A] hover:text-white"
    >
      <Bookmark className="h-4 w-4" style={saved ? { color: GOLD, fill: GOLD } : undefined} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

export function ApplicationBadge({ job }: { job: PublicJob }) {
  const mine = job.myApplication;
  if (!mine) return null;
  const label = mine.isDraft ? "Draft" : mine.status === "withdrawn" ? "Withdrawn" : "Applied";
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={
        mine.isDraft
          ? { color: "#fbbf24", background: "rgba(245,158,11,0.12)" }
          : { color: "#4ade80", background: "rgba(34,197,94,0.12)" }
      }
    >
      {label}
    </span>
  );
}

/** A job as a card — saved jobs grid, similar roles. */
export function JobCard({ job, onOpen, footer }: { job: PublicJob; onOpen: () => void; footer?: React.ReactNode }) {
  const salary = salaryText(job);
  const left = daysLeft(job.closesAt);
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer flex-col rounded-2xl border border-[#262626] bg-[#141414] p-4 transition-colors hover:border-[#3a3a48]"
    >
      <div className="flex items-start gap-3">
        <OrgLogo name={job.org?.name} src={job.org?.icon} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{job.title}</div>
          <div className="truncate text-xs text-[#7c7d94]">{job.org?.name}</div>
        </div>
        <SaveButton jobId={job._id} compact />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-[#c7c7da]">
        <MapPin className="h-3.5 w-3.5 text-[#7c7d94]" />
        <span className="truncate">{placeText(job) || employmentText(job)}</span>
      </div>
      {salary && <div className="mt-1.5 text-sm font-medium text-white">{salary}</div>}
      {job.skills.length > 0 && <div className="mt-1.5 truncate text-xs text-[#7c7d94]">{job.skills.slice(0, 3).join(" · ")}</div>}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-[#61627a]">
        <span className="flex items-center gap-2">
          {job.isOpen ? postedText(job) : "Closed"}
          {job.isOpen && left !== null && left >= 0 && left <= 7 && (
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ color: "#fbbf24", background: "rgba(245,158,11,0.12)" }}>
              Closing in {left === 0 ? "less than a day" : `${left} day${left === 1 ? "" : "s"}`}
            </span>
          )}
          <ApplicationBadge job={job} />
        </span>
        {job.reward && <RewardBadge amount={job.reward.amount} size="sm" />}
      </div>
      {footer}
    </div>
  );
}
