"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  dragHasFiles,
  filesFromClipboard,
  filesFromDrop,
  isTypingTarget,
  toPickedFiles,
  type PickedFile,
} from "@/lib/clipboard-files";

/**
 * "Paste it or drop it and it lands in this folder" — shared by every cabinet
 * surface (personal, organization, founder, floor) so the gesture behaves the
 * same everywhere. Each page keeps its own upload endpoint and refresh; this
 * hook owns the gestures, the sequencing and the feedback.
 *
 * Neither gesture uploads on its own: both stage their files for review, so a
 * stray Cmd+V or a folder dropped on the wrong tab can be cancelled before
 * anything reaches the server.
 */

export interface UploadedCabinetFile {
  _id: string;
  name: string;
}

/** Where a staged file should land, resolved just before it is sent. */
export interface UploadTarget {
  /** Folder path inside the drop, "" for a file dropped on its own. */
  relativePath: string;
  /** Cabinet id `ensureFolder` resolved for that path, when the page has one. */
  cabinetId?: string;
}

interface Options {
  /** False while the page has no folder to upload into. */
  enabled: boolean;
  /**
   * Whether this user may upload here at all. Readiness (`enabled`) is worth a
   * "pick a folder first" toast; a missing permission is not — a member who
   * pastes a screenshot into a founder-only cabinet should get the browser's
   * ordinary paste, not a dialog they cannot use and an error at the end of it.
   * Defaults to true so surfaces that gate on `enabled` alone are unaffected.
   */
  canUpload?: boolean;
  /** Page-specific upload call. Rejecting marks that one file as failed. */
  uploadFile: (
    file: File,
    target: UploadTarget,
  ) => Promise<UploadedCabinetFile | null>;
  /**
   * Creates (or finds) the sub-folder a dropped directory needs and returns
   * its cabinet id. Called once per distinct path in a batch. Pages without
   * folder support leave it out and everything lands in the open folder.
   */
  ensureFolder?: (relativePath: string) => Promise<string | null>;
  /** Re-reads the folder so the new file appears without a manual reload. */
  refresh: () => Promise<void> | void;
  /** Runs after a successful batch — used for the affiliate share toast. */
  onUploaded?: (files: UploadedCabinetFile[]) => void;
  /** Shown when a gesture arrives while `enabled` is false. */
  disabledReason?: string;
  /**
   * Where pasted and dropped files go for review. The page stages them in the
   * upload dialog and calls `uploadFiles` when the user confirms. Without it
   * the gesture uploads straight away — kept only so a surface that has no
   * dialog still works.
   */
  onStageFiles?: (files: PickedFile[]) => void;
}

export interface UploadProgress {
  done: number;
  total: number;
  name: string;
}

/** Accepts either shape so callers can pass a plain picker `File[]`. */
function normalize(incoming: PickedFile[] | File[]): PickedFile[] {
  if (incoming.length === 0) return [];
  const first = incoming[0] as PickedFile | File;
  if (first instanceof File) return toPickedFiles(incoming as File[]);
  return (incoming as PickedFile[]).filter((item) => !!item?.file);
}

