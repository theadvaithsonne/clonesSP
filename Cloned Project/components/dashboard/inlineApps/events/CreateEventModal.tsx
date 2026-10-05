"use client";

// Create Event — the founder create form.
//
// Styled to ServiceFormModal, which is the reference founder create form:
// a centred #141414 card on a blurred black scrim, #262626 hairlines,
// #1A1A1A inputs with a #FBD10D focus ring, bold uppercase zinc-400
// micro-labels, and a sticky footer bar. If that form is restyled, this one
// should move with it.
//
// The one departure is the 3-step stepper in the header. An event carries three
// unrelated decision sets (what it is / where it happens / what it costs) and
// the venue step owns an interactive map — one continuous scroll buries the map
// and the ticket rows.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  GripVertical,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Monitor,
  Plus,
  Radio,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CommissionPlanSection,
  saveCommissionPlan,
} from "@/components/dashboard/CommissionPlanSection";
import { createEvent, listSessions, listTickets, updateEvent, uploadBanner } from "./api";
import { announceEvent } from "./announceEvent";
import { FounderAlertsSection } from "@/components/dashboard/products/FounderAlertsSection";
import { useFounderAlerts } from "@/components/dashboard/products/useFounderAlerts";
import VenuePicker, { type VenueValue } from "./VenuePicker";
import {
  AgendaStep,
  RegistrationStep,
  SpeakersStep,
  SponsorsStep,
  emptyRegistration,
  saveEventExtras,
  wizardEventDays,
  type RegistrationDraft,
  type SessionDraft,
  type SpeakerDraft,
  type SponsorDraft,
} from "./CreateEventExtras";
import DateTimeField from "./DateTimeField";
import {
  CapacityMeter,
  CustomSelect,
  EVENT_CATEGORIES,
  EVENT_LANGUAGES,
  fromLocalInput,
  blurOnWheel,
  localTimezone,
  SwitchControl,
  useHideBottomBar,
  timezoneOptions,
  toLocalInput,
} from "./ui";
import type {
  AgendaSession,
  EventFormat,
  EventProgram,
  EventStreamType,
} from "./types";

/** The API's limits: `description` is the full copy, `shortDescription` the teaser. */
const DESCRIPTION_MAX = 10000;
const SUMMARY_MAX = 140;

/**
 * The one-line teaser cards and link previews show, taken from the start of
 * the description. The form asks for a single description; the API still
 * keeps a separate 140-character `shortDescription` for those surfaces.
 */
function summaryOf(description: string) {
  const text = description.replace(/\s+/g, " ").trim();
  if (text.length <= SUMMARY_MAX) return text;
  const cut = text.slice(0, SUMMARY_MAX - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(" "));
  return `${(atWord.length > SUMMARY_MAX / 2 ? atWord : cut).trimEnd()}…`;
}

// ── Shared field chrome, matching the other founder create forms ─────────

const INPUT =
  "bg-[#1A1A1A] border-[#262626] text-white text-sm h-11 rounded-xl px-4 placeholder:text-zinc-600 focus:border-brand focus:ring-1 focus:ring-brand w-full";

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
        {children}
      </span>
      <div className="flex-grow border-t border-[#262626]" />
    </div>
  );
}

/**
 * Thin wrapper so this form's fields keep their own label chrome while the
 * menu itself is the shared themed dropdown — a native `<select>` here opened
 * the OS's own list, which is the one light-on-white surface in the form.
 */
function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <CustomSelect
        aria-label={label}
        value={value}
        onChange={onChange}
        options={options}
        triggerClassName="h-11 py-0"
      />
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#1A1A1A] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            {description && (
              <div className="text-xs text-zinc-400">{description}</div>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <SwitchControl
            checked={checked}
            onChange={onChange}
            aria-label={title}
          />
        </div>
      </div>
    </div>
  );
}

// ── Ticket drafts ────────────────────────────────────────────────────────

interface TicketDraft {
  key: string;
  name: string;
  price: string;
  quantity: string;
  currency: string;
  salesStart: string;
  salesEnd: string;
  isVisible: boolean;
}

function newTicket(name = "", quantity = 100): TicketDraft {
  return {
    key: Math.random().toString(36).slice(2),
    name,
    price: "0",
    quantity: String(quantity),
    currency: "USD",
    salesStart: "",
    salesEnd: "",
    isVisible: true,
  };
}

/**
 * Everything an event needs, in the order an organizer thinks about it.
 *
 * The last four are optional and each has a fuller editor in the console; they
 * are here so a new event can go out complete in one pass instead of leaving
 * the founder to find four more screens. Edit mode keeps only the first two —
 * see the note on the component.
 */
