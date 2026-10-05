"use client";

// Shell for the Events module.
//
// Lives at /workspace under the Founder tab, driven by the `Founder:Events`
// popover — there is no /events route. Navigation between the event list and
// the PLAN / SELL / REACH sections comes from the dashboard's floating bottom
// bar, which talks to this component over CustomEvents rather than props,
// mirroring `channels:open-create-modal` and `deals:inline-navigate`.
//
//   events:open-create-modal   → open the create form
//   events:navigate {section}  → switch section, or "list" to go back
//   events:state {section}     ← broadcast so the bottom bar can render the
//                                right tab set
//
// The web builder is a full-screen tool: it mounts above everything (including
// the bottom bar) with its own exit control.

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { InlineAppProps } from "../registry";
import EventsListView from "./EventsListView";
import EventConsole, { type ConsoleSection } from "./EventConsole";
import CreateEventModal from "./CreateEventModal";
import EventPickerModal from "./EventPickerModal";
import WebsiteBuilder from "./WebsiteBuilder";

type View = { kind: "list" } | { kind: "console"; eventId: string };

/** What the bottom bar highlights: "list", or a console section. */
export type EventsNavSection = "list" | ConsoleSection;

/** Human names for the picker's "Open Tickets for…" title. */
const SECTION_LABELS: Record<ConsoleSection, string> = {
  overview: "Overview",
  agenda: "Agenda",
  speakers: "Speakers",
  sponsors: "Sponsors & Exhibitors",
  tickets: "Tickets",
  registrations: "Registrations",
  coupons: "Promotions",
  website: "Event Website",
  campaigns: "Email Campaigns",
};

const CONSOLE_SECTIONS: ConsoleSection[] = [
  "overview",
  "agenda",
  "speakers",
  "sponsors",
  "tickets",
  "registrations",
  "coupons",
  "website",
  "campaigns",
];

/**
 * `onClose` stays required to match `InlineAppProps` exactly — React's
 * ComponentClass props are invariant, so widening it to optional here makes the
 * component unassignable to `INLINE_APP_REGISTRY`. Hosts that have nothing to
 * close pass a no-op alongside `showClose={false}`.
 */
export default function EventsApp({
  onClose,
  initialEventId,
  showClose = true,
  onNavigatePopover,
}: InlineAppProps & {
  initialEventId?: string;
  showClose?: boolean;
  /** Lets the module hand the user off to another dashboard surface. */
  onNavigatePopover?: (popover: string) => void;
}) {
  const [view, setView] = useState<View>(
    initialEventId ? { kind: "console", eventId: initialEventId } : { kind: "list" }
  );
  const [section, setSection] = useState<ConsoleSection>("overview");
  const [creating, setCreating] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderUrl, setBuilderUrl] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Set when a console section was asked for with no event open. Holds the
  // section so the pick lands on the page the user actually clicked.
  const [pickerFor, setPickerFor] = useState<ConsoleSection | null>(null);

  // Read inside window listeners, which are registered once and would
  // otherwise close over a stale `view`.
  const viewRef = useRef(view);
  viewRef.current = view;

  // Tell the host which page we are on. Both the sidebar and the floating
  // bottom bar read this to highlight the right item.
  const broadcast = useCallback((next: EventsNavSection) => {
    window.dispatchEvent(
      new CustomEvent("events:state", { detail: { section: next } })
    );
  }, []);

  const openList = useCallback(() => {
    setView({ kind: "list" });
    setReloadKey((k) => k + 1);
    broadcast("list");
  }, [broadcast]);

  const openEvent = useCallback(
    (eventId: string) => {
      setView({ kind: "console", eventId });
      setSection("overview");
      broadcast("overview");
    },
    [broadcast]
  );

  const gotoSection = useCallback(
    (next: ConsoleSection) => {
      setSection(next);
      broadcast(next);
    },
    [broadcast]
  );

  const openCreate = useCallback(() => {
    setView({ kind: "list" });
    setCreating(true);
    broadcast("list");
  }, [broadcast]);

  // ── Host → module ──────────────────────────────────────────────────────
  useEffect(() => {
    const onOpenCreate = () => openCreate();
    const onNavigate = (e: Event) => {
      const next = (e as CustomEvent<{ section?: string }>).detail?.section;
      if (!next) return;
      if (next === "list") {
        openList();
        return;
      }
      // Sections are only meaningful inside an event; ignored on the list.
      if (!CONSOLE_SECTIONS.includes(next as ConsoleSection)) return;
      if (viewRef.current.kind === "console") {
        gotoSection(next as ConsoleSection);
        return;
      }
      // A section is a page *of an event*. With none open, ask which one
      // rather than leaving the sidebar item inert.
      setPickerFor(next as ConsoleSection);
    };

    window.addEventListener("events:open-create-modal", onOpenCreate);
    window.addEventListener("events:navigate", onNavigate as EventListener);
    return () => {
      window.removeEventListener("events:open-create-modal", onOpenCreate);
      window.removeEventListener("events:navigate", onNavigate as EventListener);
    };
  }, [openCreate, openList, gotoSection]);

  // Announce the starting state once, so a freshly-opened module doesn't leave
  // the bottom bar showing whatever the previous surface had.
  useEffect(() => {
    broadcast(view.kind === "console" ? section : "list");
    // Intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full bg-[#0c0c0e]">
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-lg p-2 text-[#7c7d94] transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Close events"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {view.kind === "list" && (
        <EventsListView
          key={reloadKey}
          onCreate={openCreate}
          onOpen={openEvent}
        />
      )}

      {view.kind === "console" && (
        <EventConsole
          eventId={view.eventId}
          section={section}
          onSectionChange={gotoSection}
          onBack={openList}
          onOpenBuilder={(publicUrl) => {
            setBuilderUrl(publicUrl);
            setBuilderOpen(true);
          }}
          onManageCoupons={
            onNavigatePopover
              ? () => onNavigatePopover("Office Settings:coupons")
              : undefined
          }
          onOpenNetworkMail={
            onNavigatePopover
              ? () => onNavigatePopover("Network Mail")
              : undefined
          }
        />
      )}

      <EventPickerModal
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        currentEventId={view.kind === "console" ? view.eventId : undefined}
        destinationLabel={pickerFor ? SECTION_LABELS[pickerFor] : undefined}
        onSelect={(eventId) => {
          const target = pickerFor || "overview";
          setPickerFor(null);
          setView({ kind: "console", eventId });
          setSection(target);
          broadcast(target);
        }}
      />

      <CreateEventModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={(eventId) => {
          setCreating(false);
          openEvent(eventId);
        }}
      />

      {/* Full-screen builder. z-[700] clears the floating bottom nav (z-550)
          and the right panel, so the canvas really is the whole screen. */}
      {builderOpen && view.kind === "console" && (
        <div className="fixed inset-0 z-[700] bg-[#0c0c0e]">
          <WebsiteBuilder
            eventId={view.eventId}
            publicUrl={builderUrl}
            onExit={() => setBuilderOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
