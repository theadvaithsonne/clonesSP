"use client";

// Right-side "Tasks" panel for group chat. Lists the tasks on the group's
// linked Taskroom board with a [This group | Assigned to me] toggle. GROUP
// CHAT ONLY: the host mounts it only when a board is linked + enabled, and it
// talks exclusively to the /groups/:id/taskroom endpoints. Styling mirrors
// GroupAdminPanel so it sits consistently in the right-panel region.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  ListChecks,
  Loader2,
  MoreVertical,
  Sparkles,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { formatRelativeTime } from "@/lib/utils/format";

type TaskScope = "group" | "mine";

type TaskAssignee = { userId?: string; name: string };

type TaskRow = {
  taskId: string;
  title: string;
  priority?: "low" | "normal" | "high" | "urgent" | string;
  stageName?: string;
  stageColor?: string;
  isCompleted: boolean;
  status?: string;
  assignees: TaskAssignee[];
  reporterName?: string;
  source: "ai" | "manual";
  dueDate?: string;
  createdAt: string;
  roomId: string;
  spaceId?: string;
  workspaceId?: string;
};

type BoardRef = { roomId: string; spaceId?: string; workspaceId?: string; roomName?: string };

type TasksResponse = {
  ok: boolean;
  board: BoardRef;
  live: boolean;
  counts: { group: number; mine: number };
  tasks: TaskRow[];
};

