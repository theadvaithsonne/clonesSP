// Timezone + duration helpers, copied verbatim from the NetworkChains web app
// (components/meet/schedule-fields.tsx) so the Garage admin catch-up scheduler
// behaves identically. Only the pure helpers are taken — the NC field
// components pull in NC-only dependencies.

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}


const TZ_ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Pacific/Honolulu': 'Pacific/Honolulu',
};

export function durationMinutesBetween(start: string, end: string): number {
  let d = toMinutes(end) - toMinutes(start);
  if (d <= 0) d += 1440;
  return d;
}

export function canonicalTz(tz: string): string {
  return TZ_ALIASES[tz] ?? tz;
}

// Curated common zones with proper City, Country labels (shown first). Anything
// else falls back to the IANA city + continent so every zone is still findable.
const COMMON_TZ: { tz: string; city: string; country: string }[] = [
  { tz: 'Pacific/Honolulu', city: 'Honolulu', country: 'USA' },
  { tz: 'America/Anchorage', city: 'Anchorage', country: 'USA' },
  { tz: 'America/Los_Angeles', city: 'Los Angeles', country: 'USA' },
  { tz: 'America/Denver', city: 'Denver', country: 'USA' },
  { tz: 'America/Phoenix', city: 'Phoenix', country: 'USA' },
  { tz: 'America/Chicago', city: 'Chicago', country: 'USA' },
  { tz: 'America/New_York', city: 'New York', country: 'USA' },
  { tz: 'America/Toronto', city: 'Toronto', country: 'Canada' },
  { tz: 'America/Vancouver', city: 'Vancouver', country: 'Canada' },
  { tz: 'America/Mexico_City', city: 'Mexico City', country: 'Mexico' },
  { tz: 'America/Bogota', city: 'Bogotá', country: 'Colombia' },
  { tz: 'America/Sao_Paulo', city: 'São Paulo', country: 'Brazil' },
  { tz: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires', country: 'Argentina' },
  { tz: 'Atlantic/Reykjavik', city: 'Reykjavik', country: 'Iceland' },
  { tz: 'Europe/London', city: 'London', country: 'United Kingdom' },
  { tz: 'Europe/Dublin', city: 'Dublin', country: 'Ireland' },
  { tz: 'Europe/Lisbon', city: 'Lisbon', country: 'Portugal' },
  { tz: 'Europe/Madrid', city: 'Madrid', country: 'Spain' },
  { tz: 'Europe/Paris', city: 'Paris', country: 'France' },
  { tz: 'Europe/Amsterdam', city: 'Amsterdam', country: 'Netherlands' },
  { tz: 'Europe/Berlin', city: 'Berlin', country: 'Germany' },
  { tz: 'Europe/Zurich', city: 'Zurich', country: 'Switzerland' },
  { tz: 'Europe/Rome', city: 'Rome', country: 'Italy' },
  { tz: 'Europe/Stockholm', city: 'Stockholm', country: 'Sweden' },
  { tz: 'Europe/Athens', city: 'Athens', country: 'Greece' },
  { tz: 'Europe/Istanbul', city: 'Istanbul', country: 'Turkey' },
  { tz: 'Europe/Moscow', city: 'Moscow', country: 'Russia' },
  { tz: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria' },
  { tz: 'Africa/Johannesburg', city: 'Johannesburg', country: 'South Africa' },
  { tz: 'Africa/Cairo', city: 'Cairo', country: 'Egypt' },
  { tz: 'Africa/Nairobi', city: 'Nairobi', country: 'Kenya' },
  { tz: 'Asia/Dubai', city: 'Dubai', country: 'UAE' },
  { tz: 'Asia/Riyadh', city: 'Riyadh', country: 'Saudi Arabia' },
  { tz: 'Asia/Tehran', city: 'Tehran', country: 'Iran' },
  { tz: 'Asia/Karachi', city: 'Karachi', country: 'Pakistan' },
  { tz: 'Asia/Kolkata', city: 'Kolkata', country: 'India' },
  { tz: 'Asia/Colombo', city: 'Colombo', country: 'Sri Lanka' },
  { tz: 'Asia/Kathmandu', city: 'Kathmandu', country: 'Nepal' },
  { tz: 'Asia/Dhaka', city: 'Dhaka', country: 'Bangladesh' },
  { tz: 'Asia/Bangkok', city: 'Bangkok', country: 'Thailand' },
  { tz: 'Asia/Jakarta', city: 'Jakarta', country: 'Indonesia' },
  { tz: 'Asia/Singapore', city: 'Singapore', country: 'Singapore' },
  { tz: 'Asia/Kuala_Lumpur', city: 'Kuala Lumpur', country: 'Malaysia' },
  { tz: 'Asia/Manila', city: 'Manila', country: 'Philippines' },
  { tz: 'Asia/Hong_Kong', city: 'Hong Kong', country: 'Hong Kong' },
  { tz: 'Asia/Shanghai', city: 'Shanghai', country: 'China' },
  { tz: 'Asia/Taipei', city: 'Taipei', country: 'Taiwan' },
  { tz: 'Asia/Seoul', city: 'Seoul', country: 'South Korea' },
  { tz: 'Asia/Tokyo', city: 'Tokyo', country: 'Japan' },
  { tz: 'Australia/Perth', city: 'Perth', country: 'Australia' },
  { tz: 'Australia/Sydney', city: 'Sydney', country: 'Australia' },
  { tz: 'Pacific/Auckland', city: 'Auckland', country: 'New Zealand' },
  { tz: 'UTC', city: 'UTC', country: 'Coordinated Universal Time' },
];

export interface TzEntry {
  tz: string;
  city: string;
  country: string; // country name, or continent fallback
}

export const TIMEZONES: TzEntry[] = (() => {
  const seen = new Set(COMMON_TZ.map((t) => t.tz));
  const out: TzEntry[] = [...COMMON_TZ];
  let all: string[] = [];
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (fn) all = fn('timeZone');
  } catch {
    /* no full list available */
  }
  for (const tz of all) {
    if (seen.has(tz)) continue;
    const segs = tz.split('/');
    out.push({
      tz,
      city: (segs[segs.length - 1] || tz).replace(/_/g, ' '),
      country: segs.length > 1 ? segs[0].replace(/_/g, ' ') : '',
    });
  }
  return out;
})();


/**
 * Offset (ms) of `timeZone` from UTC at the given instant.
 * Renders the instant in that zone, reads the wall clock back as if it were
 * UTC, and diffs — Intl has no direct offset accessor.
 */
function zoneOffsetMs(ts: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    // Some engines render midnight as "24" under hour12:false.
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - ts;
}

/**
 * Convert a wall-clock date + time IN `timeZone` to the correct UTC instant.
 *
 * `new Date("2026-09-05T17:00")` reads the wall clock in the BROWSER's zone,
 * so an operator in London picking "5pm Asia/Kolkata" scheduled the call 4h30
 * away from where the host expected it — the picked timezone was decorative.
 *
 * There is no built-in inverse of Intl, so: assume the wall clock is UTC,
 * measure how that instant actually renders in the target zone, and subtract
 * the difference. Repeated twice because the offset itself can differ either
 * side of a DST boundary, and the first guess can land on the wrong side.
 */
export function zonedWallClockToUtc(ymd: string, hm: string, timeZone: string): Date {
  const asIfUtc = Date.parse(`${ymd}T${hm}:00Z`);
  if (Number.isNaN(asIfUtc)) return new Date(NaN);
  let ts = asIfUtc;
  for (let i = 0; i < 2; i++) ts = asIfUtc - zoneOffsetMs(ts, timeZone);
  return new Date(ts);
}
