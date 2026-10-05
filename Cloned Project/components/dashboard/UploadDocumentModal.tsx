"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { getOrgId } from "@/lib/auth";

interface Context {
  id: string;
  name: string;
  content: string;
  created_at: string;
}

/**
 * Successful upload response from the backend.
 *
 * Shape matches `UploadDocumentResponse` in
 * ``agent_manager/schemas/context.py``. ``warning`` is non-null when
 * the PDF-only heuristic detected that the document may be scanned
 * or image-based and would benefit from re-uploading with OCR.
 */
interface UploadResponse {
  context: Context;
  source_format: "pdf" | "docx";
  page_count: number;
  char_count: number;
  used_ocr: boolean;
  warning: string | null;
}

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired after a successful upload; parent prepends the new context
   * to its list and selects it. */
  onSuccess: (ctx: Context) => void;
  /** Same `authCurrent` headers prop the parent already passes to all
   * the other context API calls. */
  authCurrent: Record<string, string>;
}

// Keep in sync with MANUAL_CONTEXT_PDF_MAX_BYTES in backend config.py
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const PDF_EXTENSIONS = [".pdf"];
const DOCX_EXTENSIONS = [".docx"];
const PDF_MIMES = new Set(["application/pdf", "application/x-pdf"]);
const DOCX_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-docx",
]);

