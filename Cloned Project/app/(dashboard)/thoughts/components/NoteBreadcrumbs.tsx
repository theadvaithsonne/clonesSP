"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, FileText, Loader2 } from "lucide-react";
import { buildExternalUrl } from "@/lib/api-config";
import { authenticatedFetch } from "@/utils/api";

import NotionDropdownItem, { type NoteItemData } from "./NotionDropdownItem";

export interface BreadcrumbItem {
  id: string;
  title: string;
  icon?: string | null;
  hasChildren?: boolean;
  parentId?: string | null;
}

interface NoteBreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (noteId: string) => void;
  /** All loaded notes — used for instant sibling lookup */
  allNotes?: NoteItemData[];
  /** Currently open page id */
  activeNoteId?: string;
  /** Optional “Edited Xm ago” on the right (Notion top bar) */
  editedLabel?: string | null;
  className?: string;
}

type VisibleItem =
  | (BreadcrumbItem & { ellipsis?: false })
  | { id: string; title: string; ellipsis: true; hidden: BreadcrumbItem[] };

const FLYOUT_VISIBLE = 8;

function CrumbIcon({ icon, className = "" }: { icon?: string | null; className?: string }) {
  if (icon) {
    return <span className={`text-[13px] leading-none shrink-0 ${className}`}>{icon}</span>;
  }
  return <FileText className={`h-3.5 w-3.5 text-zinc-500 shrink-0 stroke-[1.5] ${className}`} />;
}

