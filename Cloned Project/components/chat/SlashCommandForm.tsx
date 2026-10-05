"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Plus,
  Trash2,
  CheckSquare,
  BarChart3,
  Calendar,
  TrendingUp,
  ShieldCheck,
  FileText,
  ShoppingBag,
  ListChecks,
  CalendarDays,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayCalendar } from "@/components/ui/calendar";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken, getUserDataFromToken, getOrgId } from "@/lib/auth";
import {
  encodeTask,
  encodePoll,
  encodeMeet,
  encodeDeal,
  encodeApproval,
  encodeDoc,
  encodeShare,
  OFFICE_CONFERENCE_ROOM_ID,
  type TaskPriority,
  type DealStage,
} from "@/lib/chat-markers";
import type { SlashCommandId } from "@/lib/hooks/useSlashCommands";
import { ManualTaskroomForm } from "@/components/chat/ManualTaskroomForm";

export interface SlashFormMember {
  id: string;
  name?: string;
  email?: string;
}

interface SlashCommandFormProps {
  command: SlashCommandId | null;
  orgId?: string;
  members?: SlashFormMember[]; // members in the current chat (used as defaults)
  // DM chats lock the assignee to the other participant — no picker shown.
  // Group chats leave this undefined and use the members[] list.
  lockedAssignee?: SlashFormMember;
  // Group chats allow selecting multiple assignees; we then POST one task per
  // assignee so each one sees the task in their Taskrooms.
  multiAssign?: boolean;
  onSubmit: (encoded: string) => void;
  onClose: () => void;
  // ── Group-chat "/taskroom" only ──────────────────────────────────────
  // These power the ManualTaskroomForm branch (command === "taskroom"), which
  // posts straight to the group's linked board instead of encoding a marker.
  // They stay optional so DM/Global usage is unaffected.
  groupId?: string;
  uploadFile?: (
    f: File
  ) => Promise<{ fileUrl: string; fileName: string; fileType: string; fileSize?: number }>;
  onCreated?: () => void;
  syncedMemberIds?: string[];
  // The signed-in user, so /taskroom can offer "assign to yourself" (the shared
  // members[] list excludes self, matching the @mention convention).
  currentUser?: SlashFormMember;
}