const ACCEPT_ATTR = [
  ...PDF_EXTENSIONS,
  ...DOCX_EXTENSIONS,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

/**
 * Classify a File by MIME type first, extension second. Returns
 * "pdf", "docx", or null for unsupported files. Matches the
 * server-side `_classify_upload` in ``agent_manager/routers/
 * context_router.py``.
 */
function classifyFile(file: File): "pdf" | "docx" | null {
  const type = (file.type || "").toLowerCase();
  if (PDF_MIMES.has(type)) return "pdf";
  if (DOCX_MIMES.has(type)) return "docx";
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  authCurrent,
}: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [nameOverride, setNameOverride] = useState("");
  const [useOcr, setUseOcr] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived format tag for UI affordances (the OCR toggle is only
  // shown for PDFs, for example).
  const format = useMemo(() => (file ? classifyFile(file) : null), [file]);

  const resetAll = useCallback(() => {
    setFile(null);
    setNameOverride("");
    setUseOcr(false);
    setUploading(false);
    setError(null);
    setWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    if (uploading) return; // prevent accidental dismissal mid-upload
    resetAll();
    onClose();
  }, [uploading, resetAll, onClose]);

  const setSelectedFile = useCallback((selected: File | null) => {
    setError(null);
    setWarning(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const cls = classifyFile(selected);
    if (!cls) {
      setError(
        `"${selected.name}" isn't a supported format. ` +
          `Upload a .pdf or .docx file.`
      );
      setFile(null);
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setError(
        `File is ${formatBytes(selected.size)}, which exceeds the ` +
          `${formatBytes(MAX_UPLOAD_BYTES)} upload limit.`
      );
      setFile(null);
      return;
    }
    if (selected.size === 0) {
      setError("Selected file is empty.");
      setFile(null);
      return;
    }
    setFile(selected);
    // OCR is only meaningful for PDFs; reset the toggle when a DOCX
    // is selected so the submit path doesn't send an unused param.
    if (cls !== "pdf") setUseOcr(false);
  }, []);

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = event.target.files?.[0];
    setSelectedFile(f || null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const f = event.dataTransfer.files?.[0];
    setSelectedFile(f || null);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  /**
   * POST the selected file (and options) to the backend's
   * `/api/openclaw/contexts/upload-document` proxy.
   *
   * Exposed as a standalone function so the warning banner's
   * "Retry with OCR" button can re-invoke it with ``forceOcr = true``
   * without asking the user to re-select the file.
   */
  const doUpload = useCallback(
    async (forceOcr = false) => {
      if (!file) return;
      setError(null);
      setWarning(null);
      setUploading(true);

      try {
        const orgId = getOrgId();
        const url = new URL(
          "/api/openclaw/contexts/upload-document",
          window.location.origin
        );
        if (orgId) url.searchParams.set("org_id", orgId);
        if (nameOverride.trim()) {
          url.searchParams.set("name", nameOverride.trim());
        }
        if (format === "pdf" && (forceOcr || useOcr)) {
          url.searchParams.set("use_ocr", "true");
        }

        const body = new FormData();
        body.append("file", file, file.name);

        // We do NOT set Content-Type here — the browser adds it
        // automatically with the correct multipart boundary when
        // the body is a FormData instance. Manually setting it
        // would strip the boundary and break parsing on the
        // FastAPI side.
        const headers = { ...authCurrent };
        delete (headers as any)["Content-Type"];
        delete (headers as any)["content-type"];

        const res = await fetch(url.toString(), {
          method: "POST",
          headers,
          body,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const detail =
            (data && (data.detail || data.error)) ||
            `Upload failed (HTTP ${res.status})`;
          setError(
            typeof detail === "string" ? detail : JSON.stringify(detail)
          );
          return;
        }

        const payload = data as UploadResponse;
        if (!payload?.context) {
          setError("Server returned an unexpected response shape.");
          return;
        }

        // Always call onSuccess — the context WAS created, even if a
        // warning is present. The warning is advisory ("consider
        // re-uploading with OCR for cleaner results"), not an error.
        onSuccess(payload.context);

        if (payload.warning) {
          // Keep the modal open so the user can see the warning and
          // decide whether to re-upload with OCR. The context is
          // already in their sidebar — they can also close the modal
          // and ignore the warning without losing work.
          setWarning(payload.warning);
          toast.success(
            `Imported ${payload.source_format.toUpperCase()} — but see the warning below`
          );
        } else {
          toast.success(
            `Imported ${payload.source_format.toUpperCase()} ` +
              `(${payload.page_count}p / ${payload.char_count.toLocaleString()} chars)`
          );
          handleClose();
        }
      } catch (err: any) {
        setError(
          err?.message ||
            "Network error while uploading. Check your connection and retry."
        );
      } finally {
        setUploading(false);
      }
    },
    [file, nameOverride, useOcr, format, authCurrent, onSuccess, handleClose]
  );

  const handleSubmit = () => doUpload(false);
  const handleRetryWithOcr = () => doUpload(true);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg mx-4 rounded-xl border border-[#2a2a35] bg-[#0c0c11] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a22]">
          <div className="flex items-center gap-2">
            <Upload className="h-3.5 w-3.5 text-brand" />
            <h2 className="text-[12px] font-semibold tracking-wide text-white">
              Upload document
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#16161f] text-[#5a5a72] hover:text-white transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Drop zone / file preview */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-lg px-6 py-8 text-center transition-colors ${
                isDragging
                  ? "border-brand/60 bg-brand/5"
                  : "border-[#2a2a35] hover:border-brand/40 hover:bg-[#0e0e14]"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-[#16161f] flex items-center justify-center">
                  <Upload className="h-4 w-4 text-[#9fa0b8]" />
                </div>
                <div className="text-[11px] font-medium text-[#c7c7da]">
                  Drop a file here or click to browse
                </div>
                <div className="text-[10px] text-[#5a5a72]">
                  PDF or DOCX · up to {formatBytes(MAX_UPLOAD_BYTES)}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-[#2a2a35] bg-[#0e0e14] px-3 py-2.5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-[#16161f] flex items-center justify-center shrink-0">
                <FileText className="h-3.5 w-3.5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-white truncate">
                  {file.name}
                </div>
                <div className="text-[10px] text-[#5a5a72]">
                  {formatBytes(file.size)} ·{" "}
                  <span className="uppercase">{format}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                disabled={uploading}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#16161f] text-[#5a5a72] hover:text-white transition-colors disabled:opacity-40"
                aria-label="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Name override */}
          {file && (
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-wider text-[#5a5a72] font-medium">
                Context name (optional)
              </label>
              <input
                type="text"
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                disabled={uploading}
                placeholder={file.name.replace(/\.(pdf|docx)$/i, "")}
                className="w-full rounded-md bg-[#15151c] border border-[#2a2a35] text-white text-[11px] px-2.5 py-1.5 placeholder:text-[#3a3a50] focus:outline-none focus:border-brand/40 transition-colors disabled:opacity-40"
              />
              <p className="text-[9px] text-[#3a3a50]">
                Leave blank to use the filename.
              </p>
            </div>
          )}

          {/* OCR toggle — PDF only */}
          {file && format === "pdf" && (
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useOcr}
                onChange={(e) => setUseOcr(e.target.checked)}
                disabled={uploading}
                className="mt-0.5 h-3 w-3 rounded border-[#2a2a35] bg-[#15151c] accent-brand cursor-pointer disabled:opacity-40"
              />
              <div className="flex-1">
                <div className="text-[11px] font-medium text-[#c7c7da] group-hover:text-white transition-colors">
                  Use OCR (Mistral)
                </div>
                <p className="text-[10px] text-[#5a5a72] leading-snug">
                  Enable for scanned, image-based, or heavily-formatted PDFs.
                  Takes 1-3 minutes. Leave off for born-digital text documents
                  — the local path is faster and free.
                </p>
              </div>
            </label>
          )}

          {/* Error banner */}
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[10px] text-red-300 leading-relaxed">
              {error}
            </div>
          )}

          {/* Warning banner (post-upload) */}
          {warning && (
            <div className="rounded-md border border-brand/30 bg-brand/5 px-3 py-2.5 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 text-brand mt-0.5 shrink-0" />
                <div className="text-[10px] text-brand/90 leading-relaxed">
                  {warning}
                </div>
              </div>
              {format === "pdf" && (
                <button
                  onClick={handleRetryWithOcr}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 text-[10px] font-medium transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  Retry with OCR
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#1a1a22]">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="h-7 px-3 text-[10px] rounded-md text-[#9fa0b8] border border-[#2a2a35] hover:text-white hover:border-[#3a3a4a] transition-colors disabled:opacity-40"
          >
            {warning ? "Done" : "Cancel"}
          </button>
          {!warning && (
            <button
              onClick={handleSubmit}
              disabled={uploading || !file}
              className="flex items-center gap-1.5 h-7 px-3 text-[10px] rounded-md bg-brand/10 text-brand border border-brand/30 hover:bg-brand/20 font-medium transition-colors disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {useOcr ? "Running OCR…" : "Extracting…"}
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Upload
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
