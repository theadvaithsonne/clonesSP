"use client";

import { useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/coverfi/uploadFile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
  /** css size for the preview thumbnail. Default 24 (h-24 w-24). */
  thumbClass?: string;
};

export default function ImageUpload({
  value,
  onChange,
  label,
  className,
  thumbClass = "h-24 w-24",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handlePick(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      onChange(url);
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative rounded-md overflow-hidden bg-[#15151b] border border-[#2a2a3a] flex items-center justify-center shrink-0",
          thumbClass,
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-[#9fa0b8]" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="text-xs text-[#9fa0b8]">{label}</div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              "Uploading…"
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {value ? "Replace" : "Upload"}
              </>
            )}
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange("")}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
