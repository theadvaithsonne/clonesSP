"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#2a2a35] text-[#8a8a9b] border-[#3b3b4a]",
  sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  voided: "bg-red-500/15 text-red-400 border-red-500/30",
  pending: "bg-[#2a2a35] text-[#8a8a9b] border-[#3b3b4a]",
  viewed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  signed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  declined: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px]", STATUS_STYLES[status] || "bg-[#2a2a35] text-[#8a8a9b]", className)}
    >
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
