"use client";

// Everything one Ignite call produced — recordings, the note-taker transcript
// and its AI summary — opened from the muted "date ›" line under the status
// badge.
//
// Built on the NetworkChains right-panel language (see
// `schedule-catch-up-drawer.tsx` in the NC web app): the same 440px right-side
// sheet on #0e0e0e with a left border and a deep left shadow, the same spring
// slide-in, the same circular 40px header buttons, and content grouped into
// rounded-[20px] Cards of bordered rows. Section headings sit OUTSIDE the card,
// small and uppercase, so a long panel stays scannable.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Trash2,
  Film,
  FileText,
  Sparkles,
  Users,
  CalendarClock,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { isSuperAdminClient } from "@/lib/admin-api/permissions";
import {
  getIgniteCallRelated,
  listIgniteCalls,
  detachIgniteCall,
  rescheduleIgniteCall,
  setIgniteCallCompleted,
  IGNITE_STATUS_LABEL,
  type IgniteCallRelated,
  type IgniteStatus,
} from "@/lib/admin-api/ignite-call";

const STATUS_STYLE: Record<IgniteStatus, string> = {
  not_scheduled: "border-white/10 bg-white/[0.06] text-zinc-400",
  scheduled: "border-[#FFC200]/30 bg-[#FFC200]/10 text-[#FFC200]",
  started: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  completed: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function mmss(seconds?: number): string {
  if (!seconds || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function IgniteCallDrawer({
  userId,
  callId,
  personName,
  canEdit,
  onClose,
  onDetached,
}: {
  userId: string | null;
  callId: string | null;
  personName: string | null;
  canEdit: boolean;
  onClose: () => void;
  onDetached: (userId: string) => void;
}) {
  const [data, setData] = useState<IgniteCallRelated | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listIgniteCalls>>>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(callId);
  const [detaching, setDetaching] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => setActiveId(callId), [callId]);

  // Reset before fetching so a previously-opened affiliate's recordings and
  // transcript can never render under this one's name while the request is
  // still in flight.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setData(null);
    setLoading(true);
    getIgniteCallRelated(activeId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setHistory([]);
    listIgniteCalls(userId)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const shown = !!callId;
  const r = data?.related ?? null;
  const manuallyCompleted = !!data?.call?.manuallyCompletedAt;

  async function detach() {
    if (!userId || !activeId) return;
    if (!window.confirm("Detach this Ignite call? It stays in history.")) return;
    setDetaching(true);
    try {
      await detachIgniteCall(userId, activeId);
      onDetached(userId);
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not detach the Ignite call");
    } finally {
      setDetaching(false);
    }
  }

  async function toggleCompleted(completed: boolean) {
    if (!userId || !activeId) return;
    setMarking(true);
    try {
      await setIgniteCallCompleted(userId, activeId, completed);
      toast.success(completed ? "Marked as completed" : "Manual completion removed");
      const fresh = await getIgniteCallRelated(activeId);
      setData(fresh);
      // Refresh the table so the column agrees with the panel.
      onDetached(userId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update the status");
    } finally {
      setMarking(false);
    }
  }

  if (typeof document === "undefined") return null;

  return (
    <AnimatePresence>
      {shown && (
        <motion.div key="ignite-related-drawer" className="fixed inset-0 z-[110]" initial={false}>
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute right-0 top-0 z-[120] flex h-full w-full max-w-[440px] flex-col border-l border-white/[0.06] bg-[#0e0e0e] shadow-[-24px_0_80px_-24px_rgba(0,0,0,0.85)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 42 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 pt-6 pb-3">
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] text-white/70 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <h2 className="text-[17px] font-semibold text-white">Ignite Call</h2>
              <span className="h-10 w-10" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
              {loading && (
                <Card>
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
                  </div>
                </Card>
              )}

              {!loading && data?.unavailableReason && (
                <Card>
                  <p className="px-4 py-10 text-center text-sm text-zinc-500">
                    {data.unavailableReason}
                  </p>
                </Card>
              )}

              {!loading && r && (
                <>
                  <Card>
                    <Row label="Affiliate" value={personName || "—"} />
                    <Row
                      label="Status"
                      valueNode={
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            STATUS_STYLE[r.status],
                          )}
                        >
                          {IGNITE_STATUS_LABEL[r.status]}
                        </span>
                      }
                    />
                    {manuallyCompleted && (
                      <Row
                        label="Completed"
                        valueNode={
                          <span className="text-[12px] text-zinc-400">
                            Marked by hand · {fmt(data!.call!.manuallyCompletedAt!)}
                          </span>
                        }
                      />
                    )}
                    <Row label="Scheduled" value={fmt(r.scheduledAt)} />
                    <Row label="Started" value={r.startedAt ? fmt(r.startedAt) : "—"} />
                    <Row label="Ended" value={r.endedAt ? fmt(r.endedAt) : "—"} />
                    <Row label="Duration" value={`${r.schedule.durationMinutes} min`} last />
                  </Card>

                  <Section icon={<Film className="h-3.5 w-3.5" />} title={`Recordings (${r.recordings.length})`} />
                  <Card>
                    {r.recordings.length === 0 ? (
                      <Empty>No recording for this call.</Empty>
                    ) : (
                      r.recordings.map((rec, i) => (
                        <div
                          key={rec.id}
                          className={cn("p-3", i < r.recordings.length - 1 && "border-b border-white/[0.06]")}
                        >
                          {rec.url ? (
                            <video
                              src={rec.url}
                              controls
                              className="w-full rounded-xl border border-white/[0.06] bg-black"
                            />
                          ) : (
                            <Empty>Recording is still processing.</Empty>
                          )}
                          <p className="mt-2 px-1 text-[12px] text-zinc-500">
                            {rec.displayName || "Recording"} · {fmt(rec.createdAt)}
                            {rec.duration ? ` · ${mmss(rec.duration)}` : ""}
                          </p>
                        </div>
                      ))
                    )}
                  </Card>

                  <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="AI Summary" />
                  <Card>
                    {r.noteSessions.length === 0 || !r.noteSessions.some((n) => n.summary) ? (
                      <Empty>No AI summary for this call.</Empty>
                    ) : (
                      r.noteSessions
                        .filter((n) => n.summary)
                        .map((n, i, arr) => (
                          <div
                            key={n._id}
                            className={cn("px-4 py-3.5", i < arr.length - 1 && "border-b border-white/[0.06]")}
                          >
                            {n.summary!.overview && (
                              <p className="text-[14px] leading-relaxed text-zinc-200">
                                {n.summary!.overview}
                              </p>
                            )}
                            {n.summary!.keyTopics?.length > 0 && (
                              <div className="mt-3">
                                <SubLabel>Key topics</SubLabel>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {n.summary!.keyTopics.map((t, k) => (
                                    <span
                                      key={k}
                                      className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-300"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {n.summary!.actionItems?.length > 0 && (
                              <div className="mt-3">
                                <SubLabel>Action items</SubLabel>
                                <ul className="mt-1.5 space-y-1.5">
                                  {n.summary!.actionItems.map((a, k) => (
                                    <li key={k} className="flex gap-2 text-[13px] text-zinc-300">
                                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#FFC200]" />
                                      <span>
                                        {a.description}
                                        {(a.assignee || a.deadline) && (
                                          <span className="text-zinc-500">
                                            {a.assignee ? ` — ${a.assignee}` : ""}
                                            {a.deadline ? ` (${a.deadline})` : ""}
                                          </span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {n.summary!.decisions?.length > 0 && (
                              <div className="mt-3">
                                <SubLabel>Decisions</SubLabel>
                                <ul className="mt-1.5 space-y-1.5">
                                  {n.summary!.decisions.map((d, k) => (
                                    <li key={k} className="flex gap-2 text-[13px] text-zinc-300">
                                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </Card>

                  <Section icon={<FileText className="h-3.5 w-3.5" />} title="Transcript" />
                  <Card>
                    {r.noteSessions.length === 0 || !r.noteSessions.some((n) => n.transcript) ? (
                      <Empty>No transcript for this call.</Empty>
                    ) : (
                      r.noteSessions
                        .filter((n) => n.transcript)
                        .map((n) => (
                          <details key={n._id} className="group">
                            <summary className="flex cursor-pointer items-center justify-between px-4 py-3.5 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.02]">
                              <span>{n.title || "Session transcript"}</span>
                              <span className="text-[11px] text-zinc-500 group-open:hidden">Show</span>
                              <span className="hidden text-[11px] text-zinc-500 group-open:inline">Hide</span>
                            </summary>
                            <div className="max-h-80 overflow-y-auto border-t border-white/[0.06] px-4 py-3">
                              {n.transcript!.segments?.length ? (
                                n.transcript!.segments.map((s, k) => (
                                  <p key={k} className="mb-2 text-[13px] leading-relaxed text-zinc-300">
                                    <span className="text-zinc-500">
                                      {s.speakerName || s.speaker}:{" "}
                                    </span>
                                    {s.text}
                                  </p>
                                ))
                              ) : (
                                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                                  {n.transcript!.fullText}
                                </p>
                              )}
                            </div>
                          </details>
                        ))
                    )}
                  </Card>

                  <Section icon={<Users className="h-3.5 w-3.5" />} title={`Sessions (${r.sessions.length})`} />
                  <Card>
                    {r.sessions.length === 0 ? (
                      <Empty>Nobody joined this call.</Empty>
                    ) : (
                      r.sessions.map((s, i) => (
                        <div
                          key={s._id}
                          className={cn("px-4 py-3.5", i < r.sessions.length - 1 && "border-b border-white/[0.06]")}
                        >
                          <p className="text-[13px] text-zinc-200">
                            {fmt(s.startedAt)} → {s.endedAt ? fmt(s.endedAt) : "live"}
                            {s.durationSeconds ? (
                              <span className="text-zinc-500"> · {mmss(s.durationSeconds)}</span>
                            ) : null}
                          </p>
                          {!!s.participants?.length && (
                            <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                              {s.participants.map((p) => p.name || p.identity).join(", ")}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </Card>

                  {history.filter((h) => h.id !== activeId).length > 0 && (
                    <>
                      <Section title="Earlier Ignite Calls" />
                      <Card>
                        {history
                          .filter((h) => h.id !== activeId)
                          .map((h, i, arr) => (
                            <button
                              key={h.id}
                              onClick={() => setActiveId(h.id)}
                              className={cn(
                                "flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]",
                                i < arr.length - 1 && "border-b border-white/[0.06]",
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] text-white">{h.title}</span>
                                <span className="mt-0.5 block text-[12px] text-zinc-500">
                                  {fmt(h.scheduledAt)}
                                  {h.detachedAt ? " · detached" : ""}
                                </span>
                              </span>
                            </button>
                          ))}
                      </Card>
                    </>
                  )}

                  {canEdit && isSuperAdminClient() && (
                    <button
                      onClick={() => void toggleCompleted(!manuallyCompleted)}
                      disabled={marking}
                      className={cn(
                        "mt-4 flex w-full items-center justify-center gap-2 rounded-[20px] border py-3 text-[13px] font-semibold transition-colors disabled:opacity-50",
                        manuallyCompleted
                          ? "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
                          : "border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20",
                      )}
                    >
                      {marking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : manuallyCompleted ? (
                        <Undo2 className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {manuallyCompleted ? "Undo manual completion" : "Mark as completed"}
                    </button>
                  )}

                  {canEdit && isSuperAdminClient() && r.status === "scheduled" && (
                    <button
                      onClick={() => setRescheduling(true)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-[20px] border border-white/[0.08] bg-white/[0.03] py-3 text-[13px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.06]"
                    >
                      <CalendarClock className="h-4 w-4" />
                      Reschedule
                    </button>
                  )}

                  {canEdit && isSuperAdminClient() && (
                    <button
                      onClick={detach}
                      disabled={detaching}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-[20px] border border-red-500/25 bg-red-500/10 py-3 text-[13px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {detaching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Detach this call
                    </button>
                  )}
                </>
              )}
            </div>

            {rescheduling && r && userId && activeId && (
              <RescheduleDialog
                userId={userId}
                callId={activeId}
                title={r.schedule.title}
                scheduledAt={r.scheduledAt}
                durationMinutes={r.schedule.durationMinutes}
                onClose={() => setRescheduling(false)}
                onSaved={() => {
                  setRescheduling(false);
                  // Re-read the call so the panel and the row agree with the
                  // invite that just moved.
                  setActiveId((cur) => cur);
                  void getIgniteCallRelated(activeId).then(setData).catch(() => {});
                  onDetached(userId);
                }}
              />
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Primitives, matching the NetworkChains drawer ────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.02]">
      {children}
    </div>
  );
}

function Section({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-2 pt-5 text-zinc-500">
      {icon}
      <h3 className="text-[11px] font-semibold uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function Row({
  label,
  value,
  valueNode,
  last,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3",
        !last && "border-b border-white/[0.06]",
      )}
    >
      <span className="text-[11px] font-medium text-zinc-400">{label}</span>
      {valueNode ?? <span className="truncate text-[14px] text-white">{value}</span>}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-zinc-500">{children}</p>;
}

/**
 * Move a scheduled call — same three fields NetworkChains' catch-up page edits
 * (name, time, duration), so the two products stay predictable.
 *
 * The time input is a plain `datetime-local`, i.e. the operator's own zone.
 * That is unambiguous here BECAUSE there is no timezone field to contradict
 * it — unlike the schedule drawer, where the picked zone is what governs.
 */
function RescheduleDialog({
  userId,
  callId,
  title: initialTitle,
  scheduledAt,
  durationMinutes,
  onClose,
  onSaved,
}: {
  userId: string;
  callId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [dur, setDur] = useState(durationMinutes || 60);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!when) {
      toast.error("Pick a new date and time.");
      return;
    }
    setSaving(true);
    try {
      await rescheduleIgniteCall(userId, callId, {
        title: title.trim() || undefined,
        scheduledAt: new Date(when).toISOString(),
        // Guard the same way the create form does: a cleared number input
        // reads as 0, which would write a zero-minute meeting.
        durationMinutes: Number.isFinite(dur) && dur >= 5 ? dur : 60,
      });
      toast.success("Ignite call rescheduled");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule the call");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[20px] border border-white/[0.08] bg-[#141414] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-white">Reschedule call</h3>
          <button onClick={onClose} className="text-zinc-500 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-[11px] font-medium text-zinc-400">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 text-[14px] text-white outline-none focus:border-white/[0.2]"
        />

        <label className="mt-4 block text-[11px] font-medium text-zinc-400">Date &amp; time</label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 text-[14px] text-white outline-none focus:border-white/[0.2] [color-scheme:dark]"
        />

        <label className="mt-4 block text-[11px] font-medium text-zinc-400">
          Duration (minutes)
        </label>
        <input
          type="number"
          min={5}
          step={5}
          value={dur}
          onChange={(e) => setDur(Number(e.target.value))}
          className="mt-1 h-10 w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 text-[14px] text-white outline-none focus:border-white/[0.2]"
        />

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          The host&apos;s Google Calendar invite is updated too. A call that has
          already started cannot be moved.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#FFC200] px-4 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** ISO → the `datetime-local` shape, in the operator's own zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
