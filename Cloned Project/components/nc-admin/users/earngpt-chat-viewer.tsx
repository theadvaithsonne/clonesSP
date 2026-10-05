"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  getAdminUserConversation,
  AdminUnauthorizedError,
  type AdminConversationDetail,
} from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

/** Read-only EarnGPT chat transcript — renders messages exactly as the
 *  user sees them, with no composer (admins view, never act as the user). */
export function EarnGPTChatViewer({
  userId,
  sessionId,
  onBack,
}: {
  userId: string;
  sessionId: string;
  onBack: () => void;
}) {
  const [convo, setConvo] = useState<AdminConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  // Capped to one recovery attempt per failure episode: if elevation keeps
  // succeeding while the data endpoint keeps 401ing, this must not loop
  // forever hammering the backend. Re-arms once data loads again.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no component-level clear is needed here.
  const recoveryAttempted = useRef(false);

  const fetchConvo = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminUserConversation(userId, sessionId);
      setConvo(data);
      setError("");
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      if (e instanceof AdminUnauthorizedError) {
        if (recoveryAttempted.current) return; // one attempt per failure episode
        recoveryAttempted.current = true;
        ensureNcAdminToken().then((result) => {
          if (result.ok === true) {
            fetchConvo();
          }
        });
        return;
      }
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, [userId, sessionId]);

  useEffect(() => {
    fetchConvo();
  }, [fetchConvo]);

  const title =
    convo?.contactId?.fullName || convo?.title || "Conversation";

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to chats
      </button>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-400">{error}</p>
      ) : !convo ? (
        <p className="py-8 text-center text-sm text-zinc-500">Not found</p>
      ) : (
        <div>
          <div className="mb-4 border-b border-white/[0.06] pb-3">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {convo.contactId?.email && (
              <p className="text-xs text-zinc-500">{convo.contactId.email}</p>
            )}
          </div>

          <div className="space-y-3">
            {convo.messages
              .filter((m) => m.role !== "system")
              .map((m, i) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={i}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                        isUser
                          ? "bg-brand/20 text-zinc-100"
                          : "bg-white/[0.05] text-zinc-200"
                      }`}
                    >
                      <div className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                        {isUser ? "User" : "EarnGPT"}
                      </div>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {m.attachments.map((a, j) =>
                            a.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={j}
                                src={a.url}
                                alt={a.filename || "attachment"}
                                className="max-h-40 rounded-lg border border-white/[0.08]"
                              />
                            ) : (
                              <span
                                key={j}
                                className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-400"
                              >
                                {a.filename || a.mimeType}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      <div className="mt-1 text-[9px] text-zinc-600">
                        {m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            {convo.messages.filter((m) => m.role !== "system").length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-500">No messages yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
