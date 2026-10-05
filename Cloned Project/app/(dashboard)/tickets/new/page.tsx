"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ticketsApi,
  uploadTicketFile,
  type TicketAttachment,
  type TicketPriority,
} from "@/lib/api/tickets";

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const MAX_ATTACHMENTS = 6;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

export default function NewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`You can attach at most ${MAX_ATTACHMENTS} files.`);
      return;
    }
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
      setAttachments((prev) => [...prev, ...up]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const t = await ticketsApi.create({
        title: title.trim(),
        description: description.trim(),
        priority,
        attachments,
      });
      toast.success("Ticket created");
      router.replace(`/tickets/${t._id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080e] text-white">
      <div className="mx-auto max-w-2xl px-4 sm:px-8 py-8 pb-32">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to support
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
          New ticket
        </h1>
        <p className="mb-6 text-sm text-zinc-400">
          Tell us what&apos;s up. Screenshots help a lot.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Short summary"
              className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={6}
              placeholder="What happened? Steps to reproduce, what you expected…"
              className="w-full rounded-lg border border-white/[0.1] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#6384ff]/50 leading-relaxed resize-y"
            />
            <p className="mt-1 text-[10px] text-zinc-600 text-right">
              {description.length}/5000
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Priority
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map((p) => {
                const active = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-[#6384ff]/20 text-[#9fb5ff] border-[#6384ff]/40"
                        : "border-white/[0.1] text-zinc-400 hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Attachments
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {attachments.map((a) => (
                <div
                  key={a.key}
                  className="relative inline-flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2 py-1.5"
                >
                  {a.url && a.contentType?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.name || ""}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-white/[0.06]">
                      <ImageIcon className="h-4 w-4 text-zinc-400" />
                    </div>
                  )}
                  <span className="text-xs text-white truncate max-w-[140px]">
                    {a.name || a.key.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((p) => p.key !== a.key),
                      )
                    }
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {attachments.length < MAX_ATTACHMENTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.14] bg-white/[0.02] px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                  {uploading ? "Uploading…" : "Add image / PDF"}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED.join(",")}
              multiple
              hidden
              onChange={handlePick}
            />
            <p className="mt-1.5 text-[10px] text-zinc-600">
              Up to {MAX_ATTACHMENTS} files, 10MB each. PNG, JPG, WEBP, GIF, PDF.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Link
              href="/tickets"
              className="rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || uploading || !title.trim() || !description.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6384ff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a96ff] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Submit ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
