"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, FileText, Loader2, ChevronDown } from "lucide-react";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";

export interface NoteItemData {
  id: string;
  title: string;
  icon?: string | null;
  parentId?: string | null;
  hasChildren?: boolean;
  isStarred?: boolean;
}

interface NotionDropdownItemProps {
  note: NoteItemData;
  onSelect: (noteId: string) => void;
  activeNoteId?: string;
  /** Overrides activeNoteId for row highlight (breadcrumb path segment at this level) */
  highlightNoteId?: string;
  allNotes?: NoteItemData[];
  depth?: number;
  /** Inside scrollable popovers — expand sub-pages inline instead of a flyout over the editor */
  preferInlineSubpages?: boolean;
}

export default function NotionDropdownItem({
  note,
  onSelect,
  activeNoteId,
  highlightNoteId,
  allNotes = [],
  depth = 0,
  preferInlineSubpages = false,
}: NotionDropdownItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpandedInline, setIsExpandedInline] = useState(false);
  const [subPages, setSubPages] = useState<NoteItemData[]>([]);
  const [loading, setLoading] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // Check if note has children from local list or from note.hasChildren flag
  const localChildren = (allNotes || []).filter((n) => n.parentId === note.id);
  const hasSubPages = note.hasChildren === true || localChildren.length > 0;

  const loadSubPages = useCallback(async () => {
    if (localChildren.length > 0) {
      const formatted = localChildren
        .filter((c) => !c.isStarred /* or any flags */)
        .map((c) => ({
          id: c.id,
          title: c.title?.trim() || "Untitled",
          icon: c.icon || null,
          parentId: c.parentId,
          hasChildren:
            c.hasChildren === true ||
            (allNotes || []).some((child) => child.parentId === c.id),
        }));
      setSubPages(formatted);
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch(
        buildExternalUrl(`notes?parentId=${encodeURIComponent(note.id)}&limit=50`)
      );
      if (response.ok) {
        const data = await response.json();
        const kids: NoteItemData[] = ((data.notes || []) as any[])
          .filter((n) => !n.isDeleted && !n.isArchived)
          .map((n) => ({
            id: n.id,
            title: n.title?.trim() || "Untitled",
            icon: n.icon || null,
            parentId: n.parentId,
            hasChildren: Boolean(n.hasChildren),
          }));
        setSubPages(kids);
      }
    } catch (e) {
      console.error("Failed to load subpages for note:", note.id, e);
    } finally {
      setLoading(false);
    }
  }, [note.id, localChildren, allNotes]);

  const updateFlyoutPos = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setFlyoutPos({
        top: Math.max(8, rect.top),
        left: rect.right + 4,
      });
    }
  };

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    if (hasSubPages) {
      hoverTimer.current = setTimeout(() => {
        if (preferInlineSubpages) {
          setIsExpandedInline(true);
          void loadSubPages();
          return;
        }
        updateFlyoutPos();
        setIsHovered(true);
        void loadSubPages();
      }, 80);
    } else {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setIsHovered(false);
      if (preferInlineSubpages) setIsExpandedInline(false);
    }, 200);
  };

  const toggleInlineExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasSubPages) return;
    setIsExpandedInline((prev) => {
      const next = !prev;
      if (next) void loadSubPages();
      return next;
    });
  };

  const isSelected = (highlightNoteId ?? activeNoteId) === note.id;

  return (
    <div
      className="relative w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => onSelect(note.id)}
        className={`w-full group px-2 py-1.5 flex items-center justify-between gap-2 rounded-[4px] text-[13px] transition-colors cursor-pointer text-left ${
          isSelected
            ? "bg-[#3a3a3a] text-zinc-100 font-medium"
            : isHovered
            ? "bg-[#3a3a3a]/70 text-zinc-100"
            : "text-zinc-300 hover:bg-[#3a3a3a]/70 hover:text-zinc-100"
        }`}
        style={{ paddingLeft: `${Math.max(10, depth * 14 + 10)}px` }}
      >
        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
          {note.icon ? (
            <span className="text-[13px] leading-none shrink-0">{note.icon}</span>
          ) : (
            <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0 stroke-[1.5]" />
          )}
          <span className="truncate">{note.title || "Untitled"}</span>
        </div>

        {hasSubPages && (
          <div
            onClick={toggleInlineExpand}
            className="p-0.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
            title="Toggle subpages"
          >
            {isExpandedInline ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
      </button>

      {/* Inline Expanded Tree View */}
      {hasSubPages && isExpandedInline && (
        <div className="pl-3 border-l border-zinc-800 ml-3.5 my-0.5 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-2 text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : subPages.length > 0 ? (
            subPages.map((subNote) => (
              <NotionDropdownItem
                key={`inline-${subNote.id}`}
                note={subNote}
                onSelect={onSelect}
                activeNoteId={activeNoteId}
                allNotes={allNotes}
                depth={depth + 1}
                preferInlineSubpages={preferInlineSubpages}
              />
            ))
          ) : (
            <div className="px-2 py-1 text-[11px] text-zinc-500">No subpages</div>
          )}
        </div>
      )}

      {/* Floating Flyout Submenu via Portal — skip when inline expansion is preferred */}
      {hasSubPages && isHovered && !isExpandedInline && !preferInlineSubpages && mounted && flyoutPos && createPortal(
        <div
          data-notion-page-flyout
          style={{
            position: "fixed",
            top: `${flyoutPos.top}px`,
            left: `${flyoutPos.left}px`,
            zIndex: 100000,
          }}
          className="pointer-events-auto min-w-[220px] max-w-[300px] max-h-[320px] overflow-y-auto p-1 rounded-[8px] border border-white/[0.1] bg-[#2f2f2f] shadow-[0_8px_28px_rgba(0,0,0,0.55)] text-white space-y-0.5"
          onMouseEnter={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {loading ? (
            <div className="flex items-center justify-center py-3 text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          ) : subPages.length > 0 ? (
            subPages.map((subNote) => (
              <NotionDropdownItem
                key={`flyout-${subNote.id}`}
                note={subNote}
                onSelect={onSelect}
                activeNoteId={activeNoteId}
                allNotes={allNotes}
                depth={0}
                preferInlineSubpages={preferInlineSubpages}
              />
            ))
          ) : (
            <div className="px-2 py-2 text-[11px] text-zinc-500 text-center">
              No subpages
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
