// components/ui/file-upload.tsx
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, Check } from "lucide-react";

interface FileUploadProps {
  onUpload: (file: File) => Promise<string>;
  onRemove?: () => void;
  currentUrl?: string;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
  placeholder?: string;
  description?: string;
}

export function FileUpload({
  onUpload,
  onRemove,
  currentUrl,
  accept = "image/*",
  maxSize = 5,
  className,
  placeholder = "Upload file",
  description,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Validate file type
    if (accept !== "*" && !file.type.match(accept.replace("*", ".*"))) {
      setError("Invalid file type");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const url = await onUpload(file);
      // The parent component should handle updating the URL
    } catch (err) {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
      <div className="border-2 border-dashed border-[#2a2a35] rounded-lg p-6 text-center hover:border-brand-2/50 transition-colors duration-200">
        <div className="flex flex-col items-center space-y-2">
          {currentUrl ? (
            <div className="relative">
              <img
                src={currentUrl}
                alt="Uploaded"
                className="w-12 h-12 rounded-lg object-cover"
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
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45]"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </div>
            ) : (
              "Choose File"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
