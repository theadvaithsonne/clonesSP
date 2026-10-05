// components/ui/uploadthing-file-upload.tsx
//
// Direct-to-S3 file upload wrapper (public route). Component name kept
// as `UploadThingFileUpload` for API compatibility — ManageOrgPopover
// has 8 call sites, all with the same prop shape as when this really
// was an UploadThing wrapper. Internals now POST to the backend's
// public upload endpoint (`/uploads/public`, no auth) which streams
// the file into our own S3 bucket and returns the public URL.
//
// The `endpoint` prop is now decorative — the backend accepts any
// image regardless of intended use — but kept in the interface so the
// migration is a drop-in swap with no changes to call sites.
"use client";

import { useState, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";

interface UploadThingFileUploadProps {
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
  currentUrl?: string;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
  placeholder?: string;
  description?: string;
  endpoint: "organizationIcon" | "organizationCover" | "profilePicture";
  fieldName?: string; // Unique identifier to differentiate multiple uploads with same endpoint
}

export function UploadThingFileUpload({
  onUploadComplete,
  onRemove,
  currentUrl,
  accept = "image/*",
  maxSize = 5,
  className,
  placeholder = "Upload file",
  description,
  endpoint,
  fieldName,
}: UploadThingFileUploadProps) {
  const reactId = useId();
  const inputId = `file-input-${fieldName || endpoint}-${reactId}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Client-side size guard. BE re-enforces 5 MB independently, so a
    // tampered client can't sneak larger files through.
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      event.target.value = "";
      return;
    }

    // Client-side MIME guard. accept is a browser-style pattern
    // ("image/*"), so translate the trailing * to a regex .* before
    // matching. Not security-critical (BE has its own allow-list) —
    // just avoids uploading a rejected file only to fail server-side.
    if (accept !== "*" && !file.type.match(accept.replace("*", ".*"))) {
      setError("Invalid file type");
      event.target.value = "";
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/uploads/public`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.hint || "Upload failed");
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("Upload returned no URL");
      onUploadComplete(data.url);
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        (err as Error).message || "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    }
    setError(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn(
        "relative border-2 border-dashed rounded-lg text-center transition-colors duration-200",
        // p-6 was sized around the empty state's 48px upload glyph. With a
        // preview in the box that padding reads as a logo floating in space.
        currentUrl ? "p-3" : "p-6",
        isUploading
          ? "border-brand-2/50 bg-brand-2/5"
          : "border-[#2a2a35] hover:border-brand-2/50"
      )}>
        {isUploading && (
          <div className="absolute inset-0 bg-black/40 rounded-lg flex flex-col items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-brand-2 animate-spin" />
            <span className="text-sm text-white mt-2">Uploading...</span>
          </div>
        )}
        <div className={cn("flex flex-col items-center space-y-2", isUploading && "opacity-30")}>
          {currentUrl ? (
            // Full width + object-contain: a logo is usually wide, and the
            // old 48px object-cover square cropped it down to an unreadable
            // centre crop. The neutral tile behind it keeps a white-on-
            // transparent logo visible.
            <div className="relative w-full">
              <img
                src={currentUrl}
                alt="Uploaded"
                className="w-full max-h-28 object-contain rounded-lg bg-[#13131a] p-2"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-500 hover:bg-red-600 border-red-500"
                onClick={handleRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#2a2a35] flex items-center justify-center">
              <Upload className="h-6 w-6 text-[#9fa0b8]" />
            </div>
          )}

          <div className="text-sm text-[#c7c7da]">
            {currentUrl ? "File uploaded" : placeholder}
          </div>

          {description && (
            <div className="text-xs text-[#9fa0b8]">{description}</div>
          )}

          {error && <div className="text-xs text-red-400">{error}</div>}

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
            id={inputId}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45]"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            Choose File
          </Button>
        </div>
      </div>
    </div>
  );
}
