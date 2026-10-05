"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  File as FileIcon,
  FileText,
  Film,
  Folder,
  Globe,
  ImageIcon,
  Loader2,
  Lock,
  Music,
  Pencil,
  Upload,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PickedFile } from "@/lib/clipboard-files";
import type { UploadProgress } from "@/lib/hooks/useCabinetUploadGestures";

/**
 * The chrome every cabinet shows for paste/drop uploads: the drop overlay, the
 * progress pill, and the review dialog that stands between a gesture and the
 * server. Kept in one file so the personal, organization, founder and floor
 * cabinets can't drift into four different-looking upload flows.
 */

export function CabinetDropOverlay({
  visible,
  targetName,
}: {
  visible: boolean;
  targetName?: string;
}) {
  if (!visible) return null;
  return (
    // pointer-events-none so the drop still lands on the container underneath.
    <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-[#1a1a1a]/90 px-10 py-8 text-center">
        <Upload className="h-10 w-10 text-brand" />
        <p className="text-base font-semibold text-white">
          Drop files or folders to upload
        </p>
        <p className="text-xs text-white/60">
          You&apos;ll get to review them before they go to{" "}
          <span className="text-white/85">{targetName || "this folder"}</span>
        </p>
      </div>
    </div>
  );
}

export function CabinetUploadProgress({
  progress,
}: {
  progress: UploadProgress | null;
}) {
  if (!progress) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 shadow-xl">
      <Loader2 className="h-4 w-4 animate-spin text-brand" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-white truncate max-w-[220px]">
          Uploading {progress.name}
        </p>
        <p className="text-[11px] text-white/50">
          {progress.done + 1} of {progress.total}
        </p>
      </div>
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 KB";
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function FileGlyph({ file }: { file: File }) {
  const type = file.type || "";
  const base = "h-4 w-4";
  if (type.startsWith("image/")) return <ImageIcon className={cn(base, "text-brand")} />;
  if (type.startsWith("video/")) return <Film className={cn(base, "text-[#52c41a]")} />;
  if (type.startsWith("audio/")) return <Music className={cn(base, "text-[#b37feb]")} />;
  if (type.includes("pdf") || type.startsWith("text/"))
    return <FileText className={cn(base, "text-[#fa8c16]")} />;
  return <FileIcon className={cn(base, "text-white/50")} />;
}

/** Mirrors the backend's `sharing.access` enum on a cabinet file. */
export type CabinetShareAccess = "office" | "public";

const SHARE_OPTIONS: Array<{
  value: CabinetShareAccess;
  icon: typeof Lock;
  title: string;
  hint: string;
}> = [
  {
    value: "office",
    icon: Lock,
    title: "Restricted to office",
    hint: "Only office members can open after signing in.",
  },
  {
    value: "public",
    icon: Globe,
    title: "Anyone with the link",
    hint: "Opens view-only in browser, no account required.",
  },
];

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Files waiting to be sent, in the order they were staged. */
  files: PickedFile[];
  /** Folder the batch lands in — shown so the target is never a guess. */
  destination: string;
  onRemove: (index: number) => void;
  /**
   * Renames a staged file before it is sent. Omitted on surfaces that don't
   * offer it — the row then has no pencil and double-click does nothing.
   */
  onRename?: (index: number, nextName: string) => void;
  onClear: () => void;
  onConfirm: () => void;
  /** Lets the user add more without leaving the dialog. */
  onAddFiles?: (files: File[]) => void;
  uploading: boolean;
  progress: UploadProgress | null;
  /**
   * False on surfaces that cannot create sub-folders, where a dropped folder's
   * files land flat in the open one. Said out loud rather than discovered
   * after the upload.
   */
  recreatesFolders?: boolean;
  /**
   * Share access every file in this batch gets once it lands. Omitted on
   * surfaces that don't manage sharing — the selector is then not rendered.
   */
  shareAccess?: CabinetShareAccess;
  onShareAccessChange?: (access: CabinetShareAccess) => void;
  /** Bytes left on the office's plan, when the page knows them. */
  remainingBytes?: number;
  /** Plan cap, used only to word the over-quota message. */
  storageLimit?: number;
  planSlug?: "starter" | "pro" | string;
}

/**
 * "Here is what you just pasted/dropped — send it?"
 *
 * Everything a gesture picks up passes through here: thumbnails so an image is
 * recognisable without its name, the folder each file came from, and a running
 * total checked against the plan's remaining space so a batch that cannot fit
 * is stopped before the first byte goes up.
 */
export function CabinetUploadReviewDialog({
  open,
  onOpenChange,
  files,
  destination,
  onRemove,
  onRename,
  onClear,
  onConfirm,
  onAddFiles,
  uploading,
  progress,
  recreatesFolders = true,
  shareAccess,
  onShareAccessChange,
  remainingBytes,
  storageLimit,
  planSlug,
}: ReviewDialogProps) {
  // Thumbnails for staged images. Revoked whenever the list changes so the
  // blobs do not leak across repeated pastes.
  const previews = useMemo(
    () =>
      files.map(({ file }) =>
        file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      ),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [previews]);

  const totalBytes = files.reduce((sum, { file }) => sum + (file.size || 0), 0);
  const folders = useMemo(() => {
    const set = new Set(
      files.map(({ relativePath }) => relativePath).filter(Boolean),
    );
    return Array.from(set).sort();
  }, [files]);

  const overQuota =
    typeof remainingBytes === "number" && totalBytes > remainingBytes;

  // Which row is being renamed, and what has been typed so far. Index-based:
  // the list can only change through onRemove/onAddFiles, both of which close
  // the editor first.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  // Escape unmounts the input, which fires blur on the way out. Without this
  // the cancel would immediately be undone by the blur-to-save.
  const skipBlurRef = useRef(false);

  // A closed dialog must not reopen mid-edit on a row that no longer exists.
  useEffect(() => {
    if (!open) setEditingIndex(null);
  }, [open]);

  const startRename = (index: number, currentName: string) => {
    if (!onRename || uploading) return;
    skipBlurRef.current = false;
    setEditingIndex(index);
    setDraftName(currentName);
  };

  const commitRename = (index: number) => {
    setEditingIndex(null);
    const next = draftName.trim();
    if (next) onRename?.(index, next);
  };

  const cancelRename = () => {
    skipBlurRef.current = true;
    setEditingIndex(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // An upload in flight owns the list — closing mid-batch would drop the
        // files still queued behind the one being sent.
        if (uploading) return;
        onOpenChange(next);
      }}
    >
      {/* `min-w-0` throughout: DialogContent is a grid, and grid items default
          to min-width:auto, so one long file or folder name would push the
          panel wider than its max width instead of truncating. */}
      <DialogContent className="bg-[#121216] border-white/10 text-white max-w-[92vw] sm:max-w-lg mx-auto overflow-hidden">
        <DialogHeader className="min-w-0 pr-6">
          <DialogTitle className="text-base sm:text-lg font-bold truncate">
            {files.length === 0
              ? "Upload files"
              : files.length === 1
                ? "Upload 1 file"
                : `Upload ${files.length} files`}
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-3 pt-1">
          <p className="text-xs text-white/50 break-words">
            Going to{" "}
            <span className="text-white/85 font-medium">{destination}</span>
            {folders.length > 0 && (
              <>
                {" · "}
                {recreatesFolders
                  ? folders.length === 1
                    ? "1 folder will be recreated"
                    : `${folders.length} folders will be recreated`
                  : "folders will be flattened into this one"}
              </>
            )}
          </p>

          {folders.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {folders.slice(0, 6).map((folder) => (
                  <span
                    key={folder}
                    title={folder}
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-white/70"
                  >
                    <Folder className="h-3 w-3 shrink-0 text-[#fa8c16]" />
                    <span className="truncate">{folder}</span>
                  </span>
                ))}
                {folders.length > 6 && (
                  <span className="inline-flex items-center rounded-md px-2 py-1 text-[11px] text-white/45">
                    +{folders.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}

          {files.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/45">
              Nothing staged. Pick files below, or drop them anywhere on the
              page.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {files.map(({ file, relativePath }, index) => (
                <div
                  key={`${relativePath}/${file.name}-${file.lastModified}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2"
                >
                  {previews[index] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[index] as string}
                      alt={file.name}
                      className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
                      <FileGlyph file={file} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {editingIndex === index ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        onFocus={(event) => {
                          // Select the name without its extension — that is
                          // the part being replaced nine times out of ten.
                          const dot = event.target.value.lastIndexOf(".");
                          event.target.setSelectionRange(
                            0,
                            dot > 0 ? dot : event.target.value.length,
                          );
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRename(index);
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={() => {
                          if (skipBlurRef.current) {
                            skipBlurRef.current = false;
                            return;
                          }
                          commitRename(index);
                        }}
                        className="w-full rounded-md border border-brand/60 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-brand"
                      />
                    ) : (
                      <p
                        className={cn(
                          "truncate text-sm text-white",
                          onRename && !uploading && "cursor-text",
                        )}
                        title={onRename ? `${file.name} — double-click to rename` : file.name}
                        onDoubleClick={() => startRename(index, file.name)}
                      >
                        {file.name}
                      </p>
                    )}
                    <p className="truncate text-xs text-white/45">
                      {editingIndex === index
                        ? "Enter to save · Esc to cancel"
                        : formatBytes(file.size)}
                      {editingIndex !== index && relativePath
                        ? ` · ${
                            recreatesFolders
                              ? `${destination}/${relativePath}`
                              : `from ${relativePath}`
                          }`
                        : ""}
                    </p>
                  </div>
                  {onRename && editingIndex !== index && (
                    <button
                      type="button"
                      onClick={() => startRename(index, file.name)}
                      disabled={uploading}
                      title={`Rename ${file.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.08] hover:text-brand disabled:opacity-40"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      // Indexes shift on removal — an open editor would end up
                      // pointing at the wrong row.
                      setEditingIndex(null);
                      onRemove(index);
                    }}
                    disabled={uploading}
                    title={`Remove ${file.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add more without leaving the dialog. */}
          {onAddFiles && (
            <div>
              <input
                type="file"
                multiple
                id="cabinet-staged-add"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const picked = Array.from(event.target.files || []);
                  if (picked.length > 0) onAddFiles(picked);
                  // Reset so re-picking the same file fires onChange again.
                  event.target.value = "";
                }}
              />
              <label
                htmlFor="cabinet-staged-add"
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] py-2.5 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white",
                  uploading && "pointer-events-none opacity-50",
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Add more files
              </label>
            </div>
          )}

          {/* Share access for the batch. Set here so a file is never briefly
              live under the wrong access between upload and configuration. */}
          {shareAccess && onShareAccessChange && files.length > 0 && (
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                Share link access
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {SHARE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = shareAccess === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={uploading}
                      onClick={() => onShareAccessChange(option.value)}
                      className={cn(
                        "flex min-w-0 items-start gap-2 rounded-lg border p-2.5 text-left transition-all disabled:opacity-60",
                        active
                          ? "border-brand bg-brand/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/25",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          active ? "text-brand" : "text-white/45",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-white break-words">
                          {option.title}
                        </span>
                        <span className="block text-[11px] leading-snug text-white/45 break-words">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
            <span className="min-w-0 truncate text-white/50">
              {files.length} {files.length === 1 ? "item" : "items"} ·{" "}
              {formatBytes(totalBytes)}
            </span>
            {typeof remainingBytes === "number" && (
              <span
                className={cn(
                  "shrink-0",
                  overQuota ? "text-red-400" : "text-white/50",
                )}
              >
                {formatBytes(Math.max(0, remainingBytes))} free
              </span>
            )}
          </div>

          {overQuota && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-200">
                This batch is {formatBytes(totalBytes)} but only{" "}
                {formatBytes(Math.max(0, remainingBytes ?? 0))} is left
                {typeof storageLimit === "number"
                  ? ` of your ${formatBytes(storageLimit)} ${
                      planSlug === "pro" ? "Founders Office" : "Starter"
                    } plan`
                  : ""}
                . Remove a few files{planSlug === "pro" ? "" : ", or upgrade"} to
                continue.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => {
                onClear();
                onOpenChange(false);
              }}
              className="border-white/10 bg-transparent text-xs hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={uploading || files.length === 0 || overQuota}
              className="bg-brand text-xs font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)]"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {progress
                    ? `Uploading ${progress.done + 1} of ${progress.total}...`
                    : "Uploading..."}
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload to Cabinet
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
