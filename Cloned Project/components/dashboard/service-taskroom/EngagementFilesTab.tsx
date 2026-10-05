"use client";

/**
 * The "Files" tab of a service engagement, shown when the founder enabled
 * `enableFilesTab`.
 *
 * One place for every file on the engagement, from three sources that mean
 * different things and are therefore kept apart:
 *  - shared with the client (the founder's milestone briefs and deliverables),
 *  - uploaded by the client,
 *  - attached to cards in the engagement room.
 *
 * The list arrives pre-filtered from `GET /services/opt-ins/:id/files`: files on
 * milestones the client has not unlocked never reach the browser, because the
 * stored URLs are directly fetchable and hiding the control would not be enough.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  KanbanSquare,
  Loader2,
  Lock,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatFileSize } from "../ServiceMediaCarousel";
import { getToken } from "@/lib/auth";
import {
  addMilestoneAttachments,
  getEngagementFiles,
  removeMilestoneAttachment,
  type EngagementFiles,
  type ServiceMilestoneAttachment,
  type ServiceOpt,
} from "@/lib/feed-api";

const MAX_CLIENT_FILES = 10;
const MAX_CLIENT_FILE_MB = 25;

function formatWhen(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** One row in any of the three lists. */
function FileRow({
  name,
  meta,
  url,
  onRemove,
}: {
  name: string;
  meta: string;
  url: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#2a2a35] bg-[#1F1F1F] p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#141414] text-[#9fa0b8]">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{name}</p>
        <p className="truncate text-[10px] text-[#6b6c85]">{meta}</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Preview"
        className="rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#141414] hover:text-white"
      >
        <Eye className="h-3.5 w-3.5" />
      </a>
      <a
        href={url}
        download
        target="_blank"
        rel="noopener noreferrer"
        title="Download"
        className="rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#141414] hover:text-brand"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="rounded-md p-1.5 text-[#9fa0b8] hover:bg-[#141414] hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  empty,
  children,
  action,
}: {
  icon: typeof FolderOpen;
  title: string;
  count: number;
  empty: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#2a2a35] bg-[#141414] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <span className="rounded bg-white/5 px-1.5 text-[10px] text-[#9fa0b8]">
            {count}
          </span>
        </div>
        {action}
      </div>

      {count === 0 ? (
        <p className="text-xs text-[#6b6c85]">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function EngagementFilesTab({
  optInId,
  isFounder = false,
  onOptInUpdated,
}: {
  optInId: string;
  isFounder?: boolean;
  /** Lets the parent keep its `optIn` copy in step with an upload or removal. */
  onOptInUpdated?: (optIn: ServiceOpt) => void;
}) {
  const [files, setFiles] = useState<EngagementFiles | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [targetMilestoneId, setTargetMilestoneId] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await getEngagementFiles(optInId);
      setFiles(result.files);
      setHidden(!result.files && result.reason === "hidden");

      // Default to the milestone still in play — the last one the client can
      // attach to — rather than a long-finished first milestone.
      const targets = result.files?.uploadTargets || [];
      setTargetMilestoneId((current) =>
        targets.some((target) => target.milestoneId === current)
          ? current
          : targets[targets.length - 1]?.milestoneId || "",
      );
    } catch (error) {
      console.error("[EngagementFiles] load failed:", error);
      setFiles(null);
    } finally {
      setLoading(false);
    }
  }, [optInId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (picked.length === 0 || !targetMilestoneId) return;

    const already = (files?.uploaded || []).filter(
      (file) => file.milestoneId === targetMilestoneId,
    ).length;
    const room = MAX_CLIENT_FILES - already;
    if (room <= 0) {
      toast.error(`Up to ${MAX_CLIENT_FILES} files per milestone`);
      return;
    }

    setUploading(true);
    try {
      const uploaded: ServiceMilestoneAttachment[] = [];
      for (const file of picked.slice(0, room)) {
        if (file.size > MAX_CLIENT_FILE_MB * 1024 * 1024) {
          toast.error(`${file.name}: over ${MAX_CLIENT_FILE_MB}MB`);
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body,
          },
        );
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        uploaded.push({
          name: file.name,
          url: data.url,
          size: file.size,
          contentType: file.type || undefined,
        });
      }

      if (uploaded.length > 0) {
        const { optIn } = await addMilestoneAttachments(
          optInId,
          targetMilestoneId,
          uploaded,
        );
        onOptInUpdated?.(optIn);
        await load();
        toast.success(
          uploaded.length === 1 ? "File shared" : `${uploaded.length} files shared`,
        );
      }
    } catch (error) {
      console.error("[EngagementFiles] upload failed:", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to upload file",
      );
    } finally {
      setUploading(false);
    }
  };

  const remove = async (milestoneId: string, url: string) => {
    try {
      const { optIn } = await removeMilestoneAttachment(
        optInId,
        milestoneId,
        url,
      );
      onOptInUpdated?.(optIn);
      await load();
    } catch (error) {
      console.error("[EngagementFiles] remove failed:", error);
      toast.error("Failed to remove file");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (hidden || !files) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2a2a35] px-6 py-14 text-center">
        <Lock className="mx-auto mb-3 h-5 w-5 text-[#6b6c85]" />
        <p className="text-sm font-semibold text-white">Files are not shared</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-[#6b6c85]">
          This service does not share a files area. Milestone documents are still
          on each milestone.
        </p>
      </div>
    );
  }

  const canUpload = files.uploadTargets.length > 0;

  return (
    <div className="space-y-4">
      <Section
        icon={FolderOpen}
        title="Shared with you"
        count={files.shared.length}
        empty="Nothing shared yet. Briefs and delivered work appear here as milestones progress."
      >
        {files.shared.map((file, index) => (
          <FileRow
            key={`${file.url}-${index}`}
            name={file.name}
            url={file.url}
            meta={[
              `M${file.milestoneOrder}: ${file.milestoneTitle}`,
              file.source === "brief" ? "Brief" : "Deliverable",
              formatFileSize(file.size),
              formatWhen(file.uploadedAt),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </Section>

      <Section
        icon={UserRound}
        title={isFounder ? "Uploaded by the client" : "Your uploads"}
        count={files.uploaded.length}
        empty={
          canUpload
            ? "Share briefs, assets or reference material against a milestone."
            : "Uploads open once a milestone is unlocked."
        }
        action={
          canUpload && (
            <div className="flex items-center gap-2">
              <select
                value={targetMilestoneId}
                onChange={(e) => setTargetMilestoneId(e.target.value)}
                className="max-w-[200px] truncate rounded-lg border border-[#2a2a35] bg-[#1F1F1F] px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand"
              >
                {files.uploadTargets.map((target) => (
                  <option key={target.milestoneId} value={target.milestoneId}>
                    M{target.order}: {target.title}
                  </option>
                ))}
              </select>
              <input
                ref={inputRef}
                type="file"
                multiple
                onChange={upload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || !targetMilestoneId}
                className="flex items-center gap-1.5 rounded-lg border border-[#2a2a35] bg-[#1F1F1F] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Upload
              </button>
            </div>
          )
        }
      >
        {files.uploaded.map((file, index) => (
          <FileRow
            key={`${file.url}-${index}`}
            name={file.name}
            url={file.url}
            meta={[
              `M${file.milestoneOrder}: ${file.milestoneTitle}`,
              formatFileSize(file.size),
              formatWhen(file.uploadedAt),
            ]
              .filter(Boolean)
              .join(" · ")}
            onRemove={
              isFounder ? undefined : () => remove(file.milestoneId, file.url)
            }
          />
        ))}
      </Section>

      <Section
        icon={KanbanSquare}
        title="From the taskroom"
        count={files.room.length}
        empty="No files attached to the engagement board yet."
      >
        {files.room.map((file) => (
          <FileRow
            key={file._id}
            name={file.name}
            url={file.url}
            meta={[file.fileType, formatWhen(file.uploadedAt)]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </Section>

      <p className={cn("px-1 text-[11px] text-[#6b6c85]")}>
        Files on milestones that are still locked are not listed here.
      </p>
    </div>
  );
}
