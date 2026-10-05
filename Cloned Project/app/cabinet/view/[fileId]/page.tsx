"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Eye, File as FileIcon, Loader2 } from "lucide-react";

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

/**
 * Fallback viewer for a cabinet file shared by id.
 *
 * The normal share link is a tokenised `/f/<token>` URL. When the backend has
 * no share-link route for a file's cabinet tree, `useAffiliateShare` falls back
 * to this page so a copied link always resolves to something. Access is checked
 * server-side by the download endpoint: a viewer without permission gets the
 * error, not the file.
 *
 * View-only, like every share surface — the file renders here and there is no
 * download action. Unlike `/f/<token>` there is no office to join: this route
 * resolves a file by id inside the org the viewer is already signed into.
 *
 * `?ref=` rides along untouched — the signup flows read it from the URL.
 */

interface FileInfo {
  name?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
}

export default function CabinetFileViewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = params.fileId as string;
  const ref = searchParams.get("ref") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<FileInfo | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setError("Invalid link");
      setLoading(false);
      return;
    }

    if (!getToken()) {
      // `redirect` is the parameter the whole auth flow threads through, from
      // the OTP request to the workspace hand-off.
      const returnUrl = `/cabinet/view/${fileId}${ref ? `?ref=${ref}` : ""}`;
      router.push(
        `/login?flow=login&redirect=${encodeURIComponent(returnUrl)}`,
      );
      return;
    }

    const organizationId =
      typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id") || ""
        : "";

    // The personal route first, then the organization one: the id alone does
    // not say which cabinet tree the file lives in.
    const paths = [
      `/cabinet/files/${fileId}/download?organizationId=${organizationId}`,
      `/cabinet/organization/files/${fileId}/download?organizationId=${organizationId}`,
    ];

    let cancelled = false;
    (async () => {
      for (const path of paths) {
        try {
          const response = await api<{
            success: boolean;
            data: { downloadUrl: string; viewUrl?: string; file?: FileInfo };
          }>(path);
          if (cancelled) return;
          setViewUrl(response.data.viewUrl || response.data.downloadUrl);
          setFile(response.data.file || null);
          setLoading(false);
          return;
        } catch {
          // Try the next tree.
        }
      }
      if (!cancelled) {
        setError("File not found, or you don't have access to it");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, ref, router]);

  const name = file?.originalName || file?.name || "Shared file";
  const mimeType = file?.mimeType || "";
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  const isAudio = mimeType.startsWith("audio/");
  const isEmbeddable =
    mimeType.includes("pdf") ||
    mimeType.startsWith("text/") ||
    ["pdf", "txt", "md", "csv", "log", "json"].includes(extension);

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#141418] p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10 text-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <p className="text-sm">Loading file...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-base font-semibold text-red-400 mb-1">
              Can&apos;t open this file
            </p>
            <p className="text-sm text-white/60">{error}</p>
          </div>
        ) : (
          <div className="space-y-4" onContextMenu={(e) => e.preventDefault()}>
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                <FileIcon className="h-4 w-4 text-white/60" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{name}</p>
                {file?.size ? (
                  <p className="text-xs text-white/45">
                    {formatFileSize(file.size)}
                  </p>
                ) : null}
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                <Eye className="h-3.5 w-3.5" />
                View only
              </span>
            </div>

            {viewUrl && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewUrl}
                alt={name}
                draggable={false}
                className="w-full select-none rounded-lg border border-white/10"
              />
            ) : viewUrl && isVideo ? (
              <video
                src={viewUrl}
                controls
                controlsList="nodownload"
                disablePictureInPicture
                className="w-full rounded-lg border border-white/10"
              />
            ) : viewUrl && isAudio ? (
              <audio
                src={viewUrl}
                controls
                controlsList="nodownload"
                className="w-full"
              />
            ) : viewUrl && isEmbeddable ? (
              <iframe
                src={viewUrl}
                title={name}
                className="h-[70vh] w-full rounded-lg border border-white/10 bg-white"
              />
            ) : (
              <p className="py-6 text-center text-sm text-white/50">
                This file type can&apos;t be previewed in the browser. Shared
                links are view-only, so there&apos;s no download.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
