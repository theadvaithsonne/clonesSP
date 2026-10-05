"use client";

/**
 * Taskroom destination for a service — workspace, space and template room —
 * shown in Section 6 of the Create Digital Service wizard.
 *
 * The three levels are picked side by side because Taskroom enforces the
 * hierarchy: a space belongs to a workspace, a room belongs to a space. Picking
 * here rather than letting the server guess at provisioning time is what makes
 * the destination deterministic: the chosen ids are stored on the service and
 * used verbatim.
 *
 * What each level is for:
 *  - Workspace — where every client room for this service is filed.
 *  - Space     — the folder inside it. Left empty, provisioning resolves (or
 *                creates) a "Client Engagements" space on first opt-in.
 *  - Room      — optional master board for the service itself. Milestones and
 *                tasks are seeded into it when the service is published. Each
 *                client still gets their own private room, so no buyer ever
 *                sees another buyer's board.
 *
 * Reads and writes Taskroom v2 directly with the founder's own token, the same
 * way the Taskroom app does. Creating a workspace, space or room happens inline
 * so the founder never leaves the wizard and no draft service data is lost.
 */

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Check, FolderPlus, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TaskroomWorkspace {
  _id: string;
  name?: string;
  color?: string;
  category?: string;
}

export interface TaskroomSpace {
  _id: string;
  name?: string;
  color?: string;
  workspaceId?: string;
}

export interface TaskroomRoom {
  _id: string;
  name?: string;
  color?: string;
  spaceId?: string;
}

const TASKROOM_URL = process.env.NEXT_PUBLIC_TASKROOM_URL;

