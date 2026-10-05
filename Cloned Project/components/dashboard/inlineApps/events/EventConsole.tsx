"use client";

// One event's workspace.
//
// Deliberately has NO navigation of its own. The PLAN / SELL / REACH sections
// are driven by the dashboard's floating bottom bar (see `founder-events` in
// app/(dashboard)/layout.tsx), the same way Deals and Taskroom work — so the
// screen is the event, not a sidebar next to the event.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Circle,
  ExternalLink,
  Globe,
  Layers,
  Link as LinkIcon,
  Loader2,
  Maximize2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  GOLD,
  StatTile,
  formatMoney,
  type ConsoleAction,
} from "./ui";
import { getEvent, publishEvent, unpublishEvent } from "./api";
import { announceEvent } from "./announceEvent";
import type {
  ChecklistItem,
  EventMetrics,
  EventProgram,
  TicketTier,
} from "./types";
import TicketsSection from "./sections/TicketsSection";
import RegistrationsSection from "./sections/RegistrationsSection";
import CouponsSection from "./sections/CouponsSection";
import SpeakersSection from "./sections/SpeakersSection";
import AgendaSection from "./sections/AgendaSection";
import SponsorsSection from "./sections/SponsorsSection";
import CampaignsSection from "./sections/CampaignsSection";
import WebsiteSettings from "./sections/WebsiteSettings";
import CreateEventModal from "./CreateEventModal";

export type ConsoleSection =
  | "overview"
  | "agenda"
  | "speakers"
  | "sponsors"
  | "tickets"
  | "registrations"
  | "coupons"
  | "website"
  | "campaigns";

/**
 * The one action each section leads with. These used to be a button in a
 * header strip above every page; they now ride in the dashboard's floating
 * bottom bar next to the section tabs, so the page itself is only content.
 * Ids are echoed back on `events:action` — sections claim theirs with
 * `useConsoleAction`, and the console handles the rest here.
 */
const SECTION_ACTION: Partial<Record<ConsoleSection, ConsoleAction>> = {
  agenda: { id: "agenda:add", label: "Add session", icon: "plus" },
  speakers: { id: "speakers:add", label: "Add speaker", icon: "plus" },
  sponsors: { id: "sponsors:add", label: "Add sponsor", icon: "plus" },
  tickets: { id: "tickets:add", label: "Add ticket type", icon: "plus" },
  registrations: {
    id: "registrations:export",
    label: "Export CSV",
    icon: "download",
  },
  website: { id: "website:builder", label: "Open builder", icon: "layers" },
};

