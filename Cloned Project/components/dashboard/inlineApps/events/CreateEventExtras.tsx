"use client";

// The optional back half of the create wizard: registration form, agenda,
// speakers and sponsors.
//
// These four live in their own file because they share one shape and none of
// it belongs to the event record itself. Each is a separate collection keyed by
// `eventId`, so none of it can be written until the event exists — the wizard
// collects drafts here and `saveEventExtras` flushes them straight after
// `createEvent`, the same deferred-save contract the banner and the commission
// plan already use.
//
// Every step is skippable on purpose. An organizer who just wants a page up
// should not have to invent a session or a speaker first, and each of these has
// a full editor in the console afterwards. What the wizard offers is the
// shortest version of each.

import React, { useMemo, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  createSession,
  createSpeaker,
  createSponsor,
  saveRegistrationForm,
  uploadEventImage,
} from "./api";
import { CustomSelect, SwitchControl, blurOnWheel, fromLocalInput } from "./ui";
import type { EventFormField, EventFormFieldType } from "./types";

// ── Shared chrome ────────────────────────────────────────────────────────

const INPUT =
  "w-full rounded-xl border border-[#262626] bg-[#1A1A1A] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand";

function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
      {children}
    </label>
  );
}

function StepIntro({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-400">{body}</p>
    </div>
  );
}

function AddRowButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#262626] py-3 text-xs font-semibold text-zinc-400 transition-colors hover:border-brand/50 hover:text-white"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function RowCard({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
          {title}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          className="rounded-lg border border-[#262626] p-1.5 text-zinc-400 transition-colors hover:border-red-500/60 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Registration form ────────────────────────────────────────────────────

/**
 * Mirrors `defaultFormFields()` on the server, which is what an event gets if
 * the wizard never touches this step. Repeated here rather than fetched
 * because there is no event to fetch it for yet.
 */
function defaultFields(): EventFormField[] {
  const base: Array<[EventFormFieldType, string, string, boolean]> = [
    ["first_name", "First name", "Enter first name", true],
    ["last_name", "Last name", "Enter last name", true],
    ["email", "Email address", "you@example.com", true],
    ["phone", "Phone number", "Enter mobile number", false],
    ["company", "Company / Organization", "Company name", false],
    ["job_title", "Job title", "Your role", false],
  ];
  return base.map(([type, label, placeholder, required], order) => ({
    key: type,
    type,
    label,
    placeholder,
    required,
    showOnBadge: type === "first_name" || type === "last_name",
    options: [],
    conditions: [],
    order,
  }));
}

/** The custom types worth offering before the event exists. */
const CUSTOM_TYPES: Array<{ value: EventFormFieldType; label: string }> = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Paragraph" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multi_select", label: "Multi-select" },
  { value: "terms", label: "Terms checkbox" },
];

const CHOICE_TYPES: EventFormFieldType[] = ["dropdown", "multi_select"];

export interface RegistrationDraft {
  title: string;
  description: string;
  fields: EventFormField[];
}

export const emptyRegistration = (): RegistrationDraft => ({
  title: "",
  description: "",
  fields: defaultFields(),
});

