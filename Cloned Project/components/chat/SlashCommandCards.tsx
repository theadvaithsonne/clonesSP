"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckSquare,
  BarChart3,
  Calendar,
  TrendingUp,
  ShieldCheck,
  FileText,
  FileImage,
  Film,
  Music,
  ShoppingBag,
  Clock,
  ExternalLink,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  type TaskCardData,
  type PollCardData,
  type MeetCardData,
  type DealCardData,
  type ApprovalCardData,
  type DocCardData,
  type ShareCardData,
  type TaskStatus,
  type DealStage,
} from "@/lib/chat-markers";
import {
  usePollVote,
  useDealStage,
  useApprovalStatuses,
  useApprovalOverall,
  useTaskStage,
  useTaskAssignee,
  slashState,
  type ApprovalDecision,
} from "@/lib/slash-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Shared shell — keeps every card consistent on dark + light bubble bg.
function CardShell({
  isOwn,
  children,
  className,
}: {
  isOwn?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  // Always use a consistent dark card background so cards are readable
  // on any bubble color — including the gold/amber "own" bubble.
  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden shadow-lg",
        "bg-[#1a1a1f] border-[#2a2a35]",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  label,
  accent,
  rightContent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-b border-white/5 bg-black/20">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", accent)} />
        <span className="text-[10px] uppercase tracking-wider text-white/50 font-medium">{label}</span>
      </div>
      {rightContent}
    </div>
  );
}

// ─── Task ───────────────────────────────────────────────────────────
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  inprogress: "In progress",
  done: "Done",
};

const TASKROOMS_BASE = "https://uatapi.garage.app/taskroom";

// Heuristic stage-name matching. Taskroom stages are user-defined, so the
// "In Progress" / "Mark Done" buttons resolve to a real stage by matching
// the stage's name. If no match, we fall back to a position-based guess.
function pickStageId(
  stages: { id: string; name: string }[],
  kind: "inprogress" | "done"
): string | undefined {
  if (stages.length === 0) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  if (kind === "inprogress") {
    const hit = stages.find((s) =>
      ["inprogress", "doing", "active", "wip"].includes(norm(s.name))
    );
    if (hit) return hit.id;
    // Fallback: second stage if available, otherwise first.
    return stages[1]?.id || stages[0].id;
  }
  const hit = stages.find((s) =>
    ["done", "complete", "completed", "finished", "closed"].includes(norm(s.name))
  );
  if (hit) return hit.id;
  return stages[stages.length - 1].id;
}

// Priority color: mirrors the screenshot — high/urgent in red, medium amber,
// low muted. Used in the metadata grid only.
function priorityColor(p?: string): string {
  switch (p) {
    case "urgent":
    case "high":
      return "text-rose-400";
    case "medium":
      return "text-amber-300";
    case "low":
      return "text-emerald-300";
    default:
      return "text-white/70";
  }
}

