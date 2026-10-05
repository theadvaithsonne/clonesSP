"use client";

// Taskroom for one support chat — the admin-console counterpart of the
// Taskroom section in the app's group chat (GroupAdminPanel / GroupTasksPanel /
// ManualTaskroomForm). Those components talk to Taskroom with the end user's
// token; garage admins have none, so everything here goes through the
// garage-admin API (the backend acts as the support board owner).
//
// A chat files onto its OWN board when an admin gave it one, otherwise onto the
// shared support board picked at the top of the Support Chats list. Tasks are
// unassigned — they are assigned inside Taskroom. No AI capture yet.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LayoutGrid, ListChecks, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addSupportChatTask,
  getSupportChatTaskroom,
  linkSupportChatTaskroom,
  listSupportChatTasks,
  removeSupportChatTask,
  unlinkSupportChatTaskroom,
  type SupportChatTask,
  type SupportChatTaskroom,
  type SupportTaskPriority,
} from "@/lib/admin-api/support-chats";
import { TaskroomBoardDialog } from "@/components/garage-admin/SupportTaskroomPicker";

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-300",
  high: "bg-orange-500/15 text-orange-300",
  normal: "bg-zinc-700/60 text-zinc-300",
  low: "bg-zinc-800 text-zinc-400",
};

export function SupportChatTaskroomPanel({
  groupId,
  refreshKey,
  onClose,
}: {
  groupId: string;
  /** Bump to reload the task list (e.g. after "Add to Taskroom" on a message). */
  refreshKey: number;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<SupportChatTaskroom | null>(null);
  const [tasks, setTasks] = useState<SupportChatTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Add-task form.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SupportTaskPriority>("normal");
  const [adding, setAdding] = useState(false);

  const loadInfo = useCallback(async () => {
    try {
      setInfo(await getSupportChatTaskroom(groupId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the Taskroom board");
    }
  }, [groupId]);

  const loadTasks = useCallback(async () => {
    try {
      const r = await listSupportChatTasks(groupId);
      setTasks(r.tasks);
      setError(null);
    } catch (e) {
      setTasks([]);
      setError(e instanceof Error ? e.message : "Couldn't load tasks");
    }
  }, [groupId]);

  useEffect(() => {
    setInfo(null);
    setTasks(null);
    setError(null);
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks, refreshKey]);

  const add = async () => {
    if (!title.trim() || adding) return;
    setAdding(true);
    try {
      await addSupportChatTask(groupId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      });
      toast.success("Task added to Taskroom");
      setTitle("");
      setDescription("");
      setPriority("normal");
      void loadTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the task");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (taskId: string) => {
    setRemoving(taskId);
    try {
      await removeSupportChatTask(groupId, taskId);
      toast.success("Task removed from Taskroom");
      setTasks((prev) => (prev || []).filter((t) => t.taskId !== taskId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the task");
    } finally {
      setRemoving(null);
    }
  };

  const unlink = async () => {
    setUnlinking(true);
    try {
      setInfo(await unlinkSupportChatTaskroom(groupId));
      toast.success("Now using the shared support board");
      void loadTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't unlink");
    } finally {
      setUnlinking(false);
    }
  };

  const board = info?.board;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-amber-400" />
          Taskroom
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Board */}
        <section>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-start gap-2.5">
              <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-100">
                  {info === null ? "…" : board?.roomName || "No board available"}
                </div>
                <div className="truncate text-[11px] text-zinc-500">
                  {board?.workspaceName || ""}
                  {info && (info.own ? " · this chat's board" : " · shared support board")}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setPicking(true)}
                className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Change board
              </button>
              {info?.own && (
                <button
                  onClick={unlink}
                  disabled={unlinking}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                >
                  {unlinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Unlink
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Tasks land unassigned — assign them inside Taskroom. The customer never
            sees them.
          </p>
        </section>

        {/* Add task */}
        <section className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Add a task</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
            maxLength={200}
            placeholder="What needs doing?"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={5000}
            placeholder="Details (optional)"
            className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <div className="flex items-center gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as SupportTaskPriority)}
              className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs outline-none"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              onClick={add}
              disabled={!title.trim() || adding}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </button>
          </div>
        </section>

        {/* Tasks */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              From this chat {tasks ? `(${tasks.length})` : ""}
            </div>
            <button onClick={() => void loadTasks()} className="text-[11px] text-zinc-500 hover:text-zinc-300">
              Refresh
            </button>
          </div>
          {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
          {tasks === null ? (
            <div className="grid h-16 place-items-center">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No tasks yet. Add one above, or use “Add to Taskroom” on a message.
            </p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.taskId} className="group rounded-md border border-zinc-800 bg-zinc-900 p-2.5">
                  <div className="flex items-start gap-2">
                    {t.isCompleted ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs ${t.isCompleted ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                        {t.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                        {t.stageName && (
                          <span
                            className="rounded px-1.5 py-0.5"
                            style={{ background: `${t.stageColor || "#3f3f46"}33`, color: t.stageColor || undefined }}
                          >
                            {t.stageName}
                          </span>
                        )}
                        <span className={`rounded px-1.5 py-0.5 ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.normal}`}>
                          {t.priority}
                        </span>
                        {t.reporterName && <span>by {t.reporterName}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(t.taskId)}
                      disabled={removing === t.taskId}
                      title="Remove from Taskroom"
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-zinc-500 hover:text-red-400 disabled:opacity-50"
                    >
                      {removing === t.taskId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {picking && (
        <TaskroomBoardDialog
          title="Board for this chat"
          subtitle="Tasks from this chat will go to this board instead of the shared support board."
          currentWorkspaceId={board?.workspaceId}
          currentRoomId={info?.own ? board?.roomId : null}
          onClose={() => setPicking(false)}
          onSubmit={async (workspaceId, roomId) => {
            const next = await linkSupportChatTaskroom(groupId, workspaceId, roomId);
            setInfo(next);
            setPicking(false);
            toast.success("This chat now has its own board");
            void loadTasks();
          }}
        />
      )}
    </aside>
  );
}
