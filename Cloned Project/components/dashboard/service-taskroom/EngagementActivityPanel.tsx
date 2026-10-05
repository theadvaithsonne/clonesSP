"use client";

/**
 * The engagement activity drawer, opened from the Taskroom Board when the
 * founder enabled `showActivityLogs`.
 *
 * The timeline is assembled server-side from the opt-in, the milestone message
 * thread and the board itself, so this component only renders — and so the
 * permission cannot be worked around from the browser. Entries for locked
 * milestones and internal columns never arrive here.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  PlayCircle,
  SquareCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getEngagementActivity,
  type EngagementActivityEntry,
} from "@/lib/feed-api";

const ENTRY_ICON: Record<EngagementActivityEntry["type"], typeof Activity> = {
  milestone_started: PlayCircle,
  milestone_completed: CheckCircle2,
  payment: CreditCard,
  file: FileText,
  message: MessageCircle,
  task: SquareCheck,
};

const ENTRY_TONE: Record<EngagementActivityEntry["type"], string> = {
  milestone_started: "text-brand",
  milestone_completed: "text-emerald-400",
  payment: "text-emerald-400",
  file: "text-zinc-400",
  message: "text-zinc-400",
  task: "text-zinc-400",
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EngagementActivityPanel({
  optInId,
  open,
  onClose,
}: {
  optInId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<EngagementActivityEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getEngagementActivity(optInId);
      setEntries(result.activity);
    } catch (error) {
      console.error("[EngagementActivity] load failed:", error);
      setEntries(null);
    } finally {
      setLoading(false);
    }
  }, [optInId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <button
        type="button"
        aria-label="Close activity"
        onClick={onClose}
        className="flex-1 bg-black/60 backdrop-blur-sm"
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#2a2a35] bg-[#0F0F0F]">
        <div className="flex items-start justify-between border-b border-[#2a2a35] px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Activity className="h-4 w-4 text-brand" />
              Engagement activity
            </h3>
            <p className="mt-0.5 text-[11px] text-[#6b6c85]">
              Milestone transitions, payments, files, comments and board updates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9fa0b8] transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          ) : !entries ? (
            <p className="py-10 text-center text-xs text-[#6b6c85]">
              Activity is not shared on this engagement.
            </p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#6b6c85]">
              Nothing has happened on this engagement yet.
            </p>
          ) : (
            <ol className="space-y-4">
              {entries.map((entry, index) => {
                const Icon = ENTRY_ICON[entry.type] || Activity;
                return (
                  <li key={`${entry.at}-${index}`} className="flex gap-3">
                    <span className="relative flex flex-col items-center">
                      <Icon
                        className={cn("h-4 w-4 shrink-0", ENTRY_TONE[entry.type])}
                      />
                      {index < entries.length - 1 && (
                        <span className="mt-1 w-px flex-1 bg-[#2a2a35]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-xs font-medium text-white">
                        {entry.title}
                      </p>
                      {entry.detail && (
                        <p className="mt-0.5 break-words text-[11px] text-[#9fa0b8]">
                          {entry.detail}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[#6b6c85]">
                        {[formatWhen(entry.at), entry.actor]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
