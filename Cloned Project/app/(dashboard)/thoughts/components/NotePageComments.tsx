"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { useUser } from "@/context/UserContext";

export interface NotePageComment {
  id: string;
  author: string;
  authorInitials: string;
  text: string;
  createdAt: string;
}

interface NotePageCommentsProps {
  comments: NotePageComment[];
  onChange: (comments: NotePageComment[]) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  readOnly?: boolean;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function initialsFromName(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Notion-style page comments that sit directly under the title. */
export default function NotePageComments({
  comments,
  onChange,
  onClose,
  autoFocus,
  readOnly = false,
}: NotePageCommentsProps) {
  const { name } = useUser();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  const add = useCallback(() => {
    if (!text.trim()) return;
    const comment: NotePageComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      author: name || "You",
      authorInitials: initialsFromName(name),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    onChange([...comments, comment]);
    setText("");
  }, [text, name, comments, onChange]);

  const remove = useCallback(
    (id: string) => {
      const next = comments.filter((c) => c.id !== id);
      onChange(next);
      if (next.length === 0 && onClose) onClose();
    },
    [comments, onChange, onClose]
  );

  const me = initialsFromName(name);

  return (
    <div className="w-full max-w-xl mb-6 space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5 group">
          <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center shrink-0">
            <span className="text-[10px] text-white font-semibold">
              {c.authorInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-[13px] text-zinc-200 font-medium">
                {c.author}
              </span>
              <span className="text-[11px] text-zinc-600">
                {formatTimeAgo(c.createdAt)}
              </span>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                title="Delete comment"
                hidden={readOnly}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[14px] text-zinc-300 leading-snug">{c.text}</p>
          </div>
        </div>
      ))}

      {!readOnly && (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-zinc-600 flex items-center justify-center shrink-0">
          <span className="text-[10px] text-white font-semibold">{me}</span>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape" && !text && comments.length === 0 && onClose) {
                onClose();
              }
            }}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none py-1"
          />
          {text.trim() && (
            <button
              type="button"
              onClick={add}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600/80 hover:bg-blue-600 text-white transition-colors duration-[20ms] ease-in"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
