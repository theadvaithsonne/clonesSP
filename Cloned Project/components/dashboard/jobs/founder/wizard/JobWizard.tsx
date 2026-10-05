"use client";

// A3–A9 · "Post a job" — six steps over one draft posting.
//
// The draft exists from the moment the wizard opens (so nothing is lost), and
// every edit autosaves: changes collect in `pending` and flush 800 ms after the
// last keystroke, or immediately on Continue / step change / leaving. Nested
// objects (salary, description, reward…) are sent as partial patches; arrays
// (form, stages, team…) are sent whole.

import React from "react";
import { ArrowLeft, Check, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { JOB_PAGES } from "../../constants";
import { useJobsNav, useJobsNavStore } from "../../nav";
import { Button, ErrorState, GOLD, LoadingBlock, timeAgo, errorMessage } from "../../ui";
import type { Job, JobDetailResponse } from "../../types";
import StepBasics from "./StepBasics";
import StepDescription from "./StepDescription";
import StepForm from "./StepForm";
import StepPipeline from "./StepPipeline";
import StepReward from "./StepReward";
import StepPublish from "./StepPublish";
import JobPreviewModal from "./JobPreviewModal";

export const WIZARD_STEPS = [
  { n: 1, title: "Basics" },
  { n: 2, title: "Description" },
  { n: 3, title: "Application form" },
  { n: 4, title: "Pipeline & team" },
  { n: 5, title: "Referral reward" },
  { n: 6, title: "Publish" },
] as const;

const NESTED = new Set(["salary", "description", "education", "candidateEmails", "reward", "channels"]);

export type JobPatch = { [K in keyof Job]?: K extends "salary" | "description" | "education" | "candidateEmails" | "reward" | "channels" ? Partial<Job[K]> : Job[K] };

export interface StepProps {
  job: Job;
  detail: JobDetailResponse;
  update: (patch: JobPatch) => void;
  /** Save now and resolve once the server has the latest edits. */
  flush: () => Promise<boolean>;
  setDetail: React.Dispatch<React.SetStateAction<JobDetailResponse | null>>;
}

function stripHtml(html?: string) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
}

/** What stops the founder leaving a step. */
function stepProblem(step: number, job: Job): string | null {
  if (step === 1) {
    if (!job.title.trim()) return "Add a job title.";
    if (job.workplace !== "remote" && !job.locations.length) return "Add at least one location.";
    if (job.salary.min && job.salary.max && job.salary.min > job.salary.max) return "Salary minimum is higher than the maximum.";
    if (job.experienceMin != null && job.experienceMax != null && job.experienceMin > job.experienceMax) {
      return "Minimum experience is higher than the maximum.";
    }
  }
  if (step === 2 && !stripHtml(job.description.aboutRole)) return "Describe the role in “About the role”.";
  if (step === 3) {
    const answerable = job.form.pages.flatMap((p) => p.fields).filter((f) => !["section_heading", "info_text"].includes(f.type));
    if (!answerable.length) return "Add at least one field to the application form.";
    const emptyChoice = job.form.pages
      .flatMap((p) => p.fields)
      .find((f) => ["single_choice", "checkboxes", "dropdown", "ranking", "quiz_mcq"].includes(f.type) && f.options.length < 2);
    if (emptyChoice) return `“${emptyChoice.label || "A choice question"}” needs at least two options.`;
    const noAnswer = job.form.pages.flatMap((p) => p.fields).find((f) => f.type === "quiz_mcq" && !f.correctOptionId);
    if (noAnswer) return `Mark the correct answer for “${noAnswer.label || "a quiz question"}”.`;
  }
  if (step === 4) {
    if (!job.team.length) return "Add at least one person to the hiring team.";
  }
  if (step === 5) {
    if (job.reward.enabled && !(job.reward.amount > 0)) return "Set the reward per hire.";
  }
  return null;
}

