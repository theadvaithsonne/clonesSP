"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Loader2 } from "lucide-react";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";
import type { NoteBreadcrumbItem } from "../types";

export interface NotePagePreviewData {
  id: string;
  title: string;
  content?: string;
  parentId?: string | null;
  updatedAt?: string;
  createdAt?: string;
  isStarred?: boolean;
  breadcrumbs?: NoteBreadcrumbItem[];
}

interface NotePageHoverCardProps {
  noteId: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const previewCache = new Map<string, NotePagePreviewData>();

async function fetchNotePreview(noteId: string): Promise<NotePagePreviewData | null> {
  if (previewCache.has(noteId)) return previewCache.get(noteId)!;

  try {
    const [noteRes, crumbRes] = await Promise.all([
      authenticatedFetch(buildExternalUrl(`notes/${noteId}`)),
      authenticatedFetch(buildExternalUrl(`notes/${noteId}/breadcrumb`)),
    ]);

    if (!noteRes.ok) return null;
    const note = await noteRes.json();
    let breadcrumbs: NoteBreadcrumbItem[] = [];
    if (crumbRes.ok) {
      const crumbData = await crumbRes.json();
      breadcrumbs = crumbData.breadcrumbs || [];
    }

    const data: NotePagePreviewData = {
      id: note.id,
      title: note.title?.trim() || "Untitled",
      content: note.content,
      parentId: note.parentId || null,
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
      isStarred: note.isStarred,
      breadcrumbs,
    };
    previewCache.set(noteId, data);
    return data;
  } catch {
    return null;
  }
}

/** Notion-style path: First / … / Parent (excludes current page title) */
function breadcrumbPath(breadcrumbs: NoteBreadcrumbItem[] | undefined): string {
  if (!breadcrumbs || breadcrumbs.length === 0) return "";
  // API returns [...ancestors, current] — path shows ancestors only
  const ancestors = breadcrumbs.slice(0, -1);
  if (ancestors.length === 0) return "";
  if (ancestors.length === 1) return ancestors[0].title || "Untitled";
  if (ancestors.length === 2) {
    return `${ancestors[0].title || "Untitled"} / ${ancestors[1].title || "Untitled"}`;
  }
  const first = ancestors[0].title || "Untitled";
  const last = ancestors[ancestors.length - 1].title || "Untitled";
  return `${first} / ... / ${last}`;
}

/**
 * Notion-style hover preview: icon → breadcrumb path → page title.
 */
export default function NotePageHoverCard({
  noteId,
  children,
  className,
  disabled,
}: NotePageHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NotePagePreviewData | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, flipAbove: false });
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const positionCard = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cardWidth = 260;
    const gap = 4;
    let left = rect.left;
    let top = rect.bottom + gap;
    let flipAbove = false;

    if (left + cardWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - cardWidth - 12);
    }
    if (top + 160 > window.innerHeight && rect.top > 180) {
      top = rect.top - gap;
      flipAbove = true;
    }
    setCoords({ top, left, flipAbove });
  }, []);

  const show = useCallback(() => {
    if (disabled || !noteId) return;
    clearTimers();
    openTimer.current = setTimeout(async () => {
      positionCard();
      setOpen(true);
      if (previewCache.has(noteId)) {
        setData(previewCache.get(noteId)!);
        return;
      }
      setLoading(true);
      const preview = await fetchNotePreview(noteId);
      setData(preview);
      setLoading(false);
    }, 280);
  }, [disabled, noteId, positionCard]);

  const hide = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const keepOpen = useCallback(() => {
    clearTimers();
  }, []);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => positionCard();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, positionCard]);

  const path = breadcrumbPath(data?.breadcrumbs);
  const title = data?.title || "Untitled";

  return (
    <>
      <span
        ref={wrapRef}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {mounted &&
        open &&
        createPortal(
          <div
            onMouseEnter={keepOpen}
            onMouseLeave={hide}
            className="fixed z-[100000] w-[260px] rounded-[10px] border border-white/[0.08] bg-[#2f2f2f] shadow-[0_8px_30px_rgba(0,0,0,0.45)] overflow-hidden pointer-events-auto"
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.flipAbove ? "translateY(-100%)" : undefined,
            }}
          >
            {loading && !data ? (
              <div className="flex items-center justify-center gap-2 py-8 text-zinc-500 text-[12px]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            ) : data ? (
              <div className="px-3.5 pt-3.5 pb-3.5">
                <FileText
                  className="h-8 w-8 text-zinc-200 mb-2.5 stroke-[1.25]"
                  strokeWidth={1.25}
                />

                {path ? (
                  <p className="text-[11px] text-[#9b9b9b] truncate mb-0.5 leading-snug">
                    {path}
                  </p>
                ) : null}

                <p className="text-[14px] font-semibold text-white leading-snug truncate">
                  {title}
                </p>
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[12px] text-zinc-500">
                Couldn’t load this page
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/** Compact badge for page pickers: Sub-page vs Page */
export function PageTypeBadge({
  parentId,
  className,
}: {
  parentId?: string | null;
  className?: string;
}) {
  const isSub = Boolean(parentId);
  return (
    <span
      className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded ${
        isSub
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-zinc-700/60 text-zinc-400"
      } ${className || ""}`}
    >
      {isSub ? "Sub-page" : "Page"}
    </span>
  );
}
