"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Sigma } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

function MathRenderer({ block, editor }: { block: any; editor: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [expr, setExpr] = useState(block.props?.expression || "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setExpr(block.props?.expression || "");
  }, [block.props?.expression]);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isEditing]);

  const save = useCallback(() => {
    setIsEditing(false);
    if (expr.trim() && expr.trim() !== (block.props?.expression || "")) {
      editor.updateBlock(block, { props: { expression: expr.trim() } });
    }
  }, [expr, editor, block]);

  if (isEditing) {
    return (
      <div className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 p-4">
        <div className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase mb-2">
          MATH EXPRESSION
        </div>
        <input
          ref={inputRef}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setExpr(block.props?.expression || "");
              setIsEditing(false);
            }
          }}
          placeholder="Enter math expression..."
          className="w-full bg-zinc-900 text-[16px] text-emerald-300 font-mono rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-zinc-600 border border-zinc-700/50"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-zinc-600">
            Supports LaTeX notation
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setExpr(block.props?.expression || "");
                setIsEditing(false);
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="w-full bg-[#1E1E1E] rounded-lg border border-zinc-800/80 p-4 cursor-pointer hover:border-emerald-500/30 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sigma className="h-3.5 w-3.5 text-emerald-400/60" />
        <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
          MATH
        </span>
      </div>
      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/40 px-4 py-3">
        {expr ? (
          <span className="text-[18px] text-emerald-300 font-mono tracking-wide">
            {expr}
          </span>
        ) : (
          <span className="text-[12px] text-zinc-600 italic">
            Click to add a math expression
          </span>
        )}
      </div>
    </div>
  );
}

export const mathBlock = createReactBlockSpec(
  {
    type: "math" as const,
    propSchema: {
      expression: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <MathRenderer block={block} editor={editor} />;
    },
  }
);
