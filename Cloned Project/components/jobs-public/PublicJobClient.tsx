"use client";

// C2 · Public job page — `/jobs/<office slug>/<job slug>?ref=<affiliateId>`.
// C3 · "Sign in to apply" gate.
//
// Applying needs a Garage account. Signed-in visitors go straight to the
// in-app apply flow (`/workspace?openApp=jobs&jobId=…`); everyone else signs in
// through the normal /login flow, which brings them back to that same link.
// The referral code rides along twice: on the workspace link (credits this
// application to the referrer) and as the signup referral (`ref` on /login,
// stored as `referral_code`) so a brand-new account is attributed too.

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  Check,
  Clock,
  Copy,
  GraduationCap,
  Linkedin,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import { Avatar, Chip, OrgLogo, SafeHtml, formatSalary } from "@/components/dashboard/jobs/ui";
import { CATEGORY_META, EMPLOYMENT_LABELS, WORKPLACE_LABELS } from "@/components/dashboard/jobs/constants";
import { fetchCareersPage, fetchPublicJob, PublicJobsError, recordJobView } from "./api";
import { PublicFooter, PublicState, PublicTopBar, loginUrl } from "./PublicShell";
import type { PublicJobResponse } from "./types";

const SECTIONS: Array<["aboutRole" | "responsibilities" | "requirements" | "niceToHave" | "offer", string]> = [
  ["aboutRole", "About the role"],
  ["responsibilities", "What you'll do"],
  ["requirements", "What you'll need"],
  ["niceToHave", "Nice to have"],
  ["offer", "What we offer"],
];