const STEPS = [
  { n: 1, label: "Details" },
  { n: 2, label: "Venue" },
  { n: 3, label: "Tickets" },
  { n: 4, label: "Registration" },
  { n: 5, label: "Agenda" },
  { n: 6, label: "Speakers" },
  { n: 7, label: "Sponsors" },
];

/** Steps the founder may walk straight past. */
const OPTIONAL_FROM = 4;

/**
 * Create *and* edit.
 *
 * Passing `initialEvent` turns the wizard into an editor: the same fields,
 * pre-filled, saving through `PATCH /event-management/:id`. Step 3 is dropped
 * in that mode — tickets, coupons and the commission plan each have their own
 * console section once the event exists, and re-submitting the wizard's ticket
 * drafts over them would duplicate rows.
 */
export default function CreateEventModal({
  isOpen,
  onClose,
  onCreated,
  initialEvent,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (eventId: string) => void;
  /** Present → edit mode. */
  initialEvent?: EventProgram | null;
  /** Edit mode only, after a successful PATCH. */
  onSaved?: () => void;
}) {
  const isEdit = !!initialEvent;
  const steps = isEdit ? STEPS.slice(0, 2) : STEPS;
  const lastStep = steps[steps.length - 1].n;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState<"draft" | "publish" | "edit" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState(localTimezone());
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatRule, setRepeatRule] = useState("weekly");
  const [category, setCategory] = useState("Technology");
  const [language, setLanguage] = useState("English");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [format, setFormat] = useState<EventFormat>("in_person");
  const [venue, setVenue] = useState<VenueValue>({
    name: "",
    addressLine1: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
  });
  const [streamType, setStreamType] =
    useState<EventStreamType>("garage_livestream");
  const [externalUrl, setExternalUrl] = useState("");
  const [totalCapacity, setTotalCapacity] = useState("250");
  const [isPrivate, setIsPrivate] = useState(false);

  // Step 3
  const [tickets, setTickets] = useState<TicketDraft[]>([newTicket("Early bird")]);
  // Whether ticket prices already contain the 18% GST, or it is added on top.
  const [gstInclusive, setGstInclusive] = useState(false);
  const founderAlertsForm = useFounderAlerts();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Steps 4–7. All optional, all written after the event exists — see
  // `saveEventExtras`.
  const [registration, setRegistration] = useState<RegistrationDraft>(
    emptyRegistration
  );
  // An untouched default form is what the server creates on its own, so there
  // is nothing to write and nothing to get wrong.
  const [registrationTouched, setRegistrationTouched] = useState(false);
  const [sessionDrafts, setSessionDrafts] = useState<SessionDraft[]>([]);
  const [speakerDrafts, setSpeakerDrafts] = useState<SpeakerDraft[]>([]);
  const [sponsorDrafts, setSponsorDrafts] = useState<SponsorDraft[]>([]);

  const eventDays = useMemo(
    () => wizardEventDays(startsAt, endsAt),
    [startsAt, endsAt]
  );

  // Every step change scrolls the body back to the top; without this, step 2
  // opens mid-form because the container keeps the previous scroll offset.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // ── Edit mode ──────────────────────────────────────────────────────────
  const { hydrate: hydrateAlerts } = founderAlertsForm;
  const editId = initialEvent?._id;

  // Keyed on the event id, not the object: the console re-fetches the event
  // after every save, and a new object identity must not stamp the server's
  // copy back over whatever the organizer is currently typing.
  useEffect(() => {
    if (!isOpen || !initialEvent) return;
    setStep(1);
    setName(initialEvent.name || "");
    // Events made before the form asked for a full description only have
    // the teaser, so that is what there is to edit.
    setDescription(initialEvent.description || initialEvent.shortDescription || "");
    setStartsAt(toLocalInput(initialEvent.startsAt));
    setEndsAt(toLocalInput(initialEvent.endsAt));
    setTimezone(initialEvent.timezone || localTimezone());
    setIsRepeating(!!initialEvent.isRepeating);
    setRepeatRule(initialEvent.repeatRule || "weekly");
    setCategory(initialEvent.category || "Technology");
    setLanguage(initialEvent.language || "English");
    setBannerFile(null);
    setBannerPreview(initialEvent.bannerUrl || "");
    setFormat(initialEvent.format || "in_person");
    setVenue({
      name: initialEvent.venue?.name || "",
      addressLine1: initialEvent.venue?.addressLine1 || "",
      city: initialEvent.venue?.city || "",
      state: initialEvent.venue?.state || "",
      postcode: initialEvent.venue?.postcode || "",
      country: initialEvent.venue?.country || "",
      // The stored pin has both halves optional; the picker's pin does not, so
      // a half-written pair is dropped rather than carried in broken.
      coordinates:
        typeof initialEvent.venue?.coordinates?.lat === "number" &&
        typeof initialEvent.venue?.coordinates?.lng === "number"
          ? {
              lat: initialEvent.venue.coordinates.lat,
              lng: initialEvent.venue.coordinates.lng,
            }
          : undefined,
    });
    setStreamType(initialEvent.streaming?.streamType || "garage_livestream");
    setExternalUrl(initialEvent.streaming?.externalUrl || "");
    setTotalCapacity(String(initialEvent.totalCapacity ?? 250));
    setIsPrivate(!!initialEvent.isPrivate);
    hydrateAlerts(initialEvent.founderAlerts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editId, hydrateAlerts]);

  // Only to warn about sessions the new dates would strand — the agenda is
  // edited in its own section, never from here.
  const [existingSessions, setExistingSessions] = useState<AgendaSession[]>([]);
  useEffect(() => {
    if (!isOpen || !editId) {
      setExistingSessions([]);
      return;
    }
    let alive = true;
    listSessions(editId)
      .then((r) => {
        if (alive) setExistingSessions(r.sessions || []);
      })
      .catch(() => {
        // A failed agenda fetch only costs the warning, not the edit.
      });
    return () => {
      alive = false;
    };
  }, [isOpen, editId]);

  // Edit mode: seats the event's ticket types already list, so capacity can't
  // be cut below them. Add-ons aren't seats.
  const [listedSeats, setListedSeats] = useState<number | null>(null);
  useEffect(() => {
    if (!isOpen || !editId) {
      setListedSeats(null);
      return;
    }
    let alive = true;
    // All kinds, filtered here: tiers from before add-ons existed carry no
    // `kind` in the database, so the API's `?kind=ticket` filter misses them.
    listTickets(editId)
      .then((r) => {
        if (!alive) return;
        setListedSeats(
          (r.tiers || [])
            .filter((t) => (t.kind || "ticket") === "ticket")
            .reduce((n, t) => n + t.quantity, 0)
        );
      })
      .catch(() => {
        // Unknown rather than zero — the save isn't blocked on a failed fetch.
      });
    return () => {
      alive = false;
    };
  }, [isOpen, editId]);

  const strandedSessions = useMemo(() => {
    if (!isEdit || !startsAt || !endsAt) return [];
    const from = new Date(startsAt).getTime();
    const to = new Date(endsAt).getTime();
    if (isNaN(from) || isNaN(to)) return [];
    return existingSessions.filter((s) => {
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      return sStart < from || sEnd > to;
    });
  }, [isEdit, startsAt, endsAt, existingSessions]);

  // The floating bottom bar sits where this form's footer buttons land.
  useHideBottomBar(isOpen);

  if (!isOpen) return null;

  const step1Valid = Boolean(name.trim() && startsAt && endsAt);
  // Both remaining formats happen at a venue; Hybrid additionally needs a
  // working stream target when that target is an external link.
  const step2Valid =
    Boolean(venue.name.trim() && venue.city.trim()) &&
    (format !== "hybrid" ||
      streamType !== "external_link" ||
      Boolean(externalUrl.trim()));

  // Tickets can't list more seats than the event holds — each tier's sales
  // stop at its quantity, so this is what keeps sales within capacity.
  const capacityNum = Math.max(1, parseInt(totalCapacity || "1", 10) || 1);
  const draftSeats = tickets.reduce(
    (n, t) => n + Math.max(0, parseInt(t.quantity || "0", 10) || 0),
    0
  );
  const ticketsOverCapacity = draftSeats > capacityNum;
  const capacityBelowListed = isEdit && listedSeats != null && capacityNum < listedSeats;

  function pickBanner(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  function updateTicket(i: number, patch: Partial<TicketDraft>) {
    setTickets((prev) => prev.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));
  }

  /** Edit mode's save. Only the fields this form owns are sent, so anything
   *  managed elsewhere — tickets, GST, the commission plan — survives a
   *  PATCH untouched. */
  async function saveEdit() {
    if (!initialEvent) return;
    if (!step1Valid) {
      setStep(1);
      toast.error("Add a name and dates first");
      return;
    }
    // Virtual events predate the venue step and have nothing to fill in, so
    // requiring one here would lock their organizers out of every other field.
    if (format !== "virtual" && !step2Valid) {
      setStep(2);
      toast.error("Finish the venue details first");
      return;
    }
    if (capacityBelowListed) {
      setStep(2);
      toast.error(
        `Your tickets already list ${listedSeats} seats — capacity can't be lower. Reduce ticket quantities first.`
      );
      return;
    }
    setSaving("edit");
    try {
      await updateEvent(initialEvent._id, {
        name: name.trim(),
        // Sent even when empty, so clearing the description actually clears it.
        description: description.trim(),
        shortDescription: summaryOf(description),
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        timezone,
        isRepeating,
        repeatRule: isRepeating ? repeatRule : undefined,
        category,
        language,
        format,
        venue: {
          name: venue.name.trim(),
          addressLine1: venue.addressLine1.trim(),
          city: venue.city.trim(),
          state: venue.state.trim(),
          postcode: venue.postcode.trim(),
          country: venue.country.trim(),
          coordinates: venue.coordinates,
        },
        streaming:
          format === "in_person"
            ? undefined
            : {
                streamType,
                externalUrl:
                  streamType === "external_link" ? externalUrl.trim() : undefined,
              },
        totalCapacity: Math.max(1, parseInt(totalCapacity || "1", 10)),
        isPrivate,
        founderAlerts: founderAlertsForm.buildPayload(),
      });

      // Same deferred contract as create: a failed image must not read as a
      // failed save, because the rest of the edit already landed.
      if (bannerFile) {
        try {
          await uploadBanner(initialEvent._id, bannerFile);
        } catch {
          toast.error("Event updated, but the cover image failed to upload");
        }
      }

      toast.success("Event updated successfully");
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Could not update the event");
    } finally {
      setSaving(null);
    }
  }

  async function submit(mode: "draft" | "publish") {
    if (!step1Valid) {
      setStep(1);
      toast.error("Add a name and dates first");
      return;
    }
    if (ticketsOverCapacity) {
      setStep(3);
      toast.error(
        `Tickets list ${draftSeats} seats but the event holds ${capacityNum}. Lower the quantities or raise the capacity.`
      );
      return;
    }
    setSaving(mode);
    try {
      const res = await createEvent({
        name: name.trim(),
        description: description.trim() || undefined,
        shortDescription: summaryOf(description) || undefined,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        timezone,
        isRepeating,
        repeatRule: isRepeating ? repeatRule : undefined,
        category,
        language,
        format,
        venue: {
                name: venue.name.trim(),
                addressLine1: venue.addressLine1.trim(),
                city: venue.city.trim(),
                state: venue.state.trim(),
                postcode: venue.postcode.trim(),
                country: venue.country.trim(),
                // The pin the founder dropped, saved verbatim — the public page
                // and the directions link both read it.
                coordinates: venue.coordinates,
              },
        streaming:
          format === "in_person"
            ? undefined
            : {
                streamType,
                externalUrl:
                  streamType === "external_link" ? externalUrl.trim() : undefined,
              },
        totalCapacity: Math.max(1, parseInt(totalCapacity || "1", 10)),
        isPrivate,
        // GST always applies to Indian buyers; the choice is who absorbs
        // it, which is what `gstInclusive` answers.
        addGstForIndianBuyers: true,
        gstInclusive,
        founderAlerts: founderAlertsForm.buildPayload(),
        tickets: tickets
          .filter((t) => t.name.trim())
          .map((t, i) => ({
            name: t.name.trim(),
            price: Math.max(0, Number(t.price) || 0),
            quantity: Math.max(1, parseInt(t.quantity || "1", 10)),
            currency: t.currency,
            salesStart: fromLocalInput(t.salesStart),
            salesEnd: fromLocalInput(t.salesEnd),
            isVisible: t.isVisible,
            sortOrder: i,
          })),
        publish: mode === "publish",
      });

      const eventId = res.event._id;

      // Second call because the S3 key needs the event id. A failure here must
      // not lose the event that was just created.
      let bannerUrl: string | null = null;
      if (bannerFile) {
        try {
          bannerUrl = (await uploadBanner(eventId, bannerFile)).url || null;
        } catch {
          toast.error("Event saved, but the cover image failed to upload");
        }
      }

      // The commission plan needs an item to attach to, so it is saved after
      // the event exists — same deferred-save contract the other create forms
      // use. A failure here must not lose the event either.
      try {
        await saveCommissionPlan(eventId);
      } catch {
        toast.error("Event saved, but the commission plan did not");
      }

      // Registration form, agenda, speakers and sponsors, for the same reason:
      // each is its own collection keyed by the event id. Reports its own
      // partial failures and never throws.
      await saveEventExtras(
        eventId,
        {
          registration,
          sessions: sessionDrafts,
          speakers: speakerDrafts,
          sponsors: sponsorDrafts,
        },
        registrationTouched
      );

      // Publishing can still land as a draft when something is missing —
      // the popup says so and lists what is still needed.
      announceEvent(
        res.event,
        tickets
          .filter((t) => t.name.trim() && t.isVisible)
          .map((t) => ({ price: Math.max(0, Number(t.price) || 0), currency: t.currency })),
        {
          draft: !res.published,
          bannerUrl,
          note:
            mode === "publish" && !res.published && res.blockers?.length
              ? `Still needed before it can go live: ${res.blockers.join(", ")}.`
              : null,
        }
      );
      onCreated(eventId);
    } catch (err: any) {
      toast.error(err?.message || "Could not save the event");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#262626] shrink-0 bg-[#141414]">
          <h2 className="text-base font-bold text-white shrink-0">
            {isEdit ? "Edit Event" : "Create New Event"}
          </h2>

          <div className="flex items-center gap-1 ml-auto">
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <span className="mx-0.5 h-px w-3 bg-[#262626]" />}
                <button
                  type="button"
                  onClick={() => setStep(s.n)}
                  title={s.label}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[#262626]"
                >
                  <span
                    className={[
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                      step >= s.n
                        ? "bg-brand text-brand-foreground"
                        : "bg-[#262626] text-zinc-500",
                    ].join(" ")}
                  >
                    {step > s.n ? <Check className="h-2.5 w-2.5" /> : s.n}
                  </span>
                  {/* Only the step you are on is named. Seven labels across a
                      max-w-2xl header wrapped onto two lines and pushed the
                      close button off the row. */}
                  {step === s.n && (
                    <span className="hidden text-[11px] font-medium text-white sm:inline">
                      {s.label}
                    </span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#262626] transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="w-full px-5 py-4 space-y-6">
            {/* ── Step 1 ─────────────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <FieldLabel required>Event Name</FieldLabel>
                  <div className="relative">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 200))}
                      maxLength={200}
                      placeholder="e.g., Garage Founders Summit 2026"
                      className={`${INPUT} pr-16`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400/60">
                      {name.length}/200
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    rows={6}
                    maxLength={DESCRIPTION_MAX}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's the event about, who is it for, and what will they walk away with?"
                    className="w-full bg-[#1A1A1A] border border-[#262626] text-white text-sm rounded-lg px-3 py-2.5 resize-y outline-none focus:border-brand/50 placeholder:text-zinc-600"
                  />
                  <div className="mt-1 flex justify-between gap-3 text-xs text-zinc-400/60">
                    <span>The opening line is used as the teaser on event cards.</span>
                    <span className="shrink-0 tabular-nums">
                      {description.length.toLocaleString()}/{DESCRIPTION_MAX.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>Starts</FieldLabel>
                    <DateTimeField
                      value={startsAt}
                      placeholder="Pick a start"
                      onChange={(v) => {
                        setStartsAt(v);
                        // Default the end to +3h on first pick so the common
                        // case needs no second interaction.
                        if (!endsAt && v) {
                          const d = new Date(v);
                          d.setHours(d.getHours() + 3);
                          setEndsAt(toLocalInput(d));
                        }
                      }}
                    />
                  </div>
                  <div>
                    <FieldLabel required>Ends</FieldLabel>
                    <DateTimeField
                      value={endsAt}
                      placeholder="Pick an end"
                      // An event cannot end before it starts, so the grid
                      // greys those days out instead of letting the form
                      // fail validation later.
                      min={startsAt || undefined}
                      onChange={setEndsAt}
                    />
                  </div>
                </div>

                {/* Narrowing the dates can orphan sessions: they stay in the
                    database but fall outside every day the agenda offers. Say
                    so here, while the dates are still editable. */}
                {strandedSessions.length > 0 && (
                  <div className="rounded-xl border border-[#4a3a10] bg-brand/5 px-3.5 py-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-brand">
                      {strandedSessions.length}{" "}
                      {strandedSessions.length === 1 ? "session" : "sessions"}{" "}
                      outside these dates
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-zinc-400">
                      Saving keeps{" "}
                      {strandedSessions.length === 1 ? "it" : "them"} on the
                      agenda, flagged on a day the event no longer covers. Move
                      or delete{" "}
                      {strandedSessions.length === 1 ? "it" : "them"} in Agenda,
                      or widen the dates above.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {strandedSessions.slice(0, 4).map((s) => (
                        <li key={s._id} className="truncate text-xs text-zinc-500">
                          {s.title} ·{" "}
                          {new Date(s.startTime).toLocaleString(undefined, {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </li>
                      ))}
                      {strandedSessions.length > 4 && (
                        <li className="text-xs text-zinc-600">
                          and {strandedSessions.length - 4} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <SelectField
                  label="Timezone"
                  value={timezone}
                  onChange={setTimezone}
                  options={timezoneOptions()}
                />

                <ToggleRow
                  title="This event repeats"
                  description="Run the same event on a recurring schedule."
                  checked={isRepeating}
                  onChange={setIsRepeating}
                />
                {isRepeating && (
                  <SelectField
                    label="Repeats"
                    value={repeatRule}
                    onChange={setRepeatRule}
                    options={[
                      { value: "daily", label: "Every day" },
                      { value: "weekly", label: "Every week" },
                      { value: "biweekly", label: "Every 2 weeks" },
                      { value: "monthly", label: "Every month" },
                    ]}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    label="Category"
                    value={category}
                    onChange={setCategory}
                    options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />
                  <SelectField
                    label="Language"
                    value={language}
                    onChange={setLanguage}
                    options={EVENT_LANGUAGES.map((c) => ({ value: c, label: c }))}
                  />
                </div>

                <div>
                  <FieldLabel>Cover Image</FieldLabel>
                  {bannerPreview ? (
                    <div className="space-y-2">
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#262626] bg-[#1A1A1A]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={bannerPreview}
                          alt="Cover preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#6b6b7b]">
                          Event banner preview · 1920×1080
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBannerFile(null);
                            setBannerPreview("");
                          }}
                          className="border border-[#262626] hover:border-red-500/60 text-zinc-400 hover:text-red-400 rounded-lg p-1.5 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        pickBanner(e.dataTransfer.files?.[0]);
                      }}
                      className="border border-dashed border-[#262626] rounded-xl w-full aspect-video flex flex-col items-center justify-center hover:border-brand/50 transition-colors cursor-pointer bg-[#1A1A1A]/60 hover:bg-[#1A1A1A]/80"
                    >
                      <ImageIcon className="h-7 w-7 text-[#3a3a48]" strokeWidth={1.5} />
                      <p className="mt-3 text-sm text-zinc-400">
                        Drop an image or{" "}
                        <span className="text-brand">browse</span>
                      </p>
                      <p className="mt-1 text-[11px] text-[#6b6b7b]">
                        1920×1080 · JPG, PNG or WebP · up to 8 MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => pickBanner(e.target.files?.[0])}
                  />
                </div>
              </div>
            )}

            {/* ── Step 2 ─────────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <FieldLabel required>How are people attending?</FieldLabel>
                  {/* Online-only is not offered: Hybrid already carries the
                      stream, so a venue-less "virtual" event was the same
                      setup with the venue step switched off. Existing virtual
                      events still render — this is the create form only. */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          value: "in_person",
                          title: "In person",
                          blurb: "At a venue",
                          icon: Building2,
                        },
                        {
                          value: "hybrid",
                          title: "Hybrid",
                          blurb: "Venue + livestream",
                          icon: Monitor,
                        },
                      ] as const
                    ).map((opt) => {
                      const active = format === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormat(opt.value)}
                          className={[
                            "rounded-lg border p-3.5 text-left transition-colors",
                            active
                              ? "border-brand bg-brand/5"
                              : "border-[#262626] bg-[#1A1A1A] hover:border-brand/50",
                          ].join(" ")}
                        >
                          <Icon
                            className={[
                              "h-4 w-4",
                              active ? "text-brand" : "text-zinc-400",
                            ].join(" ")}
                          />
                          <div className="mt-2 text-sm font-semibold text-white">
                            {opt.title}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-400">
                            {opt.blurb}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Every remaining format meets somewhere, so the venue is
                    no longer conditional. */}
                <div>
                  <SectionHeading>Venue details</SectionHeading>
                  <div className="mt-4">
                    <VenuePicker value={venue} onChange={setVenue} />
                  </div>
                </div>

                {format === "hybrid" && (
                  <div>
                    <SectionHeading>Online streaming</SectionHeading>
                    <div className="mt-4 space-y-2.5">
                      {(
                        [
                          {
                            value: "garage_livestream",
                            title: "Garage Livestream",
                            body: "Stream from inside Garage. Nothing to install.",
                            icon: Video,
                          },
                          {
                            value: "money_stream",
                            title: "Money Stream",
                            body: "Monetised stream on the Garage payments rail.",
                            icon: Radio,
                          },
                          {
                            value: "external_link",
                            title: "External link",
                            body: "Zoom, YouTube, or wherever you already host.",
                            icon: Link2,
                          },
                        ] as const
                      ).map((opt) => {
                        const active = streamType === opt.value;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStreamType(opt.value)}
                            className={[
                              "flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                              active
                                ? "border-brand bg-brand/5"
                                : "border-[#262626] bg-[#1A1A1A] hover:border-brand/50",
                            ].join(" ")}
                          >
                            <Icon
                              className={[
                                "mt-0.5 h-4 w-4 shrink-0",
                                active ? "text-brand" : "text-zinc-400",
                              ].join(" ")}
                            />
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {opt.title}
                              </div>
                              <div className="text-xs text-zinc-400">{opt.body}</div>
                            </div>
                          </button>
                        );
                      })}

                      {streamType === "external_link" && (
                        <div>
                          <FieldLabel required>Stream URL</FieldLabel>
                          <Input
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            placeholder="https://zoom.us/j/…"
                            className={INPUT}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <SectionHeading>Capacity &amp; access</SectionHeading>
                  <div className="mt-4 space-y-4">
                    <div>
                      <FieldLabel required>Total Capacity</FieldLabel>
                      <Input
                        type="number"
                        min={isEdit && listedSeats != null ? Math.max(1, listedSeats) : 1}
                        value={totalCapacity}
                        onChange={(e) => setTotalCapacity(e.target.value)}
                        onWheel={blurOnWheel}
                        className={INPUT}
                      />
                      <p
                        className={`mt-1.5 text-xs ${
                          capacityBelowListed ? "text-[#f87171]" : "text-zinc-500"
                        }`}
                      >
                        {capacityBelowListed
                          ? `Your tickets already list ${listedSeats} seats — capacity can't be lower. Reduce ticket quantities first.`
                          : isEdit && listedSeats != null
                            ? `Your tickets list ${listedSeats} of these seats.`
                            : "Ticket quantities, added together, can't go over this."}
                      </p>
                    </div>
                    <ToggleRow
                      icon={<MapPin className="h-5 w-5 text-brand shrink-0" />}
                      title="Make this a private event"
                      description="Hidden from the public page. Direct invite only."
                      checked={isPrivate}
                      onChange={setIsPrivate}
                    />

                    {/* Organizer's own "someone registered" alert */}
                    <div className="rounded-lg border border-[#262626] bg-[#1A1A1A] p-4">
                      <FounderAlertsSection
                        {...founderAlertsForm.sectionProps}
                        context="event"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3 ─────────────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <CapacityMeter
                  listed={draftSeats}
                  capacity={capacityNum}
                  fix="Lower the quantities below, or raise the capacity on the Venue step."
                />
                <div className="space-y-3">
                  {tickets.map((t, i) => (
                    <div
                      key={t.key}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex === null || dragIndex === i) return;
                        const next = [...tickets];
                        const [moved] = next.splice(dragIndex, 1);
                        next.splice(i, 0, moved);
                        setTickets(next);
                        setDragIndex(null);
                      }}
                      className="bg-[#1A1A1A] border border-[#262626] rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <GripVertical className="mt-2.5 h-4 w-4 shrink-0 cursor-grab text-[#4f5065]" />
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-3">
                            <div>
                              <FieldLabel>Ticket Name</FieldLabel>
                              <Input
                                value={t.name}
                                onChange={(e) =>
                                  updateTicket(i, { name: e.target.value })
                                }
                                placeholder="Early bird"
                                className={INPUT}
                              />
                            </div>
                            <div>
                              <FieldLabel>Price</FieldLabel>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={t.price}
                                onChange={(e) =>
                                  updateTicket(i, { price: e.target.value })
                                }
                                onWheel={blurOnWheel}
                                className={INPUT}
                              />
                            </div>
                            <div>
                              <FieldLabel>Quantity</FieldLabel>
                              <Input
                                type="number"
                                min={1}
                                value={t.quantity}
                                onChange={(e) =>
                                  updateTicket(i, { quantity: e.target.value })
                                }
                                onWheel={blurOnWheel}
                                className={INPUT}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <SelectField
                              label="Currency"
                              value={t.currency}
                              onChange={(v) => updateTicket(i, { currency: v })}
                              options={["USD", "INR", "EUR", "GBP", "AED"].map(
                                (c) => ({ value: c, label: c })
                              )}
                            />
                            <div>
                              <FieldLabel>Sales Start</FieldLabel>
                              <DateTimeField
                                value={t.salesStart}
                                placeholder="On save"
                                onChange={(v) => updateTicket(i, { salesStart: v })}
                              />
                            </div>
                            <div>
                              <FieldLabel>Sales End</FieldLabel>
                              <DateTimeField
                                value={t.salesEnd}
                                placeholder="Event start"
                                min={t.salesStart || undefined}
                                onChange={(v) => updateTicket(i, { salesEnd: v })}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#262626]">
                            <div className="flex items-center gap-2.5 pt-3">
                              <SwitchControl
                                checked={t.isVisible}
                                onChange={(v) => updateTicket(i, { isVisible: v })}
                                aria-label="Visible on site"
                              />
                              <span className="text-xs text-zinc-400">
                                Visible on site
                              </span>
                            </div>
                            {tickets.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setTickets((prev) =>
                                    prev.filter((_, ti) => ti !== i)
                                  )
                                }
                                className="mt-3 border border-[#262626] hover:border-red-500/60 text-zinc-400 hover:text-red-400 rounded-lg p-1.5 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    // Starts at the seats still free, so a new type fits by default.
                    onClick={() =>
                      setTickets((prev) => [
                        ...prev,
                        newTicket("", Math.max(1, Math.min(100, capacityNum - draftSeats))),
                      ])
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#262626] py-3.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-brand/50 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add ticket type
                  </button>
                </div>

                {/* Money settings, in the same order and wording every other
                    paid item in Garage uses (see ChannelsPage). Events used to
                    show a bespoke "Settled to Garage Pay" panel with a single
                    GST toggle, which asked a different question from the rest
                    of the product. */}

                {/* GST / Tax */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    GST / Tax
                  </span>
                  <p className="text-xs leading-normal text-zinc-400">
                    18.00% GST (Goods &amp; Services Tax) applies to buyers in
                    India, whatever currency you price in. Does the price above
                    already include it?
                  </p>
                  <div className="flex w-full gap-1 rounded-xl border border-[#262626] bg-[#1A1A1A] p-1">
                    <button
                      type="button"
                      onClick={() => setGstInclusive(true)}
                      className={[
                        "flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all",
                        gstInclusive
                          ? "bg-brand text-brand-foreground"
                          : "text-zinc-400 hover:text-white",
                      ].join(" ")}
                    >
                      Yes, I&apos;ll cover it in the above price
                    </button>
                    <button
                      type="button"
                      onClick={() => setGstInclusive(false)}
                      className={[
                        "flex-1 rounded-lg py-2 text-center text-xs font-medium transition-all",
                        !gstInclusive
                          ? "bg-brand text-brand-foreground"
                          : "text-zinc-400 hover:text-white",
                      ].join(" ")}
                    >
                      No, add it on top
                    </button>
                  </div>
                </div>

                {/* iOS App Purchases */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    iOS App Purchases
                  </span>
                  <p className="text-xs leading-normal text-zinc-400">
                    Do you require your customers to be able to pay for this
                    event on the iOS app?
                  </p>
                  <div className="flex w-full gap-1 rounded-xl border border-[#262626] bg-[#1A1A1A] p-1">
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-brand py-2 text-center text-xs font-bold text-brand-foreground"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info("iOS app purchases coming soon!")}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-transparent py-2 text-center text-xs font-medium text-zinc-400 transition-all hover:bg-[#262626]"
                    >
                      Yes
                      <span className="rounded-full bg-[#262626] px-1.5 py-0.5 text-[10px] font-medium text-brand">
                        Coming Soon
                      </span>
                    </button>
                  </div>
                </div>

                {/* Affiliate commission — the same shared engine the other
                    paid items use. The plan is saved after the event exists,
                    via saveCommissionPlan(eventId) in `submit`. */}
                <div className="border-t border-[#262626] pt-4">
                  <CommissionPlanSection
                    itemType="event"
                    itemName={name.trim() || "New Event"}
                    isPaid={tickets.some((t) => Number(t.price) > 0)}
                  />
                </div>
              </div>
            )}

            {/* ── Steps 4–7: optional setup ──────────────────────────── */}
            {step === 4 && (
              <RegistrationStep
                value={registration}
                onChange={(next) => {
                  setRegistration(next);
                  setRegistrationTouched(true);
                }}
              />
            )}
            {step === 5 && (
              <AgendaStep
                days={eventDays}
                value={sessionDrafts}
                onChange={setSessionDrafts}
              />
            )}
            {step === 6 && (
              <SpeakersStep value={speakerDrafts} onChange={setSpeakerDrafts} />
            )}
            {step === 7 && (
              <SponsorsStep value={sponsorDrafts} onChange={setSponsorDrafts} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-t border-[#262626] bg-[#141414] shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            className="border-[#262626] text-white hover:bg-[#262626] h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            {isEdit ? (
              <>
                {step < lastStep && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step + 1)}
                    className="border-[#262626] text-white hover:bg-[#262626] h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
                  >
                    Continue
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={saving !== null || !step1Valid || capacityBelowListed}
                  onClick={saveEdit}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0 disabled:opacity-50"
                >
                  {saving === "edit" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : step === lastStep ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving !== null}
                  onClick={() => submit("draft")}
                  className="border-[#262626] text-white hover:bg-[#262626] h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
                >
                  {saving === "draft" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Draft"
                  )}
                </Button>
                <Button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => submit("publish")}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
                >
                  {saving === "publish" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Publish Event"
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* The optional steps say so. Without this the founder has no
                    way to tell a step they must finish from one they can walk
                    past, and every new event grows a blank agenda. */}
                {step >= OPTIONAL_FROM && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step + 1)}
                    className="border-[#262626] text-zinc-400 hover:bg-[#262626] hover:text-white h-9 px-4 font-bold rounded-lg transition-colors text-xs shrink-0"
                  >
                    Skip
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={
                    step === 1
                      ? !step1Valid
                      : step === 2
                        ? !step2Valid
                        : step === 3
                          ? ticketsOverCapacity
                          : false
                  }
                  onClick={() => setStep(step + 1)}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground h-9 px-5 font-bold rounded-lg transition-colors text-xs shrink-0 disabled:opacity-50"
                >
                  Continue
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
