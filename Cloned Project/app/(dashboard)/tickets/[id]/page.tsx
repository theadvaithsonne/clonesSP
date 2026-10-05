"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ticketsApi,
  uploadTicketFile,
  type Ticket,
  type TicketAttachment,
} from "@/lib/api/tickets";

const STATUS_PILL: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOnce = async (silent = false) => {
    try {
      const t = await ticketsApi.get(id);
      setTicket(t);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      await fetchOnce();
      setLoading(false);
    })();
    pollRef.current = setInterval(() => fetchOnce(true), 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) {
        toast.error(`${f.name}: type not supported`);
        return;
      }
    }
    setUploading(true);
    try {
      const up: TicketAttachment[] = [];
      for (const f of files) up.push(await uploadTicketFile(f));
      setReplyAttachments((prev) => [...prev, ...up].slice(0, 6));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    if (!reply.trim() && replyAttachments.length === 0) return;
    setSending(true);
    try {
      const updated = await ticketsApi.addMessage(
        ticket._id,
        reply.trim() || "(attachment)",
        replyAttachments,
      );
      setTicket(updated);
      setReply("");
      setReplyAttachments([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#08080e]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6384ff]" />
      </div>
    );
  }
  if (error || !ticket) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#08080e] text-white px-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
        <p className="text-sm text-zinc-300 mb-1">Couldn&apos;t open this ticket.</p>
        <Link
          href="/tickets"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#6384ff] hover:text-[#9fb5ff]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to support
        </Link>
      </div>
    );
  }

  const statusPill = STATUS_PILL[ticket.status] || STATUS_PILL.open;
  const composerHidden = ticket.status === "closed";

  return (
    <div className="min-h-screen bg-[#08080e] text-white">
      <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0e0e16]/95 backdrop-blur px-4 sm:px-8 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/tickets")}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white shrink-0"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {ticket.title}
          </p>
          <p className="text-[11px] text-zinc-500 truncate">
            #{ticket._id.slice(-6).toUpperCase()} ·{" "}
            {format(new Date(ticket.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusPill}`}
        >
          {ticket.status.replace("_", " ")}
        </span>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-6 pb-32">
        {/* Original post */}
        <Message
          authorRole="user"
          authorName={ticket.userName}
          body={ticket.description}
          attachments={ticket.attachments}
          createdAt={ticket.createdAt}
          highlight
        />

        {ticket.messages.length > 0 && (
          <div className="my-4 flex items-center gap-2">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
              {ticket.messages.length} repl
              {ticket.messages.length === 1 ? "y" : "ies"}
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        )}
        <div className="flex flex-col gap-3">
          {ticket.messages.map((m) => (
            <Message
              key={m._id}
              authorRole={m.authorRole}
              authorName={m.authorName}
              body={m.body}
              attachments={m.attachments}
              createdAt={m.createdAt}
            />
          ))}
        </div>

        {!composerHidden && (
          <form
            onSubmit={sendReply}
            className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
          >
            <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Reply
            </p>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={5000}
              rows={3}
              placeholder="Type your message…"
              className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50 leading-relaxed resize-y"
            />
            {replyAttachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {replyAttachments.map((a) => (
                  <div
                    key={a.key}
                    className="relative inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2 py-1.5"
                  >
                    {a.url && a.contentType?.startsWith("image/") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <span className="text-[11px] text-white truncate max-w-[100px]">
                      {a.name || a.key.split("/").pop()}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReplyAttachments((prev) =>
                          prev.filter((p) => p.key !== a.key),
                        )
                      }
                      className="ml-1 flex h-4 w-4 items-center justify-center rounded text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-white/[0.04] disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
                Attach
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED.join(",")}
                multiple
                hidden
                onChange={handlePick}
              />
              <button
                type="submit"
                disabled={
                  sending || uploading || (!reply.trim() && replyAttachments.length === 0)
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#6384ff] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#7a96ff] disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </button>
            </div>
          </form>
        )}

        {composerHidden && (
          <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-zinc-500 text-center">
            This ticket is closed. Open a new one if you need more help.
          </div>
        )}
      </div>
    </div>
  );
}

function Message({
  authorRole,
  authorName,
  body,
  attachments,
  createdAt,
  highlight = false,
}: {
  authorRole: "user" | "admin";
  authorName: string;
  body: string;
  attachments: TicketAttachment[];
  createdAt: string;
  highlight?: boolean;
}) {
  const isAdmin = authorRole === "admin";
  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isAdmin ? "bg-[#6384ff]/15" : "bg-white/[0.06]"
        }`}
      >
        {isAdmin ? (
          <Sparkles className="h-3.5 w-3.5 text-[#9fb5ff]" />
        ) : (
          <span className="text-[11px] font-semibold text-zinc-300">
            {(authorName || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white truncate">
            {authorName}
          </span>
          {isAdmin && (
            <span className="rounded-full bg-[#6384ff]/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#9fb5ff]">
              Admin
            </span>
          )}
          <span className="text-[10px] text-zinc-600">
            {format(new Date(createdAt), "MMM d · h:mm a")}
          </span>
        </div>
        <div
          className={`mt-1.5 rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            highlight
              ? "border-white/[0.1] bg-white/[0.04] text-zinc-100"
              : isAdmin
                ? "border-[#6384ff]/20 bg-[#6384ff]/[0.06] text-zinc-100"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-200"
          }`}
        >
          {body}
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a) => {
              const isImg = a.contentType?.startsWith("image/") && a.url;
              return isImg ? (
                <a
                  key={a.key}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-white/[0.1] hover:border-white/[0.2] transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.name || ""}
                    className="max-h-60 max-w-[260px] object-cover"
                  />
                </a>
              ) : (
                <a
                  key={a.key}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs text-white hover:bg-white/[0.06]"
                >
                  <span className="truncate max-w-[160px]">
                    {a.name || a.key.split("/").pop()}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
