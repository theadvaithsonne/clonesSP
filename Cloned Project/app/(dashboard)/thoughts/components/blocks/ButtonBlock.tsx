"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

function ButtonRenderer({ block, editor }: { block: any; editor: any }) {
  const [label, setLabel] = useState(block.props?.label || "Create Task");
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLabel(block.props?.label || "Create Task");
  }, [block.props?.label]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    setIsEditing(false);
    if (label.trim() && label.trim() !== (block.props?.label || "Create Task")) {
      editor.updateBlock(block, { props: { label: label.trim() } });
    }
  }, [label, editor, block]);

  const handleClick = useCallback(() => {
    if (isEditing) return;
    // Button click action — insert a todo item below
    editor.insertBlocks(
      [
        {
          type: "checkListItem",
          content: [{ type: "text", text: label, styles: {} }],
        },
      ],
      block,
      "after"
    );
  }, [isEditing, label, editor, block]);

  return (
    <div className="w-full">
      <div className="inline-flex items-center group">
        {isEditing ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setLabel(block.props?.label || "Create Task");
                  setIsEditing(false);
                }
              }}
              className="bg-transparent text-[12px] text-emerald-300 font-medium px-3 py-1.5 focus:outline-none w-40"
            />
          </div>
        ) : (
          <button
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3.5 py-1.5 hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all cursor-pointer"
          >
            <Plus className="h-3 w-3 text-emerald-400" />
            <span className="text-[12px] text-emerald-400 font-medium">
              {label}
            </span>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(!isEditing);
          }}
          className="ml-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export const buttonBlock = createReactBlockSpec(
  {
    type: "button" as const,
    propSchema: {
      label: { default: "Create Task", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <ButtonRenderer block={block} editor={editor} />;
    },
  }
);
