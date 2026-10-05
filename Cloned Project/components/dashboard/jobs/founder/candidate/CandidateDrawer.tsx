"use client";

// A12 · Candidate profile drawer — used by the pipeline, Applications, the
// Talent Pool and Payouts. Header: who they are, where they came from, match,
// stage and the next move. Tabs: Application answers, Resume, Interviews,
// Activity, Notes. Footer: schedule interview, reject, offer / next stage.

import React from "react";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Star,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { CATEGORY_META, SOURCE_LABELS, FILE_TYPES, LAYOUT_TYPES } from "../../constants";
import { useJobsNav } from "../../nav";
import {
  Avatar,
  Button,
  Chip,
  Drawer,
  GOLD,
  LoadingBlock,
  MatchScore,
  UnderlineTabs,
  errorMessage,
  formatDate,
  formatDateTime,
  meetingLink,
  timeAgo,
  useLoad,
} from "../../ui";
import type { Answer, CandidateProfileResponse, FormField, Interview } from "../../types";
import RejectModal from "./RejectModal";
import ScheduleInterviewModal from "./ScheduleInterviewModal";
import OfferDrawer from "./OfferDrawer";
import HireModal from "./HireModal";

export interface CandidateDrawerProps {
  /** Application to show; null closes the drawer. */
  applicationId: string | null;
  onClose: () => void;
  /** Called after anything that changes the application (move, reject, hire…). */
  onChanged?: () => void;
  /** Ordered ids of the list the drawer was opened from — enables "‹ 4 of 95 ›". */
  siblings?: string[];
  /** Switch the drawer to another application in `siblings`. */
  onSelect?: (applicationId: string) => void;
  /** Open an action as soon as the profile loads (e.g. "hire" after a drop on Hired). */
  initialAction?: "hire" | "offer" | "interview" | "reject" | null;
}

type Tab = "application" | "resume" | "interviews" | "activity" | "notes";

const RECOMMENDATION_LABEL: Record<string, string> = {
  strong_no: "Strong no",
  no: "No",
  yes: "Yes",
  strong_yes: "Strong yes",
};

function formatAnswer(field: FormField, a?: Answer): React.ReactNode {
  if (!a) return <span className="text-[#61627a]">No answer</span>;
  if (FILE_TYPES.includes(field.type)) {
    if (!a.files?.length) return <span className="text-[#61627a]">No file</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {a.files.map((f, i) => (
          <a
            key={`${f.url}-${i}`}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#1A1A1A] px-2.5 py-1 text-xs text-[#c7c7da] hover:text-white"
          >
            <FileText className="h-3.5 w-3.5" /> {f.name}
          </a>
        ))}
      </div>
    );
  }
  const v = a.value;
  if (v === undefined || v === null || v === "") return <span className="text-[#61627a]">No answer</span>;
  const label = (id: unknown) => field.options.find((o) => o.id === id)?.label ?? String(id);
  switch (field.type) {
    case "single_choice":
    case "dropdown":
      return label(v);
    case "quiz_mcq": {
      const correct = field.correctOptionId && v === field.correctOptionId;
      return (
        <span className="inline-flex items-center gap-2">
          {label(v)}
          <span className={`text-[11px] ${correct ? "text-[#4ade80]" : "text-[#f87171]"}`}>{correct ? "Correct" : "Incorrect"}</span>
        </span>
      );
    }
    case "checkboxes":
      return Array.isArray(v) ? v.map(label).join(", ") : label(v);
    case "ranking":
      return Array.isArray(v) ? (
        <ol className="ml-4 list-decimal">
          {v.map((id) => (
            <li key={String(id)}>{label(id)}</li>
          ))}
        </ol>
      ) : (
        String(v)
      );
    case "yes_no":
      return v === "yes" || v === true ? "Yes" : "No";
    case "rating":
      return `${v} / ${field.scaleMax || 5}`;
    case "declaration":
      return v === true ? (
        <span className="inline-flex items-center gap-1 text-[#4ade80]">
          <Check className="h-3.5 w-3.5" /> Agreed
        </span>
      ) : (
        "Not agreed"
      );
    case "url":
    case "portfolio_link":
    case "profile_linkedin":
      return (
        <a href={String(v)} target="_blank" rel="noreferrer" className="break-all hover:underline" style={{ color: GOLD }}>
          {String(v)}
        </a>
      );
    default:
      return <span className="whitespace-pre-wrap">{String(v)}</span>;
  }
}