export function RegistrationStep({
  value,
  onChange,
}: {
  value: RegistrationDraft;
  onChange: (next: RegistrationDraft) => void;
}) {
  const [adding, setAdding] = useState<EventFormFieldType>("short_text");

  function addField() {
    // Keys are what answers are stored against and the server rejects a
    // duplicate, so they are numbered per type rather than derived from the
    // label the organizer is about to change.
    let n = 1;
    while (value.fields.some((f) => f.key === `${adding}_${n}`)) n += 1;
    const key = adding === "terms" ? "terms" : `${adding}_${n}`;
    if (value.fields.some((f) => f.key === key)) {
      toast.info("That field is already on the form");
      return;
    }
    onChange({
      ...value,
      fields: [
        ...value.fields,
        {
          key,
          type: adding,
          label:
            CUSTOM_TYPES.find((t) => t.value === adding)?.label || "Question",
          placeholder: "",
          required: false,
          showOnBadge: false,
          options: CHOICE_TYPES.includes(adding) ? ["Option 1", "Option 2"] : [],
          conditions: [],
          order: value.fields.length,
        },
      ],
    });
  }

  function patch(key: string, changes: Partial<EventFormField>) {
    onChange({
      ...value,
      fields: value.fields.map((f) => (f.key === key ? { ...f, ...changes } : f)),
    });
  }

  return (
    <div className="space-y-4">
      <StepIntro
        title="What you ask attendees"
        body="Everyone who books answers this. The six standard fields are already here — add your own questions on top, or skip and do it later in Registration."
      />

      <div>
        <MicroLabel>Form heading</MicroLabel>
        <input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Register for the summit"
          className={INPUT}
        />
      </div>

      <div className="space-y-2.5">
        {value.fields.map((f) => {
          const standard = !CUSTOM_TYPES.some((t) => t.value === f.type);
          return (
            <div
              key={f.key}
              className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5"
            >
              <div className="flex items-center gap-3">
                <input
                  value={f.label}
                  onChange={(e) => patch(f.key, { label: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm text-white outline-none transition-colors hover:border-[#262626] focus:border-brand"
                />
                <label className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-400">
                  Required
                  <SwitchControl
                    checked={!!f.required}
                    onChange={(v) => patch(f.key, { required: v })}
                    aria-label={`${f.label} required`}
                  />
                </label>
                {/* Standard fields are the ones the ticket itself is issued
                    against, so they stay — only added questions can go. */}
                {!standard ? (
                  <button
                    type="button"
                    aria-label={`Remove ${f.label}`}
                    onClick={() =>
                      onChange({
                        ...value,
                        fields: value.fields
                          .filter((x) => x.key !== f.key)
                          .map((x, order) => ({ ...x, order })),
                      })
                    }
                    className="shrink-0 rounded-lg border border-[#262626] p-1.5 text-zinc-400 transition-colors hover:border-red-500/60 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
                    Standard
                  </span>
                )}
              </div>

              {CHOICE_TYPES.includes(f.type) && (
                <div className="mt-3">
                  <MicroLabel>Options, one per line</MicroLabel>
                  <textarea
                    rows={3}
                    value={(f.options || []).join("\n")}
                    onChange={(e) =>
                      patch(f.key, {
                        // Trimmed here as well as on the server: the buyer's
                        // answer is matched against these, and a stray space
                        // used to read back as an invalid selection.
                        options: e.target.value
                          .split("\n")
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                    className={`${INPUT} resize-y`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-end gap-2">
        <CustomSelect
          label="Add a question"
          value={adding}
          onChange={(v) => setAdding(v as EventFormFieldType)}
          options={CUSTOM_TYPES}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addField}
          className="h-[46px] shrink-0 rounded-xl bg-brand px-4 text-xs font-bold text-brand-foreground transition-all hover:brightness-95"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Agenda ───────────────────────────────────────────────────────────────

export interface SessionDraft {
  key: string;
  title: string;
  /** `YYYY-MM-DD`, always one of the event's own days. */
  day: string;
  startClock: string;
  endClock: string;
  stageName: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Every calendar day between the two datetime-local strings on step 1.
 *
 * Local-time throughout, matching the console's agenda grid — the session
 * timestamps are built by parsing `YYYY-MM-DDTHH:mm` as local, so the day list
 * has to be derived the same way or a session lands on a day it can't sit on.
 */
export function wizardEventDays(startsAt: string, endsAt: string): string[] {
  if (!startsAt || !endsAt) return [];
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const keys: string[] = [];
  while (cursor <= last && keys.length < 366) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

const TIME_SLOTS = Array.from({ length: (24 - 6) * 4 }, (_, i) => {
  const mins = 6 * 60 + i * 15;
  const label = `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  return { value: label, label };
});

export const newSession = (day: string): SessionDraft => ({
  key: Math.random().toString(36).slice(2),
  title: "",
  day,
  startClock: "10:00",
  endClock: "10:45",
  stageName: "Main Stage",
});

export function AgendaStep({
  days,
  value,
  onChange,
}: {
  /** The event's own days. Empty until step 1 has both dates. */
  days: string[];
  value: SessionDraft[];
  onChange: (next: SessionDraft[]) => void;
}) {
  const dayOptions = useMemo(
    () =>
      days.map((k, i) => {
        const [y, m, d] = k.split("-").map(Number);
        return {
          value: k,
          label: `Day ${i + 1} · ${new Date(y, m - 1, d).toLocaleDateString(
            undefined,
            { day: "numeric", month: "short" }
          )}`,
        };
      }),
    [days]
  );

  return (
    <div className="space-y-4">
      <StepIntro
        title="The schedule"
        body="Sketch the talks and breaks you already know about. Days are fixed to the dates you set on step one; tracks, speakers and everything else can be filled in later in Agenda."
      />

      {days.length === 0 ? (
        <p className="rounded-xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-xs text-zinc-400">
          Set the event&apos;s start and end dates on step one to schedule
          sessions.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            {value.map((s, i) => (
              <RowCard
                key={s.key}
                title={`Session ${i + 1}`}
                onRemove={() => onChange(value.filter((x) => x.key !== s.key))}
              >
                <div className="space-y-3">
                  <input
                    value={s.title}
                    onChange={(e) =>
                      onChange(
                        value.map((x) =>
                          x.key === s.key ? { ...x, title: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Opening keynote"
                    className={INPUT}
                  />
                  <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
                    <CustomSelect
                      aria-label="Day"
                      value={s.day}
                      onChange={(v) =>
                        onChange(
                          value.map((x) => (x.key === s.key ? { ...x, day: v } : x))
                        )
                      }
                      options={dayOptions}
                      disabled={dayOptions.length <= 1}
                    />
                    <CustomSelect
                      aria-label="Start time"
                      value={s.startClock}
                      onChange={(v) =>
                        onChange(
                          value.map((x) =>
                            x.key === s.key ? { ...x, startClock: v } : x
                          )
                        )
                      }
                      options={TIME_SLOTS}
                    />
                    <CustomSelect
                      aria-label="End time"
                      value={s.endClock}
                      // Strictly after the start, so a session can never be
                      // saved inverted or zero-length.
                      onChange={(v) =>
                        onChange(
                          value.map((x) =>
                            x.key === s.key ? { ...x, endClock: v } : x
                          )
                        )
                      }
                      options={TIME_SLOTS.filter((t) => t.value > s.startClock)}
                    />
                  </div>
                  <input
                    value={s.stageName}
                    onChange={(e) =>
                      onChange(
                        value.map((x) =>
                          x.key === s.key ? { ...x, stageName: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Main Stage"
                    className={INPUT}
                  />
                </div>
              </RowCard>
            ))}
          </div>
          <AddRowButton
            label="Add session"
            onClick={() => onChange([...value, newSession(days[0])])}
          />
        </>
      )}
    </div>
  );
}

// ── Speakers ─────────────────────────────────────────────────────────────

export interface SpeakerDraft {
  key: string;
  name: string;
  role: string;
  company: string;
  bio: string;
}

export const newSpeaker = (): SpeakerDraft => ({
  key: Math.random().toString(36).slice(2),
  name: "",
  role: "",
  company: "",
  bio: "",
});

export function SpeakersStep({
  value,
  onChange,
}: {
  value: SpeakerDraft[];
  onChange: (next: SpeakerDraft[]) => void;
}) {
  const patch = (key: string, changes: Partial<SpeakerDraft>) =>
    onChange(value.map((s) => (s.key === key ? { ...s, ...changes } : s)));

  return (
    <div className="space-y-4">
      <StepIntro
        title="Who's speaking"
        body="Names are enough to get the page up. Headshots, socials and keynote billing are added later in Speakers."
      />
      <div className="space-y-2.5">
        {value.map((s, i) => (
          <RowCard
            key={s.key}
            title={`Speaker ${i + 1}`}
            onRemove={() => onChange(value.filter((x) => x.key !== s.key))}
          >
            <div className="space-y-3">
              <input
                value={s.name}
                onChange={(e) => patch(s.key, { name: e.target.value })}
                placeholder="Full name"
                className={INPUT}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={s.role}
                  onChange={(e) => patch(s.key, { role: e.target.value })}
                  placeholder="Role"
                  className={INPUT}
                />
                <input
                  value={s.company}
                  onChange={(e) => patch(s.key, { company: e.target.value })}
                  placeholder="Company"
                  className={INPUT}
                />
              </div>
              <textarea
                rows={2}
                value={s.bio}
                onChange={(e) => patch(s.key, { bio: e.target.value })}
                placeholder="One or two lines about them."
                className={`${INPUT} resize-y`}
              />
            </div>
          </RowCard>
        ))}
      </div>
      <AddRowButton
        label="Add speaker"
        onClick={() => onChange([...value, newSpeaker()])}
      />
    </div>
  );
}

// ── Sponsors ─────────────────────────────────────────────────────────────

export interface SponsorDraft {
  key: string;
  name: string;
  websiteUrl: string;
  boothNumber: string;
  /** Held until the event exists — the upload needs an event id. */
  logoFile: File | null;
  logoPreview: string;
}

export const newSponsor = (): SponsorDraft => ({
  key: Math.random().toString(36).slice(2),
  name: "",
  websiteUrl: "",
  boothNumber: "",
  logoFile: null,
  logoPreview: "",
});

export function SponsorsStep({
  value,
  onChange,
}: {
  value: SponsorDraft[];
  onChange: (next: SponsorDraft[]) => void;
}) {
  const patch = (key: string, changes: Partial<SponsorDraft>) =>
    onChange(value.map((s) => (s.key === key ? { ...s, ...changes } : s)));

  return (
    <div className="space-y-4">
      <StepIntro
        title="Partners and sponsors"
        body="Every logo is shown at the same size on the public page, in the order you add them here."
      />
      <div className="space-y-2.5">
        {value.map((s, i) => (
          <RowCard
            key={s.key}
            title={`Sponsor ${i + 1}`}
            onRemove={() => onChange(value.filter((x) => x.key !== s.key))}
          >
            <div className="flex items-start gap-3">
              <LogoPicker
                preview={s.logoPreview}
                onPick={(file) =>
                  patch(s.key, {
                    logoFile: file,
                    logoPreview: URL.createObjectURL(file),
                  })
                }
              />
              <div className="min-w-0 flex-1 space-y-3">
                <input
                  value={s.name}
                  onChange={(e) => patch(s.key, { name: e.target.value })}
                  placeholder="Sponsor name"
                  className={INPUT}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={s.websiteUrl}
                    onChange={(e) => patch(s.key, { websiteUrl: e.target.value })}
                    placeholder="https://…"
                    className={INPUT}
                  />
                  <input
                    value={s.boothNumber}
                    onChange={(e) => patch(s.key, { boothNumber: e.target.value })}
                    onWheel={blurOnWheel}
                    placeholder="Booth"
                    className={INPUT}
                  />
                </div>
              </div>
            </div>
          </RowCard>
        ))}
      </div>
      <AddRowButton
        label="Add sponsor"
        onClick={() => onChange([...value, newSponsor()])}
      />
    </div>
  );
}

function LogoPicker({
  preview,
  onPick,
}: {
  preview: string;
  onPick: (file: File) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="group relative h-[86px] w-28 shrink-0 overflow-hidden rounded-xl border border-dashed border-[#262626] bg-[#141414] transition-colors hover:border-brand"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-contain p-2" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-500">
            <Upload className="h-4 w-4" />
            <span className="text-[10px]">Logo</span>
          </span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            toast.error("Pick an image file");
            return;
          }
          onPick(file);
        }}
      />
    </>
  );
}

// ── Flush ────────────────────────────────────────────────────────────────

export interface EventExtras {
  registration: RegistrationDraft;
  sessions: SessionDraft[];
  speakers: SpeakerDraft[];
  sponsors: SponsorDraft[];
}

/**
 * Write the drafts against a freshly created event.
 *
 * Deliberately forgiving: the event already exists by the time this runs, so a
 * failure here is a partial setup the organizer can finish in the console, not
 * a lost event. Each group reports its own failure and the rest still run.
 */
export async function saveEventExtras(
  eventId: string,
  extras: EventExtras,
  /** Untouched defaults are not worth a write. */
  registrationTouched: boolean
): Promise<void> {
  if (registrationTouched) {
    try {
      await saveRegistrationForm(eventId, {
        title: extras.registration.title.trim(),
        description: extras.registration.description.trim() || undefined,
        fields: extras.registration.fields.map((f, order) => ({ ...f, order })),
      });
    } catch (err: any) {
      toast.error(
        err?.message || "Event saved, but the registration form did not"
      );
    }
  }

  const sessions = extras.sessions.filter((s) => s.title.trim() && s.day);
  if (sessions.length) {
    try {
      for (const s of sessions) {
        await createSession(eventId, {
          title: s.title.trim(),
          stageName: s.stageName.trim() || "Main Stage",
          sessionType: "session",
          startTime: fromLocalInput(`${s.day}T${s.startClock}`),
          endTime: fromLocalInput(`${s.day}T${s.endClock}`),
          speakerIds: [],
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Event saved, but some sessions did not");
    }
  }

  const speakers = extras.speakers.filter((s) => s.name.trim());
  if (speakers.length) {
    try {
      for (const [i, s] of speakers.entries()) {
        await createSpeaker(eventId, {
          name: s.name.trim(),
          role: s.role.trim() || undefined,
          company: s.company.trim() || undefined,
          bio: s.bio.trim() || undefined,
          sortOrder: i,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Event saved, but some speakers did not");
    }
  }

  const sponsors = extras.sponsors.filter((s) => s.name.trim());
  if (sponsors.length) {
    try {
      for (const [i, s] of sponsors.entries()) {
        let logoUrl: string | undefined;
        if (s.logoFile) {
          // A logo that won't upload must not take the sponsor down with it.
          try {
            logoUrl = (await uploadEventImage(eventId, s.logoFile, "sponsors"))
              .url;
          } catch {
            logoUrl = undefined;
          }
        }
        await createSponsor(eventId, {
          name: s.name.trim(),
          websiteUrl: s.websiteUrl.trim() || undefined,
          boothNumber: s.boothNumber.trim() || undefined,
          logoUrl,
          sortOrder: i,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Event saved, but some sponsors did not");
    }
  }
}