// Display label for the current status cell. Prefers the live stage name
// from the marker; falls back to the legacy enum for old cards.
function statusLabel(
  stages: { id: string; name: string }[],
  currentStageId: string | undefined,
  legacy: TaskStatus
): string {
  const stage = stages.find((s) => s.id === currentStageId);
  if (stage) return stage.name;
  return STATUS_LABEL[legacy];
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TaskCard({ data, isOwn }: { data: TaskCardData; isOwn?: boolean }) {
  // Live stage + assignee overrides win over the marker snapshot so clicks
  // feel instant and persist across re-renders / tab switches.
  const liveStage = useTaskStage(data.taskId);
  const liveAssignee = useTaskAssignee(data.taskId);
  const currentStageId = liveStage || data.currentStageId;
  const [busy, setBusy] = useState(false);
  const stages = data.stages || [];
  const hasTaskroom = !!data.taskroomId;
  // All task IDs this card represents (multi-assignee groups produce N tasks).
  const taskIds = data.taskIds && data.taskIds.length > 0 ? data.taskIds : [data.taskId];

  // Resolve "In Progress" / "Done" stage IDs from the embedded stage list.
  const inProgressStageId = pickStageId(stages, "inprogress");
  const doneStageId = pickStageId(stages, "done");
  const isInProgress = !!currentStageId && currentStageId === inProgressStageId;
  const isDone = !!currentStageId && currentStageId === doneStageId;

  // Assignee row: live override > primary marker assignee > first of assignees[].
  const assigneeName =
    liveAssignee?.name ||
    data.assigneeName ||
    data.assignees?.[0]?.name ||
    (data.assignees && data.assignees.length > 0 ? "Assigned" : "Unassigned");
  const extraAssignees =
    data.assignees && data.assignees.length > 1 ? data.assignees.length - 1 : 0;

  const taskroomHref = data.taskroomId
    ? `/taskroom/all-taskrooms?taskroomId=${encodeURIComponent(data.taskroomId)}`
    : undefined;

  async function moveStage(nextStageId: string | undefined) {
    if (!nextStageId || nextStageId === currentStageId || busy) return;
    const previous = currentStageId;
    setBusy(true);
    // Optimistic: flip locally first so the click feels instant. Applies to
    // every taskId — multi-assignee groups stay in lockstep.
    slashState.setTaskStage(data.taskId, nextStageId);
    try {
      await Promise.all(
        taskIds.map(async (tid) => {
          const res = await fetch(`${TASKROOMS_BASE}/v1/tasks/move/${tid}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ stageId: nextStageId }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || json?.status === false) {
            throw new Error(json?.message || "Failed to update");
          }
        })
      );
    } catch (err) {
      // Roll back optimistic update on failure.
      if (previous) slashState.setTaskStage(data.taskId, previous);
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setBusy(false);
    }
  }

  async function reassign(member: { id: string; name?: string }) {
    if (busy) return;
    setBusy(true);
    slashState.setTaskAssignee(data.taskId, member);
    try {
      await Promise.all(
        taskIds.map(async (tid) => {
          const res = await fetch(`${TASKROOMS_BASE}/v1/tasks/${tid}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ assignedToId: member.id }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || json?.status === false) {
            throw new Error(json?.message || "Failed to reassign");
          }
        })
      );
      toast.success(`Reassigned to ${member.name || "member"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reassign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell isOwn={isOwn} className="min-w-[320px] max-w-[460px]">
      {/* Header strip — matches the dark bar in the design with the
          "Open in Taskrooms →" link on the right. */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-white/5">
        <span className="text-[10px] text-white/50">Task created via Taskrooms</span>
        {taskroomHref ? (
          <a
            href={taskroomHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_83%,white)] flex items-center gap-0.5"
          >
            Open in Taskrooms <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : (
          <span className="text-[10px] text-white/30 flex items-center gap-0.5">
            <CheckSquare className="h-2.5 w-2.5" /> Task
          </span>
        )}
      </div>

      <div className="px-3 py-2.5">
        {data.taskroomName && (
          <div className="text-[14px] font-semibold text-white leading-tight">
            {data.taskroomName}
          </div>
        )}
        <div
          className={cn(
            "text-[12px] font-medium text-white leading-snug",
            data.taskroomName ? "mt-1.5" : ""
          )}
        >
          {data.title}
        </div>
        {data.description && (
          <div className="text-[11px] text-white/60 mt-1 leading-snug">
            {data.description}
          </div>
        )}

        {/* 4-column metadata grid — matches the screenshot exactly. */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <MetaCell label="Assignee">
            <span className="truncate">{assigneeName}</span>
            {extraAssignees > 0 && (
              <span className="text-white/50"> +{extraAssignees}</span>
            )}
          </MetaCell>
          <MetaCell label="Due Date">
            {data.dueDate ? formatDateLong(data.dueDate) : "—"}
          </MetaCell>
          <MetaCell label="Priority">
            <span className={cn("capitalize", priorityColor(data.priority))}>
              {data.priority || "—"}
            </span>
          </MetaCell>
          <MetaCell label="Status">
            {statusLabel(stages, currentStageId, data.status)}
          </MetaCell>
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 mt-3">
          {inProgressStageId && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                moveStage(inProgressStageId);
              }}
              disabled={busy || isInProgress}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                isInProgress
                  ? "bg-amber-500/20 text-amber-200 cursor-default"
                  : "bg-brand text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_83%,white)] disabled:opacity-50"
              )}
            >
              In Progress
            </button>
          )}
          {doneStageId && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                moveStage(doneStageId);
              }}
              disabled={busy || isDone}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                isDone
                  ? "bg-emerald-500/20 text-emerald-200 cursor-default"
                  : "bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50"
              )}
            >
              Mark Done
            </button>
          )}
          {data.availableAssignees && data.availableAssignees.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-md text-[11px] font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Reassign
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="bg-[#1a1a1f] border-[#2E2E2E] text-white min-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                {data.availableAssignees.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onSelect={() => reassign(m)}
                    className="text-[11px] focus:bg-white/10 focus:text-white cursor-pointer"
                  >
                    {m.name || m.id}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {busy && <Loader2 className="h-3 w-3 animate-spin text-white/40 ml-1" />}
        </div>
      </div>
    </CardShell>
  );
}

// Small metadata cell used in the task card's 4-column row.
function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] uppercase tracking-wider text-white/40">
        {label}
      </div>
      <div className="text-[11px] text-white mt-0.5 truncate">{children}</div>
    </div>
  );
}

// ─── Poll ───────────────────────────────────────────────────────────
export function PollCard({ data, isOwn }: { data: PollCardData; isOwn?: boolean }) {
  const myVote = usePollVote(data.pollId);
  const hasVoted = myVote.length > 0;
  // Total votes: in a real system this would come from backend;
  // locally we can only know about our own vote.
  const totalVotes = hasVoted ? 1 : 0;

  return (
    <CardShell isOwn={isOwn} className="min-w-[280px] max-w-[380px]">
      <CardHeader
        icon={BarChart3}
        label="Poll"
        accent="text-violet-400"
        rightContent={
          <span className="text-[9px] text-white/40">
            {data.isMultiChoice ? "Multiple choice" : "Single choice"}
            {data.isAnonymous ? " · Anonymous" : ""}
          </span>
        }
      />
      <div className="px-3 py-3">
        <div className="text-[13px] font-semibold text-white leading-snug">{data.question}</div>
        <div className="mt-3 space-y-1.5">
          {data.options.map((opt) => {
            const chosen = myVote.includes(opt.id);
            // Simulated percentage — when user votes, their option gets 100%
            // and others get 0%. In production this would be from the backend.
            const percentage = hasVoted ? (chosen ? 100 : 0) : 0;
            return (
              <button
                key={opt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  slashState.togglePollVote(data.pollId, opt.id, !!data.isMultiChoice);
                }}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-all relative overflow-hidden group",
                  chosen
                    ? "border-white/40 bg-white/5"
                    : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"
                )}
              >
                {/* Progress bar background */}
                {hasVoted && (
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 transition-all duration-500 rounded-lg",
                      chosen ? "bg-white/10" : "bg-white/[0.02]"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                )}
                <div className="relative flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                      chosen
                        ? "bg-white border-white"
                        : "border-white/30 group-hover:border-white/50"
                    )}
                  >
                    {chosen && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[12px] flex-1",
                    chosen ? "text-white font-medium" : "text-white/80"
                  )}>
                    {opt.text}
                  </span>
                  {hasVoted && (
                    <span className={cn(
                      "text-[11px] font-medium tabular-nums",
                      chosen ? "text-white" : "text-white/40"
                    )}>
                      {percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-white/40">
          <span>
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            {hasVoted ? " · You voted" : ""}
          </span>
          <span>{hasVoted ? "✓ Vote recorded" : "Tap an option to vote"}</span>
        </div>
      </div>
    </CardShell>
  );
}

// ─── Meeting ────────────────────────────────────────────────────────
export function MeetCard({ data, isOwn }: { data: MeetCardData; isOwn?: boolean }) {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  const durationMin = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

  // Prefer the real booked conference room → open the LiveKit conference in a
  // new tab. Root-relative (like ConferenceRoomPage.handleJoinRoom) so it's
  // SSR-safe and resolves to <origin>/meet/conference/<orgId>/<roomId>. Old
  // cards fall back to the legacy pasted link (full URL or short code).
  const joinUrl =
    data.orgId && data.roomId
      ? `/meet/conference/${data.orgId}/${data.roomId}`
      : data.joinCode
      ? /^https?:\/\//i.test(data.joinCode)
        ? data.joinCode
        : `/meet/${data.joinCode}`
      : undefined;

  const inviteeCount = data.invitees?.length ?? 0;

  return (
    <CardShell isOwn={isOwn} className="min-w-[280px] max-w-[360px]">
      <CardHeader icon={Calendar} label="Meeting" accent="text-cyan-400" />
      <div className="px-3 py-3">
        <div className="text-[14px] font-semibold text-white leading-tight">{data.title}</div>
        {data.roomName && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/70">
            <Video className="h-3 w-3 text-cyan-400/60" />
            <span className="truncate">{data.roomName}</span>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/70">
          <Calendar className="h-3 w-3 text-cyan-400/60" />
          <span>
            {start.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <span className="text-white/30">·</span>
          <Clock className="h-3 w-3 text-white/40" />
          <span>{durationMin < 60 ? `${durationMin}m` : `${Math.round(durationMin / 60)}h`}</span>
        </div>
        {data.description && (
          <div className="mt-1.5 text-[11px] text-white/60 whitespace-pre-wrap break-words line-clamp-3">
            {data.description}
          </div>
        )}
        {inviteeCount > 0 && (
          <div className="text-[10px] text-white/40 mt-1.5">
            {inviteeCount} invitee{inviteeCount === 1 ? "" : "s"}
          </div>
        )}
        {joinUrl && (
          <div className="mt-3 flex items-center">
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto text-[11px] font-medium text-brand hover:text-[color:color-mix(in_srgb,var(--brand)_83%,white)] flex items-center gap-1 px-2.5 py-1 rounded-md border border-brand/30 bg-brand/5 hover:bg-brand/10 transition-colors"
            >
              Join <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ─── Deal ───────────────────────────────────────────────────────────
const DEAL_STAGE_COLOR: Record<DealCardData["stage"], string> = {
  lead: "bg-slate-500/20 text-slate-200",
  qualified: "bg-blue-500/20 text-blue-200",
  proposal: "bg-amber-500/20 text-amber-200",
  won: "bg-emerald-500/20 text-emerald-200",
  lost: "bg-rose-500/20 text-rose-200",
};

const DEAL_STAGES: DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];

export function DealCard({ data, isOwn }: { data: DealCardData; isOwn?: boolean }) {
  // Live stage override from slash-state wins over the marker snapshot.
  // The override is set by useSlashCardSync on `slash:deal-updated`.
  const liveStage = useDealStage(data.dealId);
  const stage = liveStage || data.stage;
  const [busy, setBusy] = useState(false);

  async function updateStage(next: DealStage) {
    if (next === stage || busy) return;
    setBusy(true);
    // Optimistic update — the socket echo confirms (or overrides) shortly.
    slashState.setDealStage(data.dealId, next);
    try {
      await api(
        `/slash/deals/${data.dealId}/stage`,
        { method: "PATCH", body: JSON.stringify({ stage: next }) },
        getToken() || undefined
      );
    } catch (err) {
      // Roll back optimistic update on failure.
      slashState.setDealStage(data.dealId, stage);
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell isOwn={isOwn} className="min-w-[220px] max-w-[280px]">
      <CardHeader icon={TrendingUp} label="Deal" accent="text-emerald-300" />
      <div className="px-2 py-1.5">
        <div className="text-[12px] font-medium text-white leading-tight">{data.name}</div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-sm text-[9px] font-medium capitalize",
              DEAL_STAGE_COLOR[stage]
            )}
          >
            {stage}
          </span>
          {typeof data.value === "number" && data.value > 0 && (
            <span className="text-[10px] text-white font-medium tabular-nums">
              {formatMoney(data.value, data.currency)}
            </span>
          )}
          {data.ownerName && (
            <span className="text-[9px] text-white/50">· {data.ownerName}</span>
          )}
          {busy && <Loader2 className="h-2.5 w-2.5 animate-spin text-white/40" />}
        </div>
        {/* Inline stage pills — click to move. Compact enough to live in a
            chat bubble. Backed by single PATCH; updates broadcast via socket. */}
        <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
          {DEAL_STAGES.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation();
                updateStage(s);
              }}
              disabled={busy || s === stage}
              className={cn(
                "px-1 py-0.5 rounded-sm text-[9px] capitalize border transition-colors",
                s === stage
                  ? "border-white/30 text-white/30 cursor-default"
                  : "border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

// ─── Approval ───────────────────────────────────────────────────────
const APPROVAL_STATUS_COLOR: Record<ApprovalDecision, string> = {
  pending: "text-white/40",
  approved: "text-emerald-300",
  rejected: "text-rose-300",
};

const APPROVAL_STATUS_ICON: Record<ApprovalDecision, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

export function ApprovalCard({
  data,
  isOwn,
  currentUserId,
}: {
  data: ApprovalCardData;
  isOwn?: boolean;
  currentUserId?: string;
}) {
  // Live state wins over the marker snapshot. Statuses come from the
  // socket-driven cache; overall status is derived server-side and broadcast
  // in the same payload so cards never have to recompute it locally.
  const liveStatuses = useApprovalStatuses(data.approvalId);
  const liveOverall = useApprovalOverall(data.approvalId);
  const overall = liveOverall || "pending";
  const [busy, setBusy] = useState(false);

  const amApprover =
    !!currentUserId && data.approvers.some((a) => a.id === currentUserId);
  const myDecision: ApprovalDecision = currentUserId
    ? liveStatuses[currentUserId] || "pending"
    : "pending";

  async function decide(decision: "approved" | "rejected") {
    if (busy || myDecision !== "pending" || !currentUserId) return;
    setBusy(true);
    // Optimistic: flip my own status immediately. The socket echo will
    // confirm and update overallStatus for everyone else.
    slashState.applyApprovalDecision(data.approvalId, currentUserId, decision);
    try {
      const res = await api<{
        overallStatus: ApprovalDecision;
      }>(
        `/slash/approvals/${data.approvalId}/decide`,
        { method: "POST", body: JSON.stringify({ decision }) },
        getToken() || undefined
      );
      // Persist the server-computed overall so the requester's own tab
      // doesn't have to wait for the round-trip back via socket.
      slashState.applyApprovalDecision(
        data.approvalId,
        currentUserId,
        decision,
        res.overallStatus
      );
    } catch (err) {
      slashState.applyApprovalDecision(data.approvalId, currentUserId, "pending");
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell isOwn={isOwn} className="min-w-[240px] max-w-[300px]">
      <CardHeader icon={ShieldCheck} label="Approval" accent="text-amber-300" />
      <div className="px-2 py-1.5">
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-white leading-tight">
              {data.title}
            </div>
            {data.description && (
              <div className="text-[10px] text-white/60 mt-0.5 line-clamp-2">
                {data.description}
              </div>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 px-1.5 py-0.5 rounded-sm text-[9px] font-medium capitalize",
              overall === "approved"
                ? "bg-emerald-500/20 text-emerald-300"
                : overall === "rejected"
                ? "bg-rose-500/20 text-rose-300"
                : "bg-white/10 text-white/60"
            )}
          >
            {overall}
          </span>
        </div>
        <div className="text-[9px] text-white/40 mt-1">
          {data.deadline ? `Due ${formatDate(data.deadline)}` : ""}
        </div>
        {/* Per-approver status list — derived from socket-synced cache. */}
        <div className="mt-1 space-y-0.5">
          {data.approvers.map((a) => {
            const s = liveStatuses[a.id] || "pending";
            const Icon = APPROVAL_STATUS_ICON[s];
            return (
              <div key={a.id} className="flex items-center gap-1 text-[10px]">
                <Icon className={cn("h-2.5 w-2.5", APPROVAL_STATUS_COLOR[s])} />
                <span className="text-white/70 truncate">{a.name || a.id}</span>
                <span className={cn("ml-auto capitalize text-[9px]", APPROVAL_STATUS_COLOR[s])}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
        {amApprover && (
          <div className="mt-1.5 flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                decide("approved");
              }}
              disabled={busy || myDecision !== "pending"}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px] hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-2.5 w-2.5" /> Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                decide("rejected");
              }}
              disabled={busy || myDecision !== "pending"}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-rose-500/40 text-rose-300 bg-rose-500/10 text-[10px] hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle className="h-2.5 w-2.5" /> Reject
            </button>
            {busy && <Loader2 className="h-2.5 w-2.5 animate-spin text-white/40 ml-1" />}
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ─── Document ───────────────────────────────────────────────────────
function pickDocIcon(mime?: string): {
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
} {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return { Icon: FileImage, color: "text-emerald-300" };
  if (m.startsWith("video/")) return { Icon: Film, color: "text-violet-300" };
  if (m.startsWith("audio/")) return { Icon: Music, color: "text-amber-300" };
  if (m.includes("pdf")) return { Icon: FileText, color: "text-rose-300" };
  return { Icon: FileText, color: "text-blue-300" };
}

export function DocCard({ data, isOwn }: { data: DocCardData; isOwn?: boolean }) {
  const { Icon, color } = pickDocIcon(data.mimeType);
  const isImage = data.mimeType?.startsWith("image/") || !!data.thumbnail;
  const previewUrl = data.thumbnail || (isImage ? data.url : undefined);
  return (
    <CardShell isOwn={isOwn} className="min-w-[220px] max-w-[280px]">
      <CardHeader icon={FileText} label="Document" accent="text-blue-300" />
      {previewUrl && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block"
        >
          <div
            className="h-24 w-full bg-cover bg-center bg-black/40"
            style={{ backgroundImage: `url(${previewUrl})` }}
          />
        </a>
      )}
      <div className="px-2 py-1.5 flex items-center gap-2">
        <div className="h-9 w-9 rounded-sm bg-white/5 flex items-center justify-center shrink-0">
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-white truncate">{data.name}</div>
          {data.size != null && (
            <div className="text-[9px] text-white/50">{formatBytes(data.size)}</div>
          )}
        </div>
        <a
          href={data.url}
          download={data.name}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 h-6 w-6 rounded-sm hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
          title="Download"
        >
          <Download className="h-3 w-3" />
        </a>
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 h-6 w-6 rounded-sm hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
          title="Open"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </CardShell>
  );
}

// ─── Share (GarageSale) ─────────────────────────────────────────────
const SHARE_CTA: Record<ShareCardData["kind"], string> = {
  course: "Enroll",
  webinar: "Register",
  product: "Buy now",
};

export function ShareCard({ data, isOwn }: { data: ShareCardData; isOwn?: boolean }) {
  const isFree = !(typeof data.price === "number" && data.price > 0);
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block no-underline"
    >
      <CardShell isOwn={isOwn} className="min-w-[220px] max-w-[280px] hover:bg-white/10 transition-colors">
        <CardHeader icon={ShoppingBag} label={data.kind} accent="text-pink-300" />
        {data.image && (
          <div
            className="h-20 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${data.image})` }}
          />
        )}
        <div className="px-2 py-1.5">
          <div className="text-[12px] font-medium text-white leading-tight">{data.title}</div>
          {data.description && (
            <div className="text-[10px] text-white/60 mt-0.5 line-clamp-2">{data.description}</div>
          )}
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-sm text-[10px] font-semibold tabular-nums",
                isFree ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white"
              )}
            >
              {isFree ? "Free" : formatMoney(data.price as number, data.currency)}
            </span>
            <span className="text-[10px] font-medium text-brand-foreground bg-brand px-2 py-0.5 rounded-sm flex items-center gap-0.5">
              {SHARE_CTA[data.kind]} <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </CardShell>
    </a>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMoney(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
