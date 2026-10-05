/**
 * Calendar link + .ics helpers.
 *
 * Every value is supplied by the caller — nothing about the event is baked
 * in here — so the same helpers serve webinars, workshops, bookings, etc.
 */

export interface CalendarEvent {
  title: string;
  description?: string | null;
  /** ISO string, Date, or epoch ms. */
  startDateTime: string | number | Date;
  /** ISO string, Date, or epoch ms. Falls back to start + 1h when absent. */
  endDateTime?: string | number | Date | null;
  /** Free-text location — for a stream this is the join URL. */
  location?: string | null;
  /** Absolute URL surfaced inside the .ics description + Google `details`. */
  url?: string | null;
}

const HOUR_MS = 60 * 60 * 1000;

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function resolveWindow(event: CalendarEvent): { start: Date; end: Date } {
  const start = toDate(event.startDateTime);
  const rawEnd = event.endDateTime ? toDate(event.endDateTime) : null;
  const end =
    rawEnd && Number.isFinite(rawEnd.getTime()) && rawEnd.getTime() > start.getTime()
      ? rawEnd
      : new Date(start.getTime() + HOUR_MS);
  return { start, end };
}

/** `20260815T133000Z` — the basic-format UTC stamp both Google and iCalendar want. */
function toBasicUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Strip HTML so rich-text descriptions don't leak tags into calendar apps. */
function toPlainText(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildDetails(event: CalendarEvent): string {
  const body = toPlainText(event.description);
  const url = event.url?.trim();
  if (body && url) return `${body}\n\nJoin here: ${url}`;
  if (url) return `Join here: ${url}`;
  return body;
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const { start, end } = resolveWindow(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toBasicUtc(start)}/${toBasicUtc(end)}`,
  });
  const details = buildDetails(event);
  if (details) params.set("details", details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const { start, end } = resolveWindow(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  const details = buildDetails(event);
  if (details) params.set("body", details);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** RFC 5545 escaping: backslash, semicolon, comma, newline. */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps content lines at 75 octets; continuations start with a space. */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

export function buildIcsContent(event: CalendarEvent, uid?: string): string {
  const { start, end } = resolveWindow(event);
  const details = buildDetails(event);
  // DTSTAMP must be a real timestamp; derive it from the event start rather
  // than "now" so the same event always serialises identically.
  const stamp = toBasicUtc(start);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Garage//Live Session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(uid || `${toBasicUtc(start)}-${event.title}`)}@garage.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toBasicUtc(start)}`,
    `DTEND:${toBasicUtc(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(details ? [`DESCRIPTION:${escapeIcs(details)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
    ...(event.url ? [`URL:${escapeIcs(event.url)}`] : []),
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`${event.title} starts in 15 minutes`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n");
}

/** Builds the .ics in-memory and triggers a browser download. No-op on the server. */
export function downloadIcsFile(event: CalendarEvent, fileName?: string): void {
  if (typeof window === "undefined") return;
  const content = buildIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download =
    fileName ||
    `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}
