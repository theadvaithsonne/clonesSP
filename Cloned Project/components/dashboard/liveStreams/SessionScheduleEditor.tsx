"use client";

/**
 * The live sessions a recurrence rule produces, listed and individually
 * editable, inside the live-stream create/edit form.
 *
 * Sessions of a series are computed, never stored — so this list is derived
 * from whatever the form currently says (see `lib/recurrence.ts`), and it
 * updates as the founder changes the pattern. Editing one writes a
 * per-session override through the existing
 * `PUT /workshops/:id/sessions/:sessionDate` endpoint; nothing new is
 * persisted by this component itself.
 *
 * Two modes, one UI:
 *
 *   EDITING an existing stream — a save goes to the backend immediately, and
 *   sessions already customised are loaded up front so the list shows what
 *   each session really says.
 *
 *   CREATING — there is no workshop to write against yet, so edits are held
 *   as drafts and the parent flushes them through the same endpoint right
 *   after the workshop is created. That's why `drafts` lives in the parent.
 *
 * A blank field means "inherit from the series", exactly as in
 * EditSessionSheet: the placeholder shows the value it falls back to, and
 * clearing a customised field sends `null` to drop the override.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import {
  computeSessionDays,
  describePattern,
  ymdToUtcDate,
  type ClientRecurrencePattern,
} from "@/lib/recurrence";
import { getWorkshopSessions, type WorkshopSession } from "@/lib/feed-api";
import { TimeSelector } from "../TimeSelector";
import { cn } from "@/lib/utils";

/** What a founder may change on one session from this panel. Every key is
 *  optional and an absent key means "inherits the series". */
export interface SessionDraft {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  /** yyyy-mm-dd. The day it RUNS on; its slot identity never moves. */
  runsOn?: string;
}

export type SessionDraftMap = Record<string, SessionDraft>;

/** Is anything actually set on this draft? An emptied draft is no draft. */
export function isDraftEmpty(draft: SessionDraft | undefined): boolean {
  if (!draft) return true;
  return !(
    draft.title?.trim() ||
    draft.description?.trim() ||
    draft.startTime ||
    draft.endTime ||
    draft.runsOn
  );
}

/** How many rows render before "Show all" — a daily year-long series is 365
 *  sessions, and dropping all of them into the form makes it unusable. */
const PAGE_SIZE = 12;