const hasText = (html?: string) => !!(html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PublicJobClient({ orgSlug, jobSlug }: { orgSlug: string; jobSlug: string }) {
  const sp = useSearchParams();
  const ref = (sp.get("ref") || "").trim() || null;
  const source = sp.get("source") === "careers_page" ? "careers_page" : "public_link";

  const [data, setData] = React.useState<PublicJobResponse | null>(null);
  const [aboutCompany, setAboutCompany] = React.useState<string>("");
  const [error, setError] = React.useState<{ status: number; message: string } | null>(null);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState("");
  const viewed = React.useRef(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetchPublicJob(orgSlug, jobSlug, ref);
      setData(res);
      // The job payload carries the office without its description; the
      // careers endpoint has it. Decoration only — ignore failures.
      fetchCareersPage(orgSlug)
        .then((c) => setAboutCompany(c.careersPage.about || c.org.description || ""))
        .catch(() => {});
    } catch (err) {
      setError({
        status: err instanceof PublicJobsError ? err.status : 0,
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }, [orgSlug, jobSlug, ref]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!data?.job?._id || viewed.current || !data.job.isOpen) return;
    viewed.current = true;
    recordJobView(data.job._id, source);
  }, [data, source]);

  React.useEffect(() => {
    // Share the clean link, keeping the visitor's own referral if they came through one.
    const url = new URL(window.location.href);
    url.searchParams.delete("source");
    setShareUrl(url.toString());
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0c0c0e]">
        <PublicTopBar org={null} />
        {error.status === 404 ? (
          <PublicState
            title="Job not found"
            message="This role may have been removed, or the link is incomplete."
            action={
              <Link href={`/jobs/${encodeURIComponent(orgSlug)}`} className="rounded-xl border border-[#262626] px-4 py-2 text-sm text-white hover:border-[#3a3a48]">
                See open roles
              </Link>
            }
          />
        ) : (
          <PublicState
            title="Couldn't load this job"
            message={error.message}
            action={
              <button type="button" onClick={load} className="rounded-xl border border-[#262626] px-4 py-2 text-sm text-white hover:border-[#3a3a48]">
                Try again
              </button>
            }
          />
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0c0c0e]">
        <PublicTopBar org={null} />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-lg bg-[#141414]" />
            <div className="h-6 w-1/2 animate-pulse rounded-lg bg-[#141414]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[#141414]" />
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-[#141414]" />
        </div>
      </div>
    );
  }

  const { job, referrer } = data;
  const org = job.org;
  const salary = formatSalary(job.salary ? { show: true, ...job.salary } : null);
  const workplace =
    job.workplace === "hybrid" && job.officeDays ? `Hybrid (${job.officeDays} days)` : WORKPLACE_LABELS[job.workplace];
  const experience =
    job.experienceMin != null || job.experienceMax != null
      ? `${job.experienceMin ?? 0}–${job.experienceMax ?? "+"} yrs`
      : null;
  const steps = [...job.process.map((c) => CATEGORY_META[c]?.label || c), "Offer"].filter(
    (label, i, arr) => arr.indexOf(label) === i
  );

  const workspaceUrl = (() => {
    const q = new URLSearchParams({ openApp: "jobs", jobId: job._id, source });
    if (ref) q.set("ref", ref);
    return `/workspace?${q.toString()}`;
  })();

  const apply = () => {
    if (!job.isOpen) return;
    if (getToken()) {
      window.location.href = workspaceUrl;
      return;
    }
    setGateOpen(true);
  };

  const shareText = encodeURIComponent(`${job.title}${org ? ` at ${org.name}` : ""}`);
  const shareEncoded = encodeURIComponent(shareUrl);

  const applyCard = (
    <div className="space-y-4 rounded-2xl border border-[#262626] bg-[#141414] p-5">
      {job.isOpen ? (
        <>
          <button
            type="button"
            onClick={apply}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-black shadow-md transition-all hover:brightness-95 active:scale-[0.99]"
          >
            Apply now
          </button>
          <p className="text-center text-xs text-[#7c7d94]">~{job.estimatedMinutes} min · you&apos;ll need a Garage account</p>
        </>
      ) : (
        <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-center">
          <p className="text-sm font-medium text-white">No longer accepting applications</p>
          {job.closedAt && <p className="mt-1 text-xs text-[#7c7d94]">Closed {fmtDate(job.closedAt)}</p>}
        </div>
      )}
      {referrer && (
        <div className="flex items-center gap-3 border-t border-[#1f1f24] pt-4">
          <Avatar name={referrer.name} src={referrer.avatar} size={32} />
          <div className="min-w-0">
            <p className="text-[11px] text-[#7c7d94]">Referred by</p>
            <p className="truncate text-sm text-white">{referrer.name || referrer.affiliateId}</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[#1f1f24] pt-4">
        <span className="text-xs text-[#7c7d94]">Share this role</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("Link copied");
              } catch {
                toast.error("Couldn't copy the link.");
              }
            }}
            className="rounded-lg p-2 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white"
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </button>
          <a
            href={`https://wa.me/?text=${shareText}%20${shareEncoded}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white"
            aria-label="Share on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareEncoded}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white"
            aria-label="Share on LinkedIn"
          >
            <Linkedin className="h-4 w-4" />
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareEncoded}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-[#7c7d94] hover:bg-[#1f1f28] hover:text-white"
            aria-label="Share on X"
          >
            <X className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e] pb-24 text-white lg:pb-0">
      <PublicTopBar org={org} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {org && (
          <Link
            href={`/jobs/${encodeURIComponent(org.slug)}`}
            className="mb-5 inline-flex items-center gap-1.5 text-xs text-[#7c7d94] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All roles at {org.name}
          </Link>
        )}

        {!job.isOpen && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-4 py-3 text-sm">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" />
            <div>
              <p className="font-medium text-white">This job is no longer accepting applications</p>
              <p className="mt-0.5 text-xs text-[#c7c7da]">
                {org ? (
                  <>
                    See the other{" "}
                    <Link href={`/jobs/${encodeURIComponent(org.slug)}`} className="text-brand hover:underline">
                      open roles at {org.name}
                    </Link>
                    .
                  </>
                ) : (
                  "Check back for new roles."
                )}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0">
            {org && (
              <div className="flex items-center gap-3">
                <OrgLogo name={org.name} src={org.icon} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{org.name}</p>
                  <p className="truncate text-xs text-[#7c7d94]">{[org.city, org.country].filter(Boolean).join(", ")}</p>
                </div>
              </div>
            )}
            <h1 className="mt-5 text-2xl font-semibold leading-tight text-white sm:text-3xl">{job.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>{EMPLOYMENT_LABELS[job.employmentType]}</Chip>
              <Chip>{workplace}</Chip>
              {job.locations.map((l) => (
                <Chip key={l}>{l}</Chip>
              ))}
              {experience && <Chip>{experience}</Chip>}
              {salary && <Chip>{salary}</Chip>}
            </div>
            {referrer && (
              <p className="mt-4 flex items-center gap-2 text-xs text-[#c7c7da] lg:hidden">
                <Users className="h-3.5 w-3.5 text-brand" /> Referred by {referrer.name || referrer.affiliateId}
              </p>
            )}

            <div className="mt-8 space-y-7 border-t border-[#1c1c24] pt-7">
              {SECTIONS.map(([key, label]) =>
                hasText(job.description?.[key]) ? (
                  <section key={key}>
                    <h2 className="mb-2 text-base font-semibold text-white">{label}</h2>
                    <SafeHtml html={job.description[key] || ""} />
                  </section>
                ) : null
              )}

              {job.skills.length > 0 && (
                <section>
                  <h2 className="mb-3 text-base font-semibold text-white">Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </section>
              )}

              {job.perks.length > 0 && (
                <section>
                  <h2 className="mb-3 text-base font-semibold text-white">Perks</h2>
                  <div className="flex flex-wrap gap-2">
                    {job.perks.map((p) => (
                      <Chip key={p}>{p}</Chip>
                    ))}
                  </div>
                </section>
              )}

              {job.education?.required && job.education.qualification && (
                <section>
                  <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-white">
                    <GraduationCap className="h-4 w-4 text-[#7c7d94]" /> Education
                  </h2>
                  <p className="text-sm text-[#c7c7da]">{job.education.qualification}</p>
                </section>
              )}

              {org && aboutCompany && (
                <section>
                  <h2 className="mb-2 text-base font-semibold text-white">About {org.name}</h2>
                  <p className="whitespace-pre-line text-sm leading-6 text-[#c7c7da]">{aboutCompany}</p>
                </section>
              )}

              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-white">Application process</h2>
                  <span className="text-xs text-brand">~{job.estimatedMinutes} min to apply</span>
                </div>
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
                  {steps.map((label, i) => (
                    <li key={label} className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          i === 0 ? "bg-brand text-black" : "border border-[#3a3a48] text-[#c7c7da]"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm text-[#c7c7da]">{label}</span>
                      {i < steps.length - 1 && <span className="mx-1 hidden h-px w-6 bg-[#2a2a35] sm:inline-block" />}
                    </li>
                  ))}
                </ol>
              </section>

              <p className="flex items-center gap-2 text-xs text-[#7c7d94]">
                <ShieldCheck className="h-4 w-4 text-[#22c55e]" /> Garage never asks candidates to pay to apply.
              </p>
            </div>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="hidden lg:block">{applyCard}</div>
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 text-sm">
              <dl className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-[#7c7d94]">
                    <Briefcase className="h-3.5 w-3.5" /> Posted
                  </dt>
                  <dd className="text-white">{fmtDate(job.publishedAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-[#7c7d94]">
                    <Clock className="h-3.5 w-3.5" /> Closes
                  </dt>
                  <dd className="text-white">{job.closesAt ? fmtDate(job.closesAt) : "Open until filled"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-[#7c7d94]">
                    <Users className="h-3.5 w-3.5" /> Applicants
                  </dt>
                  <dd className="text-white">{job.applicants}</dd>
                </div>
                {job.locations[0] && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-[#7c7d94]">
                      <MapPin className="h-3.5 w-3.5" /> Location
                    </dt>
                    <dd className="truncate text-white">{job.locations.join(", ")}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="lg:hidden">{applyCard}</div>
          </aside>
        </div>
      </main>

      <PublicFooter org={org} />

      {job.isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1c1c24] bg-[#0c0c0e]/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{job.title}</p>
              <p className="text-[11px] text-[#7c7d94]">~{job.estimatedMinutes} min · Garage account required</p>
            </div>
            <button
              type="button"
              onClick={apply}
              className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black"
            >
              Apply now
            </button>
          </div>
        </div>
      )}

      {gateOpen && (
        <ApplyGate
          jobTitle={job.title}
          orgName={org?.name}
          referrerName={referrer ? referrer.name || referrer.affiliateId : null}
          workspaceUrl={workspaceUrl}
          referral={ref}
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}

/** C3 · Sign in to apply. Hands off to the existing /login → /verify flow. */
function ApplyGate({
  jobTitle,
  orgName,
  referrerName,
  workspaceUrl,
  referral,
  onClose,
}: {
  jobTitle: string;
  orgName?: string;
  referrerName: string | null;
  workspaceUrl: string;
  referral: string | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const continueWithEmail = () => {
    if (referral) {
      try {
        // Same key the login screen writes for `?ref=` links (components/welcome/Welcome.tsx).
        localStorage.setItem("referral_code", referral);
      } catch {
        /* private mode — the `ref` on the URL still carries it */
      }
    }
    window.location.href = loginUrl(workspaceUrl, referral);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-gate-title"
        className="relative w-full max-w-md rounded-t-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:bg-[#262626] hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="apply-gate-title" className="text-lg font-semibold text-white">
          Sign in to apply
        </h2>
        <p className="mt-1 text-sm text-[#7c7d94]">
          Your application, progress and interview invites live in your Garage account.
        </p>
        <p className="mt-3 text-xs text-[#c7c7da]">
          Applying for <span className="text-white">{jobTitle}</span>
          {orgName ? ` at ${orgName}` : ""}
        </p>

        <button
          type="button"
          onClick={continueWithEmail}
          className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-black transition-all hover:brightness-95"
        >
          Continue with email
        </button>

        {referrerName && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2.5 text-xs text-[#c7c7da]">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22c55e]" />
            New to Garage? We&apos;ll create a free account — the referral from {referrerName} is kept.
          </p>
        )}

        <p className="mt-4 text-[11px] leading-5 text-[#61627a]">
          By continuing, you agree to Garage&apos;s Terms and{" "}
          <Link href="/privacy" className="underline hover:text-white">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
