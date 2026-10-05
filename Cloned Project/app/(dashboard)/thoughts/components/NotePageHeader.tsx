"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageIcon, MessageSquare, Smile, X } from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import NoteCoverPicker from "./NoteCoverPicker";
import {
  isGradientCover,
  pickRandomCover,
  renderCoverStyle,
} from "../lib/noteCoverGallery";

export interface NotePageHeaderProps {
  icon?: string | null;
  coverUrl?: string | null;
  coverPosition?: number | null;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (coverUrl: string | null) => void;
  onCoverPositionChange?: (position: number) => void;
  /** Show Add comment when comments section is hidden */
  showAddComment?: boolean;
  onAddComment?: () => void;
  /** Wraps icon + action row (not the cover) so cover can be full-bleed */
  contentClassName?: string;
}

/**
 * Notion-style page chrome: cover, large icon, and Add icon / cover / comment.
 */
export default function NotePageHeader({
  icon,
  coverUrl,
  coverPosition = 50,
  onIconChange,
  onCoverChange,
  onCoverPositionChange,
  showAddComment = true,
  onAddComment,
  contentClassName,
}: NotePageHeaderProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<DOMRect | null>(null);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repositioning, setRepositioning] = useState(false);
  const [dragY, setDragY] = useState(coverPosition ?? 50);

  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const iconBtnRef = useRef<HTMLButtonElement | null>(null);
  const changeBtnRef = useRef<HTMLButtonElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ y: number; pos: number } | null>(null);

  useEffect(() => {
    setDragY(coverPosition ?? 50);
  }, [coverPosition, coverUrl]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (emojiPanelRef.current?.contains(t)) return;
      if (emojiBtnRef.current?.contains(t)) return;
      if (iconBtnRef.current?.contains(t)) return;
      setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [emojiOpen]);

  const openEmoji = useCallback((el: HTMLButtonElement | null) => {
    if (!el) return;
    setEmojiAnchor(el.getBoundingClientRect());
    setEmojiOpen(true);
  }, []);

  const handleEmojiClick = useCallback(
    (data: EmojiClickData) => {
      onIconChange(data.emoji);
      setEmojiOpen(false);
    },
    [onIconChange]
  );

  const handleAddCover = useCallback(() => {
    const random = pickRandomCover();
    onCoverChange(random);
    // Open gallery after cover mounts (Notion: random cover, then change UI)
    window.setTimeout(() => setPickerOpen(true), 60);
  }, [onCoverChange]);

  const onCoverPointerDown = (e: React.PointerEvent) => {
    if (!repositioning || isGradientCover(coverUrl)) return;
    e.preventDefault();
    dragStart.current = { y: e.clientY, pos: dragY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onCoverPointerMove = (e: React.PointerEvent) => {
    if (!repositioning || !dragStart.current || !coverRef.current) return;
    const height = coverRef.current.clientHeight || 200;
    const delta = ((e.clientY - dragStart.current.y) / height) * 100;
    const next = Math.max(0, Math.min(100, dragStart.current.pos - delta));
    setDragY(next);
  };

  const onCoverPointerUp = () => {
    if (!repositioning) return;
    dragStart.current = null;
    onCoverPositionChange?.(dragY);
  };

  const finishReposition = () => {
    setRepositioning(false);
    onCoverPositionChange?.(dragY);
  };

  const actionClass =
    "inline-flex items-center gap-1.5 h-7 px-1.5 rounded-[4px] text-[13px] text-[#9b9b9b] border border-transparent " +
    "hover:bg-white/[0.055] hover:text-[#cfcfcf] " +
    "transition-[background-color,color,opacity] duration-[20ms] ease-in cursor-pointer select-none";

  const coverBtnClass =
    "h-7 px-2.5 rounded-[4px] text-[12px] text-white/90 bg-black/45 hover:bg-black/60 border border-white/10 backdrop-blur-sm transition-[background-color] duration-[20ms] ease-in";

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setHeaderHovered(true)}
      onMouseLeave={() => setHeaderHovered(false)}
    >
      {coverUrl ? (
        <div
          ref={coverRef}
          className={`relative w-full h-[30vh] min-h-[140px] max-h-[280px] mb-2 overflow-hidden ${
            repositioning && !isGradientCover(coverUrl) ? "cursor-ns-resize" : ""
          }`}
          style={renderCoverStyle(coverUrl, dragY)}
          onPointerDown={onCoverPointerDown}
          onPointerMove={onCoverPointerMove}
          onPointerUp={onCoverPointerUp}
        >
          {repositioning ? (
            <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
              <span className="text-[12px] text-white bg-black/55 px-3 py-1 rounded-full backdrop-blur-sm">
                Drag image to reposition ·{" "}
                <button
                  type="button"
                  className="underline pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    finishReposition();
                  }}
                >
                  Save position
                </button>
              </span>
            </div>
          ) : (
            <div
              className={`absolute top-3 right-3 flex items-center gap-1 transition-opacity duration-100 ${
                headerHovered || pickerOpen ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                ref={changeBtnRef}
                type="button"
                onClick={() => setPickerOpen(true)}
                className={coverBtnClass}
              >
                Change
              </button>
              {!isGradientCover(coverUrl) && onCoverPositionChange && (
                <button
                  type="button"
                  onClick={() => setRepositioning(true)}
                  className={coverBtnClass}
                >
                  Reposition
                </button>
              )}
              {!isGradientCover(coverUrl) && (
                <a
                  href={coverUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className={`${coverBtnClass} w-7 px-0 flex items-center justify-center`}
                  title="Download"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      ) : null}

      <NoteCoverPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(url) => onCoverChange(url)}
        onRemove={() => onCoverChange(null)}
        anchorRef={changeBtnRef}
      />

      <div className={contentClassName}>
      {icon ? (
        <div className={`relative ${coverUrl ? "-mt-10" : "mt-1"} mb-1`}>
          <button
            ref={iconBtnRef}
            type="button"
            onClick={() => openEmoji(iconBtnRef.current)}
            className="text-[78px] leading-none select-none rounded-md hover:bg-white/[0.04] px-1 transition-[background-color] duration-[20ms] ease-in cursor-pointer"
            title="Change icon"
          >
            {icon}
          </button>
          <button
            type="button"
            onClick={() => onIconChange(null)}
            className={`absolute -top-1 left-[4.5rem] h-6 w-6 flex items-center justify-center rounded-full bg-[#2f2f2f] border border-white/10 text-zinc-400 hover:text-white transition-opacity duration-100 ${
              headerHovered ? "opacity-100" : "opacity-0"
            }`}
            title="Remove icon"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-0.5 mb-1 min-h-[28px]">
        {!icon && (
          <button
            ref={emojiBtnRef}
            type="button"
            onClick={() => openEmoji(emojiBtnRef.current)}
            className={actionClass}
          >
            <Smile className="h-3.5 w-3.5 stroke-[1.75]" />
            Add icon
          </button>
        )}
        {!coverUrl && (
          <button type="button" onClick={handleAddCover} className={actionClass}>
            <ImageIcon className="h-3.5 w-3.5 stroke-[1.75]" />
            Add cover
          </button>
        )}
        {showAddComment && onAddComment && (
          <button type="button" onClick={onAddComment} className={actionClass}>
            <MessageSquare className="h-3.5 w-3.5 stroke-[1.75]" />
            Add comment
          </button>
        )}
      </div>
      </div>

      {emojiOpen &&
        emojiAnchor &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={emojiPanelRef}
            className="fixed z-[100000]"
            style={{
              top: Math.min(emojiAnchor.bottom + 6, window.innerHeight - 420),
              left: Math.min(emojiAnchor.left, window.innerWidth - 360),
            }}
          >
            <div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.55)] bg-[#1e1e1e]">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.DARK}
                width={350}
                height={400}
                searchDisabled={false}
                previewConfig={{ showPreview: false }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
