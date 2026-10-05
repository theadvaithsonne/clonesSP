"use client";

// Right-side panel listing everyone who fronted a live stream — its host and
// every co-host. Opened by "View all speakers" on the Live Streams tab, where
// the cell only has room for the first one.
//
// Same shell as community-detail-drawer.tsx beside it (overlay + fixed aside +
// centred title), so the profile page has one drawer language.

import { useEffect } from "react";
import { X } from "lucide-react";

import type { MemberLiveStreamRow } from "@/lib/affiliate/downline-livestreams-api";
import { getCountryFlag } from "@/lib/country-flag";
import { initialsOf } from "@/components/ui/data-table/cells";

export type SpeakersDrawerState = {
  streamName: string;
  speakers: MemberLiveStreamRow["speakers"];
};

export function SpeakersDrawer({
  drawer,
  onClose,
}: {
  drawer: SpeakersDrawerState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, onClose]);

  if (!drawer) return null;
  const { streamName, speakers } = drawer;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/[0.08] bg-[#0e0e12] shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.12] text-zinc-300 transition hover:bg-white/[0.05]"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="flex-1 pr-9 text-center text-lg font-semibold text-white">
            Speakers
          </h3>
        </div>

        <p className="truncate px-5 pb-4 text-center text-[13px] text-zinc-500">
          {streamName}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <div className="space-y-2">
            {speakers.map((sp, i) => (
              // Two accounts can carry the same person's name here, so the key
              // and the identity on screen both lean on the email.
              <div
                key={`${sp.email || sp.name}-${i}`}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.06] text-[12px] font-semibold text-zinc-200">
                  {sp.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sp.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initialsOf(sp.name)
                  )}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="truncate font-semibold text-white">{sp.name}</div>
                  {sp.email && (
                    <div className="truncate text-[12px] text-zinc-400">{sp.email}</div>
                  )}
                  {sp.phone && (
                    <div className="flex items-center gap-1 truncate text-[12px] text-zinc-400">
                      {sp.country && (
                        <span aria-hidden>{getCountryFlag(sp.country)}</span>
                      )}
                      {sp.phone}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
