import { formatDistanceToNow, isValid } from "date-fns";

export function getUserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function getTimeZoneAbbreviation(date = new Date()): string {
  const tz = getUserTimeZone();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

export function parseCreatedAt(value?: string | number | null): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(value);
  return isValid(d) ? d : null;
}

export function formatCreatedAtDateTime(value?: string | number | null): string | null {
  const d = parseCreatedAt(value);
  if (!d) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: getUserTimeZone(),
  }).format(d);
}

export function formatCreatedAtElapsed(value?: string | number | null): string | null {
  const d = parseCreatedAt(value);
  if (!d) return null;
  return formatDistanceToNow(d, { addSuffix: true });
}
