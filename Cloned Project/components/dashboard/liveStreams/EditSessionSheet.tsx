"use client";

/**
 * Editing ONE session of a recurring live stream.
 *
 * A series is a template plus a recurrence rule; its sessions are computed,
 * not stored. So this panel doesn't edit a row — it writes an override keyed
 * by the session's canonical day, and every field left untouched keeps
 * inheriting from the series.
 *
 * Two things that shape the UI:
 *
 *   INHERITED IS NOT EMPTY. A blank field means "use the series value", and
 *   the placeholder shows what that value is. Clearing a field you had
 *   customised sends `null`, which drops the override rather than storing an
 *   empty string.
 *
 *   MOVING A SESSION DOESN'T RENAME IT. The date picker changes when the
 *   session runs. Its identity stays the day the recurrence rule produced —
 *   which is what every enrolment, order and room join is filed under — so
 *   the original date is still shown once it has been moved.
 *
 * Per-session pricing is NOT edited here. The backend still accepts and
 * resolves it (see utils/sessionOverlay.ts), so anything already stored keeps
 * being charged correctly and the field can come back without a migration —
 * it is simply not offered in this panel.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Upload, X } from "lucide-react";
import {
  getWorkshopSessionDetail,
  revertWorkshopSession,
  updateWorkshopSession,
  type WorkshopSessionEdit,
  type WorkshopSessionEditPayload,
  type WorkshopSessionSeriesDefaults,
} from "@/lib/feed-api";
import { getToken } from "@/lib/auth";
import { TimeSelector } from "../TimeSelector";
import { DrawerShell } from "./DrawerShell";

/** "18:00" → "6:00 PM". Hours and minutes only — this product has no notion
 *  of seconds anywhere a time is entered. */
