"use client";

// "Which Taskroom board does this group feed?" — the chooser shared by the
// Create Group dialog and the group's Admin Controls.
//
// It only CHOOSES. The backend (PUT /groups/:id/taskroom) creates whatever the
// choice needs and syncs the members, so nothing in here writes to Taskroom;
// the lists below are read with the viewer's own token, which is also why they
// only ever offer workspaces and boards the viewer is already in.
//
// Also home to the two small Taskroom helpers those surfaces and the chat's
// Taskroom pills share: making sure the viewer has a Taskroom account, and
// opening a board.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTaskroomWorkspacetore } from "@/store/taskroom/taskroomWorkspace";

/** Body of PUT /groups/:id/taskroom. */
export type LinkChoice =
  | { mode: "new-workspace" }
  | { mode: "new-board"; workspaceId: string }
  | { mode: "existing-board"; workspaceId: string; roomId: string };

type ExistingChoice = Exclude<LinkChoice, { mode: "new-workspace" }>;

/** Where a board lives — what the Taskroom store needs to open it. */
export type TaskroomBoardRef = {
  roomId: string;
  spaceId?: string;
  workspaceId?: string;
};

const TASKROOM_URL = process.env.NEXT_PUBLIC_TASKROOM_URL || "";

/** Board-select value for "+ New board for this group". Never a real id. */
const NEW_BOARD = "__new__";

// One page per list, sized to hold everything: Taskroom returns oldest first,
// so a small page would quietly drop the newest workspaces and boards.
const LIST_SIZE = 500;

type TaskroomItem = { _id: string; name?: string };

function taskroomToken(): string {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("garage_tok") || "";
}

function isTaskroomItem(x: unknown): x is TaskroomItem {
  return typeof (x as TaskroomItem | null)?._id === "string";
}