export default function CandidateDrawer({ applicationId, onClose, onChanged, siblings, onSelect, initialAction }: CandidateDrawerProps) {
  const nav = useJobsNav();
  const [data, setData] = React.useState<CandidateProfileResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("application");
  const [modal, setModal] = React.useState<null | "reject" | "interview" | "offer" | "hire">(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(
    async (silent = false) => {
      if (!applicationId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        setData(await jobsApi.getCandidateProfile(applicationId));
      } catch (err) {
        setError(errorMessage(err, "Couldn't load this candidate."));
      } finally {
        setLoading(false);
      }
    },
    [applicationId]
  );

  React.useEffect(() => {
    if (!applicationId) {
      setData(null);
      return;
    }
    setTab("application");
    setModal(null);
    load();
  }, [applicationId, load]);

  // Run the requested action once, as soon as this application's profile is in.
  const actedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!initialAction || !data || data.application._id !== applicationId) return;
    if (actedFor.current === applicationId) return;
    actedFor.current = applicationId;
    if (data.application.status === "active") setModal(initialAction);
  }, [initialAction, data, applicationId]);

  const changed = React.useCallback(() => {
    load(true);
    onChanged?.();
  }, [load, onChanged]);

  const index = siblings && applicationId ? siblings.indexOf(applicationId) : -1;
  const app = data?.application;
  const job = data?.job;
  const stage = job?.stages.find((s) => s.id === app?.stageId);
  const stageIndex = job ? job.stages.findIndex((s) => s.id === app?.stageId) : -1;
  const next = job && stageIndex >= 0 ? job.stages[stageIndex + 1] : undefined;
  const active = app?.status === "active";

  const move = async (stageId: string) => {
    if (!app) return;
    setBusy(true);
    try {
      await jobsApi.moveApplication(app._id, { stageId });
      toast.success(`Moved to ${job?.stages.find((s) => s.id === stageId)?.name}`);
      changed();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't move the candidate."));
    } finally {
      setBusy(false);
    }
  };

  const header = data && app && job && (
    <div className="mt-1">
      <div className="flex items-start gap-4">
        <Avatar name={data.candidate.name} src={data.candidate.avatar} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{data.candidate.name}</h2>
            <button
              type="button"
              onClick={async () => {
                try {
                  await jobsApi.updateApplication(app._id, { starred: !app.starred });
                  changed();
                } catch (err) {
                  toast.error(errorMessage(err, "Couldn't update."));
                }
              }}
              aria-label={app.starred ? "Unstar" : "Star"}
            >
              <Star className="h-4 w-4" style={{ color: app.starred ? GOLD : "#4f5065", fill: app.starred ? GOLD : "none" }} />
            </button>
          </div>
          <p className="truncate text-sm text-[#c7c7da]">
            {[
              [data.candidate.title, data.candidate.company].filter(Boolean).join(" at "),
              data.candidate.location,
              app.profile?.experienceYears !== undefined ? `${app.profile.experienceYears} yrs` : "",
            ]
              .filter(Boolean)
              .join(" · ") || data.candidate.email}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: data.referral ? GOLD : "#7c7d94" }}>
            {data.referral
              ? `● Referral · ${data.referral.name} (${data.referral.affiliateId})`
              : `${SOURCE_LABELS[app.source] || app.source} · applied ${formatDate(app.appliedAt)}`}
          </p>
        </div>
        <MatchScore score={app.matchScore} size="lg" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {active ? (
          <select
            value={app.stageId}
            disabled={busy}
            onChange={(e) => {
              const target = job.stages.find((s) => s.id === e.target.value);
              if (target?.category === "hired") setModal("hire");
              else if (target) move(target.id);
            }}
            className="rounded-lg border bg-[#141414] px-3 py-1.5 text-xs text-white outline-none [&>option]:bg-[#141414]"
            style={{ borderColor: GOLD }}
          >
            {job.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span
            className="rounded-lg px-3 py-1.5 text-xs"
            style={{
              background: app.status === "hired" ? "rgba(34,197,94,0.12)" : "rgba(248,113,113,0.12)",
              color: app.status === "hired" ? "#4ade80" : "#f87171",
            }}
          >
            {app.status === "hired"
              ? `Hired${app.joiningDate ? ` · joins ${formatDate(app.joiningDate)}` : ""}`
              : app.status === "withdrawn"
                ? "Withdrawn by candidate"
                : `Rejected${app.rejection?.reason ? ` · ${app.rejection.reason}` : ""}`}
          </span>
        )}
        {stage && (
          <span className="text-[11px] text-[#7c7d94]">
            {CATEGORY_META[stage.category].label} stage
          </span>
        )}
        {app.status === "rejected" && (
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs"
            onClick={async () => {
              try {
                await jobsApi.restoreApplication(app._id);
                toast.success("Restored to the pipeline");
                changed();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't restore."));
              }
            }}
          >
            Restore
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {app.tags.map((t) => (
            <Chip
              key={t}
              onRemove={async () => {
                try {
                  await jobsApi.updateApplication(app._id, { tags: app.tags.filter((x) => x !== t) });
                  changed();
                } catch (err) {
                  toast.error(errorMessage(err, "Couldn't update tags."));
                }
              }}
            >
              {t}
            </Chip>
          ))}
          <TagAdder
            onAdd={async (t) => {
              try {
                await jobsApi.updateApplication(app._id, { tags: [...app.tags, t] });
                changed();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't update tags."));
              }
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Drawer
        open={!!applicationId}
        onClose={onClose}
        width={640}
        title={
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-[#7c7d94]">
            Candidate profile
            {siblings && index >= 0 && siblings.length > 1 && (
              <span className="flex items-center gap-1 font-normal normal-case tracking-normal">
                <button
                  type="button"
                  disabled={index <= 0}
                  onClick={() => onSelect?.(siblings[index - 1])}
                  className="rounded p-0.5 hover:bg-[#1f1f28] disabled:opacity-30"
                  aria-label="Previous candidate"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {index + 1} of {siblings.length}
                <button
                  type="button"
                  disabled={index >= siblings.length - 1}
                  onClick={() => onSelect?.(siblings[index + 1])}
                  className="rounded p-0.5 hover:bg-[#1f1f28] disabled:opacity-30"
                  aria-label="Next candidate"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </span>
            )}
          </div>
        }
        headerExtra={header}
        footer={
          data && app && job && active ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => setModal("interview")}>
                <CalendarClock className="h-4 w-4" /> Schedule interview
              </Button>
              <Button variant="secondary" onClick={() => setModal("offer")}>
                Offer
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="danger" onClick={() => setModal("reject")}>
                  Reject
                </Button>
                {next && (
                  <Button loading={busy} onClick={() => (next.category === "hired" ? setModal("hire") : move(next.id))}>
                    {next.category === "hired" ? "Mark as hired" : `Move to ${next.name}`}
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {loading && !data ? (
          <LoadingBlock />
        ) : error ? (
          <div className="px-6 py-10 text-center text-sm text-[#f87171]">{error}</div>
        ) : data && app && job ? (
          <div>
            <div className="sticky top-0 z-10 border-b border-[#1c1c24] bg-[#101012] px-6 pt-3">
              <UnderlineTabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "application", label: "Application" },
                  { value: "resume", label: "Resume" },
                  { value: "interviews", label: "Interviews", count: data.interviews.length || undefined },
                  { value: "activity", label: "Activity" },
                  { value: "notes", label: "Notes", count: data.notes.length || undefined },
                ]}
              />
            </div>
            <div className="px-6 py-5">
              {tab === "application" && <ApplicationTab data={data} />}
              {tab === "resume" && <ResumeTab data={data} />}
              {tab === "interviews" && (
                <InterviewsTab
                  interviews={data.interviews}
                  onSchedule={active ? () => setModal("interview") : undefined}
                  onOpenScorecard={(id) => nav.openScorecard(id)}
                  onChanged={changed}
                />
              )}
              {tab === "activity" && <ActivityTab data={data} />}
              {tab === "notes" && <NotesTab data={data} onPosted={() => load(true)} />}
            </div>
          </div>
        ) : null}
      </Drawer>

      {data && app && job && (
        <>
          <RejectModal
            open={modal === "reject"}
            applicationId={app._id}
            candidateName={data.candidate.name}
            onClose={() => setModal(null)}
            onDone={() => {
              setModal(null);
              changed();
            }}
          />
          <ScheduleInterviewModal
            open={modal === "interview"}
            applicationId={app._id}
            candidateName={data.candidate.name}
            jobTitle={job.title}
            stages={job.stages}
            currentStageId={app.stageId}
            team={job.team}
            onClose={() => setModal(null)}
            onDone={() => {
              setModal(null);
              setTab("interviews");
              changed();
            }}
          />
          <OfferDrawer
            open={modal === "offer"}
            applicationId={app._id}
            candidate={{ name: data.candidate.name, avatar: data.candidate.avatar, title: data.candidate.title, matchScore: app.matchScore }}
            jobTitle={job.title}
            offers={data.offers}
            onClose={() => setModal(null)}
            onDone={() => {
              setModal(null);
              changed();
            }}
          />
          <HireModal
            open={modal === "hire"}
            applicationId={app._id}
            candidate={{ name: data.candidate.name, avatar: data.candidate.avatar, matchScore: app.matchScore }}
            jobTitle={job.title}
            reward={job.reward}
            referral={data.referral}
            onClose={() => setModal(null)}
            onDone={() => {
              setModal(null);
              changed();
            }}
          />
        </>
      )}
    </>
  );
}

function TagAdder({ onAdd }: { onAdd: (tag: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-dashed border-[#2a2a35] px-2 py-1 text-[11px] text-[#7c7d94] hover:text-white">
        + Tag
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        setOpen(false);
        setValue("");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) {
          onAdd(value.trim());
          setValue("");
          setOpen(false);
        } else if (e.key === "Escape") setOpen(false);
      }}
      placeholder="Tag"
      className="w-24 rounded-lg border border-[#2a2a35] bg-[#141418] px-2 py-1 text-[11px] text-white outline-none"
    />
  );
}

function ApplicationTab({ data }: { data: CandidateProfileResponse }) {
  const app = data.application;
  const pages = data.job?.form.pages || [];
  const answers = new Map(app.answers.map((a) => [a.fieldId, a]));
  const chips = [
    app.profile?.expectedCtc && `Expected CTC · ${app.profile.expectedCtc}`,
    app.profile?.currentCtc && `Current CTC · ${app.profile.currentCtc}`,
    app.profile?.noticePeriod && `Notice period · ${app.profile.noticePeriod}`,
    app.profile?.phone && `Phone · ${app.profile.phone}`,
  ].filter(Boolean) as string[];
  const knockoutField = app.knockout?.triggered ? pages.flatMap((p) => p.fields).find((f) => f.id === app.knockout?.fieldId) : null;

  return (
    <div className="space-y-5">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
      )}
      {app.knockout?.triggered && (
        <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/5 px-4 py-3 text-sm text-[#fca5a5]">
          Knockout: “{knockoutField?.label || "a screening question"}”{app.knockout.reason ? ` · ${app.knockout.reason}` : ""}
        </div>
      )}
      {(app.quiz || app.matchedSkills.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {app.quiz && (
            <span className={`rounded-lg px-2.5 py-1 text-xs ${app.quiz.passed ? "bg-[#22c55e]/10 text-[#4ade80]" : "bg-[#f87171]/10 text-[#f87171]"}`}>
              Quiz {app.quiz.score}/{app.quiz.total} · {app.quiz.passed ? "passed" : "not passed"}
            </span>
          )}
          {app.matchedSkills.map((s) => (
            <Chip key={s}>
              <Check className="h-3 w-3" style={{ color: GOLD }} /> {s}
            </Chip>
          ))}
        </div>
      )}
      {pages.map((p) => {
        const fields = p.fields.filter((f) => !LAYOUT_TYPES.includes(f.type));
        if (!fields.length) return null;
        return (
          <section key={p.id} className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#7c7d94]">{p.title || "Page"}</div>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.id}>
                  <div className="text-xs text-[#7c7d94]">{f.label}</div>
                  <div className="mt-0.5 text-sm text-white">{formatAnswer(f, answers.get(f.id))}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-xs text-[#61627a]">
        {app.reference} · applied {formatDate(app.appliedAt)} via {SOURCE_LABELS[app.source] || app.source}
        {app.talentPoolConsent ? " · in your talent pool" : ""}
      </p>
    </div>
  );
}

function ResumeTab({ data }: { data: CandidateProfileResponse }) {
  const resume = data.application.resume;
  const otherFiles = data.application.answers.flatMap((a) => a.files || []).filter((f) => f.url !== resume?.url);
  if (!resume && !otherFiles.length) return <p className="py-10 text-center text-sm text-[#7c7d94]">No resume or files were attached.</p>;
  const isPdf = resume && /\.pdf($|\?)/i.test(resume.url || resume.name);
  return (
    <div className="space-y-4">
      {resume && (
        <div className="overflow-hidden rounded-2xl border border-[#262626]">
          <div className="flex items-center gap-3 border-b border-[#262626] bg-[#141414] px-4 py-2.5">
            <FileText className="h-4 w-4 text-[#7c7d94]" />
            <span className="min-w-0 flex-1 truncate text-sm text-white">{resume.name}</span>
            <a href={resume.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: GOLD }}>
              Open <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {isPdf ? (
            <iframe src={resume.url} title="Resume" className="h-[70vh] w-full bg-white" />
          ) : (
            <p className="px-4 py-6 text-sm text-[#7c7d94]">This file type can&apos;t be previewed here — open it to read.</p>
          )}
        </div>
      )}
      {otherFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7c7d94]">Other files</div>
          {otherFiles.map((f, i) => (
            <a
              key={`${f.url}-${i}`}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#141414] px-4 py-2.5 text-sm text-[#c7c7da] hover:text-white"
            >
              <FileText className="h-4 w-4" /> {f.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewsTab({
  interviews,
  onSchedule,
  onOpenScorecard,
  onChanged,
}: {
  interviews: Interview[];
  onSchedule?: () => void;
  onOpenScorecard: (id: string) => void;
  onChanged: () => void;
}) {
  const [cancelling, setCancelling] = React.useState<string | null>(null);
  if (!interviews.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-[#7c7d94]">No interviews yet.</p>
        {onSchedule && (
          <Button className="mt-4" variant="secondary" onClick={onSchedule}>
            <CalendarClock className="h-4 w-4" /> Schedule interview
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {interviews.map((iv) => {
        const submitted = iv.scorecards || [];
        const avg = submitted.length
          ? submitted.reduce((s, c) => s + (c.ratings.length ? c.ratings.reduce((x, r) => x + r.score, 0) / c.ratings.length : 0), 0) / submitted.length
          : null;
        return (
          <div key={iv._id} className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7c7d94]">
                  {iv.roundLabel} · {iv.status.replace("_", " ")}
                </div>
                <div className="mt-1 text-sm text-white">
                  {iv.scheduledAt
                    ? `${formatDateTime(iv.scheduledAt)} · ${iv.durationMin} min`
                    : iv.status === "awaiting_candidate"
                      ? `Waiting for the candidate to pick one of ${iv.slots.length} slots`
                      : "Not scheduled"}
                </div>
                <div className="text-xs text-[#7c7d94]">
                  {[iv.interviewers?.map((p) => p.name).join(", "), iv.mode === "video" ? "Garage video" : iv.mode === "phone" ? "Phone" : iv.location || "In person"]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {iv.meetingUrl && iv.status === "scheduled" && (
                  <a href={meetingLink(iv.meetingUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: GOLD }}>
                    <Video className="h-3.5 w-3.5" /> Join call
                  </a>
                )}
                {(iv.status === "scheduled" || iv.status === "awaiting_candidate") && (
                  <button
                    type="button"
                    disabled={cancelling === iv._id}
                    onClick={async () => {
                      setCancelling(iv._id);
                      try {
                        await jobsApi.updateInterview(iv._id, { status: "cancelled" });
                        toast.success("Interview cancelled");
                        onChanged();
                      } catch (err) {
                        toast.error(errorMessage(err, "Couldn't cancel."));
                      } finally {
                        setCancelling(null);
                      }
                    }}
                    className="text-xs text-[#7c7d94] hover:text-[#f87171]"
                  >
                    {cancelling === iv._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
            {submitted.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-[#1f1f24] pt-3 text-xs">
                {submitted.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[#c7c7da]">
                    <span>{c.interviewer?.name || "Interviewer"}</span>
                    <span>
                      {c.recommendation ? RECOMMENDATION_LABEL[c.recommendation] : "—"}
                      {c.ratings.length ? ` · ${(c.ratings.reduce((x, r) => x + r.score, 0) / c.ratings.length).toFixed(1)}/5` : ""}
                    </span>
                  </div>
                ))}
                {avg !== null && submitted.length > 1 && <div className="text-[#7c7d94]">Average {avg.toFixed(1)}/5</div>}
              </div>
            )}
            {iv.status !== "cancelled" && (
              <button type="button" onClick={() => onOpenScorecard(iv._id)} className="mt-3 text-xs font-medium" style={{ color: GOLD }}>
                Open scorecard →
              </button>
            )}
          </div>
        );
      })}
      {onSchedule && (
        <Button variant="secondary" onClick={onSchedule}>
          <CalendarClock className="h-4 w-4" /> Schedule another round
        </Button>
      )}
    </div>
  );
}

function ActivityTab({ data }: { data: CandidateProfileResponse }) {
  if (!data.activity.length) return <p className="py-10 text-center text-sm text-[#7c7d94]">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-[#262626] pl-5">
      {data.activity.map((a) => (
        <li key={a._id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full" style={{ background: a.type === "rejected" ? "#f87171" : a.type === "hired" ? "#22c55e" : GOLD }} />
          <div className="text-sm text-white">{a.text}</div>
          <div className="text-xs text-[#61627a]">
            {a.actor?.name ? `${a.actor.name} · ` : ""}
            {formatDateTime(a.createdAt)}
          </div>
        </li>
      ))}
    </ol>
  );
}

function NotesTab({ data, onPosted }: { data: CandidateProfileResponse; onPosted: () => void }) {
  const members = useLoad(() => jobsApi.getOfficeMembers(), []);
  const [text, setText] = React.useState("");
  const [mentions, setMentions] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const people = members.data || [];
  return (
    <div className="space-y-4">
      {data.notes.length ? (
        <div className="space-y-3">
          {data.notes.map((n) => (
            <div key={n._id} className="rounded-xl border border-[#262626] bg-[#141414] px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#7c7d94]">
                {n.actor?.name || "Teammate"} · <span className="font-normal normal-case tracking-normal">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#c7c7da]">{n.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#7c7d94]">No notes yet. Notes are private to your team.</p>
      )}
      <div className="rounded-xl border border-[#262626] bg-[#141414] p-3">
        <textarea
          rows={3}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an internal note…"
          className="w-full resize-y bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {mentions.map((id) => (
            <Chip key={id} onRemove={() => setMentions(mentions.filter((x) => x !== id))}>
              @{people.find((p) => p._id === id)?.name || "Member"}
            </Chip>
          ))}
          <select
            value=""
            onChange={(e) => e.target.value && setMentions([...mentions, e.target.value])}
            className="rounded-lg border border-[#262626] bg-[#1A1A1A] px-2 py-1 text-xs text-[#c7c7da] outline-none [&>option]:bg-[#1A1A1A]"
          >
            <option value="">@ Notify a teammate</option>
            {people
              .filter((p) => !mentions.includes(p._id))
              .map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
          </select>
          <Button
            className="ml-auto"
            loading={busy}
            disabled={!text.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await jobsApi.addNote(data.application._id, text.trim(), mentions);
                setText("");
                setMentions([]);
                onPosted();
              } catch (err) {
                toast.error(errorMessage(err, "Couldn't post the note."));
              } finally {
                setBusy(false);
              }
            }}
          >
            Post note
          </Button>
        </div>
      </div>
    </div>
  );
}