function formatClockLabel(hhmm: string): string {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm || "—";
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** The form's own shape: strings throughout, so "" can mean "inherited". */
interface FormState {
  title: string;
  description: string;
  thumbnail: string;
  runsOn: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  speakerName: string;
  speakerBio: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  thumbnail: "",
  runsOn: "",
  startTime: "",
  endTime: "",
  speakerName: "",
  speakerBio: "",
};

/** yyyy-mm-dd in UTC — the day keys this feature deals in are UTC midnight,
 *  so formatting them in local time would shift half the world by a day. */
function toDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function prettyDay(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formFromSession(
  session: WorkshopSessionEdit,
  defaults: WorkshopSessionSeriesDefaults,
): FormState {
  // Only values that DIFFER from the series are shown as filled — an edit
  // that happens to match the series shouldn't look like a customisation.
  const differs = (a?: string, b?: string) => (a && a !== b ? a : "");

  return {
    title: differs(session.title, defaults.title),
    description: differs(session.description, defaults.description),
    thumbnail: differs(session.thumbnail, defaults.thumbnail),
    runsOn: session.isRescheduled ? toDateInput(session.displayDate) : "",
    // Concrete, not "" — the time picker (shared with live-stream creation)
    // has no empty state. Inheritance is expressed by equalling the series
    // value, which buildPayload turns back into a cleared override.
    startTime: session.startTime || defaults.startTime,
    endTime: session.endTime || defaults.endTime,
    // No `differs` here: the series has no speaker of its own, so any value
    // stored on the session IS the override.
    speakerName: session.speakerName || "",
    speakerBio: session.speakerBio || "",
  };
}

export interface EditSessionTarget {
  workshopId: string;
  /** Canonical UTC-midnight slot key. */
  sessionDate: string;
  /** 1-indexed position in the series, for the header. */
  sessionNumber?: number;
}

export function EditSessionSheet({
  target,
  orgId,
  onClose,
  onSaved,
}: {
  target: EditSessionTarget | null;
  orgId: string | null;
  onClose: () => void;
  /** Fired after a successful save or revert so the table can refetch. */
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WorkshopSessionEdit | null>(null);
  const [defaults, setDefaults] =
    useState<WorkshopSessionSeriesDefaults | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const fileRef = useRef<HTMLInputElement>(null);

  const key = target ? `${target.workshopId}:${target.sessionDate}` : null;

  useEffect(() => {
    if (!target || !orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getWorkshopSessionDetail(target.workshopId, target.sessionDate, orgId)
      .then((res) => {
        if (cancelled) return;
        setSession(res.session);
        setDefaults(res.seriesDefaults);
        const next = formFromSession(res.session, res.seriesDefaults);
        setForm(next);
        setInitialForm(next);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || "Couldn't load this session");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, orgId]);

  const set = useCallback(
    (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })),
    [],
  );

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const uploadThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: fd,
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      set({ thumbnail: data.url });
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /**
   * Only what changed goes on the wire, and a field emptied after having been
   * customised goes as `null` — the backend reads that as "drop this
   * override", where an empty string would store an empty title.
   */
  const buildPayload = (): WorkshopSessionEditPayload | null => {
    if (!session || !target) return null;
    const payload: WorkshopSessionEditPayload = {};

    const text = (
      field: keyof WorkshopSessionEditPayload,
      now: string,
      before: string,
    ) => {
      if (now === before) return;
      (payload as any)[field] = now.trim() ? now.trim() : null;
    };

    text("title", form.title, initialForm.title);
    text("description", form.description, initialForm.description);
    text("thumbnail", form.thumbnail, initialForm.thumbnail);
    text("speakerName", form.speakerName, initialForm.speakerName);
    text("speakerBio", form.speakerBio, initialForm.speakerBio);

    // Times are always concrete here — the picker has no blank state, so
    // "inherited" is expressed by the value MATCHING the series. Setting it
    // back to the series time therefore drops the override rather than
    // storing a duplicate of it.
    const time = (
      field: "startTime" | "endTime",
      now: string,
      before: string,
      seriesValue: string,
    ) => {
      if (now === before) return;
      payload[field] = now && now !== seriesValue ? now : null;
    };
    if (defaults) {
      time("startTime", form.startTime, initialForm.startTime, defaults.startTime);
      time("endTime", form.endTime, initialForm.endTime, defaults.endTime);
    }

    if (form.runsOn !== initialForm.runsOn) {
      payload.rescheduledDate = form.runsOn
        ? new Date(`${form.runsOn}T00:00:00.000Z`).toISOString()
        : null;
    }

    return payload;
  };

  const save = async () => {
    if (!target || !orgId) return;
    const payload = buildPayload();
    if (!payload || Object.keys(payload).length === 0) {
      toast.info("Nothing changed");
      return;
    }
    setSaving(true);
    try {
      const res = await updateWorkshopSession(
        target.workshopId,
        target.sessionDate,
        orgId,
        payload,
      );
      setSession(res.session);
      setInitialForm(form);
      toast.success("Session updated");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't update this session");
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    if (!target || !orgId || !defaults) return;
    setReverting(true);
    try {
      const res = await revertWorkshopSession(
        target.workshopId,
        target.sessionDate,
        orgId,
      );
      setSession(res.session);
      const next = formFromSession(res.session, defaults);
      setForm(next);
      setInitialForm(next);
      toast.success("Session reset to the series defaults");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Couldn't revert this session");
    } finally {
      setReverting(false);
    }
  };

  const busy = saving || reverting;

  return (
    <DrawerShell
      open={!!target}
      title={
        target?.sessionNumber ? `Edit Session ${target.sessionNumber}` : "Edit Session"
      }
      onBack={onClose}
      onClose={onClose}
      loading={loading}
      skeleton={<FormSkeleton />}
    >
      {error ? (
        <div className="rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/[0.06] px-4 py-3 text-[13px] text-[#EF4444]">
          {error}
        </div>
      ) : !session || !defaults ? null : (
        <div className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={uploadThumb}
          />

          {/* What identifies this session, stated up front — the whole panel
              hinges on the difference between the slot and where it runs. */}
          <div className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5">
            <Label>Session</Label>
            <div className="mt-1 text-[14px] font-semibold text-white">
              {prettyDay(session.sessionDate)}
            </div>
            {session.isRescheduled && (
              <div className="mt-1 text-[12px] text-brand">
                Runs on {prettyDay(session.displayDate)} — enrolments and links
                still use the original date.
              </div>
            )}
            {session.isDeleted && (
              <div className="mt-1 text-[12px] text-[#EF4444]">
                This session is in Trash. Restore it from Options to sell or run
                it.
              </div>
            )}
          </div>

          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={defaults.title}
              maxLength={200}
              className={inputClass}
            />
            <Hint>Leave blank to use the series title.</Hint>
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={4}
              placeholder={defaults.description || "Series description"}
              className={`${inputClass} h-auto resize-none py-2.5`}
            />
          </Field>

          <Field label="Cover image">
            {form.thumbnail ? (
              <div className="relative overflow-hidden rounded-xl border border-[#26262A]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.thumbnail}
                  alt=""
                  className="h-32 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => set({ thumbnail: "" })}
                  aria-label="Remove cover image"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white transition hover:bg-black"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#33333A] bg-black/30 text-[13px] text-white/50 transition hover:border-brand/40 hover:text-white/80 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Uploading…" : "Upload a cover for this session"}
              </button>
            )}
            <Hint>Blank uses the series cover.</Hint>
          </Field>

          <Field label="Runs on">
            <input
              type="date"
              value={form.runsOn}
              onChange={(e) => set({ runsOn: e.target.value })}
              className={inputClass}
            />
            <Hint>
              Blank keeps it on {prettyDay(session.sessionDate)}. Moving it
              changes when it runs, not which session it is — enrolments,
              payments and join links stay on the original date.
            </Hint>
          </Field>

          {/* The same picker live-stream creation uses: 15-minute options,
              hours and minutes only. A native <input type="time"> was offering
              a seconds field this product has no concept of. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <TimeSelector
                value={form.startTime}
                onChange={(v) => set({ startTime: v })}
              />
              <Hint>Series: {formatClockLabel(defaults.startTime)}</Hint>
            </Field>
            <Field label="End time">
              <TimeSelector
                value={form.endTime}
                relativeTo={form.startTime}
                onChange={(v) => set({ endTime: v })}
              />
              <Hint>Series: {formatClockLabel(defaults.endTime)}</Hint>
            </Field>
          </div>

          <Field label="Speaker for this session">
            <input
              value={form.speakerName}
              onChange={(e) => set({ speakerName: e.target.value })}
              placeholder="Same as the series host"
              maxLength={200}
              className={inputClass}
            />
            <textarea
              value={form.speakerBio}
              onChange={(e) => set({ speakerBio: e.target.value })}
              rows={3}
              placeholder="Short bio (optional)"
              className={`${inputClass} mt-2 h-auto resize-none py-2.5`}
            />
            <Hint>
              Display only — it doesn&apos;t change who is allowed to run the
              room.
            </Hint>
          </Field>

          <div className="sticky bottom-0 -mx-4 mt-1 flex gap-2 bg-[#121214] px-4 pb-1 pt-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy}
              className="h-11 flex-1 rounded-xl bg-brand text-[14px] font-semibold text-brand-foreground transition enabled:hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] disabled:opacity-40"
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
            {session.isEdited && (
              <button
                type="button"
                onClick={revert}
                disabled={busy}
                title="Drop every per-session edit and follow the series again"
                className="rim-light flex h-11 items-center gap-2 rounded-xl bg-white/[0.04] px-3.5 text-[13px] text-white/80 transition hover:bg-white/[0.1] disabled:opacity-40"
              >
                <RotateCcw
                  className={`h-4 w-4 ${reverting ? "animate-spin" : ""}`}
                />
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-[#26262A] bg-black/40 px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-brand/40";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1.5 text-[11px] leading-relaxed text-white/35">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5">
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rim-light rounded-2xl bg-[#18181B]/80 px-4 py-3.5"
        >
          <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.08]" />
          <div className="mt-2.5 h-10 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}