export default function JobWizard() {
  const nav = useJobsNav();
  const wizardJobId = useJobsNavStore((s) => s.wizardJobId);
  const step = useJobsNavStore((s) => s.wizardStep);
  const setNav = useJobsNavStore((s) => s.set);

  const [detail, setDetail] = React.useState<JobDetailResponse | null>(null);
  const [job, setJob] = React.useState<Job | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [continuing, setContinuing] = React.useState(false);
  const [, tick] = React.useState(0);

  const creating = React.useRef(false);
  const pending = React.useRef<Record<string, unknown>>({});
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = React.useRef<Promise<boolean> | null>(null);
  const jobId = job?._id;

  // Load the draft, or create one when the wizard opens without an id.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!wizardJobId) {
          if (creating.current) return;
          creating.current = true;
          const res = await jobsApi.createJob();
          setNav({ wizardJobId: res.job._id, wizardStep: 1 });
          return;
        }
        setError(null);
        const d = await jobsApi.getJob(wizardJobId);
        if (cancelled) return;
        setDetail(d);
        setJob(d.job);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "Couldn't open this job."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wizardJobId, setNav]);

  // Keep "Saved · 2m ago" fresh.
  React.useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const flush = React.useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const body = pending.current;
    if (!jobId || !Object.keys(body).length) return true;
    pending.current = {};
    setSaveState("saving");
    const p = (async () => {
      try {
        const res = await jobsApi.updateJob(jobId, body);
        setJob((j) => (j ? { ...j, slug: res.job.slug, status: res.job.status } : j));
        setDetail((d) => (d ? { ...d, problems: res.problems } : d));
        setSaveState("saved");
        setSavedAt(new Date());
        return true;
      } catch (err) {
        setSaveState("error");
        toast.error(errorMessage(err, "Couldn't save your changes."));
        return false;
      }
    })();
    inflight.current = p;
    const ok = await p;
    inflight.current = null;
    return ok;
  }, [jobId]);

  // Save whatever is pending when leaving the wizard.
  const flushRef = React.useRef(flush);
  flushRef.current = flush;
  React.useEffect(() => () => void flushRef.current(), []);

  const update = React.useCallback(
    (patch: JobPatch) => {
      setJob((j) => {
        if (!j) return j;
        const current = j as unknown as Record<string, unknown>;
        const next: Record<string, unknown> = { ...current };
        for (const [k, v] of Object.entries(patch)) {
          next[k] = NESTED.has(k) && v && typeof v === "object" ? { ...(current[k] as object), ...v } : v;
        }
        return next as unknown as Job;
      });
      for (const [k, v] of Object.entries(patch)) {
        pending.current[k] =
          NESTED.has(k) && v && typeof v === "object" ? { ...((pending.current[k] as object) || {}), ...v } : v;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800);
    },
    [flush]
  );

  const goToStep = async (n: number) => {
    if (!job) return;
    if (n > step) {
      for (let s = step; s < n; s++) {
        const problem = stepProblem(s, job);
        if (problem) {
          toast.error(problem);
          setNav({ wizardStep: s });
          return;
        }
      }
    }
    await flush();
    setNav({ wizardStep: n });
  };

  const onContinue = async () => {
    if (!job) return;
    const problem = stepProblem(step, job);
    if (problem) {
      toast.error(problem);
      return;
    }
    setContinuing(true);
    update({ completedStep: Math.max(job.completedStep || 0, step) });
    const ok = await flush();
    setContinuing(false);
    if (ok) setNav({ wizardStep: Math.min(6, step + 1) });
  };

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={error} onRetry={() => setNav({ wizardJobId: null })} />
      </div>
    );
  }
  if (!job || !detail) return <LoadingBlock label="Opening the job…" />;

  const isDraft = job.status === "draft";
  const stepProps: StepProps = { job, detail, update, flush, setDetail };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-[#1c1c24] px-8 py-4">
        <button
          type="button"
          onClick={async () => {
            await flush();
            nav.go(JOB_PAGES.postings);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-[#7c7d94] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Postings
        </button>
        <span className="h-5 w-px bg-[#262626]" />
        <h1 className="text-lg font-semibold text-white">{isDraft ? "Post a job" : `Edit · ${job.title || "Untitled job"}`}</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[#61627a]">
            {saveState === "saving" ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : saveState === "error" ? (
              <span className="text-[#f87171]">Not saved</span>
            ) : savedAt ? (
              `${isDraft ? "Saved as draft" : "Changes saved"} · ${timeAgo(savedAt)}`
            ) : isDraft ? (
              "Draft"
            ) : null}
          </span>
          <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          {step < 6 && (
            <Button onClick={onContinue} loading={continuing}>
              Continue
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-56 shrink-0 border-r border-[#1c1c24] px-5 py-6 md:block">
          <ol className="space-y-1">
            {WIZARD_STEPS.map((s) => {
              const done = s.n < step || (s.n !== step && (job.completedStep || 0) >= s.n);
              const current = s.n === step;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.n)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        done ? "bg-[#22c55e] text-black" : current ? "text-black" : "border border-[#3a3a48] text-[#7c7d94]",
                      ].join(" ")}
                      style={current && !done ? { background: GOLD } : undefined}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm ${current ? "font-medium text-white" : done ? "text-[#c7c7da]" : "text-[#7c7d94]"}`}>
                        {s.title}
                      </span>
                      <span className="block text-[11px]" style={{ color: current ? GOLD : "#61627a" }}>
                        {current ? "In progress" : done ? "Complete" : "Upcoming"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {step === 1 && <StepBasics {...stepProps} />}
          {step === 2 && <StepDescription {...stepProps} />}
          {step === 3 && <StepForm {...stepProps} />}
          {step === 4 && <StepPipeline {...stepProps} />}
          {step === 5 && <StepReward {...stepProps} />}
          {step === 6 && <StepPublish {...stepProps} onEditStep={(n) => goToStep(n)} />}
        </div>
      </div>

      <JobPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} job={job} org={detail.org} />
    </div>
  );
}
