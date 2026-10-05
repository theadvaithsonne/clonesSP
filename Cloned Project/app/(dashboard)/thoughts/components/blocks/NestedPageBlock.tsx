"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FileText, ChevronDown, Search, Loader2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import NotePageHoverCard, { PageTypeBadge } from "../NotePageHoverCard";

interface NoteRef {
  id: string;
  title: string;
  content?: string;
  parentId?: string | null;
}

function NestedPageRenderer({ block, editor }: { block: any; editor: any }) {
  const title = block.props?.title || "Untitled Page";
  const linkedNoteId = block.props?.linkedNoteId || "";
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showPageSelector, setShowPageSelector] = useState(!linkedNoteId);
  const [notes, setNotes] = useState<NoteRef[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const selectorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitleValue(block.props?.title || "Untitled Page");
  }, [block.props?.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (showPageSelector) {
      requestAnimationFrame(() => selectorInputRef.current?.focus());
    }
  }, [showPageSelector]);

  useEffect(() => {
    if (!showPageSelector) return;
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
              .map((n: any) => ({
                id: n.id,
                title: n.title || "Untitled",
                content: n.content,
                parentId: n.parentId || null,
              }))
          );
        }
      } catch {
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchNotes();
  }, [showPageSelector]);

  useEffect(() => {
    if (!showPageSelector) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPageSelector(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPageSelector]);

  useEffect(() => {
    if (!linkedNoteId || notes.length > 0) return;
    const fetchLinkedNote = async () => {
      try {
        const response = await authenticatedFetch(buildExternalUrl("notes"));
        if (response.ok) {
          const data = await response.json();
          const allNotes = (data.notes || []) as any[];
          const matched = allNotes.find((n: any) => n.id === linkedNoteId);
          if (matched) {
            const noteTitle = matched.title || "Untitled";
            setNotes((prev) => {
              if (prev.some((n) => n.id === linkedNoteId)) return prev;
              return [...prev, { id: matched.id, title: noteTitle, content: matched.content, parentId: matched.parentId || null }];
            });
            if (noteTitle !== block.props?.title) {
              editor.updateBlock(block, { props: { title: noteTitle } });
            }
          }
        }
      } catch {
        // silently ignore
      }
    };
    void fetchLinkedNote();
  }, [linkedNoteId, notes.length, editor, block]);

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(filter.toLowerCase()) && n.id !== linkedNoteId
  );

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue.trim() !== title) {
      editor.updateBlock(block, { props: { title: titleValue.trim() } });
    } else {
      setTitleValue(title);
    }
  }, [titleValue, title, editor, block]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTitleBlur();
      }
      if (e.key === "Escape") {
        setTitleValue(title);
        setIsEditingTitle(false);
      }
    },
    [handleTitleBlur, title]
  );

  const selectNoteLink = useCallback(
    (note: NoteRef) => {
      editor.updateBlock(block, {
        props: {
          linkedNoteId: note.id,
          title: note.title,
        },
      });
      setTitleValue(note.title);
      setShowPageSelector(false);
      setFilter("");

      // Notify parent page context to set parentId on the linked note
      window.dispatchEvent(
        new CustomEvent("thoughts:link-subpage", {
          detail: { childNoteId: note.id },
        })
      );
    },
    [editor, block]
  );

  const openLinkedPage = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();

      let targetId = linkedNoteId;

      // If no page is linked yet, auto-create a child note with this title
      if (!targetId) {
        try {
          const newContent = JSON.stringify([{ type: "paragraph", content: [] }]);
          const res = await authenticatedFetch(buildExternalUrl("notes"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: titleValue || "Untitled Page",
              content: newContent,
              color: "#ffffff",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            targetId = data.note?.id;
            if (targetId) {
              editor.updateBlock(block, {
                props: { linkedNoteId: targetId, title: titleValue || "Untitled Page" },
              });
            }
          }
        } catch (err) {
          console.error("Error auto-creating sub-page:", err);
        }
      }

      if (targetId) {
        window.dispatchEvent(
          new CustomEvent("thoughts:inline-navigate", {
            detail: { section: "open-page", noteId: targetId, reparentAsSubpage: true },
          })
        );
      }
    },
    [linkedNoteId, titleValue, editor, block]
  );

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(".nested-page-title-input") ||
        target.closest(".nested-page-selector") ||
        target.closest("button")
      ) {
        return;
      }
      openLinkedPage(e);
    },
    [openLinkedPage]
  );

  const linkedNote = notes.find((n) => n.id === linkedNoteId);
  const displayTitle = linkedNote ? linkedNote.title : titleValue;

  const card = (
    <div
      role={linkedNoteId ? "link" : undefined}
      tabIndex={linkedNoteId ? 0 : undefined}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (linkedNoteId && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          openLinkedPage();
        }
      }}
      className={`w-full rounded-[4px] group transition-colors ${
        linkedNoteId
          ? "hover:bg-[#2f2f2f] cursor-pointer"
          : "hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-2 px-1.5 py-1 w-full min-h-[32px]">
        <FileText
          className={`h-[18px] w-[18px] shrink-0 stroke-[1.5] ${
            linkedNoteId ? "text-zinc-300" : "text-zinc-500"
          }`}
        />
        <div className="flex flex-col flex-1 min-w-0 self-stretch justify-center">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="nested-page-title-input text-[15px] font-medium text-white leading-tight bg-zinc-800 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/20 w-full"
            />
          ) : (
            <span
              onClick={(e) => {
                if (linkedNoteId) {
                  // Navigate — do not stopPropagation so row click also works
                  openLinkedPage(e);
                  return;
                }
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              className={`text-[15px] font-medium leading-tight truncate block w-full ${
                linkedNoteId ? "text-white cursor-pointer" : "text-zinc-400"
              }`}
            >
              {displayTitle || "New page"}
            </span>
          )}
        </div>

        <div className="relative" ref={containerRef}>
          <div className="nested-page-selector flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPageSelector(!showPageSelector);
              }}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                showPageSelector
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
              title="Link a page"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {showPageSelector && (
            <div className="absolute top-full right-0 mt-1 z-[99999] w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden">
              <div className="px-2 pt-2 pb-1">
                <div className="flex items-center gap-1.5 bg-zinc-900 rounded px-2 py-1.5">
                  <Search className="h-3 w-3 text-zinc-500" />
                  <input
                    ref={selectorInputRef}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search pages..."
                    className="flex-1 bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder-zinc-500"
                  />
                  {loading && (
                    <Loader2 className="h-3 w-3 text-zinc-500 animate-spin" />
                  )}
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto px-1 pb-1">
                {!filter && !loading && linkedNoteId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.updateBlock(block, {
                        props: { linkedNoteId: "", title: "Untitled Page" },
                      });
                      setTitleValue("Untitled Page");
                      setShowPageSelector(false);
                      setFilter("");
                    }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    Remove link
                  </button>
                )}
                {!loading && filteredNotes.length === 0 && (
                  <div className="text-[10px] text-zinc-500 px-2 py-2">
                    {filter ? "No pages found" : "No pages available"}
                  </div>
                )}
                {filteredNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectNoteLink(note);
                    }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-300 hover:text-white hover:bg-zinc-700/50 rounded transition-colors"
                  >
                    <FileText className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                    <span className="truncate flex-1">{note.title}</span>
                    <PageTypeBadge parentId={note.parentId} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return linkedNoteId ? (
    <NotePageHoverCard
      noteId={linkedNoteId}
      className="block w-full"
      disabled={showPageSelector || isEditingTitle}
    >
      {card}
    </NotePageHoverCard>
  ) : (
    card
  );
}

export const nestedPageBlock = createReactBlockSpec(
  {
    type: "nestedPage" as const,
    propSchema: {
      title: { default: "Untitled Page", type: "string" },
      linkedNoteId: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <NestedPageRenderer block={block} editor={editor} />;
    },
  }
);
