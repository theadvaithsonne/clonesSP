"use client";

// A13 · Interview scorecard — one interviewer's evaluation of one round.
//
// Criteria start from the interviewer's saved draft, else the job's skills,
// else a generic set; each is rated 1–5 with an optional note. Other
// interviewers' scorecards stay hidden (the API withholds them) until this
// one is submitted, after which the form is read-only and theirs appear.

import React from "react";
import { ArrowLeft, Check, ExternalLink, Plus, X } from "lucide-react";
import { toast } from "sonner";
import * as jobsApi from "../../api";
import { JOB_PAGES } from "../../constants";
import { useJobsNav, useJobsNavStore } from "../../nav";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ErrorState,
  GOLD,
  LoadingBlock,
  MatchScore,
  TextArea,
  errorMessage,
  formatDate,
  formatDateTime,
  meetingLink,
  useConfirm,
} from "../../ui";
import type { InterviewDetailResponse, Scorecard } from "../../types";

type Recommendation = NonNullable<Scorecard["recommendation"]>;

const RECOMMENDATIONS: Array<{ value: Recommendation; label: string; color: string }> = [
  { value: "strong_no", label: "Strong no", color: "#f87171" },
  { value: "no", label: "No", color: "#fb923c" },
  { value: "yes", label: "Yes", color: "#4ade80" },
  { value: "strong_yes", label: "Strong yes", color: "#22c55e" },
];

const FALLBACK_CRITERIA = ["Role fit", "Skills", "Problem solving", "Collaboration", "Communication"];
const MAX_CRITERIA = 12;

