"use client";

// The agenda is a schedule grid, not a list.
//
// A conference runs several tracks at once, so the question an organizer is
// actually asking is "what is happening at 11:00, and where are the holes?" —
// which a flat chronological list can't answer. Columns are tracks, rows are
// time boundaries, and an empty cell is a click target that creates a session
// already pinned to that track and slot.
//
// Rows are the sorted set of every start and end time on the day rather than a
// fixed hourly ruler. That is why a 10:45 coffee break gets its own row: the
// grid follows the schedule instead of forcing the schedule into hour blocks.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Coffee,
  Loader2,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  CustomSelect,
  EmptyState,
  GOLD,
  Label,
  Modal,
  TextArea,
  TextInput,
  Toggle,
  blurOnWheel,
  fromLocalInput,
  useConfirm,
  useConsoleAction,
} from "../ui";
import {
  createSession,
  deleteSession,
  listSessions,
  listSpeakers,
  updateSession,
} from "../api";
import type { AgendaSession, EventProgram, EventSpeaker } from "../types";

/**
 * The editor works in (day, start clock, end clock) rather than two full
 * timestamps. A session always sits inside an event whose dates are already
 * fixed, so the only real questions are which day and which slot — and three
 * narrow selects fit a modal far better than two datetime pickers.
 */
interface Draft {
  title: string;
  description: string;
  stageName: string;
  room: string;
  sessionType: "session" | "break";
  format: "in_person" | "virtual" | "hybrid";
  /** `YYYY-MM-DD`. */
  day: string;
  /** `HH:mm`, 24-hour. */
  startClock: string;
  endClock: string;
  speakerIds: string[];
  isLivestreamed: boolean;
  requiresRegistration: boolean;
  /** Kept as a string so the input can be emptied while typing. */
  seatsAvailable: string;
  isRecorded: boolean;
  enableQa: boolean;
  enablePolls: boolean;
}

const empty: Draft = {
  title: "",
  description: "",
  stageName: "Main Stage",
  room: "",
  sessionType: "session",
  format: "in_person",
  day: "",
  startClock: "10:00",
  endClock: "10:45",
  speakerIds: [],
  isLivestreamed: false,
  requiresRegistration: false,
  seatsAvailable: "0",
  isRecorded: false,
  enableQa: false,
  enablePolls: false,
};

/** Widest window a day can offer when the event itself doesn't narrow it. */
const DAY_MIN_MINUTES = 6 * 60;
const DAY_MAX_MINUTES = 23 * 60 + 45;

