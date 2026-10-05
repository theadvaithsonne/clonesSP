"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Pencil, Loader2, Search } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import NotePageHoverCard, { PageTypeBadge } from "../NotePageHoverCard";

interface NoteRef {
  id: string;
  title: string;
  preview?: string;
  parentId?: string | null;
}

function openNote(noteId: string) {
  window.dispatchEvent(
    new CustomEvent("thoughts:inline-navigate", {
      detail: { section: "open-page", noteId },
    })
  );
}

function PageLinkPillRenderer({ block, editor }: { block: any; editor: any }) {
  const targetPage = block.props?.targetPage || "";
  const linkedNoteId = block.props?.linkedNoteId || "";

  const [showDropdown, setShowDropdown] = useState(!linkedNoteId);
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState<NoteRef[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  useEffect(() => {
    if (showDropdown) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showDropdown]);

  useEffect(() => {
    if (!showDropdown) return;
    const fetchNotes = async () => {
      setLoading(true);
      try {
        const response = await authenticatedFetch(buildExternalUrl("notes"));
        if (response.ok) {
          const data = await response.json();
          const allNotes = (data.notes || []) as any[];
          setNotes(
            allNotes
              .filter((n: any) => !n.isDeleted && !n.isArchived)
              .map((n: any) => {
                let preview = "";
                try {
                  const content =
                    typeof n.content === "string" ? JSON.parse(n.content) : n.content;
                  if (Array.isArray(content)) {
                    const firstParagraph = content.find(
                      (b: any) => b.type === "paragraph" && b.content?.length > 0
                    );
                    if (firstParagraph) {
                      preview = firstParagraph.content
                        .map((c: any) => c.text || "")
                        .join("")
                        .slice(0, 100);
                    }
                  }
                } catch {}
                return {
                  id: n.id,
                  title: n.title || "Untitled",
                  preview,
                  parentId: n.parentId || null,
                };
              })
          );
        }
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchNotes();
  }, [showDropdown]);

  const filteredNotes = notes.filter(
    (n) => n.title.toLowerCase().includes(filter.toLowerCase()) && n.id !== linkedNoteId
  );

  const selectPage = useCallback(
    (note: NoteRef) => {
      editor.updateBlock(block, {
        props: {
          targetPage: note.title,
          linkedNoteId: note.id,
          previewText: note.preview || "",
        },
      });
      setShowDropdown(false);
      setFilter("");
    },
    [editor, block]
  );

  const row = (
    <div
      ref={containerRef}
      className="relative w-full group"
    >
      <div
        role={linkedNoteId ? "link" : undefined}
        tabIndex={linkedNoteId ? 0 : undefined}
        onClick={() => {
          if (linkedNoteId) openNote(linkedNoteId);
          else setShowDropdown(true);
        }}
        onKeyDown={(e) => {
          if (linkedNoteId && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openNote(linkedNoteId);
          }
        }}
        className={`w-full rounded-[4px] transition-colors ${
          linkedNoteId
            ? "hover:bg-[#2f2f2f] cursor-pointer"
            : "hover:bg-white/[0.04] cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2 px-1.5 py-1 w-full min-h-[32px]">
          <FileText
            className={`h-[18px] w-[18px] shrink-0 stroke-[1.5] ${
              linkedNoteId ? "text-zinc-300" : "text-zinc-500"
            }`}
          />
          <span
            className={`text-[15px] font-medium leading-tight truncate flex-1 min-w-0 ${
              linkedNoteId ? "text-white" : "text-zinc-500"
            }`}
          >
            {targetPage || "Link to page"}
          </span>
          <button
            type="button"
            title="Change linked page"
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(true);
            }}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-all"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 z-[99999] w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <div className="flex items-center gap-1.5 bg-zinc-900 rounded px-2 py-1.5">
              <Search className="h-3 w-3 text-zinc-500" />
              <input
                ref={inputRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search pages..."
                className="flex-1 bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder-zinc-500"
              />
              {loading && <Loader2 className="h-3 w-3 text-zinc-500 animate-spin" />}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto px-1 pb-1">
            {!loading && filteredNotes.length === 0 && (
              <div className="text-[10px] text-zinc-500 px-2 py-2">
                {filter ? "No pages found" : "No pages available"}
              </div>
            )}
            {!loading &&
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectPage(note)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-300 hover:text-white hover:bg-zinc-700/50 rounded transition-colors"
                >
                  <FileText className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate">{note.title}</span>
                    {note.preview && (
                      <span className="text-[9px] text-zinc-500 truncate">{note.preview}</span>
                    )}
                  </div>
                  <PageTypeBadge parentId={note.parentId} />
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  return linkedNoteId ? (
    <NotePageHoverCard noteId={linkedNoteId} className="block w-full" disabled={showDropdown}>
      {row}
    </NotePageHoverCard>
  ) : (
    row
  );
}

export const pageLinkPillBlock = createReactBlockSpec(
  {
    type: "pageLinkPill" as const,
    propSchema: {
      targetPage: { default: "", type: "string" },
      linkedNoteId: { default: "", type: "string" },
      previewText: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <PageLinkPillRenderer block={block} editor={editor} />;
    },
  }
);
