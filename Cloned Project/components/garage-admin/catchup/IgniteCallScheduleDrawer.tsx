"use client";

// Schedule an Ignite call — the NetworkChains catch-up drawer, ported.
//
// This is deliberately the SAME UI as `schedule-catch-up-drawer.tsx` in the
// NetworkChains web app: same right-side shell, same rounded Card of icon rows,
// same push-screen navigation for timezone / date / start / end, same #FFC200
// accent and confirm button. Operators move between the two products, so the
// scheduling surface should not feel like a different app.
//
// Two things differ, both because of who is scheduling:
//   1. The host is the affiliate's ASSIGNED support agent, shown read-only —
//      not the logged-in user. There is no picker (see ignite-call.tsx).
//   2. It posts through the Garage admin API rather than straight to
//      NetworkChains, so the call is created on the agent's NC account and
//      linked to the affiliate in one step.
// The Google Calendar row is omitted: choosing a calendar needs the agent's own
// Google account, which the admin panel has no access to. The mirror still
// happens server-side on their primary calendar.

import { useEffect, useMemo, useState } from "react";
import {
  format,
  parse,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns";
import { X, ChevronLeft, ChevronRight, Check, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  TIMEZONES,
  canonicalTz,
  durationMinutesBetween,
  zonedWallClockToUtc,
} from "./timezones";
import {
  TitleIcon,
  TimezoneIcon,
  DateIcon,
  StartTimeIcon,
  EndTimeIcon,
  DescriptionIcon,
  ParticipantsIcon,
} from "./row-icons";
import {
  attachIgniteCall,
  listAdminCatchups,
  type AdminCatchup,
  type IgniteCallSummary,
} from "@/lib/admin-api/ignite-call";
import type { IgniteCallRow } from "@/components/garage-admin/ignite-call";

type Screen = "main" | "existing" | "timezone" | "date" | "start" | "end";

// 96 quarter-hour slots (00:00 … 23:45) — same grid as NetworkChains.
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function time12(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function dateLabel(ymd: string): string {
  if (!ymd) return "";
  return format(parse(ymd, "yyyy-MM-dd", new Date()), "EEE, d MMM yyyy");
}

function tzParts(tz: string) {
  try {
    const now = new Date();
    const long =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value ?? tz;
    const rawOff =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const rest = rawOff.replace(/^GMT/, "");
    const offset = rest ? `GMT ${rest.slice(0, 1)} ${rest.slice(1)}` : "GMT";
    const abbr = long.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
    return { long, offset, abbr };
  } catch {
    return { long: tz, offset: "", abbr: tz.slice(0, 3).toUpperCase() };
  }
}

export function IgniteCallScheduleDrawer({
  subject,
  onClose,
  onSaved,
}: {
  subject: IgniteCallRow | null;
  onClose: () => void;
  onSaved: (userId: string, call: IgniteCallSummary) => void;
}) {
  const shown = !!subject;
  const assigned = subject?.assignedTo ?? null;
  const adminId = assigned?.id ?? "";

  const [screen, setScreen] = useState<Screen>("main");
  const [title, setTitle] = useState("Ignite call");
  const [timeZone, setTimeZone] = useState(canonicalTz(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [catchups, setCatchups] = useState<AdminCatchup[] | null>(null);
  const [hostMissing, setHostMissing] = useState(false);
  const [loadingCatchups, setLoadingCatchups] = useState(false);

  // Reset every time the drawer opens on a different affiliate, so one
  // operator session never carries another affiliate's half-filled form.
  useEffect(() => {
    if (!shown) return;
    setScreen("main");
    setTitle("Ignite call");
    setTimeZone(canonicalTz(Intl.DateTimeFormat().resolvedOptions().timeZone));
    setDate("");
    setStartTime("");
    setEndTime("");
    setDescription("");
    setCatchups(null);
    setHostMissing(false);
  }, [shown, subject?.userId]);

  useEffect(() => {
    if (!shown || !adminId) return;
    let cancelled = false;
    setLoadingCatchups(true);
    listAdminCatchups(adminId)
      .then((d) => {
        if (cancelled) return;
        setHostMissing(d.host === null);
        setCatchups(d.schedules);
      })
      .catch((e: unknown) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not load catch-ups");
      })
      .finally(() => {
        if (!cancelled) setLoadingCatchups(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shown, adminId]);

  const tz = useMemo(() => tzParts(timeZone), [timeZone]);
  const canSubmit = !!title.trim() && !!date && !!startTime && !!endTime && !saving;

  async function attach(body: Parameters<typeof attachIgniteCall>[1]) {
    if (!subject?.userId) return;
    setSaving(true);
    try {
      const call = await attachIgniteCall(subject.userId, body);
      onSaved(subject.userId, call);
      toast.success("Ignite call scheduled");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not schedule the Ignite call");
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    if (!canSubmit) {
      toast.error("Title, date and time are required.");
      return;
    }
    // The picked date/time is a wall clock IN the picked timezone, so it has
    // to be converted from that zone — not the browser's. `new Date(
    // "…T17:00")` would read 5pm in whatever zone the operator's laptop is
    // set to, which silently schedules the call at the wrong instant whenever
    // that differs from the host's zone.
    void attach({
      adminId,
      createSchedule: {
        title: title.trim(),
        scheduledAt: zonedWallClockToUtc(date, startTime, timeZone).toISOString(),
        durationMinutes: durationMinutesBetween(startTime, endTime) || 60,
        timeZone,
        description: description.trim() || undefined,
      },
    });
  }

  const headerTitle =
    screen === "main"
      ? "Schedule Ignite Call"
      : screen === "existing"
        ? "Existing Catch-Ups"
        : screen === "timezone"
          ? "Timezone"
          : screen === "date"
            ? "Date"
            : screen === "start"
              ? "Start Time"
              : "End Time";

  if (typeof document === "undefined") return null;

  return (
    <AnimatePresence>
      {shown && (
        <motion.div key="ignite-schedule-drawer" className="fixed inset-0 z-[130]" initial={false}>
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute right-0 top-0 z-[140] flex h-full w-full max-w-[440px] flex-col border-l border-white/[0.06] bg-[#0e0e0e] shadow-[-24px_0_80px_-24px_rgba(0,0,0,0.85)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 42 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 pt-6 pb-3">
              <button
                onClick={screen === "main" ? onClose : () => setScreen("main")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.1] text-white/70 transition-colors hover:text-white"
              >
                {screen === "main" ? <X className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              <h2 className="text-[17px] font-semibold text-white">{headerTitle}</h2>
              {screen === "main" ? (
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  title="Schedule"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFC200] text-black transition-opacity disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
              ) : (
                <span className="h-10 w-10" />
              )}
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={screen}
                  initial={{ opacity: 0, x: screen === "main" ? -12 : 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {screen === "main" && (
                    <>
                      <p className="px-1 pb-2 text-[12px] text-zinc-500">
                        For{" "}
                        <span className="text-zinc-300">
                          {subject?.user?.name || subject?.user?.email || "this affiliate"}
                        </span>
                      </p>

                      <Card>
                        <StaticRow
                          icon={<ParticipantsIcon />}
                          label="Conducted by"
                          value={assigned?.name || assigned?.email || "—"}
                          hint="Assigned agent"
                        />
                        <InputRow
                          icon={<TitleIcon />}
                          label="Title"
                          required
                          value={title}
                          onChange={setTitle}
                          placeholder="Enter Title"
                        />
                        <NavRow
                          icon={<TimezoneIcon />}
                          label="Timezone"
                          required
                          value={`${tz.long} (${tz.abbr})`}
                          onClick={() => setScreen("timezone")}
                        />
                        <NavRow
                          icon={<DateIcon />}
                          label="Date"
                          required
                          value={dateLabel(date)}
                          onClick={() => setScreen("date")}
                        />
                        <NavRow
                          icon={<StartTimeIcon />}
                          label="Start Time"
                          required
                          value={time12(startTime)}
                          onClick={() => setScreen("start")}
                        />
                        <NavRow
                          icon={<EndTimeIcon />}
                          label="End Time"
                          required
                          value={time12(endTime)}
                          onClick={() => setScreen("end")}
                        />
                        <InputRow
                          icon={<DescriptionIcon />}
                          label="Description"
                          value={description}
                          onChange={setDescription}
                          placeholder="Add a description"
                          last
                        />
                      </Card>

                      <p className="px-1 pt-3 pb-2 text-[12px] text-zinc-500">
                        The affiliate is invited automatically.
                      </p>

                      <button
                        onClick={() => setScreen("existing")}
                        className="mt-1 flex w-full items-center gap-3.5 rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400">
                          <CalendarDays className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <Label>Use an existing catch-up</Label>
                          <span className="mt-0.5 block truncate text-[15px] text-zinc-500">
                            {loadingCatchups
                              ? "Loading…"
                              : hostMissing
                                ? "No NetworkChains account"
                                : `${catchups?.length ?? 0} upcoming`}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                      </button>
                    </>
                  )}

                  {screen === "existing" && (
                    <ExistingView
                      loading={loadingCatchups}
                      hostMissing={hostMissing}
                      hostName={assigned?.name || assigned?.email || "This agent"}
                      catchups={catchups ?? []}
                      saving={saving}
                      onPick={(scheduleId) => void attach({ adminId, ncScheduleId: scheduleId })}
                    />
                  )}

                  {screen === "timezone" && (
                    <TimezoneView
                      value={timeZone}
                      onPick={(t) => {
                        setTimeZone(t);
                        setScreen("main");
                      }}
                    />
                  )}
                  {screen === "date" && (
                    <DateView
                      value={date}
                      onPick={(d) => {
                        setDate(d);
                        setScreen("main");
                      }}
                    />
                  )}
                  {screen === "start" && (
                    <TimeView
                      value={startTime}
                      onPick={(t) => {
                        setStartTime(t);
                        // Default to a one-hour call, exactly like NetworkChains.
                        if (!endTime) {
                          const i = TIME_SLOTS.indexOf(t);
                          if (i >= 0 && i + 4 < TIME_SLOTS.length) setEndTime(TIME_SLOTS[i + 4]);
                        }
                        setScreen("main");
                      }}
                    />
                  )}
                  {screen === "end" && (
                    <TimeView
                      value={endTime}
                      durationFrom={startTime}
                      onPick={(t) => {
                        setEndTime(t);
                        setScreen("main");
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Shared row primitives (same as the NetworkChains drawer) ─────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.02]">
      {children}
    </div>
  );
}

function RowShell({
  icon,
  last,
  children,
}: {
  icon: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3.5 px-4 py-3.5", !last && "border-b border-white/[0.06]")}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400 [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
      </span>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="block text-[11px] font-medium text-zinc-400">
      {children}
      {required && <span className="text-red-400"> *</span>}
    </span>
  );
}

function NavRow({
  icon,
  label,
  value,
  required,
  onClick,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  required?: boolean;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button onClick={onClick} className="block w-full text-left transition-colors hover:bg-white/[0.02]">
      <RowShell icon={icon} last={last}>
        <span className="min-w-0 flex-1">
          <Label required={required}>{label}</Label>
          <span className={cn("mt-0.5 block truncate text-[15px]", value ? "text-white" : "text-zinc-500")}>
            {value || "—"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
      </RowShell>
    </button>
  );
}

function InputRow({
  icon,
  label,
  value,
  onChange,
  placeholder,
  required,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  last?: boolean;
}) {
  return (
    <RowShell icon={icon} last={last}>
      <span className="min-w-0 flex-1">
        <Label required={required}>{label}</Label>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-0.5 w-full bg-transparent text-[15px] text-white placeholder:text-zinc-500 outline-none"
        />
      </span>
    </RowShell>
  );
}

/** A row the operator cannot change — the assigned agent. */
function StaticRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <RowShell icon={icon}>
      <span className="min-w-0 flex-1">
        <Label>{label}</Label>
        <span className="mt-0.5 block truncate text-[15px] text-white">{value}</span>
      </span>
      {hint && (
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {hint}
        </span>
      )}
    </RowShell>
  );
}

// ── Sub-views ────────────────────────────────────────────────────────────────

function TimezoneView({ value, onPick }: { value: string; onPick: (tz: string) => void }) {
  const options = useMemo<SearchableOption[]>(
    () =>
      TIMEZONES.map((t) => {
        const p = tzParts(t.tz);
        return {
          value: t.tz,
          code: p.abbr,
          label: p.long,
          sublabel: p.offset,
          keywords: `${t.city} ${t.country}`,
        };
      }),
    [],
  );
  return (
    <Card>
      <SearchableSelect options={options} value={value} onSelect={onPick} placeholder="Search Timezones..." />
    </Card>
  );
}

function DateView({ value, onPick }: { value: string; onPick: (ymd: string) => void }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : today;
  const [month, setMonth] = useState(startOfMonth(selected));
  const days = useMemo(() => {
    const s = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const e = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: s, end: e });
  }, [month]);
  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-semibold text-white">{format(month, "MMMM yyyy")}</span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 px-3 pb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-1 text-center text-[11px] font-medium text-zinc-600">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 px-3 pb-4">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const past = isBefore(day, today);
          const sel = !!value && isSameDay(day, selected);
          return (
            <div key={day.toISOString()} className="flex justify-center">
              <button
                disabled={past || !inMonth}
                onClick={() => onPick(format(day, "yyyy-MM-dd"))}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors",
                  !inMonth && "opacity-0",
                  past && inMonth && "cursor-default text-zinc-700",
                  !past && inMonth && "text-zinc-100 hover:bg-white/[0.08]",
                  sel && "bg-[#FFC200] font-semibold text-black hover:bg-[#FFC200]",
                )}
              >
                {format(day, "d")}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimeView({
  value,
  onPick,
  durationFrom,
}: {
  value: string;
  onPick: (t: string) => void;
  durationFrom?: string;
}) {
  return (
    <Card>
      <div className="max-h-[62vh] overflow-y-auto scrollbar-hide">
        {TIME_SLOTS.map((t, i) => {
          const dur = durationFrom ? durationMinutesBetween(durationFrom, t) : 0;
          return (
            <button
              key={t}
              onClick={() => onPick(t)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-white/[0.03]",
                i < TIME_SLOTS.length - 1 && "border-b border-white/[0.05]",
                value === t ? "text-[#FFC200]" : "text-white",
              )}
            >
              <span>{time12(t)}</span>
              {durationFrom && dur > 0 && (
                <span className="text-[12px] text-zinc-500">
                  {dur % 60 === 0 ? `${dur / 60} hr` : `${dur} min`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ExistingView({
  loading,
  hostMissing,
  hostName,
  catchups,
  saving,
  onPick,
}: {
  loading: boolean;
  hostMissing: boolean;
  hostName: string;
  catchups: AdminCatchup[];
  saving: boolean;
  onPick: (scheduleId: string) => void;
}) {
  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#FFC200]" />
        </div>
      </Card>
    );
  }
  if (hostMissing) {
    return (
      <Card>
        <p className="px-4 py-10 text-center text-sm text-zinc-500">
          {hostName} has no NetworkChains account, so there are no catch-ups to attach.
        </p>
      </Card>
    );
  }
  if (catchups.length === 0) {
    return (
      <Card>
        <p className="px-4 py-10 text-center text-sm text-zinc-500">
          {hostName} has no upcoming catch-ups. Go back and schedule a new one.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      {catchups.map((c, i) => (
        <button
          key={c.scheduleId}
          disabled={saving}
          onClick={() => onPick(c.scheduleId)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-50",
            i < catchups.length - 1 && "border-b border-white/[0.06]",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-white">{c.title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
              {new Date(c.scheduledAt).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}{" "}
              · {c.durationMinutes} min
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
        </button>
      ))}
    </Card>
  );
}