function truncateTitle(title: string, max = 14) {
  const t = title?.trim() || "Untitled";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(2, max - 1))}…`;
}

function mapNoteRow(n: {
  id: string;
  title?: string;
  icon?: string | null;
  parentId?: string | null;
  hasChildren?: boolean;
}): NoteItemData {
  return {
    id: n.id,
    title: n.title?.trim() || "Untitled",
    icon: n.icon || null,
    parentId: n.parentId ?? null,
    hasChildren: Boolean(n.hasChildren),
  };
}

/**
 * Notion-style breadcrumbs: hover a segment → sibling pages dropdown,
 * items with sub-pages open a right-side flyout.
 */
export default function NoteBreadcrumbs({
  items,
  onNavigate,
  allNotes = [],
  activeNoteId,
  editedLabel,
  className = "",
}: NoteBreadcrumbsProps) {
  const [ellipsisOpen, setEllipsisOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [flyout, setFlyout] = useState<NoteItemData[]>([]);
  const [flyoutLoading, setFlyoutLoading] = useState(false);
  const [flyoutExpanded, setFlyoutExpanded] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement | null>(null);
  const crumbBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ellipsisOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setEllipsisOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ellipsisOpen]);

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  /** Siblings of the hovered breadcrumb segment (Notion shows peers, not children). */
  const loadFlyout = useCallback(
    async (item: BreadcrumbItem) => {
      setFlyoutLoading(true);
      setFlyoutExpanded(false);
      const parentKey = item.parentId ?? null;

      try {
        const localSiblings = (allNotes || [])
          .filter((n) => (n.parentId ?? null) === parentKey)
          .map((n) => ({
            ...mapNoteRow(n),
            hasChildren:
              n.hasChildren === true ||
              (allNotes || []).some((child) => child.parentId === n.id),
          }));

        if (localSiblings.length > 0) {
          setFlyout(localSiblings);
          return;
        }

        const url = parentKey
          ? `notes?parentId=${encodeURIComponent(parentKey)}&limit=50`
          : "notes?parentId=null&limit=50";

        const res = await authenticatedFetch(buildExternalUrl(url));
        if (res.ok) {
          const data = await res.json();
          const siblings = ((data.notes || []) as any[])
            .filter((n) => !n.isDeleted && !n.isArchived)
            .map((n) => mapNoteRow(n));
          setFlyout(siblings.length > 0 ? siblings : [mapNoteRow(item)]);
          return;
        }

        setFlyout([mapNoteRow(item)]);
      } catch {
        setFlyout([mapNoteRow(item)]);
      } finally {
        setFlyoutLoading(false);
      }
    },
    [allNotes]
  );

  const openHover = (item: BreadcrumbItem) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      const btn = crumbBtnRefs.current.get(item.id);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        setFlyoutPos({ top: rect.bottom + 4, left: rect.left });
      }
      setHoverId(item.id);
      void loadFlyout(item);
    }, 120);
  };

  const keepHover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const scheduleClose = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    closeTimer.current = setTimeout(() => {
      setHoverId(null);
      setFlyout([]);
      setFlyoutPos(null);
      setFlyoutExpanded(false);
    }, 160);
  };

  const closeFlyout = () => {
    setHoverId(null);
    setFlyout([]);
    setFlyoutPos(null);
    setFlyoutExpanded(false);
  };

  const hoveredItem = hoverId ? items.find((item) => item.id === hoverId) : null;
  const parentTitle =
    hoveredItem?.parentId != null
      ? items.find((i) => i.id === hoveredItem.parentId)?.title ||
        allNotes.find((n) => n.id === hoveredItem.parentId)?.title
      : null;

  const visibleFlyout = flyoutExpanded ? flyout : flyout.slice(0, FLYOUT_VISIBLE);
  const hiddenCount = flyoutExpanded ? 0 : Math.max(0, flyout.length - FLYOUT_VISIBLE);

  if (!items || items.length === 0) return null;

  const visible: VisibleItem[] =
    items.length <= 6
      ? items.map((item) => ({ ...item, ellipsis: false as const }))
      : [
          { ...items[0], ellipsis: false as const },
          {
            id: "__ellipsis__",
            title: "...",
            ellipsis: true as const,
            hidden: items.slice(1, -3),
          },
          ...items.slice(-3).map((item) => ({ ...item, ellipsis: false as const })),
        ];

  const crumbBtn =
    "inline-flex items-center gap-1 h-6 max-w-[140px] px-1.5 rounded-[4px] text-[13px] text-zinc-400 " +
    "border border-transparent transition-[background-color,color] duration-[20ms] ease-in " +
    "hover:bg-[#373737] hover:text-zinc-100 cursor-pointer";

  return (
    <div
      className={`flex items-center justify-between gap-3 w-full min-h-[32px] ${className}`}
    >
      <nav
        aria-label="Page breadcrumbs"
        className="flex items-center flex-nowrap gap-x-0.5 text-[13px] select-none min-w-0"
      >
        {visible.map((item, index) => {
          const isLast = index === visible.length - 1;
          const isEllipsis = item.ellipsis === true;
          const isHovered = !isEllipsis && hoverId === item.id;

          return (
            <React.Fragment key={`${item.id}-${index}`}>
              {index > 0 && (
                <span className="text-zinc-600 shrink-0 px-0.5 text-[12px]">/</span>
              )}

              {isEllipsis ? (
                <div className="relative" ref={ellipsisRef}>
                  <button
                    type="button"
                    onClick={() => setEllipsisOpen((v) => !v)}
                    onMouseEnter={() => setEllipsisOpen(true)}
                    className={`${crumbBtn} min-w-[24px] justify-center ${
                      ellipsisOpen ? "bg-[#373737] text-zinc-100" : ""
                    }`}
                    aria-label="Show hidden pages"
                    aria-expanded={ellipsisOpen}
                  >
                    …
                  </button>

                  {ellipsisOpen && item.hidden.length > 0 && mounted && createPortal(
                    <div
                      data-notion-page-flyout
                      className="pointer-events-auto fixed z-[100000] min-w-[200px] max-w-[280px] p-1 rounded-[8px] border border-white/[0.08] bg-[#2f2f2f] shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
                      style={{
                        top: (ellipsisRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                        left: ellipsisRef.current?.getBoundingClientRect().left ?? 0,
                      }}
                      onMouseLeave={() => setEllipsisOpen(false)}
                    >
                      {item.hidden.map((hidden) => (
                        <button
                          key={hidden.id}
                          type="button"
                          onClick={() => {
                            setEllipsisOpen(false);
                            onNavigate(hidden.id);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-left text-[13px] text-zinc-200 hover:bg-[#3a3a3a] transition-colors duration-[20ms] ease-in"
                        >
                          <CrumbIcon icon={hidden.icon} />
                          <span className="truncate flex-1 min-w-0">
                            {hidden.title || "Untitled"}
                          </span>
                          <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                </div>
              ) : (
                <div
                  className="relative"
                  onMouseEnter={() => openHover(item)}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    ref={(el) => {
                      if (el) crumbBtnRefs.current.set(item.id, el);
                      else crumbBtnRefs.current.delete(item.id);
                    }}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    title={item.title}
                    className={`${crumbBtn} ${
                      isLast ? "text-zinc-200 font-medium" : "text-zinc-400"
                    } ${isHovered ? "bg-[#373737] text-zinc-100" : ""}`}
                  >
                    <CrumbIcon icon={item.icon} />
                    <span className="truncate">
                      {isLast
                        ? item.title || "New page"
                        : truncateTitle(item.title || "Untitled", index === 0 ? 18 : 12)}
                    </span>
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {mounted && hoverId && flyoutPos && hoveredItem
        ? createPortal(
            <div
              data-notion-page-flyout
              className="pointer-events-auto fixed z-[100000] min-w-[220px] max-w-[300px] rounded-[8px] border border-white/[0.1] bg-[#2f2f2f] shadow-[0_8px_28px_rgba(0,0,0,0.55)] overflow-hidden"
              style={{ top: flyoutPos.top, left: flyoutPos.left }}
              onMouseEnter={keepHover}
              onMouseLeave={scheduleClose}
            >
              {parentTitle ? (
                <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-zinc-500 truncate">
                  {parentTitle}
                </div>
              ) : !hoveredItem.parentId ? (
                <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-zinc-500">
                  Pages
                </div>
              ) : null}

              <div className="p-1 max-h-[320px] overflow-y-auto space-y-0.5">
                {flyoutLoading ? (
                  <div className="flex items-center justify-center py-4 text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </div>
                ) : (
                  <>
                    {visibleFlyout.map((row) => (
                      <NotionDropdownItem
                        key={row.id}
                        note={row}
                        activeNoteId={activeNoteId}
                        highlightNoteId={hoveredItem.id}
                        allNotes={allNotes}
                        onSelect={(selectedId) => {
                          closeFlyout();
                          onNavigate(selectedId);
                        }}
                      />
                    ))}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setFlyoutExpanded(true)}
                        className="w-full px-2.5 py-1.5 text-left text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-[#3a3a3a] rounded-[4px] transition-colors"
                      >
                        + {hiddenCount} more
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>,
            document.body
          )
        : null}

      {editedLabel ? (
        <span className="shrink-0 text-[12px] text-zinc-600 whitespace-nowrap">
          {editedLabel}
        </span>
      ) : null}
    </div>
  );
}
