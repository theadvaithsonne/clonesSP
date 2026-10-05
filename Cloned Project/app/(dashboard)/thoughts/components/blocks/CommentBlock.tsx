"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { useUser } from "@/context/UserContext";

interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  text: string;
  timeAgo: string;
}

let commentIdCounter = 1;

function generateId() {
  return `comment-${commentIdCounter++}`;
}

function CommentRenderer({ block, editor }: { block: any; editor: any }) {
  const { name } = useUser();
  const [comments, setComments] = useState<Comment[]>(
    block.props?.comments ? JSON.parse(block.props.comments) : []
  );
  const [newText, setNewText] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (block.props?.comments) {
      try {
        setComments(JSON.parse(block.props.comments));
      } catch {
        setComments([]);
      }
    }
  }, [block.props?.comments]);

  const saveComments = useCallback(
    (updated: Comment[]) => {
      setComments(updated);
      editor.updateBlock(block, {
        props: { comments: JSON.stringify(updated) },
      });
    },
    [editor, block]
  );

  const addComment = useCallback(() => {
    if (!newText.trim()) return;
    const initials = name
      ? name
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "U";
    const comment: Comment = {
      id: generateId(),
      author: name || "You",
      authorInitials: initials,
      text: newText.trim(),
      timeAgo: "Just now",
    };
    saveComments([...comments, comment]);
    setNewText("");
  }, [newText, comments, name, saveComments]);

  const removeComment = useCallback(
    (id: string) => {
      saveComments(comments.filter((c) => c.id !== id));
    },
    [comments, saveComments]
  );

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
            COMMENTS
          </span>
          {comments.length > 0 && (
            <span className="text-[10px] text-zinc-600">
              {comments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Comment list */}
          {comments.map((comment) => {
            const bgColors = [
              "bg-purple-600",
              "bg-sky-600",
              "bg-emerald-600",
              "bg-rose-600",
              "bg-amber-600",
            ];
            const colorIndex =
              comment.author.charCodeAt(0) % bgColors.length;

            return (
              <div key={comment.id} className="flex gap-2.5 group">
                <div
                  className={`w-7 h-7 rounded-full ${bgColors[colorIndex]} flex items-center justify-center shrink-0`}
                >
                  <span className="text-[9px] text-white font-bold">
                    {comment.authorInitials}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] text-zinc-200 font-semibold">
                      {comment.author}
                    </span>
                    <span className="text-[9px] text-zinc-600">
                      {comment.timeAgo}
                    </span>
                    <button
                      onClick={() => removeComment(comment.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[12px] text-zinc-300 leading-relaxed">
                    {comment.text}
                  </p>
                </div>
              </div>
            );
          })}

          {comments.length === 0 && (
            <div className="text-center py-3">
              <MessageCircle className="h-6 w-6 text-zinc-700 mx-auto mb-1.5" />
              <p className="text-[10px] text-zinc-600">
                No comments yet. Add one below.
              </p>
            </div>
          )}

          {/* New comment input */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
              <span className="text-[8px] text-white font-bold">
                {name
                  ? name
                      .split(" ")
                      .map((w: string) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "U"}
              </span>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-zinc-900/50 rounded-lg px-2 py-1.5">
              <input
                ref={inputRef}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-transparent text-[11px] text-zinc-200 focus:outline-none placeholder-zinc-500"
              />
              <button
                onClick={addComment}
                disabled={!newText.trim()}
                className="w-5 h-5 flex items-center justify-center rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const commentBlock = createReactBlockSpec(
  {
    type: "comment" as const,
    propSchema: {
      comments: { default: "[]", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <CommentRenderer block={block} editor={editor} />;
    },
  }
);
