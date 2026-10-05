"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  getAdminUserNoteSession,
  AdminUnauthorizedError,
  type AdminNoteSessionDetail,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Read-only transcript + summary for one note-taker session. */
export function MeetingDetail({
  userId,
  sessionId,
  onBack,
}: {
  userId: string;
  sessionId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<AdminNoteSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"summary" | "transcript">("summary");

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once data loads again.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no component-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUserNoteSession(userId, sessionId);
      setDetail(data);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchDetail();
          }
        });
        return;
      }
      setError("Failed to load meeting notes");
    } finally {
      setLoading(false);
    }
  }, [userId, sessionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to meetings
      </button>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-400">{error}</p>
      ) : !detail ? (
        <p className="py-8 text-center text-sm text-zinc-500">Not found</p>
      ) : (
        <div>
          <div className="mb-4 border-b border-white/[0.06] pb-3">
            <h3 className="text-base font-semibold text-white">
              {detail.session.title || detail.session.roomName}
            </h3>
            <p className="text-xs text-zinc-500">
              {new Date(detail.session.startedAt).toLocaleString()}
              {detail.session.durationSeconds
                ? ` · ${Math.round(detail.session.durationSeconds / 60)} min`
                : ""}
            </p>
          </div>

          <div className="mb-4 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5 w-fit">
            {(["summary", "transcript"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium capitalize transition ${
                  view === v ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {view === "summary" ? (
            detail.summary ? (
              <div className="space-y-4 text-sm">
                {detail.summary.overview && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Overview
                    </h4>
                    <p className="text-zinc-300">{detail.summary.overview}</p>
                  </div>
                )}
                {detail.summary.keyTopics?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Key Topics
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.summary.keyTopics.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-zinc-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {detail.summary.actionItems?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Action Items
                    </h4>
                    <ul className="space-y-1">
                      {detail.summary.actionItems.map((a, i) => (
                        <li key={i} className="text-zinc-300">
                          • {a.description}
                          {a.assignee ? ` — ${a.assignee}` : ""}
                          {a.deadline ? ` (${a.deadline})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.summary.decisions?.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Decisions
                    </h4>
                    <ul className="space-y-1">
                      {detail.summary.decisions.map((d, i) => (
                        <li key={i} className="text-zinc-300">• {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500">No summary available</p>
            )
          ) : detail.transcript ? (
            <div className="space-y-2 text-sm">
              {detail.transcript.segments?.length > 0 ? (
                detail.transcript.segments.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="shrink-0 text-[10px] text-zinc-600 w-10 pt-0.5">
                      {fmtTime(s.startTime)}
                    </span>
                    <div>
                      <span className="text-[11px] font-medium text-brand">
                        {s.speakerName || s.speaker}
                      </span>
                      <p className="text-zinc-300">{s.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="whitespace-pre-wrap text-zinc-300">{detail.transcript.fullText}</p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">No transcript available</p>
          )}
        </div>
      )}
    </div>
  );
}
