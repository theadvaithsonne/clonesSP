"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Video, Upload, X, Link2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { uploadFiles } from "@/utils/uploadthing";
import { toast } from "sonner";
import CustomVideoPlayer from "@/components/dashboard/CustomVideoPlayer";

function VideoRenderer({ block, editor }: { block: any; editor: any }) {
  const [url, setUrl] = useState(block.props?.url || "");
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(!block.props?.url);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPreview, setShowPreview] = useState(block.props?.showPreview !== false);

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
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    setUploading(true);
    try {
      const response = await uploadFiles("postVideos", { files: [file] });
      if (response && response[0]?.url) {
        const videoUrl = response[0].url;
        setUrl(videoUrl);
        editor.updateBlock(block, { props: { url: videoUrl } });
        setShowInput(false);
      }
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
    }
  }, [editor, block]);

  const removeVideo = useCallback(() => {
    const prevUrl = url;
    setUrl("");
    setShowInput(true);
    editor.updateBlock(block, { props: { url: "" } });
    if (prevUrl && !prevUrl.includes("youtube") && !prevUrl.includes("vimeo")) {
      try {
        fetch("/api/uploadthing/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: prevUrl }),
        }).catch(() => {});
      } catch {}
    }
  }, [editor, block, url]);

  const getEmbedUrl = (inputUrl: string) => {
    const youtubeMatch = inputUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    const vimeoMatch = inputUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return inputUrl;
  };

  if (url) {
    const embedUrl = getEmbedUrl(url);
    const isEmbed = embedUrl.includes("youtube.com/embed") || embedUrl.includes("vimeo.com/video");

    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden group">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          {isEmbed ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full border-0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              title="Video"
            />
          ) : (
            <CustomVideoPlayer
              src={url}
              autoPlay={false}
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={() => { setShowInput(true); setInputValue(url); }}
            className="w-6 h-6 flex items-center justify-center rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white transition-colors"
            title="Change video"
          >
            <Link2 className="h-3 w-3" />
          </button>
          <button
            onClick={removeVideo}
            className="w-6 h-6 flex items-center justify-center rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-red-400 transition-colors"
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
            <Video className="h-5 w-5 text-zinc-400" />
          )}
        </div>
        <div className="text-center">
          <p className="text-[12px] text-zinc-300 font-medium">Add a video</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Upload a file or paste a YouTube / Vimeo / direct URL
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
            accept="video/*"
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
              placeholder="Paste video URL..."
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

export const videoBlock = createReactBlockSpec(
  {
    type: "video" as const,
    propSchema: {
      url: { default: "", type: "string" },
      name: { default: "", type: "string" },
      showPreview: { default: true, type: "boolean" },
    },
    content: "none",
  },
  {
    meta: {
      fileBlockAccept: ["video/*"],
    },
    runsBefore: ["file"],
    render: ({ block, editor }) => <VideoRenderer block={block} editor={editor} />,
  }
);