export default function EventConsole({
  eventId,
  section,
  onSectionChange,
  onBack,
  onOpenBuilder,
  onManageCoupons,
  onOpenNetworkMail,
}: {
  eventId: string;
  section: ConsoleSection;
  onSectionChange: (s: ConsoleSection) => void;
  onBack: () => void;
  /** Receives the event's public URL so the builder can link out to it. */
  onOpenBuilder: (publicUrl: string) => void;
  onManageCoupons?: () => void;
  /** Sends the founder to NetworkMail to finish and send a drafted campaign. */
  onOpenNetworkMail?: (campaignId: string) => void;
}) {
  const [event, setEvent] = useState<EventProgram | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [metrics, setMetrics] = useState<EventMetrics | null>(null);
  const [checklist, setChecklist] = useState<{
    items: ChecklistItem[];
    blockers: string[];
    canPublish: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getEvent(eventId);
      setEvent(res.event);
      setTiers(res.tiers || []);
      setMetrics(res.metrics);
      setChecklist(res.checklist);
    } catch (err: any) {
      toast.error(err?.message || "Could not load this event");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const publicUrl = event ? `/events/${event.slug}` : "";

  async function togglePublish() {
    if (!event) return;
    setBusy(true);
    try {
      if (event.status === "published") {
        await unpublishEvent(event._id);
        toast.success("Event unpublished");
      } else {
        const res = await publishEvent(event._id);
        announceEvent(
          { ...event, ...res.event },
          tiers.filter((t) => t.isVisible && t.kind !== "addon"),
          { draft: false }
        );
      }
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not change the event status");
    } finally {
      setBusy(false);
    }
  }

  // ── Bottom-bar actions ─────────────────────────────────────────────────
  const actions = useMemo<ConsoleAction[]>(() => {
    const list: ConsoleAction[] = [];
    const sectionAction = SECTION_ACTION[section];
    if (sectionAction) list.push(sectionAction);
    if (section === "coupons" && onManageCoupons)
      list.push({
        id: "coupons:manage",
        label: "Manage coupons",
        icon: "external",
      });
    // Publish is event-level state, not a page action — it belongs with the
    // setup checklist that gates it, not one tab away from "Add speaker" on
    // every section.
    if (event && section === "overview") {
      const published = event.status === "published";
      const blocked = !published && !checklist?.canPublish;
      list.push({
        id: "event:publish",
        label: published ? "Unpublish" : "Publish",
        icon: published ? "unpublish" : "publish",
        disabled: blocked,
        title: blocked ? "Finish the setup checklist to publish" : undefined,
      });
    }
    return list;
  }, [section, onManageCoupons, event, checklist?.canPublish]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("events:actions", { detail: { actions } })
    );
  }, [actions]);

  // Clear the bar's actions when the console unmounts, so the catalogue never
  // inherits a stale "Add speaker".
  useEffect(
    () => () => {
      window.dispatchEvent(
        new CustomEvent("events:actions", { detail: { actions: [] } })
      );
    },
    []
  );

  // Actions the console owns; sections claim their own with `useConsoleAction`.
  useEffect(() => {
    const onAction = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id === "event:publish") void togglePublish();
      else if (id === "coupons:manage") onManageCoupons?.();
      else if (id === "website:builder" && publicUrl) onOpenBuilder(publicUrl);
    };
    window.addEventListener("events:action", onAction as EventListener);
    return () =>
      window.removeEventListener("events:action", onAction as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onManageCoupons, onOpenBuilder, publicUrl, event?.status, checklist?.canPublish]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0c0c0e]">
        <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0c0c0e]">
        <p className="text-sm text-[#7c7d94]">This event could not be loaded.</p>
        <Button variant="secondary" onClick={onBack}>
          Back to events
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0c0c0e]">
      {/* No page header and no action strip: the sidebar names the event, and
          the bottom bar carries both the section tabs and this section's one
          action (see `actions` above). The page is only content. */}

      {/* Section body. Bottom padding clears the floating bottom bar. */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
        {section === "overview" && (
          <Overview
            event={event}
            metrics={metrics}
            tiers={tiers}
            checklist={checklist}
            publicUrl={publicUrl}
            onGoto={onSectionChange}
            onOpenBuilder={() => onOpenBuilder(publicUrl)}
            onEdit={() => setEditing(true)}
          />
        )}
        {section === "agenda" && (
          <AgendaSection
            eventId={eventId}
            eventName={event.name}
            event={event}
          />
        )}
        {section === "speakers" && <SpeakersSection eventId={eventId} />}
        {section === "sponsors" && <SponsorsSection eventId={eventId} />}
        {section === "tickets" && (
          <TicketsSection eventId={eventId} capacity={event.totalCapacity} onChanged={load} />
        )}
        {section === "registrations" && (
          <RegistrationsSection eventId={eventId} onChanged={load} />
        )}
        {section === "coupons" && (
          <CouponsSection
            eventId={eventId}
            eventName={event.name}
            onManageCoupons={onManageCoupons}
          />
        )}
        {section === "website" && (
          <>
            <WebsiteLaunchpad
              publicUrl={publicUrl}
              onOpenBuilder={() => onOpenBuilder(publicUrl)}
              eventPublished={event.status === "published"}
            />
            {/* The builder owns the blocks; everything else about the site —
                domain, brand marks, SEO, sharing — lives here, below it. */}
            <WebsiteSettings
              eventId={eventId}
              eventName={event.name}
              publicUrl={publicUrl}
            />
          </>
        )}
        {section === "campaigns" && (
          <CampaignsSection
            event={event}
            metrics={metrics}
            onOpenNetworkMail={onOpenNetworkMail}
          />
        )}
      </div>

      {/* The create wizard in edit mode — same fields, pre-filled, saving
          through PATCH. `onCreated` never fires here. */}
      <CreateEventModal
        isOpen={editing}
        initialEvent={event}
        onClose={() => setEditing(false)}
        onCreated={() => setEditing(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}

// ── REACH → Website ──────────────────────────────────────────────────────

/**
 * The builder is a full-screen tool, not a panel: it needs the whole viewport
 * for a canvas plus two rails. So this section is just the door into it.
 */
function WebsiteLaunchpad({
  publicUrl,
  onOpenBuilder,
  eventPublished,
}: {
  publicUrl: string;
  /** Receives the event's public URL so the builder can link out to it. */
  onOpenBuilder: () => void;
  eventPublished: boolean;
}) {
  return (
    <div className="px-8 py-8">
      <Card className="overflow-hidden">
        <div
          className="flex flex-col items-center justify-center px-8 py-16 text-center"
          style={{
            background: `radial-gradient(120% 140% at 50% 0%, ${GOLD}12 0%, #141418 60%)`,
          }}
        >
          <Layers className="h-9 w-9" style={{ color: GOLD }} strokeWidth={1.4} />
          <h2 className="mt-5 text-lg font-semibold text-white">
            Open the web builder
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#9fa0b8]">
            Drag sections, edit copy and set the theme on a live preview of the
            real page. Opens full screen — nothing else on top of it.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button onClick={onOpenBuilder}>
              <Maximize2 className="h-4 w-4" />
              Open builder
            </Button>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" />
                View live page
              </Button>
            </a>
          </div>

          {!eventPublished && (
            <p className="mt-6 max-w-md text-xs leading-5 text-[#61627a]">
              This event is still a draft, so the public page returns a 404 until
              you publish the event itself.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── PLAN → Overview ──────────────────────────────────────────────────────

function Overview({
  event,
  metrics,
  tiers,
  checklist,
  publicUrl,
  onGoto,
  onOpenBuilder,
  onEdit,
}: {
  event: EventProgram;
  metrics: EventMetrics | null;
  tiers: TicketTier[];
  checklist: { items: ChecklistItem[]; blockers: string[]; canPublish: boolean } | null;
  publicUrl: string;
  onGoto: (s: ConsoleSection) => void;
  /** Receives the event's public URL so the builder can link out to it. */
  onOpenBuilder: () => void;
  /** Opens the create wizard pre-filled with this event. */
  onEdit: () => void;
}) {
  const sold = metrics?.ticketsSold ?? 0;
  const capacity = metrics?.totalCapacity || event.totalCapacity || 1;
  const pct = Math.min(100, Math.round((sold / capacity) * 100));

  return (
    <div className="px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm text-[#7c7d94]">
          {new Date(event.startsAt).toLocaleString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "numeric",
            minute: "2-digit",
          })}
          {event.timezone ? ` · ${event.timezone}` : ""}
        </span>
        <div className="flex items-center gap-2">
          {/* The only way back into the event's own details — everything else
              on this screen edits things that hang off the event. */}
          <Button variant="secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit Event
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard
                ?.writeText(`${window.location.origin}${publicUrl}`)
                .then(() => toast.success("Public link copied"))
                .catch(() => toast.error("Could not copy the link"));
            }}
          >
            <LinkIcon className="h-4 w-4" />
            Copy link
          </Button>
          {/* The only remaining way in to the live page from the console —
              the old header strip that carried it is gone. */}
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-4 w-4" />
              View page
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Tickets sold"
          value={`${sold}`}
          sub={`of ${capacity} seats`}
          accent
        />
        <StatTile
          label="Registrations"
          value={`${metrics?.registrations ?? 0}`}
          sub={`${metrics?.approved ?? 0} approved`}
        />
        <StatTile
          label="Gross revenue"
          value={formatMoney(metrics?.grossRevenue ?? 0, metrics?.currency || "USD")}
          sub="Settled to Garage Pay"
        />
        <StatTile
          label="Checked in"
          value={`${metrics?.checkedIn ?? 0}`}
          sub="At the door"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-white">Capacity</h2>
            <span className="text-xs text-[#7c7d94]">{pct}% sold</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#22222b]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: GOLD }}
            />
          </div>

          <div className="mt-7 space-y-3">
            {tiers.length === 0 ? (
              <p className="text-sm text-[#7c7d94]">
                No ticket types yet.{" "}
                <button
                  type="button"
                  onClick={() => onGoto("tickets")}
                  className="underline"
                  style={{ color: GOLD }}
                >
                  Add one
                </button>
                .
              </p>
            ) : (
              tiers.map((t) => {
                const tierPct =
                  t.quantity > 0
                    ? Math.min(100, Math.round((t.soldCount / t.quantity) * 100))
                    : 0;
                return (
                  <div key={t._id}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-[#c7c7da]">{t.name}</span>
                      <span className="tabular-nums text-[#7c7d94]">
                        {t.soldCount}/{t.quantity}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1c1c24]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${tierPct}%`, background: "#4a4a5c" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-white">Setup checklist</h2>
          <ul className="space-y-3">
            {(checklist?.items || []).map((item) => (
              <li key={item.key} className="flex items-start gap-2.5 text-sm">
                {item.done ? (
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                    style={{ background: GOLD }}
                  >
                    <Check className="h-2.5 w-2.5 text-[#141418]" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#3a3a48]" />
                )}
                <span
                  className={item.done ? "text-[#7c7d94] line-through" : "text-[#c7c7da]"}
                >
                  {item.label}
                  {!item.required && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-[#4f5065]">
                      optional
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-[#1c1c24] pt-5">
            <div className="flex items-center gap-2 text-xs text-[#7c7d94]">
              <Globe className="h-3.5 w-3.5" />
              <span className="truncate">{publicUrl}</span>
            </div>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={onOpenBuilder}
            >
              <Layers className="h-4 w-4" />
              Open website builder
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