const PRIORITY_CHIP: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  normal: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  low: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export default function GroupTasksPanel({
  groupId,
  isMini = false,
  refreshKey = 0,
  onOpenBoard,
  onClose,
}: {
  groupId: string;
  isMini?: boolean;
  /** Bumped by the host (e.g. after a manual task is created) to force a refetch. */
  refreshKey?: number;
  onOpenBoard: (b: { roomId: string; spaceId?: string; workspaceId?: string }) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<TaskScope>("group");
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // Bumped by the socket when a task changes on this group's board.
  const [socketBump, setSocketBump] = useState(0);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      setError(null);
      try {
        const res = await api<TasksResponse>(
          `/groups/${groupId}/taskroom/tasks?scope=${scope}`
        );
        return res;
      } catch (e) {
        throw e instanceof Error ? e : new Error("Failed to load tasks");
      }
    },
    [groupId, scope]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<TasksResponse>(`/groups/${groupId}/taskroom/tasks?scope=${scope}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load tasks");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, scope, refreshKey, socketBump]);

  // Live updates: the AI capture (and other clients) emit group:message-task
  // for this group when tasks change — refetch quietly when that happens.
  useEffect(() => {
    const s = getSocket();
    const onTask = (d: { groupId?: string }) => {
      if (d?.groupId === groupId) setSocketBump((n) => n + 1);
    };
    s.on("group:message-task", onTask);
    return () => {
      s.off("group:message-task", onTask);
    };
  }, [groupId]);

  const refetchQuiet = useCallback(() => {
    load({ quiet: true })
      .then((res) => setData(res))
      .catch(() => {});
  }, [load]);

  // Close an open row menu on any outside click. The trigger stops propagation
  // so opening doesn't immediately re-close.
  useEffect(() => {
    if (!menuOpenId) return;
    const onDocClick = () => setMenuOpenId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenId]);

  const board = data?.board;
  const counts = data?.counts ?? { group: 0, mine: 0 };
  const tasks = data?.tasks ?? [];

  async function remove(taskId: string) {
    if (removingId) return;
    setRemovingId(taskId);
    setMenuOpenId(null);
    try {
      await api(`/groups/${groupId}/taskroom/tasks/${taskId}`, { method: "DELETE" });
      toast.success("Removed from Taskroom");
      refetchQuiet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/403|not allowed|permission|reporter|admin/i.test(msg)) {
        toast.error("Only the reporter or an admin can remove this");
      } else {
        toast.error(msg || "Failed to remove task");
      }
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full w-full md:w-[380px] bg-[#141418] border-l border-[#2E2E2E]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2E2E2E]">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="h-4 w-4 text-brand-2 shrink-0" />
          <div className="text-sm font-semibold text-white truncate">Tasks</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {board?.roomId && (
            <button
              type="button"
              onClick={() =>
                onOpenBoard({
                  roomId: board.roomId,
                  spaceId: board.spaceId,
                  workspaceId: board.workspaceId,
                })
              }
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open board
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#999] hover:text-white hover:bg-[#2E2E2E]"
            aria-label="Close tasks panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scope toggle */}
      <div className="shrink-0 px-4 py-3 border-b border-[#2E2E2E] flex items-center gap-1.5">
        <SegButton active={scope === "group"} onClick={() => setScope("group")}>
          This group
          <CountBadge n={counts.group} active={scope === "group"} />
        </SegButton>
        <SegButton active={scope === "mine"} onClick={() => setScope("mine")}>
          Assigned to me
          <CountBadge n={counts.mine} active={scope === "mine"} />
        </SegButton>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[#6E6E6E]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="text-sm text-[#9fa0b8]">{error}</div>
            <button
              type="button"
              onClick={() => setSocketBump((n) => n + 1)}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a]"
            >
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-12 text-center px-6">
            <ListChecks className="h-8 w-8 text-[#3a3a45]" />
            <div className="text-sm text-[#9fa0b8]">
              {scope === "mine" ? "Nothing assigned to you yet" : "No tasks on this board yet"}
            </div>
            <div className="text-[11px] text-[#6E6E6E]">
              {scope === "mine"
                ? "Tasks assigned to you will show up here."
                : "Create one with /taskroom, or let AI capture tasks from chat."}
            </div>
          </div>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.taskId}
              task={t}
              removing={removingId === t.taskId}
              menuOpen={menuOpenId === t.taskId}
              onToggleMenu={() =>
                setMenuOpenId((cur) => (cur === t.taskId ? null : t.taskId))
              }
              onOpen={() =>
                onOpenBoard({
                  roomId: t.roomId,
                  spaceId: t.spaceId,
                  workspaceId: t.workspaceId,
                })
              }
              onRemove={() => void remove(t.taskId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  removing,
  menuOpen,
  onToggleMenu,
  onOpen,
  onRemove,
}: {
  task: TaskRow;
  removing: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const priorityKey = (task.priority || "normal").toLowerCase();
  const priorityClass = PRIORITY_CHIP[priorityKey] || PRIORITY_CHIP.normal;
  const assigneeNames = task.assignees?.map((a) => a.name).filter(Boolean) ?? [];

  return (
    <div
      className="relative rounded-lg border border-[#2a2a35] bg-[#0e0e12] hover:bg-[#15151b] transition-colors"
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left px-3 py-2.5"
        title="Open the board in Taskroom"
      >
        {/* Title + priority */}
        <div className="flex items-start gap-2">
          <div
            className={`flex-1 min-w-0 text-[13px] leading-snug ${
              task.isCompleted ? "line-through text-[#6E6E6E]" : "text-white"
            }`}
          >
            {task.title}
          </div>
          <span
            className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border capitalize ${priorityClass}`}
          >
            {priorityKey}
          </span>
        </div>

        {/* Chips: stage + source */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {task.stageName && (
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border ${
                task.stageColor ? "" : "border-[#2E2E2E] text-[#9fa0b8]"
              }`}
              style={
                task.stageColor
                  ? { color: task.stageColor, borderColor: task.stageColor }
                  : undefined
              }
            >
              {task.stageName}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${
              task.source === "ai"
                ? "border-brand-2/40 text-brand-2 bg-brand-2/10"
                : "border-[#2E2E2E] text-[#9fa0b8]"
            }`}
          >
            {task.source === "ai" ? (
              <>
                <Sparkles className="h-2.5 w-2.5" />
                AI
              </>
            ) : (
              "Manual"
            )}
          </span>
        </div>

        {/* Assignees */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#9fa0b8]">
          <UserIcon className="h-3 w-3 shrink-0" />
          {assigneeNames.length === 0 ? (
            <span className="text-[#6E6E6E]">Unassigned</span>
          ) : (
            <span className="truncate">
              {assigneeNames.slice(0, 2).join(", ")}
              {assigneeNames.length > 2 ? ` +${assigneeNames.length - 2}` : ""}
            </span>
          )}
        </div>

        {/* Reporter + time */}
        <div className="text-[10px] text-[#6E6E6E] mt-1 truncate">
          {task.reporterName ? `${task.reporterName} · ` : ""}
          {formatRelativeTime(task.createdAt)}
        </div>
      </button>

      {/* Overflow / remove */}
      <div className="absolute top-2 right-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          disabled={removing}
          className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E] disabled:opacity-60"
          aria-label="Task actions"
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MoreVertical className="h-3.5 w-3.5" />
          )}
        </button>
        {menuOpen && !removing && (
          <div className="absolute right-0 mt-1 z-10 min-w-[168px] rounded-md border border-[#2a2a35] bg-[#1a1a22] shadow-lg py-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-300 hover:bg-red-900/30"
            >
              <Trash2 className="h-3 w-3" />
              Remove from Taskroom
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
        active
          ? "border-brand-2 text-brand-2 bg-brand-2/10"
          : "border-[#2E2E2E] text-white/70 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`text-[9px] tabular-nums px-1.5 py-px rounded-full ${
        active ? "bg-brand-2/20 text-brand-2" : "bg-white/10 text-white/50"
      }`}
    >
      {n}
    </span>
  );
}