/** Grid pitch of the time dropdowns. Event boundaries are added on top. */
const SLOT_MINUTES = 15;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function clockToMinutes(clock: string): number {
  const [h, m] = (clock || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToClock(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function durationMinutes(start: string, end: string): number {
  return clockToMinutes(end) - clockToMinutes(start);
}

/** "45 minutes", "1 hour", "1 hour 30 mins". */
function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m) parts.push(`${m} ${m === 1 ? "min" : "mins"}`);
  return parts.join(" ") || "0 mins";
}

/**
 * Quarter-hour slots across `[min, max]`, with the boundaries themselves added
 * when they don't land on the grid — an event starting at 09:50 must still
 * offer 09:50 as its first session start.
 */
function buildTimeOptions(min: number, max: number) {
  const marks = new Set<number>();
  if (max >= min) {
    marks.add(min);
    marks.add(max);
    const first = Math.ceil(min / SLOT_MINUTES) * SLOT_MINUTES;
    for (let m = first; m <= max; m += SLOT_MINUTES) marks.add(m);
  }
  return Array.from(marks)
    .sort((a, b) => a - b)
    .map((m) => ({ value: minutesToClock(m), label: minutesToClock(m) }));
}

/** Two-letter monogram for the speaker rows. */
function initials(name: string): string {
  return (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

/**
 * Track dot colours, assigned by column order when a track sets none. The
 * attendee event page reads the same list so a track keeps its colour there.
 */
export const TRACK_COLORS = [
  "#FBD10D",
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fb923c",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day, used as the grouping key for day tabs. */
function dayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function tabLabel(key: string): string {
  return dayFromKey(key).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function clockLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Every calendar day the event covers, inclusive of both ends.
 *
 * Deliberately local-time, matching `dayKey` and `fromLocalInput`: the agenda
 * writes session timestamps by parsing `YYYY-MM-DDTHH:mm` as local, so deriving
 * the day list in any other zone would put a session on a tab it can't sit on.
 * `event.timezone` is a display label for the organizer until the whole module
 * moves to zoned arithmetic.
 */
function eventDayKeys(startsAt?: string, endsAt?: string): string[] {
  if (!startsAt || !endsAt) return [];
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // An event ending at exactly midnight runs *up to* that day, not into it.
  if (minutesOfDay(end) === 0 && last > cursor) last.setDate(last.getDate() - 1);

  const keys: string[] = [];
  // 366 is a backstop against a corrupt range spinning forever, not a product
  // rule — no agenda grid is usable at that length anyway.
  while (cursor <= last && keys.length < 366) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export default function AgendaSection({
  eventId,
  eventName,
  event,
}: {
  eventId: string;
  eventName?: string;
  /** Bounds the day tabs and the editor's day/time choices. */
  event?: EventProgram | null;
}) {
  const [sessions, setSessions] = useState<AgendaSession[]>([]);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaSession | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);
  const { confirm, confirmDialog } = useConfirm();

  const [activeDay, setActiveDay] = useState<string | null>(null);
  // Days the organizer has opened up but not yet filled. They only exist
  // client-side: a day becomes real as soon as it has a session on it.
  const [draftDays, setDraftDays] = useState<string[]>([]);
  const [trackFilter, setTrackFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([listSessions(eventId), listSpeakers(eventId)]);
      setSessions(a.sessions || []);
      setSpeakers(s.speakers || []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load the agenda");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Days ───────────────────────────────────────────────────────────────
  /** The event's own calendar days. Empty when the event isn't known yet. */
  const eventDays = useMemo(
    () => eventDayKeys(event?.startsAt, event?.endsAt),
    [event?.startsAt, event?.endsAt]
  );
  const bounded = eventDays.length > 0;

  /**
   * Tabs. Inside a known range that is simply every day of the event, plus any
   * day a session already sits on — a range that was later narrowed would
   * otherwise strand those sessions on a tab nobody can reach.
   */
  const days = useMemo(() => {
    const keys = new Set(eventDays);
    sessions.forEach((s) => keys.add(dayKey(s.startTime)));
    if (!bounded) draftDays.forEach((d) => keys.add(d));
    return Array.from(keys).sort();
  }, [eventDays, bounded, sessions, draftDays]);

  /** Days outside the event range that still hold sessions. */
  const strayDays = useMemo(
    () => (bounded ? days.filter((d) => !eventDays.includes(d)) : []),
    [bounded, days, eventDays]
  );

  useEffect(() => {
    if (days.length === 0) {
      if (activeDay !== null) setActiveDay(null);
      return;
    }
    if (!activeDay || !days.includes(activeDay)) setActiveDay(days[0]);
  }, [days, activeDay]);

  /**
   * Only reachable when the event's dates are unknown — inside a known range
   * every day is already a tab, so there is nothing left to add.
   */
  function addDay() {
    const last = days[days.length - 1];
    const next = last ? dayFromKey(last) : new Date();
    next.setDate(next.getDate() + (last ? 1 : 0));
    const key = dayKey(next);
    if (!days.includes(key)) setDraftDays((prev) => [...prev, key]);
    setActiveDay(key);
  }

  /**
   * The clock window a given day allows. The first and last days are clipped
   * to the event's own start and end times; the days between are open.
   */
  const dayWindow = useCallback(
    (key: string): { min: number; max: number } => {
      if (!bounded || !key) return { min: DAY_MIN_MINUTES, max: DAY_MAX_MINUTES };
      // A session already saved outside the range keeps a full day to move
      // within, so it can be edited back inside rather than being locked.
      if (!eventDays.includes(key)) return { min: 0, max: DAY_MAX_MINUTES };
      const start = new Date(event!.startsAt);
      const end = new Date(event!.endsAt);
      // Keyed off the real boundary days, not the first/last tab: an event
      // ending at midnight drops that empty day from the tabs but must not
      // then clip the previous day to 00:00.
      const min = key === dayKey(start) ? minutesOfDay(start) : 0;
      const max =
        key === dayKey(end)
          ? Math.min(DAY_MAX_MINUTES, minutesOfDay(end))
          : DAY_MAX_MINUTES;
      return { min, max };
    },
    [bounded, eventDays, event]
  );

  // ── Tracks ─────────────────────────────────────────────────────────────
  // Derived from every session, not just today's, so columns don't shuffle as
  // you move between days.
  const tracks = useMemo(() => {
    const order: string[] = [];
    const meta = new Map<string, { room?: string; color?: string }>();
    [...sessions]
      .filter((s) => s.sessionType !== "break")
      .sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
      .forEach((s) => {
        const name = s.stageName || "Main Stage";
        if (!order.includes(name)) order.push(name);
        const prev = meta.get(name) || {};
        meta.set(name, {
          room: prev.room || s.room,
          color: prev.color || s.trackColor,
        });
      });
    if (order.length === 0) order.push("Main Stage");
    return order.map((name, i) => ({
      name,
      room: meta.get(name)?.room,
      color: meta.get(name)?.color || TRACK_COLORS[i % TRACK_COLORS.length],
    }));
  }, [sessions]);

  const rooms = useMemo(
    () => Array.from(new Set(tracks.map((t) => t.room).filter(Boolean))) as string[],
    [tracks]
  );

  const visibleTracks = useMemo(
    () =>
      tracks.filter(
        (t) =>
          (!trackFilter || t.name === trackFilter) &&
          (!roomFilter || t.room === roomFilter)
      ),
    [tracks, trackFilter, roomFilter]
  );

  const daySessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          dayKey(s.startTime) === activeDay &&
          (s.sessionType === "break" ||
            visibleTracks.some((t) => t.name === (s.stageName || "Main Stage")))
      ),
    [sessions, activeDay, visibleTracks]
  );

  // ── Rows ───────────────────────────────────────────────────────────────
  // Every distinct start and end on the day, plus a leading hour of headroom
  // so the first session isn't flush against the header.
  const boundaries = useMemo(() => {
    if (!activeDay) return [];
    const marks = new Set<number>();
    daySessions.forEach((s) => {
      marks.add(new Date(s.startTime).getTime());
      marks.add(new Date(s.endTime).getTime());
    });
    if (marks.size === 0) {
      // An empty day still needs a grid to click into, spanning the hours the
      // day actually allows so every "+" opens a slot the event can hold.
      const base = dayFromKey(activeDay);
      const { min, max } = dayWindow(activeDay);
      const from = Math.floor(min / 60);
      const to = Math.ceil(max / 60);
      for (let h = from; h <= to; h++) {
        marks.add(
          new Date(base.getFullYear(), base.getMonth(), base.getDate(), h).getTime()
        );
      }
    } else {
      const first = Math.min(...marks);
      marks.add(first - 60 * 60 * 1000);
    }
    return Array.from(marks).sort((a, b) => a - b);
  }, [daySessions, activeDay, dayWindow]);

  /** Row index of a timestamp, or -1 when it falls outside the day's grid. */
  const rowOf = useCallback(
    (t: number) => boundaries.findIndex((b) => b === t),
    [boundaries]
  );

  const rowCount = Math.max(0, boundaries.length - 1);

  // Which (row, track) cells are already taken, so the rest can offer a "+".
  const occupied = useMemo(() => {
    const set = new Set<string>();
    daySessions.forEach((s) => {
      const from = rowOf(new Date(s.startTime).getTime());
      const to = rowOf(new Date(s.endTime).getTime());
      if (from < 0 || to < 0) return;
      for (let r = from; r < to; r++) {
        if (s.sessionType === "break") {
          visibleTracks.forEach((t) => set.add(`${r}|${t.name}`));
        } else {
          set.add(`${r}|${s.stageName || "Main Stage"}`);
        }
      }
    });
    return set;
  }, [daySessions, rowOf, visibleTracks]);

  const speakerById = useMemo(
    () => new Map(speakers.map((s) => [s._id, s])),
    [speakers]
  );

  // ── Form ───────────────────────────────────────────────────────────────
  /**
   * "Day 1 · 12 Oct"… for the editor's day select.
   *
   * Inside a known event range this is exactly the event's days — there is no
   * provisional "next day" any more, because scheduling a session past the
   * event's end is the bug this list exists to prevent. Days outside the range
   * only appear while editing a session that already sits on one.
   */
  const dayOptions = useMemo(() => {
    const keys = bounded ? [...eventDays] : [...days];
    if (!bounded) {
      const last = keys[keys.length - 1];
      const next = last ? dayFromKey(last) : new Date();
      if (last) next.setDate(next.getDate() + 1);
      const nextKey = dayKey(next);
      if (!keys.includes(nextKey)) keys.push(nextKey);
    }
    const options = keys.map((k, i) => ({
      value: k,
      label: `Day ${i + 1} · ${tabLabel(k)}`,
    }));
    if (bounded && draft.day && !keys.includes(draft.day)) {
      options.push({
        value: draft.day,
        label: `${tabLabel(draft.day)} · outside the event`,
      });
    }
    return options;
  }, [bounded, eventDays, days, draft.day]);

  /**
   * Pulls a (day, start, end) triple inside that day's allowed window,
   * preserving the length the organizer picked where it still fits.
   */
  const clampSlot = useCallback(
    (day: string, startClock: string, endClock: string) => {
      const { min, max } = dayWindow(day);
      const length = Math.max(
        SLOT_MINUTES,
        durationMinutes(startClock, endClock) || 45
      );
      // Never less than one slot of room for the session itself.
      let start = Math.min(Math.max(clockToMinutes(startClock), min), Math.max(min, max - SLOT_MINUTES));
      let end = Math.min(Math.max(clockToMinutes(endClock), start + SLOT_MINUTES), max);
      if (end <= start) end = Math.min(max, start + length);
      if (end <= start) start = Math.max(min, end - length);
      return { startClock: minutesToClock(start), endClock: minutesToClock(end) };
    },
    [dayWindow]
  );

  function openCreate(prefill?: Partial<Draft>) {
    const base = { ...empty, ...prefill };
    const day =
      base.day ||
      (activeDay && dayOptions.some((o) => o.value === activeDay)
        ? activeDay
        : dayOptions[0]?.value || dayKey(new Date()));
    setDraft({
      ...base,
      stageName: prefill?.stageName || tracks[0]?.name || "Main Stage",
      day,
      ...clampSlot(day, base.startClock, base.endClock),
    });
    setEditing(null);
    setOpen(true);
  }

  // "Add session" lives in the bottom bar, not on the page.
  useConsoleAction("agenda:add", () => openCreate());

  /** Click on an empty cell — the slot is already known, so pre-fill it. */
  function openSlot(trackName: string, rowIndex: number) {
    const start = new Date(boundaries[rowIndex]);
    const end = new Date(boundaries[rowIndex + 1]);
    const track = tracks.find((t) => t.name === trackName);
    openCreate({
      stageName: trackName,
      room: track?.room || "",
      day: dayKey(start),
      startClock: clockLabel(start),
      endClock: clockLabel(end),
    });
  }

  function openEdit(s: AgendaSession) {
    const start = new Date(s.startTime);
    setDraft({
      title: s.title,
      description: s.description || "",
      stageName: s.stageName,
      room: s.room || "",
      sessionType: s.sessionType || "session",
      format: s.format || "in_person",
      day: dayKey(start),
      startClock: clockLabel(start),
      endClock: clockLabel(s.endTime),
      speakerIds: s.speakerIds || [],
      isLivestreamed: !!s.isLivestreamed,
      requiresRegistration: !!s.requiresRegistration,
      seatsAvailable: String(s.seatsAvailable ?? 0),
      isRecorded: !!s.isRecorded,
      enableQa: !!s.enableQa,
      enablePolls: !!s.enablePolls,
    });
    setEditing(s);
    setOpen(true);
  }

  async function save() {
    if (!draft.day) {
      toast.error("Pick a day");
      return;
    }
    if (durationMinutes(draft.startClock, draft.endClock) <= 0) {
      toast.error("The session must end after it starts");
      return;
    }
    // Mirrors the server's own check, so the organizer sees it before the
    // round trip rather than as a 400.
    if (bounded) {
      const start = new Date(`${draft.day}T${draft.startClock}`);
      const end = new Date(`${draft.day}T${draft.endClock}`);
      if (start < new Date(event!.startsAt) || end > new Date(event!.endsAt)) {
        toast.error("Session time must fall within the event date range");
        return;
      }
    }
    setSaving(true);
    const seats = Math.max(0, parseInt(draft.seatsAvailable || "0", 10) || 0);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      stageName: draft.stageName.trim() || "Main Stage",
      room: draft.room.trim() || undefined,
      sessionType: draft.sessionType,
      format: draft.format,
      // The badge on the grid is the same fact as "requires separate
      // registration", so the organizer answers it once.
      isLimitedSeats: draft.requiresRegistration,
      requiresRegistration: draft.requiresRegistration,
      seatsAvailable: draft.requiresRegistration ? seats : 0,
      isRecorded: draft.isRecorded,
      enableQa: draft.enableQa,
      enablePolls: draft.enablePolls,
      startTime: fromLocalInput(`${draft.day}T${draft.startClock}`),
      endTime: fromLocalInput(`${draft.day}T${draft.endClock}`),
      speakerIds: draft.speakerIds,
      isLivestreamed: draft.isLivestreamed,
    };
    try {
      if (editing) await updateSession(eventId, editing._id, payload);
      else await createSession(eventId, payload);
      toast.success(editing ? "Session updated" : "Session added");
      setOpen(false);
      // The day now exists for real, so drop it from the provisional list.
      setDraftDays((prev) => prev.filter((d) => d !== draft.day));
      setActiveDay(draft.day);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not save the session");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: AgendaSession) {
    const ok = await confirm({
      title: `Delete "${s.title}"?`,
      message: "The session is removed from the agenda and the public schedule.",
    });
    if (!ok) return;
    try {
      await deleteSession(eventId, s._id);
      toast.success("Session deleted");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not delete the session");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center px-8 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
      </div>
    );
  }

  if (sessions.length === 0 && draftDays.length === 0) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          icon={<CalendarClock className="h-10 w-10" strokeWidth={1.25} />}
          title="Nothing scheduled"
          description="Add your first session — talks, breaks, workshops, whatever you run. Tracks and days appear as you fill them in."
          action={
            <Button onClick={() => openCreate()}>
              <Plus className="h-4 w-4" />
              Add session
            </Button>
          }
        />
        {sessionModal()}
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="overflow-hidden rounded-xl border border-[#26262f] bg-[#0e0e12]">
        {eventName && (
          <header className="border-b border-[#1c1c24] px-5 py-3.5">
            <h2 className="text-sm font-medium text-white">{eventName}</h2>
          </header>
        )}

        {/* Day tabs + filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1c1c24] px-5 py-3">
          {days.map((d, i) => {
            const active = d === activeDay;
            const stray = strayDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                title={
                  stray
                    ? "This day is outside the event's dates — move or delete what's on it."
                    : undefined
                }
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent text-[#141418]"
                    : stray
                      ? "border-[#4a2020] text-[#f87171] hover:border-[#f87171]"
                      : "border-[#2a2a35] text-[#9fa0b8] hover:border-[#3a3a48] hover:text-white",
                ].join(" ")}
                style={active ? { background: stray ? "#f87171" : GOLD } : undefined}
              >
                {stray ? tabLabel(d) : `Day ${i + 1} · ${tabLabel(d)}`}
              </button>
            );
          })}
          {/* Inside a known event range every day is already a tab, so there
              is nothing to add — and adding one would schedule past the end. */}
          {!bounded && (
            <button
              type="button"
              onClick={addDay}
              className="rounded-lg px-2.5 py-1.5 text-xs text-[#7c7d94] transition-colors hover:text-white"
            >
              + Add day
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <CustomSelect
              aria-label="Filter by track"
              value={trackFilter}
              onChange={setTrackFilter}
              placeholder="All tracks"
              options={[
                { value: "", label: "All tracks" },
                ...tracks.map((t) => ({
                  value: t.name,
                  label: t.name,
                  color: t.color,
                })),
              ]}
              className="w-36"
              size="sm"
            />
            <CustomSelect
              aria-label="Filter by room"
              value={roomFilter}
              onChange={setRoomFilter}
              disabled={rooms.length === 0}
              placeholder="All rooms"
              options={[
                { value: "", label: "All rooms" },
                ...rooms.map((r) => ({ value: r, label: r })),
              ]}
              className="w-36"
              size="sm"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto p-5">
          <div
            className="grid min-w-[720px] overflow-hidden rounded-lg border border-[#22222b]"
            style={{
              gridTemplateColumns: `56px repeat(${visibleTracks.length}, minmax(160px, 1fr))`,
              gridTemplateRows: `auto repeat(${rowCount}, minmax(64px, auto))`,
            }}
          >
            {/* Header row */}
            <div className="border-b border-[#22222b] bg-[#111116]" />
            {visibleTracks.map((t, i) => (
              <div
                key={t.name}
                className="border-b border-l border-[#22222b] bg-[#111116] px-3 py-2.5"
                style={{ gridColumn: i + 2, gridRow: 1 }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: t.color }}
                  />
                  <span className="truncate text-xs font-medium text-white">
                    {t.name}
                  </span>
                </div>
                {t.room && (
                  <div className="mt-0.5 truncate pl-3.5 text-[11px] text-[#61627a]">
                    {t.room}
                  </div>
                )}
              </div>
            ))}

            {/* Time gutter */}
            {Array.from({ length: rowCount }, (_, r) => (
              <div
                key={`t${r}`}
                className="border-b border-[#1c1c24] px-2 pt-2 text-right text-[10px] tabular-nums text-[#4f5065]"
                style={{ gridColumn: 1, gridRow: r + 2 }}
              >
                {clockLabel(new Date(boundaries[r]))}
              </div>
            ))}

            {/* Empty cells — each one creates a session in that exact slot. */}
            {Array.from({ length: rowCount }, (_, r) =>
              visibleTracks.map((t, ti) =>
                occupied.has(`${r}|${t.name}`) ? null : (
                  <button
                    key={`c${r}-${t.name}`}
                    type="button"
                    onClick={() => openSlot(t.name, r)}
                    title={`Add a session at ${clockLabel(new Date(boundaries[r]))} on ${t.name}`}
                    className="group flex items-center justify-center border-b border-l border-[#1c1c24] text-[#2a2a35] transition-colors hover:bg-white/[0.02]"
                    style={{ gridColumn: ti + 2, gridRow: r + 2 }}
                  >
                    <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )
              )
            )}

            {/* Sessions */}
            {daySessions.map((s) => {
              const from = rowOf(new Date(s.startTime).getTime());
              const to = rowOf(new Date(s.endTime).getTime());
              if (from < 0 || to < 0 || to <= from) return null;

              // A break is not owned by a track — it spans the whole width.
              if (s.sessionType === "break") {
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => openEdit(s)}
                    className="flex items-center justify-center gap-2 border-b border-l border-[#1c1c24] bg-[#131318] px-3 text-xs text-[#9fa0b8] transition-colors hover:bg-[#17171d] hover:text-white"
                    style={{ gridColumn: `2 / -1`, gridRow: `${from + 2} / ${to + 2}` }}
                  >
                    <Coffee className="h-3.5 w-3.5" />
                    {s.title}
                    {s.room ? ` · ${s.room}` : ""}
                  </button>
                );
              }

              const track = tracks.find(
                (t) => t.name === (s.stageName || "Main Stage")
              );
              const names = (s.speakerIds || [])
                .map((id) => speakerById.get(id)?.name)
                .filter(Boolean)
                .join(", ");
              const colIndex = visibleTracks.findIndex(
                (t) => t.name === (s.stageName || "Main Stage")
              );
              if (colIndex < 0) return null;

              return (
                <div
                  key={s._id}
                  className="group relative m-1 overflow-hidden rounded-md bg-[#17171d] transition-colors hover:bg-[#1c1c23]"
                  style={{
                    gridColumn: colIndex + 2,
                    gridRow: `${from + 2} / ${to + 2}`,
                    borderLeft: `3px solid ${s.trackColor || track?.color || GOLD}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="block h-full w-full px-3 py-2.5 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] tabular-nums text-[#61627a]">
                        {clockLabel(s.startTime)} – {clockLabel(s.endTime)}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {s.isLivestreamed && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#f87171]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#f87171]">
                            <Radio className="h-2.5 w-2.5" />
                            Live
                          </span>
                        )}
                        {s.isLimitedSeats && (
                          <span className="rounded bg-[#a78bfa]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a78bfa]">
                            Limited seats
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-[13px] font-medium leading-snug text-white">
                      {s.title}
                    </div>
                    {names && (
                      <div className="mt-1 truncate text-[11px] text-[#7c7d94]">
                        {names}
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(s)}
                    title="Delete session"
                    className="absolute bottom-1.5 right-1.5 rounded p-1 text-[#4f5065] opacity-0 transition-all hover:bg-[#f87171]/10 hover:text-[#f87171] group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {sessionModal()}
      {confirmDialog}
    </div>
  );

  // Declared as a closure so both the empty state and the grid render the same
  // form without duplicating it.
  function sessionModal() {
    const isBreak = draft.sessionType === "break";
    const minutes = durationMinutes(draft.startClock, draft.endClock);

    // The window this day allows, and the two lists that follow from it. End
    // is strictly after start, so a session can never be zero-length or
    // inverted — the option simply isn't there to pick.
    const { min: dayMin, max: dayMax } = dayWindow(draft.day);
    // A session saved off the quarter-hour grid, or before the event was
    // re-dated, holds a clock the window no longer offers. Keep it in the
    // list, or the field reads as empty and the organizer loses sight of what
    // they are changing.
    const withCurrent = (
      options: Array<{ value: string; label: string }>,
      current: string
    ) =>
      options.some((o) => o.value === current)
        ? options
        : [{ value: current, label: `${current} · current` }, ...options];

    const startOptions = withCurrent(
      buildTimeOptions(dayMin, Math.max(dayMin, dayMax - SLOT_MINUTES)),
      draft.startClock
    );
    const endOptions = withCurrent(
      buildTimeOptions(
        Math.min(clockToMinutes(draft.startClock) + SLOT_MINUTES, dayMax),
        dayMax
      ),
      draft.endClock
    );

    /** Day change: keep the length, slide the slot into the new day's window. */
    const setDay = (day: string) =>
      setDraft({ ...draft, day, ...clampSlot(day, draft.startClock, draft.endClock) });

    /**
     * Start change: hold the length the organizer already chose, falling back
     * to 45 minutes, and push the end out of the way when it no longer fits.
     */
    const setStart = (startClock: string) => {
      const keep = minutes > 0 ? minutes : 45;
      const start = clockToMinutes(startClock);
      const end = Math.min(dayMax, Math.max(start + SLOT_MINUTES, start + keep));
      setDraft({ ...draft, startClock, endClock: minutesToClock(end) });
    };

    const assigned = draft.speakerIds
      .map((id) => speakerById.get(id))
      .filter(Boolean) as EventSpeaker[];
    const unassigned = speakers.filter((s) => !draft.speakerIds.includes(s._id));

    return (
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit session" : "New session"}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            {/* Delete lives with the form it belongs to, not on the card —
                you decide to drop a session while looking at its details. */}
            {editing ? (
              <button
                type="button"
                onClick={async () => {
                  const target = editing;
                  setOpen(false);
                  await remove(target);
                }}
                className="text-sm font-medium text-[#f87171] transition-colors hover:text-[#ef5555]"
              >
                Delete session
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={saving}
                disabled={!draft.title.trim()}
                onClick={save}
              >
                {editing ? "Save changes" : "Add session"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <CustomSelect
            label="Type"
            value={draft.sessionType}
            onChange={(v) =>
              setDraft({ ...draft, sessionType: v as "session" | "break" })
            }
            hint={isBreak ? "Spans every track" : undefined}
            options={[
              { value: "session", label: "Session" },
              { value: "break", label: "Break — coffee, lunch, registration" },
            ]}
          />

          <TextInput
            label={isBreak ? "Break name" : "Session title"}
            required
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={
              isBreak
                ? "Networking Coffee Break"
                : "Turning your network into revenue"
            }
          />

          {!isBreak && (
            <TextArea
              label="Description"
              rows={4}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What attendees will walk away with."
            />
          )}

          {/* Day + times. Three narrow selects beat two datetime pickers here:
              a session always sits inside the event, so the only real choices
              are which day and which slot. */}
          <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-3">
            <CustomSelect
              label="Day"
              value={draft.day}
              onChange={setDay}
              placeholder="Pick a day"
              options={dayOptions}
              // A one-day event has exactly one answer here.
              disabled={dayOptions.length <= 1}
            />
            <CustomSelect
              label="Start"
              value={draft.startClock}
              onChange={setStart}
              options={startOptions}
            />
            <CustomSelect
              label="End"
              value={draft.endClock}
              onChange={(v) => setDraft({ ...draft, endClock: v })}
              options={endOptions}
            />
          </div>
          <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium" style={{ color: GOLD }}>
              {minutes > 0 ? formatDuration(minutes) : "End must be after start"}
            </span>
            {bounded && (
              <span className="text-zinc-500">
                · this day runs {minutesToClock(dayMin)}–{minutesToClock(dayMax)}
              </span>
            )}
          </div>

          {!isBreak && (
            <>
              <ComboSelect
                label="Track"
                value={draft.stageName}
                onChange={(v) => setDraft({ ...draft, stageName: v })}
                options={tracks.map((t) => ({ value: t.name, color: t.color }))}
                placeholder="Main Stage"
                newLabel="New track…"
              />
              <ComboSelect
                label="Room / stage"
                value={draft.room}
                onChange={(v) => setDraft({ ...draft, room: v })}
                options={rooms.map((r) => ({ value: r }))}
                placeholder="Hall A"
                newLabel="New room…"
              />
              <CustomSelect
                label="Format"
                value={draft.format}
                onChange={(v) =>
                  setDraft({ ...draft, format: v as Draft["format"] })
                }
                options={[
                  { value: "in_person", label: "In person" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "virtual", label: "Virtual" },
                ]}
              />

              {/* Speakers as assigned rows, so who is on stage reads at a
                  glance instead of as a wall of toggled chips. */}
              <div>
                <Label>Speakers</Label>
                {speakers.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    Add speakers first to assign them here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assigned.map((sp) => (
                      <div
                        key={sp._id}
                        className="flex items-center gap-2.5 rounded-xl border border-[#262626] bg-[#1A1A1A] px-3 py-2.5"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: `${GOLD}26`, color: GOLD }}
                        >
                          {initials(sp.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                          {sp.name}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${sp.name}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              speakerIds: draft.speakerIds.filter(
                                (id) => id !== sp._id
                              ),
                            })
                          }
                          className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}

                    {unassigned.length > 0 && (
                      <CustomSelect
                        aria-label="Assign speaker"
                        value=""
                        placeholder="+ Assign speaker"
                        onChange={(v) => {
                          if (!v) return;
                          setDraft({
                            ...draft,
                            speakerIds: [...draft.speakerIds, v],
                          });
                        }}
                        options={unassigned.map((sp) => ({
                          value: sp._id,
                          label: sp.name,
                          description: sp.role || sp.company,
                        }))}
                        triggerClassName="border-dashed bg-transparent justify-center text-center"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-[#262626] pt-4">
                <div
                  className="mb-3 text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: GOLD }}
                >
                  Session settings
                </div>
                <div className="space-y-1">
                  <Toggle
                    checked={draft.requiresRegistration}
                    onChange={(v) =>
                      setDraft({ ...draft, requiresRegistration: v })
                    }
                    label="Requires separate registration"
                    description="Attendees claim a seat for this session on top of their ticket."
                  />
                  {draft.requiresRegistration && (
                    <div className="flex items-center gap-3 pl-1 pt-1">
                      <span className="text-xs text-zinc-400">Seats available</span>
                      <input
                        type="number"
                        min={0}
                        value={draft.seatsAvailable}
                        onWheel={blurOnWheel}
                        onChange={(e) =>
                          setDraft({ ...draft, seatsAvailable: e.target.value })
                        }
                        className="w-24 rounded-lg border border-[#262626] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white outline-none focus:border-brand"
                      />
                      <span className="text-[11px] text-zinc-600">
                        0 = uncapped
                      </span>
                    </div>
                  )}
                  <Toggle
                    checked={draft.isRecorded}
                    onChange={(v) => setDraft({ ...draft, isRecorded: v })}
                    label="Record this session"
                  />
                  <Toggle
                    checked={draft.enableQa}
                    onChange={(v) => setDraft({ ...draft, enableQa: v })}
                    label="Enable Q&A"
                  />
                  <Toggle
                    checked={draft.enablePolls}
                    onChange={(v) => setDraft({ ...draft, enablePolls: v })}
                    label="Enable polls"
                  />
                  <Toggle
                    checked={draft.isLivestreamed}
                    onChange={(v) => setDraft({ ...draft, isLivestreamed: v })}
                    label="Livestreamed"
                    description="Shows a LIVE badge on the grid and to online attendees."
                  />
                </div>
              </div>
            </>
          )}

          {isBreak && (
            <TextInput
              label="Location"
              value={draft.room}
              onChange={(e) => setDraft({ ...draft, room: e.target.value })}
              placeholder="Exhibition Hall"
            />
          )}
        </div>
      </Modal>
    );
  }
}

/**
 * A select over known values that can also accept a new one.
 *
 * Tracks and rooms are free text in the data — the first session to name
 * "Hall A" creates it. Picking from what already exists is the common case,
 * so that is the default interaction, with a "New…" escape hatch.
 */
function ComboSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  newLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; color?: string }>;
  placeholder?: string;
  newLabel: string;
}) {
  const known = options.some((o) => o.value === value);
  const [typing, setTyping] = useState(!known && !!value);

  if (typing || options.length === 0) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="flex gap-2">
          <input
            autoFocus={typing}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand"
          />
          {options.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTyping(false);
                onChange(options[0].value);
              }}
              className="shrink-0 rounded-xl border border-[#262626] px-3 text-xs text-zinc-400 transition-colors hover:text-white"
            >
              Pick
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <CustomSelect
      label={label}
      value={value}
      placeholder={placeholder}
      onChange={(v) => {
        if (v === "__new__") {
          onChange("");
          setTyping(true);
          return;
        }
        onChange(v);
      }}
      options={[
        ...options.map((o) => ({ value: o.value, label: o.value, color: o.color })),
        { value: "__new__", label: newLabel },
      ]}
    />
  );
}