function prettyDay(ymd: string): string {
  const d = ymdToUtcDate(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatClock(hhmm: string): string {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm || "—";
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export interface SessionScheduleEditorProps {
  pattern: ClientRecurrencePattern;
  /** yyyy-mm-dd — the series' first day. */
  startDate: string;
  /** yyyy-mm-dd — the last day sessions may run on. */
  endDate: string;
  seriesTitle: string;
  seriesDescription?: string;
  startTime: string;
  endTime: string;
  /** Null while creating: there is no workshop to load overrides from. */
  workshopId: string | null;
  drafts: SessionDraftMap;
  onDraftsChange: (next: SessionDraftMap) => void;
  /**
   * Persist one session. Provided only in edit mode — its absence is what
   * puts this panel in "buffer the drafts" mode. Resolve false to keep the
   * editor open on failure.
   */
  onSaveSession?: (ymd: string, draft: SessionDraft) => Promise<boolean>;
}

export function SessionScheduleEditor({
  pattern,
  startDate,
  endDate,
  seriesTitle,
  seriesDescription,
  startTime,
  endTime,
  workshopId,
  drafts,
  onDraftsChange,
  onSaveSession,
}: SessionScheduleEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<SessionDraft>({});
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  /** Sessions already customised on the server, keyed by yyyy-mm-dd. Only
   *  populated in edit mode; empty means "every session follows the series". */
  const [saved, setSaved] = useState<Record<string, WorkshopSession>>({});
  const [loadingSaved, setLoadingSaved] = useState(false);

  const days = useMemo(
    () => computeSessionDays({ pattern, startDate, endDate }),
    [pattern, startDate, endDate],
  );

  // What the backend currently says about this series' sessions. Fetched once
  // per workshop — the rule can change in the form without invalidating it,
  // since overrides are keyed by day, not by rule.
  useEffect(() => {
    if (!workshopId) {
      setSaved({});
      return;
    }
    let cancelled = false;
    setLoadingSaved(true);
    getWorkshopSessions(workshopId, { limit: 500, includePast: true })
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, WorkshopSession> = {};
        for (const s of res.sessions || []) {
          if (s.isEdited) next[String(s.date).slice(0, 10)] = s;
        }
        setSaved(next);
      })
      .catch(() => {
        // A failed load only costs the "Edited" markers — the list itself is
        // computed locally and every save still goes through.
      })
      .finally(() => {
        if (!cancelled) setLoadingSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workshopId]);

  /** What a session says right now: an unsaved draft first, then whatever is
   *  stored, then the series. */
  const effective = useCallback(
    (ymd: string) => {
      const draft = drafts[ymd];
      const stored = saved[ymd];
      return {
        title: draft?.title?.trim() || stored?.title || seriesTitle,
        description:
          draft?.description?.trim() || stored?.description || seriesDescription,
        startTime: draft?.startTime || stored?.startTime || startTime,
        endTime: draft?.endTime || stored?.endTime || endTime,
        runsOn:
          draft?.runsOn ||
          (stored?.rescheduledDate
            ? String(stored.rescheduledDate).slice(0, 10)
            : ""),
        isCustomised: !isDraftEmpty(draft) || !!stored,
        isUnsaved: !isDraftEmpty(draft),
      };
    },
    [drafts, saved, seriesTitle, seriesDescription, startTime, endTime],
  );

  const openEditor = (ymd: string) => {
    const now = effective(ymd);
    setExpanded(ymd);
    setForm({
      // Only genuine customisations prefill — a value that merely equals the
      // series must stay blank, or saving it would store a copy of the series
      // as an override.
      title: now.title === seriesTitle ? "" : now.title,
      description:
        now.description === seriesDescription ? "" : now.description || "",
      startTime: now.startTime,
      endTime: now.endTime,
      runsOn: now.runsOn,
    });
  };

  const closeEditor = () => {
    setExpanded(null);
    setForm({});
  };

  /** Strip anything that just repeats the series, so "customised" means it. */
  const normalise = (raw: SessionDraft): SessionDraft => ({
    title: raw.title?.trim() ? raw.title.trim() : undefined,
    description: raw.description?.trim() ? raw.description.trim() : undefined,
    startTime: raw.startTime && raw.startTime !== startTime ? raw.startTime : undefined,
    endTime: raw.endTime && raw.endTime !== endTime ? raw.endTime : undefined,
    runsOn: raw.runsOn || undefined,
  });

  const applyDraft = (ymd: string, draft: SessionDraft | null) => {
    const next = { ...drafts };
    if (!draft || isDraftEmpty(draft)) delete next[ymd];
    else next[ymd] = draft;
    onDraftsChange(next);
  };

  const save = async (ymd: string) => {
    const draft = normalise(form);

    // Nothing to send in create mode — just remember it and move on.
    if (!onSaveSession) {
      applyDraft(ymd, draft);
      closeEditor();
      return;
    }

    setSavingDay(ymd);
    try {
      const ok = await onSaveSession(ymd, draft);
      if (!ok) return;
      // Saved server-side, so it stops being a pending draft. Mirror it into
      // `saved` rather than refetching the whole series for one row.
      applyDraft(ymd, null);
      setSaved((prev) => {
        const next = { ...prev };
        if (isDraftEmpty(draft)) delete next[ymd];
        else
          next[ymd] = {
            ...(prev[ymd] || ({} as WorkshopSession)),
            title: draft.title || seriesTitle,
            description: draft.description ?? seriesDescription,
            startTime: draft.startTime || startTime,
            endTime: draft.endTime || endTime,
            rescheduledDate: draft.runsOn || undefined,
            isEdited: true,
          } as WorkshopSession;
        return next;
      });
      closeEditor();
    } finally {
      setSavingDay(null);
    }
  };

  const reset = async (ymd: string) => {
    if (!onSaveSession) {
      applyDraft(ymd, null);
      closeEditor();
      return;
    }
    setSavingDay(ymd);
    try {
      // An all-empty draft is what the parent turns into explicit `null`s,
      // which is how the backend is told to drop each override.
      const ok = await onSaveSession(ymd, {});
      if (!ok) return;
      applyDraft(ymd, null);
      setSaved((prev) => {
        const next = { ...prev };
        delete next[ymd];
        return next;
      });
      closeEditor();
    } finally {
      setSavingDay(null);
    }
  };

  if (!startDate) {
    return (
      <Shell caption="Pick a start date to see the sessions this rule creates.">
        {null}
      </Shell>
    );
  }

  if (days.length === 0) {
    return (
      <Shell caption="This rule doesn't produce any sessions in the selected range.">
        {null}
      </Shell>
    );
  }

  const visible = showAll ? days : days.slice(0, PAGE_SIZE);
  const customisedCount = days.filter((d) => effective(d).isCustomised).length;

  return (
    <Shell
      caption={`${describePattern(pattern)} · ${days.length} session${
        days.length === 1 ? "" : "s"
      }${customisedCount ? ` · ${customisedCount} customised` : ""}`}
      loading={loadingSaved}
      note={
        onSaveSession
          ? "Changes to a session save immediately and don't wait for the form. If you've just changed the repeat pattern, save the stream first — a session can only be edited on a day the saved rule produces."
          : "Session changes are applied right after the live stream is created."
      }
    >
      <div className="flex flex-col gap-2">
        {visible.map((ymd, i) => {
          const view = effective(ymd);
          const isOpen = expanded === ymd;
          const busy = savingDay === ymd;

          return (
            <div
              key={ymd}
              className={cn(
                "rounded-xl border bg-[#131316] transition-colors",
                isOpen
                  ? "border-brand/50"
                  : view.isCustomised
                    ? "border-brand/25"
                    : "border-[#2a2a35]",
              )}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-7 shrink-0 text-center text-[11px] font-bold text-[#5c5c70]">
                  {i + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {view.title}
                    </p>
                    {view.isCustomised && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                          view.isUnsaved
                            ? "bg-brand/10 text-brand"
                            : "bg-brand/[0.07] text-brand/70",
                        )}
                      >
                        {view.isUnsaved ? "Pending" : "Edited"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#8e8e9f]">
                    {prettyDay(view.runsOn || ymd)} ·{" "}
                    {formatClock(view.startTime)} – {formatClock(view.endTime)}
                    {view.runsOn && view.runsOn !== ymd && (
                      <span className="text-brand">
                        {" "}
                        · moved from {prettyDay(ymd)}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => (isOpen ? closeEditor() : openEditor(ymd))}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#2a2a35] px-2.5 text-[11px] font-semibold text-[#9fa0b8] transition-colors hover:border-brand/40 hover:text-brand"
                >
                  {isOpen ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                  {isOpen ? "Close" : "Edit"}
                </button>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-[#2a2a35] px-3 py-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#9fa0b8]">
                      Session title
                    </label>
                    <input
                      value={form.title || ""}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={seriesTitle}
                      maxLength={200}
                      className={inputClass}
                    />
                    <p className="text-[10px] text-[#5c5c70]">
                      Blank uses the series title.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#9fa0b8]">
                      Session description
                    </label>
                    <textarea
                      value={form.description || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      rows={3}
                      placeholder={seriesDescription || "Series description"}
                      className={`${inputClass} h-auto resize-none py-2`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#9fa0b8]">
                        Start time
                      </label>
                      <TimeSelector
                        value={form.startTime || startTime}
                        onChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[#9fa0b8]">
                        End time
                      </label>
                      <TimeSelector
                        value={form.endTime || endTime}
                        relativeTo={form.startTime || startTime}
                        onChange={(v) => setForm((f) => ({ ...f, endTime: v }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#9fa0b8]">
                      Runs on
                    </label>
                    <input
                      type="date"
                      value={form.runsOn || ""}
                      onChange={(e) => setForm((f) => ({ ...f, runsOn: e.target.value }))}
                      className={`${inputClass} [&::-webkit-calendar-picker-indicator]:invert`}
                    />
                    <p className="text-[10px] text-[#5c5c70]">
                      Blank keeps it on {prettyDay(ymd)}. Moving it changes when
                      it runs, not which session it is — enrolments, payments and
                      join links stay on the original date.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => save(ymd)}
                      disabled={busy}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand text-xs font-bold text-brand-foreground transition enabled:hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-40"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {busy ? "Saving…" : "Apply to this session"}
                    </button>
                    {view.isCustomised && (
                      <button
                        type="button"
                        onClick={() => reset(ymd)}
                        disabled={busy}
                        title="Drop this session's edits and follow the series again"
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#2a2a35] px-3 text-xs font-semibold text-[#9fa0b8] transition hover:border-[#2a2a35] hover:text-white disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {days.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full rounded-xl border border-[#2a2a35] py-2 text-xs font-semibold text-[#9fa0b8] transition-colors hover:border-brand/40 hover:text-brand"
        >
          {showAll
            ? "Show fewer sessions"
            : `Show all ${days.length} sessions`}
        </button>
      )}
    </Shell>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#2a2a35] bg-[#0e0e12] px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-[#5c5c70] focus:border-brand/60";

function Shell({
  caption,
  note,
  loading,
  children,
}: {
  caption: string;
  note?: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#9fa0b8]">
          <CalendarDays className="h-3.5 w-3.5" />
          Live Sessions
        </label>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#5c5c70]" />}
      </div>
      <p className="text-[11px] text-[#8e8e9f]">{caption}</p>
      {children}
      {note && <p className="text-[10px] text-[#5c5c70]">{note}</p>}
    </div>
  );
}
