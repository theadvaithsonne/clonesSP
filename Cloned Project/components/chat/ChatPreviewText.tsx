"use client";

import React from "react";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckSquare,
  FileText,
  ImagePlay,
  MapPin,
  Share2,
  Sticker,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  APPROVAL_MARKER,
  CONTACT_MARKER,
  DEAL_MARKER,
  DOC_MARKER,
  GIF_MARKER,
  LOC_MARKER,
  MEET_MARKER,
  POLL_MARKER,
  SHARE_MARKER,
  TASK_MARKER,
  parseMarker,
  type ParsedMarker,
} from "@/lib/chat-markers";

const MARKERS = [
  LOC_MARKER,
  CONTACT_MARKER,
  GIF_MARKER,
  TASK_MARKER,
  POLL_MARKER,
  MEET_MARKER,
  DEAL_MARKER,
  APPROVAL_MARKER,
  DOC_MARKER,
  SHARE_MARKER,
];

function describe(m: ParsedMarker): { icon: LucideIcon; label: string } {
  switch (m.type) {
    case "gif":
      return m.data.kind === "sticker" ? { icon: Sticker, label: "Sticker" } : { icon: ImagePlay, label: "GIF" };
    case "location":
      return { icon: MapPin, label: m.data.label || "Location" };
    case "contact":
      return { icon: User, label: m.data.name };
    case "task":
      return { icon: CheckSquare, label: m.data.title };
    case "poll":
      return { icon: BarChart3, label: m.data.question };
    case "meet":
      return { icon: CalendarClock, label: m.data.title };
    case "deal":
      return { icon: Briefcase, label: m.data.name };
    case "approval":
      return { icon: CheckSquare, label: m.data.title };
    case "doc":
      return { icon: FileText, label: m.data.name };
    case "share":
      return { icon: Share2, label: m.data.title };
  }
}

/**
 * Last-message preview for chat lists. Rich messages (GIFs, locations, polls…)
 * are stored as `[garage-x]{json}` text; this shows them the way WhatsApp
 * does — a small icon and a word — instead of the raw payload. Keeps any
 * sender prefix such as "You: ".
 */
export function ChatPreviewText({ text }: { text: string }) {
  const at = MARKERS.reduce((min, mk) => {
    const i = text.indexOf(mk);
    return i !== -1 && (min === -1 || i < min) ? i : min;
  }, -1);
  if (at === -1) return <>{text}</>;

  const parsed = parseMarker(text.slice(at));
  if (!parsed) return <>{text.slice(0, at)}</>;

  const { icon: Icon, label } = describe(parsed);
  return (
    <>
      {text.slice(0, at)}
      <Icon className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px align-middle" aria-hidden="true" />
      {label}
    </>
  );
}
