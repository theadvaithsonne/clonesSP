"use client";

// Where support-chat tasks go. Every support ticket (AI-created from a chat,
// or raised by hand) is mirrored as an unassigned card onto ONE Taskroom
// board; this bar shows which board and lets a super admin change it.
//
// Listing goes through the backend (GET /garage-admin/tickets/support-board/
// options) because garage admins have no Taskroom login of their own — the
// backend lists the boards the support board's owner can post to.

import { useEffect, useState } from "react";
import { Check, ChevronRight, LayoutGrid, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { garageAdminApi } from "@/lib/api";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

interface BoardInfo {
  configured: boolean;
  status: "ready" | "provisioning" | "failed" | null;
  workspaceId: string | null;
  workspaceName: string | null;
  roomId: string | null;
  roomName: string | null;
  selectedBy: string | null;
  lastError: string | null;
}

interface WorkspaceOption {
  workspaceId: string;
  workspaceName: string;
  boards: { roomId: string; label: string }[];
}

const BASE = "/garage-admin/tickets/support-board";

export function SupportTaskroomBar() {
  const { isSuperAdmin } = useAdminAccess();
  const [info, setInfo] = useState<BoardInfo | null>(null);
  const [open, setOpen] = useState(false);

  const load = () =>
    garageAdminApi<BoardInfo>(BASE)
      .then(setInfo)
      .catch(() => setInfo(null));

  useEffect(() => {
    void load();
  }, []);

  const label = info?.configured
    ? `${info.workspaceName || "Workspace"} › ${info.roomName || "Board"}`
    : "Not set — first ticket creates “Garage Support”";

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs">
        <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Tasks go to Taskroom
          </div>
          <div className="truncate text-zinc-200" title={label}>
            {info === null ? "…" : label}
          </div>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
          >
            Change
          </button>
        )}
      </div>
      {open && (
        <TaskroomBoardDialog
          title="Taskroom for support tasks"
          subtitle="Every support ticket, and every task added from a support chat that has no board of its own, lands on this board as an unassigned card. Assign it inside Taskroom."
          currentWorkspaceId={info?.workspaceId}
          currentRoomId={info?.roomId}
          onClose={() => setOpen(false)}
          onSubmit={async (workspaceId, roomId) => {
            const next = await garageAdminApi<BoardInfo>(BASE, {
              method: "PUT",
              body: JSON.stringify({ workspaceId, roomId }),
            });
            toast.success("Support tasks will now go to this board");
            setInfo(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * Workspace + board picker over the boards the support board owner can post
 * to. Used for the shared support board and for a single chat's own board.
 */
export function TaskroomBoardDialog({
  title,
  subtitle,
  currentWorkspaceId,
  currentRoomId,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  currentWorkspaceId?: string | null;
  currentRoomId?: string | null;
  onClose: () => void;
  /** Throw to keep the dialog open; the message is toasted. */
  onSubmit: (workspaceId: string, roomId: string) => Promise<void>;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState(currentWorkspaceId || "");
  const [roomId, setRoomId] = useState(currentRoomId || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    garageAdminApi<{ workspaces: WorkspaceOption[] }>(`${BASE}/options`)
      .then((r) => {
        setWorkspaces(r.workspaces || []);
        // Default to the first workspace when nothing usable is selected.
        if (!r.workspaces?.some((w) => w.workspaceId === workspaceId)) {
          setWorkspaceId(r.workspaces?.[0]?.workspaceId || "");
          setRoomId("");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load boards"));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boards = workspaces?.find((w) => w.workspaceId === workspaceId)?.boards || [];

  const save = async () => {
    if (!workspaceId || !roomId) return;
    setSaving(true);
    try {
      await onSubmit(workspaceId, roomId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't set the board");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        ) : workspaces === null ? (
          <div className="grid h-32 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : workspaces.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">
            No Taskroom workspaces are available to the support board owner.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Workspace
              </span>
              <select
                value={workspaceId}
                onChange={(e) => {
                  setWorkspaceId(e.target.value);
                  setRoomId("");
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              >
                {workspaces.map((w) => (
                  <option key={w.workspaceId} value={w.workspaceId}>
                    {w.workspaceName}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                Board
              </span>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-800">
                {boards.length === 0 ? (
                  <p className="p-3 text-xs text-zinc-500">No boards in this workspace.</p>
                ) : (
                  boards.map((b) => (
                    <button
                      key={b.roomId}
                      onClick={() => setRoomId(b.roomId)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-900 ${
                        roomId === b.roomId ? "bg-zinc-900" : ""
                      }`}
                    >
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                      <span className="flex-1 truncate">{b.label}</span>
                      {roomId === b.roomId && <Check className="h-4 w-4 text-emerald-400" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!workspaceId || !roomId || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Use this board
          </button>
        </div>
      </div>
    </div>
  );
}
