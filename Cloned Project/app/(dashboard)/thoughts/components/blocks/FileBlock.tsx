"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { FileText, Upload, X, ExternalLink, File as FileIcon } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { uploadFiles } from "@/utils/uploadthing";
import { toast } from "sonner";

interface FileData {
  url: string;
  name: string;
  type: string;
  size?: number;
}

function FileRenderer({ block, editor }: { block: any; editor: any }) {
  const [fileData, setFileData] = useState<FileData | null>(() => {
    const url = block.props?.url || "";
    if (url)
      return {
        url,
        name: block.props?.fileName || block.props?.name || "File",
        type: block.props?.fileType || "",
        size: block.props?.fileSize,
      };
    return null;
  });
  const [showInput, setShowInput] = useState(!block.props?.url);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const url = block.props?.url || "";
    if (url) {
      setFileData({
        url,
        name: block.props?.fileName || block.props?.name || "File",
        type: block.props?.fileType || "",
        size: block.props?.fileSize,
      });
    } else {
      setFileData(null);
      setShowInput(true);
    }
  }, [block.props?.url, block.props?.fileName, block.props?.fileType, block.props?.name]);

  const handleFileUpload = useCallback(async (file: File) => {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be under 50MB");
      return;
    }
    setUploading(true);
    try {
      const endpoint = file.type === "application/pdf" ? "postDocuments" : "postDocuments";
      const response = await uploadFiles(endpoint, { files: [file] });
      if (response && response[0]?.url) {
        const data: FileData = {
          url: response[0].url,
          name: file.name,
          type: file.type,
          size: file.size,
        };
        setFileData(data);
        editor.updateBlock(block, {
          props: { url: data.url, fileName: data.name, fileType: data.type, fileSize: data.size },
        });
        setShowInput(false);
      }
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }, [editor, block]);

  const removeFile = useCallback(() => {
    setFileData(null);
    setShowInput(true);
    editor.updateBlock(block, { props: { url: "", fileName: "", fileType: "", fileSize: 0 } });
  }, [editor, block]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPDF = fileData?.type === "application/pdf" || fileData?.name?.endsWith?.(".pdf");

  if (fileData) {
    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden group">
        {isPDF && (
          <div className="relative w-full" style={{ paddingBottom: "75%" }}>
            <iframe
              src={fileData.url}
              className="absolute inset-0 w-full h-full border-0"
              title={fileData.name}
              loading="lazy"
            />
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2.5 border-t border-zinc-800/60">
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[12px] text-zinc-200 font-medium truncate block">{fileData.name}</span>
            <span className="text-[9px] text-zinc-500">
              {isPDF ? "PDF" : fileData.type.split("/")[1]?.toUpperCase() || "File"}
              {fileData.size ? ` · ${formatSize(fileData.size)}` : ""}
            </span>
          </div>
          <a
            href={fileData.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
          <button
            onClick={removeFile}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-dashed border-zinc-700/60 p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
          {uploading ? (
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileIcon className="h-5 w-5 text-zinc-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[12px] text-zinc-300 font-medium">Attach a file</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Upload any file — documents, PDFs, spreadsheets, etc.
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg disabled:opacity-30 transition-colors"
        >
          <Upload className="h-3 w-3" />
          {uploading ? "Uploading..." : "Choose file"}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
      </div>
    </div>
  );
}

export const fileBlock = createReactBlockSpec(
  {
    type: "file" as const,
    propSchema: {
      url: { default: "", type: "string" },
      name: { default: "", type: "string" },
      fileName: { default: "", type: "string" },
      fileType: { default: "", type: "string" },
      fileSize: { default: 0, type: "number" },
    },
    content: "none",
  },
  {
    // Catch-all for non-media files (images/video/audio match their own blocks first)
    meta: {
      fileBlockAccept: [
        "application/*",
        "text/*",
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".zip",
        ".rar",
      ],
    },
    render: ({ block, editor }) => <FileRenderer block={block} editor={editor} />,
  }
);
