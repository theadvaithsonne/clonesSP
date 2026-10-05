"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Hexagon, Globe, X } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

function EmbedRenderer({ block, editor }: { block: any; editor: any }) {
  const [url, setUrl] = useState(block.props?.url || "");
  const [inputValue, setInputValue] = useState(block.props?.url || "");
  const [isEditing, setIsEditing] = useState(!block.props?.url);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUrl(block.props?.url || "");
    setInputValue(block.props?.url || "");
    if (!block.props?.url) setIsEditing(true);
  }, [block.props?.url]);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing]);

  const saveUrl = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      // Ensure https://
      const finalUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      setUrl(finalUrl);
      editor.updateBlock(block, { props: { url: finalUrl } });
      setIsEditing(false);
    }
  }, [inputValue, editor, block]);

  const removeEmbed = useCallback(() => {
    setUrl("");
    setInputValue("");
    setIsEditing(true);
    editor.updateBlock(block, { props: { url: "" } });
  }, [editor, block]);

  if (isEditing || !url) {
    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-dashed border-zinc-700/60 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-zinc-500" />
          </div>
          <div className="text-center">
            <p className="text-[12px] text-zinc-300 font-medium">
              Embed external content
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Paste any embed URL — Figma, CodePen, Google Maps, etc.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full max-w-sm">
            <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-lg border border-zinc-700/50 px-3 py-2">
              <Globe className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveUrl()}
                placeholder="https://..."
                className="flex-1 bg-transparent text-[12px] text-zinc-200 focus:outline-none placeholder-zinc-600"
              />
            </div>
            <button
              onClick={saveUrl}
              disabled={!inputValue.trim()}
              className="px-3 py-2 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Embed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden group">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/50 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <Hexagon className="h-3 w-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 truncate max-w-xs">{url}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setIsEditing(true); setInputValue(url); }}
            className="text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors px-1"
          >
            Change
          </button>
          <button
            onClick={removeEmbed}
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={url}
          className="absolute inset-0 w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          loading="lazy"
          title="Embedded content"
        />
      </div>
    </div>
  );
}

export const embedBlock = createReactBlockSpec(
  {
    type: "embed" as const,
    propSchema: {
      url: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <EmbedRenderer block={block} editor={editor} />;
    },
  }
);
