"use client";

// Ignite call status — the column cell.
//
// The scheduling UI lives in catchup/IgniteCallScheduleDrawer.tsx (the ported
// NetworkChains catch-up drawer) and the related-data panel in
// IgniteCallDrawer.tsx. This file is just the cell and its two affordances.
//
// Mirrors assign-agent.tsx: read-only for non-super admins. The link itself
// lives on a neutral /garage-admin/users/:userId/ignite-call endpoint, so a
// second admin table can adopt this column without a new backend.

import { ChevronRight, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { isSuperAdminClient } from "@/lib/admin-api/permissions";
import {
  IGNITE_STATUS_LABEL,
  type IgniteCallSummary,
  type IgniteStatus,
} from "@/lib/admin-api/ignite-call";

export type IgniteCallRow = {
  userId: string | null;
  igniteCall: IgniteCallSummary | null;
  user?: { name?: string | null; email?: string | null } | null;
  /**
   * The affiliate's assigned support agent — the Assigned To column.
   *
   * This is WHO conducts the Ignite call. There is deliberately no admin
   * picker: the call belongs to whoever already owns the relationship, so an
   * unassigned affiliate must be assigned first rather than letting the
   * operator pick someone ad hoc here and end up with two different owners.
   */
  assignedTo?: {
    id: string;
    name: string | null;
    email: string | null;
    profilePicture: string | null;
    role?: string | null;
  } | null;
};

const STATUS_STYLE: Record<IgniteStatus, string> = {
  not_scheduled: "border-white/10 bg-white/[0.06] text-white/50",
  scheduled: "border-brand/30 bg-brand/10 text-brand",
  started: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  completed: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

function StatusBadge({ status }: { status: IgniteStatus }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}
    >
      {IGNITE_STATUS_LABEL[status]}
    </span>
  );
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * The cell. Left-aligned like every other value in this admin panel.
 * The muted second line is the affordance the spec calls for: the call's
 * date with a `›`, opening the related-data panel.
 */
export function IgniteCallCell({
  row,
  onSchedule,
  onOpenRelated,
  canEdit,
}: {
  row: IgniteCallRow;
  onSchedule: (row: IgniteCallRow) => void;
  onOpenRelated: (row: IgniteCallRow) => void;
  canEdit: boolean;
}) {
  const call = row.igniteCall;
  const status: IgniteStatus = call?.status ?? "not_scheduled";

  if (!call) {
    // Attach/detach are super-admin only on the backend — a grant-holder
    // who isn't a super admin must see only the badge, never the picker
    // affordance (spec: three layers — cell, dialog fetch, drawer detach —
    // must all agree; see also IgniteCallDialog and IgniteCallDrawer).
    if (!canEdit || !isSuperAdminClient()) return <StatusBadge status="not_scheduled" />;
    return (
      <button
        type="button"
        onClick={() => {
          // The assigned agent conducts the call. Without one there is nobody
          // to host it, so send them to the Assigned To column rather than
          // opening a dialog that could only dead-end.
          if (!row.assignedTo) {
            toast.error(
              "Assign a support agent to this affiliate first — the Ignite call is scheduled under them.",
            );
            return;
          }
          onSchedule(row);
        }}
        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:border-brand/40 hover:text-brand"
      >
        <CalendarPlus className="h-3 w-3" />
        Not Scheduled
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge status={status} />
      <button
        type="button"
        onClick={() => onOpenRelated(row)}
        className="flex items-center gap-0.5 text-left text-[11px] text-white/40 transition hover:text-white/70"
      >
        {whenLabel(call.scheduledAt)}
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