/** GET a Taskroom list route. Throws on a failed call, never on an empty list. */
async function taskroomList(path: string): Promise<TaskroomItem[]> {
  if (!TASKROOM_URL) throw new Error("Taskroom is not configured");
  const res = await fetch(`${TASKROOM_URL}${path}`, {
    headers: { Authorization: `Bearer ${taskroomToken()}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: unknown;
  } | null;
  if (!res.ok || body?.status === false) {
    throw new Error(body?.message || `Taskroom error (${res.status})`);
  }
  // List routes answer `{ status, data: [...] }`; tolerate one more wrapper.
  const data = body?.data;
  const list = Array.isArray(data)
    ? data
    : (data as { data?: unknown } | undefined)?.data;
  return Array.isArray(list) ? list.filter(isTaskroomItem) : [];
}

// Taskroom creates a person's account the first time they open it
// (`users/profile`). Until then its other routes answer 401 and the group link
// route answers 409, so anyone about to link a group gets one first. Keyed by
// token because the Taskroom identity is the token's user + office. Only
// success is remembered — a failed attempt is simply tried again next time.
const accountReady = new Map<string, Promise<boolean>>();

export function ensureTaskroomAccount(): Promise<boolean> {
  const token = taskroomToken();
  if (!token || !TASKROOM_URL) return Promise.resolve(false);
  let ready = accountReady.get(token);
  if (!ready) {
    ready = fetch(`${TASKROOM_URL}users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .then((ok) => {
        if (!ok) accountReady.delete(token);
        return ok;
      });
    accountReady.set(token, ready);
  }
  return ready;
}

let openingBoard = false;

/**
 * Open a board in the Taskroom panel — the same two steps as "Take to
 * Taskroom" in ServiceEngagementView: select the room in the Taskroom store,
 * then tell the dashboard shell to switch containers (Taskroom is
 * popover-driven, not routed). Failures are toasted here, so callers can fire
 * and forget.
 */
export async function openTaskroomBoard(board: TaskroomBoardRef): Promise<boolean> {
  // A second click while the first is still loading would race it.
  if (openingBoard) return false;
  openingBoard = true;
  const toastId = toast.loading("Opening board…");
  try {
    await ensureTaskroomAccount();
    const ok = await useTaskroomWorkspacetore
      .getState()
      .navigateToServiceRoom(board);
    if (!ok) {
      toast.error("Could not open the board", { id: toastId });
      return false;
    }
    toast.dismiss(toastId);
    window.dispatchEvent(
      new CustomEvent("service:open-taskroom", {
        detail: { roomId: board.roomId },
      })
    );
    return true;
  } catch (e) {
    console.error("[openTaskroomBoard] failed", e);
    toast.error("Could not open the board", { id: toastId });
    return false;
  } finally {
    openingBoard = false;
  }
}

type WorkspaceOption = { id: string; name: string };
type BoardOption = { id: string; label: string };
type BoardList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; boards: BoardOption[] };

function ChoiceCard({
  id,
  value,
  selected,
  disabled,
  title,
  hint,
  children,
}: {
  id: string;
  value: string;
  selected: boolean;
  disabled?: boolean;
  title: string;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border transition-colors",
        selected
          ? "border-brand-2/60 bg-[#17171d]"
          : "border-[#2a2a35]",
        !selected && !disabled && "hover:bg-[#15151b]"
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex items-start gap-3 px-3 py-2.5",
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <RadioGroupItem
          id={id}
          value={value}
          disabled={disabled}
          className="mt-0.5 border-[#4a4a5a] data-[state=checked]:border-primary"
        />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-white">{title}</span>
          {hint && (
            <span className="block text-[11px] text-[#9fa0b8] mt-0.5">
              {hint}
            </span>
          )}
        </span>
      </label>
      {children}
    </div>
  );
}

export default function TaskroomLinkPicker({
  groupName,
  value,
  onChange,
  disabled,
}: {
  /** Names the board (and the workspace, in the automatic mode). */
  groupName?: string;
  value: LinkChoice | null;
  onChange: (v: LinkChoice | null) => void;
  disabled?: boolean;
}) {
  const ids = useId();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspacesStatus, setWorkspacesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [boardLists, setBoardLists] = useState<Record<string, BoardList>>({});

  // Parents pass inline setters; reading through a ref keeps the effects
  // below from re-running on every parent render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // What "Use an existing workspace" restores after a detour to the
  // automatic option, so flipping back doesn't lose the admin's picks.
  const lastExistingRef = useRef<ExistingChoice | null>(null);

  const emit = useCallback((next: LinkChoice) => {
    if (next.mode !== "new-workspace") lastExistingRef.current = next;
    onChangeRef.current(next);
  }, []);

  // Retry can overlap a slow first attempt; only the latest one may land.
  const workspacesRequest = useRef(0);
  const loadWorkspaces = useCallback(async () => {
    const request = ++workspacesRequest.current;
    setWorkspacesStatus("loading");
    // `workspaces/me` answers 401 to someone Taskroom has never seen.
    await ensureTaskroomAccount();
    try {
      const list = await taskroomList(`workspaces/me?size=${LIST_SIZE}`);
      if (request !== workspacesRequest.current) return;
      setWorkspaces(
        list.map((w) => ({ id: w._id, name: w.name || "Untitled workspace" }))
      );
      setWorkspacesStatus("ready");
    } catch (e) {
      if (request !== workspacesRequest.current) return;
      console.error("[TaskroomLinkPicker] workspaces failed", e);
      setWorkspacesStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  // A workspace's boards are the boards of every space in it the viewer is
  // in. All or nothing: a partial list could silently hide the board the
  // admin is looking for.
  const loadBoards = useCallback(async (workspaceId: string) => {
    setBoardLists((prev) => ({ ...prev, [workspaceId]: { status: "loading" } }));
    try {
      const spaces = await taskroomList(
        `spaces/me?workspaceId=${encodeURIComponent(workspaceId)}&page=1&size=${LIST_SIZE}`
      );
      const perSpace = await Promise.all(
        spaces.map(async (space) => {
          const rooms = await taskroomList(
            `rooms/me?spaceId=${encodeURIComponent(space._id)}&page=1&size=${LIST_SIZE}`
          );
          return rooms.map((room) => ({
            id: room._id,
            label: `${space.name || "Untitled space"} › ${
              room.name || "Untitled board"
            }`,
          }));
        })
      );
      setBoardLists((prev) => ({
        ...prev,
        [workspaceId]: { status: "ready", boards: perSpace.flat() },
      }));
    } catch (e) {
      console.error("[TaskroomLinkPicker] boards failed", e);
      setBoardLists((prev) => ({ ...prev, [workspaceId]: { status: "error" } }));
    }
  }, []);

  const existing: ExistingChoice | null =
    value && value.mode !== "new-workspace" ? value : null;
  const selectedWorkspaceId = existing?.workspaceId ?? null;
  const boardList = selectedWorkspaceId
    ? boardLists[selectedWorkspaceId]
    : undefined;

  useEffect(() => {
    if (selectedWorkspaceId && !boardLists[selectedWorkspaceId]) {
      void loadBoards(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId, boardLists, loadBoards]);

  // A picker on screen always stands for a real choice: the automatic one
  // until the admin picks something else, and never a workspace or board that
  // is no longer on offer.
  useEffect(() => {
    if (!value) {
      emit({ mode: "new-workspace" });
      return;
    }
    if (value.mode === "new-workspace") return;
    if (workspacesStatus === "error") {
      emit({ mode: "new-workspace" });
      return;
    }
    if (workspacesStatus !== "ready") return;
    if (!workspaces.some((w) => w.id === value.workspaceId)) {
      emit(
        workspaces[0]
          ? { mode: "new-board", workspaceId: workspaces[0].id }
          : { mode: "new-workspace" }
      );
      return;
    }
    if (
      value.mode === "existing-board" &&
      boardList?.status === "ready" &&
      !boardList.boards.some((b) => b.id === value.roomId)
    ) {
      emit({ mode: "new-board", workspaceId: value.workspaceId });
    }
  }, [value, workspacesStatus, workspaces, boardList, emit]);

  const pickMode = (mode: string) => {
    if (mode === "auto") {
      emit({ mode: "new-workspace" });
      return;
    }
    const last = lastExistingRef.current;
    if (last && workspaces.some((w) => w.id === last.workspaceId)) {
      emit(last);
    } else if (workspaces[0]) {
      emit({ mode: "new-board", workspaceId: workspaces[0].id });
    }
  };

  const name = groupName?.trim();
  const mode = existing ? "existing" : "auto";
  const noWorkspaces =
    workspacesStatus === "ready" && workspaces.length === 0;

  return (
    <RadioGroup
      value={mode}
      onValueChange={pickMode}
      disabled={disabled}
      aria-label="Taskroom board"
      className="gap-2"
    >
      <ChoiceCard
        id={`${ids}-auto`}
        value="auto"
        selected={mode === "auto"}
        disabled={disabled}
        title="Create automatically"
        hint={
          name
            ? `New workspace "${name}" with a board for this group`
            : "A new workspace with a board, both named after this group"
        }
      />

      {workspacesStatus === "error" ? (
        <div className="flex items-start gap-2 rounded-md border border-[#2a2a35] px-3 py-2.5 text-[11px] text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            Couldn&apos;t reach Taskroom to list your workspaces. You can still
            create a new one automatically.
          </div>
          <button
            type="button"
            onClick={() => void loadWorkspaces()}
            disabled={disabled}
            className="inline-flex items-center gap-1 shrink-0 text-[#c7c7da] hover:text-white disabled:opacity-60"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : noWorkspaces ? (
        <div className="px-1 text-[11px] text-[#6E6E6E]">
          You aren&apos;t in any Taskroom workspace yet, so a new one will be
          created.
        </div>
      ) : (
        <ChoiceCard
          id={`${ids}-existing`}
          value="existing"
          selected={mode === "existing"}
          disabled={disabled || workspacesStatus === "loading"}
          title="Use an existing workspace"
          hint={
            workspacesStatus === "loading" ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading your workspaces…
              </span>
            ) : (
              "Put this group's board in a workspace you're already in."
            )
          }
        >
          {existing && (
            <div className="space-y-2 pb-3 pl-10 pr-3">
              <Select
                value={existing.workspaceId}
                onValueChange={(workspaceId) =>
                  emit({ mode: "new-board", workspaceId })
                }
                disabled={disabled}
              >
                <SelectTrigger
                  aria-label="Workspace"
                  className="w-full h-8 bg-[#0e0e12] border-[#2a2a35] text-white text-xs"
                >
                  <SelectValue placeholder="Choose a workspace" />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {boardList?.status === "ready" ? (
                <Select
                  value={
                    existing.mode === "existing-board"
                      ? existing.roomId
                      : NEW_BOARD
                  }
                  onValueChange={(v) =>
                    emit(
                      v === NEW_BOARD
                        ? { mode: "new-board", workspaceId: existing.workspaceId }
                        : {
                            mode: "existing-board",
                            workspaceId: existing.workspaceId,
                            roomId: v,
                          }
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    aria-label="Board"
                    className="w-full h-8 bg-[#0e0e12] border-[#2a2a35] text-white text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                    <SelectItem value={NEW_BOARD}>
                      + New board for this group
                    </SelectItem>
                    {boardList.boards.length > 0 && (
                      <SelectSeparator className="bg-[#2a2a35]" />
                    )}
                    {boardList.boards.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : boardList?.status === "error" ? (
                <div className="flex items-center gap-2 text-[11px] text-amber-400">
                  <span className="flex-1 min-w-0">
                    Couldn&apos;t load this workspace&apos;s boards.
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadBoards(existing.workspaceId)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 shrink-0 text-[#c7c7da] hover:text-white disabled:opacity-60"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-[#2a2a35] bg-[#0e0e12] text-xs text-[#9fa0b8]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading boards…
                </div>
              )}

              <div className="text-[11px] text-[#6E6E6E]">
                {existing.mode === "existing-board"
                  ? "Group members are added to this board. Nobody already on it is removed."
                  : `A board ${
                      name ? `named "${name}"` : "for this group"
                    } is added to a "Group Chats" space in this workspace.`}
              </div>
            </div>
          )}
        </ChoiceCard>
      )}
    </RadioGroup>
  );
}
