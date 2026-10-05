"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Loader2 } from "lucide-react";
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

function MentionPageRenderer({ block, editor }: { block: any; editor: any }) {
  const pageName = block.props?.pageName || "";
  const linkedNoteId = block.props?.linkedNoteId || "";

  const [showPopover, setShowPopover] = useState(!linkedNoteId);
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState<NoteRef[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopover]);

  useEffect(() => {
    if (showPopover) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showPopover]);

  useEffect(() => {
    if (!showPopover) return;
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
  }, [showPopover]);

  const filtered = notes.filter(
    (n) => n.title.toLowerCase().includes(filter.toLowerCase()) && n.id !== linkedNoteId
  );

  const selectPage = useCallback(
    (note: NoteRef) => {
      editor.updateBlock(block, {
        props: {
          pageName: note.title,
          linkedNoteId: note.id,
          previewText: note.preview || "",
        },
      });
      setShowPopover(false);
      setFilter("");
    },
    [editor, block]
  );

  const pill = (
    <span
      onClick={() => {
        if (linkedNoteId) openNote(linkedNoteId);
        else setShowPopover(true);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowPopover(true);
      }}
      className={`inline-flex items-center gap-1.5 border rounded-full px-2 py-0.5 transition-colors ${
        linkedNoteId
          ? "bg-violet-500/15 border-violet-500/25 hover:bg-violet-500/20 cursor-pointer"
          : "bg-zinc-800/70 border-zinc-700/50 hover:bg-zinc-750 cursor-pointer"
      }`}
      title={linkedNoteId ? "Open page · right-click to relink" : "Choose a page"}
    >
      <FileText
        className={`h-3 w-3 shrink-0 ${linkedNoteId ? "text-violet-400" : "text-zinc-300"}`}
      />
      <span className="text-[11px] text-zinc-200 font-medium">
        {pageName || "Mention a page"}
      </span>
    </span>
  );

  return (
    <div className="w-full">
      <div className="relative inline-flex" ref={containerRef}>
        {linkedNoteId ? (
          <NotePageHoverCard noteId={linkedNoteId} disabled={showPopover}>
            {pill}
          </NotePageHoverCard>
        ) : (
          pill
        )}

        {showPopover && (
          <div className="absolute top-full left-0 mt-1 z-[99999] w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden">
            <div className="px-2 pt-2 pb-1">
              <div className="flex items-center gap-1.5 bg-zinc-900 rounded px-2 py-1.5">
                <FileText className="h-3 w-3 text-zinc-500" />
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
              {!loading && filtered.length === 0 && (
                <div className="text-[10px] text-zinc-500 px-2 py-2">
                  {filter ? "No pages found" : "No pages available"}
                </div>
              )}
              {!loading &&
                filtered.map((note) => (
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
    </div>
  );
}

export const mentionPageBlock = createReactBlockSpec(
  {
    type: "mentionPage" as const,
    propSchema: {
      pageName: { default: "", type: "string" },
      linkedNoteId: { default: "", type: "string" },
      previewText: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <MentionPageRenderer block={block} editor={editor} />;
    },
  }
);