function authHeaders() {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("garage_tok");
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

/** Taskroom answers are loosely shaped; these two unwrap them. */
type TaskroomResponse = { data?: { data?: unknown } };

/** List endpoints answer `{ data: [...] }`. */
function listOf<T>(response: TaskroomResponse): T[] {
  const data = response?.data?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Create endpoints wrap the document twice: `{ data: { data: {...} } }`. */
function createdDoc<T extends { _id?: string }>(
  response: TaskroomResponse,
  label: string,
): T {
  const outer = response?.data?.data as { data?: unknown } | undefined;
  const created = (outer?.data || outer || null) as T | null;
  if (!created?._id) {
    throw new Error(`Taskroom did not return the new ${label}`);
  }
  return created;
}

/** Workspaces the founder is a member of. */
export async function listTaskroomWorkspaces(): Promise<TaskroomWorkspace[]> {
  return listOf<TaskroomWorkspace>(
    await axios.get(`${TASKROOM_URL}workspaces/me?size=50&page=1`, {
      headers: authHeaders(),
    }),
  );
}

export async function createTaskroomWorkspace(
  name: string,
): Promise<TaskroomWorkspace> {
  return createdDoc<TaskroomWorkspace>(
    await axios.post(
      `${TASKROOM_URL}workspaces`,
      { category: "work", name, color: "#008080" },
      { headers: authHeaders() },
    ),
    "workspace",
  );
}

export async function listTaskroomSpaces(
  workspaceId: string,
): Promise<TaskroomSpace[]> {
  return listOf<TaskroomSpace>(
    await axios.get(
      `${TASKROOM_URL}spaces/me?workspaceId=${workspaceId}&page=1&size=50`,
      { headers: authHeaders() },
    ),
  );
}

export async function createTaskroomSpace(
  name: string,
  workspaceId: string,
): Promise<TaskroomSpace> {
  return createdDoc<TaskroomSpace>(
    await axios.post(
      `${TASKROOM_URL}spaces`,
      {
        name,
        description: "Client engagement rooms from Digital Services",
        color: "#008080",
        spaceCode: `svc-${Math.random().toString(36).substring(2, 8)}`,
        workspaceId,
        // Taskroom reads `isPrivate`; a lowercase spelling is ignored and the
        // space would be shared with every workspace member.
        isPrivate: true,
        members: [],
      },
      { headers: authHeaders() },
    ),
    "space",
  );
}

export async function listTaskroomRooms(spaceId: string): Promise<TaskroomRoom[]> {
  return listOf<TaskroomRoom>(
    await axios.get(`${TASKROOM_URL}rooms/me?spaceId=${spaceId}&size=50&page=1`, {
      headers: authHeaders(),
    }),
  );
}

export async function createTaskroomRoom(
  name: string,
  spaceId: string,
): Promise<TaskroomRoom> {
  return createdDoc<TaskroomRoom>(
    await axios.post(
      `${TASKROOM_URL}rooms`,
      {
        name,
        description: "Master board for a Digital Service",
        spaceId,
        color: "#008080",
        bgImage: "",
        isPrivate: true,
        members: [],
        setDefault: false,
      },
      { headers: authHeaders() },
    ),
    "room",
  );
}

interface PickerItem {
  _id: string;
  name?: string;
  color?: string;
}

/** One level of the hierarchy: a list, an inline create field, a refresh. */
function PickerColumn({
  title,
  hint,
  items,
  selectedId,
  loading,
  error,
  disabled,
  disabledHint,
  emptyHint,
  createLabel,
  createPlaceholder,
  noneLabel,
  onSelect,
  onCreate,
  onRefresh,
}: {
  title: string;
  hint: string;
  items: PickerItem[];
  selectedId?: string;
  loading: boolean;
  error: string;
  disabled?: boolean;
  disabledHint?: string;
  emptyHint: string;
  createLabel: string;
  createPlaceholder: string;
  /** When set, an explicit "none" row is offered above the list. */
  noneLabel?: string;
  onSelect: (id: string | undefined) => void;
  onCreate: (name: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const name = draftName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setDraftName("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-[#262626] bg-[#0F0F0F] p-3",
        disabled && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled || loading}
          title="Refresh"
          className="shrink-0 rounded-lg border border-[#262626] p-1 text-zinc-500 transition-colors hover:border-[#3A3A3A] hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      <div className="mt-2.5 min-h-[92px] flex-1 space-y-1 overflow-y-auto pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {disabled ? (
          <p className="py-3 text-[11px] text-zinc-600">{disabledHint}</p>
        ) : loading ? (
          <div className="flex items-center gap-2 py-3 text-[11px] text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="rounded-lg border border-dashed border-[#3A2A2A] px-2.5 py-2.5 text-[11px] text-red-400">
            {error}
          </p>
        ) : (
          <>
            {noneLabel && (
              <button
                type="button"
                onClick={() => onSelect(undefined)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors",
                  !selectedId
                    ? "border-brand/30 bg-brand/10 text-brand"
                    : "border-[#262626] bg-[#141414] text-zinc-400 hover:border-[#3A3A3A] hover:text-white",
                )}
              >
                {!selectedId && <Check className="h-3 w-3 shrink-0" />}
                <span className="truncate">{noneLabel}</span>
              </button>
            )}

            {items.length === 0 && !noneLabel ? (
              <p className="rounded-lg border border-dashed border-[#262626] px-2.5 py-2.5 text-[11px] text-zinc-500">
                {emptyHint}
              </p>
            ) : (
              items.map((item) => {
                const selected = item._id === selectedId;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => onSelect(item._id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors",
                      selected
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-[#262626] bg-[#141414] text-zinc-400 hover:border-[#3A3A3A] hover:text-white",
                    )}
                  >
                    {selected ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color || "#008080" }}
                      />
                    )}
                    <span className="truncate">{item.name || "Untitled"}</span>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>

      {showCreate && !disabled && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
            }}
            placeholder={createPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-[#262626] bg-[#1A1A1A] px-2 py-1.5 text-[11px] text-white outline-none placeholder:text-zinc-600 focus:border-brand"
          />
          <button
            type="button"
            onClick={create}
            disabled={creating || !draftName.trim()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating && <Loader2 className="h-3 w-3 animate-spin" />}
            Add
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCreate((open) => !open)}
        disabled={disabled}
        className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#262626] py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {showCreate ? <X className="h-3 w-3" /> : <FolderPlus className="h-3 w-3" />}
        {showCreate ? "Cancel" : createLabel}
      </button>
    </div>
  );
}

export function TaskroomDestinationPicker({
  workspaceId,
  spaceId,
  roomId,
  serviceTitle,
  onChange,
}: {
  workspaceId?: string;
  spaceId?: string;
  roomId?: string;
  /** Seeds the suggested name when creating the service's master room. */
  serviceTitle?: string;
  onChange: (destination: {
    workspaceId?: string;
    spaceId?: string;
    roomId?: string;
  }) => void;
}) {
  const [workspaces, setWorkspaces] = useState<TaskroomWorkspace[]>([]);
  const [spaces, setSpaces] = useState<TaskroomSpace[]>([]);
  const [rooms, setRooms] = useState<TaskroomRoom[]>([]);

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [workspaceError, setWorkspaceError] = useState("");
  const [spaceError, setSpaceError] = useState("");
  const [roomError, setRoomError] = useState("");

  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    setWorkspaceError("");
    try {
      const list = await listTaskroomWorkspaces();
      setWorkspaces(list);

      // A service that has never been configured lands on the founder's first
      // workspace rather than on nothing — they can still change it, but the
      // section is never silently incomplete.
      if (list.length > 0 && !list.some((item) => item._id === workspaceId)) {
        // The stored workspace is gone, so anything filed under it is gone too.
        onChange({
          workspaceId: list[0]._id,
          spaceId: undefined,
          roomId: undefined,
        });
      }
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "Could not load your Taskroom workspaces",
      );
    } finally {
      setLoadingWorkspaces(false);
    }
    // One-shot load: re-running it on every selection would fight the founder's
    // choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSpaces = useCallback(async () => {
    if (!workspaceId) {
      setSpaces([]);
      return;
    }
    setLoadingSpaces(true);
    setSpaceError("");
    try {
      const list = await listTaskroomSpaces(workspaceId);
      setSpaces(list);

      // A space stored on the service that is no longer in the workspace is
      // dropped here rather than left to fail at provisioning time.
      if (spaceId && !list.some((item) => item._id === spaceId)) {
        onChange({ spaceId: undefined, roomId: undefined });
      }
    } catch (error) {
      setSpaces([]);
      setSpaceError(
        error instanceof Error ? error.message : "Could not load the spaces",
      );
    } finally {
      setLoadingSpaces(false);
    }
    // Keyed by workspace alone: `spaceId`/`onChange` are read to prune a stale
    // selection, and depending on them would reload the list on every pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const loadRooms = useCallback(async () => {
    if (!spaceId) {
      setRooms([]);
      return;
    }
    setLoadingRooms(true);
    setRoomError("");
    try {
      const list = await listTaskroomRooms(spaceId);
      setRooms(list);

      if (roomId && !list.some((item) => item._id === roomId)) {
        onChange({ roomId: undefined });
      }
    } catch (error) {
      setRooms([]);
      setRoomError(
        error instanceof Error ? error.message : "Could not load the rooms",
      );
    } finally {
      setLoadingRooms(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  return (
    <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
      <div className="mb-2.5">
        <p className="text-xs font-semibold text-white">Taskroom destination</p>
        <p className="text-[11px] text-zinc-500">
          Client rooms for this service are created inside the workspace and
          space you pick. The room is optional — it holds the service&apos;s own
          board, seeded from your milestones when you publish.
        </p>
      </div>

      <div className="grid gap-2.5 md:grid-cols-3">
        <PickerColumn
          title="Workspace"
          hint="Where client rooms are filed"
          items={workspaces}
          selectedId={workspaceId}
          loading={loadingWorkspaces}
          error={workspaceError}
          emptyHint="No workspaces yet. Create one to hold this service's client rooms."
          createLabel="New workspace"
          createPlaceholder="e.g. Client Delivery"
          onSelect={(id) =>
            // A space and room from another workspace must not survive the move.
            onChange({ workspaceId: id, spaceId: undefined, roomId: undefined })
          }
          onCreate={async (name) => {
            try {
              const created = await createTaskroomWorkspace(name);
              setWorkspaces((prev) => [...prev, created]);
              onChange({
                workspaceId: created._id,
                spaceId: undefined,
                roomId: undefined,
              });
              toast.success(`Workspace "${name}" created`);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create the workspace",
              );
            }
          }}
          onRefresh={loadWorkspaces}
        />

        <PickerColumn
          title="Space"
          hint="The folder inside that workspace"
          items={spaces}
          selectedId={spaceId}
          loading={loadingSpaces}
          error={spaceError}
          disabled={!workspaceId}
          disabledHint="Pick a workspace first."
          emptyHint="No spaces in this workspace yet."
          createLabel="New space"
          createPlaceholder="e.g. Client Engagements"
          noneLabel="Auto — Client Engagements"
          onSelect={(id) => onChange({ spaceId: id, roomId: undefined })}
          onCreate={async (name) => {
            if (!workspaceId) return;
            try {
              const created = await createTaskroomSpace(name, workspaceId);
              setSpaces((prev) => [...prev, created]);
              onChange({ spaceId: created._id, roomId: undefined });
              toast.success(`Space "${name}" created`);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create the space",
              );
            }
          }}
          onRefresh={loadSpaces}
        />

        <PickerColumn
          title="Master room"
          hint="Optional board for this service"
          items={rooms}
          selectedId={roomId}
          loading={loadingRooms}
          error={roomError}
          disabled={!spaceId}
          disabledHint="Pick a space first — rooms live inside one."
          emptyHint="No rooms in this space yet."
          createLabel="New room"
          createPlaceholder={serviceTitle ? `e.g. ${serviceTitle}` : "e.g. Web Sprint"}
          noneLabel="None — client rooms only"
          onSelect={(id) => onChange({ roomId: id })}
          onCreate={async (name) => {
            if (!spaceId) return;
            try {
              const created = await createTaskroomRoom(name, spaceId);
              setRooms((prev) => [...prev, created]);
              onChange({ roomId: created._id });
              toast.success(`Room "${name}" created`);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create the room",
              );
            }
          }}
          onRefresh={loadRooms}
        />
      </div>

      {!spaceId && workspaceId && (
        <p className="mt-2 text-[11px] text-zinc-600">
          With no space picked, a private &quot;Client Engagements&quot; space is
          created in this workspace on the first opt-in.
        </p>
      )}
    </div>
  );
}