// Dialog wrapper that routes to the right form. Each form encodes its data
// as a marker string and hands it back via onSubmit — the host page is
// responsible for actually sending the message. Forms make AT MOST one
// backend POST (task / meeting); others are pure client-side.
export function SlashCommandForm({
  command,
  orgId,
  members = [],
  lockedAssignee,
  multiAssign = false,
  onSubmit,
  onClose,
  groupId,
  uploadFile,
  onCreated,
  syncedMemberIds,
  currentUser,
}: SlashCommandFormProps) {
  // Radix keeps the dialog on screen for its close animation after `command`
  // goes null. Keep rendering the last command through it — otherwise the
  // header and body blank out while the box fades.
  const [shown, setShown] = useState<SlashCommandId | null>(command);
  if (command && command !== shown) setShown(command);
  const current = command ?? shown;
  const taskroomReady = !!groupId && !!uploadFile;
  // Never open onto an empty body: only commands that have a form here.
  const open =
    command === "poll" || command === "meet" || command === "share" || (command === "taskroom" && taskroomReady);
  const title = current ? FORM_TITLES[current] : "";
  const Icon = current ? FORM_ICONS[current] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="bg-[#0e0e12] border-[#2E2E2E] text-white max-w-md p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-4 py-3 border-b border-[#2E2E2E] flex flex-row items-center gap-2 space-y-0">
          {Icon ? (
            <div className="h-6 w-6 rounded-sm bg-brand/15 text-brand flex items-center justify-center">
              <Icon className="h-3 w-3" />
            </div>
          ) : null}
          <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
          <button
            onClick={onClose}
            className="ml-auto h-6 w-6 rounded-sm hover:bg-white/10 flex items-center justify-center text-white/60"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </DialogHeader>
          {/* BackOffice forms — commented out
          {command === "task" && (
            <TaskForm
              orgId={orgId}
              members={members}
              lockedAssignee={lockedAssignee}
              multiAssign={multiAssign}
              onSubmit={onSubmit}
            />
          )}
          {command === "deal" && <DealForm orgId={orgId} onSubmit={onSubmit} />}
          {command === "approve" && (
            <ApprovalForm orgId={orgId} members={members} onSubmit={onSubmit} />
          )}
          {command === "doc" && <DocForm orgId={orgId} onSubmit={onSubmit} />}
          */}
        <div className="px-4 py-3 max-h-[70vh] overflow-y-auto">
          {current === "poll" && <PollForm onSubmit={onSubmit} />}
          {current === "meet" && (
            <MeetForm orgId={orgId} members={members} onSubmit={onSubmit} />
          )}
          {current === "share" && <ShareForm orgId={orgId} onSubmit={onSubmit} />}
          {/* Group chat only: posts to the linked board, no chat marker. */}
          {current === "taskroom" && groupId && uploadFile && (
            <ManualTaskroomForm
              groupId={groupId}
              members={[
                // Self first, so the reporter can assign the task to themselves;
                // members[] excludes self (the @mention convention).
                ...(currentUser
                  ? [{ id: currentUser.id, name: currentUser.name || currentUser.email || currentUser.id }]
                  : []),
                ...members
                  .filter((m) => !currentUser || m.id !== currentUser.id)
                  .map((m) => ({ id: m.id, name: m.name || m.email || m.id })),
              ]}
              currentUserId={currentUser?.id}
              syncedMemberIds={syncedMemberIds}
              uploadFile={uploadFile}
              onCreated={onCreated}
              onClose={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FORM_TITLES: Record<string, string> = {
  task: "Create Task",
  poll: "Create Poll",
  meet: "Schedule Meeting",
  deal: "Share Deal",
  approve: "Request Approval",
  doc: "Share Document",
  share: "Share Product",
  taskroom: "Add to Taskroom",
};

const FORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  task: CheckSquare,
  poll: BarChart3,
  meet: Calendar,
  deal: TrendingUp,
  approve: ShieldCheck,
  doc: FileText,
  share: ShoppingBag,
  taskroom: ListChecks,
};

// ─────────────────────────────────────────────────────────────────────
// Task — POST to the Taskrooms backend so the task shows up in the
// Taskrooms UI. Embed the room + stages list in the marker so the chat
// card can deep-link and PATCH stage without re-fetching.
// ─────────────────────────────────────────────────────────────────────
const TASKROOMS_BASE = "https://uatapi.garage.app/taskroom";

type TaskroomHit = {
  _id: string;
  name: string;
};

type StageHit = {
  _id: string;
  name: string;
};

function TaskForm({
  orgId,
  members,
  lockedAssignee,
  multiAssign,
  onSubmit,
}: {
  orgId?: string;
  members: SlashFormMember[];
  lockedAssignee?: SlashFormMember;
  multiAssign?: boolean;
  onSubmit: (encoded: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // DM mode: assignee is locked to the other participant — initialise from
  // lockedAssignee.id and keep it immutable. Group multi-mode: track an array.
  // Single-assign group mode: track one id like before.
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() =>
    lockedAssignee ? [lockedAssignee.id] : []
  );
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [busy, setBusy] = useState(false);

  // Taskrooms picker state
  const [taskrooms, setTaskrooms] = useState<TaskroomHit[] | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [taskroomId, setTaskroomId] = useState<string>("");
  const [stages, setStages] = useState<StageHit[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [stageId, setStageId] = useState<string>("");

  const meId = useMemo(() => getUserIdFromToken() || "", []);
  // The org_id localStorage key isn't always populated (e.g. when the user
  // signed in via a flow that didn't write it), so fall back to the JWT
  // payload — same source the Taskrooms UI uses to read orgId.
  const tokenOrgId = useMemo(() => getUserDataFromToken().orgId || "", []);
  const effectiveOrgId = orgId || tokenOrgId;
  const selectedRoom = useMemo(
    () => (taskrooms || []).find((r) => r._id === taskroomId),
    [taskrooms, taskroomId]
  );

  function toggleAssignee(id: string) {
    setAssigneeIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // Fetch the user's taskrooms once when the form mounts. Without a room
  // selection we can't create a task, so this is mandatory.
  useEffect(() => {
    if (!effectiveOrgId || !meId) {
      // Surface an empty list so the dropdown leaves its loading state and
      // shows the "no taskrooms" hint instead of staying stuck on null.
      setTaskrooms([]);
      return;
    }
    setLoadingRooms(true);
    const url = `${TASKROOMS_BASE}/v1/rooms/detail?orgId=${effectiveOrgId}&page=1&size=50&userId=${meId}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.data) ? d.data : [];
        const mapped: TaskroomHit[] = list
          .map((r: Record<string, unknown>) => ({
            _id: String(r._id ?? r.id ?? ""),
            name: String(r.name ?? "Untitled"),
          }))
          .filter((r: TaskroomHit) => r._id);
        setTaskrooms(mapped);
        if (mapped.length > 0 && !taskroomId) setTaskroomId(mapped[0]._id);
      })
      .catch((err) => {
        console.error("[TaskForm] Failed to load taskrooms", err);
        setTaskrooms([]);
      })
      .finally(() => setLoadingRooms(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId, meId]);

  // Fetch stages for the chosen room. Tasks need a stageId to be created,
  // and the card needs the full list to render the inline status pills.
  useEffect(() => {
    if (!taskroomId) {
      setStages([]);
      setStageId("");
      return;
    }
    setLoadingStages(true);
    fetch(`${TASKROOMS_BASE}/v1/stages/task?roomId=${taskroomId}&size=30`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.data) ? d.data : [];
        const mapped: StageHit[] = list
          .map((s: Record<string, unknown>) => ({
            _id: String(s._id ?? ""),
            name: String(s.name ?? ""),
          }))
          .filter((s: StageHit) => s._id && s.name);
        setStages(mapped);
        // Default to the first stage (typically "Backlog" / "To Do")
        setStageId(mapped[0]?._id || "");
      })
      .catch(() => setStages([]))
      .finally(() => setLoadingStages(false));
  }, [taskroomId]);

  async function submit() {
    const t = title.trim();
    if (!t) return toast.error("Title is required");
    if (!effectiveOrgId) return toast.error("No active organization");
    if (!taskroomId) {
      if (!taskrooms || taskrooms.length === 0) {
        return toast.error("No taskrooms — create one in Taskrooms first");
      }
      return toast.error("Pick a Taskroom");
    }
    if (!stageId) return toast.error("Taskroom has no stages");
    if (!meId) return toast.error("Not signed in");
    setBusy(true);
    try {
      // The Taskrooms backend stores dates as epoch millis. startDate
      // defaults to today since the API requires both.
      const startMs = Date.now();
      const dueMs = dueDate ? new Date(dueDate).getTime() : startMs;
      // The Taskrooms API accepts "low"|"medium"|"high"; "urgent" is mapped
      // to "high" so the slash-form's full enum doesn't reject server-side.
      const taskroomPriority = priority === "urgent" ? "high" : priority;
      // One POST per assignee so each one sees the task in their Taskrooms.
      // If no assignee picked we still create a single unassigned task.
      const targets = assigneeIds.length > 0 ? assigneeIds : [""];
      const results = await Promise.all(
        targets.map(async (aid) => {
          const res = await fetch(`${TASKROOMS_BASE}/v1/tasks`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              title: t,
              description: description.trim(),
              roomId: taskroomId,
              stageId,
              userId: meId,
              priority: taskroomPriority,
              assignedToId: aid,
              startDate: startMs,
              dueDate: dueMs,
              tags: [],
              attachments: [],
            }),
          });
          const data = await res.json();
          if (!res.ok || data?.status === false) {
            throw new Error(data?.message || "Failed to create task");
          }
          const id = String(data?.data?._id || "");
          if (!id) throw new Error("Task ID missing from response");
          return { taskId: id, assigneeId: aid };
        })
      );

      const assignees = results
        .filter((r) => r.assigneeId)
        .map((r) => {
          const m = members.find((mm) => mm.id === r.assigneeId);
          return {
            id: r.assigneeId,
            name:
              r.assigneeId === lockedAssignee?.id
                ? lockedAssignee.name || lockedAssignee.email
                : m?.name || m?.email,
          };
        });
      const primary = results[0];
      onSubmit(
        encodeTask({
          taskId: primary.taskId,
          taskIds: results.map((r) => r.taskId),
          title: t,
          status: "todo",
          assigneeId: assignees[0]?.id,
          assigneeName: assignees[0]?.name,
          assignees,
          availableAssignees: members.map((m) => ({
            id: m.id,
            name: m.name || m.email,
          })),
          dueDate: dueDate || undefined,
          priority,
          description: description.trim() || undefined,
          taskroomId,
          taskroomName: selectedRoom?.name,
          stages: stages.map((s) => ({ id: s._id, name: s.name })),
          currentStageId: stageId,
        })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Taskroom</FieldLabel>
      <select
        value={taskroomId}
        onChange={(e) => setTaskroomId(e.target.value)}
        disabled={loadingRooms || !taskrooms || taskrooms.length === 0}
        className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2 disabled:opacity-60"
      >
        {loadingRooms && <option value="">Loading taskrooms…</option>}
        {!loadingRooms && (!taskrooms || taskrooms.length === 0) && (
          <option value="">No taskrooms — create one in Taskrooms first</option>
        )}
        {!loadingRooms &&
          (taskrooms || []).map((r) => (
            <option key={r._id} value={r._id}>
              {r.name}
            </option>
          ))}
      </select>
      <FieldLabel>Title</FieldLabel>
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />
      <FieldLabel>Description (optional)</FieldLabel>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add details…"
        rows={2}
        className="bg-black/30 border-[#2E2E2E] text-xs resize-none"
      />
      {/* Assignee: hidden in DM (locked to the other participant), single-pick
          for group/single mode, multi-select checkbox list for group/multi. */}
      {lockedAssignee ? (
        <div>
          <FieldLabel>Assignee</FieldLabel>
          <div className="h-8 rounded-md bg-black/20 border border-[#2E2E2E] text-xs text-white/80 px-2 flex items-center">
            {lockedAssignee.name || lockedAssignee.email || "Unknown"}
          </div>
        </div>
      ) : multiAssign ? (
        <div>
          <FieldLabel>Assignees ({assigneeIds.length})</FieldLabel>
          <div className="max-h-[120px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
            {members.length === 0 && (
              <div className="text-[10px] text-white/40 px-2 py-2 text-center">
                No members in this chat
              </div>
            )}
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(m.id)}
                  onChange={() => toggleAssignee(m.id)}
                  className="accent-brand"
                />
                <span className="text-[11px] text-white/80">{m.name || m.email}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <FieldLabel>Assignee</FieldLabel>
          <select
            value={assigneeIds[0] || ""}
            onChange={(e) =>
              setAssigneeIds(e.target.value ? [e.target.value] : [])
            }
            className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <FieldLabel>Priority</FieldLabel>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2 capitalize"
        >
          {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Stage</FieldLabel>
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            disabled={loadingStages || stages.length === 0}
            className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2 disabled:opacity-60"
          >
            {loadingStages && <option value="">Loading…</option>}
            {!loadingStages && stages.length === 0 && (
              <option value="">No stages</option>
            )}
            {!loadingStages &&
              stages.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <FieldLabel>Due date</FieldLabel>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-black/30 border-[#2E2E2E] text-xs"
          />
        </div>
      </div>
      <SubmitRow busy={busy} onSubmit={submit} label="Create Task" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Poll — fully client-side. Options ride in the marker; per-user vote
// is stored in localStorage via lib/slash-state.ts.
// ─────────────────────────────────────────────────────────────────────
function PollForm({ onSubmit }: { onSubmit: (encoded: string) => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multi, setMulti] = useState(false);
  const [anonymous, setAnonymous] = useState(false);

  function setOption(i: number, v: string) {
    setOptions((o) => o.map((cur, idx) => (idx === i ? v : cur)));
  }
  function addOption() {
    if (options.length >= 10) return;
    setOptions((o) => [...o, ""]);
  }
  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, idx) => idx !== i));
  }

  function submit() {
    const q = question.trim();
    if (!q) return toast.error("Question is required");
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (cleaned.length < 2) return toast.error("Add at least 2 options");
    onSubmit(
      encodePoll({
        pollId: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        question: q,
        options: cleaned.map((text, i) => ({ id: `o${i}`, text })),
        isMultiChoice: multi,
        isAnonymous: anonymous,
      })
    );
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Question</FieldLabel>
      <Input
        autoFocus
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={280}
        placeholder="What do you want to ask?"
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />
      <FieldLabel>Options</FieldLabel>
      <div className="space-y-1.5">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className="bg-black/30 border-[#2E2E2E] text-xs"
            />
            <button
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
              className="shrink-0 h-7 w-7 rounded-sm flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Remove option"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {options.length < 10 && (
          <button
            onClick={addOption}
            className="flex items-center gap-1 text-[11px] text-white/60 hover:text-white"
          >
            <Plus className="h-3 w-3" /> Add option
          </button>
        )}
      </div>
      <div className="flex items-center gap-4 pt-1">
        <ToggleField label="Multiple choice" checked={multi} onChange={setMulti} />
        <ToggleField label="Anonymous" checked={anonymous} onChange={setAnonymous} />
      </div>
      <SubmitRow onSubmit={submit} label="Post Poll" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Meeting — books a REAL conference room via POST /room-bookings (mirrors
// ConferenceRoomPage's contract exactly) and embeds the booked room +
// booking id in the marker so the chat card's Join opens the real LiveKit
// conference at /meet/conference/<orgId>/<roomId>.
// ─────────────────────────────────────────────────────────────────────
type ConferenceRoomHit = {
  _id: string;
  name: string;
  spaceId?: string;
  isActive?: boolean;
};

function MeetForm({
  orgId,
  members,
  onSubmit,
}: {
  orgId?: string;
  members: SlashFormMember[];
  onSubmit: (encoded: string) => void;
}) {
  // orgId prop first, then the persisted org (localStorage/JWT) as fallback.
  const effectiveOrgId = useMemo(() => orgId || getOrgId() || "", [orgId]);

  const [title, setTitle] = useState("");
  const [rooms, setRooms] = useState<ConferenceRoomHit[] | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState("");
  // Start on the next free 15-minute slot, so the common case is one tap.
  const [date, setDate] = useState(() => ymd(nextSlot()));
  const [time, setTime] = useState(() => hm(nextSlot()));
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Always offer the office's shared room so ANY member can book, even when no
  // founder has created a named room (that's founder-only). Named rooms, if
  // any, come first; the office default books org-wide (no conferenceRoomId).
  const roomOptions = useMemo(
    () => [
      ...(rooms || []),
      { _id: OFFICE_CONFERENCE_ROOM_ID, name: "Conference Room (this office)" },
    ],
    [rooms]
  );
  const selectedRoom = useMemo(
    () => roomOptions.find((r) => r._id === roomId),
    [roomOptions, roomId]
  );
  const onlyOfficeRoom = !loadingRooms && !roomsError && (!rooms || rooms.length === 0);

  function toggleInvitee(id: string) {
    setInvitees((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // Load the org's conference rooms. A booking must bind to one, so without a
  // room there's nothing to book — mirrors GET /conference-rooms in
  // ConferenceRoomPage (response shape: { success, rooms: [...] }). A load
  // FAILURE (auth, network, a 4xx) is surfaced with a Retry — it must not be
  // shown as "no conference rooms", which sent people hunting for a room that
  // was there all along.
  const loadRooms = useCallback(() => {
    if (!effectiveOrgId) {
      setRooms([]);
      setRoomsError("No active organization — reopen the chat and try again");
      return;
    }
    setLoadingRooms(true);
    setRoomsError(null);
    api<{ success?: boolean; rooms: ConferenceRoomHit[] }>(
      `/conference-rooms?orgId=${effectiveOrgId}`,
      {},
      getToken() || undefined
    )
      .then((res) => {
        const list = Array.isArray(res?.rooms) ? res.rooms : [];
        setRooms(list);
        // Default to the first named room, else the office's shared room.
        setRoomId((cur) => cur || list[0]?._id || OFFICE_CONFERENCE_ROOM_ID);
      })
      .catch((err) => {
        console.error("[MeetForm] Failed to load conference rooms", err);
        setRooms([]);
        // Named rooms couldn't load, but the office room is still bookable.
        setRoomId((cur) => cur || OFFICE_CONFERENCE_ROOM_ID);
        setRoomsError(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't load conference rooms"
        );
      })
      .finally(() => setLoadingRooms(false));
  }, [effectiveOrgId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  async function submit() {
    const t = title.trim();
    if (!t) return toast.error("Title is required");
    if (!effectiveOrgId) return toast.error("No active organization");
    if (!roomId) return toast.error("Pick a conference room");
    if (!date || !time) return toast.error("Date and time are required");

    const start = new Date(`${date}T${time}`);
    if (isNaN(start.getTime())) return toast.error("Invalid date or time");
    // The default slot is picked when the form opens and can lapse while it sits open.
    if (start.getTime() < Date.now() - 60_000) return toast.error("That time has passed — pick a later one");
    const end = new Date(start.getTime() + duration * 60_000);

    setBusy(true);
    try {
      // Mirror ConferenceRoomPage's exact contract: conferenceRoomId + title +
      // ISO startTime/endTime + invitedUserIds. `description` is documented on
      // the RoomBooking model (workspace/types.ts), so we include it when set.
      const desc = description.trim();
      const res = await api<any>(
        `/room-bookings?orgId=${effectiveOrgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            // The office default room books org-wide (no conferenceRoomId) —
            // any member may create such a booking. A named room binds to its id.
            ...(roomId !== OFFICE_CONFERENCE_ROOM_ID
              ? { conferenceRoomId: roomId }
              : {}),
            title: t,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            invitedUserIds: invitees,
            ...(desc ? { description: desc } : {}),
          }),
        },
        getToken()!
      );

      // The POST response shape isn't consumed elsewhere in the app, so be
      // defensive about the wrapper ({ booking }, { data }, or the doc itself).
      const booking = res?.booking || res?.data || res || {};
      const bookingId: string | undefined = booking._id || booking.id;

      onSubmit(
        encodeMeet({
          eventId:
            bookingId ||
            `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          title: t,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          invitees: invitees.map((id) => {
            const m = members.find((mm) => mm.id === id);
            return { id, name: m?.name || m?.email };
          }),
          orgId: effectiveOrgId,
          roomId,
          roomName: selectedRoom?.name,
          bookingId,
          description: desc || undefined,
        })
      );
    } catch (err: any) {
      // api() throws Error(backendMessage) and drops the HTTP status, so a
      // time-slot clash surfaces as the backend's 409 text. Detect it from the
      // message (and the status if a caller ever attaches one) and keep the
      // form open so the host can pick another slot — do NOT send the card.
      const msg = err instanceof Error ? err.message : String(err || "");
      if (err?.status === 409 || /conflict|already booked|overlap|\b409\b/i.test(msg)) {
        toast.error("That room is already booked for that time — pick another slot");
      } else {
        toast.error(msg || "Failed to book the room");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Title</FieldLabel>
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Meeting title"
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />
      <FieldLabel>Conference room</FieldLabel>
      <select
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        disabled={loadingRooms}
        className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2 disabled:opacity-60"
      >
        {loadingRooms && <option value="">Loading rooms…</option>}
        {!loadingRooms &&
          roomOptions.map((r) => (
            <option key={r._id} value={r._id}>
              {r.name}
            </option>
          ))}
      </select>
      {roomsError ? (
        <div className="flex items-center gap-2 text-[10px] text-amber-300/80">
          <span className="min-w-0 break-words">
            Couldn&apos;t load named rooms — you can still book this office&apos;s room.
          </span>
          <button
            type="button"
            onClick={loadRooms}
            className="shrink-0 underline hover:text-amber-200"
          >
            Retry
          </button>
        </div>
      ) : onlyOfficeRoom ? (
        <div className="text-[10px] text-white/40">
          Using this office&apos;s shared room. Founders can add named rooms under
          Conference Rooms.
        </div>
      ) : null}
      <MeetWhenPicker date={date} time={time} onDate={setDate} onTime={setTime} />
      <FieldLabel>Duration</FieldLabel>
      <div className="flex items-center gap-1.5">
        {[15, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={`px-2 py-1 rounded-sm text-[11px] border ${
              duration === d
                ? "border-brand text-brand bg-brand/10"
                : "border-[#2E2E2E] text-white/70 hover:bg-white/5"
            }`}
          >
            {d < 60 ? `${d}m` : `${d / 60}h`}
          </button>
        ))}
      </div>
      <MeetWhenSummary date={date} time={time} duration={duration} />
      <FieldLabel>Description (optional)</FieldLabel>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add details…"
        rows={2}
        className="bg-black/30 border-[#2E2E2E] text-xs resize-none"
      />
      {members.length > 0 && (
        <>
          <FieldLabel>Invitees ({invitees.length})</FieldLabel>
          <div className="max-h-[120px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={invitees.includes(m.id)}
                  onChange={() => toggleInvitee(m.id)}
                  className="accent-brand"
                />
                <span className="text-[11px] text-white/80">{m.name || m.email}</span>
              </label>
            ))}
          </div>
        </>
      )}
      <SubmitRow busy={busy} onSubmit={submit} label="Schedule Meeting" disabled={loadingRooms || !roomId} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Deal — search existing deals or create a new one. Each picked result is
// shared with its real backend ID so the card stays in sync via socket.
// ─────────────────────────────────────────────────────────────────────
type DealHit = {
  _id: string;
  name: string;
  stage: DealStage;
  value?: number;
  currency?: string;
};

function DealForm({
  orgId,
  onSubmit,
}: {
  orgId?: string;
  onSubmit: (encoded: string) => void;
}) {
  const [mode, setMode] = useState<"search" | "create">("search");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [results, setResults] = useState<DealHit[]>([]);
  const [loading, setLoading] = useState(false);
  const requestSeq = useRef(0);

  // Create-mode fields
  const [name, setName] = useState("");
  const [stage, setStage] = useState<DealStage>("lead");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "search") return;
    const q = debounced.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    api<{ deals: DealHit[] }>(
      `/slash/deals/search?q=${encodeURIComponent(q)}`,
      {},
      getToken() || undefined
    )
      .then((res) => {
        if (requestSeq.current !== seq) return;
        setResults(res.deals || []);
      })
      .catch(() => {
        if (requestSeq.current !== seq) return;
        setResults([]);
      })
      .finally(() => {
        if (requestSeq.current === seq) setLoading(false);
      });
  }, [debounced, mode]);

  function shareExisting(d: DealHit) {
    onSubmit(
      encodeDeal({
        dealId: d._id,
        name: d.name,
        stage: d.stage,
        value: d.value,
        currency: d.currency || "USD",
      })
    );
  }

  async function createAndShare() {
    const n = name.trim();
    if (!n) return toast.error("Deal name is required");
    if (!orgId) return toast.error("No active organization");
    const numeric = value ? Number(value) : 0;
    setBusy(true);
    try {
      const res = await api<{ deal: DealHit }>(
        "/slash/deals",
        {
          method: "POST",
          body: JSON.stringify({
            name: n,
            stage,
            value: Number.isFinite(numeric) ? numeric : 0,
          }),
        },
        getToken() || undefined
      );
      shareExisting(res.deal);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <ModeButton active={mode === "search"} onClick={() => setMode("search")}>
          Search
        </ModeButton>
        <ModeButton active={mode === "create"} onClick={() => setMode("create")}>
          New deal
        </ModeButton>
      </div>

      {mode === "search" && (
        <>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals by name…"
            className="bg-black/30 border-[#2E2E2E] text-xs"
          />
          <div className="max-h-[220px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
            {loading && (
              <div className="text-[11px] text-white/50 px-2 py-3 text-center">
                Searching…
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="text-[11px] text-white/40 px-2 py-3 text-center">
                {query.trim() ? "No matches" : "Type to search"}
              </div>
            )}
            {!loading &&
              results.map((d) => (
                <button
                  key={d._id}
                  onClick={() => shareExisting(d)}
                  className="w-full text-left px-2 py-1.5 hover:bg-white/5 border-b border-white/5 last:border-b-0"
                >
                  <div className="text-[11px] text-white truncate">{d.name}</div>
                  <div className="text-[9px] text-white/50 capitalize mt-0.5">
                    {d.stage}
                    {typeof d.value === "number" && d.value > 0
                      ? ` · ${d.currency || "USD"} ${d.value.toLocaleString()}`
                      : ""}
                  </div>
                </button>
              ))}
          </div>
        </>
      )}

      {mode === "create" && (
        <>
          <FieldLabel>Deal name</FieldLabel>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme renewal"
            className="bg-black/30 border-[#2E2E2E] text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Stage</FieldLabel>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
                className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2 capitalize"
              >
                {(["lead", "qualified", "proposal", "won", "lost"] as DealStage[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <FieldLabel>Value (USD)</FieldLabel>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="bg-black/30 border-[#2E2E2E] text-xs"
              />
            </div>
          </div>
          <SubmitRow busy={busy} onSubmit={createAndShare} label="Create & share" />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Approval — POSTs to /slash/approvals and embeds the real approvalId so
// the card's Approve/Reject buttons can hit /:id/decide.
// ─────────────────────────────────────────────────────────────────────
function ApprovalForm({
  orgId,
  members,
  onSubmit,
}: {
  orgId?: string;
  members: SlashFormMember[];
  onSubmit: (encoded: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setApproverIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit() {
    const t = title.trim();
    if (!t) return toast.error("Title is required");
    if (approverIds.length === 0) return toast.error("Pick at least one approver");
    if (!orgId) return toast.error("No active organization");
    setBusy(true);
    try {
      const res = await api<{ approval: { _id: string; requesterId: string } }>(
        "/slash/approvals",
        {
          method: "POST",
          body: JSON.stringify({
            title: t,
            description: description.trim() || undefined,
            approverIds,
            deadline: deadline || undefined,
            approvalType: "parallel",
          }),
        },
        getToken() || undefined
      );
      onSubmit(
        encodeApproval({
          approvalId: res.approval._id,
          title: t,
          description: description.trim() || undefined,
          approvers: approverIds.map((id) => {
            const m = members.find((mm) => mm.id === id);
            return { id, name: m?.name || m?.email };
          }),
          requesterId: res.approval.requesterId,
          deadline: deadline || undefined,
        })
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Title</FieldLabel>
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs approval?"
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />
      <FieldLabel>Description (optional)</FieldLabel>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Context for the approvers…"
        rows={2}
        className="bg-black/30 border-[#2E2E2E] text-xs resize-none"
      />
      {members.length > 0 ? (
        <>
          <FieldLabel>Approvers</FieldLabel>
          <div className="max-h-[120px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={approverIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="accent-brand"
                />
                <span className="text-[11px] text-white/80">{m.name || m.email}</span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-white/50">No members available to approve.</div>
      )}
      <FieldLabel>Deadline (optional)</FieldLabel>
      <Input
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />
      <SubmitRow busy={busy} onSubmit={submit} label="Request Approval" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Document — browse user's Cabinet files or paste an external URL.
// Browse uses the existing /cabinet/files/all endpoint (one call, cached
// by the picker for the duration of the dialog).
// ─────────────────────────────────────────────────────────────────────
type CabinetFile = {
  _id: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  mimeType?: string;
  fileUrl: string;
  thumbnailUrl?: string;
};

function DocForm({
  orgId,
  onSubmit,
}: {
  orgId?: string;
  onSubmit: (encoded: string) => void;
}) {
  const [mode, setMode] = useState<"cabinet" | "url">("cabinet");
  const [files, setFiles] = useState<CabinetFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  // Load cabinet files once when the picker opens. Cached in state so
  // switching modes doesn't refetch.
  useEffect(() => {
    if (mode !== "cabinet" || files !== null) return;
    if (!orgId) return;
    setLoading(true);
    api<{ files: CabinetFile[] }>(
      `/cabinet/files/all?orgId=${orgId}`,
      {},
      getToken() || undefined
    )
      .then((res) => setFiles(res.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [mode, files, orgId]);

  const filtered = (files || []).filter((f) =>
    f.fileName.toLowerCase().includes(query.trim().toLowerCase())
  );

  function shareCabinetFile(f: CabinetFile) {
    onSubmit(
      encodeDoc({
        docId: f._id,
        name: f.fileName,
        size: f.fileSize,
        mimeType: f.mimeType || f.fileType,
        url: f.fileUrl,
        thumbnail: f.thumbnailUrl,
      })
    );
  }

  function submitUrl() {
    const n = name.trim();
    const u = url.trim();
    if (!n || !u) return toast.error("Name and URL are required");
    if (!/^https?:\/\//i.test(u)) return toast.error("URL must start with http(s)://");
    onSubmit(
      encodeDoc({
        docId: `doc_${Date.now().toString(36)}`,
        name: n,
        url: u,
      })
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <ModeButton active={mode === "cabinet"} onClick={() => setMode("cabinet")}>
          Cabinet
        </ModeButton>
        <ModeButton active={mode === "url"} onClick={() => setMode("url")}>
          Paste URL
        </ModeButton>
      </div>

      {mode === "cabinet" && (
        <>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="bg-black/30 border-[#2E2E2E] text-xs"
          />
          <div className="max-h-[260px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
            {loading && (
              <div className="text-[11px] text-white/50 px-2 py-3 text-center">
                Loading files…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-[11px] text-white/40 px-2 py-3 text-center">
                {files && files.length === 0 ? "No files in Cabinet" : "No matches"}
              </div>
            )}
            {!loading &&
              filtered.map((f) => (
                <button
                  key={f._id}
                  onClick={() => shareCabinetFile(f)}
                  className="w-full flex items-center gap-2 text-left px-2 py-1.5 hover:bg-white/5 border-b border-white/5 last:border-b-0"
                >
                  <div className="h-7 w-7 rounded-sm bg-white/5 flex items-center justify-center shrink-0">
                    <FileText className="h-3 w-3 text-blue-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-white truncate">{f.fileName}</div>
                    {typeof f.fileSize === "number" && (
                      <div className="text-[9px] text-white/40">
                        {formatBytes(f.fileSize)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </>
      )}

      {mode === "url" && (
        <>
          <FieldLabel>File name</FieldLabel>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Q1 plan.pdf"
            className="bg-black/30 border-[#2E2E2E] text-xs"
          />
          <FieldLabel>URL</FieldLabel>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="bg-black/30 border-[#2E2E2E] text-xs"
          />
          <SubmitRow onSubmit={submitUrl} label="Share Document" />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Share — pick a published course / workshop / product. Each kind uses
// its existing list endpoint with a single GET and client-side filtering.
// ─────────────────────────────────────────────────────────────────────
type ShareKindLocal = "course" | "webinar" | "product";

type ShareItem = {
  _id: string;
  title: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
  url: string;
};

// Normalize the three list endpoints into a common shape. Each backend
// returns slightly different fields — keep the mapping in one place.
async function fetchShareItems(
  kind: ShareKindLocal,
  orgId: string
): Promise<ShareItem[]> {
  const token = getToken() || undefined;
  if (kind === "course") {
    const raw = await api<any>(
      `/courses/manage?orgId=${orgId}`,
      {},
      token
    );
    // Backend may return array directly or { courses: [...] }
    const courses = Array.isArray(raw) ? raw : (raw.courses || []);
    return courses.map((c: Record<string, unknown>) => ({
      _id: String(c._id ?? c.id ?? ""),
      title: String(c.title ?? c.name ?? "Untitled"),
      description: typeof c.description === "string" ? c.description : undefined,
      image: typeof c.coverImage === "string" ? c.coverImage : undefined,
      price: typeof c.price === "number" ? c.price : undefined,
      currency: typeof c.currency === "string" ? c.currency : "USD",
      url: `https://www.garage.app/digital/course/${String(c._id ?? c.id ?? "")}`,
    }));
  }
  if (kind === "webinar") {
    const raw = await api<any>(
      `/workshops?orgId=${orgId}`,
      {},
      token
    );
    const workshops = Array.isArray(raw) ? raw : (raw.workshops || []);
    return workshops.map((w: Record<string, unknown>) => ({
      _id: String(w._id ?? w.id ?? ""),
      title: String(w.title ?? w.name ?? "Untitled"),
      description: typeof w.description === "string" ? w.description : undefined,
      image: typeof w.coverImage === "string" ? w.coverImage : undefined,
      price: typeof w.price === "number" ? w.price : undefined,
      currency: typeof w.currency === "string" ? w.currency : "USD",
      url: `/checkout/workshop/${String(w._id ?? w.id ?? "")}`,
    }));
  }
  // products
  const raw = await api<any>(
    `/products?orgId=${orgId}&limit=50`,
    {},
    token
  );
  const products = Array.isArray(raw) ? raw : (raw.products || []);
  return products.map((p: Record<string, unknown>) => ({
    _id: String(p._id ?? p.id ?? ""),
    title: String(p.title ?? p.name ?? "Untitled"),
    description: typeof p.description === "string" ? p.description : undefined,
    image: typeof p.coverImage === "string" ? p.coverImage : undefined,
    price: typeof p.price === "number" ? p.price : undefined,
    currency: typeof p.currency === "string" ? p.currency : "USD",
    url: `/checkout/product/${String(p._id ?? p.id ?? "")}`,
  }));
}

function ShareForm({
  orgId,
  onSubmit,
}: {
  orgId?: string;
  onSubmit: (encoded: string) => void;
}) {
  const [kind, setKind] = useState<ShareKindLocal>("course");
  const [items, setItems] = useState<Record<ShareKindLocal, ShareItem[] | null>>({
    course: null,
    webinar: null,
    product: null,
  });
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // Lazy-load per kind on first open. Cached for the dialog lifetime so
  // toggling kinds doesn't refetch.
  useEffect(() => {
    if (!orgId || items[kind] !== null) return;
    setLoading(true);
    fetchShareItems(kind, orgId)
      .then((next) => setItems((cur) => ({ ...cur, [kind]: next })))
      .catch(() => setItems((cur) => ({ ...cur, [kind]: [] })))
      .finally(() => setLoading(false));
  }, [kind, orgId, items]);

  const list = items[kind] || [];
  const filtered = list.filter((i) =>
    i.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  function share(item: ShareItem) {
    onSubmit(
      encodeShare({
        kind,
        itemId: item._id,
        title: item.title,
        description: item.description,
        image: item.image,
        price: item.price,
        currency: item.currency || "USD",
        url: item.url,
      })
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {(["course", "webinar", "product"] as const).map((k) => (
          <ModeButton key={k} active={kind === k} onClick={() => setKind(k)}>
            <span className="capitalize">{k}</span>
          </ModeButton>
        ))}
      </div>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Filter ${kind}s…`}
        className="bg-black/30 border-[#2E2E2E] text-xs"
      />
      <div className="max-h-[260px] overflow-y-auto rounded-md border border-[#2E2E2E] bg-black/30">
        {loading && (
          <div className="text-[11px] text-white/50 px-2 py-3 text-center">
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-[11px] text-white/40 px-2 py-3 text-center">
            {list.length === 0 ? `No ${kind}s yet` : "No matches"}
          </div>
        )}
        {!loading &&
          filtered.map((it) => (
            <button
              key={it._id}
              onClick={() => share(it)}
              className="w-full flex items-center gap-2 text-left px-2 py-1.5 hover:bg-white/5 border-b border-white/5 last:border-b-0"
            >
              {it.image ? (
                <div
                  className="h-9 w-9 rounded-sm bg-cover bg-center shrink-0"
                  style={{ backgroundImage: `url(${it.image})` }}
                />
              ) : (
                <div className="h-9 w-9 rounded-sm bg-white/5 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-3.5 w-3.5 text-pink-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white truncate">{it.title}</div>
                <div className="text-[9px] text-white/50">
                  {typeof it.price === "number" && it.price > 0
                    ? `${it.currency || "USD"} ${it.price.toLocaleString()}`
                    : "Free"}
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}

// ─── Small shared form primitives ────────────────────────────────────
function ModeButton({
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
      onClick={onClick}
      className={`px-2 py-1 rounded-sm text-[11px] border ${
        active
          ? "border-brand text-brand bg-brand/10"
          : "border-[#2E2E2E] text-white/70 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

// Tiny debounce hook — avoids a dependency for one-line behavior.
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── /meet date + time ──────────────────────────────────────────────
// Chips for the usual picks (today / tomorrow), a calendar for anything
// else, and a list of 15-minute slots instead of the browser's time input
// (which renders as an unreadable "--:-- --" with a black icon on this dark
// dialog). Values stay "YYYY-MM-DD" / "HH:mm" local strings, so MeetForm's
// submit builds the Date exactly as before.

const SLOT_MIN = 15;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function hm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** The first slot boundary strictly after `from`. */
function nextSlot(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + (SLOT_MIN - (d.getMinutes() % SLOT_MIN)));
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function timeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dateLabel(s: string): string {
  return parseYmd(s).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

const ALL_SLOTS: string[] = Array.from({ length: (24 * 60) / SLOT_MIN }, (_, i) =>
  `${pad2(Math.floor((i * SLOT_MIN) / 60))}:${pad2((i * SLOT_MIN) % 60)}`
);

const CHIP = "px-2 py-1 rounded-sm text-[11px] border transition-colors";
const CHIP_ON = "border-brand text-brand bg-brand/10";
const CHIP_OFF = "border-[#2E2E2E] text-white/70 hover:bg-white/5";

function MeetWhenPicker({
  date,
  time,
  onDate,
  onTime,
}: {
  date: string;
  time: string;
  onDate: (d: string) => void;
  onTime: (t: string) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const timeListRef = useRef<HTMLDivElement | null>(null);

  const today = ymd(new Date());
  const tomorrow = ymd(addDays(new Date(), 1));
  const isToday = date === today;
  // Today only offers what's still ahead; any other day offers the whole day.
  const slots = isToday ? ALL_SLOTS.filter((t) => t >= hm(nextSlot())) : ALL_SLOTS;

  // Center the list on the chosen time ONCE when it opens. Scrolls only the
  // list (a per-item scrollIntoView ref re-fired on every render and fought the
  // user's own scrolling).
  useEffect(() => {
    if (!timeOpen) return;
    const list = timeListRef.current;
    const active = list?.querySelector<HTMLElement>("[data-active='true']");
    if (list && active) {
      list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
    }
  }, [timeOpen]);

  const pickDate = (d: string) => {
    onDate(d);
    // Moving to today can leave the chosen time in the past — bump it.
    if (d === ymd(new Date()) && (!time || time < hm(nextSlot()))) onTime(hm(nextSlot()));
  };

  return (
    <>
      <FieldLabel>Date</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => pickDate(today)} className={`${CHIP} ${isToday ? CHIP_ON : CHIP_OFF}`}>
          Today
        </button>
        <button
          type="button"
          onClick={() => pickDate(tomorrow)}
          className={`${CHIP} ${date === tomorrow ? CHIP_ON : CHIP_OFF}`}
        >
          Tomorrow
        </button>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${CHIP} inline-flex items-center gap-1 ${date && !isToday && date !== tomorrow ? CHIP_ON : CHIP_OFF}`}
            >
              <CalendarDays className="h-3 w-3" />
              {date && !isToday && date !== tomorrow ? dateLabel(date) : "Pick a date"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0 bg-[#0e0e12] border-[#2E2E2E]">
            <DayCalendar
              mode="single"
              selected={date ? parseYmd(date) : undefined}
              defaultMonth={date ? parseYmd(date) : undefined}
              disabled={{ before: parseYmd(today) }}
              onSelect={(d: Date | undefined) => {
                if (!d) return;
                pickDate(ymd(d));
                setCalOpen(false);
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <FieldLabel>Time</FieldLabel>
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full h-8 rounded-md bg-black/30 border border-[#2E2E2E] text-xs text-white px-2 flex items-center gap-2 hover:border-[#3a3a45] transition-colors"
          >
            <Clock className="h-3.5 w-3.5 text-white/40" />
            <span className={`flex-1 text-left ${time ? "" : "text-white/40"}`}>
              {time ? timeLabel(time) : "Pick a time"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-white/40" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-1 bg-[#0e0e12] border-[#2E2E2E]"
        >
          <div
            ref={timeListRef}
            className="max-h-56 overflow-y-auto"
            // This Popover is portaled outside the Schedule Meeting dialog, so the
            // dialog's scroll-lock (react-remove-scroll) suppresses wheel scrolling
            // here. Drive the scroll manually — the native scroll is already
            // suppressed by the lock, so this doesn't double-scroll.
            onWheel={(e) => {
              e.currentTarget.scrollTop += e.deltaY;
            }}
          >
            {slots.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-white/50">No times left today — pick another day.</div>
            ) : (
              slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-active={t === time}
                  onClick={() => {
                    onTime(t);
                    setTimeOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-sm text-xs ${
                    t === time ? "bg-brand/15 text-brand" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  {timeLabel(t)}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

/** "Wed, 30 Sep · 6:30 – 7:00 pm" — what's about to be booked. */
function MeetWhenSummary({ date, time, duration }: { date: string; time: string; duration: number }) {
  if (!date || !time) return null;
  const start = new Date(`${date}T${time}`);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + duration * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-white/50">
      <CalendarDays className="h-3 w-3" />
      {dateLabel(date)} · {fmt(start)} – {fmt(end)}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1 mt-1">{children}</div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-white/70 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-brand"
      />
      {label}
    </label>
  );
}

function SubmitRow({
  busy,
  onSubmit,
  label,
  disabled,
}: {
  busy?: boolean;
  onSubmit: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end pt-2">
      <Button
        onClick={onSubmit}
        disabled={busy || disabled}
        className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_83%,white)] text-brand-foreground text-xs h-8"
      >
        {busy ? "Working…" : label}
      </Button>
    </div>
  );
}
