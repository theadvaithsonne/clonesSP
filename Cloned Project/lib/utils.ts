import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string (ISO or yyyy-MM-dd) into a local Date without timezone shift.
 * Prevents UTC midnight dates from displaying as the previous day in western timezones.
 */
export function parseDateLocal(dateStr: string): Date {
  const parts = dateStr.split("T")[0].split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function formatTime12Hour(time24: string): string {
  if (!time24) return "";
  const [hourStr, minStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const minutes = minStr || "00";
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${hour12}:${minutes} ${ampm}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|ol|ul|pre)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

