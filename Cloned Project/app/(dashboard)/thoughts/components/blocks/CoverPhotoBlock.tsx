"use client";

import React from "react";
import { ImageUp } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

export const coverPhotoBlock = createReactBlockSpec(
  {
    type: "coverPhoto" as const,
    propSchema: {
      url: { default: "", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      const url = (block as any).props?.url || "";

      if (url) {
        return (
          <div className="relative w-full h-48 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 group">
            <img
              src={url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="text-white/0 group-hover:text-white/70 text-xs font-medium transition-colors">
                Click to change cover
              </span>
            </div>
          </div>
        );
      }

      return (
        <div className="relative w-full h-48 rounded-xl border-2 border-dashed border-zinc-700/60 bg-zinc-900/50 flex flex-col items-center justify-center gap-2 group cursor-pointer hover:border-emerald-500/40 hover:bg-zinc-900/80 transition-all">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
            <ImageUp className="h-5 w-5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm text-zinc-300 font-medium group-hover:text-emerald-300 transition-colors">
              Add a cover photo
            </span>
            <span className="text-[11px] text-zinc-500">
              Drop an image or click to upload
            </span>
          </div>
        </div>
      );
    },
  }
);
