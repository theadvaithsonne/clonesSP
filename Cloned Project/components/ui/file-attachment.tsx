"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image, File, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileAttachmentProps {
  onFileSelect: (file: File) => void;
  className?: string;
}

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-3 w-3" />;
    if (type.startsWith("video/")) return <FileText className="h-3 w-3" />;
    if (type.startsWith("audio/")) return <FileText className="h-3 w-3" />;
    if (type.includes("pdf")) return <FileText className="h-3 w-3" />;
    if (type.includes("word") || type.includes("document"))
      return <FileText className="h-3 w-3" />;
    if (type.includes("zip") || type.includes("rar"))
      return <FileText className="h-3 w-3" />;
    return <File className="h-3 w-3" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex items-center gap-2 p-1.5 bg-[#1a1a22] border border-[#2a2a35] rounded-md">
      <div className="text-[#c7c7da]">{getFileIcon(file.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white truncate">{file.name}</div>
        <div className="text-[10px] text-[#9fa0b8]">
          {formatFileSize(file.size)}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-5 w-5 p-0 text-[#9fa0b8] hover:text-red-400 hover:bg-red-500/10"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function FileAttachment({
  onFileSelect,
  className,
}: FileAttachmentProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      // Filter out duplicates based on name and size
      const newFiles = files.filter(
        (file) =>
          !selectedFiles.some(
            (existing) =>
              existing.name === file.name && existing.size === file.size
          )
      );

      if (newFiles.length > 0) {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
        newFiles.forEach((file) => onFileSelect(file));
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => removeFile(index)}
            />
          ))}
        </div>
      )} */}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-7 w-7 p-0 text-[#c7c7da] hover:text-white hover:bg-[#1a1a22] border border-transparent hover:border-[#363649] rounded-md"
          title="Attach file"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
