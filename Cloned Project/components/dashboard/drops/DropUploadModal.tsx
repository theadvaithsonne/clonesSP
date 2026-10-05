"use client";

import { useState, useRef, useCallback } from "react";
import { api, API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { X, Link2, Upload, Loader2, AlertCircle, Info } from "lucide-react";

interface DropUploadModalProps {
  orgId: string;
  onClose: () => void;
  onCreated: (drop: any) => void;
}

export default function DropUploadModal({
  orgId,
  onClose,
  onCreated,
}: DropUploadModalProps) {
  const [mode, setMode] = useState<"choose" | "link" | "file">("choose");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Link Flow ─────────────────────────────────────
  const [linkChecking, setLinkChecking] = useState(false);

  /**
   * Read a direct video URL's duration via a detached <video> element.
   * Resolves null if the browser can't load it at all — which is the
   * signal that the link isn't a playable video file.
   */
  const probeVideoDuration = (url: string): Promise<number | null> =>
    new Promise((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      const done = (value: number | null) => {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.src = "";
        resolve(value);
      };
      probe.onloadedmetadata = () =>
        done(Number.isFinite(probe.duration) ? probe.duration : null);
      probe.onerror = () => done(null);
      // Don't hang the dialog on a URL that never resolves.
      setTimeout(() => done(null), 10000);
      probe.src = url;
    });

  const fetchLinkPreview = useCallback(async () => {
    const url = linkUrl.trim();
    if (!url) return;
    setError("");
    setLinkChecking(true);
    setLinkPreview(null);

    try {
      // Backend handles YouTube page scraping + Vimeo oEmbed to get accurate duration
      const data = await api<any>(
        `/drops/link-preview?url=${encodeURIComponent(url)}`,
        {},
        getToken()!
      );

      if (!data.success) {
        setError(data.error || "Could not verify this link");
        return;
      }

      // Duration check — block if over 60 seconds
      if (data.duration && data.duration > 60) {
        setError(`This video is ${Math.round(data.duration)}s long. Drops must be 60 seconds or less.`);
        return;
      }

      // Direct file links have no duration metadata from the server —
      // probe it in the browser so they can't sneak past the 60s limit.
      let duration = data.duration || 0;
      if (!duration && data.provider === "Direct Link") {
        duration = await probeVideoDuration(url);
        if (duration === null) {
          setError("Could not load this video. Check the URL is a direct link to a video file.");
          return;
        }
        if (duration > 60) {
          setError(`This video is ${Math.round(duration)}s long. Drops must be 60 seconds or less.`);
          return;
        }
      }

      setLinkPreview({
        duration: Math.round(duration) || 0,
        thumbnail: data.thumbnail || "",
        title: data.title || "",
        provider: data.provider || "",
      });
    } catch {
      setError("Could not verify this link. Please check the URL.");
    } finally {
      setLinkChecking(false);
    }
  }, [linkUrl]);

  const submitLink = async () => {
    if (!linkUrl.trim()) return;

    // If we have preview with duration > 60, block
    if (linkPreview?.duration && linkPreview.duration > 60) {
      setError("Video must be 60 seconds or less");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const data = await api<any>(
        `/drops?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            videoUrl: linkUrl.trim(),
            sourceType: "link",
            caption: caption.trim(),
            duration: linkPreview?.duration || 0,
            thumbnailUrl: linkPreview?.thumbnail || "",
          }),
        },
        getToken()!
      );
      if (data.success) {
        onCreated(data.drop);
        onClose();
      } else {
        setError(data.error || "Failed to create drop");
      }
    } catch (e: any) {
      setError(e.message || "Failed to create drop");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── File Flow ─────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Validate type
    const allowed = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowed.includes(file.type)) {
      setError("Only MP4, WebM, and MOV formats are supported");
      return;
    }


    // Validate duration via temp video element
    const url = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.onloadedmetadata = () => {
      if (tempVideo.duration > 60) {
        setError("Video must be 60 seconds or less");
        URL.revokeObjectURL(url);
        return;
      }
      setVideoDuration(Math.round(tempVideo.duration));
      setVideoPreviewUrl(url);
      setSelectedFile(file);
      setMode("file");
    };
    tempVideo.onerror = () => {
      setError("Could not read video file");
      URL.revokeObjectURL(url);
    };
    tempVideo.src = url;
  };

  const submitFile = async () => {
    if (!selectedFile) return;
    setIsSubmitting(true);
    setUploadProgress(0);
    setError("");

    try {
      // 1. Get presigned URL
      const presigned = await api<any>(
        `/drops/presigned-upload?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            contentType: selectedFile.type,
          }),
        },
        getToken()!
      );

      // 2. Upload to S3 via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed"));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", presigned.uploadUrl);
        xhr.setRequestHeader("Content-Type", selectedFile.type);
        xhr.send(selectedFile);
      });

      // 3. Create drop record
      const data = await api<any>(
        `/drops?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            videoS3Key: presigned.s3Key,
            sourceType: "upload",
            caption: caption.trim(),
            duration: videoDuration,
          }),
        },
        getToken()!
      );

      if (data.success) {
        onCreated(data.drop);
        onClose();
      } else {
        setError(data.error || "Failed to create drop");
      }
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#16161e",
          borderRadius: 16,
          width: "min(440px, 95vw)",
          maxHeight: "90vh",
          overflow: "auto",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h3 style={{ margin: 0, color: "white", fontSize: 16, fontWeight: 600 }}>
            New Drop
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {/* Mode Chooser */}
          {mode === "choose" && (
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setMode("link")}
                style={{
                  flex: 1,
                  padding: "28px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(124,138,255,0.1)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                }
              >
                <Link2 size={28} color="#7c8aff" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Paste Link</span>
                <span style={{ fontSize: 11, color: "#888" }}>YouTube, Vimeo, MP4</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  padding: "28px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(124,138,255,0.1)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                }
              >
                <Upload size={28} color="#7c8aff" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Upload Video</span>
                <span style={{ fontSize: 11, color: "#888" }}>Upload a short video</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>
          )}

          {/* Link Mode */}
          {mode === "link" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Supported-source notice — Instagram/TikTok links can't be
                  embedded, and used to fail silently after saving. */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid color-mix(in srgb, var(--brand) 25%, transparent)",
                  background: "color-mix(in srgb, var(--brand) 8%, transparent)",
                }}
              >
                <Info size={15} className="text-brand" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "#d8d8e0" }}>
                  Only <strong style={{ color: "#fff" }}>YouTube</strong> links (including
                  Shorts), <strong style={{ color: "#fff" }}>Vimeo</strong>, and direct video
                  files (.mp4, .webm, .mov) are supported, and the video must be{" "}
                  <strong style={{ color: "#fff" }}>60 seconds or less</strong>.
                  <br />
                  Instagram, TikTok and Facebook links can&apos;t be embedded — upload the
                  video file instead.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  placeholder="Paste video URL..."
                  value={linkUrl}
                  onChange={(e) => { setLinkUrl(e.target.value); setLinkPreview(null); }}
                  onKeyDown={(e) => e.key === "Enter" && fetchLinkPreview()}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                  }}
                  autoFocus
                />
                <button
                  onClick={fetchLinkPreview}
                  disabled={!linkUrl.trim() || linkChecking}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: !linkUrl.trim() || linkChecking ? "rgba(255,255,255,0.05)" : "var(--brand)",
                    color: !linkUrl.trim() || linkChecking ? "#666" : "var(--brand-foreground)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: !linkUrl.trim() || linkChecking ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {linkChecking ? <><Loader2 size={14} className="animate-spin" /> Checking…</> : "Verify"}
                </button>
              </div>
              {linkPreview && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 10,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {linkPreview.thumbnail && (
                    <img
                      src={linkPreview.thumbnail}
                      alt=""
                      style={{
                        width: 80,
                        height: 60,
                        borderRadius: 6,
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <div>
                    <div style={{ color: "white", fontSize: 13, fontWeight: 500 }}>
                      {linkPreview.title || "Video"}
                    </div>
                    <div style={{ color: "#888", fontSize: 11 }}>
                      {linkPreview.provider}
                      {linkPreview.author && ` · ${linkPreview.author}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Mode */}
          {mode === "file" && selectedFile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#000",
                  maxHeight: 200,
                }}
              >
                <video
                  src={videoPreviewUrl}
                  style={{ width: "100%", maxHeight: 200, objectFit: "contain" }}
                  muted
                  playsInline
                />
              </div>
              <div style={{ color: "#aaa", fontSize: 12 }}>
                {selectedFile.name} · {Math.round(selectedFile.size / 1024 / 1024)}MB ·{" "}
                {videoDuration}s
              </div>
              {isSubmitting && (
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${uploadProgress}%`,
                      background: "linear-gradient(90deg, #7c8aff, #a78bfa)",
                      transition: "width 0.3s",
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Caption — shown after choosing mode */}
          {mode !== "choose" && (
            <textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value.substring(0, 500))}
              rows={2}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 14,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Actions */}
          {mode !== "choose" && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 16,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setMode("choose");
                  setLinkUrl("");
                  setLinkPreview(null);
                  setSelectedFile(null);
                  setError("");
                }}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "#aaa",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Back
              </button>
              <button
                disabled={
                  isSubmitting ||
                  (mode === "link" && (!linkUrl.trim() || !linkPreview)) ||
                  (mode === "file" && !selectedFile)
                }
                onClick={mode === "link" ? submitLink : submitFile}
                style={{
                  padding: "8px 24px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    isSubmitting ||
                    (mode === "link" && (!linkUrl.trim() || !linkPreview)) ||
                    (mode === "file" && !selectedFile)
                      ? "rgba(124,138,255,0.3)"
                      : "linear-gradient(135deg, #7c8aff, #a78bfa)",
                  color: "white",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting
                  ? mode === "file"
                    ? `Uploading ${uploadProgress}%`
                    : "Creating..."
                  : "Create Drop"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
