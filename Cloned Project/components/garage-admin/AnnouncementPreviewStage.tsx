"use client";

// The preview backdrop for Alerts & Promotions.
//
// The card on its own tells an admin nothing about *placement* — a Compact
// dialog and a Top Banner look equally fine floating in a void. This renders
// the announcement over a schematic of the page it will actually land on
// (the login screen, or the dashboard), dimmed exactly the way the live
// overlay dims it.
//
// It is a scaled-down fixed viewport, not a responsive layout: the card is
// the real component at its real pixel width, and the whole 1200×750 stage is
// transform-scaled to fit whatever space the preview pane has. That way a
// Wide (768px) card and a Compact (384px) card stay honestly different sizes
// relative to the page behind them.

import { useEffect, useRef, useState } from "react";
import AnnouncementCard from "@/components/announcements/AnnouncementCard";
import type { AnnouncementDraft } from "@/lib/announcements";

const STAGE_W = 1200;
const STAGE_H = 750;

/** Filler bar — the schematics are all made of these. */
function Bar({
  w,
  h = 8,
  className = "bg-white/[0.22]",
}: {
  w: number | string;
  h?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-full ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: `${h}px` }}
    />
  );
}

/** The login / signup screen: centred card on the dark Garage background. */
function PreLoginBackdrop() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_-10%,#1c1c1c_0%,#0a0a0a_60%)]">
      <div className="w-[380px] rounded-2xl border border-[#2a2a2a] bg-[#101010] p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-brand" />
          <Bar w={92} h={12} className="bg-white/[0.34]" />
        </div>
        <Bar w={200} h={16} className="mb-2 bg-white/[0.42]" />
        <Bar w={150} h={9} className="mb-7" />
        <div className="mb-3 h-11 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]" />
        <div className="mb-5 grid h-11 place-items-center rounded-lg bg-brand">
          <Bar w={70} h={9} className="bg-black/50" />
        </div>
        <div className="flex justify-center">
          <Bar w={130} h={8} />
        </div>
      </div>
    </div>
  );
}

/** The dashboard: icon rail, chat list, workspace grid. */
function PostLoginBackdrop() {
  return (
    <div className="absolute inset-0 flex bg-[#0d0d0d]">
      {/* icon rail */}
      <div className="flex w-[68px] shrink-0 flex-col items-center gap-3 border-r border-[#212121] bg-[#0f0f0f] py-4">
        <div className="h-9 w-9 rounded-lg bg-brand" />
        <div className="mt-2 h-8 w-8 rounded-lg bg-white/[0.26]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 rounded-lg bg-white/[0.16]" />
        ))}
      </div>

      {/* list column */}
      <div className="w-[248px] shrink-0 border-r border-[#212121] bg-[#0f0f0f] p-4">
        <Bar w={96} h={12} className="mb-4 bg-white/[0.34]" />
        <div className="mb-5 h-9 rounded-lg bg-white/[0.26]" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="mb-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-white/[0.18]" />
            <div className="flex-1">
              <Bar w="70%" h={8} className="mb-1.5 bg-white/[0.28]" />
              <Bar w="45%" h={7} className="bg-white/[0.16]" />
            </div>
          </div>
        ))}
      </div>

      {/* main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#212121] px-6">
          <Bar w={140} h={12} className="bg-white/[0.34]" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-md bg-white/[0.28]" />
            <div className="h-7 w-7 rounded-full bg-white/[0.22]" />
          </div>
        </div>
        <div className="grid flex-1 grid-cols-3 content-start gap-4 p-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-[120px] rounded-xl border border-[#212121] bg-[#101010] p-4"
            >
              <div className="mb-3 h-7 w-7 rounded-md bg-white/[0.2]" />
              <Bar w="80%" h={8} className="mb-2 bg-white/[0.26]" />
              <Bar w="55%" h={7} className="bg-white/[0.15]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementPreviewStage({
  data,
  surface,
}: {
  data: AnnouncementDraft;
  /** Which page to draw behind it. "everywhere" is shown as one or the other. */
  surface: "pre-login" | "post-login";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  // Fit the fixed 1200px stage to whatever the pane gives us. ResizeObserver
  // rather than a window listener: the pane also changes width when the
  // editor's own layout switches between one and two columns.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / STAGE_W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isBanner = data.size === "banner";

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden rounded-lg border border-[#262626]"
      style={{ height: STAGE_H * scale }}
    >
      <div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="relative"
      >
        {surface === "pre-login" ? <PreLoginBackdrop /> : <PostLoginBackdrop />}

        {/* The banner does not dim the page — it is a strip, not a modal.
            The modal dim is lighter here than the live 70%: at full strength
            the schematic behind it went solid black and the whole point of
            this pane (seeing WHERE the dialog lands) was lost. */}
        {!isBanner && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
        )}

        {isBanner ? (
          <div className="absolute inset-x-0 top-0">
            <AnnouncementCard
              data={data}
              onDismiss={() => {}}
              onDiscard={() => {}}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <AnnouncementCard
              data={data}
              onDismiss={() => {}}
              onDiscard={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
}
