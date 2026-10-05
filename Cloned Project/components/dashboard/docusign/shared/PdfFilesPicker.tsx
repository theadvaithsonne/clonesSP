"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud, X } from "lucide-react";
import { MAX_PDF_BYTES, sha256Hex, uploadDocusignFile } from "@/lib/docusign/client";
import { MAX_BUNDLE_DOCUMENTS } from "@/lib/docusign/types";
import { INPUT, LABEL_MUTED } from "@/components/dashboard/docusign/shared/editorTokens";

// Shared by both upload dialogs (internal and external): pick 1..MAX_BUNDLE_DOCUMENTS PDFs, each with its own title.
// One file is an ordinary document; 2–3 become a group sent together (one email per person, signed one after
// another — see the backend's controllers/bundle.controller.js).

export interface PdfItem {
  id: string;
  file: File;
  title: string;
}

const titleFromName = (name: string) => name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200);
const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Fast-fail UX only — reads the first 5 bytes to confirm the "%PDF-" magic header before spending an upload
// round-trip on a renamed/fake file. The backend's own check is the real, authoritative one.
export const looksLikePdf = async (f: File): Promise<boolean> => {
  if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return false;
  const header = await f.slice(0, 5).text();
  return header === "%PDF-";
};

// Everything the dialogs check before uploading. Returns the first problem, or null.
export const pdfItemsProblem = async (items: PdfItem[]): Promise<string | null> => {
  if (!items.length) return "Choose a PDF to upload";
  if (items.length > MAX_BUNDLE_DOCUMENTS) return `You can send up to ${MAX_BUNDLE_DOCUMENTS} documents at once`;
  for (const item of items) {
    if (!item.title.trim()) return `Give "${item.file.name}" a title`;
    if (item.file.size > MAX_PDF_BYTES) return `"${item.file.name}" is over 25 MB`;
    if (!(await looksLikePdf(item.file))) return `"${item.file.name}" doesn't look like a real PDF`;
  }
  return null;
};

// Fingerprints then uploads each file, one after another (so progress is meaningful and a weak connection isn't
// asked to push three files at once). The fingerprint is of the exact bytes uploaded — see sha256Hex.
export const uploadPdfItems = async (items: PdfItem[], onProgress?: (done: number, total: number) => void) => {
  const out: Array<{ title: string; originalFileUrl: string; originalFileKey?: string; originalFileHash?: string }> = [];
  for (const [i, item] of items.entries()) {
    onProgress?.(i, items.length);
    const originalFileHash = await sha256Hex(item.file);
    const { url, key } = await uploadDocusignFile(item.file, item.file.name, "docusign");
    out.push({ title: item.title.trim(), originalFileUrl: url, originalFileKey: key, ...(originalFileHash ? { originalFileHash } : {}) });
  }
  onProgress?.(items.length, items.length);
  return out;
};

interface PdfFilesPickerProps {
  items: PdfItem[];
  onChange: (items: PdfItem[]) => void;
  disabled?: boolean;
}

export function PdfFilesPicker({ items, onChange, disabled }: PdfFilesPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const room = MAX_BUNDLE_DOCUMENTS - items.length;

  const addFiles = (list: FileList | null) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < files.length) toast.error("Only PDF files can be added");
    const small = pdfs.filter((f) => f.size <= MAX_PDF_BYTES);
    if (small.length < pdfs.length) toast.error("PDFs must be under 25 MB");
    if (small.length > room) toast.error(`You can send up to ${MAX_BUNDLE_DOCUMENTS} documents at once`);
    const added = small.slice(0, Math.max(0, room)).map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file, title: titleFromName(file.name) }));
    if (added.length) onChange([...items, ...added]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className={LABEL_MUTED}>PDF files</span>
        <span className="text-[11px] text-[#5a5a72]">
          {items.length}/{MAX_BUNDLE_DOCUMENTS}
        </span>
      </div>

      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-[#2a2a35] bg-[#0c0c10] p-2">
          <FileText className="h-4 w-4 shrink-0 text-[#7a7a90]" />
          <div className="min-w-0 flex-1 space-y-1">
            <input
              value={item.title}
              onChange={(e) => onChange(items.map((it) => (it.id === item.id ? { ...it, title: e.target.value } : it)))}
              maxLength={200}
              disabled={disabled}
              placeholder="Document title"
              aria-label={`Title for document ${idx + 1}`}
              className={`${INPUT} w-full`}
            />
            <p className="truncate text-[11px] text-white/40">
              {item.file.name} · {formatSize(item.file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(items.filter((it) => it.id !== item.id))}
            disabled={disabled}
            aria-label={`Remove ${item.file.name}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#7a7a90] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {room > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-[#2a2a35] bg-[#0c0c10] p-5 text-center text-xs text-[#8a8a9b] transition-colors hover:border-[#3b3b4a] disabled:opacity-60"
        >
          <UploadCloud className="h-6 w-6" />
          {items.length ? `Add another PDF (up to ${room} more)` : `Click to choose PDFs — up to ${MAX_BUNDLE_DOCUMENTS}`}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {items.length > 1 && (
        <p className="text-[11px] leading-relaxed text-[#7a7a90]">
          These {items.length} documents go out together to the same people — each person gets one email and signs them one after another.
        </p>
      )}
    </div>
  );
}
