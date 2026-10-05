"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Download,
  FileText,
  HelpCircle,
  Lightbulb,
  Loader2,
  Mic,
  Send,
  Users,
} from "lucide-react";
import {
  conferenceNotesApi,
  isNoteSessionTerminal,
  type ConferenceNoteSession,
  type ConferenceNoteSummary,
  type ConferenceNoteTranscript,
  type NoteSessionStatus,
} from "@/lib/api/conference-notes";

const POLL_MS = 5000;

const STATUS_LABEL: Record<NoteSessionStatus, string> = {
  recording: "Recording",
  transcribing: "Transcribing",
  summarizing: "Summarizing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_STYLE: Record<NoteSessionStatus, string> = {
  recording: "bg-red-500/15 text-red-400",
  transcribing: "bg-amber-500/15 text-amber-400",
  summarizing: "bg-amber-500/15 text-amber-400",
  ready: "bg-green-500/15 text-green-400",
  failed: "bg-red-500/15 text-red-400",
};

function StatusBadge({ status }: { status: NoteSessionStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {!isNoteSessionTerminal(status) && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function ConferenceNotesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return selectedId ? (
    <NoteDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />
  ) : (
    <NotesList onOpen={setSelectedId} />
  );
}

function NotesList({ onOpen }: { onOpen: (id: string) => void }) {
  const [sessions, setSessions] = useState<ConferenceNoteSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions(await conferenceNotesApi.listSessions());
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (sessions.some((s) => !isNoteSessionTerminal(s.status))) load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [sessions, load]);

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-semibold">Conference Notes</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <Mic className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No conference notes yet. When the room owner records a conference, the
              note-taker&apos;s summary and transcript appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <button
                key={s._id}
                onClick={() => onOpen(s._id)}
                className="group w-full text-left flex items-center justify-between gap-3 rounded-xl border border-[#2a2a35] bg-[#111116] p-4 hover:border-purple-500/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{s.title || "Conference Call"}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{formatDate(s.startedAt)}</span>
                    <span>·</span>
                    <span>{formatDuration(s.durationSeconds)}</span>
                    {s.participants?.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{s.participants.length} participants</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={s.status} />
                  <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [session, setSession] = useState<ConferenceNoteSession | null>(null);
  const [summary, setSummary] = useState<ConferenceNoteSummary | null>(null);
  const [transcript, setTranscript] = useState<ConferenceNoteTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, sum, tx] = await Promise.all([
        conferenceNotesApi.getSession(sessionId),
        conferenceNotesApi.getSummary(sessionId).catch(() => null),
        conferenceNotesApi.getTranscript(sessionId).catch(() => null),
      ]);
      setSession(s);
      setSummary(sum);
      setTranscript(tx);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!session || isNoteSessionTerminal(session.status)) return;
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [session, load]);

  const handleDownload = async () => {
    if (!session) return;
    setDownloading(true);
    try {
      await conferenceNotesApi.downloadTranscript(sessionId, session.title || "conference-notes");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download transcript");
    } finally {
      setDownloading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await conferenceNotesApi.resend(sessionId);
      toast.success("Notes emailed to participants");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send notes");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="h-4 w-4" />
          All notes
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !session ? (
          <div className="text-gray-500 text-sm">Notes not found.</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-semibold">{session.title || "Conference Call"}</h1>
                {session.participants?.length > 0 && (
                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {session.participants.map((p) => p.name || p.identity).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {transcript && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a35] px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.04] disabled:opacity-60"
                  >
                    {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Transcript
                  </button>
                )}
                {session.status === "ready" && (
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Email notes
                  </button>
                )}
              </div>
            </div>

            {!isNoteSessionTerminal(session.status) && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-6 text-sm text-amber-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing the conference notes…
              </div>
            )}
            {session.status === "failed" && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 mb-6 text-sm text-red-300">
                Note-taking failed for this conference.
              </div>
            )}

            {summary && (
              <div className="space-y-6 mb-8">
                {summary.overview && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Summary</h2>
                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{summary.overview}</p>
                  </section>
                )}
                {summary.keyTopics?.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4" /> Key topics
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {summary.keyTopics.map((t, i) => (
                        <span key={i} className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-xs text-gray-300">{t}</span>
                      ))}
                    </div>
                  </section>
                )}
                {summary.actionItems?.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                      <CheckSquare className="h-4 w-4" /> Action items
                    </h2>
                    <ul className="space-y-2">
                      {summary.actionItems.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                          <CheckSquare className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                          <span>
                            {a.description}
                            {a.assignee && <span className="text-gray-500"> — {a.assignee}</span>}
                            {a.deadline && <span className="text-gray-500"> ({a.deadline})</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {summary.decisions?.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Decisions</h2>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
                      {summary.decisions.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </section>
                )}
                {summary.questions?.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4" /> Open questions
                    </h2>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
                      {summary.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {transcript && transcript.segments?.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Transcript</h2>
                <div className="space-y-3">
                  {transcript.segments.map((seg, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-purple-300 font-medium">{seg.speakerName || seg.speaker}</span>
                      <span className="text-gray-200">: {seg.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
