"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Image, Upload, X, Link2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { uploadFiles } from "@/utils/uploadthing";
import { toast } from "sonner";

function ImageRenderer({ block, editor }: { block: any; editor: any }) {
  const [url, setUrl] = useState(block.props?.url || "");
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(!block.props?.url);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (block.props?.url) {
      setUrl(block.props.url);
      setShowInput(false);
      setUploading(false);
      return;
    }
    // Paste/drop: BlockNote inserts with name first, then fills url after upload
    if (block.props?.name) {
      setUploading(true);
      setShowInput(false);
      return;
    }
    setUrl("");
    setShowInput(true);
    setUploading(false);
  }, [block.props?.url, block.props?.name]);

  useEffect(() => {
    if (showInput) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showInput]);

  const handleUrlSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      setUrl(trimmed);
      editor.updateBlock(block, { props: { url: trimmed } });
      setShowInput(false);
      setInputValue("");
    }
  }, [inputValue, editor, block]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setUploading(true);
    try {
      const response = await uploadFiles("postImages", { files: [file] });
      if (response && response[0]?.url) {
        const imageUrl = response[0].url;
        setUrl(imageUrl);
        editor.updateBlock(block, { props: { url: imageUrl } });
        setShowInput(false);
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }, [editor, block]);

  const removeImage = useCallback(() => {
    const prevUrl = url;
    setUrl("");
    setShowInput(true);
    editor.updateBlock(block, { props: { url: "" } });
    if (prevUrl && prevUrl.startsWith("http")) {
      try {
        fetch("/api/uploadthing/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: prevUrl }),
        }).catch(() => {});
      } catch {}
    }
  }, [editor, block, url]);

  if (url) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 group">
        <img
          src={url}
          alt={block.props?.name || block.props?.caption || ""}
          className="w-full h-auto max-h-96 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => { setShowInput(true); setInputValue(url); }}
            className="w-6 h-6 flex items-center justify-center rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white transition-colors"
            title="Change image"
          >
            <Link2 className="h-3 w-3" />
          </button>
          <button
            onClick={removeImage}
            className="w-6 h-6 flex items-center justify-center rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-red-400 transition-colors"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-dashed border-zinc-700/60 p-6 flex flex-col items-center gap-2">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[12px] text-zinc-400">Uploading image…</p>
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
            <Image className="h-5 w-5 text-zinc-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[12px] text-zinc-300 font-medium">Add an image</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Upload a file or paste an image URL</p>
        </div>
        <div className="flex items-center gap-2 w-full max-w-sm">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg disabled:opacity-30 transition-colors"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-lg border border-zinc-700/50 px-3 py-2">
            <Link2 className="h-3 w-3 text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              placeholder="Paste image URL..."
              className="flex-1 bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder-zinc-600"
            />
          </div>
          <button
            onClick={handleUrlSubmit}
            disabled={!inputValue.trim()}
            className="px-3 py-2 text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg disabled:opacity-30 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export const imageBlock = createReactBlockSpec(
  {
    type: "image" as const,
    propSchema: {
      url: { default: "", type: "string" },
      name: { default: "", type: "string" },
      caption: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    // Required so clipboard/drag image paste routes here instead of the file block
    meta: {
      fileBlockAccept: ["image/*"],
    },
    runsBefore: ["file"],
    render: ({ block, editor }) => <ImageRenderer block={block} editor={editor} />,
  }
);
