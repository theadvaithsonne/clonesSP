"use client";

// B3 / B4 · Applying for a job. One form page at a time with the office's own
// questions, profile answers prefilled from Garage, autosave to a draft
// ("Save and finish later" resumes it), timed pages with a countdown, and
// per-field errors from both this screen and the server. Submitting shows B4.
//
// The countdown is a guide: the server does not enforce time limits, so the
// page never locks — a required answer can always still be given.

import React from "react";
import { AlertCircle, ArrowLeft, Check, Clock, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import { JobsApiError } from "../api";
import { LAYOUT_TYPES } from "../constants";
import FormRenderer, { fieldState, type AnswerMap } from "../shared/FormRenderer";
import { Button, Card, ErrorState, GOLD, LoadingBlock, OrgLogo, errorMessage, formatDate } from "../ui";
import type { Answer, AnswerFile, FormField, FormPage } from "../types";
import { BOARD_PAGES, referralFor, useBoardNav, useBoardStore } from "./boardNav";
import * as candidateApi from "./candidateApi";
import type { ApplyResponse, JobViewResponse } from "./candidateTypes";
import { placeText, processLabel } from "./shared";

const PREFILL_TYPES: Record<string, keyof ApplyResponse["prefill"]> = {
  profile_full_name: "profile_full_name",
  profile_email: "profile_email",
  profile_phone: "profile_phone",
  profile_location: "profile_location",
};

const FILE_FIELD_TYPES = new Set(["resume", "file_upload", "video_answer"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+/i;

function isEmpty(f: FormField, a?: Answer): boolean {
  if (!a) return true;
  if (FILE_FIELD_TYPES.has(f.type)) return !a.files?.length;
  const v = a.value;
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (f.type === "declaration") return v !== true;
  return false;
}

/** Same rules as the server's validateAnswers, for instant feedback. */
function validatePage(page: FormPage, answers: AnswerMap, byId: Map<string, FormField>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of page.fields) {
    if (LAYOUT_TYPES.includes(f.type)) continue;
    const { visible, required } = fieldState(f, answers, byId);
    if (!visible) continue;
    const a = answers[f.id];
    if (isEmpty(f, a)) {
      if (required) {
        errors[f.id] =
          f.type === "declaration"
            ? "Please confirm to continue."
            : FILE_FIELD_TYPES.has(f.type)
              ? `${f.label || "This file"} is required.`
              : `${f.label || "This field"} is required.`;
      }
      continue;
    }
    const v = a!.value;
    if ((f.type === "email" || f.type === "profile_email") && !EMAIL_RE.test(String(v).trim())) errors[f.id] = "Enter a valid email address.";
    else if ((f.type === "url" || f.type === "portfolio_link" || f.type === "profile_linkedin") && !URL_RE.test(String(v).trim())) {
      errors[f.id] = "Enter a full link starting with https://";
    } else if (f.maxLength && typeof v === "string" && v.length > f.maxLength) errors[f.id] = `Keep it under ${f.maxLength} characters.`;
  }
  return errors;
}

const timerKey = (jobId: string, pageId: string) => `garage-job-board:timer:${jobId}:${pageId}`;

export default function ApplyFlow() {
  const nav = useBoardNav();
  const jobId = useBoardStore((s) => s.applyJobId);
  const { startUpload } = useUploadThing("postDocuments");

  const [data, setData] = React.useState<ApplyResponse | null>(null);
  const [view, setView] = React.useState<JobViewResponse | null>(null);
  const [blocked, setBlocked] = React.useState<{ kind: "applied" | "closed" | "error"; message: string } | null>(null);
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [prefilled, setPrefilled] = React.useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<{ reference: string; appliedAt: string } | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const dirty = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = React.useRef({ answers, pageIndex });
  latest.current = { answers, pageIndex };

  const load = React.useCallback(async () => {
    if (!jobId) return;
    setBlocked(null);
    setData(null);
    try {
      const [apply, jobView] = await Promise.all([
        candidateApi.getApply(jobId),
        candidateApi.getJobView(jobId).catch(() => null),
      ]);
      const pages = apply.job.form.pages || [];
      const initial: AnswerMap = {};
      for (const a of apply.draft?.answers || []) initial[a.fieldId] = { fieldId: a.fieldId, value: a.value, files: a.files || [] };
      const pre = new Set<string>();
      for (const f of pages.flatMap((p) => p.fields)) {
        const key = PREFILL_TYPES[f.type];
        if (!key || initial[f.id]) continue;
        const v = apply.prefill[key];
        if (v) {
          initial[f.id] = { fieldId: f.id, value: v, files: [] };
          pre.add(f.id);
        }
      }
      setAnswers(initial);
      setPrefilled(pre);
      setPageIndex(Math.min(Math.max(0, apply.draft?.furthestPage || 0), Math.max(0, pages.length - 1)));
      setData(apply);
      setView(jobView);
      dirty.current = false;
    } catch (err) {
      if (err instanceof JobsApiError && err.status === 409) setBlocked({ kind: "applied", message: "You've already applied for this job." });
      else if (err instanceof JobsApiError && err.status === 410) setBlocked({ kind: "closed", message: "This job is no longer accepting applications." });
      else setBlocked({ kind: "error", message: errorMessage(err, "Couldn't open the application.") });
    }
  }, [jobId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const pages = React.useMemo(() => data?.job.form.pages || [], [data]);
  const page = pages[pageIndex];
  const allFields = React.useMemo(() => pages.flatMap((p) => p.fields), [pages]);
  const byId = React.useMemo(() => new Map(allFields.map((f) => [f.id, f])), [allFields]);

  const saveDraft = React.useCallback(async () => {
    if (!jobId || !dirty.current || submitted) return true;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaveState("saving");
    try {
      const { ref, source } = referralFor(jobId);
      await candidateApi.saveApplyDraft(jobId, {
        answers: Object.values(latest.current.answers),
        page: latest.current.pageIndex,
        ref,
        source,
      });
      dirty.current = false;
      setSaveState("saved");
      return true;
    } catch (err) {
      setSaveState("error");
      if (err instanceof JobsApiError && err.status === 409) setBlocked({ kind: "applied", message: "You've already applied for this job." });
      else if (err instanceof JobsApiError && err.status === 410) setBlocked({ kind: "closed", message: "This job is no longer accepting applications." });
      return false;
    }
  }, [jobId, submitted]);

  // Leaving the page keeps the draft.
  const saveRef = React.useRef(saveDraft);
  saveRef.current = saveDraft;
  React.useEffect(() => () => void saveRef.current(), []);

  const change = (fieldId: string, patch: Partial<Answer>) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [fieldId]: { fieldId, files: [], ...(a[fieldId] || {}), ...patch } }));
    setErrors((e) => {
      if (!e[fieldId]) return e;
      const next = { ...e };
      delete next[fieldId];
      return next;
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveDraft(), 1500);
  };

  const upload = React.useCallback(
    async (file: File): Promise<AnswerFile> => {
      const res = await startUpload([file]);
      const r = res?.[0];
      if (!r?.url) throw new Error("Upload failed — try again.");
      return { url: r.url, name: file.name, size: file.size, type: file.type || undefined };
    },
    [startUpload]
  );

  // Timed pages: start the clock the first time the page opens.
  const timeLimit = page?.timeLimitMinutes || 0;
  React.useEffect(() => {
    if (!jobId || !page || !timeLimit || submitted) return;
    const key = timerKey(jobId, page.id);
    try {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* countdown just won't survive a reload */
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [jobId, page, timeLimit, submitted]);

  let remainingMs: number | null = null;
  if (jobId && page && timeLimit) {
    let started = now;
    try {
      started = Number(sessionStorage.getItem(timerKey(jobId, page.id))) || now;
    } catch {
      /* ignore */
    }
    remainingMs = Math.max(0, started + timeLimit * 60000 - now);
  }
  const timeUp = remainingMs === 0;

  const goNext = async () => {
    if (!page) return;
    const pageErrors = validatePage(page, answers, byId);
    if (Object.keys(pageErrors).length) {
      setErrors(pageErrors);
      toast.error("Some answers need attention.");
      return;
    }
    setErrors({});
    setPageIndex((i) => Math.min(pages.length - 1, i + 1));
    dirty.current = true;
    setTimeout(() => void saveDraft(), 0);
  };

  const submit = async () => {
    if (!jobId || !data) return;
    // Check every page first and jump to the first one with a problem.
    for (let i = 0; i < pages.length; i++) {
      const errs = validatePage(pages[i], answers, byId);
      if (Object.keys(errs).length) {
        setErrors(errs);
        setPageIndex(i);
        toast.error("Some answers need attention.");
        return;
      }
    }
    setSubmitting(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const { ref, source } = referralFor(jobId);
      const res = await candidateApi.submitApplication(jobId, { answers: Object.values(answers), ref, source });
      dirty.current = false;
      try {
        for (const p of pages) sessionStorage.removeItem(timerKey(jobId, p.id));
      } catch {
        /* ignore */
      }
      setSubmitted({ reference: res.application.reference, appliedAt: res.application.appliedAt });
    } catch (err) {
      if (err instanceof JobsApiError && err.status === 422 && err.data.errors && typeof err.data.errors === "object") {
        const serverErrors = err.data.errors as Record<string, string>;
        setErrors(serverErrors);
        const first = pages.findIndex((p) => p.fields.some((f) => serverErrors[f.id]));
        if (first >= 0) setPageIndex(first);
        toast.error("Some answers need attention.");
      } else if (err instanceof JobsApiError && err.status === 409) {
        setBlocked({ kind: "applied", message: "You've already applied for this job." });
      } else if (err instanceof JobsApiError && err.status === 410) {
        setBlocked({ kind: "closed", message: "This job is no longer accepting applications." });
      } else {
        toast.error(errorMessage(err, "Couldn't submit your application."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!jobId) {
    return (
      <div className="p-8">
        <ErrorState message="No job selected." onRetry={() => nav.go(BOARD_PAGES.discover)} />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-[#7c7d94]" />
          <p className="mt-3 text-sm text-white">{blocked.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            {blocked.kind === "applied" ? (
              <Button onClick={() => nav.openApplications("active")}>Go to My Applications</Button>
            ) : blocked.kind === "closed" ? (
              <Button onClick={() => nav.go(BOARD_PAGES.discover)}>See other roles</Button>
            ) : (
              <Button onClick={load}>Try again</Button>
            )}
            <Button variant="secondary" onClick={() => nav.openJob(jobId)}>
              Back to job
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return <LoadingBlock label="Opening the application…" />;

  const job = data.job;
  const org = job.org;

  if (submitted) {
    const next = (view?.job.process || []).filter((c) => c !== "applied");
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]">
              <Check className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold text-white">Application sent</h1>
            <p className="mt-1 text-sm text-[#7c7d94]">
              {org?.name || "The team"} will review it soon. You&apos;ll get updates here and by email.
            </p>
          </div>
          <Card className="flex items-center gap-4 p-5">
            <OrgLogo name={org?.name} src={org?.icon} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{job.title}</div>
              <div className="truncate text-xs text-[#7c7d94]">{[org?.name, placeText(job)].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="text-right text-xs text-[#7c7d94]">
              <div>Applied {formatDate(submitted.appliedAt)}</div>
              <div className="text-[#c7c7da]">{submitted.reference}</div>
            </div>
          </Card>
          {next.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold text-white">What happens next</div>
              <ol className="space-y-3">
                {next.map((c, i) => (
                  <li key={c} className="flex items-center gap-3 text-sm text-[#c7c7da]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#3a3a48] text-[11px] text-[#7c7d94]">{i + 1}</span>
                    {processLabel(c)}
                  </li>
                ))}
              </ol>
            </Card>
          )}
          <div className="flex justify-center gap-2">
            <Button onClick={() => nav.openApplications("active")}>Track application</Button>
            <Button variant="secondary" onClick={() => nav.go(BOARD_PAGES.discover)}>
              Browse more jobs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!pages.length || !page) {
    return (
      <div className="p-8">
        <ErrorState message="This job's application form isn't set up yet." onRetry={() => nav.openJob(jobId)} />
      </div>
    );
  }

  const last = pageIndex === pages.length - 1;
  const hasPrefill = page.fields.some((f) => prefilled.has(f.id));
  const mins = remainingMs !== null ? Math.floor(remainingMs / 60000) : 0;
  const secs = remainingMs !== null ? Math.floor((remainingMs % 60000) / 1000) : 0;

  return (
    <>
      <header className="flex flex-wrap items-center gap-4 border-b border-[#1c1c24] px-8 py-4">
        <button
          type="button"
          onClick={async () => {
            await saveDraft();
            nav.openJob(jobId);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-[#7c7d94] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to job
        </button>
        <span className="h-5 w-px bg-[#262626]" />
        <OrgLogo name={org?.name} src={org?.icon} size={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{job.title}</div>
          <div className="truncate text-xs text-[#7c7d94]">{[org?.name, job.locations[0]].filter(Boolean).join(" · ")}</div>
        </div>
        <span className="ml-auto text-xs text-[#61627a]">
          {saveState === "saving" ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : saveState === "saved" ? (
            "Changes saved"
          ) : saveState === "error" ? (
            <span className="text-[#f87171]">Not saved</span>
          ) : null}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl">
          <ol className="mb-6 flex flex-wrap gap-2">
            {pages.map((p, i) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs"
                style={
                  i === pageIndex
                    ? { borderColor: GOLD, color: "#fff", background: "color-mix(in srgb, var(--brand) 8%, transparent)" }
                    : { borderColor: "#262626", color: i < pageIndex ? "#c7c7da" : "#61627a" }
                }
              >
                {i < pageIndex ? <Check className="h-3 w-3 text-[#22c55e]" /> : <span>{i + 1}</span>}
                {p.title || `Page ${i + 1}`}
              </li>
            ))}
          </ol>

          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                Step {pageIndex + 1} of {pages.length}
              </div>
              <h1 className="mt-1 text-xl font-semibold text-white">{page.title || `Page ${pageIndex + 1}`}</h1>
              {page.description && <p className="mt-1 text-sm text-[#7c7d94]">{page.description}</p>}
            </div>
            {remainingMs !== null && (
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm tabular-nums"
                style={
                  remainingMs < 60000
                    ? { borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }
                    : { borderColor: "#262626", color: "#c7c7da" }
                }
              >
                <Clock className="h-4 w-4" />
                {timeUp ? "Time's up — finish and continue" : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} left`}
              </span>
            )}
          </div>

          {hasPrefill && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#1e3a5f] bg-[#0f1b2d] px-4 py-3 text-sm text-[#93c5fd]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              We pulled these details from your Garage profile. Review anything that has changed.
            </div>
          )}

          <Card className="p-6">
            <FormRenderer
              page={page}
              allFields={allFields}
              answers={answers}
              onChange={change}
              errors={errors}
              onUpload={upload}
              prefilledIds={prefilled}
            />
            {last && data.consent.addition && (
              <p className="mt-5 whitespace-pre-line rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-xs leading-5 text-[#c7c7da]">
                {data.consent.addition}
              </p>
            )}
          </Card>

          {pageIndex === 0 && (
            <p className="mt-4 text-xs text-[#61627a]">
              Your profile stays yours — {org?.name || "the office"} receives only the information you submit with this application.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={async () => {
                dirty.current = true;
                if (await saveDraft()) {
                  toast.success("Draft saved — continue any time from My Applications");
                  nav.openApplications("drafts");
                }
              }}
            >
              Save and finish later
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={pageIndex === 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
                Back
              </Button>
              {last ? (
                <Button onClick={submit} loading={submitting}>
                  Submit application
                </Button>
              ) : (
                <Button onClick={goNext}>Next</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
