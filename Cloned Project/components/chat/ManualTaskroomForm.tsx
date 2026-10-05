"use client";

// Inline manual task form for the group chat `/taskroom` slash command.
// Unlike the other slash forms it does NOT encode a chat marker — it POSTs
// straight to the group's linked Taskroom board and closes. GROUP CHAT ONLY:
// it's rendered by SlashCommandForm only when command === "taskroom", which
// the slash hook surfaces solely for group chats with a linked board.

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ImagePlus,
  Loader2,
  Play,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type Priority = "low" | "normal" | "high" | "urgent";

type UploadedAttachment = { fileUrl: string; fileName: string; fileType: string };

export interface ManualTaskroomMember {
  id: string;
  name: string;
}

interface ManualTaskroomFormProps {
  groupId: string;
  members: ManualTaskroomMember[];
  /** Member ids already on the board. When provided, others are flagged as
   *  "not on board" (the backend skips them and reports them in notAssigned). */
  syncedMemberIds?: string[];
  /** The signed-in user's id, marked "(you)" in the assignee list. */
  currentUserId?: string;
  uploadFile: (
    f: File
  ) => Promise<{ fileUrl: string; fileName: string; fileType: string; fileSize?: number }>;
  onCreated?: () => void;
  onClose: () => void;
}

type CreateTaskResponse = {
  ok: boolean;
  task: {
    taskId: string;
    roomId: string;
    spaceId?: string;
    workspaceId?: string;
    title: string;
    priority: string;
    assignees: { userId?: string; name: string }[];
    notAssigned: { userId?: string; name: string }[];
    attachmentCount: number;
  };
};

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function ManualTaskroomForm({
  groupId,
  members,
  syncedMemberIds,
  currentUserId,
  uploadFile,
  onCreated,
  onClose,
}: ManualTaskroomFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // A member set to test board membership quickly. Only meaningful when the
  // caller passes a non-empty syncedMemberIds; otherwise every member is
  // treated as on-board and the backend does the final filtering.
  const syncedSet = useMemo(
    () => (syncedMemberIds && syncedMemberIds.length ? new Set(syncedMemberIds) : null),
    [syncedMemberIds]
  );

  const filteredMembers = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, assigneeQuery]);

  function toggleAssignee(id: string) {
    setAssigneeIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function addFiles(files: File[]) {
    const media = files.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (media.length === 0) return;
    setUploading(true);
    try {
      for (const f of media) {
        const up = await uploadFile(f);
        setAttachments((prev) => [
          ...prev,
          { fileUrl: up.fileUrl, fileName: up.fileName, fileType: up.fileType },
        ]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    void addFiles(list);
    // Allow re-selecting the same file.
    e.target.value = "";
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (
        it.kind === "file" &&
        (it.type.startsWith("image/") || it.type.startsWith("video/"))
      ) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    const t = title.trim();
    if (!t || submitting || uploading) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<CreateTaskResponse>(`/groups/${groupId}/taskroom/task`, {
        method: "POST",
        body: JSON.stringify({
          title: t,
          description: description.trim() || undefined,
          priority,
          assigneeUserIds: assigneeIds,
          attachments,
        }),
      });
      const notAssigned = res.task?.notAssigned ?? [];
      toast.success(
        "Task added to Taskroom",
        notAssigned.length > 0
          ? {
              description: `${notAssigned.length} member${
                notAssigned.length === 1 ? "" : "s"
              } not on the board ${notAssigned.length === 1 ? "was" : "were"} skipped`,
            }
          : undefined
      );
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = !title.trim() || submitting || uploading;

  return (
    <div className="space-y-3" onPaste={onPaste}>
      <FieldLabel>Task</FieldLabel>
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="What needs to be done?"
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />

      <FieldLabel>Details (optional)</FieldLabel>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add context, links, or steps…"
        rows={3}
        className="bg-black/30 border-[#2E2E2E] text-xs resize-none"
      />

      {/* Images */}
      <div>
        <FieldLabel>Images &amp; videos (optional)</FieldLabel>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onFileInput}
          className="hidden"
        />
        {/* Thumbnails of what's been added */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {attachments.map((a, i) => (
              <div
                key={`${a.fileUrl}-${i}`}
                className="relative h-16 w-16 rounded-md overflow-hidden border border-[#2E2E2E] bg-black/30 group"
              >
                {a.fileType?.startsWith("video/") ? (
                  <>
                    <video
                      src={a.fileUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Play className="h-4 w-4 text-white/90 drop-shadow" />
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 text-white/80 hover:text-white flex items-center justify-center"
                  aria-label="Remove file"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Full-width dropzone: click to upload, or paste a screenshot anywhere
            in the form (the outer container handles onPaste). */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg border border-dashed border-[#2E2E2E] bg-black/20 hover:border-brand hover:bg-white/5 transition-colors flex flex-col items-center justify-center gap-1.5 py-5 px-3 text-center disabled:opacity-60"
        >
          <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/60">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </div>
          <div className="text-[12px] font-medium text-white/80">
            {uploading
              ? "Uploading…"
              : attachments.length
                ? "Add another file"
                : "Click to upload an image or video"}
          </div>
          <div className="text-[10px] text-white/40">
            or paste a screenshot directly (⌘/Ctrl + V)
          </div>
        </button>
      </div>

      {/* Assignees */}
      <div>
        <FieldLabel>Assignees ({assigneeIds.length})</FieldLabel>
        {members.length === 0 ? (
          <div className="text-[10px] text-white/40 rounded-md border border-[#2E2E2E] bg-black/30 px-2 py-2 text-center">
            No members in this group
          </div>
        ) : (
          <>
            <div className="relative mb-1.5">
              <Search className="h-3 w-3 text-white/30 absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                value={assigneeQuery}
                onChange={(e) => setAssigneeQuery(e.target.value)}
                placeholder="Search members…"
                className="bg-black/30 border-[#2E2E2E] text-xs pl-7 h-7"
              />
            </div>
            <div className="max-h-[132px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
              {filteredMembers.length === 0 && (
                <div className="text-[10px] text-white/40 px-2 py-2 text-center">
                  No matches
                </div>
              )}
              {filteredMembers.map((m) => {
                const checked = assigneeIds.includes(m.id);
                const notOnBoard = syncedSet ? !syncedSet.has(m.id) : false;
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(m.id)}
                      className="accent-brand"
                    />
                    <span className="text-[11px] text-white/80 truncate">
                      {m.name}
                      {m.id === currentUserId && (
                        <span className="text-white/40"> (you)</span>
                      )}
                    </span>
                    {notOnBoard && (
                      <span className="ml-auto text-[9px] text-amber-400/80 shrink-0">
                        not on board
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Priority */}
      <div>
        <FieldLabel>Priority</FieldLabel>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2"
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 rounded-md border border-red-900/50 bg-red-950/30 px-2.5 py-2 text-[11px] text-red-300">
          <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          onClick={() => void submit()}
          disabled={disabled}
          className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_83%,white)] text-brand-foreground text-xs h-8"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Creating…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Create
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1 mt-1">
      {children}
    </div>
  );
}

export default ManualTaskroomForm;
