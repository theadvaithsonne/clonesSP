"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Globe, ExternalLink, X } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

function WebBookmarkRenderer({ block, editor }: { block: any; editor: any }) {
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
      const finalUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      setUrl(finalUrl);
      // Extract domain for display
      let domain = "";
      try {
        domain = new URL(finalUrl).hostname.replace("www.", "");
      } catch {
        domain = finalUrl;
      }
      editor.updateBlock(block, {
        props: { url: finalUrl, domain },
      });
      setIsEditing(false);
    }
  }, [inputValue, editor, block]);

  const removeBookmark = useCallback(() => {
    setUrl("");
    setInputValue("");
    setIsEditing(true);
    editor.updateBlock(block, { props: { url: "", domain: "" } });
  }, [editor, block]);

  if (isEditing || !url) {
    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-dashed border-zinc-700/60 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
            <Globe className="h-5 w-5 text-zinc-500" />
          </div>
          <div className="text-center">
            <p className="text-[12px] text-zinc-300 font-medium">
              Add a web bookmark
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Paste a URL to create a bookmark card
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
                placeholder="https://example.com"
                className="flex-1 bg-transparent text-[12px] text-zinc-200 focus:outline-none placeholder-zinc-600"
              />
            </div>
            <button
              onClick={saveUrl}
              disabled={!inputValue.trim()}
              className="px-3 py-2 text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  const domain = block.props?.domain || url.replace("https://", "").split("/")[0];

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden group hover:border-blue-500/30 transition-colors">
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Globe className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-zinc-200 font-medium truncate">
            {domain}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">{url}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeBookmark();
            }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-red-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Website preview thumbnail */}
      <div className="w-full h-32 bg-zinc-900/50 border-t border-zinc-800/60 flex items-center justify-center">
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt=""
          className="w-10 h-10 rounded-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    </div>
  );
}

export const webBookmarkBlock = createReactBlockSpec(
  {
    type: "webBookmark" as const,
    propSchema: {
      url: { default: "", type: "string" },
      domain: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <WebBookmarkRenderer block={block} editor={editor} />;
    },
  }
);
