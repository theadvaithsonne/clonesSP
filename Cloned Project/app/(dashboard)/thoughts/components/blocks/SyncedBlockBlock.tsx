"use client";

import React, { useState, useCallback } from "react";
import { RefreshCw, Link2, Check, AlertCircle } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

function SyncedBlockRenderer({ block, editor }: { block: any; editor: any }) {
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">(
    "synced"
  );
  const sourceName = block.props?.sourceName || "Source Page";
  const lastSynced = block.props?.lastSynced || "Just now";

  const handleSync = useCallback(() => {
    setSyncStatus("syncing");
    setTimeout(() => {
      setSyncStatus("synced");
      editor.updateBlock(block, {
        props: { lastSynced: "Just now" },
      });
    }, 1200);
  }, [editor, block]);

  return (
    <div className="w-full bg-[#1E1E1E] rounded-lg border border-emerald-500/30 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <RefreshCw
            className={`h-3.5 w-3.5 text-emerald-400 ${
              syncStatus === "syncing" ? "animate-spin" : ""
            }`}
          />
          <span className="text-[10px] text-emerald-400/70 font-medium tracking-wide">
            SYNCED BLOCK
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-600">
            Last synced: {lastSynced}
          </span>
          <button
            onClick={handleSync}
            disabled={syncStatus === "syncing"}
            className="text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-3 w-3 text-emerald-400/50" />
          <span className="text-[10px] text-zinc-500">
            Synced from:
          </span>
          <span className="text-[10px] text-emerald-300 font-medium">
            {sourceName}
          </span>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-md p-3">
          {syncStatus === "synced" && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-3 w-3 text-emerald-400" />
              </div>
              <span className="text-[11px] text-zinc-400">
                Content synced — changes reflect across all linked locations
              </span>
            </div>
          )}
          {syncStatus === "syncing" && (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
              <span className="text-[11px] text-zinc-400">
                Syncing content...
              </span>
            </div>
          )}
          {syncStatus === "error" && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[11px] text-red-300">
                Sync failed — click Refresh to retry
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const syncedBlockBlock = createReactBlockSpec(
  {
    type: "syncedBlock" as const,
    propSchema: {
      sourceName: { default: "Source Page", type: "string" },
      lastSynced: { default: "Just now", type: "string" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      return <SyncedBlockRenderer block={block} editor={editor} />;
    },
  }
);
