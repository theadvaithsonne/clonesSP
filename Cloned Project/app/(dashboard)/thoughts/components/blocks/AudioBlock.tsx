"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Music, Upload, X, Link2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { uploadFiles } from "@/utils/uploadthing";
import { toast } from "sonner";

function AudioRenderer({ block, editor }: { block: any; editor: any }) {
  const [url, setUrl] = useState(block.props?.url || "");
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(!block.props?.url);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUrl(block.props?.url || "");
    if (!block.props?.url) setShowInput(true);
  }, [block.props?.url]);

  useEffect(() => {
    if (showInput) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showInput]);

  const handleUrlSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      const finalUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      setUrl(finalUrl);
      editor.updateBlock(block, { props: { url: finalUrl } });
      setShowInput(false);
      setInputValue("");
    }
  }, [inputValue, editor, block]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select an audio file");
      return;
    }
    setUploading(true);
    try {
      const response = await uploadFiles("postVideos", { files: [file] });
      if (response && response[0]?.url) {
        const audioUrl = response[0].url;
        setUrl(audioUrl);
        editor.updateBlock(block, { props: { url: audioUrl } });
        setShowInput(false);
      }
    } catch {
      toast.error("Failed to upload audio");
    } finally {
      setUploading(false);
    }
  }, [editor, block]);

  const removeAudio = useCallback(() => {
    setUrl("");
    setShowInput(true);
    editor.updateBlock(block, { props: { url: "" } });
  }, [editor, block]);

  if (url) {
    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden group">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Music className="h-5 w-5 text-emerald-400" />
          </div>
          <audio
            src={url}
            controls
            className="flex-1 h-9 min-w-0"
            preload="metadata"
          >
            Your browser does not support audio playback.
          </audio>
          <button
            onClick={() => { setShowInput(true); setInputValue(url); }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-white transition-colors shrink-0"
            title="Change audio"
          >
            <Link2 className="h-3 w-3" />
          </button>
          <button
            onClick={removeAudio}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
            title="Remove"
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
            <Music className="h-5 w-5 text-zinc-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[12px] text-zinc-300 font-medium">Add audio</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Upload an audio file or paste a URL
          </p>
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
            accept="audio/*"
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
              placeholder="Paste audio URL..."
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

export const audioBlock = createReactBlockSpec(
  {
    type: "audio" as const,
    propSchema: {
      url: { default: "", type: "string" },
      name: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    meta: {
      fileBlockAccept: ["audio/*"],
    },
    runsBefore: ["file"],
    render: ({ block, editor }) => <AudioRenderer block={block} editor={editor} />,
  }
);