export function useCabinetUploadGestures({
  enabled,
  canUpload = true,
  uploadFile,
  ensureFolder,
  refresh,
  onUploaded,
  disabledReason,
  onStageFiles,
}: Options) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);

  // Drag events fire per element, so moving over a child reads as a leave.
  // Counting enter/leave pairs is what stops the overlay flickering.
  const dragDepthRef = useRef(0);

  // The listeners are bound once; everything they need is read through refs so
  // a folder change never leaves a stale closure behind.
  const optionsRef = useRef({
    enabled,
    canUpload,
    uploadFile,
    ensureFolder,
    refresh,
    onUploaded,
    disabledReason,
    onStageFiles,
  });
  optionsRef.current = {
    enabled,
    canUpload,
    uploadFile,
    ensureFolder,
    refresh,
    onUploaded,
    disabledReason,
    onStageFiles,
  };

  // Read through the ref by the listeners, which are bound once.
  const mayUpload = () => optionsRef.current.canUpload !== false;

  const uploadFiles = useCallback(
    async (incoming: PickedFile[] | File[]) => {
      const queue = normalize(incoming);
      if (queue.length === 0) return;

      const {
        enabled: ready,
        disabledReason: reason,
        ensureFolder: makeFolder,
      } = optionsRef.current;
      if (!ready || !mayUpload()) {
        toast.error(reason || "Open a folder before uploading");
        return;
      }

      setUploading(true);
      const uploaded: UploadedCabinetFile[] = [];
      const failed: string[] = [];

      // One folder lookup per distinct path, not per file: a dropped folder of
      // 40 images would otherwise try to create the same sub-folder 40 times.
      const folderIds = new Map<string, string | undefined>();
      const resolveFolder = async (relativePath: string) => {
        if (!relativePath || !makeFolder) return undefined;
        if (folderIds.has(relativePath)) return folderIds.get(relativePath);
        try {
          const id = await makeFolder(relativePath);
          folderIds.set(relativePath, id || undefined);
          return id || undefined;
        } catch (error) {
          console.error("Error creating folder for upload:", error);
          // Falling back to the open folder beats losing the file.
          folderIds.set(relativePath, undefined);
          return undefined;
        }
      };

      // One file at a time: the progress readout stays honest and one rejected
      // file cannot take the rest of the batch down with it.
      for (let i = 0; i < queue.length; i++) {
        const { file, relativePath } = queue[i];
        setUploadProgress({ done: i, total: queue.length, name: file.name });
        try {
          const cabinetId = await resolveFolder(relativePath);
          const result = await optionsRef.current.uploadFile(file, {
            relativePath,
            cabinetId,
          });
          uploaded.push(result || { _id: "", name: file.name });
        } catch (error) {
          console.error("Error uploading file:", error);
          failed.push(file.name);
        }
      }

      setUploadProgress(null);
      setUploading(false);

      if (uploaded.length > 0) {
        await optionsRef.current.refresh();
        optionsRef.current.onUploaded?.(uploaded);
      }

      if (failed.length === 1) {
        toast.error(`Failed to upload ${failed[0]}`);
      } else if (failed.length > 1) {
        toast.error(`Failed to upload ${failed.length} files`);
      }
    },
    [],
  );

  /** Stage if the page has a review dialog, otherwise send straight away. */
  const handleIncoming = useCallback(
    (files: PickedFile[]) => {
      if (files.length === 0) return;

      // A gesture from someone without permission was already dropped by the
      // handlers; this is the belt to that braces.
      if (!mayUpload()) return;

      const {
        enabled: ready,
        disabledReason: reason,
        onStageFiles: stage,
      } = optionsRef.current;

      if (!ready) {
        toast.error(reason || "Open a folder before uploading");
        return;
      }

      if (stage) {
        stage(files);
        return;
      }
      void uploadFiles(files);
    },
    [uploadFiles],
  );

  /** Ctrl/Cmd+V anywhere on the page — usually a screenshot. */
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // No permission, no interception — the paste stays the browser's, and
      // preventDefault is never reached.
      if (!mayUpload()) return;
      // Typing in a search box, rename field or editor stays a text paste.
      if (isTypingTarget(event.target)) return;

      const files = filesFromClipboard(event.clipboardData);
      if (files.length === 0) return;

      event.preventDefault();
      handleIncoming(toPickedFiles(files));
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleIncoming]);

  const onDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!mayUpload()) return;
    if (!dragHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    // Left un-prevented on purpose: the browser then refuses the drop itself
    // and shows the "no drop" cursor, which is the honest answer here.
    if (!mayUpload()) return;
    if (!dragHasFiles(event.dataTransfer)) return;
    // Without this the browser navigates to the dropped file instead.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (dragDepthRef.current === 0) return;
    event.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!mayUpload()) return;
      if (!dragHasFiles(event.dataTransfer)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);

      // Walking a dropped folder is async, and `dataTransfer` is emptied once
      // this handler returns — `filesFromDrop` grabs the entry list first.
      void filesFromDrop(event.dataTransfer).then(
        ({ files, truncated, unreadableDirectories }) => {
          if (unreadableDirectories > 0) {
            toast.error(
              unreadableDirectories === 1
                ? "This browser can't read dropped folders — skipped 1 folder"
                : `This browser can't read dropped folders — skipped ${unreadableDirectories} folders`,
            );
          }
          if (truncated) {
            toast.warning(
              `That folder is very large — staged the first ${files.length} files`,
            );
          }
          handleIncoming(files);
        },
      );
    },
    [handleIncoming],
  );

  return {
    isDraggingFiles,
    uploadProgress,
    uploading,
    uploadFiles,
    dropZoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
