"use client";

// The job itself as candidates see it — used full-width on the job page (B2)
// and compact in Discover's detail pane (B1). Only what the office chose to
// publish: no pipeline, notes or scores.

import React from "react";
import { AlertCircle, ExternalLink, Gift, ShieldCheck } from "lucide-react";
import { Button, Card, Chip, CopyButton, GOLD, OrgLogo, SafeHtml, formatDate, formatMoney } from "../ui";
import type { JobViewResponse } from "./candidateTypes";
import { SaveButton, employmentText, experienceText, postedText, processLabel, salaryText, workplaceText } from "./shared";

const SECTIONS: Array<[keyof JobViewResponse["job"]["description"], string]> = [
  ["aboutRole", "About the role"],
  ["responsibilities", "What you'll do"],
  ["requirements", "What you'll need"],
  ["niceToHave", "Nice to have"],
  ["offer", "What we offer"],
];

const hasText = (html?: string) => !!(html || "").replace(/<[^>]*>/g, "").trim();

export default function JobDetailView({
  data,
  variant,
  onApply,
  onViewApplication,
  onOpenFull,
}: {
  data: JobViewResponse;
  variant: "full" | "pane";
  onApply: () => void;
  onViewApplication: () => void;
  onOpenFull?: () => void;
}) {
  const { job, myApplication, referral, publicUrl } = data;
  const salary = salaryText(job);
  const experience = experienceText(job);
  const org = job.org;
  const pane = variant === "pane";

  const applyCard = (
    <Card className="space-y-4 p-5">
      {!job.isOpen ? (
        <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm">
          <div className="font-medium text-white">Applications closed</div>
          <div className="mt-0.5 text-xs text-[#7c7d94]">There is no active apply action for this role.</div>
        </div>
      ) : myApplication && !myApplication.isDraft ? (
        <Button className="w-full" onClick={onViewApplication}>
          View your application
        </Button>
      ) : (
        <Button className="w-full" onClick={onApply}>
          {myApplication?.isDraft ? "Continue application" : "Apply now"}
        </Button>
      )}
      <SaveButton jobId={job._id} />
      <div className="text-center text-xs text-[#7c7d94]">
        {[postedText(job), job.closesAt ? `Closes ${formatDate(job.closesAt, { year: undefined })}` : ""].filter(Boolean).join(" · ")}
        <div className="mt-0.5">
          {job.applicants} applicant{job.applicants === 1 ? "" : "s"}
        </div>
      </div>
      {job.process.length > 0 && (
        <div className="border-t border-[#1f1f24] pt-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-white">Application process</span>
            <span className="text-xs" style={{ color: GOLD }}>
              ~{job.estimatedMinutes} min to apply
            </span>
          </div>
          <ol className="space-y-2.5">
            {job.process.map((c, i) => (
              <li key={c} className="flex items-center gap-3 text-sm text-[#c7c7da]">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={i === 0 ? { background: GOLD, color: "#000" } : { border: "1px solid #3a3a48", color: "#7c7d94" }}
                >
                  {i + 1}
                </span>
                {processLabel(c)}
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="flex items-start gap-2 rounded-lg border border-[#22c55e]/25 bg-[#22c55e]/5 px-3 py-2 text-[11px] text-[#86efac]">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Garage never asks candidates to pay to apply.
      </div>
    </Card>
  );

  const referralCard = referral && (
    <Card className="space-y-3 p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
        >
          <Gift className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-medium text-white">Refer someone &amp; earn {formatMoney(referral.earn)} per hire</div>
          <p className="mt-0.5 text-xs leading-5 text-[#7c7d94]">
            Share your link. If the person you refer is hired, your reward is paid after their {referral.guaranteeDays}-day
            guarantee period.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-[#c7c7da]">{referral.link}</span>
        <CopyButton value={referral.link} />
      </div>
    </Card>
  );

  return (
    <div className={pane ? "space-y-5" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"}>
      <div className="min-w-0 space-y-6">
        {!job.isOpen && variant === "full" && (
          <div className="flex items-start gap-3 rounded-2xl border border-[#262626] bg-[#141414] px-5 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#7c7d94]" />
            <div>
              <div className="text-sm font-semibold text-white">This job is no longer accepting applications</div>
              <div className="mt-0.5 text-xs text-[#7c7d94]">
                {job.closedAt ? `The role closed on ${formatDate(job.closedAt)}.` : "The role is closed."}
                {!myApplication || myApplication.isDraft ? " Your profile has not been shared." : ""}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <OrgLogo name={org?.name} src={org?.icon} size={pane ? 40 : 48} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white">{org?.name}</div>
            <div className="text-xs text-[#7c7d94]">{[org?.city, org?.country].filter(Boolean).join(", ")}</div>
          </div>
          {pane && onOpenFull && (
            <button type="button" onClick={onOpenFull} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: GOLD }}>
              Full page <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div>
          <h1 className={`${pane ? "text-xl" : "text-2xl"} font-semibold text-white`}>{job.title}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip>{employmentText(job)}</Chip>
            <Chip>{workplaceText(job)}</Chip>
            {job.locations.map((l) => (
              <Chip key={l}>{l}</Chip>
            ))}
            {experience && <Chip>{experience}</Chip>}
            {salary && <Chip>{salary}</Chip>}
            {!job.isOpen && <Chip>Closed</Chip>}
          </div>
        </div>

        {pane && <div>{applyCard}</div>}

        <div className="space-y-5 border-t border-[#1f1f24] pt-5">
          {SECTIONS.map(([key, label]) =>
            hasText(job.description?.[key]) ? (
              <section key={key}>
                <h2 className="mb-2 text-sm font-semibold text-white">{label}</h2>
                <SafeHtml html={job.description[key]} />
              </section>
            ) : null
          )}
          {job.skills.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-white">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </section>
          )}
          {job.perks.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-white">Perks</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.perks.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            </section>
          )}
          {job.education?.required && job.education.qualification && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-white">Education</h2>
              <p className="text-sm text-[#c7c7da]">{job.education.qualification}</p>
            </section>
          )}
          {job.aboutCompany && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-white">About {org?.name}</h2>
              <p className="whitespace-pre-line text-sm leading-6 text-[#c7c7da]">{job.aboutCompany}</p>
            </section>
          )}
        </div>
      </div>

      {!pane && (
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {applyCard}
          {publicUrl && (
            <Card className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="text-sm text-[#c7c7da]">Share this job</span>
              <CopyButton value={publicUrl} label="Copy link" />
            </Card>
          )}
          {referralCard}
        </aside>
      )}
      {pane && referralCard}
    </div>
  );
}
