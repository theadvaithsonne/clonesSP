"use client";

// "Which event?"
//
// Every PLAN / SELL / REACH page is a page *of an event*, so landing on one
// with nothing open used to mean the sidebar item was simply dead — greyed out
// with an "Open an event first" tooltip and no way to act on it. This asks the
// question instead: pick an event and you land on the page you actually
// clicked. It doubles as the switcher for jumping between events without going
// back to the catalogue.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Search } from "lucide-react";
import { GOLD, Modal } from "./ui";
import { listEvents } from "./api";
import type { EventProgram } from "./types";

export default function EventPickerModal({
  open,
  onClose,
  onSelect,
  currentEventId,
  /** The page the picker is standing in for, e.g. "Tickets". */
  destinationLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (eventId: string) => void;
  currentEventId?: string;
  destinationLabel?: string;
}) {
  const [events, setEvents] = useState<EventProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEvents({ limit: 100 });
      setEvents(res.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    void load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.name.toLowerCase().includes(q));
  }, [events, search]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        destinationLabel ? `Open ${destinationLabel} for…` : "Choose an event"
      }
    >
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events"
          className="w-full rounded-lg border border-[#2a2a35] bg-[#141418] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-[#4f5065] focus:border-[#4a4a5c] focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#4f5065]" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#7c7d94]">
          {events.length === 0
            ? "No events yet — create one from the bottom bar."
            : "No event matches that search."}
        </p>
      ) : (
        <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
          {filtered.map((e) => {
            const current = e._id === currentEventId;
            return (
              <button
                key={e._id}
                type="button"
                onClick={() => onSelect(e._id)}
                className={[
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  current
                    ? "border-[#3b3b4a] bg-[#1a1a22]"
                    : "border-transparent hover:border-[#2a2a35] hover:bg-[#15151b]",
                ].join(" ")}
              >
                {e.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.bannerUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1c1c24]">
                    <CalendarDays className="h-4 w-4 text-[#4f5065]" />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{e.name}</span>
                  <span className="block truncate text-xs text-[#61627a]">
                    {new Date(e.startsAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </span>

                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                  style={
                    e.status === "published"
                      ? { background: `${GOLD}1f`, color: GOLD }
                      : { background: "#22222b", color: "#7c7d94" }
                  }
                >
                  {e.status}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