const MODE_LABELS: Record<string, string> = {
  video: "Video call",
  in_person: "In person",
  phone: "Phone call",
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_candidate: "Waiting for candidate",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

type Row = { key: string; criterion: string; score: number; note: string };

let rowSeq = 0;
const rowKey = () => `row_${Date.now().toString(36)}_${(rowSeq++).toString(36)}`;

function recommendationMeta(value?: string | null) {
  return RECOMMENDATIONS.find((r) => r.value === value);
}

function average(ratings: Array<{ score: number }>): number | null {
  if (!ratings.length) return null;
  return ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
}

function initialRows(data: InterviewDetailResponse): Row[] {
  const saved = data.myScorecard?.ratings || [];
  if (saved.length) {
    return saved.map((r) => ({ key: rowKey(), criterion: r.criterion, score: r.score, note: r.note || "" }));
  }
  const skills = (data.job?.skills || []).filter(Boolean).slice(0, 5);
  return (skills.length ? skills : FALLBACK_CRITERIA).map((criterion) => ({
    key: rowKey(),
    criterion,
    score: 0,
    note: "",
  }));
}

export default function ScorecardPage() {
  const nav = useJobsNav();
  const interviewId = useJobsNavStore((s) => s.interviewId);
  const { confirm, confirmDialog } = useConfirm();

  const [data, setData] = React.useState<InterviewDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [recommendation, setRecommendation] = React.useState<Recommendation | null>(null);
  const [privateNote, setPrivateNote] = React.useState("");
  const [saving, setSaving] = React.useState<"draft" | "submit" | null>(null);
  const [updating, setUpdating] = React.useState(false);

  React.useEffect(() => {
    if (!interviewId) nav.go(JOB_PAGES.postings);
  }, [interviewId, nav]);

  const load = React.useCallback(
    async (hydrate: boolean) => {
      if (!interviewId) return;
      if (hydrate) setLoading(true);
      setError(null);
      try {
        const res = await jobsApi.getInterview(interviewId);
        setData(res);
        if (hydrate) {
          setRows(initialRows(res));
          setRecommendation(res.myScorecard?.recommendation || null);
          setPrivateNote(res.myScorecard?.privateNote || "");
        }
      } catch (err) {
        setError(errorMessage(err, "Couldn't load this interview."));
      } finally {
        setLoading(false);
      }
    },
    [interviewId]
  );

  React.useEffect(() => {
    load(true);
  }, [load]);

  if (!interviewId) return <LoadingBlock />;
  if (loading && !data) return <LoadingBlock label="Loading the scorecard…" />;
  if (error && !data) {
    return (
      <div className="p-8">
        <ErrorState message={error} onRetry={() => load(true)} />
      </div>
    );
  }
  if (!data) return null;

  const { interview, application, job, myScorecard, othersHidden, previousRounds } = data;
  const submitted = !!myScorecard?.submittedAt;
  const readOnly = submitted;
  const profile: NonNullable<InterviewDetailResponse["application"]>["profile"] = application?.profile || {};
  const candidateName = profile.fullName || "Candidate";
  const rated = rows.filter((r) => r.criterion.trim() && r.score >= 1);
  const unrated = rows.filter((r) => r.criterion.trim() && r.score < 1).length;

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async (submit: boolean) => {
    const ratings = rated.map((r) => ({
      criterion: r.criterion.trim().slice(0, 120),
      score: r.score,
      ...(r.note.trim() ? { note: r.note.trim().slice(0, 2000) } : {}),
    }));
    if (submit) {
      if (!ratings.length || !recommendation) {
        toast.error("Rate at least one criterion and choose an overall recommendation first.");
        return;
      }
      const ok = await confirm({
        title: "Submit your scorecard?",
        message: `You won't be able to edit it afterwards, and you'll see the other interviewers' scores.${
          unrated ? ` ${unrated} unrated criteri${unrated === 1 ? "on" : "a"} will be left out.` : ""
        }`,
        confirmLabel: "Submit scorecard",
        destructive: false,
      });
      if (!ok) return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      await jobsApi.saveScorecard(interview._id, {
        ratings,
        recommendation: recommendation || undefined,
        privateNote: privateNote.trim() ? privateNote.trim().slice(0, 4000) : undefined,
        submit,
      });
      toast.success(submit ? "Scorecard submitted" : "Draft saved");
      await load(submit);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the scorecard."));
    } finally {
      setSaving(null);
    }
  };

  const setStatus = async (status: "completed" | "cancelled") => {
    if (status === "cancelled") {
      const ok = await confirm({
        title: "Cancel this interview?",
        message: "The round is marked as cancelled. The candidate isn't emailed automatically — let them know yourself.",
        confirmLabel: "Cancel interview",
      });
      if (!ok) return;
    }
    setUpdating(true);
    try {
      await jobsApi.updateInterview(interview._id, { status });
      toast.success(status === "completed" ? "Interview marked as completed" : "Interview cancelled");
      await load(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the interview."));
    } finally {
      setUpdating(false);
    }
  };

  const others = othersHidden
    ? []
    : (interview.scorecards || []).filter((s) => s.submittedAt && s.interviewerId !== myScorecard?.interviewerId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[#1c1c24] px-8 py-5">
        <button
          type="button"
          onClick={() => (job && application ? nav.openJob(job._id, "pipeline", application._id) : nav.go(JOB_PAGES.postings))}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[#7c7d94] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to candidate
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
              Interview · {interview.roundLabel}
            </div>
            <h1 className="mt-1 text-xl font-semibold text-white">Interview scorecard</h1>
            <p className="mt-1 text-sm text-[#7c7d94]">
              {[job?.title, interview.scheduledAt ? formatDate(interview.scheduledAt) : STATUS_LABELS[interview.status]]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {submitted ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#22c55e]/10 px-2.5 py-1 text-xs font-medium text-[#4ade80]">
              <Check className="h-3.5 w-3.5" /> Submitted {formatDate(myScorecard?.submittedAt)}
            </span>
          ) : (
            <span className="rounded-md border border-[#262626] bg-[#1A1A1A] px-2.5 py-1 text-xs text-[#c7c7da]">
              Draft · only you can see
            </span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Candidate & meeting */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Candidate</div>
              <div className="flex items-center gap-3">
                <Avatar name={candidateName} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-white">{candidateName}</div>
                  <div className="truncate text-xs text-[#7c7d94]">
                    {[
                      profile.title && profile.company ? `${profile.title} at ${profile.company}` : profile.title || profile.company,
                      typeof profile.experienceYears === "number" ? `${profile.experienceYears} yrs` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || profile.email}
                  </div>
                </div>
                {application && <MatchScore score={application.matchScore} size="lg" />}
              </div>
              {application?.referral && (
                <div className="mt-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{ color: GOLD, background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
                  >
                    Referral · {application.referral.name ? `${application.referral.name} (${application.referral.affiliateId})` : application.referral.affiliateId}
                  </span>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold text-white">Application highlights</div>
              <dl className="space-y-2.5 text-sm">
                {application?.quiz?.total ? (
                  <Highlight label="Quiz">
                    {application.quiz.score}/{application.quiz.total} · {application.quiz.passed ? "passed" : "not passed"}
                  </Highlight>
                ) : null}
                {profile.expectedCtc && <Highlight label="Expected CTC">{profile.expectedCtc}</Highlight>}
                {profile.noticePeriod && <Highlight label="Notice period">{profile.noticePeriod}</Highlight>}
                {profile.location && <Highlight label="Location">{profile.location}</Highlight>}
              </dl>
              {application?.matchedSkills?.length ? (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs text-[#7c7d94]">Matched skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {application.matchedSkills.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>
                </div>
              ) : null}
              {!application?.quiz?.total &&
                !profile.expectedCtc &&
                !profile.noticePeriod &&
                !profile.location &&
                !application?.matchedSkills?.length && (
                  <p className="text-xs text-[#7c7d94]">No highlights from the application form.</p>
                )}
              {previousRounds.length > 0 && (
                <div className="mt-4 border-t border-[#1f1f24] pt-3">
                  <div className="mb-2 text-xs text-[#7c7d94]">Previous rounds</div>
                  <ul className="space-y-2">
                    {previousRounds.map((r) => {
                      const rec = recommendationMeta(r.recommendation);
                      return (
                        <li key={r._id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-[#c7c7da]">{r.roundLabel}</span>
                          <span className="shrink-0 text-xs text-[#7c7d94]">
                            {rec ? <span style={{ color: rec.color }}>{rec.label}</span> : STATUS_LABELS[r.status] || r.status}
                            {r.average !== null ? ` · ${r.average.toFixed(1)}/5` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Meeting</div>
                <span className="text-xs text-[#7c7d94]">{STATUS_LABELS[interview.status] || interview.status}</span>
              </div>
              <dl className="space-y-2.5 text-sm">
                {interview.scheduledAt && <Highlight label="When">{formatDateTime(interview.scheduledAt)}</Highlight>}
                <Highlight label="Duration">{interview.durationMin} min</Highlight>
                <Highlight label="Mode">{MODE_LABELS[interview.mode] || interview.mode}</Highlight>
                {interview.location && <Highlight label="Where">{interview.location}</Highlight>}
                {interview.interviewers?.length ? (
                  <Highlight label="With">{interview.interviewers.map((p) => p.name).join(", ")}</Highlight>
                ) : null}
              </dl>
              {interview.status === "awaiting_candidate" && interview.slots.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs text-[#7c7d94]">Offered times</div>
                  <ul className="space-y-1 text-xs text-[#c7c7da]">
                    {interview.slots.map((s) => (
                      <li key={s}>{formatDateTime(s)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {interview.meetingUrl && interview.status === "scheduled" && (
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => window.open(meetingLink(interview.meetingUrl), "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4" /> Join meeting
                </Button>
              )}
              {interview.status === "scheduled" && (
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" className="flex-1" disabled={updating} onClick={() => setStatus("completed")}>
                    Mark as completed
                  </Button>
                  <Button variant="danger" className="flex-1" disabled={updating} onClick={() => setStatus("cancelled")}>
                    Cancel interview
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Evaluation */}
          <div className="min-w-0 space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Evaluation</div>
                <span className="rounded-md border border-[#262626] px-2 py-0.5 text-[11px] text-[#c7c7da]">
                  {rows.filter((r) => r.criterion.trim()).length} criteria
                </span>
              </div>
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.key} className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={r.criterion}
                        disabled={readOnly}
                        maxLength={120}
                        onChange={(e) => updateRow(r.key, { criterion: e.target.value })}
                        placeholder="Criterion"
                        className="min-w-[160px] flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600 disabled:opacity-100"
                      />
                      <div className="flex items-center gap-1.5" role="radiogroup" aria-label={`Rating for ${r.criterion || "criterion"}`}>
                        {[1, 2, 3, 4, 5].map((n) => {
                          const on = r.score >= n;
                          return (
                            <button
                              key={n}
                              type="button"
                              role="radio"
                              aria-checked={r.score === n}
                              aria-label={`${n} of 5`}
                              disabled={readOnly}
                              onClick={() => updateRow(r.key, { score: r.score === n ? 0 : n })}
                              className="flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors disabled:cursor-default"
                              style={
                                on
                                  ? { borderColor: GOLD, background: GOLD, color: "#000" }
                                  : { borderColor: "#3A3A3A", background: "transparent", color: "#7c7d94" }
                              }
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                          className="text-[#61627a] hover:text-[#f87171]"
                          aria-label="Remove criterion"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {readOnly ? (
                      r.note ? <p className="mt-2 text-sm text-[#c7c7da]">{r.note}</p> : null
                    ) : (
                      <input
                        value={r.note}
                        maxLength={2000}
                        onChange={(e) => updateRow(r.key, { note: e.target.value })}
                        placeholder="Evidence or a short note (optional)"
                        className="mt-2 w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-1.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand"
                      />
                    )}
                  </div>
                ))}
                {!rows.length && <p className="text-sm text-[#7c7d94]">No criteria yet.</p>}
              </div>
              {!readOnly && rows.length < MAX_CRITERIA && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => [...rs, { key: rowKey(), criterion: "", score: 0, note: "" }])}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: GOLD }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add criterion
                </button>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold text-white">Overall recommendation</div>
              <div className="flex flex-wrap gap-2">
                {RECOMMENDATIONS.map((r) => {
                  const active = recommendation === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setRecommendation(active ? null : r.value)}
                      className="rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-default"
                      style={
                        active
                          ? { borderColor: r.color, background: `color-mix(in srgb, ${r.color} 14%, transparent)`, color: "#fff" }
                          : { borderColor: "#262626", background: "#1A1A1A", color: "#c7c7da" }
                      }
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5">
                <TextArea
                  label="Private notes"
                  rows={4}
                  maxLength={4000}
                  disabled={readOnly}
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  placeholder="Anything the hiring team should weigh — never shown to the candidate."
                />
              </div>
            </Card>

            {!othersHidden && (
              <Card className="p-5">
                <div className="mb-3 text-sm font-semibold text-white">Other scorecards</div>
                {others.length ? (
                  <div className="space-y-3">
                    {others.map((s) => {
                      const rec = recommendationMeta(s.recommendation);
                      const avg = average(s.ratings || []);
                      return (
                        <div key={s.interviewerId} className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.interviewer?.name} src={s.interviewer?.avatar} size={28} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm text-white">{s.interviewer?.name || "Interviewer"}</div>
                              <div className="text-[11px] text-[#7c7d94]">Submitted {formatDate(s.submittedAt)}</div>
                            </div>
                            {rec && (
                              <span
                                className="rounded-md px-2 py-0.5 text-xs font-medium"
                                style={{ color: rec.color, background: `color-mix(in srgb, ${rec.color} 12%, transparent)` }}
                              >
                                {rec.label}
                              </span>
                            )}
                            {avg !== null && <span className="text-sm font-semibold tabular-nums text-white">{avg.toFixed(1)}/5</span>}
                          </div>
                          {s.ratings?.length ? (
                            <ul className="mt-3 space-y-1.5 text-xs">
                              {s.ratings.map((r, i) => (
                                <li key={`${r.criterion}-${i}`} className="flex gap-3">
                                  <span className="w-36 shrink-0 truncate text-[#c7c7da]">{r.criterion}</span>
                                  <span className="w-8 shrink-0 tabular-nums text-white">{r.score}/5</span>
                                  {r.note && <span className="min-w-0 text-[#7c7d94]">{r.note}</span>}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {s.privateNote && <p className="mt-3 border-t border-[#262626] pt-3 text-xs text-[#c7c7da]">{s.privateNote}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#7c7d94]">No other interviewer has submitted a scorecard for this round yet.</p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1c1c24] bg-[#0c0c0e] px-8 py-3">
        <span className="text-xs text-[#7c7d94]">
          {submitted
            ? `You submitted this scorecard on ${formatDate(myScorecard?.submittedAt)}.`
            : "Other interviewers' scores are hidden until you submit."}
        </span>
        {!submitted && (
          <div className="flex gap-2">
            <Button variant="secondary" loading={saving === "draft"} disabled={!!saving} onClick={() => save(false)}>
              Save draft
            </Button>
            <Button loading={saving === "submit"} disabled={!!saving} onClick={() => save(true)}>
              Submit scorecard
            </Button>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

function Highlight({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-[#7c7d94]">{label}</dt>
      <dd className="min-w-0 text-right text-white">{children}</dd>
    </div>
  );
}
